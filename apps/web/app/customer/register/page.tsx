import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create account' };

/** B2C 注册（POST /api/v1/auth/register）：必须勾选 18+ 声明 —— 合规红线（面向成年人） */
export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-bold">Create account</h1>
      <p className="mt-1 text-sm text-neutral-500">For personal shopping and order tracking.</p>
      <form className="mt-8 space-y-4">
        <input required placeholder="Full name" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]" />
        <input type="email" required placeholder="Email" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]" />
        <input type="password" required placeholder="Password (8+ chars, letters &amp; numbers)" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]" />
        <label className="flex items-start gap-2 text-sm text-neutral-600">
          <input type="checkbox" required className="mt-1" />
          <span>I confirm I am 18 or older and agree to the Terms &amp; Privacy Policy.</span>
        </label>
        <button className="w-full rounded-full bg-[var(--wm-dark)] py-3 text-sm font-semibold text-white hover:opacity-90">
          Create account
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-neutral-500">
        WEMOVE toys are for kids — accounts are for adults only.
      </p>
    </div>
  );
}
