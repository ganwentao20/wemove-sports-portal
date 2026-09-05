import type { Metadata } from 'next';
import { CustomerDashboard } from '../../../components/customer-dashboard';

export const metadata: Metadata = { title: 'My Account', robots: { index: false, follow: false } };

/** 注册用户中心：资料/地址簿/心愿单/订单/售后（组员 A；订单 API 组员 C） */
export default function AccountPage() {
  return <CustomerDashboard />;
}
