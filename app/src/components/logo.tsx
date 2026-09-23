import Image from "next/image";
import Link from "next/link";

/** White wordmark on transparent; the PNG carries ~12% padding on each side. */
export function Logo({ height = 36, className = "" }: { height?: number; className?: string }) {
  return (
    <Link href="/" className={`flex shrink-0 items-center ${className}`} aria-label="Parity home">
      <Image
        src="/images/logos/parity-full-white-logo-nobg.png"
        alt="Parity"
        width={866}
        height={288}
        priority
        style={{ height, width: "auto" }}
      />
    </Link>
  );
}
