"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ui } from "../lib/ui-strings";
import type { NavigationItem } from "../lib/navigation";
export function HeaderBar({ children }: { children: ReactNode }) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const update = () => setCompact(window.scrollY > 64);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <div
      data-header-compact={compact}
      className={`mx-auto flex max-w-[1600px] items-center justify-between gap-5 px-4 transition-[height] duration-200 motion-reduce:transition-none sm:px-6 ${compact ? "h-14" : "h-[60px] sm:h-[72px]"}`}
    >
      {children}
    </div>
  );
}
export function DesktopNavigation({
  items,
  locale,
}: {
  items: NavigationItem[];
  locale: string;
}) {
  return (
    <nav
      className="hidden items-center gap-5 text-sm font-normal text-[#555] 2xl:flex"
      aria-label={ui(locale, "Menu")}
    >
      {items.map((item) =>
        item.children?.length ? (
          <details key={item.href} className="group relative">
            <summary className="cursor-pointer whitespace-nowrap rounded py-3 focus-visible:outline-2 focus-visible:outline-offset-4">
              {item.label}
            </summary>
            <div className="absolute right-0 top-full z-50 min-w-56 border border-[#e4e4e4] bg-white p-2 shadow-xl">
              <Link
                className="block rounded-lg px-3 py-2 font-bold hover:bg-[var(--wm-surface-soft)]"
                href={item.href}
              >
                {item.label}
              </Link>
              {item.children.map((child) => (
                <Link
                  className="block rounded-lg px-3 py-2 hover:bg-[var(--wm-surface-soft)]"
                  key={child.href}
                  href={child.href}
                >
                  {child.label}
                </Link>
              ))}
            </div>
          </details>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap transition-colors hover:text-[var(--wm-primary)]"
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}
export function MobileNavigation({
  items,
  portals,
  locale,
  children,
}: {
  items: NavigationItem[];
  portals: NavigationItem[];
  locale: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    path = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
    const previous = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  useEffect(() => {
    dialog.current?.close();
    setOpen(false);
  }, [path]);
  const closeLabel =
    (
      { zh: "关闭菜单", fr: "Fermer le menu", de: "Menü schließen" } as Record<
        string,
        string
      >
    )[locale.split("-")[0]] ?? "Close menu";
  return (
    <div className="2xl:hidden">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        aria-label={ui(locale, "Menu")}
        className="inline-flex h-11 w-11 items-center justify-center bg-white text-[#686868]"
      >
        <span className="sr-only">{ui(locale, "Menu")}</span>
        <span aria-hidden="true" className="grid w-6 gap-[5px]">
          <span className="block h-[2px] bg-current" />
          <span className="block h-[2px] bg-current" />
          <span className="block h-[2px] bg-current" />
        </span>
      </button>
      <dialog
        ref={dialog}
        aria-label={ui(locale, "Menu")}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-[min(88vw,26rem)] max-w-none border-l bg-[var(--wm-surface)] p-0 text-[var(--wm-text)] shadow-2xl backdrop:bg-black/40"
      >
        <div
          className="flex min-h-full flex-col p-5"
          onClick={(event) => {
            if ((event.target as Element).closest("a")) close();
          }}
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold">{ui(locale, "Menu")}</h2>
            <button
              type="button"
              onClick={close}
              aria-label={closeLabel}
              className="rounded-lg border px-3 py-2 text-xl"
            >
              ×
            </button>
          </div>
          <nav aria-label={ui(locale, "Menu")} className="space-y-2">
            {items.map((item) =>
              item.children?.length ? (
                <details key={item.href} className="rounded-xl border p-3">
                  <summary className="cursor-pointer font-semibold">
                    {item.label}
                  </summary>
                  <div className="mt-2 grid gap-1 pl-3">
                    <Link
                      className="rounded px-2 py-2 font-semibold hover:bg-[var(--wm-surface-soft)]"
                      href={item.href}
                    >
                      {item.label}
                    </Link>
                    {item.children.map((child) => (
                      <Link
                        className="rounded px-2 py-2 hover:bg-[var(--wm-surface-soft)]"
                        key={child.href}
                        href={child.href}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </details>
              ) : (
                <Link
                  key={item.href}
                  className="block rounded-xl px-3 py-3 font-semibold hover:bg-[var(--wm-surface-soft)]"
                  href={item.href}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
          <div className="mt-5 grid gap-2 border-t pt-4">
            {portals.map((item) => (
              <Link
                key={item.href}
                className="rounded-lg px-3 py-3 hover:bg-[var(--wm-surface-soft)]"
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-auto border-t pt-5">{children}</div>
        </div>
      </dialog>
    </div>
  );
}
