"use client";
import { useState } from "react";
import { secureApiFetch } from "../lib/secure-api";
import { ApiError } from "../lib/api";
import { publicUrl } from "../lib/public-url";
export function WishlistButton({
  productId,
  locale = "en",
  market = "US",
}: {
  productId: string;
  locale?: string;
  market?: string;
}) {
  const strings = {
    en: [
      "Save to wishlist",
      "Remove from wishlist",
      "Sign in to save products.",
      "Sign in",
      "Unable to update wishlist.",
    ],
    zh: [
      "加入收藏",
      "取消收藏",
      "请登录后收藏产品。",
      "登录",
      "无法更新收藏。",
    ],
    fr: [
      "Ajouter aux favoris",
      "Retirer des favoris",
      "Connectez-vous pour enregistrer des produits.",
      "Se connecter",
      "Impossible de modifier les favoris.",
    ],
    de: [
      "Zur Wunschliste hinzufügen",
      "Von der Wunschliste entfernen",
      "Melden Sie sich an, um Produkte zu speichern.",
      "Anmelden",
      "Die Wunschliste konnte nicht geändert werden.",
    ],
  };
  const text =
    strings[locale.split("-")[0] as keyof typeof strings] ?? strings.en;
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <button
        disabled={busy}
        className="rounded-full border px-5 py-2 text-sm disabled:opacity-50"
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await secureApiFetch(
              "customer",
              `/account/favorites/${productId}`,
              { method: saved ? "DELETE" : "POST" },
            );
            setSaved(!saved);
          } catch (e) {
            setError(
              e instanceof ApiError && e.status === 401 ? text[2] : text[4],
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {saved ? text[1] : text[0]}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}{" "}
          <a href={publicUrl("/login", locale, market)} className="underline">
            {text[3]}
          </a>
        </p>
      )}
    </div>
  );
}
