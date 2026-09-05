import type { Metadata } from 'next';
import { CustomerForm } from '../../../components/customer-form';

export const metadata: Metadata = { title: '注册账号' };

export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-bold">注册账号</h1>
      <p className="mt-1 text-sm text-neutral-500">用于收藏商品、维护地址簿和查看订单进度。</p>
      <CustomerForm register />
      <p className="mt-4 text-center text-sm text-neutral-500">
        WEMOVE 玩具面向儿童使用，账号与购买行为需由成年人完成。
      </p>
    </div>
  );
}
