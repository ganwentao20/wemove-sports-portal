"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
type Variant = {
  id: string;
  name?: string | null;
  attrs: unknown;
  price?: unknown;
};
const Selection = createContext<{
  selected: string;
  select: (id: string) => void;
  variants: Variant[];
} | null>(null);
export function ProductSelectionProvider({
  variants,
  children,
}: {
  variants: Variant[];
  children: ReactNode;
}) {
  const [selected, select] = useState(
    variants.find((v) => v.price)?.id ?? variants[0]?.id ?? "",
  );
  return (
    <Selection.Provider value={{ selected, select, variants }}>
      {children}
    </Selection.Provider>
  );
}
export function useProductSelection() {
  return useContext(Selection);
}
