"use client";
import { useEffect, useState } from "react";
/** Keep credential forms disabled until their submit handler is attached. */
export function useHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
