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

export interface DualTile {
  eyebrow: string;
  heading: string;
  subtext: string;
  ctaLabel: string;
  ctaLink: string;
  ctaSearch?: string;
  image: string;
}

export interface DualTilesContent {
  tiles: DualTile[];
}

export type RailGarmentKind = "tee" | "knit" | "hoodie" | "shirt" | "jacket" | "coat";

export interface RailItemContent {
  id: string;
  name: string;
  description: string;
  /** Price / size shown on the hang tag. */
  tag: string;
  /** Uploaded clothing photo (cut-out). Empty = use the drawn mock-up. */
  image: string;
  /** Drawn mock-up used when there is no photo. */
  kind: RailGarmentKind;
  color: string;
}

export interface RailHeroContent {
  eyebrow: string;
  heading: string;
  caption: string;
  ctaLabel: string;
  ctaLink: string;
  items: RailItemContent[];
}

export interface VideoPopupContent {
  enabled: boolean;
  videoUrl: string;
  posterUrl: string;
}

export interface FooterSocialLink {
  label: string;
  href: string;
}

export interface FooterContent {
  about: string;
  address: string;
  phone: string;
  email: string;
  socials: FooterSocialLink[];
}

export interface SiteContent {
  hero: HeroContent;
  marquee: MarqueeContent;
  trust_strip: TrustStripContent;
  cta: CtaContent;
  dual_tiles: DualTilesContent;
  rail_hero: RailHeroContent;
  video_popup: VideoPopupContent;
  footer: FooterContent;
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
    words: [
      "WELCOME TO OUR STORE",
      "NEW ARRIVALS WEEKLY",
      "CASH ON DELIVERY",
      "FREE SHIPPING NATIONWIDE",
      "VISIT US IN PHNOM PENH",
    ],
  },
  trust_strip: {
    items: [
      { title: "Free Shipping", desc: "Nationwide in Cambodia" },
      { title: "Cash on Delivery", desc: "Pay safely on arrival" },
      { title: "Easy Returns", desc: "14-day exchange window" },
    ],
  },
  cta: {
    heading: "Visit the store — or shop from home",
    subtext:
      "Browse the collection online and pay cash on delivery, or come see everything in person in Phnom Penh. Your new favorite fit is waiting.",
    buttonLabel: "Shop the Store",
    buttonLink: "/shop",
  },
  dual_tiles: {
    tiles: [
      {
        eyebrow: "OUR STORE",
        heading: "Everyday Essentials, Made for Her",
        subtext: "Comfortable pieces you can live in — shop the store and take them home today.",
        ctaLabel: "SHOP THE STORE",
        ctaLink: "/shop",
        image: "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=1600&q=80",
      },
      {
        eyebrow: "NEW IN STORE",
        heading: "Fresh Arrivals Every Week",
        subtext: "New pieces land in the store weekly. Come see what just arrived.",
        ctaLabel: "VIEW NEW ARRIVALS",
        ctaLink: "/shop",
        ctaSearch: "New Arrivals",
        image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1600&q=80",
      },
    ],
  },
  rail_hero: {
    eyebrow: "New season · Fresh on the rail",
    heading: "Modern essentials, hung for you to browse.",
    caption: "Brush along the rail, slide a hanger, lift a piece to see the back.",
    ctaLabel: "Shop the edit",
    ctaLink: "/shop",
    items: [
      { id: "tee-bone", name: "Everyday tee · Bone", description: "Soft cotton tee for every day.", tag: "", image: "", kind: "tee", color: "#EFEBE2" },
      { id: "knit-rose", name: "Soft knit · Rose", description: "A cosy knit with ribbed trims.", tag: "", image: "", kind: "knit", color: "#D9A3A8" },
      { id: "hoodie-sage", name: "Hoodie · Sage", description: "Fleece hoodie with a kangaroo pocket.", tag: "", image: "", kind: "hoodie", color: "#A7B59A" },
      { id: "shirt-sky", name: "Button shirt · Sky", description: "Light button-down for easy layering.", tag: "", image: "", kind: "shirt", color: "#A3D3EB" },
      { id: "jacket-clay", name: "Jacket · Clay", description: "A structured everyday jacket.", tag: "", image: "", kind: "jacket", color: "#B98A6B" },
      { id: "coat-ink", name: "Long coat · Ink", description: "Full-length coat for cooler days.", tag: "", image: "", kind: "coat", color: "#2B2F3A" },
      { id: "tee-lilac", name: "Everyday tee · Lilac", description: "The same easy tee in lilac.", tag: "", image: "", kind: "tee", color: "#CCB2E0" },
    ],
  },
  video_popup: {
    enabled: true,
    // Placeholder film — replace with your own lookbook/brand film in Admin → Content.
    videoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/d/dd/Amsterdam_Fashion_Week_-_Aftermovie.webm",
    posterUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80",
  },
  footer: {
    about:
      "BillieGrace Closet is a women's clothing store in Phnom Penh — everyday essentials, comfortable fits and fresh weekly arrivals, with fast cash-on-delivery across Cambodia.",
    address: "Phnom Penh, Cambodia",
    phone: "+855 12 345 678",
    email: "hello@storefront.com",
    socials: [
      { label: "Instagram", href: "#" },
      { label: "Facebook", href: "#" },
      { label: "TikTok", href: "#" },
      { label: "YouTube", href: "#" },
    ],
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
        case "dual_tiles": {
          const tiles = (row.content as Partial<DualTilesContent>).tiles;
          if (tiles && tiles.length > 0) merged.dual_tiles = { tiles };
          break;
        }
        case "rail_hero": {
          const rail = row.content as Partial<RailHeroContent>;
          merged.rail_hero = {
            ...DEFAULT_SITE_CONTENT.rail_hero,
            ...rail,
            items: rail.items ?? DEFAULT_SITE_CONTENT.rail_hero.items,
          };
          break;
        }
        case "video_popup":
          merged.video_popup = {
            ...DEFAULT_SITE_CONTENT.video_popup,
            ...(row.content as Partial<VideoPopupContent>),
          };
          break;
        case "footer":
          merged.footer = {
            ...DEFAULT_SITE_CONTENT.footer,
            ...(row.content as Partial<FooterContent>),
          };
          break;
        default:
          break;
      }
    }
    return merged;
  }

  const overlay = loadLocalOverlay();
  const overlayTiles = overlay.dual_tiles?.tiles;
  return {
    hero: { ...DEFAULT_SITE_CONTENT.hero, ...overlay.hero },
    marquee: { ...DEFAULT_SITE_CONTENT.marquee, ...overlay.marquee },
    trust_strip: { ...DEFAULT_SITE_CONTENT.trust_strip, ...overlay.trust_strip },
    cta: { ...DEFAULT_SITE_CONTENT.cta, ...overlay.cta },
    dual_tiles: {
      tiles:
        overlayTiles && overlayTiles.length > 0
          ? overlayTiles
          : DEFAULT_SITE_CONTENT.dual_tiles.tiles,
    },
    rail_hero: {
      ...DEFAULT_SITE_CONTENT.rail_hero,
      ...overlay.rail_hero,
      items: overlay.rail_hero?.items ?? DEFAULT_SITE_CONTENT.rail_hero.items,
    },
    video_popup: { ...DEFAULT_SITE_CONTENT.video_popup, ...overlay.video_popup },
    footer: { ...DEFAULT_SITE_CONTENT.footer, ...overlay.footer },
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
      console.error(`Failed to update site content section "${section}":`, error);
      throw new Error(`"${section}": ${error.message}${error.hint ? ` (${error.hint})` : ""}`);
    }
    return true;
  }

  const overlay = loadLocalOverlay();
  overlay[section] = content;
  saveLocalOverlay(overlay);
  return true;
}
