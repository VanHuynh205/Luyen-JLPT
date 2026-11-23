import { expect, it, vi } from "vitest";
import { throwIfAborted, withAbortDeadline } from "./abort";

it("supports abort signals that do not expose throwIfAborted or reason", () => {
  expect(() => throwIfAborted({ aborted: true } as AbortSignal)).toThrow(
    expect.objectContaining({ name: "AbortError" }),
  );
});

it("forwards parent cancellation and clears the deadline", async () => {
  vi.useFakeTimers();
  try {
    const parent = new AbortController();
    const result = withAbortDeadline(
      parent.signal,
      50,
      (signal) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () => resolve(signal.reason));
        }),
    );
    parent.abort(new Error("offline"));
    await expect(result).resolves.toMatchObject({ message: "offline" });
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

it("aborts a request at the deadline without requiring AbortSignal.timeout", async () => {
  vi.useFakeTimers();
  try {
    const result = withAbortDeadline(
      new AbortController().signal,
      50,
      (signal) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () => resolve(signal.reason));
        }),
    );
    await vi.advanceTimersByTimeAsync(50);
    await expect(result).resolves.toMatchObject({ name: "TimeoutError" });
  } finally {
    vi.useRealTimers();
  }
});
