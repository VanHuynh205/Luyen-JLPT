import { GUEST_OWNER } from "../../core/progress";
import { db } from "./db";

export const ownerRetirementKey = (owner: string) => `retired:${owner}`;

export async function isOwnerRetired(owner: string): Promise<boolean> {
  if (!owner || owner === GUEST_OWNER) return false;
  return (await db.settings.get(ownerRetirementKey(owner)))?.value === true;
}
