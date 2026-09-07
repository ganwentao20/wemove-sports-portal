import { LANGUAGE_PREFIX } from './locale-policy.js';
import { BadRequestException } from '@nestjs/common';
export function localRedirectPath(value: string) {
  if (!value.startsWith('/') || /[\\\s]/.test(value))
    throw new BadRequestException('Redirects must use local paths');
  let decoded = value;
  try {
    for (let i = 0; i < 2; i++) decoded = decodeURIComponent(decoded);
  } catch {
    throw new BadRequestException('Invalid path encoding');
  }
  if (
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    Array.from(decoded).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new BadRequestException('Invalid local path');
  const parsed = new URL(value, 'https://local.invalid');
  if (parsed.origin !== 'https://local.invalid')
    throw new BadRequestException('Redirects must remain on this site');
  return decoded.split(/[?#]/)[0].replace(LANGUAGE_PREFIX, '') || '/';
}
