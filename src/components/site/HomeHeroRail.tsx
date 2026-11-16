import ClothingRailHero from "@/components/ui/product-rail-gallery";
import type { RailGarment } from "@/components/ui/product-rail-gallery";
import type { RailHeroContent } from "@/lib/siteContent";

export function HomeHeroRail({ content }: { content: RailHeroContent }) {
  const items: RailGarment[] = content.items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description || undefined,
    tag: item.tag || undefined,
    kind: item.kind,
    color: item.color,
    image: item.image || undefined,
  }));

  return (
    <ClothingRailHero
      // Re-mount when the set of pieces changes so the rail lays itself out again.
      key={items.map((i) => `${i.id}:${i.image ?? ""}`).join("|")}
      items={items}
      hanger="wood"
      shading={0.2}
      eyebrow={content.eyebrow}
      heading={content.heading}
      autoplay
      className="min-h-[80vh] pt-6"
    />
  );
}
