import type { Metadata } from 'next';
import Link from 'next/link';
import { CustomerForm } from '../../../components/customer-form';

export const metadata: Metadata = { title: '登录' };

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-bold">欢迎回来</h1>
      <p className="mt-1 text-sm text-neutral-500">登录后可管理个人资料、地址簿、收藏和订单。</p>
      <CustomerForm />
      <p className="mt-4 text-center text-sm text-neutral-500">
        还没有账号？{' '}
        <Link href="/customer/register" className="text-[var(--wm-primary)]">去注册</Link>
      </p>
      <p className="mt-2 text-center text-sm text-neutral-500">
        忘记密码？接口接入前请通过“联系我们”提交重置申请。
      </p>
    </div>
  );
}
