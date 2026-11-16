const URL_RE = /(https?:\/\/[^\s]+)/g;

/** Renders text with http(s) URLs as clickable links; newlines are preserved. */
export function LinkifiedText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(URL_RE);
  return (
    <span className={className} style={{ whiteSpace: "pre-line" }}>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-medium text-primary underline underline-offset-2"
          >
            {part.includes("google.com/maps") ? "📍 Open in Google Maps" : part}
          </a>
        ) : (
          part
        ),
      )}
    </span>
  );
}
