import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRiel, loadShopSettings, saveShopSettings } from "@/lib/shopSettings";

/** Riel exchange rate printed on receipts next to the dollar amounts. */
export function ExchangeRateCard() {
  const [rate, setRate] = useState("");
  const [saved, setSaved] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadShopSettings().then((settings) => {
      setRate(String(settings.khrRate));
      setSaved(settings.khrRate);
    });
  }, []);

  const value = Number(rate);
  const valid = rate.trim() !== "" && Number.isFinite(value) && value >= 0 && value <= 100000;

  const save = async () => {
    if (!valid) return toast.error("Enter the number of riel for one US dollar, e.g. 4100");
    setSaving(true);
    try {
      const settings = await saveShopSettings({ khrRate: value });
      setSaved(settings.khrRate);
      toast.success(
        settings.khrRate > 0
          ? `Receipts now show riel at ៛${settings.khrRate.toLocaleString("en-US")} per $1`
          : "Riel is hidden on receipts",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Riel on receipts</CardTitle>
        <CardDescription>
          Receipts show the total in US dollars and in riel. Set the rate you use at the till; 0
          hides riel.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="khr-rate">Riel per US$1</Label>
          <Input
            id="khr-rate"
            type="number"
            inputMode="numeric"
            min="0"
            step="10"
            className="w-40"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </div>
        <Button onClick={save} disabled={saving || !valid || value === saved}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save rate"}
        </Button>
        {valid && value > 0 ? (
          <p className="w-full text-sm text-muted-foreground">
            Example: $12.50 prints as {formatRiel(12.5, value)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
