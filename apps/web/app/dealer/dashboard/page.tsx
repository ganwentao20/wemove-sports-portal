import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dealer Dashboard', robots: { index: false, follow: false } };

/** 经销商工作台（MB）：专属授权价/库存/交期、Quick Order、RFQ、PO 管理、私有资料下载 */
export default function DealerDashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Dealer Dashboard</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Auth-gated. Company data boundary applies — you only see your company&apos;s catalog &amp; prices.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {['Quick Order', 'RFQ & Quotes', 'Purchase Orders', 'Tiered Prices', 'Downloads', 'Company'].map((item) => (
          <div key={item} className="rounded-2xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-400">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
