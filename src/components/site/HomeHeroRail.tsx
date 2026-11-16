import { useEffect, useMemo, useState } from "react";
import { cutoutFromUrl } from "@/lib/garmentCutout";
import ClothingRailHero from "@/components/ui/product-rail-gallery";
import type { RailGarment } from "@/components/ui/product-rail-gallery";
import type { RailHeroContent } from "@/lib/siteContent";
import type { ProductEdge } from "@/lib/productStore";
import { Skeleton } from "@/components/ui/skeleton";

const MAX_ITEMS = 7;

interface Props {
  content: RailHeroContent;
  /** Real store products; their uploaded photos fill the rail when no rail photos were added. */
  products?: ProductEdge[];
  /** True until both site content and products have loaded. */
  loading?: boolean;
}

export function HomeHeroRail({ content, products, loading }: Props) {
  const base = useMemo<{ items: RailGarment[]; fromProducts: boolean }>(() => {
    // 1. Photos uploaded for the rail in Admin → Content.
    const uploaded = content.items
      .filter((item) => item.image)
      .map<RailGarment>((item) => ({
        id: item.id,
        name: item.name,
        description: item.description || undefined,
        tag: item.tag || undefined,
        kind: item.kind,
        color: item.color,
        image: item.image,
      }));
    if (uploaded.length > 0) return { items: uploaded.slice(0, MAX_ITEMS), fromProducts: false };

    // 2. Otherwise use the real product photos from the store (never the drawn mock-ups).
    const fromStore = (products ?? [])
      .filter((edge) => edge.node.images[0]?.url)
      .slice(0, MAX_ITEMS)
      .map<RailGarment>((edge) => {
        const price = parseFloat(edge.node.price.amount);
        return {
          id: edge.node.id,
          name: edge.node.title,
          image: edge.node.images[0]!.url,
          tag: Number.isFinite(price)
            ? `${edge.node.price.currencyCode === "USD" ? "$" : ""}${price.toFixed(2)}`
            : undefined,
        };
      });
    return { items: fromStore, fromProducts: true };
  }, [content.items, products]);

  // Store photos have backdrops; cut them out so they hang like real garments.
  // Rail photos uploaded in the admin are already cut out.
  const [cut, setCut] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (loading || !base.fromProducts || base.items.length === 0) { setCut(null); return; }
    let alive = true;
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), 5000));
    Promise.race([
      Promise.all(base.items.map(async (i) => [i.image as string, await cutoutFromUrl(i.image as string)] as const)),
      timeout,
    ]).then((pairs) => { if (alive) setCut(pairs ? Object.fromEntries(pairs) : {}); });
    return () => { alive = false; };
  }, [base, loading]);

  const items = useMemo<RailGarment[]>(
    () => base.items.map((i) => ({ ...i, image: (i.image && cut?.[i.image]) || i.image })),
    [base, cut],
  );
  const preparing = !loading && base.fromProducts && base.items.length > 0 && cut === null;

  const heading = (
    <div className="flex min-h-[80vh] flex-col items-center gap-3 px-6 pt-14 text-center">
      {content.eyebrow && (
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
          {content.eyebrow}
        </p>
      )}
      {content.heading && (
        <h2 className="text-balance text-2xl font-medium tracking-tight sm:text-3xl">
          {content.heading}
        </h2>
      )}
      {loading || preparing ? <Skeleton className="mt-8 h-[320px] w-full max-w-md" /> : null}
    </div>
  );

  // Wait for real data so the rail mounts once, with real photos, instead of
  // mounting with drawn placeholders and re-mounting when the data arrives.
  if (loading || preparing || items.length === 0) return heading;

  return (
    <ClothingRailHero
      key={items.map((i) => i.id).join("|")}
      items={items}
      hanger="wood"
      shading={0}
      eyebrow={content.eyebrow}
      heading={content.heading}
      autoplay
      className="min-h-[80vh] pt-6"
    />
  );
}
