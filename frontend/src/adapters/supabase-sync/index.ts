import { throwIfAborted } from "@/core/abort";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Level } from "../../core/content/types";
import { mergeExamAttempts } from "../../core/exam/engine";
import type {
  ExamAttemptStatus,
  ExamSectionAttemptSummary,
} from "../../core/exam/types";
import {
  PROGRESS_KINDS,
  type ProgressKind,
  type ProgressRow,
  timestampKey,
  validateProgressRow,
} from "../../core/progress";
import type { KanjiQuizMode } from "../../core/progress/types";
import type { ProgressRemote } from "../../core/sync";

type WireBase = { user_id: string; level: Level; client_updated_at: string };
type WireRow = WireBase &
  (
    | { item_id: string; known: boolean }
    | { item_id: string; learned: boolean }
    | {
        id: string;
        mode: KanjiQuizMode;
        score: number;
        total: number;
        wrong_item_ids: string[];
      }
    | { id: string; item_id: string; score: number; total: number }
    | {
        id: string;
        exam_id: string;
        status: ExamAttemptStatus;
        attempt_number: number;
        total_score: number;
        total_questions: number;
        sections: ExamSectionAttemptSummary[];
        answers: Record<string, number>;
        started_at: string;
        completed_at: string | null;
      }
  );
type RemoteRow = WireRow & { server_updated_at: string };

const columns = {
  card_status: "item_id,known",
  grammar_learned: "item_id,learned",
  kanji_quiz_attempts: "id,mode,score,total,wrong_item_ids",
  reading_attempts: "id,item_id,score,total",
  exam_attempts:
    "id,exam_id,status,attempt_number,total_score,total_questions,sections,answers,started_at,completed_at",
} satisfies Record<ProgressKind, string>;

function isStatus(kind: ProgressKind) {
  return kind === "card_status" || kind === "grammar_learned";
}

function cursorIdColumn(kind: ProgressKind): string {
  return isStatus(kind) ? "item_id" : "id";
}

function toWire(row: ProgressRow): WireRow {
  const base = {
    user_id: row.owner,
    level: row.level,
    client_updated_at: row.updatedAt,
  };
  switch (row.kind) {
    case "card_status":
      return { ...base, item_id: row.id, known: row.known };
    case "grammar_learned":
      return { ...base, item_id: row.id, learned: row.learned };
    case "kanji_quiz_attempts":
      return {
        ...base,
        id: row.id,
        mode: row.mode,
        score: row.score,
        total: row.total,
        wrong_item_ids: row.wrongItemIds,
      };
    case "reading_attempts":
      return {
        ...base,
        id: row.id,
        item_id: row.passageId,
        score: row.score,
        total: row.total,
      };
    case "exam_attempts":
      return {
        ...base,
        id: row.id,
        exam_id: row.examId,
        status: row.status,
        attempt_number: row.attemptNumber,
        total_score: row.totalScore,
        total_questions: row.totalQuestions,
        sections: row.sections,
        answers: row.answers,
        started_at: row.startedAt,
        completed_at: row.completedAt,
      };
  }
}

function fromWire(kind: ProgressKind, wire: RemoteRow): ProgressRow {
  const base = {
    owner: wire.user_id,
    level: wire.level,
    updatedAt: wire.client_updated_at,
  };
  if (kind === "card_status" && "known" in wire)
    return { ...base, kind, id: wire.item_id, known: wire.known };
  if (kind === "grammar_learned" && "learned" in wire)
    return { ...base, kind, id: wire.item_id, learned: wire.learned };
  if (kind === "kanji_quiz_attempts" && "mode" in wire)
    return {
      ...base,
      kind,
      id: wire.id,
      mode: wire.mode,
      score: wire.score,
      total: wire.total,
      wrongItemIds: wire.wrong_item_ids,
    };
  if (kind === "reading_attempts" && "id" in wire && "item_id" in wire)
    return {
      ...base,
      kind,
      id: wire.id,
      passageId: wire.item_id,
      score: wire.score,
      total: wire.total,
    };
  if (kind === "exam_attempts" && "exam_id" in wire)
    return {
      ...base,
      kind,
      id: wire.id,
      examId: wire.exam_id,
      status: wire.status,
      attemptNumber: wire.attempt_number,
      totalScore: wire.total_score,
      totalQuestions: wire.total_questions,
      sections: wire.sections,
      answers: wire.answers,
      startedAt: wire.started_at,
      completedAt: wire.completed_at,
    };
  throw new Error("Unexpected progress row");
}

