import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { uploadSiteMedia } from "@/lib/mediaUpload";
import { makeGarmentCutout } from "@/lib/garmentCutout";
import type { RailHeroContent, RailItemContent } from "@/lib/siteContent";

interface Props {
  value: RailHeroContent;
  onChange: (next: RailHeroContent) => void;
}

const MAX_ITEMS = 12;

function nameFromFile(file: File) {
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "New piece";
}

/** Admin card: insert clothing photos and they appear on the homepage clothing rail. */
export function RailHeroEditor({ value, onChange }: Props) {
  const addRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceIndex = useRef(-1);
  const [busy, setBusy] = useState(false);
  const [cutout, setCutout] = useState(true);

  const patch = (partial: Partial<RailHeroContent>) => onChange({ ...value, ...partial });
  const setItems = (items: RailItemContent[]) => patch({ items });
  const updateItem = (index: number, partial: Partial<RailItemContent>) =>
    setItems(value.items.map((item, i) => (i === index ? { ...item, ...partial } : item)));

  /** Cut out + upload one photo; returns its URL. */
  async function processFile(file: File) {
    const { file: prepared, removed } = await makeGarmentCutout(file, cutout);
    if (cutout && !removed) {
      toast.warning(`${file.name}: background is too busy to remove automatically, used as is.`);
    }
    return (await uploadSiteMedia(prepared)).url;
  }

  async function addFiles(files: File[]) {
    const room = MAX_ITEMS - value.items.length;
    const picked = files.filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, room));
    if (picked.length === 0) {
      toast.error(room <= 0 ? `The rail holds up to ${MAX_ITEMS} pieces.` : "Choose image files.");
      return;
    }
    setBusy(true);
    try {
      const added: RailItemContent[] = [];
      for (const file of picked) {
        const url = await processFile(file);
        added.push({
          id: `piece-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: nameFromFile(file),
          description: "",
          tag: "",
          image: url,
          kind: "tee",
          color: "#cccccc",
        });
      }
      setItems([...value.items, ...added]);
      toast.success(`${added.length} piece${added.length > 1 ? "s" : ""} added to the rail`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function replaceFile(file: File) {
    const index = replaceIndex.current;
    if (index < 0) return;
    setBusy(true);
    try {
      updateItem(index, { image: await processFile(file) });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Home Hero — Clothing Rail</CardTitle>
        <CardDescription>
          Insert photos of your clothes and they hang on the rail at the top of the homepage. Pieces
          without a photo show a drawn mock-up.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="rail-eyebrow">Eyebrow</Label>
            <Input id="rail-eyebrow" value={value.eyebrow} onChange={(e) => patch({ eyebrow: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rail-heading">Heading</Label>
            <Input id="rail-heading" value={value.heading} onChange={(e) => patch({ heading: e.target.value })} />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Remove photo background automatically</p>
            <p className="text-xs text-muted-foreground">
              Works best with one garment on a plain background, shot straight on.
            </p>
          </div>
          <Switch checked={cutout} onCheckedChange={setCutout} aria-label="Remove photo background" />
        </div>

        <div className="space-y-3">
          {value.items.map((item, i) => (
            <div key={item.id} className="flex items-start gap-3 rounded-md border p-3">
              <div className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-[repeating-conic-gradient(#e5e5e5_0%_25%,#fff_0%_50%)] bg-[length:12px_12px]">
                {item.image ? (
                  <img src={item.image} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="px-1 text-center text-[10px] text-muted-foreground">Drawn mock-up</span>
                )}
              </div>
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                <Input value={item.name} onChange={(e) => updateItem(i, { name: e.target.value })} placeholder="Name" aria-label={`Piece ${i + 1} name`} className="sm:col-span-2" />
                <Input value={item.tag} onChange={(e) => updateItem(i, { tag: e.target.value })} placeholder="Tag, e.g. $48" aria-label={`Piece ${i + 1} tag`} />
                <Input value={item.description} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder="Short description" aria-label={`Piece ${i + 1} description`} className="sm:col-span-3" />
                <div className="flex gap-2 sm:col-span-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => { replaceIndex.current = i; replaceRef.current?.click(); }}
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    {item.image ? "Replace photo" : "Add photo"}
                  </Button>
                  {item.image && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => updateItem(i, { image: "" })}>
                      Use mock-up
                    </Button>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove piece ${i + 1}`}
                disabled={value.items.length <= 1}
                onClick={() => setItems(value.items.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => addRef.current?.click()} disabled={busy || value.items.length >= MAX_ITEMS}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
            {busy ? "Preparing photos…" : "Insert clothing photos"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={value.items.length >= MAX_ITEMS}
            onClick={() =>
              setItems([
                ...value.items,
                { id: `piece-${Date.now()}`, name: "New piece", description: "", tag: "", image: "", kind: "tee", color: "#cccccc" },
              ])
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Add mock-up piece
          </Button>
          <span className="text-xs text-muted-foreground">
            {value.items.length} / {MAX_ITEMS} pieces
          </span>
        </div>

        <input
          ref={addRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length) void addFiles(files);
          }}
        />
        <input
          ref={replaceRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void replaceFile(file);
          }}
        />
      </CardContent>
    </Card>
  );
}
