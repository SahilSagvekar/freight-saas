import bcrypt from "bcryptjs";

const COST = 10;

export const MIN_PASSWORD_LENGTH = 10;

/** Why a new password is not acceptable, or null when it is fine. bcrypt only reads the first 72 bytes. */
export function passwordProblem(plain: string): string | null {
  if (plain.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (Buffer.byteLength(plain) > 72) return "Use 72 characters or fewer.";
  if (/^(.)\1+$/u.test(plain)) return "Choose something other than one repeated character.";
  return null;
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

let dummyHash: Promise<string> | undefined;

/**
 * Spends the same time as a real password check. Used when the email is unknown so that login
 * timing does not reveal which accounts exist.
 */
export async function burnPasswordCheck(plain: string): Promise<void> {
  dummyHash ??= bcrypt.hash("not-a-real-password", COST);
  await bcrypt.compare(plain, await dummyHash);
}
