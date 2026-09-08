import { randomUUID } from 'node:crypto';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaClient } from '@prisma/client';
/** Authenticated fixture sessions are persisted exactly like login sessions. Actual login is tested separately. */
export async function authenticatedFixture(
  prisma: PrismaClient,
  jwt: JwtService,
  account: { id: string; email: string; name: string; authVersion?: number },
  kind: 'customer' | 'staff',
  mfaVerified = kind === 'staff',
) {
  const id = randomUUID();
  await prisma.authenticationSession.create({
    data: {
      id,
      ownerId: account.id,
      ownerKind: kind,
      authVersion: account.authVersion ?? 0,
      mfaVerified,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  return jwt.signAsync(
    {
      sub: account.id,
      email: account.email,
      name: account.name,
      kind,
      jti: id,
      authVersion: account.authVersion ?? 0,
    },
    { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '1h' },
  );
}
