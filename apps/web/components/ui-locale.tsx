"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { translateUi, type UiValues } from "../lib/ui-i18n";

const UiLocaleContext = createContext("en");
export function UiLocaleProvider({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}) {
  return (
    <UiLocaleContext.Provider value={locale}>
      {children}
    </UiLocaleContext.Provider>
  );
}
export function useUiLocale() {
  return useContext(UiLocaleContext);
}
export function useUiText() {
  const locale = useUiLocale();
  return useCallback(
    (text: string, values?: UiValues) => translateUi(locale, text, values),
    [locale],
  );
}
export function UiText({
  children,
  values,
}: {
  children: string;
  values?: UiValues;
}) {
  const t = useUiText();
  return t(children, values);
}