function filterValue(value: string) {
  return `"${value.replace(/["\\]/g, "\\$&")}"`;
}

type ExamAttemptProgressRow = Extract<ProgressRow, { kind: "exam_attempts" }>;

const MAX_CONFLICT_RETRIES = 3;

function isExamAttemptRow(row: ProgressRow): row is ExamAttemptProgressRow {
  return row.kind === "exam_attempts";
}

function isExamConflictError(
  error: { code?: string } | null | undefined,
): boolean {
  return error?.code === "23514" || error?.code === "23505";
}

function isLockedExamSectionStatus(
  status: ExamSectionAttemptSummary["status"],
): boolean {
  return (
    status === "submitted" || status === "timed_out" || status === "skipped"
  );
}

function mergeRemoteAndLocalExamAttempt(
  remote: ExamAttemptProgressRow,
  local: ExamAttemptProgressRow,
): ExamAttemptProgressRow {
  // Keep remote id, attemptNumber and locked sections so Postgres triggers never reject a regression.
  const alignedLocal: ExamAttemptProgressRow = {
    ...local,
    id: remote.id,
    attemptNumber: remote.attemptNumber,
    sections: local.sections.map((localSec) => {
      const remoteSec = remote.sections.find((s) => s.key === localSec.key);
      if (remoteSec && isLockedExamSectionStatus(remoteSec.status)) {
        return { ...remoteSec };
      }
      return localSec;
    }),
  };
  return {
    ...mergeExamAttempts(remote, alignedLocal),
    kind: "exam_attempts",
  };
}

function parseRemoteExamAttempt(
  owner: string,
  wire: RemoteRow | undefined,
): ExamAttemptProgressRow | null {
  if (!wire) return null;
  const row = fromWire("exam_attempts", wire);
  if (row.kind !== "exam_attempts" || row.owner !== owner) {
    throw new Error("Progress pull scope mismatch");
  }
  validateProgressRow(row);
  return row;
}

async function fetchExamAttemptById(
  client: SupabaseClient,
  owner: string,
  id: string,
  signal: AbortSignal,
): Promise<ExamAttemptProgressRow | null> {
  const { data, error } = await client
    .from("exam_attempts")
    .select(
      `user_id,level,client_updated_at,server_updated_at,${columns.exam_attempts}`,
    )
    .eq("user_id", owner)
    .eq("id", id)
    .limit(1)
    .abortSignal(signal)
    .returns<RemoteRow[]>();
  if (error) throw error;
  return parseRemoteExamAttempt(owner, data[0]);
}

async function fetchInProgressExamAttempt(
  client: SupabaseClient,
  owner: string,
  level: Level,
  examId: string,
  signal: AbortSignal,
): Promise<ExamAttemptProgressRow | null> {
  const { data, error } = await client
    .from("exam_attempts")
    .select(
      `user_id,level,client_updated_at,server_updated_at,${columns.exam_attempts}`,
    )
    .eq("user_id", owner)
    .eq("level", level)
    .eq("exam_id", examId)
    .eq("status", "in_progress")
    .limit(1)
    .abortSignal(signal)
    .returns<RemoteRow[]>();
  if (error) throw error;
  return parseRemoteExamAttempt(owner, data[0]);
}

