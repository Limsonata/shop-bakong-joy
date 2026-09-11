import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save, RefreshCw, Check, Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { MediaField } from "@/components/admin/MediaField";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getSiteContent,
  updateSiteContentSection,
  DEFAULT_SITE_CONTENT,
  type SiteContent,
} from "@/lib/siteContent";

export const Route = createFileRoute("/admin/content")({
  head: () => ({ meta: [{ title: "Content - Admin" }] }),
  component: ContentAdmin,
});

function ContentAdmin() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [content, setContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [original, setOriginal] = useState<SiteContent>(DEFAULT_SITE_CONTENT);

  useEffect(() => {
    getSiteContent().then((data) => {
      setContent(data);
      setOriginal(data);
      setIsLoading(false);
    });
  }, []);

  const hasChanges = JSON.stringify(content) !== JSON.stringify(original);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const sections: Array<keyof SiteContent> = [
        "hero",
        "marquee",
        "trust_strip",
        "cta",
        "dual_tiles",
        "video_popup",
        "footer",
      ];
      const results = await Promise.all(
        sections
          .filter(
            (section) => JSON.stringify(content[section]) !== JSON.stringify(original[section]),
          )
          .map((section) => updateSiteContentSection(section, content[section])),
      );
      if (results.some((ok) => !ok)) {
        toast.error("Some sections failed to save. Please try again.");
        return;
      }
      setOriginal(content);
      setShowSuccess(true);
      toast.success("Homepage content saved");
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      toast.error("Failed to save content");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setContent(original);
    toast.info("Changes discarded");
  };

  const updateCta = (field: keyof SiteContent["cta"], value: string) =>
    setContent((prev) => ({ ...prev, cta: { ...prev.cta, [field]: value } }));

  const updateMarqueeWord = (index: number, value: string) =>
    setContent((prev) => {
      const words = [...prev.marquee.words];
      words[index] = value;
      return { ...prev, marquee: { words } };
    });

  const addMarqueeWord = () =>
    setContent((prev) => ({ ...prev, marquee: { words: [...prev.marquee.words, "NEW WORD"] } }));

  const removeMarqueeWord = (index: number) =>
    setContent((prev) => ({
      ...prev,
      marquee: { words: prev.marquee.words.filter((_, i) => i !== index) },
    }));

  const updateTrustItem = (index: number, field: "title" | "desc", value: string) =>
    setContent((prev) => {
      const items = prev.trust_strip.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      );
      return { ...prev, trust_strip: { items } };
    });

  const addTrustItem = () =>
    setContent((prev) => ({
      ...prev,
      trust_strip: {
        items: [...prev.trust_strip.items, { title: "New benefit", desc: "Description" }],
      },
    }));

  const removeTrustItem = (index: number) =>
    setContent((prev) => ({
      ...prev,
      trust_strip: { items: prev.trust_strip.items.filter((_, i) => i !== index) },
    }));

  const updateTile = (
    index: number,
    field: keyof SiteContent["dual_tiles"]["tiles"][number],
    value: string,
  ) =>
    setContent((prev) => {
      const tiles = prev.dual_tiles.tiles.map((tile, i) =>
        i === index ? { ...tile, [field]: value } : tile,
      );
      return { ...prev, dual_tiles: { tiles } };
    });

  const updateVideoPopup = (field: "videoUrl" | "posterUrl", value: string) =>
    setContent((prev) => ({
      ...prev,
      video_popup: { ...prev.video_popup, [field]: value },
    }));

  const toggleVideoPopup = (enabled: boolean) =>
    setContent((prev) => ({
      ...prev,
      video_popup: { ...prev.video_popup, enabled },
    }));

  const updateFooter = (field: "about" | "address" | "phone" | "email", value: string) =>
    setContent((prev) => ({ ...prev, footer: { ...prev.footer, [field]: value } }));

  const updateSocial = (index: number, field: "label" | "href", value: string) =>
    setContent((prev) => {
      const socials = prev.footer.socials.map((social, i) =>
        i === index ? { ...social, [field]: value } : social,
      );
      return { ...prev, footer: { ...prev.footer, socials } };
    });

  if (isLoading) {
    return (
      <RequireAdmin>
        <div className="min-h-screen bg-background">
          <header className="border-b">
            <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
              <div className="flex items-center gap-4">
                <Link to="/admin" className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <h1 className="text-xl font-semibold">Content</h1>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
            <p className="text-muted-foreground">Loading content...</p>
          </main>
        </div>
      </RequireAdmin>
    );
  }

  return (
    <RequireAdmin>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-xl font-semibold">Content</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <a href="/" target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View homepage
                </a>
              </Button>
              {hasChanges && (
                <>
                  <Button variant="outline" onClick={handleReset} disabled={isSaving}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          {!isSupabaseConfigured && (
            <Alert className="mb-6">
              <AlertTitle>Offline mode</AlertTitle>
              <AlertDescription>
                Changes are saved to your browser only. Connect Supabase to make them visible to
                everyone visiting the site.
              </AlertDescription>
            </Alert>
          )}

          {showSuccess && (
            <Alert className="mb-6 border-green-500/50 bg-green-500/10">
              <Check className="h-4 w-4 text-green-600" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>Homepage content saved.</AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Ticker Strip</CardTitle>
                <CardDescription>The scrolling text banner below the hero.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {content.marquee.words.map((word, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={word}
                      onChange={(e) => updateMarqueeWord(i, e.target.value)}
                      placeholder="NEW ARRIVALS"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMarqueeWord(i)}
                      disabled={content.marquee.words.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addMarqueeWord}>
                  <Plus className="mr-2 h-4 w-4" /> Add word
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Trust Strip</CardTitle>
                <CardDescription>
                  The three benefit callouts (shipping, payment, returns).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {content.trust_strip.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md border p-3">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={item.title}
                        onChange={(e) => updateTrustItem(i, "title", e.target.value)}
                        placeholder="Free Shipping"
                      />
                      <Input
                        value={item.desc}
                        onChange={(e) => updateTrustItem(i, "desc", e.target.value)}
                        placeholder="Nationwide in Cambodia"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTrustItem(i)}
                      disabled={content.trust_strip.items.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addTrustItem}>
                  <Plus className="mr-2 h-4 w-4" /> Add item
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bottom CTA</CardTitle>
                <CardDescription>The call-to-action banner near the footer.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cta-heading">Heading</Label>
                  <Input
                    id="cta-heading"
                    value={content.cta.heading}
                    onChange={(e) => updateCta("heading", e.target.value)}
                    placeholder="Your new favorite fit is one tap away"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cta-subtext">Subtext</Label>
                  <textarea
                    id="cta-subtext"
                    value={content.cta.subtext}
                    onChange={(e) => updateCta("subtext", e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cta-button-label">Button label</Label>
                    <Input
                      id="cta-button-label"
                      value={content.cta.buttonLabel}
                      onChange={(e) => updateCta("buttonLabel", e.target.value)}
                      placeholder="Shop Now"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cta-button-link">Button link</Label>
                    <Input
                      id="cta-button-link"
                      value={content.cta.buttonLink}
                      onChange={(e) => updateCta("buttonLink", e.target.value)}
                      placeholder="/shop"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hero Banners (Dual Tiles)</CardTitle>
                <CardDescription>
                  The two side-by-side banners at the top of the homepage. Insert photos from your
                  device or paste image URLs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {content.dual_tiles.tiles.map((tile, i) => (
                  <div key={i} className="space-y-3 rounded-md border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Tile {i + 1}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`tile-${i}-eyebrow`}>Eyebrow</Label>
                        <Input
                          id={`tile-${i}-eyebrow`}
                          value={tile.eyebrow}
                          onChange={(e) => updateTile(i, "eyebrow", e.target.value)}
                          placeholder="SUMMER 26"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`tile-${i}-heading`}>Heading</Label>
                        <Input
                          id={`tile-${i}-heading`}
                          value={tile.heading}
                          onChange={(e) => updateTile(i, "heading", e.target.value)}
                          placeholder="A Return to Self"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor={`tile-${i}-subtext`}>Subtext</Label>
                        <Input
                          id={`tile-${i}-subtext`}
                          value={tile.subtext}
                          onChange={(e) => updateTile(i, "subtext", e.target.value)}
                          placeholder="Optional supporting line"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`tile-${i}-cta-label`}>CTA label</Label>
                        <Input
                          id={`tile-${i}-cta-label`}
                          value={tile.ctaLabel}
                          onChange={(e) => updateTile(i, "ctaLabel", e.target.value)}
                          placeholder="DISCOVER"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`tile-${i}-cta-link`}>CTA link</Label>
                        <Input
                          id={`tile-${i}-cta-link`}
                          value={tile.ctaLink}
                          onChange={(e) => updateTile(i, "ctaLink", e.target.value)}
                          placeholder="/shop"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`tile-${i}-cta-search`}>CTA search term (optional)</Label>
                        <Input
                          id={`tile-${i}-cta-search`}
                          value={tile.ctaSearch ?? ""}
                          onChange={(e) => updateTile(i, "ctaSearch", e.target.value)}
                          placeholder="New Arrivals"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <MediaField
                          label="Tile image"
                          kind="image"
                          value={tile.image}
                          onChange={(url) => updateTile(i, "image", url)}
                          hint="Insert a photo from your device, or paste any image URL."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Runway &amp; Beyond — Video Popup</CardTitle>
                <CardDescription>
                  The floating video card in the bottom-right corner. Click-to-play, like
                  bouguessa.com.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Show video popup</p>
                    <p className="text-xs text-muted-foreground">
                      Displays the floating card on storefront pages.
                    </p>
                  </div>
                  <Switch
                    checked={content.video_popup.enabled}
                    onCheckedChange={(checked) => toggleVideoPopup(checked)}
                    aria-label="Toggle video popup"
                  />
                </div>
                <MediaField
                  label="Video"
                  kind="video"
                  value={content.video_popup.videoUrl}
                  onChange={(url) => updateVideoPopup("videoUrl", url)}
                  hint="Insert a film from your device (mp4 / webm), or paste a video URL."
                />
                <MediaField
                  label="Poster image"
                  kind="image"
                  value={content.video_popup.posterUrl}
                  onChange={(url) => updateVideoPopup("posterUrl", url)}
                  hint="Shown on the floating card before the visitor presses play."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Footer</CardTitle>
                <CardDescription>
                  Brand blurb, contact details and social links in the footer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="footer-about">About text</Label>
                  <textarea
                    id="footer-about"
                    value={content.footer.about}
                    onChange={(e) => updateFooter("about", e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="footer-address">Address</Label>
                    <Input
                      id="footer-address"
                      value={content.footer.address}
                      onChange={(e) => updateFooter("address", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="footer-phone">Phone</Label>
                    <Input
                      id="footer-phone"
                      value={content.footer.phone}
                      onChange={(e) => updateFooter("phone", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="footer-email">Email</Label>
                    <Input
                      id="footer-email"
                      value={content.footer.email}
                      onChange={(e) => updateFooter("email", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Social links</Label>
                  {content.footer.socials.map((social, i) => (
                    <div key={i} className="grid grid-cols-2 gap-3">
                      <Input
                        value={social.label}
                        onChange={(e) => updateSocial(i, "label", e.target.value)}
                        placeholder="Instagram"
                        aria-label={`Social ${i + 1} label`}
                      />
                      <Input
                        value={social.href}
                        onChange={(e) => updateSocial(i, "href", e.target.value)}
                        placeholder="https://..."
                        aria-label={`Social ${i + 1} URL`}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {hasChanges && (
            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={handleReset} disabled={isSaving}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Discard Changes
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save All Changes"}
              </Button>
            </div>
          )}
        </main>
      </div>
    </RequireAdmin>
  );
}
