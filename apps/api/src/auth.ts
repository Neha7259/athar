import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export type UserRole = 'owner' | 'admin' | 'data_provider' | 'validator' | 'verifier_readonly';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  orgId: string;
}

export interface StoredUser extends AuthUser {
  passwordHash: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [salt, key] = encodedHash.split(':');
  if (!salt || !key) return false;

  const expected = Buffer.from(key, 'hex');
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
