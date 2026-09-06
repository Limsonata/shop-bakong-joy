// Editable site content (hero, trust strip, CTA, ...) data layer.
// Uses Supabase when configured, falls back to localStorage + hardcoded
// defaults otherwise, matching the pattern used in productStore.ts.
import { supabase, isSupabaseConfigured } from "./supabase";

export interface HeroContent {
  badge: string;
  headingLine1: string;
  headingLine2: string;
  subtext: string;
  primaryButtonLabel: string;
  primaryButtonLink: string;
  secondaryButtonLabel: string;
  secondaryButtonSearch: string;
  backgroundImage: string;
}

export interface MarqueeContent {
  words: string[];
}

export interface TrustStripItem {
  title: string;
  desc: string;
}

export interface TrustStripContent {
  items: TrustStripItem[];
}

export interface CtaContent {
  heading: string;
  subtext: string;
  buttonLabel: string;
  buttonLink: string;
}

export interface SiteContent {
  hero: HeroContent;
  marquee: MarqueeContent;
  trust_strip: TrustStripContent;
  cta: CtaContent;
}

export const DEFAULT_SITE_CONTENT: SiteContent = {
  hero: {
    badge: "Made for her",
    headingLine1: "Move.",
    headingLine2: "Look good doing it.",
    subtext:
      "Leggings, sports bras and everyday sets built for women, by women. New drops every week, delivered across Cambodia.",
    primaryButtonLabel: "Shop Now",
    primaryButtonLink: "/shop",
    secondaryButtonLabel: "New Arrivals",
    secondaryButtonSearch: "New Arrivals",
    backgroundImage: "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=1600&q=80",
  },
  marquee: {
    words: ["NEW ARRIVALS", "FREE SHIPPING", "MADE FOR HER", "SHOP THE EDIT", "CASH ON DELIVERY"],
  },
  trust_strip: {
    items: [
      { title: "Free Shipping", desc: "Nationwide in Cambodia" },
      { title: "Cash on Delivery", desc: "Pay safely on arrival" },
      { title: "Easy Returns", desc: "14-day exchange window" },
    ],
  },
  cta: {
    heading: "Your new favorite fit is one tap away",
    subtext:
      "Join women across Cambodia shopping BillieGrace Closet for fit, comfort, and easy cash-on-delivery ordering.",
    buttonLabel: "Shop Now",
    buttonLink: "/shop",
  },
};

const isBrowser = typeof window !== "undefined";
const LOCAL_STORAGE_KEY = "demo-site-content-overlay";

function loadLocalOverlay(): Partial<SiteContent> {
  if (!isBrowser) return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<SiteContent>) : {};
  } catch {
    return {};
  }
}

function saveLocalOverlay(overlay: Partial<SiteContent>): void {
  if (!isBrowser) return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(overlay));
}

/** Fetch every editable section, merged over the built-in defaults. */
export async function getSiteContent(): Promise<SiteContent> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("site_content").select("section, content");
    if (error) {
      // Content is non-critical to the storefront rendering — degrade to
      // defaults rather than breaking the homepage if this table has an
      // issue (e.g. migration not yet run).
      console.error("Failed to load site content, using defaults:", error.message);
      return DEFAULT_SITE_CONTENT;
    }
    const merged: SiteContent = { ...DEFAULT_SITE_CONTENT };
    for (const row of data ?? []) {
      switch (row.section) {
        case "hero":
          merged.hero = { ...DEFAULT_SITE_CONTENT.hero, ...(row.content as Partial<HeroContent>) };
          break;
        case "marquee":
          merged.marquee = {
            ...DEFAULT_SITE_CONTENT.marquee,
            ...(row.content as Partial<MarqueeContent>),
          };
          break;
        case "trust_strip":
          merged.trust_strip = {
            ...DEFAULT_SITE_CONTENT.trust_strip,
            ...(row.content as Partial<TrustStripContent>),
          };
          break;
        case "cta":
          merged.cta = { ...DEFAULT_SITE_CONTENT.cta, ...(row.content as Partial<CtaContent>) };
          break;
        default:
          break;
      }
    }
    return merged;
  }

  const overlay = loadLocalOverlay();
  return {
    hero: { ...DEFAULT_SITE_CONTENT.hero, ...overlay.hero },
    marquee: { ...DEFAULT_SITE_CONTENT.marquee, ...overlay.marquee },
    trust_strip: { ...DEFAULT_SITE_CONTENT.trust_strip, ...overlay.trust_strip },
    cta: { ...DEFAULT_SITE_CONTENT.cta, ...overlay.cta },
  };
}

/** Update a single section. Admin-only when Supabase is connected (RLS-enforced). */
export async function updateSiteContentSection<K extends keyof SiteContent>(
  section: K,
  content: SiteContent[K],
): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("site_content")
      .upsert({ section, content }, { onConflict: "section" });
    if (error) {
      console.error(`Failed to update site content section "${section}":`, error.message);
      return false;
    }
    return true;
  }

  const overlay = loadLocalOverlay();
  overlay[section] = content;
  saveLocalOverlay(overlay);
  return true;
}
