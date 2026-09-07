import { BadRequestException } from '@nestjs/common';
export const DIRECTORY_FIELDS = [
  'displayName',
  'businessType',
  'website',
  'city',
  'publicAddress',
  'publicPhone',
  'publicLogo',
  'publicHours',
  'publicRegion',
  'publicPostalCode',
  'publicDescription',
  'publicListing',
  'publicDetail',
  'onlineStore',
  'physicalStore',
  'latitude',
  'longitude',
] as const;
const lengths: Record<string, number> = {
  displayName: 160,
  businessType: 80,
  website: 2048,
  city: 100,
  publicAddress: 500,
  publicPhone: 50,
  publicLogo: 2048,
  publicHours: 1000,
  publicRegion: 100,
  publicPostalCode: 30,
  publicDescription: 3000,
};
export function directorySnapshot(
  profile: Record<string, unknown>,
  companyName: string,
  country: string,
) {
  const value: Record<string, unknown> = { companyName, country };
  for (const key of DIRECTORY_FIELDS) {
    const item = profile[key];
    if (item === undefined) continue;
    if (key in lengths) {
      if (typeof item !== 'string' || item.length > lengths[key])
        throw new BadRequestException(`Invalid public directory ${key}`);
      value[key] = item.trim();
    } else if (['latitude', 'longitude'].includes(key)) {
      if (item === null || item === '') {
        value[key] = null;
        continue;
      }
      const limit = key === 'latitude' ? 90 : 180;
      if (
        typeof item !== 'number' ||
        !Number.isFinite(item) ||
        Math.abs(item) > limit
      )
        throw new BadRequestException(`Invalid directory ${key}`);
      value[key] = item;
    } else {
      if (typeof item !== 'boolean')
        throw new BadRequestException(`Invalid directory ${key}`);
      value[key] = item;
    }
  }
  for (const key of ['website', 'publicLogo']) {
    const raw = value[key];
    if (!raw) continue;
    const text = String(raw);
    if (
      /[\\\s]/.test(text) ||
      [...text].some((char) => char.charCodeAt(0) < 32)
    )
      throw new BadRequestException('Public directory links must be safe URLs');
    let url: URL;
    try {
      const decoded = decodeURIComponent(text);
      if (
        decoded.startsWith('//') ||
        decoded.includes('\\') ||
        [...decoded].some(
          (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
        )
      )
        throw new Error();
      url = new URL(text, 'https://local.invalid');
    } catch {
      throw new BadRequestException('Invalid public directory URL');
    }
    if (
      (key === 'website' && !text.startsWith('https://')) ||
      (key === 'publicLogo' &&
        !text.startsWith('https://') &&
        !/^\/(?!\/)/.test(text)) ||
      url.username ||
      url.password
    )
      throw new BadRequestException(
        'Use an HTTPS website and HTTPS or local logo URL',
      );
  }
  return value;
}
export function publicDirectoryRow(
  company: {
    id: string;
    companyName: string;
    country: string;
    profile: unknown;
    catalogPolicy: unknown;
  },
  categories: Array<{ id: string; name: string }>,
) {
  const profile = company.profile as Record<string, unknown>,
    p = profile.directoryPublished as Record<string, unknown> | undefined;
  if (!p || p.publicListing !== true) return null;
  const text = (key: string) =>
    typeof p[key] === 'string' ? String(p[key]) : '';
  return {
    id: company.id,
    companyName:
      text('displayName') || text('companyName') || company.companyName,
    country: text('country') || company.country,
    city: text('city'),
    region: text('publicRegion'),
    postalCode: text('publicPostalCode'),
    address: text('publicAddress'),
    website: text('website') || null,
    logo: text('publicLogo') || null,
    phone: text('publicPhone'),
    dealerType: text('businessType'),
    openingHours: text('publicHours'),
    description: text('publicDescription'),
    online: p.onlineStore === true,
    physical: p.physicalStore === true,
    latitude: typeof p.latitude === 'number' ? p.latitude : null,
    longitude: typeof p.longitude === 'number' ? p.longitude : null,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
    })),
    detailPath: p.publicDetail === true ? `/dealers/${company.id}` : null,
  };
}
