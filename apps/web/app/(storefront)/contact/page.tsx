import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Contact Us' };

/** 联系表单（POST /api/v1/contact，ContactMessage 表；带 Honeypot 防刷，组员 B/D 联调） */
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Contact Us</h1>
      <p className="mt-2 text-neutral-600">We reply within 2 business days.</p>
      <form className="mt-8 space-y-4" action="#">
        <div className="grid gap-4 sm:grid-cols-2">
          <input required placeholder="Your name" className="rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]" />
          <input required type="email" placeholder="Email" className="rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]" />
        </div>
        <input placeholder="Subject" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]" />
        <textarea required rows={5} placeholder="Message" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-[var(--wm-primary)]" />
        <button className="rounded-full bg-[var(--wm-primary)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90">
          Send message
        </button>
      </form>
    </div>
  );
}
