export function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
  }
}

export async function withAbortDeadline<Value>(
  parent: AbortSignal,
  milliseconds: number,
  operation: (signal: AbortSignal) => Promise<Value>,
): Promise<Value> {
  throwIfAborted(parent);
  const controller = new AbortController();
  const abort = () => controller.abort(parent.reason);
  parent.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    controller.abort(new DOMException("Timed out", "TimeoutError"));
  }, milliseconds);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timer);
    parent.removeEventListener("abort", abort);
  }
}
