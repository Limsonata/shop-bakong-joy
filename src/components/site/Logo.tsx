export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 210 40"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="BillieGrace Closet"
    >
      <defs>
        <linearGradient id="bg-rose-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FAD0C4" />
          <stop offset="50%" stopColor="#E8A7B8" />
          <stop offset="100%" stopColor="#C5798B" />
        </linearGradient>
      </defs>
      <text
        x="0"
        y="28"
        fontFamily="'Playfair Display', 'Georgia', serif"
        fontSize="26"
        fontWeight="700"
        fill="url(#bg-rose-gold)"
      >
        Billie
      </text>
      <text
        x="66"
        y="28"
        fontFamily="'Playfair Display', 'Georgia', serif"
        fontSize="26"
        fontWeight="700"
        fill="currentColor"
      >
        Grace
      </text>
      <text
        x="0"
        y="38"
        fontFamily="'Montserrat', 'Helvetica', sans-serif"
        fontSize="8"
        fontWeight="500"
        letterSpacing="3"
        fill="currentColor"
        opacity="0.55"
      >
        CLOSET
      </text>
    </svg>
  );
}
