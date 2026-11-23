import { db } from "@/adapters/local-store/db";
import { isOwnerRetired } from "@/adapters/local-store/retirement";
import { throwIfAborted } from "@/core/abort";
import { LEVELS, type Level } from "@/core/content/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Preference = { level: Level; pending: boolean };
type LevelProfile = {
  read(signal: AbortSignal): Promise<unknown>;
  write(level: Level, signal: AbortSignal): Promise<void>;
};

const preferenceKey = (owner?: string) => (owner ? `level:${owner}` : "level");
const isLevel = (value: unknown): value is Level =>
  LEVELS.some((level) => level === value);

export async function readLevelPreference(
  owner?: string,
): Promise<Preference | undefined> {
  const value = (await db.settings.get(preferenceKey(owner)))?.value;
  if (!owner)
    return isLevel(value) ? { level: value, pending: false } : undefined;
  if (
    value &&
    typeof value === "object" &&
    "level" in value &&
    isLevel(value.level) &&
    "pending" in value &&
    typeof value.pending === "boolean"
  )
    return { level: value.level, pending: value.pending };
}

export function saveLevelPreference(owner: string | undefined, level: Level) {
  return db.transaction("rw", db.settings, async () => {
    if (owner && (await isOwnerRetired(owner)))
      throw new Error("Owner is retired");
    await db.settings.put({
      key: preferenceKey(owner),
      value: owner ? { level, pending: true } : level,
    });
  });
}

export async function syncLevelPreference(
  owner: string,
  profile: LevelProfile,
  signal: AbortSignal,
) {
  async function sync() {
    throwIfAborted(signal);
    const snapshot = await db.transaction("r", db.settings, async () => {
      if (await isOwnerRetired(owner)) return null;
      return { preference: await readLevelPreference(owner) };
    });
    if (!snapshot) return false;
    const { preference } = snapshot;
    throwIfAborted(signal);
    let level: unknown;
    if (preference?.pending) {
      level = preference.level;
      await profile.write(preference.level, signal);
    } else {
      level = await profile.read(signal);
    }
    if (!isLevel(level)) throw new Error("Invalid profile level");
    const confirmedLevel = level;
    return db.transaction("rw", db.settings, async () => {
      if (await isOwnerRetired(owner)) return false;
      const current = await readLevelPreference(owner);
      throwIfAborted(signal);
      if (
        current?.level !== preference?.level ||
        current?.pending !== preference?.pending
      )
        return false;
      if (current?.pending || current?.level !== confirmedLevel) {
        await db.settings.put({
          key: preferenceKey(owner),
          value: { level: confirmedLevel, pending: false },
        });
      }
      return true;
    });
  }

  const locks = globalThis.navigator?.locks;
  return locks
    ? locks.request(`jlpt:${preferenceKey(owner)}`, { signal }, sync)
    : sync();
}

export function createLevelProfile(
  client: SupabaseClient,
  owner: string,
): LevelProfile {
  return {
    async read(signal) {
      const { data, error } = await client
        .from("profiles")
        .select("current_level")
        .eq("user_id", owner)
        .abortSignal(signal)
        .single();
      if (error) throw error;
      return data.current_level;
    },
    async write(level, signal) {
      const { error } = await client
        .from("profiles")
        .update({ current_level: level })
        .eq("user_id", owner)
        .select("current_level")
        .abortSignal(signal)
        .single();
      if (error) throw error;
    },
  };
}
