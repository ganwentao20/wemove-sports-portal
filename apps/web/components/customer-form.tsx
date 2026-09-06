'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginCustomer, registerCustomer } from '../lib/storefront-api';
import { writeCustomer } from '../lib/customer-store';

export function CustomerForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const name = String(form.get('name') || email.split('@')[0]);

    if (register && !form.get('adult')) {
      setMessage('请确认您已满 18 周岁。');
      return;
    }

    setLoading(true);
    try {
      if (register) {
        await registerCustomer({ name, email, password, ageConfirmed: true });
        setMessage('注册请求已提交，接口开启邮箱验证时请按邮件完成验证。');
      } else {
        await loginCustomer({ email, password });
      }
      router.push('/customer/account');
    } catch {
      writeCustomer({ name, email });
      setMessage('后端接口未启动或账号暂不可用，已进入前端演示登录状态。接口启动后会自动走真实 /auth 接口。');
      window.setTimeout(() => router.push('/customer/account'), 700);
    } finally {
      setLoading(false);
    }
  }

  return <form className="customer-form" onSubmit={submit}>
    {register && <label>姓名<input name="name" required /></label>}
    <label>邮箱<input name="email" type="email" required placeholder="name@example.com" /></label>
    <label>密码<input name="password" type="password" minLength={8} required placeholder="至少 8 位，包含字母和数字" /></label>
    {register && <label className="check"><input name="adult" type="checkbox" />我确认已满 18 周岁，并同意服务条款与隐私政策。</label>}
    <button type="submit" disabled={loading}>{loading ? '提交中...' : register ? '创建账户' : '登录'}</button>
    {message && <p className="form-message">{message}</p>}
    <p className="hint">{register ? '已按组长接口 POST /api/v1/auth/register 预接线。' : '已按组长接口 POST /api/v1/auth/login 预接线。'}</p>
  </form>;
}
