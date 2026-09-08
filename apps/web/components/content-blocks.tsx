import Image from "next/image";
import Link from "next/link";
import { NewsletterForm } from "./newsletter-form";
import { RichText } from "./rich-text";
import { ContentCollection } from "./content-collection";
import { getMarket } from "../lib/locale";
import { publicUrl } from "../lib/public-url";
import { translateUi } from "../lib/ui-i18n";
type Block = {
  type: string;
  props?: Record<string, unknown>;
  [key: string]: unknown;
};
const text = (value: unknown) => (typeof value === "string" ? value : "");
const href = (value: unknown) =>
  typeof value === "string" &&
  (/^\/(?!\/)/.test(value) || /^https:\/\//.test(value))
    ? value
    : "#";
export async function ContentBlocks({
  sections,
  locale = "en",
}: {
  sections: unknown;
  locale?: string;
}) {
  if (!Array.isArray(sections)) return null;
  const market = await getMarket();
  const catalogLink = (value: unknown) => {
    const url = href(value);
    return /^\/(?!\/)/.test(url) && !/\.[a-z0-9]+(?:[?#]|$)/i.test(url)
      ? publicUrl(url, locale, market)
      : url;
  };
  return (
    <div className="space-y-12">
      {await Promise.all(
        sections.map(async (raw, index) => {
          if (!raw || typeof raw !== "object") return null;
          const block = raw as Block,
            p = block.props ?? block,
            id = String(p.id ?? `block-${index}`);
          if (
            p.enabled === false ||
            (p.publishAt && Date.parse(String(p.publishAt)) > Date.now()) ||
            (p.unpublishAt && Date.parse(String(p.unpublishAt)) <= Date.now())
          )
            return null;
          if (["products", "categories", "articles"].includes(block.type))
            return (
              <ContentCollection
                key={id}
                type={block.type}
                props={p}
                locale={locale}
              />
            );
          const title = text(p.title),
            body = text(p.text ?? p.body ?? p.content ?? p.description),
            link = catalogLink(p.href ?? p.url),
            label = text(p.label ?? p.buttonLabel);
          if (block.type === "hero")
            return (
              <section
                key={id}
                data-module-id={id}
                className="grid items-center gap-10 py-8 lg:grid-cols-2"
              >
                <div
                  className={
                    p.align === "center"
                      ? "text-center"
                      : p.align === "right"
                        ? "text-right"
                        : "text-left"
                  }
                >
                  <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
                    {title}
                  </h1>
                  <p className="mt-6 whitespace-pre-line text-lg leading-8 text-[var(--wm-muted)]">
                    {body}
                  </p>
                  <div
                    className={`mt-7 flex flex-wrap gap-3 ${p.align === "center" ? "justify-center" : p.align === "right" ? "justify-end" : ""}`}
                  >
                    {label && (
                      <Link
                        href={link}
                        className="inline-block rounded-xl bg-[var(--wm-primary)] px-6 py-3 font-bold text-white"
                      >
                        {label}
                      </Link>
                    )}
                    {text(p.secondaryLabel) && (
                      <Link
                        href={catalogLink(p.secondaryHref)}
                        className="inline-block rounded-xl border px-6 py-3 font-bold"
                      >
                        {text(p.secondaryLabel)}
                      </Link>
                    )}
                  </div>
                </div>
                {p.src ? (
                  <video
                    controls
                    preload="metadata"
                    playsInline
                    poster={
                      p.poster || p.image
                        ? href(p.poster ?? p.image)
                        : undefined
                    }
                    className="aspect-[4/3] w-full rounded-2xl bg-neutral-100 object-cover"
                    aria-label={text(p.alt) || title}
                  >
                    <source src={href(p.src)} />
                  </video>
                ) : p.image ? (
                  <picture>
                    {Boolean(p.mobileImage) && (
                      <source
                        media="(max-width: 640px)"
                        srcSet={href(p.mobileImage)}
                      />
                    )}
                    <Image
                      unoptimized={href(p.image).startsWith("https:")}
                      quality={60}
                      src={href(p.image)}
                      alt={text(p.alt)}
                      width={1200}
                      height={900}
                      sizes="(max-width:1024px) 100vw,50vw"
                      preload={index === 0 && !p.mobileImage}
                      loading={
                        index === 0
                          ? p.mobileImage
                            ? "eager"
                            : undefined
                          : "lazy"
                      }
                      fetchPriority={index === 0 ? "high" : undefined}
                      className="aspect-[4/3] w-full rounded-2xl object-cover"
                    />
                  </picture>
                ) : null}
              </section>
            );
          if (["text", "paragraph", "heading", "quote"].includes(block.type))
            return (
              <section key={id} data-module-id={id} className="max-w-3xl">
                {title && <h2 className="mb-4 text-3xl font-bold">{title}</h2>}
                {block.type === "quote" ? (
                  <blockquote className="border-l-4 border-[var(--wm-primary)] pl-6 text-xl leading-8">
                    {body}
                  </blockquote>
                ) : (
                  <div className="leading-8 text-[var(--wm-muted)]">
                    <RichText text={body} />
                  </div>
                )}
              </section>
            );
          if (block.type === "image")
            return (
              <figure key={id}>
                <Image
                  unoptimized={href(p.src ?? p.image).startsWith("https:")}
                  src={href(p.src ?? p.image)}
                  alt={text(p.alt)}
                  width={1200}
                  height={800}
                  sizes="(max-width:768px) 100vw,80vw"
                  className="h-auto w-full rounded-2xl"
                />
                {body && (
                  <figcaption className="mt-2 text-sm">{body}</figcaption>
                )}
              </figure>
            );
          if (block.type === "video")
            return (
              <video
                key={id}
                controls
                preload="metadata"
                poster={p.poster ? href(p.poster) : undefined}
                className="w-full rounded-2xl"
                aria-label={title}
              >
                <source src={href(p.src)} />
              </video>
            );
          if (["cta", "download"].includes(block.type))
            return (
              <section
                key={id}
                data-module-id={id}
                className="rounded-2xl bg-[var(--wm-surface-soft)] p-8"
              >
                <h2 className="text-2xl font-bold">{title}</h2>
                <p className="my-4 leading-7">{body}</p>
                <Link
                  href={link}
                  className="inline-block rounded-xl bg-[var(--wm-primary)] px-5 py-3 font-semibold text-white"
                >
                  {label || title}
                </Link>
              </section>
            );
          if (block.type === "faq")
            return (
              <details
                key={id}
                className="rounded-xl border border-[var(--wm-border)] p-5"
              >
                <summary className="cursor-pointer font-semibold">
                  {title || text(p.question)}
                </summary>
                <p className="mt-4 whitespace-pre-line leading-7">
                  {body || text(p.answer)}
                </p>
              </details>
            );
          if (block.type === "newsletter")
            return <NewsletterForm key={id} locale={locale} />;
          if (["list", "values", "navigation"].includes(block.type)) {
            const items = Array.isArray(p.items) ? p.items : [];
            return (
              <section key={id}>
                <h2 className="mb-5 text-2xl font-bold">{title}</h2>
                <ul className="grid gap-5 sm:grid-cols-2">
                  {items
                    .filter(
                      (v) =>
                        typeof v === "string" || (v && typeof v === "object"),
                    )
                    .map((v, i) => {
                      const item =
                        typeof v === "string"
                          ? { title: v }
                          : (v as Record<string, unknown>);
                      return (
                        <li
                          key={i}
                          className="rounded-xl border border-[var(--wm-border)] p-5"
                        >
                          <h3 className="font-bold">
                            {text(item.title ?? item.label)}
                          </h3>
                          <p className="mt-2 leading-7">
                            {text(item.text ?? item.body)}
                          </p>
                          {item.href ? (
                            <Link
                              href={catalogLink(item.href)}
                              className="mt-3 inline-block underline"
                            >
                              {text(item.label) || translateUi(locale, "Learn more")}
                            </Link>
                          ) : null}
                        </li>
                      );
                    })}
                </ul>
              </section>
            );
          }
          return null;
        }),
      )}
    </div>
  );
}
