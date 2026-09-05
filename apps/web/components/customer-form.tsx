'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function CustomerForm({ register = false }: { register?: boolean }) {
  const router = useRouter(); const [message, setMessage] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (register && !form.get('adult')) { setMessage('请确认您已满 18 周岁。'); return; }
    localStorage.setItem('wemove-customer', JSON.stringify({ name: String(form.get('name') || form.get('email')).split('@')[0], email: form.get('email') }));
    router.push('/customer/account');
  }
  return <form className="customer-form" onSubmit={submit}>
    {register && <label>姓名<input name="name" required /></label>}
    <label>邮箱<input name="email" type="email" required placeholder="name@example.com" /></label>
    <label>密码<input name="password" type="password" minLength={6} required placeholder="至少 6 位" /></label>
    {register && <label className="check"><input name="adult" type="checkbox" />我确认已满 18 周岁，并同意服务条款与隐私政策。</label>}
    <button type="submit">{register ? '创建账户' : '登录'}</button>
    {message && <p className="form-message">{message}</p>}
    <p className="hint">{register ? '认证接口接入后将完成邮箱验证。' : '忘记密码功能将在认证接口接入后启用。'}</p>
  </form>;
}
