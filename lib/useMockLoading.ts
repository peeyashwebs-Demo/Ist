"use client";

import { useEffect, useState } from "react";

/** Simulates the latency of a real admin API while the backend is stubbed.
 * Each screen runs a short load so its loading state is real and visible;
 * swap for real fetching once the SEAM endpoints exist. */
export function useMockLoading(ms = 600) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [ms]);

  return loading;
}
