import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  RefreshCw,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RequireAdmin } from "@/components/admin/RequireAdmin";

interface StoreSettings {
  storeName: string;
  storeEmail: string;
  storePhone: string;
  storeAddress: string;
  currency: string;
}

const SETTINGS_STORAGE_KEY = "shop-settings";

function loadSettings(): StoreSettings {
  if (typeof window === "undefined") {
    return {
      storeName: "BillieGrace Closet",
      storeEmail: "",
      storePhone: "",
      storeAddress: "",
      currency: "USD",
    };
  }
  const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fall through
    }
  }
  return {
    storeName: "BillieGrace Closet",
    storeEmail: "",
    storePhone: "",
    storeAddress: "",
    currency: "USD",
  };
}

function saveSettings(settings: StoreSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Settings - Admin" }] }),
  component: SettingsAdmin,
});

function SettingsAdmin() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    storeName: "BillieGrace Closet",
    storeEmail: "",
    storePhone: "",
    storeAddress: "",
    currency: "USD",
  });

  const [originalStoreSettings, setOriginalStoreSettings] = useState<StoreSettings>(storeSettings);

  useEffect(() => {
    const settings = loadSettings();
    setStoreSettings(settings);
    setOriginalStoreSettings(settings);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const storeChanged = JSON.stringify(storeSettings) !== JSON.stringify(originalStoreSettings);
    setHasChanges(storeChanged);
  }, [storeSettings, originalStoreSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      saveSettings(storeSettings);
      setOriginalStoreSettings(storeSettings);
      setHasChanges(false);
      setShowSuccess(true);
      toast.success("Settings saved successfully");
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      toast.error("Failed to save settings");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setStoreSettings(originalStoreSettings);
    setHasChanges(false);
    toast.info("Changes discarded");
  };

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
                <h1 className="text-xl font-semibold">Settings</h1>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
            <p className="text-muted-foreground">Loading settings...</p>
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
              <h1 className="text-xl font-semibold">Settings</h1>
            </div>
            <div className="flex items-center gap-2">
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
          {showSuccess && (
            <Alert className="mb-6 border-green-500/50 bg-green-500/10">
              <Check className="h-4 w-4 text-green-600" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>Your settings have been saved successfully.</AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Store Information</CardTitle>
                <CardDescription>
                  Basic information about your store that customers will see.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="storeName">Store Name</Label>
                  <Input
                    id="storeName"
                    value={storeSettings.storeName}
                    onChange={(e) =>
                      setStoreSettings((prev) => ({ ...prev, storeName: e.target.value }))
                    }
                    placeholder="Your Store Name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storeEmail">Store Email</Label>
                  <Input
                    id="storeEmail"
                    type="email"
                    value={storeSettings.storeEmail}
                    onChange={(e) =>
                      setStoreSettings((prev) => ({ ...prev, storeEmail: e.target.value }))
                    }
                    placeholder="contact@yourstore.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storePhone">Store Phone</Label>
                  <Input
                    id="storePhone"
                    value={storeSettings.storePhone}
                    onChange={(e) =>
                      setStoreSettings((prev) => ({ ...prev, storePhone: e.target.value }))
                    }
                    placeholder="+855 12 345 678"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storeAddress">Store Address</Label>
                  <textarea
                    id="storeAddress"
                    value={storeSettings.storeAddress}
                    onChange={(e) =>
                      setStoreSettings((prev) => ({ ...prev, storeAddress: e.target.value }))
                    }
                    placeholder="123 Main Street, Phnom Penh, Cambodia"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Currency Settings</CardTitle>
                <CardDescription>Default currency for your store prices.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Default Currency</Label>
                  <select
                    id="currency"
                    value={storeSettings.currency}
                    onChange={(e) =>
                      setStoreSettings((prev) => ({ ...prev, currency: e.target.value }))
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="KHR">KHR - Cambodian Riel</option>
                    <option value="THB">THB - Thai Baht</option>
                    <option value="VND">VND - Vietnamese Dong</option>
                    <option value="SGD">SGD - Singapore Dollar</option>
                  </select>
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
