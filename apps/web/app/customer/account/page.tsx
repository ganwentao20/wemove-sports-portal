import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'My Account', robots: { index: false, follow: false } };

/** 注册用户中心：资料/地址簿/心愿单/订单/售后（组员 A；订单 API 组员 C） */
export default function AccountPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">My Account</h1>
      <p className="mt-2 text-sm text-neutral-500">Placeholder — auth-gated dashboard for profile / address book / wishlist / orders / after-sales.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['Profile', 'Address Book', 'Wishlist', 'Orders'].map((item) => (
          <div key={item} className="rounded-2xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-400">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
