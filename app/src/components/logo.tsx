import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect x="2" y="2" width="28" height="28" rx="8" fill="#7c8cff" />
        <path d="M10 24V10h6.5a4.5 4.5 0 0 1 0 9H13" fill="none" stroke="#081231" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 24h5" stroke="#2fe0a2" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="font-display text-xl font-bold tracking-tight">Parity</span>
    </Link>
  );
}
