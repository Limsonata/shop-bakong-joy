export function formatPrice(value: number | string): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(isNaN(n) ? 0 : n);
}

// Alias for formatPrice used in admin dashboard
export function formatCurrency(value: number | string): string {
  return formatPrice(value);
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
