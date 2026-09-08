"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../lib/api";
import { secureApiFetch } from "../lib/secure-api";
import { useProductSelection } from "./product-selection";

type Variant = {
  id: string;
  sku: string;
  name: string | null;
  available: number | null;
  availability: string;
  price: { priceCents: number; currency: string; validUntil?: string | null };
  priceBreaks: Array<{ minQty: number; priceCents: number; currency: string }>;
  purchaseRules: {
    moq: number;
    multiple: number;
    caseSize: number;
    caseWeightGrams?: number;
    leadTimeDays: number;
  };
};
type CatalogProduct = { id: string; name: string; variants: Variant[] };
type Preview = {
  valid: boolean;
  currency: string;
  totalCents: number;
  results: Array<{
    ok: boolean;
    message?: string;
    unitPriceCents?: number;
    available?: number | null;
    availability?: string;
  }>;
};
const dealerCopy = {
  en: {
    checking: "Checking purchasing options…",
    company: "Company purchasing",
    account: "Review dealer account",
    companyMarket: "Company market for prices and availability",
    publicMarket: "Public browsing market",
    variant: "Authorized variant",
    moq: "Minimum quantity",
    multiple: "Order multiple",
    case: "Units per case",
    weight: "Case gross weight",
    lead: "Lead time",
    days: "days",
    tiers: "Company quantity prices",
    quantity: "Quantity",
    unitPrice: "Price per unit",
    units: "Units",
    checkingPrice: "Checking company price and inventory…",
    each: "each",
    available: "units available",
    valid: "Price valid until",
    viewer:
      "Your role allows viewing. An owner or buyer can submit procurement requests.",
    cart: "Add to dealer cart",
    quote: "Request quote",
    review: "Review procurement cart",
    added: "Added to your procurement cart.",
    denied: "This product is not authorized for your company.",
    failed: "Unable to verify company purchasing access.",
    quoteFor: "Quote for",
    stock: "In stock",
    preorder: "Pre-order",
    backorder: "Backorder",
    unknown: "Contact sales to confirm availability",
  },
  zh: {
    checking: "正在检查采购选项…",
    company: "企业采购",
    account: "查看经销商账户",
    companyMarket: "价格与库存采用的企业市场",
    publicMarket: "当前浏览市场",
    variant: "授权规格",
    moq: "最小起订量",
    multiple: "采购倍数",
    case: "每箱数量",
    weight: "整箱毛重",
    lead: "预计交期",
    days: "天",
    tiers: "企业阶梯价格",
    quantity: "数量",
    unitPrice: "单价",
    units: "件数",
    checkingPrice: "正在核验企业价格与库存…",
    each: "每件",
    available: "件可订",
    valid: "价格有效期至",
    viewer: "当前角色仅可查看，企业管理员或采购员可以提交采购请求。",
    cart: "加入企业采购车",
    quote: "申请报价",
    review: "查看企业采购车",
    added: "已加入企业采购车。",
    denied: "贵企业未获授权采购此商品。",
    failed: "暂时无法核验企业采购权限。",
    quoteFor: "商品询价",
    stock: "有货",
    preorder: "预售",
    backorder: "延期交付",
    unknown: "请联系销售确认供货情况",
  },
  fr: {
    checking: "Vérification des options d’achat…",
    company: "Achats professionnels",
    account: "Consulter le compte revendeur",
    companyMarket: "Marché de votre entreprise pour les prix et les stocks",
    publicMarket: "Marché de navigation",
    variant: "Variante autorisée",
    moq: "Quantité minimale",
    multiple: "Multiple de commande",
    case: "Unités par carton",
    weight: "Poids brut du carton",
    lead: "Délai prévu",
    days: "jours",
    tiers: "Tarifs dégressifs de l’entreprise",
    quantity: "Quantité",
    unitPrice: "Prix unitaire",
    units: "Unités",
    checkingPrice: "Vérification du prix et du stock…",
    each: "par unité",
    available: "unités disponibles",
    valid: "Prix valable jusqu’au",
    viewer:
      "Votre rôle permet la consultation. Un responsable ou un acheteur peut envoyer une demande.",
    cart: "Ajouter au panier professionnel",
    quote: "Demander un devis",
    review: "Consulter le panier professionnel",
    added: "Ajouté à votre panier professionnel.",
    denied: "Votre entreprise n’est pas autorisée à acheter ce produit.",
    failed: "Impossible de vérifier les autorisations d’achat.",
    quoteFor: "Devis pour",
    stock: "En stock",
    preorder: "Précommande",
    backorder: "Livraison différée",
    unknown: "Contactez le service commercial pour la disponibilité",
  },
  de: {
    checking: "Kaufoptionen werden geprüft…",
    company: "Geschäftskundenbestellung",
    account: "Händlerkonto ansehen",
    companyMarket: "Unternehmensmarkt für Preise und Verfügbarkeit",
    publicMarket: "Aktueller Markt",
    variant: "Freigegebene Variante",
    moq: "Mindestmenge",
    multiple: "Bestellvielfaches",
    case: "Einheiten pro Karton",
    weight: "Bruttogewicht des Kartons",
    lead: "Lieferzeit",
    days: "Tage",
    tiers: "Staffelpreise für Ihr Unternehmen",
    quantity: "Menge",
    unitPrice: "Stückpreis",
    units: "Einheiten",
    checkingPrice: "Unternehmenspreis und Bestand werden geprüft…",
    each: "pro Stück",
    available: "Einheiten verfügbar",
    valid: "Preis gültig bis",
    viewer:
      "Ihre Rolle erlaubt die Ansicht. Verantwortliche oder Einkäufer können Anfragen absenden.",
    cart: "Zum Händlerwarenkorb",
    quote: "Angebot anfordern",
    review: "Händlerwarenkorb ansehen",
    added: "Zum Händlerwarenkorb hinzugefügt.",
    denied: "Ihr Unternehmen ist für dieses Produkt nicht freigeschaltet.",
    failed: "Die Einkaufsberechtigung konnte nicht geprüft werden.",
    quoteFor: "Angebot für",
    stock: "Auf Lager",
    preorder: "Vorbestellung",
    backorder: "Nachbestellung",
    unknown: "Verfügbarkeit beim Vertrieb erfragen",
  },
};
const field =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2";
function minimum(variant: Variant) {
  return (
    Math.ceil(
      Math.max(variant.purchaseRules.moq, variant.priceBreaks[0]?.minQty ?? 1) /
        variant.purchaseRules.multiple,
    ) * variant.purchaseRules.multiple
  );
}

