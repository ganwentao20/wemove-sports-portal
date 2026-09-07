"use client";
type Pool = {
  market: string;
  available: number;
  reserved: number;
  lowThreshold: number;
  source: string;
  syncError?: string | null;
};
export type VariantInventoryData = {
  id: string;
  sku: string;
  availabilityPolicy: string;
  backorderLimit: number;
  leadTimeDays?: number | null;
  marketInventory: Pool[];
};
const input = "mt-1 block w-full rounded-lg border border-neutral-300 p-2.5";
export function VariantInventory({
  variant,
  busy,
  save,
}: {
  variant: VariantInventoryData;
  busy: boolean;
  save: (path: string, body: unknown, method?: string) => Promise<unknown>;
}) {
  const pools: Array<Pool | null> = [...(variant.marketInventory ?? []), null];
  return (
    <section className="my-5 rounded-xl border p-5">
      <h4 className="font-semibold">
        {variant.sku} · Market allocation & advance orders
      </h4>
      <form
        className="my-4 grid gap-3 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void save(`/admin/catalog/variants/${variant.id}`, {
            availabilityPolicy: f.get("policy"),
            backorderLimit: Number(f.get("limit")),
            leadTimeDays: f.get("lead") ? Number(f.get("lead")) : undefined,
          });
        }}
      >
        <label>
          When available stock reaches zero
          <select
            className={input}
            name="policy"
            defaultValue={variant.availabilityPolicy}
          >
            <option value="IN_STOCK_ONLY">Stop new purchases</option>
            <option value="PREORDER">Preorder</option>
            <option value="BACKORDER">Backorder</option>
          </select>
        </label>
        <label>
          Maximum advance order units
          <input
            className={input}
            name="limit"
            type="number"
            min={0}
            max={100000}
            defaultValue={variant.backorderLimit}
          />
        </label>
        <label>
          Estimated dispatch days
          <input
            className={input}
            name="lead"
            type="number"
            min={1}
            max={365}
            defaultValue={variant.leadTimeDays ?? ""}
          />
        </label>
        <button
          className="self-end rounded-lg border px-4 py-3"
          disabled={busy}
        >
          Save purchase policy
        </button>
      </form>
      <p className="text-sm text-neutral-600">
        Market allocations also consume the global stock pool. The marketplace
        must allow advance orders. Unfilled backorders cannot ship until stock
        is replenished. Create new market allocations when global reservations
        are zero.
      </p>
      {pools.map((pool) => (
        <form
          key={pool?.market ?? "new"}
          className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              failure = String(f.get("error") ?? "").trim();
            void save(
              `/admin/commerce/inventory/${variant.id}`,
              {
                market: String(f.get("market")).toUpperCase(),
                source: f.get("source"),
                lowThreshold: Number(f.get("threshold")),
                ...(failure
                  ? { syncError: failure }
                  : { available: Number(f.get("available")), syncError: "" }),
              },
              "POST",
            );
          }}
        >
          <label>
            Market code
            <input
              className={input}
              required
              name="market"
              maxLength={2}
              minLength={2}
              readOnly={!!pool}
              defaultValue={pool?.market ?? ""}
              placeholder="US"
            />
          </label>
          <label>
            Available to sell after reservations
            <input
              className={input}
              name="available"
              type="number"
              min={0}
              defaultValue={Math.max(0, pool?.available ?? 0)}
            />
          </label>
          <label>
            Low stock threshold
            <input
              className={input}
              name="threshold"
              type="number"
              min={0}
              defaultValue={pool?.lowThreshold ?? 5}
            />
          </label>
          <label>
            Source
            <input
              className={input}
              required
              name="source"
              defaultValue={pool?.source ?? "MANUAL"}
            />
          </label>
          <label>
            Source error (blank = healthy)
            <input
              className={input}
              name="error"
              defaultValue={pool?.syncError ?? ""}
            />
          </label>
          <div className="self-end">
            <p className="mb-2 text-sm">
              {pool
                ? `${pool.reserved} reserved${pool.available < 0 ? ` · ${-pool.available} awaiting replenishment` : ""}`
                : "New market allocation"}
            </p>
            <button className="rounded-lg border px-4 py-3" disabled={busy}>
              Save market inventory
            </button>
          </div>
        </form>
      ))}
    </section>
  );
}
