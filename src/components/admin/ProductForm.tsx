import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Upload, X } from "lucide-react";
import {
  getProductTypes,
  type Product,
  type ProductInput,
  type ProductVariantInput,
} from "@/lib/productStore";

interface Props {
  initial?: Product;
  onSubmit: (input: ProductInput) => Promise<void>;
  submitLabel: string;
}

/** Defaults so the select is never empty, even before the DB list loads. */
const CATEGORY_SUGGESTIONS = ["Bra & Lingerie", "Underwear", "Tops", "Jeans", "Other"];
/** Sentinel value for the "type a new category" option in the select. */
const NEW_CATEGORY = "__new_category__";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function initialVariants(product?: Product): ProductVariantInput[] {
  if (!product) return [];
  return product.variants
    .filter((v) => v.selectedOptions.length > 0)
    .map((v) => ({
      title: v.selectedOptions[0].value,
      option: v.selectedOptions[0].name,
      price: Number(v.price.amount),
      availableForSale: v.availableForSale,
    }));
}

export function ProductForm({ initial, onSubmit, submitLabel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [handle, setHandle] = useState(initial?.handle ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [productType, setProductType] = useState(initial?.productType ?? "");
  const [price, setPrice] = useState(initial?.price.amount ?? "");
  const [cost, setCost] = useState("");
  const [startingStock, setStartingStock] = useState("");
  const [currency, setCurrency] = useState(initial?.price.currencyCode ?? "USD");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [images, setImages] = useState<string[]>(initial?.images.map((img) => img.url) ?? []);
  const [inStock, setInStock] = useState(initial?.variants[0]?.availableForSale ?? true);
  const [collectionsText, setCollectionsText] = useState((initial?.collections ?? []).join(", "));
  const [variants, setVariants] = useState<ProductVariantInput[]>(initialVariants(initial));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [categories, setCategories] = useState<string[]>(CATEGORY_SUGGESTIONS);
  const [isCustomType, setIsCustomType] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    // Existing categories from the database; fall back to suggestions on error
    // so the form always works (e.g. if the products table is unreachable).
    getProductTypes()
      .catch(() => [] as string[])
      .then((types) => {
        if (cancelled) return;
        const merged = Array.from(new Set([...CATEGORY_SUGGESTIONS, ...types])).sort();
        setCategories(merged);
        // Editing a product whose category isn't in the list → keep its value in a text box.
        if (productType && !merged.includes(productType)) setIsCustomType(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    let pending = files.length;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        setImages((prev) => [...prev, url]);
        pending -= 1;
        if (pending === 0) setIsUploading(false);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const makeMainImage = (index: number) => {
    setImages((prev) => {
      if (index === 0) return prev;
      const next = [...prev];
      const [img] = next.splice(index, 1);
      return [img, ...next];
    });
  };

  const addImageUrl = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    setImages((prev) => [...prev, url]);
    setImageUrlInput("");
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!initial && (!handle || handle === slugify(title))) {
      setHandle(slugify(value));
    }
  };

  const addVariant = () => {
    setVariants([
      ...variants,
      { title: "", option: "Size", price: Number(price) || 0, availableForSale: true },
    ]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (
    index: number,
    field: keyof ProductVariantInput,
    value: string | number | boolean,
  ) => {
    setVariants(variants.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const priceNumber = Number.parseFloat(price);
    if (Number.isNaN(priceNumber) || priceNumber < 0) return;

    setIsSubmitting(true);
    try {
      const costNumber = Number.parseFloat(cost);
      const stockNumber = Number.parseInt(startingStock, 10);
      await onSubmit({
        handle: handle || slugify(title),
        title,
        description,
        productType,
        price: priceNumber,
        currency,
        imageUrl: images[0] ?? "",
        images,
        inStock,
        collections: collectionsText
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        variants,
        ...(Number.isFinite(costNumber) && costNumber >= 0 ? { cost: costNumber } : {}),
        ...(Number.isFinite(stockNumber) && stockNumber > 0 ? { stockIn: stockNumber } : {}),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Hair Spray"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="handle">URL handle</Label>
            <Input
              id="handle"
              value={handle}
              onChange={(e) => setHandle(slugify(e.target.value))}
              placeholder="hair-spray"
              required
            />
            <p className="text-xs text-muted-foreground">
              Managed for you — kept in sync with the Stock page.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Product description..."
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="productType">Category</Label>
            {isCustomType ? (
              <div className="flex gap-2">
                <Input
                  id="productType"
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  placeholder="Type a new category, e.g. Skincare"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCustomType(false);
                    setProductType("");
                  }}
                >
                  List
                </Button>
              </div>
            ) : (
              <Select
                value={productType || undefined}
                onValueChange={(value) => {
                  if (value === NEW_CATEGORY) {
                    setIsCustomType(true);
                    setProductType("");
                  } else {
                    setProductType(value);
                  }
                }}
              >
                <SelectTrigger id="productType">
                  <SelectValue placeholder="Select a category…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_CATEGORY}>Other — type my own…</SelectItem>
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Pick an existing category, or choose &quot;Other — type my own…&quot; to create a new
              one.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Base price</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="9.99"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="USD"
                maxLength={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Cost per unit (optional)</Label>
              <Input
                id="cost"
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                What you pay your supplier — used for profit reports in the Stock page.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startingStock">Starting stock (optional)</Label>
              <Input
                id="startingStock"
                type="number"
                min="0"
                step="1"
                value={startingStock}
                onChange={(e) => setStartingStock(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Units on the shelf right now. With sizes/colours this goes to the first one —
                restock the rest in Stock.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Variants (Size / Color)</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={addVariant}>
              <Plus className="h-4 w-4 mr-1" /> Add Variant
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {variants.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No variants — product has one default option. Click "Add Variant" to add sizes or
              colors.
            </p>
          )}
          {variants.map((v, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-4 items-end border rounded-md p-3">
              <div className="space-y-1">
                <Label className="text-xs">Option type</Label>
                <select
                  value={v.option}
                  onChange={(e) => updateVariant(i, "option", e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="Size">Size</option>
                  <option value="Color">Color</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Value</Label>
                <Input
                  placeholder={v.option === "Size" ? "Small / Medium / Large" : "Red / Blue"}
                  value={v.title}
                  onChange={(e) => updateVariant(i, "title", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={v.price}
                  onChange={(e) => updateVariant(i, "price", Number(e.target.value))}
                />
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => removeVariant(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Photos</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="mr-1 h-4 w-4" /> Add photos
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {images.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Upload className="h-8 w-8" />
              <span className="text-sm font-medium">Choose photos from device</span>
              <span className="text-xs">PNG, JPG, WEBP — pick several at once</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((url, i) => (
                <div key={`${i}-${url.slice(-20)}`} className="relative">
                  <img
                    src={url}
                    alt={`Product photo ${i + 1}`}
                    className={`h-32 w-full cursor-pointer rounded-xl border object-cover ${
                      i === 0 ? "ring-2 ring-foreground" : ""
                    }`}
                    onClick={() => makeMainImage(i)}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.opacity = "0.3";
                    }}
                  />
                  {i === 0 && (
                    <span className="absolute top-2 left-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
                      Main
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    aria-label="Remove photo"
                    className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {images.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Click a photo to make it the main one. The main photo shows on the shop grid; the
              product page scrolls through all of them automatically.
            </p>
          )}

          {isUploading && <p className="text-xs text-muted-foreground">Loading photos...</p>}

          <div className="flex gap-2">
            <Input
              id="imageUrl"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addImageUrl();
                }
              }}
              placeholder="Or paste an image URL…"
            />
            <Button
              type="button"
              variant="outline"
              onClick={addImageUrl}
              disabled={!imageUrlInput.trim()}
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collections">Collections</Label>
            <Input
              id="collections"
              value={collectionsText}
              onChange={(e) => setCollectionsText(e.target.value)}
              placeholder="Hair Spray, Featured"
            />
            <p className="text-xs text-muted-foreground">Comma-separated list.</p>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="inStock" className="cursor-pointer">
                Available for sale
              </Label>
              <p className="text-xs text-muted-foreground">
                Show this product as in stock on the storefront.
              </p>
            </div>
            <Switch id="inStock" checked={inStock} onCheckedChange={setInStock} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
