import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { Loader2, MapPin, Navigation, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const PHNOM_PENH: [number, number] = [11.5564, 104.9282];

interface Props {
  address: string;
  onAddressChange: (address: string) => void;
  lat: number;
  lng: number;
  onPinChange: (lat: number, lng: number) => void;
  disabled?: boolean;
}

/**
 * Delivery address textarea plus an OpenStreetMap pin picker (no API key needed).
 * The customer types the address, then can search it on the map, tap the map,
 * drag the pin, or use their current location.
 */
export function OsmLocationPicker({
  address,
  onAddressChange,
  lat,
  lng,
  onPinChange,
  disabled,
}: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const pinCb = useRef(onPinChange);
  pinCb.current = onPinChange;
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<"search" | "locate" | null>(null);

  const placePin = useCallback((la: number, ln: number, zoom?: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) markerRef.current.setLatLng([la, ln]);
    map.setView([la, ln], zoom ?? Math.max(map.getZoom(), 16));
    pinCb.current(la, ln);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | undefined;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !mapEl.current) return;

      map = L.map(mapEl.current).setView(PHNOM_PENH, 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Draw the pin with a DivIcon so we don't depend on Leaflet's bundled image URLs.
      const icon = L.divIcon({
        className: "",
        html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#e11d48;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:rotate(-45deg)"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
      const marker = L.marker(PHNOM_PENH, { icon, draggable: !disabled }).addTo(map);
      mapRef.current = map;
      markerRef.current = marker;

      if (!disabled) {
        map.on("click", (e) => {
          marker.setLatLng(e.latlng);
          pinCb.current(e.latlng.lat, e.latlng.lng);
        });
        marker.on("dragend", () => {
          const p = marker.getLatLng();
          pinCb.current(p.lat, p.lng);
        });
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [disabled]);

  // Restore the pin if the map is rebuilt while coordinates already exist.
  useEffect(() => {
    if (ready && lat && lng && markerRef.current) markerRef.current.setLatLng([lat, lng]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const findAddress = async () => {
    const query = address.trim();
    if (!query) {
      toast.error("Enter your delivery address first");
      return;
    }
    setBusy("search");
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kh&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const results = (await res.json()) as { lat: string; lon: string }[];
      if (!results.length) {
        toast.error("Couldn't find that address. Tap the map to place the pin.");
        return;
      }
      placePin(Number(results[0].lat), Number(results[0].lon), 17);
    } catch {
      toast.error("Address search failed. Tap the map to place the pin.");
    } finally {
      setBusy(null);
    }
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setBusy("locate");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        placePin(pos.coords.latitude, pos.coords.longitude, 17);
        setBusy(null);
      },
      (err) => {
        setBusy(null);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Location access denied. Allow location in your browser settings."
            : "Unable to get your location. Tap the map instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-3">
      <textarea
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
        placeholder="Enter your full delivery address (street, house no., district)"
        disabled={disabled}
        required
        rows={3}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !ready || busy !== null}
          onClick={findAddress}
        >
          {busy === "search" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Find address on map
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !ready || busy !== null}
          onClick={locateMe}
        >
          {busy === "locate" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="mr-2 h-4 w-4" />
          )}
          Use my current location
        </Button>
      </div>

      <div
        ref={mapEl}
        className="relative z-0 h-64 w-full overflow-hidden rounded-md border"
      />
      {!ready ? (
        <p className="text-xs text-muted-foreground">Loading map…</p>
      ) : (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {lat && lng
            ? `Pin set at ${lat.toFixed(5)}, ${lng.toFixed(5)}. Drag it to adjust.`
            : "Tap the map or drag the pin to mark your exact delivery spot."}
        </p>
      )}
    </div>
  );
}
