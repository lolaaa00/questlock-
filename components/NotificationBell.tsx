"use client";

// v1.2 — in-app notification bell. Lives in the Navbar; polls /api/notifications
// every 30s when authenticated. Displays unread count badge + a dropdown with
// the 20 most recent items. Supports mark-one-read and mark-all-read.
//
// Wallet is required — bell is hidden when the user is not authenticated.

import { useEffect, useRef, useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata_json: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

interface NotificationsResponse {
  unread: number;
  items: NotificationItem[];
}

const POLL_INTERVAL_MS = 30_000;

export default function NotificationBell() {
  const { authenticated, user } = usePrivy();
  const wallet = user?.wallet?.address?.toLowerCase();
  const [data, setData] = useState<NotificationsResponse>({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    try {
      const res = await fetch(`/api/notifications?wallet=${wallet}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Failed to load");
        return;
      }
      const body = (await res.json()) as NotificationsResponse;
      setData(body);
      setError(null);
    } catch {
      setError("Network error");
    }
  }, [wallet]);

  // Poll while authenticated.
  useEffect(() => {
    if (!authenticated || !wallet) return;
    refresh();
    const t = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [authenticated, wallet, refresh]);

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!dropdownRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function markRead(id?: string) {
    if (!wallet) return;
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: wallet, id }),
      });
      refresh();
    } catch {
      // ignore — refresh will retry on next poll
    }
  }

  if (!authenticated || !wallet) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications (${data.unread} unread)`}
        className="relative w-9 h-9 rounded-full flex items-center justify-center transition-colors"
        style={{ background: "rgba(255,255,255,0.07)", color: "var(--ql-ashen)" }}
      >
        {/* Bell icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3a6 6 0 016 6v3.59l1.7 1.7A1 1 0 0119 16H5a1 1 0 01-.7-1.71L6 12.59V9a6 6 0 016-6zm-2 16a2 2 0 104 0h-4z"
            fill="currentColor"
          />
        </svg>
        {data.unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1"
            style={{ background: "#B01020", color: "#F6F1EA", border: "2px solid var(--ql-bighorn)" }}
          >
            {data.unread > 99 ? "99+" : data.unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto rounded-2xl shadow-2xl z-[200]"
          style={{
            background: "var(--ql-night)",
            border: "1px solid rgba(180,20,40,0.15)",
          }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between sticky top-0"
            style={{ background: "var(--ql-night)", borderBottom: "1px solid rgba(180,20,40,0.12)" }}
          >
            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--ql-cafe)" }}>
              Notifications
            </p>
            {data.unread > 0 && (
              <button
                onClick={() => markRead()}
                className="text-xs underline"
                style={{ color: "var(--ql-ashen)" }}
              >
                Mark all read
              </button>
            )}
          </div>

          {error ? (
            <p className="px-4 py-6 text-xs text-center" style={{ color: "#F0DADA" }}>
              {error}
            </p>
          ) : data.items.length === 0 ? (
            <p className="px-4 py-8 text-xs text-center" style={{ color: "var(--ql-bear)" }}>
              No notifications yet.
            </p>
          ) : (
            <ul>
              {data.items.map((n) => (
                <li
                  key={n.id}
                  className="px-4 py-3 flex gap-3 cursor-pointer hover:opacity-90"
                  style={{
                    borderTop: "1px solid rgba(180,20,40,0.08)",
                    background: n.read_at ? "transparent" : "rgba(176,16,32,0.08)",
                  }}
                  onClick={() => !n.read_at && markRead(n.id)}
                >
                  <span
                    className="w-2 h-2 mt-1.5 rounded-full shrink-0"
                    style={{ background: n.read_at ? "transparent" : "#B01020" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#F6F1EA" }}>
                      {n.title}
                    </p>
                    <p className="text-xs leading-snug" style={{ color: "var(--ql-ashen)" }}>
                      {n.message}
                    </p>
                    <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: "var(--ql-bear)" }}>
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
