// SEAM: the real backend wires money as integer kobo (minor units), never a
// preformatted string — every amount field on every response is kobo. This
// utility is the single conversion/formatting layer for whenever that lands;
// mock data keeps its pre-formatted naira strings until then.

/** Integer kobo → a formatted naira string, e.g. 184250000 -> "₦1,842,500.00". */
export function koboToNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Integer kobo → a signed formatted naira string, e.g. -50000000 -> "-₦500,000.00". */
export function signedKoboToNaira(kobo: number): string {
  const sign = kobo < 0 ? "-" : "+";
  return `${sign}${koboToNaira(Math.abs(kobo))}`;
}

/** Formatted naira string → integer kobo, e.g. "₦1,842,500.00" -> 184250000. Inverse of koboToNaira. */
export function nairaToKobo(naira: string): number {
  const n = Number(naira.replace(/[^\d.-]/g, ""));
  return Math.round(n * 100);
}
