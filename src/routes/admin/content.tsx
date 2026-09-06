import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save, RefreshCw, Check, Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
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
      const sections: Array<keyof SiteContent> = ["hero", "marquee", "trust_strip", "cta"];
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

  const updateHero = (field: keyof SiteContent["hero"], value: string) =>
    setContent((prev) => ({ ...prev, hero: { ...prev.hero, [field]: value } }));

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
                <CardTitle>Hero Section</CardTitle>
                <CardDescription>The big banner at the top of the homepage.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="hero-badge">Badge text</Label>
                  <Input
                    id="hero-badge"
                    value={content.hero.badge}
                    onChange={(e) => updateHero("badge", e.target.value)}
                    placeholder="Made for her"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hero-line1">Heading — line 1</Label>
                    <Input
                      id="hero-line1"
                      value={content.hero.headingLine1}
                      onChange={(e) => updateHero("headingLine1", e.target.value)}
                      placeholder="Move."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hero-line2">Heading — line 2 (accent color)</Label>
                    <Input
                      id="hero-line2"
                      value={content.hero.headingLine2}
                      onChange={(e) => updateHero("headingLine2", e.target.value)}
                      placeholder="Look good doing it."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hero-subtext">Subtext</Label>
                  <textarea
                    id="hero-subtext"
                    value={content.hero.subtext}
                    onChange={(e) => updateHero("subtext", e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hero-bg">Background image URL</Label>
                  <Input
                    id="hero-bg"
                    value={content.hero.backgroundImage}
                    onChange={(e) => updateHero("backgroundImage", e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hero-primary-label">Primary button label</Label>
                    <Input
                      id="hero-primary-label"
                      value={content.hero.primaryButtonLabel}
                      onChange={(e) => updateHero("primaryButtonLabel", e.target.value)}
                      placeholder="Shop Now"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hero-primary-link">Primary button link</Label>
                    <Input
                      id="hero-primary-link"
                      value={content.hero.primaryButtonLink}
                      onChange={(e) => updateHero("primaryButtonLink", e.target.value)}
                      placeholder="/shop"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hero-secondary-label">Secondary button label</Label>
                    <Input
                      id="hero-secondary-label"
                      value={content.hero.secondaryButtonLabel}
                      onChange={(e) => updateHero("secondaryButtonLabel", e.target.value)}
                      placeholder="New Arrivals"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hero-secondary-search">Secondary button search term</Label>
                    <Input
                      id="hero-secondary-search"
                      value={content.hero.secondaryButtonSearch}
                      onChange={(e) => updateHero("secondaryButtonSearch", e.target.value)}
                      placeholder="New Arrivals"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

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
