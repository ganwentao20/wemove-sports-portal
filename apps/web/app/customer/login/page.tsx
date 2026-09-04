import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in' };

/** B2C 登录（POST /api/v1/auth/login，JWT 存 httpOnly cookie 方案待组长接入） */
export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-neutral-500">Sign in to track orders and manage your list.</p>
      <form className="mt-8 space-y-4">
        <input type="email" required placeholder="Email" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]" />
        <input type="password" required placeholder="Password" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]" />
        <button className="w-full rounded-full bg-[var(--wm-dark)] py-3 text-sm font-semibold text-white hover:opacity-90">
          Sign in
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-neutral-500">
        New here?{' '}
        <a href="/customer/register" className="text-[var(--wm-primary)]">Create account</a>
      </p>
      {/* 邮箱验证/找回密码（MA）；成年人才可注册（合规红线） */}
    </div>
  );
}
