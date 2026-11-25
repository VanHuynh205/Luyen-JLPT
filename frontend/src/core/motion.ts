export type MotionPreference = "auto" | "full" | "reduced";
export type MotionMode = "full" | "reduced" | "static";

export interface MotionModeInput {
  preference: MotionPreference;
  osReduced: boolean;
  webglSupported: boolean | null;
  lowPerf: boolean;
}

export function isMotionPreference(value: unknown): value is MotionPreference {
  return value === "auto" || value === "full" || value === "reduced";
}

export function parseMotionPreference(value: unknown): MotionPreference {
  return isMotionPreference(value) ? value : "auto";
}

export function resolveMotionMode({
  preference,
  osReduced,
  webglSupported,
  lowPerf,
}: MotionModeInput): MotionMode {
  if (osReduced || preference === "reduced") return "reduced";
  if (webglSupported === false || lowPerf) return "static";
  return "full";
}
