import { DealerFinder } from "../../../components/dealer-finder";
import { serverApiGet } from "../../../lib/server-api";
export const metadata = { title: "Find a dealer" };
export const dynamic = "force-dynamic";
export default async function Page() {
  const result =
    await serverApiGet<Parameters<typeof DealerFinder>[0]["dealers"]>(
      "/dealer/directory",
    );
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="mb-8 text-4xl font-bold">Find a dealer</h1>
      {result.ok ? (
        <DealerFinder dealers={result.data} />
      ) : (
        <p role="status">
          Dealer directory temporarily unavailable. Please try again.
        </p>
      )}
    </div>
  );
}
