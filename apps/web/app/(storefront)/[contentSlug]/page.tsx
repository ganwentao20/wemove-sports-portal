import ContentPage, {
  generateMetadata as contentMetadata,
} from "../content/[slug]/page";
import { notFound } from "next/navigation";
const slugs = ["about", "quality-safety", "privacy", "terms"];
export async function generateMetadata({
  params,
}: {
  params: Promise<{ contentSlug: string }>;
}) {
  const { contentSlug } = await params;
  return contentMetadata({ params: Promise.resolve({ slug: contentSlug }) });
}
export default async function Page({
  params,
}: {
  params: Promise<{ contentSlug: string }>;
}) {
  const { contentSlug } = await params;
  if (!slugs.includes(contentSlug)) notFound();
  return ContentPage({ params: Promise.resolve({ slug: contentSlug }) });
}
