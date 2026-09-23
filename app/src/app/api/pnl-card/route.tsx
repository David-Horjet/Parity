/* eslint-disable @next/next/no-img-element */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { pct, price, signedUsd, usd } from "@/lib/format";
import { getMarkets } from "@/lib/markets.server";
import { fromQuery } from "@/lib/pnl-card";
import { cached, error } from "@/lib/server";

export const dynamic = "force-dynamic";

const W = 900;
const H = 1440;
const PAD = 84;
const C = {
  bg: "#08090a",
  border: "rgba(255,255,255,0.14)",
  hairline: "rgba(255,255,255,0.07)",
  ink: "#fdfdfd",
  pearl: "#d4d4d4",
  muted: "#8a8d91",
  long: "#2fe0a2",
  short: "#ff5d7d",
  liq: "#ff8a3d",
};

/** Roboto from Google Fonts as TTF; falls back to next/og's bundled face if offline. */
function font(weight: number) {
  return cached(`font:roboto:${weight}`, 24 * 60 * 60_000, async () => {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Roboto:wght@${weight}`).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) throw new Error("font url");
    return fetch(url).then((r) => r.arrayBuffer());
  });
}

const logo = () =>
  cached("pnl:logo", Infinity, async () => {
    const buf = await readFile(join(process.cwd(), "public/images/logos/parity-full-white-logo-nobg.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  });

/** Satori only decodes PNG/JPEG/SVG, and remote fetches can fail; inline or give up. */
function tokenImage(src: string) {
  return cached(`pnl:img:${src}`, 60 * 60_000, async () => {
    const res = await fetch(src, { signal: AbortSignal.timeout(4_000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/png|jpe?g|svg/.test(type)) return null;
    return `data:${type.split(";")[0]};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  }).catch(() => null);
}

const qr = (url: string) =>
  cached(`pnl:qr:${url}`, 60 * 60_000, () =>
    QRCode.toDataURL(url, { margin: 1, width: 300, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }),
  );

/** Angular light shards breaking over the frame, tinted by the result. */
function Backdrop({ tone }: { tone: string }) {
  const shards: [string, number][] = [
    ["846,560 900,492 900,780 846,850", 1],
    ["850,972 900,910 900,1150 840,1224", 1],
    ["864,1300 900,1258 900,1440 742,1440", 1],
    ["790,1440 846,1374 868,1374 812,1440", 0.55],
    ["0,770 58,706 50,752 0,806", 0.9],
    ["0,1250 60,1184 50,1236 0,1290", 1],
    ["0,1440 34,1400 214,1400 178,1440", 0.8],
  ];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", top: 0, left: 0 }}>
      <defs>
        <radialGradient id="glow" cx="100%" cy="100%" r="75%">
          <stop offset="0%" stopColor={tone} stopOpacity="0.16" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={C.bg} />
      <rect width={W} height={H} fill="url(#glow)" />
      <path d="M0,1180 L900,610 M0,1330 L900,760 M220,1440 L900,1010 M0,420 L380,180" stroke={C.hairline} strokeWidth="3" />
      <rect x="22" y="22" width={W - 44} height={H - 44} rx="46" fill="none" stroke={C.border} strokeWidth="2" />
      {shards.map(([points, opacity]) => (
        <polygon key={points} points={points} fill={tone} fillOpacity={opacity} />
      ))}
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 240 }}>
      <div style={{ fontSize: 26, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 34, color: C.ink, marginTop: 10 }}>{value}</div>
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        marginLeft: 18,
        padding: "5px 12px",
        borderRadius: 8,
        border: `2px solid ${color}`,
        color,
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: 1,
      }}
    >
      {label}
    </div>
  );
}

export async function GET(req: Request) {
  const card = fromQuery(new URL(req.url).searchParams);
  if (!card) return error("bad card params");
  const market = (await getMarkets()).find((m) => m.symbol === card.symbol);
  if (!market) return error("market not found", 404);

  const origin = `${req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")}://${
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host
  }`;
  const [img, wordmark, code, regular, bold] = await Promise.all([
    market.image ? tokenImage(market.image) : null,
    logo(),
    qr(`${origin}/trade/${card.symbol}`),
    font(400).catch(() => null),
    font(700).catch(() => null),
  ]);
  const tone = card.pnl >= 0 ? C.long : C.short;
  const when = new Date(card.time * 1000);
  const date = `${when.toISOString().slice(0, 10)} ${when.toISOString().slice(11, 16)} UTC`;
  const fonts = [
    regular && { name: "Roboto", data: regular, weight: 400 as const },
    bold && { name: "Roboto", data: bold, weight: 700 as const },
  ].filter((f): f is NonNullable<typeof f> => !!f);

  const image = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative", fontFamily: "Roboto", color: C.ink }}>
        <Backdrop tone={tone} />
        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: `96px ${PAD}px 110px` }}>
          {/* The wordmark PNG carries ~12% padding on each side. */}
          <img src={wordmark} width={264} height={88} style={{ marginLeft: -30 }} />

          {/* Market */}
          <div style={{ display: "flex", alignItems: "center", marginTop: 150 }}>
            {img ? (
              <img src={img} width={68} height={68} style={{ borderRadius: 999, background: "#fff", objectFit: "contain" }} />
            ) : (
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 999,
                  background: tone,
                  color: C.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 30,
                  fontWeight: 700,
                }}
              >
                {card.symbol.slice(0, 1)}
              </div>
            )}
            <div style={{ fontSize: 44, fontWeight: 700, marginLeft: 22, maxWidth: 440 }}>{market.name}</div>
            <Pill label={`${card.side.toUpperCase()} ${Number(card.leverage.toFixed(1))}x`} color={card.side === "long" ? C.long : C.short} />
          </div>

          {/* Result */}
          <div style={{ fontSize: 150, fontWeight: 700, color: tone, letterSpacing: -4, marginTop: 44, lineHeight: 1 }}>
            {pct(card.roe)}
          </div>
          <div style={{ fontSize: 46, fontWeight: 700, color: tone, marginTop: 18 }}>{signedUsd(card.pnl)}</div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 44 }}>
            <div style={{ fontSize: 28, color: C.muted }}>{card.open ? `Open position · ${date}` : date}</div>
            {card.liquidated && <Pill label="LIQUIDATED" color={C.liq} />}
          </div>

          {/* Stats */}
          <div style={{ display: "flex", marginTop: 100 }}>
            <Stat label="Entry Price" value={price(card.entry)} />
            <Stat label={card.open ? "Mark Price" : "Exit Price"} value={price(card.exit)} />
            <Stat label="Margin" value={usd(card.margin)} />
          </div>

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 28, color: C.muted }}>Pre-IPO perpetuals on Solana</div>
              <div style={{ fontSize: 32, color: C.pearl, marginTop: 12 }}>{`Trade ${card.symbol} on Parity`}</div>
            </div>
            <img src={code} width={150} height={150} style={{ borderRadius: 12 }} />
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: fonts.length ? fonts : undefined },
  );
  // ImageResponse renders lazily while streaming; buffer it so a render failure becomes a 500, not a dropped socket.
  try {
    const png = await image.arrayBuffer();
    return new Response(png, {
      headers: { "content-type": "image/png", "cache-control": "public, max-age=60, s-maxage=300" },
    });
  } catch (err) {
    return error(`render failed: ${(err as Error).message}`, 500);
  }
}
