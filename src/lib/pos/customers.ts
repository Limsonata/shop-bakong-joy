// Customer records built from sales history. Sales store the customer's name
// and phone on each sale, so a customer is everyone sharing one phone number
// (or, with no phone, one name). Walk-ins without a phone are left out.
import { balanceOwed, round2, saleProfit, type Sale, type SaleChannel } from "./types";

export interface Customer {
  key: string;
  name: string;
  phone: string;
  /** Confirmed sales, newest first (cancelled ones are listed in `sales` too). */
  orders: number;
  spent: number;
  owed: number;
  profit: number;
  firstPurchase: string;
  lastPurchase: string;
  channels: SaleChannel[];
  city: string;
  sales: Sale[];
}

function phoneKey(phone: string): string | null {
  const digits = phone.replace(/\D/g, "").replace(/^855/, "").replace(/^0/, "");
  return digits.length >= 6 ? digits : null;
}

export function buildCustomers(sales: Sale[]): Customer[] {
  const groups = new Map<string, Sale[]>();
  for (const sale of sales) {
    const name = sale.customerName.trim();
    const byPhone = phoneKey(sale.phone);
    const byName = name && !/^walk-in customer$/i.test(name) ? `name:${name.toLowerCase()}` : null;
    const key = byPhone ? `phone:${byPhone}` : byName;
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(sale);
    else groups.set(key, [sale]);
  }

  const customers: Customer[] = [];
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) =>
      a.soldAt === b.soldAt
        ? b.createdAt.localeCompare(a.createdAt)
        : b.soldAt.localeCompare(a.soldAt),
    );
    const live = sorted.filter((sale) => sale.status === "confirmed");
    const latest = sorted[0];
    customers.push({
      key,
      // Most recent spelling of the name and phone wins.
      name: sorted.find((sale) => sale.customerName.trim())?.customerName.trim() || "Customer",
      phone: sorted.find((sale) => sale.phone.trim())?.phone.trim() ?? "",
      orders: live.length,
      spent: round2(live.reduce((sum, sale) => sum + sale.total, 0)),
      owed: round2(live.reduce((sum, sale) => sum + balanceOwed(sale), 0)),
      profit: round2(live.reduce((sum, sale) => sum + saleProfit(sale), 0)),
      firstPurchase: sorted[sorted.length - 1].soldAt,
      lastPurchase: latest.soldAt,
      channels: [...new Set(live.map((sale) => sale.channel))],
      city: sorted.find((sale) => sale.city.trim())?.city.trim() ?? "",
      sales: sorted,
    });
  }
  return customers.sort((a, b) => b.lastPurchase.localeCompare(a.lastPurchase));
}
