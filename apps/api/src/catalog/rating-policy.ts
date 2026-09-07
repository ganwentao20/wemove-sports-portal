import { BizException, ERROR_CODES } from '../common/errors.js';
export type ProductRating = {
  enabled: boolean;
  average: number;
  count: number;
  source: string;
};
export function ratingSettings(value: unknown): ProductRating {
  const fail = (): never => {
    throw new BizException(
      ERROR_CODES.VALIDATION,
      'Reviews require an explicit switch, a 0–5 average, an integer count, and a source; enabled ratings require at least one authentic review and a 1–5 average',
      422,
    );
  };
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail();
  const row = value as Record<string, unknown>;
  if (
    typeof row.enabled !== 'boolean' ||
    typeof row.average !== 'number' ||
    !Number.isFinite(row.average) ||
    row.average < 0 ||
    row.average > 5 ||
    Math.abs(row.average * 100 - Math.round(row.average * 100)) > 0.000001 ||
    typeof row.count !== 'number' ||
    !Number.isInteger(row.count) ||
    row.count < 0 ||
    row.count > 2147483647 ||
    typeof row.source !== 'string' ||
    row.source.length > 300
  )
    return fail();
  if (
    row.enabled &&
    (row.average < 1 || row.count < 1 || row.source.trim().length < 3)
  )
    return fail();
  return {
    enabled: row.enabled,
    average: row.average,
    count: row.count,
    source: row.source.trim(),
  };
}
export function publishedRating(specifications: unknown) {
  if (
    !specifications ||
    typeof specifications !== 'object' ||
    Array.isArray(specifications)
  )
    return null;
  try {
    const rating = ratingSettings(
      (specifications as Record<string, unknown>).reviews,
    );
    return rating.enabled
      ? { average: rating.average, count: rating.count, source: rating.source }
      : null;
  } catch {
    return null;
  }
}
