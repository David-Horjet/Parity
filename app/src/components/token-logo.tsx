/* eslint-disable @next/next/no-img-element */
export function TokenLogo({ src, symbol, size = 28 }: { src?: string; symbol: string; size?: number }) {
  return src ? (
    <img
      src={src}
      alt={symbol}
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-white/95 object-contain p-[2px]"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-raise text-[10px] font-bold"
      style={{ width: size, height: size }}
    >
      {symbol.slice(0, 2)}
    </span>
  );
}
