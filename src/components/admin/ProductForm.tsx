import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { Product, ProductInput } from "@/lib/productStore";

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-generate handle from title when creating a new product
  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!initial && (!handle || handle === slugify(title))) {
      setHandle(slugify(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const priceNumber = Number.parseFloat(price);
    if (Number.isNaN(priceNumber) || priceNumber < 0) {
      return;
    }

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
        collections: collectionsText
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
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
              placeholder="Classic Cotton T-Shirt"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="handle">URL handle</Label>
            <Input
              id="handle"
              value={handle}
              onChange={(e) => setHandle(slugify(e.target.value))}
              placeholder="classic-cotton-t-shirt"
              required
            />
            <p className="text-xs text-muted-foreground">
              The product will be available at /product/{handle || "your-handle"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Premium 100% organic cotton..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productType">Product type</Label>
            <Input
              id="productType"
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              placeholder="Apparel"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="24.99"
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Image</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input
              id="imageUrl"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://res.cloudinary.com/your-cloud/..."
            />
            <p className="text-xs text-muted-foreground">
              Paste a Cloudinary URL or any public image URL.
            </p>
          </div>

          {imageUrl && (
            <div className="rounded-md border bg-muted p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>
              <img
                src={imageUrl}
                alt="Product preview"
                className="h-40 w-40 rounded-md object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
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
              placeholder="Featured, New Arrivals, Apparel"
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
