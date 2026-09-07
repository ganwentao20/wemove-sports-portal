export function contentPath(slug: string) {
  return slug === "home"
    ? "/"
    : ["about", "privacy", "terms", "quality-safety"].includes(slug)
      ? `/${slug}`
      : `/content/${slug}`;
}
