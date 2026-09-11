import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Logo } from "@/components/site/Logo";
import { getSiteContent, DEFAULT_SITE_CONTENT } from "@/lib/siteContent";

const footerLinks = {
  shop: [
    { label: "All Products", to: "/shop" },
    { label: "New Arrivals", to: "/shop" },
    { label: "Best Sellers", to: "/shop" },
    { label: "Sale", to: "/shop" },
  ],
  help: [
    { label: "My Account", to: "/account" },
    { label: "My Orders", to: "/orders" },
    { label: "Track Order", to: "/track" },
    { label: "FAQ", to: "/faq" },
  ],
};

const paymentMethods = ["Visa", "Mastercard", "Amex", "PayPal", "Apple Pay", "ABA Pay"];

/**
 * Bouguessa-style footer: quiet white columns on a bordered white ground —
 * brand + contact, SHOP, HELP, then newsletter (underline input) and JOIN US
 * text links, closed by a slim copyright / payment-methods bar.
 * All contact + social content is dynamic via the site content layer.
 */
export function Footer() {
  const { data: siteContent } = useQuery({
    queryKey: ["site-content"],
    queryFn: () => getSiteContent(),
  });
  const footer = siteContent?.footer ?? DEFAULT_SITE_CONTENT.footer;

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Thanks for subscribing!");
  };

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand / contact */}
          <div>
            <Link to="/" className="mb-7 inline-block" aria-label="BillieGrace Closet — home">
              <Logo className="h-12 w-auto" />
            </Link>
            <p className="max-w-xs text-sm font-light leading-relaxed text-muted-foreground">
              {footer.about}
            </p>
            <div className="mt-6 space-y-2 text-sm font-light text-muted-foreground">
              <p>{footer.address}</p>
              <p>{footer.phone}</p>
              <a
                href={`mailto:${footer.email}`}
                className="transition-colors hover:text-foreground"
              >
                {footer.email}
              </a>
            </div>
          </div>

          {/* Shop */}
          <nav aria-label="Shop">
            <p className="editorial-label mb-5">Shop</p>
            <ul className="space-y-3">
              {footerLinks.shop.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm font-light text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Help */}
          <nav aria-label="Help">
            <p className="editorial-label mb-5">Help</p>
            <ul className="space-y-3">
              {footerLinks.help.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-sm font-light text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Newsletter + social */}
          <div>
            <p className="editorial-label mb-5">Newsletter</p>
            <p className="mb-5 text-sm font-light text-muted-foreground">
              Join our newsletter for exclusive updates and offers.
            </p>
            <form onSubmit={handleNewsletter} className="flex items-end gap-4">
              <input
                type="email"
                required
                placeholder="Email"
                aria-label="Email address"
                className="editorial-input w-full py-2 text-sm"
              />
              <button type="submit" className="editorial-label shrink-0 pb-2">
                Subscribe
              </button>
            </form>

            <p className="editorial-label mb-5 mt-12">Join Us</p>
            <ul className="space-y-3">
              {footer.socials.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target={social.href.startsWith("http") ? "_blank" : undefined}
                    rel="noreferrer"
                    className="text-sm font-light text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 px-6 py-5 sm:flex-row lg:px-10">
          <p className="text-xs font-light text-muted-foreground">
            © {new Date().getFullYear()} BillieGrace Closet. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {paymentMethods.map((method) => (
              <span
                key={method}
                className="border border-border px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
