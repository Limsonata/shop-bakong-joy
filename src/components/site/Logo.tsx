export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 148 40"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="hairora"
    >
      <text
        x="0"
        y="32"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif"
        fontSize="36"
        fontWeight="700"
        fill="currentColor"
        letterSpacing="-1"
      >
        hair
      </text>
      <text
        x="79"
        y="32"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif"
        fontSize="36"
        fontWeight="700"
        fill="#C49A2A"
        letterSpacing="-1"
      >
        ora
      </text>
    </svg>
  );
}
