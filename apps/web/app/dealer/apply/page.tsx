import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dealer Application' };

/** 经销商资质在线申请（MB）：分步表单 + 资质上传 + 防刷；后台审核流见 b2b 状态机规范 */
export default function DealerApplyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Become a WEMOVE Dealer</h1>
      <p className="mt-2 text-neutral-600">
        Wholesale pricing, bulk ordering (Quick Order) and dedicated support for verified businesses.
      </p>
      <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">
        Multi-step application form placeholder (member B) — business license upload, company info, contact
      </div>
    </div>
  );
}
