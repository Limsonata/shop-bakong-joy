import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadSiteMedia } from "@/lib/mediaUpload";

interface MediaFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  /** "image" (default) or "video" — controls the preview and accepted files. */
  kind?: "image" | "video";
  hint?: string;
}

/**
 * Reusable "insert media" field for the admin Content page.
 *
 * Shows a live preview of the current image/video, lets the admin insert a
 * file straight from their device (uploaded to the site-media bucket), or
 * paste any external URL. Replaces raw URL-only inputs.
 */
export function MediaField({ label, value, onChange, kind = "image", hint }: MediaFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const accept = kind === "video" ? "video/mp4,video/webm,video/quicktime" : "image/*";

  async function handleFile(file: File) {
    setIsUploading(true);
    try {
      const { url, stored } = await uploadSiteMedia(file);
      onChange(url);
      toast.success(
        stored === "cloudinary"
          ? "Uploaded to Cloudinary"
          : stored === "supabase"
            ? "Uploaded to the media library"
            : "Media attached (saved in this browser — connect Cloudinary to share it)",
      );
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {value ? (
        <div className="flex items-start gap-3 rounded-md border p-2">
          {kind === "video" ? (
            <video
              src={value}
              controls
              preload="metadata"
              className="h-24 w-32 shrink-0 rounded bg-neutral-100 object-cover"
            />
          ) : (
            <img
              src={value}
              alt=""
              className="h-24 w-32 shrink-0 rounded bg-neutral-100 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.opacity = "0.3";
              }}
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://..."
              className="h-8 text-xs"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                )}
                Replace
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-md
              border-2 border-dashed border-border text-muted-foreground transition-colors
              hover:border-foreground hover:text-foreground"
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
            <span className="text-xs">
              {isUploading ? "Uploading…" : `Insert ${kind} from device`}
            </span>
          </button>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Or paste a ${kind} URL…`}
            className="h-8 text-xs"
          />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
