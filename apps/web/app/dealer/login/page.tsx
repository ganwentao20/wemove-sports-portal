import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dealer Sign in' };

/** 经销商登录（同一 User 体系 /api/v1/auth/login；企业边界由服务端 companyId 判定） */
export default function DealerLoginPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-bold">Dealer Portal</h1>
      <p className="mt-1 text-sm text-neutral-500">For approved wholesale partners only.</p>
      <form className="mt-8 space-y-4">
        <input type="email" required placeholder="Business email" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]" />
        <input type="password" required placeholder="Password" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]" />
        <button className="w-full rounded-full bg-[var(--wm-dark)] py-3 text-sm font-semibold text-white hover:opacity-90">
          Sign in
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-neutral-500">
        Not a dealer yet?{' '}
        <a href="/dealer/apply" className="text-[var(--wm-primary)]">Apply here</a>
      </p>
    </div>
  );
}
