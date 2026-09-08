import type { ReactNode } from "react";
// Deliberately render a small structured subset as React nodes; raw HTML is never used.
function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^\s)]+\))/g)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("*") && part.endsWith("*"))
        return <em key={i}>{part.slice(1, -1)}</em>;
      const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
      if (link && /^(https:\/\/|\/(?!\/))/.test(link[2]))
        return (
          <a key={i} href={link[2]} className="underline underline-offset-2">
            {link[1]}
          </a>
        );
      return part;
    });
}
export function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-4">
      {text
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((paragraph, i) => {
          const lines = paragraph.split("\n");
          if (lines.every((line) => /^[-*] /.test(line)))
            return (
              <ul key={i} className="list-disc space-y-2 pl-6">
                {lines.map((line, j) => (
                  <li key={j}>{inline(line.slice(2))}</li>
                ))}
              </ul>
            );
          return (
            <p key={i} className="whitespace-pre-line">
              {inline(paragraph)}
            </p>
          );
        })}
    </div>
  );
}
