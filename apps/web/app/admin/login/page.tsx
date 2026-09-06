'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

/** 后台员工登录（POST /api/v1/auth/staff/login）—— 与 C 端账号体系物理隔离 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/v1/auth/staff/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password'),
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.code !== 0 || !body.data?.accessToken) {
      setError(body?.message ?? 'Sign in failed');
      return;
    }
    window.localStorage.setItem('wemove_admin_token', body.data.accessToken);
    router.push('/admin/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--wm-dark)] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8">
        <h1 className="text-2xl font-bold">WEMOVE Admin</h1>
        <p className="mt-1 text-sm text-neutral-500">Operations console — authorized staff only.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <input name="email" type="email" required placeholder="Staff email" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]" />
          <input name="password" type="password" required placeholder="Password" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]" />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button className="w-full rounded-full bg-[var(--wm-primary)] py-3 text-sm font-semibold text-white hover:opacity-90">
            Sign in
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-neutral-400">RBAC enforcement lives server-side (API guards)</p>
      </div>
    </div>
  );
}