async function resolveExamAttemptConflict(
  client: SupabaseClient,
  owner: string,
  localRow: ExamAttemptProgressRow,
  initialError: PostgrestError,
  signal: AbortSignal,
): Promise<void> {
  let targetId = localRow.id;
  let lastError = initialError;

  for (let attempt = 0; attempt < MAX_CONFLICT_RETRIES; attempt++) {
    throwIfAborted(signal);
    let remote = await fetchExamAttemptById(client, owner, targetId, signal);
    if (!remote && lastError.code === "23505") {
      remote = await fetchInProgressExamAttempt(
        client,
        owner,
        localRow.level,
        localRow.examId,
        signal,
      );
      if (remote) {
        targetId = remote.id;
      } else {
        const { error: retryError } = await client
          .from("exam_attempts")
          .upsert([toWire(localRow)], {
            onConflict: "id",
            ignoreDuplicates: false,
          })
          .abortSignal(signal);
        if (!retryError) return;
        if (!isExamConflictError(retryError)) throw retryError;
        lastError = retryError;
        continue;
      }
    }
    if (!remote) {
      throw lastError;
    }
    if (remote.status === "completed") {
      return;
    }

    const merged = mergeRemoteAndLocalExamAttempt(remote, localRow);
    const { error: updateError } = await client
      .from("exam_attempts")
      .update(toWire(merged))
      .eq("user_id", owner)
      .eq("id", remote.id)
      .abortSignal(signal);
    if (!updateError) return;
    if (!isExamConflictError(updateError)) throw updateError;
    lastError = updateError;
  }

  throw lastError;
}

export function createSupabaseProgressRemote(
  client: SupabaseClient,
): ProgressRemote {
  return {
    async push(owner, entries, signal) {
      if (
        entries.some(
          (entry) => entry.owner !== owner || entry.row.owner !== owner,
        )
      ) {
        throw new Error("Progress push scope mismatch");
      }
      for (const kind of PROGRESS_KINDS) {
        const status = isStatus(kind);
        const isExamAttempt = kind === "exam_attempts";
        const batch = new Map<string, ProgressRow>();
        for (const { row } of entries) {
          if (row.kind !== kind) continue;
          const key = status ? `${row.level}:${row.id}` : row.id;
          const previous = batch.get(key);
          if (!previous) {
            batch.set(key, row);
          } else if (
            status &&
            timestampKey(row.updatedAt) > timestampKey(previous.updatedAt)
          ) {
            batch.set(key, row);
          } else if (
            previous.kind === "exam_attempts" &&
            row.kind === "exam_attempts"
          ) {
            batch.set(key, {
              ...mergeExamAttempts(previous, row),
              kind: "exam_attempts",
            });
          }
        }
        if (!batch.size) continue;
        throwIfAborted(signal);
        const { error } = await client
          .from(kind)
          .upsert([...batch.values()].map(toWire), {
            onConflict: status ? "user_id,level,item_id" : "id",
            ignoreDuplicates: !status && !isExamAttempt,
          })
          .abortSignal(signal);
        if (error) {
          if (!isExamAttempt || !isExamConflictError(error)) {
            throw error;
          }
          const examRows = [...batch.values()].filter(isExamAttemptRow);
          if (examRows.length === 1) {
            await resolveExamAttemptConflict(
              client,
              owner,
              examRows[0],
              error,
              signal,
            );
          } else {
            for (const examRow of examRows) {
              throwIfAborted(signal);
              const { error: singleError } = await client
                .from("exam_attempts")
                .upsert([toWire(examRow)], {
                  onConflict: "id",
                  ignoreDuplicates: false,
                })
                .abortSignal(signal);
              if (!singleError) continue;
              if (!isExamConflictError(singleError)) throw singleError;
              await resolveExamAttemptConflict(
                client,
                owner,
                examRow,
                singleError,
                signal,
              );
            }
          }
        }
      }
    },

    async pull(owner, kind, after, limit, signal) {
      const idColumn = cursorIdColumn(kind);
      const query = client
        .from(kind)
        .select(
          `user_id,level,client_updated_at,server_updated_at,${columns[kind]}`,
        )
        .eq("user_id", owner)
        .order("server_updated_at", { ascending: true })
        .order(idColumn, { ascending: true })
        .limit(limit)
        .abortSignal(signal);
      if (after) {
        const time = filterValue(after.serverUpdatedAt);
        const id = filterValue(after.id);
        query.or(
          `server_updated_at.gt.${time},and(server_updated_at.eq.${time},${idColumn}.gt.${id})`,
        );
      }
      const { data, error } = await query.returns<RemoteRow[]>();
      if (error) throw error;
      return data.map((wire) => {
        const row = fromWire(kind, wire);
        if (row.owner !== owner)
          throw new Error("Progress pull scope mismatch");
        validateProgressRow(row);
        timestampKey(wire.server_updated_at);
        return {
          row,
          cursor: { serverUpdatedAt: wire.server_updated_at, id: row.id },
        };
      });
    },
  };
}
