import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { GithubIcon, NewTwitterIcon, TelegramIcon } from "@hugeicons/core-free-icons";
import { Logo } from "./logo";

// TODO: point at the real pages and handles.
const LINKS = [
  { label: "Terms", href: "#" },
  { label: "Privacy Policy", href: "#" },
];
const SOCIALS = [
  { label: "X", href: "#", icon: NewTwitterIcon },
  { label: "Telegram", href: "#", icon: TelegramIcon },
  { label: "GitHub", href: "#", icon: GithubIcon },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-8 sm:flex-row sm:justify-between">
        <Logo height={34} />
        <nav className="flex items-center gap-6 text-sm text-muted">
          {LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="transition hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {SOCIALS.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              aria-label={s.label}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white/3 text-muted transition hover:border-line-strong hover:text-ink"
            >
              <HugeiconsIcon icon={s.icon} size={18} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