/** Public pages retain retail purchasing for visitors; dealer prices use only the HttpOnly dealer session. */
export function DealerProductPurchase({
  productId,
  productSlug,
  productName,
  market,
  children,
  locale = "en",
}: {
  productId: string;
  productSlug: string;
  productName?: string;
  market: string;
  children: ReactNode;
  locale?: string;
}) {
  const baseLanguage = locale.split("-")[0].toLowerCase();
  const language =
    baseLanguage in dealerCopy
      ? (baseLanguage as keyof typeof dealerCopy)
      : "en";
  const formatLocale = baseLanguage in dealerCopy ? locale : "en";
  const t = dealerCopy[language];
  const selection = useProductSelection();
  const money = (cents: number, currency: string) =>
    new Intl.NumberFormat(formatLocale, { style: "currency", currency }).format(
      cents / 100,
    );
  const quantityHint = {
    en: "Review the minimum quantity, order multiple and availability.",
    zh: "请检查最小起订量、采购倍数与供货情况。",
    fr: "Vérifiez la quantité minimale, le multiple de commande et la disponibilité.",
    de: "Prüfen Sie Mindestmenge, Bestellvielfaches und Verfügbarkeit.",
  }[language];
  const errorMessage = useCallback(
    (cause: unknown) =>
      language === "en" && cause instanceof Error
        ? cause.message
        : {
            en: "Unable to complete this action.",
            zh: "暂时无法完成此操作。",
            fr: "Impossible de terminer cette action.",
            de: "Diese Aktion konnte nicht abgeschlossen werden.",
          }[language] +
          (cause instanceof ApiError ? " (" + cause.code + ")" : ""),
    [language],
  );
  const router = useRouter();
  const [state, setState] = useState<
    "loading" | "retail" | "dealer" | "blocked"
  >("loading");
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [company, setCompany] = useState<{
    companyName: string;
    country: string;
    role: string;
  } | null>(null);
  const [variantId, setVariantId] = useState(""),
    [quantity, setQuantity] = useState(1),
    [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(false);
  const variant = product?.variants.find((v) => v.id === variantId);
  useEffect(() => {
    let current = true;
    setState("loading");
    setProduct(null);
    setError("");
    void (async () => {
      try {
        const profile = await secureApiFetch<{
          company: { companyName: string; country: string; role: string };
        }>("dealer", "/dealer/company");
        const products = await secureApiFetch<CatalogProduct[]>(
          "dealer",
          "/dealer/catalog?productId=" + encodeURIComponent(productId) + "&locale=" + encodeURIComponent(locale),
        );
        if (!current) return;
        setCompany(profile.company);
        const found = products.find((item) => item.id === productId);
        if (!found?.variants.length) {
          setState("blocked");
          setError(t.denied);
          return;
        }
        setProduct(found);
        setVariantId(found.variants[0].id);
        setQuantity(minimum(found.variants[0]));
        setState("dealer");
      } catch (cause) {
        if (!current) return;
        if (cause instanceof ApiError && cause.status === 401)
          setState("retail");
        else {
          setState("blocked");
          setError(errorMessage(cause));
        }
      }
    })();
    return () => {
      current = false;
    };
  }, [productId, locale, t.denied, errorMessage]);
  useEffect(() => {
    setPreview(null);
    if (
      state !== "dealer" ||
      !variant ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 10000
    )
      return;
    let current = true;
    setChecking(true);
    const timer = setTimeout(() => {
      void secureApiFetch<Preview>("dealer", "/dealer/quick-order/validate", {
        method: "POST",
        body: JSON.stringify({ lines: [{ sku: variant.sku, quantity }] }),
      })
        .then((data) => {
          if (current) {
            setPreview(data);
            setError("");
          }
        })
        .catch((cause) => {
          if (current) setError(errorMessage(cause));
        })
        .finally(() => {
          if (current) setChecking(false);
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [variant, quantity, state, errorMessage]);
  async function purchase(action: "cart" | "quote") {
    if (!variant || !preview?.valid) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (action === "cart") {
        const cart = await secureApiFetch<{
          lines: Array<{ sku: string; quantity: number }>;
        }>("dealer", "/dealer/cart");
        const lines = new Map(
          cart.lines.map((line) => [line.sku, line.quantity]),
        );
        lines.set(variant.sku, (lines.get(variant.sku) ?? 0) + quantity);
        await secureApiFetch("dealer", "/dealer/cart", {
          method: "PUT",
          body: JSON.stringify({
            lines: [...lines].map(([sku, quantity]) => ({ sku, quantity })),
          }),
        });
        setNotice(t.added);
      } else {
        const rfq = await secureApiFetch<{ id: string }>(
          "dealer",
          "/dealer/rfqs",
          {
            method: "POST",
            body: JSON.stringify({
              title: (t.quoteFor + " " + (productName ?? product?.name)).slice(
                0,
                160,
              ),
              note: "Requested from /products/" + productSlug,
              lines: [{ sku: variant.sku, quantity }],
            }),
          },
        );
        await secureApiFetch("dealer", "/dealer/rfqs/" + rfq.id + "/submit", {
          method: "POST",
        });
        router.push("/dealer/procurement");
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  if (state === "retail") return <>{children}</>;
  if (state === "loading")
    return (
      <p className="mt-6 text-sm text-neutral-500" role="status">
        {t.checking}
      </p>
    );
  if (state === "blocked")
    return (
      <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="font-semibold">{t.company}</h2>
        <p role="alert" className="mt-2 text-sm">
          {error}
        </p>
        <Link href="/dealer/dashboard" className="mt-3 inline-block underline">
          {t.account}
        </Link>
      </section>
    );
  if (!variant) return null;
  const line = preview?.results[0];
  const unitPrice = line?.ok ? line.unitPriceCents : undefined;
  const canBuy =
    company?.role !== "VIEWER" && preview?.valid && !checking && !busy;
  return (
    <section
      className="mt-6 space-y-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-5"
      aria-label={t.company}
    >
      <div>
        <p className="text-sm font-semibold text-sky-800">
          {t.company} · {company?.companyName}
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          {t.companyMarket}: {company?.country}.
          {company?.country !== market
            ? " " + t.publicMarket + ": " + market + "."
            : ""}
        </p>
      </div>
      <label className="block text-sm">
        {t.variant}
        <select
          className={field}
          value={variantId}
          onChange={(e) => {
            const next = product?.variants.find((v) => v.id === e.target.value);
            if (next) {
              setVariantId(next.id);
              setQuantity(minimum(next));
              setNotice("");
            }
          }}
        >
          {product?.variants.map((item) => (
            <option key={item.id} value={item.id}>
              {selection?.variants.find((variant) => variant.id === item.id)
                ?.name ??
                item.name ??
                item.sku}{" "}
              · {item.sku}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm">
        {t.moq} {variant.purchaseRules.moq} · {t.multiple}{" "}
        {variant.purchaseRules.multiple} · {t.case}{" "}
        {variant.purchaseRules.caseSize}
        {variant.purchaseRules.caseWeightGrams
          ? " · " +
            t.weight +
            " " +
            variant.purchaseRules.caseWeightGrams +
            " g"
          : ""}{" "}
        · {t.lead} {variant.purchaseRules.leadTimeDays} {t.days}
      </p>
      {variant.priceBreaks.length > 0 && (
        <table className="w-full text-left text-sm">
          <caption className="mb-2 text-left font-semibold">{t.tiers}</caption>
          <thead>
            <tr>
              <th className="py-1">{t.quantity}</th>
              <th>{t.unitPrice}</th>
            </tr>
          </thead>
          <tbody>
            {variant.priceBreaks.map((tier) => (
              <tr key={tier.minQty}>
                <td className="py-1">{tier.minQty}+</td>
                <td>{money(tier.priceCents, tier.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <label className="block text-sm">
        {t.units}
        <input
          type="number"
          min={minimum(variant)}
          max={10000}
          step={variant.purchaseRules.multiple}
          value={quantity}
          className={field}
          onChange={(e) => {
            setQuantity(Number(e.target.value));
            setNotice("");
          }}
        />
      </label>
      <div aria-live="polite">
        {checking ? (
          <p className="text-sm">{t.checkingPrice}</p>
        ) : line?.ok ? (
          <>
            <p className="text-lg font-semibold">
              {money(preview!.totalCents, preview!.currency)}{" "}
              <span className="text-sm font-normal">
                ({money(unitPrice ?? 0, preview!.currency)} {t.each})
              </span>
            </p>
            <p className="text-sm">
              {line.available != null
                ? line.available + " " + t.available
                : line.availability === "IN_STOCK"
                  ? t.stock
                  : line.availability === "PREORDER"
                    ? t.preorder
                    : line.availability === "BACKORDER"
                      ? t.backorder
                      : t.unknown}
            </p>
          </>
        ) : line?.message ? (
          <p className="text-sm text-red-700">
            {language === "en" ? line.message : quantityHint}
          </p>
        ) : null}
      </div>
      {variant.price.validUntil && (
        <p className="text-xs">
          {t.valid}{" "}
          {new Date(variant.price.validUntil).toLocaleDateString(formatLocale)}
        </p>
      )}
      {company?.role === "VIEWER" && <p className="text-sm">{t.viewer}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-800">
          {notice}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => void purchase("cart")}
          disabled={!canBuy}
          className="rounded-full bg-[var(--wm-dark)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {t.cart}
        </button>
        <button
          onClick={() => void purchase("quote")}
          disabled={!canBuy}
          className="rounded-full border border-neutral-400 bg-white px-5 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {t.quote}
        </button>
        <Link
          href="/dealer/quick-order"
          className="self-center text-sm underline"
        >
          {t.review}
        </Link>
      </div>
    </section>
  );
}
