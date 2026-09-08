"use client";
import { useUiText } from "../../../components/ui-locale";

import { useState } from "react";
export type ShippingRule = {
  method: string;
  minWeightGrams?: number;
  maxWeightGrams?: number;
  minSubtotalCents?: number;
  maxSubtotalCents?: number;
  amountCents: number;
};
export type MarketRules = {
  inventoryDisplay: string;
  allowPreorder: boolean;
  allowBackorder: boolean;
  defaultSort: string;
  shippingRules: ShippingRule[];
  taxRegionRates: Record<string, number>;
  taxMode: string;
  shippingMode: string;
};
const input = "mt-1 block w-full rounded-lg border border-neutral-300 p-2.5";
export function MarketRulesFields({
  market,
}: {
  market: Partial<MarketRules> | null;
}) {
  const t = useUiText();

  const [rules, setRules] = useState<ShippingRule[]>(
      market?.shippingRules ?? [],
    ),
    [regions, setRegions] = useState<Array<{ region: string; rate: number }>>(
      Object.entries(market?.taxRegionRates ?? {}).map(([region, rate]) => ({
        region,
        rate,
      })),
    );
  function update(index: number, key: string, value: unknown) {
    setRules((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    );
  }
  return (
    <>
      <label>
        {t("Inventory visibility")}
        <select
          className={input}
          name="inventoryDisplay"
          defaultValue={market?.inventoryDisplay ?? "STATUS"}
        >
          {[
            ["STATUS", "Status only"],
            ["EXACT", "Exact available quantity"],
            ["LEVEL", "Stock levels"],
            ["HIDDEN", "Hide stock display"],
          ].map(([v, label]) => (
            <option value={v} key={v}>
              {t(String(label))}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("Default product sort")}
        <select
          className={input}
          name="defaultSort"
          defaultValue={market?.defaultSort ?? "featured"}
        >
          {["featured", "newest", "price-asc", "price-desc", "name"].map(
            (v) => (
              <option key={v} value={v}>
                {t(String(v))}
              </option>
            ),
          )}
        </select>
      </label>
      <div className="space-y-3">
        <label className="block">
          <input
            name="allowPreorder"
            type="checkbox"
            defaultChecked={market?.allowPreorder}
          />{" "}
          {t("Allow configured preorders")}
        </label>
        <label className="block">
          <input
            name="allowBackorder"
            type="checkbox"
            defaultChecked={market?.allowBackorder}
          />{" "}
          {t("Allow configured backorders")}
        </label>
        <p className="text-xs text-neutral-600">
          {t(
            "Each SKU also needs an explicit quantity limit and dispatch estimate.",
          )}
        </p>
      </div>
      <label>
        {t("Tax calculation")}
        <select
          name="taxMode"
          className={input}
          defaultValue={market?.taxMode ?? "CONFIGURED"}
        >
          <option value="CONFIGURED">{t("Configured region rates")}</option>
          <option value="HTTP">{t("Connected tax provider")}</option>
        </select>
      </label>
      <label>
        {t("Shipping calculation")}
        <select
          name="shippingMode"
          className={input}
          defaultValue={market?.shippingMode ?? "CONFIGURED"}
        >
          <option value="CONFIGURED">{t("Configured rates")}</option>
          <option value="HTTP">{t("Connected live carrier rates")}</option>
        </select>
      </label>
      <div className="sm:col-span-3">
        <h3 className="font-semibold">
          {t("Weight and order amount delivery rates")}
        </h3>
        <p className="my-2 text-sm text-neutral-600">
          {t(
            "A blank maximum has no upper limit. Lower bounds are inclusive; upper bounds are exclusive. Fixed delivery fees apply when no rule matches. Free shipping still takes precedence.",
          )}
        </p>
        <input
          type="hidden"
          name="shippingRules"
          value={JSON.stringify(rules)}
        />
        {rules.map((r, i) => (
          <fieldset
            key={i}
            className="my-3 grid gap-3 rounded-lg border p-3 sm:grid-cols-3"
          >
            <legend>
              {t("Rate")}
              {i + 1}
            </legend>
            <label>
              {t("Delivery")}
              <select
                className={input}
                value={r.method}
                onChange={(e) => update(i, "method", e.target.value)}
              >
                <option value="STANDARD">{t("STANDARD")}</option>
                <option value="EXPRESS">{t("EXPRESS")}</option>
              </select>
            </label>
            {[
              ["minWeightGrams", "Minimum weight (g)", 1],
              ["maxWeightGrams", "Maximum weight (g)", 1],
              ["minSubtotalCents", "Minimum order amount", 100],
              ["maxSubtotalCents", "Maximum order amount", 100],
              ["amountCents", "Delivery fee", 100],
            ].map(([key, label, divisor]) => (
              <label key={key}>
                {t(String(label))}
                <input
                  className={input}
                  type="number"
                  min={0}
                  step={Number(divisor) === 100 ? "0.01" : "1"}
                  value={
                    r[key as keyof ShippingRule] === undefined
                      ? ""
                      : Number(r[key as keyof ShippingRule]) / Number(divisor)
                  }
                  required={key === "amountCents"}
                  onChange={(e) =>
                    update(
                      i,
                      String(key),
                      e.target.value === ""
                        ? undefined
                        : Math.round(Number(e.target.value) * Number(divisor)),
                    )
                  }
                />
              </label>
            ))}
            <button
              type="button"
              className="justify-self-start underline"
              onClick={() => setRules(rules.filter((_, n) => n !== i))}
            >
              {t("Remove rate")}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="rounded-lg border px-4 py-2"
          onClick={() =>
            setRules([...rules, { method: "STANDARD", amountCents: 0 }])
          }
        >
          {t("Add delivery rate")}
        </button>
      </div>
      <div className="sm:col-span-3">
        <h3 className="font-semibold">{t("Regional tax overrides")}</h3>
        <input
          type="hidden"
          name="taxRegionRates"
          value={JSON.stringify(
            Object.fromEntries(
              regions
                .filter((r) => r.region)
                .map((r) => [r.region.toUpperCase(), r.rate]),
            ),
          )}
        />
        {regions.map((r, i) => (
          <div key={i} className="my-3 flex flex-wrap gap-3">
            <label>
              {t("State / region")}
              <input
                className={input}
                required
                value={r.region}
                onChange={(e) =>
                  setRegions(
                    regions.map((x, n) =>
                      n === i ? { ...x, region: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              {t("Tax rate %")}
              <input
                className={input}
                required
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={r.rate / 100}
                onChange={(e) =>
                  setRegions(
                    regions.map((x, n) =>
                      n === i
                        ? {
                            ...x,
                            rate: Math.round(Number(e.target.value) * 100),
                          }
                        : x,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              className="underline"
              onClick={() => setRegions(regions.filter((_, n) => n !== i))}
            >
              {t("Remove override")}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="mt-3 rounded-lg border px-4 py-2"
          onClick={() => setRegions([...regions, { region: "", rate: 0 }])}
        >
          {t("Add regional tax rate")}
        </button>
      </div>
    </>
  );
}
