import { supabase, isSupabaseConfigured } from "./supabase";

/** Storage bucket used for site content media (see the site-media migration). */
const BUCKET = "site-media";
/** Cap for the inline base64 fallback (no Cloudinary, no Supabase). */
const MAX_INLINE_BYTES = 20 * 1024 * 1024;

// ── Cloudinary (preferred when configured) ─────────────────────────────
// Set VITE_CLOUDINARY_CLOUD_NAME + VITE_CLOUDINARY_UPLOAD_PRESET in .env.local
// to store media on Cloudinary instead of the database/Supabase.
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;
const isCloudinaryConfigured = Boolean(CLOUD_NAME && UPLOAD_PRESET);

export interface SiteMediaUpload {
  url: string;
  stored: "cloudinary" | "supabase" | "inline";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

function safePath(file: File): string {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  return `site/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}

/**
 * Upload to Cloudinary using an unsigned preset (no secret keys in the
 * browser). Returns the optimized URL: images get q_auto/f_auto applied so
 * they are served compressed and in modern formats automatically.
 */
async function uploadToCloudinary(file: File): Promise<string> {
  const isVideo = file.type.startsWith("video/");
  const resourceType = isVideo ? "video" : "image";

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET!);
  form.append("folder", "billiegrace-site");

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(err?.error?.message ?? `Cloudinary upload failed (${res.status})`);
  }

  const data = (await res.json()) as { secure_url: string };
  // Insert light optimization params into the URL for images:
  // .../upload/w_1200,q_auto,f_auto/... — Cloudinary applies them on delivery.
  if (!isVideo && data.secure_url.includes("/upload/")) {
    return data.secure_url.replace("/upload/", "/upload/w_1200,q_auto,f_auto/");
  }
  return data.secure_url;
}

/**
 * Upload an image or video chosen from the admin's device.
 *
 * Priority:
 * 1. Cloudinary (when VITE_CLOUDINARY_CLOUD_NAME + UPLOAD_PRESET are set) —
 *    media lives on Cloudinary's CDN, only the URL is saved in site content.
 * 2. Supabase Storage — uploaded to the public "site-media" bucket.
 * 3. Inline base64 data URL — saved with the site content in this browser only.
 */
export async function uploadSiteMedia(file: File): Promise<SiteMediaUpload> {
  if (isCloudinaryConfigured) {
    return { url: await uploadToCloudinary(file), stored: "cloudinary" };
  }

  if (isSupabaseConfigured && supabase) {
    const path = safePath(file);
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      throw new Error(
        `Upload failed: ${error.message}. If this is the first upload, run the site-media storage migration.`,
      );
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, stored: "supabase" };
  }

  if (file.size > MAX_INLINE_BYTES) {
    throw new Error(
      "File is too large (max 20 MB in offline mode). Connect Cloudinary or Supabase for larger uploads.",
    );
  }
  return { url: await fileToDataUrl(file), stored: "inline" };
}
