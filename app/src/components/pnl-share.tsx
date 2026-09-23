"use client";

/* eslint-disable @next/next/no-img-element */
import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Copy01Icon,
  Download04Icon,
  Link01Icon,
  NewTwitterIcon,
  Share08Icon,
} from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { pct, signedUsd } from "@/lib/format";
import { toQuery, type PnlCard } from "@/lib/pnl-card";
import { useToast } from "./toast";

const action =
  "flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-line text-sm transition hover:border-line-strong hover:bg-raise";

/** Share icon that opens a PnL card preview; the card is snapshotted on open so live marks don't refetch it. */
export function PnlShareButton({ card, className = "" }: { card: PnlCard | null; className?: string }) {
  const [open, setOpen] = useState<PnlCard | null>(null);
  if (!card) return null;
  return (
    <>
      <button
        onClick={() => setOpen(card)}
        title="Share PnL"
        aria-label="Share PnL card"
        className={`inline-flex items-center justify-center text-dim transition hover:text-ink ${className}`}
      >
        <HugeiconsIcon icon={Share08Icon} size={14} />
      </button>
      {/* Portaled: blurred panels and animated rows would otherwise trap the fixed overlay. */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>{open && <PnlCardModal card={open} onClose={() => setOpen(null)} />}</AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function PnlCardModal({ card, onClose }: { card: PnlCard; onClose: () => void }) {
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const query = toQuery(card);
  const imageUrl = `/api/pnl-card?${query}`;
  const shareUrl = () => `${window.location.origin}/share/pnl?${query}`;
  const fileName = `parity-${card.symbol.toLowerCase()}-pnl.png`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const blob = () =>
    fetch(imageUrl).then((r) => {
      if (!r.ok) throw new Error("Card failed to render");
      return r.blob();
    });

  const fail = (err: unknown) => toast.push({ kind: "error", title: "Couldn't share", body: (err as Error).message });

  const download = () =>
    blob()
      .then((b) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1_000);
      })
      .catch(fail);

  // Safari only allows clipboard writes when the promise is handed over synchronously.
  const copyImage = () =>
    navigator.clipboard
      .write([new ClipboardItem({ "image/png": blob() })])
      .then(() => toast.push({ kind: "success", title: "Card copied to clipboard" }))
      .catch(fail);

  const copyLink = () =>
    navigator.clipboard
      .writeText(shareUrl())
      .then(() => toast.push({ kind: "success", title: "Link copied" }))
      .catch(fail);

  const postToX = () => {
    const text = `${card.open ? "Riding" : "Closed"} ${card.side} ${card.symbol} ${card.leverage.toFixed(1)}x for ${signedUsd(card.pnl)} (${pct(card.roe)}) on Parity`;
    const url = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[360px] rounded-2xl popover p-3"
      >
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-sm font-medium">Share PnL</p>
          <button onClick={onClose} aria-label="Close" className="text-muted transition hover:text-ink">
            <HugeiconsIcon icon={Cancel01Icon} size={18} />
          </button>
        </div>
        <div className="relative aspect-[5/8] overflow-hidden rounded-xl bg-panel">
          {!loaded && <div className="absolute inset-0 animate-pulse bg-raise/40" />}
          <img
            src={imageUrl}
            alt={`${card.symbol} PnL card`}
            onLoad={() => setLoaded(true)}
            className={`h-full w-full transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={postToX} className={`${action} border-transparent bg-accent font-bold text-bg hover:bg-pearl`}>
            <HugeiconsIcon icon={NewTwitterIcon} size={16} /> Post
          </button>
          <button onClick={copyImage} className={action} title="Copy image">
            <HugeiconsIcon icon={Copy01Icon} size={16} />
          </button>
          <button onClick={download} className={action} title="Download">
            <HugeiconsIcon icon={Download04Icon} size={16} />
          </button>
          <button onClick={copyLink} className={action} title="Copy link">
            <HugeiconsIcon icon={Link01Icon} size={16} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
