import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Admin Dashboard', robots: { index: false, follow: false } };

/** 运营后台 Dashboard（组员 D 框架 + 组长 RBAC 接线）：侧边栏/面包屑/关键指标 */
export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-neutral-100">
      <div className="border-b border-neutral-200 bg-white px-6 py-4 text-sm font-semibold">
        WEMOVE Admin <span className="ml-2 rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">骨架占位</span>
      </div>
      <div className="flex">
        <aside className="hidden w-56 shrink-0 border-r border-neutral-200 bg-white p-4 md:block">
          <ul className="space-y-1 text-sm text-neutral-600">
            {['Dashboard', 'Products (PIM)', 'Prices & Rules', 'Orders', 'Dealers', 'CMS', 'Media', 'SEO & Redirects', 'Audit Logs'].map(
              (item) => (
                <li key={item} className="rounded-lg px-3 py-2 hover:bg-neutral-100">{item}</li>
              ),
            )}
          </ul>
        </aside>
        <main className="flex-1 p-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Sidebar menu skeleton — each area opens its module (PIM: C · Dealer review: B · CMS/Media: D).
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {['Orders today', 'GMV (7d)', 'Dealer applications', 'Open contacts'].map((kpi) => (
              <div key={kpi} className="rounded-2xl border border-neutral-200 bg-white p-5">
                <p className="text-xs text-neutral-500">{kpi}</p>
                <p className="mt-2 text-2xl font-bold">--</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
