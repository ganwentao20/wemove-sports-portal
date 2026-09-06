import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '../../../components/forgot-password-form';

export const metadata: Metadata = { title: '找回密码' };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-bold">找回密码</h1>
      <p className="mt-1 text-sm text-neutral-500">输入注册邮箱，后端接口可发送一次性重置链接。</p>
      <ForgotPasswordForm />
      <p className="mt-4 text-center text-sm text-neutral-500">
        想起密码了？ <Link href="/customer/login" className="text-[var(--wm-primary)]">返回登录</Link>
      </p>
    </div>
  );
}
