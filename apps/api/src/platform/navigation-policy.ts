import { BadRequestException } from '@nestjs/common';
import { LANGUAGE_CODE } from './locale-policy.js';
export function validateNavigation(items: unknown, level = 0) {
  if (!Array.isArray(items) || items.length > (level ? 15 : 30))
    throw new BadRequestException(
      'Navigation supports at most 30 primary and 15 secondary links',
    );
  for (const item of items) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.label !== 'string' ||
      !item.label.trim() ||
      item.label.length > 100 ||
      typeof item.href !== 'string' ||
      !/^\/(?!\/)[^\s\\]*$/.test(item.href) ||
      item.href.length > 500
    )
      throw new BadRequestException('Navigation needs a label and a local URL');
    if (
      item.markets !== undefined &&
      (!Array.isArray(item.markets) ||
        item.markets.length > 200 ||
        item.markets.some(
          (market: unknown) =>
            typeof market !== 'string' || !/^[A-Z]{2}$/.test(market),
        ))
    )
      throw new BadRequestException(
        'Navigation markets must be two-letter country codes',
      );
    if (
      item.labels !== undefined &&
      (!item.labels ||
        typeof item.labels !== 'object' ||
        Array.isArray(item.labels) ||
        Object.entries(item.labels).some(
          ([locale, label]) =>
            !LANGUAGE_CODE.test(locale) ||
            typeof label !== 'string' ||
            label.length > 100,
        ))
    )
      throw new BadRequestException('Invalid navigation translation');
    if (item.children !== undefined) {
      if (level)
        throw new BadRequestException(
          'Only two navigation levels are supported',
        );
      validateNavigation(item.children, 1);
    }
  }
}
