import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/site/Logo";
import { getSiteContent, DEFAULT_SITE_CONTENT } from "@/lib/siteContent";

const columns = [
  {
    title: "Client Service",
    links: [
      { label: "My Account", to: "/account" },
      { label: "My Orders", to: "/orders" },
      { label: "Track Order", to: "/track" },
      { label: "FAQ", to: "/faq" },
    ],
  },
  {
    title: "Shop",
    links: [
      { label: "All Products", to: "/shop" },
      { label: "New Arrivals", to: "/shop" },
      { label: "Best Sellers", to: "/shop" },
      { label: "Sale", to: "/shop" },
    ],
  },
] as const;

const paymentMethods = ["Visa", "Mastercard", "Amex", "PayPal", "Apple Pay", "ABA Pay"];

const linkClass =
  "text-[13px] font-light tracking-wide text-black transition-colors duration-300 hover:text-black/60";

/** Accordion on phones, always-open column from `lg` up. */
function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-black/10 lg:border-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-5 text-left text-[11px] font-medium uppercase tracking-[0.25em] lg:pointer-events-none lg:cursor-default lg:py-0 lg:pb-6"
      >
        {title}
        <ChevronDown
          className={`h-4 w-4 text-black transition-transform duration-300 lg:hidden ${open ? "rotate-180" : ""}`}
        />
      </button>
      <ul className={`space-y-3.5 pb-6 lg:block lg:pb-0 ${open ? "block" : "hidden"}`}>
        {children}
      </ul>
    </div>
  );
}

/**
 * Maison-style footer (Versace / Valentino inspired): white ground, a large serif
 * newsletter statement, hairline-divided link columns that collapse into accordions
 * on phones, an oversized brand wordmark and a slim legal bar.
 * Contact + social content stays dynamic via the site content layer.
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
    <footer className="bg-white text-black">
      {/* Newsletter statement */}
      <div className="border-b border-black/10">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-6 py-16 sm:py-24 lg:grid-cols-2 lg:items-end lg:px-10">
          <div>
            <p className="mb-5 text-[11px] font-normal uppercase tracking-[0.3em] text-black">
              The Letter
            </p>
            <h2
              className="text-4xl font-light leading-[1.05] sm:text-5xl lg:text-6xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Be the first to know,
              <br />
              <em className="font-light italic text-black">always in style.</em>
            </h2>
          </div>
          <div>
            <form onSubmit={handleNewsletter} className="flex items-end gap-4 border-b border-black/40 pb-3 transition-colors focus-within:border-neutral-900">
              <input
                type="email"
                required
                placeholder="Your email address"
                aria-label="Email address"
                className="w-full bg-transparent text-base font-light tracking-wide text-black placeholder:text-black/50 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="group flex shrink-0 items-center gap-2 text-[11px] font-medium uppercase tracking-[0.25em]"
              >
                Subscribe
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </form>
            <p className="mt-4 max-w-md text-xs font-light leading-relaxed text-black">
              Exclusive previews, new arrivals and private offers. Unsubscribe at any time.
            </p>
          </div>
        </div>
      </div>

      {/* Link columns */}
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="grid lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-12 lg:py-16">
          {/* Brand / contact */}
          <div className="border-b border-black/10 py-10 lg:border-0 lg:py-0">
            <Link to="/" className="mb-6 inline-block" aria-label="BillieGrace Closet — home">
              <Logo className="h-12 w-auto" />
            </Link>
            <p className="max-w-xs text-[13px] font-light leading-relaxed text-black">
              {footer.about}
            </p>
            <div className="mt-6 space-y-1.5 text-[13px] font-light text-black">
              <p>{footer.address}</p>
              <p>{footer.phone}</p>
              <a href={`mailto:${footer.email}`} className="transition-colors hover:text-black/60">
                {footer.email}
              </a>
            </div>
          </div>

          {columns.map((col) => (
            <FooterColumn key={col.title} title={col.title}>
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </FooterColumn>
          ))}

          <FooterColumn title="Follow Us">
            {footer.socials.map((social) => (
              <li key={social.label}>
                <a
                  href={social.href}
                  target={social.href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className={linkClass}
                >
                  {social.label}
                </a>
              </li>
            ))}
          </FooterColumn>
        </div>
      </div>

      {/* Oversized wordmark */}
      <div className="overflow-hidden border-t border-black/10" aria-hidden="true">
        <p
          className="select-none whitespace-nowrap text-center font-light uppercase leading-none tracking-[0.12em] text-black/[0.06]"
          style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(3rem, 15vw, 14rem)" }}
        >
          BillieGrace
        </p>
      </div>

      {/* Legal bar */}
      <div className="border-t border-black/10">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row lg:px-10">
          <p className="text-[11px] font-light tracking-wide text-black">
            © {new Date().getFullYear()} BillieGrace Closet. All rights reserved.
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {paymentMethods.map((method) => (
              <li
                key={method}
                className="text-[10px] font-normal uppercase tracking-[0.18em] text-black"
              >
                {method}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
