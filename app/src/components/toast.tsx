"use client";

import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, ArrowUpRight01Icon, Loading03Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { explorerTx } from "@/lib/config";

type Kind = "success" | "error" | "pending";
interface Toast {
  id: number;
  kind: Kind;
  title: string;
  body?: string;
  signature?: string;
}

interface ToastApi {
  push: (t: Omit<Toast, "id">) => number;
  update: (id: number, t: Omit<Toast, "id">) => void;
}

const Ctx = createContext<ToastApi | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissLater = useCallback((id: number, kind: Kind) => {
    if (kind === "pending") return;
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), kind === "error" ? 8_000 : 5_000);
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = nextId++;
      setToasts((all) => [...all.slice(-3), { ...t, id }]);
      dismissLater(id, t.kind);
      return id;
    },
    [dismissLater],
  );

  const update = useCallback(
    (id: number, t: Omit<Toast, "id">) => {
      setToasts((all) => all.map((x) => (x.id === id ? { ...t, id } : x)));
      dismissLater(id, t.kind);
    },
    [dismissLater],
  );

  return (
    <Ctx.Provider value={{ push, update }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="pointer-events-auto rounded-xl popover p-3"
            >
              <div className="flex items-start gap-3">
                <span
                  className={
                    t.kind === "success" ? "text-long" : t.kind === "error" ? "text-short" : "text-accent animate-spin"
                  }
                >
                  <HugeiconsIcon
                    icon={t.kind === "success" ? Tick02Icon : t.kind === "error" ? Alert02Icon : Loading03Icon}
                    size={18}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{t.title}</p>
                  {t.body && <p className="mt-0.5 break-words text-xs text-muted">{t.body}</p>}
                  {t.signature && (
                    <a
                      href={explorerTx(t.signature)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                      View transaction <HugeiconsIcon icon={ArrowUpRight01Icon} size={12} />
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}
