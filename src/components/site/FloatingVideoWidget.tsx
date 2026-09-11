import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Play, X } from "lucide-react";
import { getSiteContent } from "@/lib/siteContent";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "billiegrace-video-popup-dismissed";

/**
 * "Runway & Beyond" floating film card.
 *
 * Mirrors the bouguessa.com video widget: a small rounded card pinned to the
 * bottom-right corner shows a poster frame with a circular play button.
 * Clicking plays the film inline (with sound, native controls), and the ✕
 * dismisses the card for the rest of the browser session.
 */
export function FloatingVideoWidget() {
  const { data: siteContent } = useQuery({
    queryKey: ["site-content"],
    queryFn: () => getSiteContent(),
  });
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const popup = siteContent?.video_popup;
  if (!popup?.enabled || !popup.videoUrl || dismissed) return null;

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  };

  const handlePause = () => {
    setPlaying(false);
    if (videoRef.current) videoRef.current.controls = false;
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage unavailable (private mode) — dismissing for this visit is enough.
    }
  };

  return (
    <motion.aside
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 1, ease: [0.23, 1, 0.32, 1] }}
      className="fixed bottom-5 right-5 z-40 hidden w-[17rem] overflow-hidden rounded-xl
        border border-border bg-background shadow-xl sm:block"
      aria-label="Runway & Beyond film"
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3">
        <p className="editorial-label text-[10px]">Runway &amp; Beyond</p>
        <button
          onClick={dismiss}
          aria-label="Close video"
          className="text-muted-foreground transition-opacity hover:opacity-60"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Poster frame with circular play button — click to play */}
      <div className="relative aspect-[4/5] bg-neutral-100">
        <video
          ref={videoRef}
          src={popup.videoUrl}
          poster={popup.posterUrl || undefined}
          controls={playing}
          playsInline
          preload="metadata"
          onPause={handlePause}
          className={cn("absolute inset-0 h-full w-full object-cover")}
        />

        {!playing && (
          <button
            onClick={handlePlay}
            aria-label="Play film"
            className="absolute inset-0 grid place-items-center"
          >
            <span
              className="grid h-14 w-14 place-items-center rounded-full bg-black/35
                ring-1 ring-white/80 backdrop-blur-sm transition-transform hover:scale-105"
            >
              <Play className="ml-0.5 h-5 w-5 fill-white text-white" strokeWidth={1.5} />
            </span>
          </button>
        )}
      </div>
    </motion.aside>
  );
}
