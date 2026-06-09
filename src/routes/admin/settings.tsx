import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Store,
  CreditCard,
  Globe,
  RefreshCw,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RequireAdmin } from "@/components/admin/RequireAdmin";

interface StoreSettings {
  storeName: string;
  storeEmail: string;
  storePhone: string;
  storeAddress: string;
  currency: string;
}

interface BakongSettings {
  merchantName: string;
  merchantAccount: string;
  merchantCity: string;
  currency: string;
  enabled: boolean;
}

const SETTINGS_STORAGE_KEY = "shop-settings";
const BAKONG_SETTINGS_KEY = "bakong-settings";

function loadSettings(): StoreSettings {
  if (typeof window === "undefined") {
    return {
      storeName: "Shop Bakong Joy",
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
    storeName: "Shop Bakong Joy",
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

function loadBakongSettings(): BakongSettings {
  const envName = import.meta.env.VITE_BAKONG_MERCHANT_NAME || "Shop Bakong Joy";
  const envAccount = import.meta.env.VITE_BAKONG_MERCHANT_ACCOUNT || "";
  const envCity = import.meta.env.VITE_BAKONG_MERCHANT_CITY || "Phnom Penh";
  const envCurrency = import.meta.env.VITE_BAKONG_CURRENCY || "USD";

  if (typeof window === "undefined") {
    return {
      merchantName: envName,
      merchantAccount: envAccount,
      merchantCity: envCity,
      currency: envCurrency,
      enabled: !!envAccount,
    };
  }

  const stored = localStorage.getItem(BAKONG_SETTINGS_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        merchantName: parsed.merchantName || envName,
        merchantAccount: parsed.merchantAccount || envAccount,
        merchantCity: parsed.merchantCity || envCity,
        currency: parsed.currency || envCurrency,
        enabled: parsed.enabled ?? !!envAccount,
      };
    } catch {
      // fall through
    }
  }

  return {
    merchantName: envName,
    merchantAccount: envAccount,
    merchantCity: envCity,
    currency: envCurrency,
    enabled: !!envAccount,
  };
}

function saveBakongSettings(settings: BakongSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BAKONG_SETTINGS_KEY, JSON.stringify(settings));
}

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Settings - Admin" }] }),
  component: SettingsAdmin,
});

function SettingsAdmin() {
  const [activeTab, setActiveTab] = useState("general");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    storeName: "Shop Bakong Joy",
    storeEmail: "",
    storePhone: "",
    storeAddress: "",
    currency: "USD",
  });

  const [bakongSettings, setBakongSettings] = useState<BakongSettings>({
    merchantName: "Shop Bakong Joy",
    merchantAccount: "",
    merchantCity: "Phnom Penh",
    currency: "USD",
    enabled: false,
  });

  const [originalStoreSettings, setOriginalStoreSettings] = useState<StoreSettings>(storeSettings);
  const [originalBakongSettings, setOriginalBakongSettings] =
    useState<BakongSettings>(bakongSettings);

  useEffect(() => {
    const settings = loadSettings();
    const bakong = loadBakongSettings();
    setStoreSettings(settings);
    setOriginalStoreSettings(settings);
    setBakongSettings(bakong);
    setOriginalBakongSettings(bakong);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const storeChanged = JSON.stringify(storeSettings) !== JSON.stringify(originalStoreSettings);
    const bakongChanged = JSON.stringify(bakongSettings) !== JSON.stringify(originalBakongSettings);
    setHasChanges(storeChanged || bakongChanged);
  }, [storeSettings, bakongSettings, originalStoreSettings, originalBakongSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      saveSettings(storeSettings);
      saveBakongSettings(bakongSettings);
      setOriginalStoreSettings(storeSettings);
      setOriginalBakongSettings(bakongSettings);
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
    setBakongSettings(originalBakongSettings);
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

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="general">
                <Store className="mr-2 h-4 w-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="payment">
                <CreditCard className="mr-2 h-4 w-4" />
                Payment
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
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
            </TabsContent>

            <TabsContent value="payment" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Bakong Payment</CardTitle>
                  <CardDescription>Configure Bakong KHQR payment for your store.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Important</AlertTitle>
                    <AlertDescription>
                      These settings are stored locally in your browser. For production use, you
                      should configure these in your environment variables (.env file).
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="merchantName">Merchant Name</Label>
                    <Input
                      id="merchantName"
                      value={bakongSettings.merchantName}
                      onChange={(e) =>
                        setBakongSettings((prev) => ({ ...prev, merchantName: e.target.value }))
                      }
                      placeholder="Your Business Name"
                    />
                    <p className="text-xs text-muted-foreground">
                      This name will appear on the Bakong QR code.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="merchantAccount">
                      Bakong Account <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="merchantAccount"
                      value={bakongSettings.merchantAccount}
                      onChange={(e) =>
                        setBakongSettings((prev) => ({
                          ...prev,
                          merchantAccount: e.target.value,
                          enabled: !!e.target.value.trim(),
                        }))
                      }
                      placeholder="yourname@bank"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your Bakong ID (e.g., username@bkrt for Bakong).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="merchantCity">Merchant City</Label>
                    <Input
                      id="merchantCity"
                      value={bakongSettings.merchantCity}
                      onChange={(e) =>
                        setBakongSettings((prev) => ({ ...prev, merchantCity: e.target.value }))
                      }
                      placeholder="Phnom Penh"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bakongCurrency">Payment Currency</Label>
                    <select
                      id="bakongCurrency"
                      value={bakongSettings.currency}
                      onChange={(e) =>
                        setBakongSettings((prev) => ({ ...prev, currency: e.target.value }))
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="KHR">KHR - Cambodian Riel</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Bakong supports USD and KHR currencies.
                    </p>
                  </div>

                  <div className="rounded-md border bg-muted/50 p-4">
                    <h4 className="mb-2 text-sm font-medium">Current Configuration</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <span
                          className={bakongSettings.enabled ? "text-green-600" : "text-yellow-600"}
                        >
                          {bakongSettings.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Merchant:</span>
                        <span>{bakongSettings.merchantName || "Not set"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account:</span>
                        <span>{bakongSettings.merchantAccount || "Not set"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">City:</span>
                        <span>{bakongSettings.merchantCity || "Not set"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Currency:</span>
                        <span>{bakongSettings.currency}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Environment Configuration</CardTitle>
                  <CardDescription>
                    Current environment variables (read-only from .env file).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border bg-muted/30 p-4 font-mono text-xs">
                    <div className="space-y-2">
                      <div>
                        <span className="text-muted-foreground">VITE_BAKONG_MERCHANT_NAME=</span>
                        <span>{import.meta.env.VITE_BAKONG_MERCHANT_NAME || "(not set)"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">VITE_BAKONG_MERCHANT_ACCOUNT=</span>
                        <span>{import.meta.env.VITE_BAKONG_MERCHANT_ACCOUNT || "(not set)"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">VITE_BAKONG_MERCHANT_CITY=</span>
                        <span>{import.meta.env.VITE_BAKONG_MERCHANT_CITY || "(not set)"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">VITE_BAKONG_CURRENCY=</span>
                        <span>{import.meta.env.VITE_BAKONG_CURRENCY || "(not set)"}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    To update these permanently, edit your .env file and restart the server.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

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
