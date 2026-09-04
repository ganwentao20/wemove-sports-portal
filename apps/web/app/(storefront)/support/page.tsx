import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Support & Downloads' };

/** 公开支持与下载中心：说明书/证书等 PUBLIC 媒体（media API，MD）；私有资料走 dealer 签名下载 */
export default function SupportPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Support &amp; Downloads</h1>
      <p className="mt-2 max-w-2xl text-neutral-600">
        Manuals, certificates and FAQs. Dealers can access restricted documents after sign-in.
      </p>
      <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">
        Downloads &amp; FAQ placeholder (member D / member A)
      </div>
    </div>
  );
}
