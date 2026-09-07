import { BadRequestException } from '@nestjs/common';
import { LANGUAGE_CODE } from './locale-policy.js';
import { validateNavigation } from './navigation-policy.js';
const fail = (message: string): never => {
  throw new BadRequestException(message);
};
export function validateSetting(key: string, value: Record<string, unknown>) {
  if (key === 'navigation') validateNavigation(value.items);
  const safeUrl = (v: unknown) =>
    typeof v === 'string' &&
    (v === '' ||
      /^\/(?!\/)[^\s\\]*$/.test(v) ||
      /^https:\/\/[^\s\\]+$/.test(v));
  if (key === 'brand') {
    for (const field of ['name', 'contactEmail', 'contactPhone', 'address'])
      if (
        value[field] !== undefined &&
        (typeof value[field] !== 'string' || String(value[field]).length > 500)
      )
        fail(`Invalid ${field}`);
    for (const field of ['logo', 'favicon'])
      if (value[field] !== undefined && !safeUrl(value[field]))
        fail(`Invalid ${field} URL`);
    if (
      value.socials !== undefined &&
      (!Array.isArray(value.socials) ||
        value.socials.length > 20 ||
        value.socials.some(
          (item) =>
            !item ||
            typeof item.label !== 'string' ||
            item.label.length > 80 ||
            !/^https:\/\/[^\s\\]+$/.test(item.href),
        ))
    )
      fail('Social links need labels and HTTPS URLs');
    if (value.primaryColor !== undefined) {
      const color = String(value.primaryColor);
      if (!/^#[\da-f]{6}$/i.test(color))
        fail('Use a six digit hex brand color');
      const rgb = [1, 3, 5]
        .map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      if ((0.92 + 0.05) / (luminance + 0.05) < 4.5)
        fail('Choose a darker brand color with at least 4.5:1 text contrast');
    }
  }
  if (key === 'notifications')
    for (const group of ['dealer', 'support', 'orders'])
      if (
        value[group] !== undefined &&
        (!Array.isArray(value[group]) ||
          (value[group] as unknown[]).length > 30 ||
          (value[group] as unknown[]).some(
            (email) =>
              typeof email !== 'string' ||
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
          ))
      )
        fail(`Invalid ${group} recipients`);
  if (key === 'tracking') {
    if (typeof value.enabled !== 'boolean')
      fail('Tracking enabled must be a boolean');
    if (
      value.retentionDays !== undefined &&
      (!Number.isInteger(value.retentionDays) ||
        Number(value.retentionDays) < 1 ||
        Number(value.retentionDays) > 365)
    )
      fail('Analytics retention must be 1–365 days');
  }
  if (key === 'locale') {
    if (
      !Array.isArray(value.languages) ||
      !value.languages.includes('en') ||
      value.languages.length > 30 ||
      new Set(value.languages).size !== value.languages.length ||
      value.languages.some(
        (v) => typeof v !== 'string' || !LANGUAGE_CODE.test(v),
      ) ||
      value.defaultLanguage !== 'en' ||
      !['DEFAULT', 'HIDE'].includes(String(value.fallback))
    )
      fail(
        'Use unique language codes such as en, zh, fr or pt-BR (maximum 30), retain English as default and choose complete English fallback or hide incomplete translations',
      );
  }
  if (key === 'search') {
    if (
      !value.synonyms ||
      typeof value.synonyms !== 'object' ||
      Array.isArray(value.synonyms) ||
      Object.keys(value.synonyms).length > 200
    )
      fail('At most 200 synonym groups are supported');
    for (const [term, alternatives] of Object.entries(
      value.synonyms as Record<string, unknown>,
    ))
      if (
        !term.trim() ||
        term.length > 100 ||
        !Array.isArray(alternatives) ||
        alternatives.length > 20 ||
        alternatives.some((v) => typeof v !== 'string' || v.length > 100)
      )
        fail('Invalid synonym group');
  }
}
