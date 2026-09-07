/** Plain text for excerpts, search and structured answers; never HTML. */
export function contentText(sections: unknown): string {
  if (!Array.isArray(sections)) return "";
  return sections
    .flatMap((section) => {
      if (typeof section === "string") return [section];
      if (!section || typeof section !== "object") return [];
      const row =
        section.props && typeof section.props === "object"
          ? section.props
          : section;
      return [row.text ?? row.body ?? row.content ?? row.answer ?? ""].filter(
        (value) => typeof value === "string",
      );
    })
    .join("\n");
}
