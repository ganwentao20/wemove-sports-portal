import { createHash, randomUUID } from 'node:crypto';

/** 密码自适应哈希：bcrypt cost=12（安全底线，见 README 安全红线） */
export async function hashPassword(plain: string): Promise<string> {
  const { hash } = await import('bcryptjs');
  return hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const { compare } = await import('bcryptjs');
  return compare(plain, hash);
}

/** 邮箱等唯一标识的归一化 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** 一次性令牌（邮箱验证/找回密码/二次认证）：库中只存哈希 */
export function newOpaqueToken(): { token: string; tokenHash: string } {
  const token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  return { token, tokenHash: sha256(token) };
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
