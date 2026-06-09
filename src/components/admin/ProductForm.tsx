import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import type { Product, ProductInput, ProductVariantInput } from "@/lib/productStore";

interface Props {
  initial?: Product;
  onSubmit: (input: ProductInput) => Promise<void>;
  submitLabel: string;
}

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
  const [currency, setCurrency] = useState(initial?.price.currencyCode ?? "USD");
  const [imageUrl, setImageUrl] = useState(initial?.images[0]?.url ?? "");
  const [inStock, setInStock] = useState(initial?.variants[0]?.availableForSale ?? true);
  const [collectionsText, setCollectionsText] = useState((initial?.collections ?? []).join(", "));
  const [variants, setVariants] = useState<ProductVariantInput[]>(initialVariants(initial));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!initial && (!handle || handle === slugify(title))) {
      setHandle(slugify(value));
    }
  };

  const addVariant = () => {
    setVariants([...variants, { title: "", option: "Size", price: Number(price) || 0, availableForSale: true }]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof ProductVariantInput, value: string | number | boolean) => {
    setVariants(variants.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const priceNumber = Number.parseFloat(price);
    if (Number.isNaN(priceNumber) || priceNumber < 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        handle: handle || slugify(title),
        title,
        description,
        productType,
        price: priceNumber,
        currency,
        imageUrl,
        inStock,
        collections: collectionsText.split(",").map((c) => c.trim()).filter(Boolean),
        variants,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Basic information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Hair Spray" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="handle">URL handle</Label>
            <Input id="handle" value={handle} onChange={(e) => setHandle(slugify(e.target.value))} placeholder="hair-spray" required />
            <p className="text-xs text-muted-foreground">The product will be available at /product/{handle || "your-handle"}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Product description..." rows={4} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="productType">Product type</Label>
            <Input id="productType" value={productType} onChange={(e) => setProductType(e.target.value)} placeholder="Shampoo" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Base price</Label>
              <Input id="price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="9.99" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} placeholder="USD" maxLength={3} />
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
            <p className="text-sm text-muted-foreground">No variants — product has one default option. Click "Add Variant" to add sizes or colors.</p>
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
                <Input placeholder={v.option === "Size" ? "Small / Medium / Large" : "Red / Blue"} value={v.title} onChange={(e) => updateVariant(i, "title", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Price</Label>
                <Input type="number" min="0" step="0.01" value={v.price} onChange={(e) => updateVariant(i, "price", Number(e.target.value))} />
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => removeVariant(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Image</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input id="imageUrl" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            <p className="text-xs text-muted-foreground">Paste a Cloudinary URL or any public image URL.</p>
          </div>
          {imageUrl && (
            <div className="rounded-md border bg-muted p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>
              <img src={imageUrl} alt="Product preview" className="h-40 w-40 rounded-md object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Organization</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collections">Collections</Label>
            <Input id="collections" value={collectionsText} onChange={(e) => setCollectionsText(e.target.value)} placeholder="Hair Spray, Featured" />
            <p className="text-xs text-muted-foreground">Comma-separated list.</p>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="inStock" className="cursor-pointer">Available for sale</Label>
              <p className="text-xs text-muted-foreground">Show this product as in stock on the storefront.</p>
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
