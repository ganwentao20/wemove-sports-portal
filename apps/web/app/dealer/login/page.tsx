import { redirect } from "next/navigation";
import { unifiedLoginUrl } from "@/lib/login-destination";

export default async function LegacyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  redirect(unifiedLoginUrl(typeof next === "string" ? next : undefined));
}
