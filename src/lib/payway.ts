export function getPayWayCheckoutUrl(): string {
  return "/checkout/bakong";
}

export function generatePayWayTransactionId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SBJ${timestamp}${suffix}`.slice(0, 20);
}
