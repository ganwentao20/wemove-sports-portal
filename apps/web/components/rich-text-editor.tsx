"use client";
import { useUiText } from "./ui-locale";

import { useRef, useState } from "react";
import { RichText } from "./rich-text";
export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useUiText();

  const ref = useRef<HTMLTextAreaElement>(null),
    [preview, setPreview] = useState(false);
  function insert(before: string, after = "") {
    const el = ref.current;
    if (!el) return;
    const from = el.selectionStart,
      to = el.selectionEnd;
    onChange(
      value.slice(0, from) +
        before +
        (value.slice(from, to) || t("Text")) +
        after +
        value.slice(to),
    );
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(from + before.length, to + before.length);
    });
  }
  return (
    <div>
      <div
        role="toolbar"
        aria-label={t("Text formatting")}
        className="my-2 flex flex-wrap gap-2"
      >
        {[
          ["Bold", "**", "**"],
          ["Italic", "*", "*"],
          ["Link", "[", "](/support)"],
          ["Bullet", "\n- ", ""],
        ].map(([label, before, after]) => (
          <button
            key={label}
            type="button"
            onClick={() => insert(before, after)}
            className="rounded border bg-white px-3 py-1"
          >
            {t(String(label))}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={preview}
          onClick={() => setPreview(!preview)}
          className="rounded border bg-white px-3 py-1"
        >
          {t("Preview formatting")}
        </button>
      </div>
      <textarea
        ref={ref}
        aria-label={t("Body text")}
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
      />
      {preview && (
        <div className="mt-3 rounded border bg-white p-4 leading-7">
          <RichText text={value} />
        </div>
      )}
    </div>
  );
}
