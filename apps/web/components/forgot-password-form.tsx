'use client';

import { FormEvent, useState } from 'react';
import { apiFetch } from '../lib/api';

type FormStatus = 'idle' | 'success' | 'info';

export function ForgotPasswordForm() {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus('idle');
    setMessage('');
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();

    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setStatus('success');
      setMessage('如果该邮箱已注册，系统会发送重置密码邮件。');
    } catch {
      setStatus('info');
      setMessage('后端未启动时显示演示提示：如果该邮箱已注册，系统会发送重置密码邮件。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="customer-form" onSubmit={submit}>
      <label>注册邮箱<input name="email" type="email" required placeholder="name@example.com" /></label>
      <button type="submit" disabled={loading}>{loading ? '提交中...' : '发送重置邮件'}</button>
      {message ? <p className={`form-message ${status}`} role="status" aria-live="polite">{message}</p> : null}
      <p className="hint">接口依据组长 API：POST /api/v1/auth/forgot-password，防枚举统一返回提示。</p>
    </form>
  );
}
