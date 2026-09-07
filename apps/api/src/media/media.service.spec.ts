import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaService } from './media.service.js';
describe('media security', () => {
  afterEach(() => vi.unstubAllEnvs());
  const service = () => new MediaService({} as never, {} as never);
  it('rejects renamed payloads and computes a stable SHA-256 for genuine PDF signatures', async () => {
    vi.stubEnv('MEDIA_SCAN_URL', '');
    vi.stubEnv('MEDIA_SCAN_REQUIRED', 'false');
    await expect(
      service().inspectFile({
        buffer: Buffer.from('malicious.exe'),
        originalname: 'invoice.pdf',
        mimetype: 'application/pdf',
        size: 13,
      }),
    ).rejects.toMatchObject({ status: 422 });
    const buffer = Buffer.from('%PDF-1.7\n%%EOF');
    const file = {
      buffer,
      originalname: 'one.pdf',
      mimetype: 'application/pdf',
      size: buffer.length,
    };
    const first = await service().inspectFile(file);
    expect(first.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toEqual(
      await service().inspectFile({ ...file, originalname: 'renamed.pdf' }),
    );
  });
  it('validates MP4 and WebM container signatures and applies the same malware rejection', async () => {
    vi.stubEnv('MEDIA_SCAN_URL', '');
    vi.stubEnv('MEDIA_SCAN_REQUIRED', 'false');
    const mp4 = Buffer.concat([
      Buffer.from([0, 0, 0, 24]),
      Buffer.from('ftypisom'),
      Buffer.alloc(12),
    ]);
    const webm = Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x87, 0x42, 0x82, 0x84]),
      Buffer.from('webm'),
    ]);
    for (const [mimetype, buffer] of [
      ['video/mp4', mp4],
      ['video/webm', webm],
    ] as const) {
      await expect(
        service().inspectFile({
          buffer,
          size: buffer.length,
          originalname: 'video',
          mimetype,
        }),
      ).resolves.toMatchObject({ scanStatus: 'SIGNATURE_CHECKED' });
      const unsafe = Buffer.concat([
        buffer,
        Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'),
      ]);
      await expect(
        service().inspectFile({
          buffer: unsafe,
          size: unsafe.length,
          originalname: 'video',
          mimetype,
        }),
      ).rejects.toMatchObject({ status: 422 });
    }
    const renamed = Buffer.from('%PDF-1.7\n%%EOF');
    await expect(
      service().inspectFile({
        buffer: renamed,
        size: renamed.length,
        originalname: 'fake.mp4',
        mimetype: 'video/mp4',
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it('fails closed when malware scanning is required but unavailable', async () => {
    vi.stubEnv('MEDIA_SCAN_URL', '');
    vi.stubEnv('MEDIA_SCAN_REQUIRED', 'true');
    const buffer = Buffer.from('%PDF-1.7\n%%EOF');
    await expect(
      service().inspectFile({
        buffer,
        originalname: 'invoice.pdf',
        mimetype: 'application/pdf',
        size: buffer.length,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });
  it('never grants qualification files to another approved dealer', async () => {
    const media = {
      id: 'private-qualification',
      visibility: 'DEALER_ONLY',
      qualification: true,
    };
    const s = new MediaService(
      {
        mediaAsset: { findUnique: vi.fn().mockResolvedValue(media) },
        user: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE' }) },
      } as never,
      {} as never,
    );
    await expect(
      s.signFor(media.id, {
        sub: 'user-a',
        kind: 'customer',
        companyId: 'company-a',
        email: 'a@example.test',
        name: 'A',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
