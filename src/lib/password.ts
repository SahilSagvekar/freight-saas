import bcrypt from "bcryptjs";

const COST = 10;

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
