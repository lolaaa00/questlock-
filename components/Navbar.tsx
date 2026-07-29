"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  const { login, logout, authenticated, user } = usePrivy();
  const [mobileOpen, setMobileOpen] = useState(false);

  const walletAddr = user?.wallet?.address;
  const shortAddr = walletAddr
    ? `${walletAddr.slice(0, 6)}…${walletAddr.slice(-4)}`
    : null;

  const isAdmin = walletAddr?.toLowerCase() === "0x1f63ea74065586af0c7c48428372d88d0a89525b";

  // Close the mobile menu on resize-up to desktop so the panel doesn't
  // linger off-screen when the user rotates / resizes.
  useEffect(() => {
    const onResize = () => {
      if (typeof window !== "undefined" && window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Centralised link list so desktop bar and mobile sheet stay in sync.
  const publicLinks: Array<{ href: string; label: string; admin?: boolean }> = [
    { href: "/quests",      label: "Quests" },
    ...(!isAdmin ? [{ href: "/create", label: "Create" }] : []),
    { href: "/leaderboard", label: "Leaderboard" },
  ];
  const authedLinks: Array<{ href: string; label: string }> = authenticated
    ? [
        { href: "/sponsor", label: "Sponsor" },
        { href: "/me",      label: "Profile" },
      ]
    : [];
  const adminLinks: Array<{ href: string; label: string }> = isAdmin
    ? [
        { href: "/ops-ql",                 label: "Admin" },
        { href: "/ops-ql/quest-requests",  label: "Requests" },
        { href: "/ops-ql/appeals",         label: "Appeals" },
        { href: "/ops-ql/analytics",       label: "Analytics" },
        { href: "/ops-ql/retry",           label: "Retry" },
        { href: "/ops-ql/confirmations",   label: "Confirmations" },
      ]
    : [];

  const linkBase = "text-sm font-medium transition-colors";

  return (
    <nav
      style={{ backgroundColor: "rgba(20,6,4,0.88)", backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", borderBottom: "1px solid rgba(180,20,40,0.12)" }}
      className="sticky top-0 z-50 ql-nav-scan"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#8B0A14" />
                <stop offset="55%" stopColor="#B01020" />
                <stop offset="100%" stopColor="#C89B3C" />
              </linearGradient>
            </defs>
            <rect width="28" height="28" rx="6" fill="url(#logo-grad)" />
            <path
              d="M14 6C10.69 6 8 8.69 8 12v1H7v9h14v-9h-1v-1c0-3.31-2.69-6-6-6zm0 2c2.21 0 4 1.79 4 4v1h-8v-1c0-2.21 1.79-4 4-4zm0 7a2 2 0 110 4 2 2 0 010-4z"
              fill="#F0E6E2"
            />
          </svg>
          <span className="font-serif text-lg font-semibold tracking-tight" style={{ color: "#F6F1EA" }}>
            QuestLock
          </span>
        </Link>

        {/* Desktop links — preserved verbatim from prior layout. md and up. */}
        <div className="hidden md:flex items-center gap-3 sm:gap-6">
          {publicLinks.map((l) => (
            <Link key={l.href} href={l.href} className={linkBase} style={{ color: "var(--ql-ashen)" }}>
              {l.label}
            </Link>
          ))}
          {authedLinks.map((l) => (
            <Link key={l.href} href={l.href} className={linkBase} style={{ color: "var(--ql-ashen)" }}>
              {l.label}
            </Link>
          ))}
          {adminLinks.map((l) => (
            <Link key={l.href} href={l.href} className={linkBase} style={{ color: "var(--ql-cafe)" }}>
              {l.label}
            </Link>
          ))}

          {authenticated && <NotificationBell />}

          {authenticated ? (
            <div className="flex items-center gap-3">
              <span
                className="text-xs font-mono px-3 py-1 rounded-full"
                style={{ background: "rgba(255,255,255,0.08)", color: "var(--ql-ashen)" }}
              >
                {shortAddr}
              </span>
              <button
                onClick={logout}
                className="text-xs px-4 py-2 rounded-full font-medium transition-all"
                style={{ background: "rgba(255,255,255,0.1)", color: "var(--ql-ashen)" }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="text-sm px-5 py-2 rounded-full font-medium transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg,var(--ember),var(--ember-2),var(--gold))", backgroundSize: "200% auto", color: "#F0E6E2" }}
            >
              Connect Wallet
            </button>
          )}
        </div>

        {/* Mobile cluster — bell stays visible, hamburger opens sheet. < md only. */}
        <div className="flex md:hidden items-center gap-2">
          {authenticated && <NotificationBell />}
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)", color: "var(--ql-ashen)" }}
          >
            {mobileOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile sheet — slides down under the navbar. < md only. */}
      {mobileOpen && (
        <div
          className="md:hidden border-t"
          style={{ background: "var(--ql-bighorn)", borderColor: "rgba(255,255,255,0.1)" }}
        >
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1">
            {[...publicLinks, ...authedLinks].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium"
                style={{ color: "var(--ql-ashen)", background: "rgba(255,255,255,0.04)" }}
              >
                {l.label}
              </Link>
            ))}
            {adminLinks.length > 0 && (
              <div className="mt-2 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <p className="text-[10px] uppercase tracking-widest px-3 mb-1" style={{ color: "var(--ql-bear)" }}>
                  Admin
                </p>
                {adminLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2.5 rounded-lg text-sm font-medium"
                    style={{ color: "var(--ql-cafe)", background: "rgba(255,255,255,0.04)" }}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Wallet / auth controls */}
            <div className="mt-3 pt-3 border-t flex items-center justify-between gap-2 flex-wrap" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              {authenticated ? (
                <>
                  <span
                    className="text-xs font-mono px-3 py-1.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.08)", color: "var(--ql-ashen)" }}
                  >
                    {shortAddr}
                  </span>
                  <button
                    onClick={() => { setMobileOpen(false); logout(); }}
                    className="text-xs px-4 py-2 rounded-full font-medium"
                    style={{ background: "rgba(255,255,255,0.1)", color: "var(--ql-ashen)" }}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setMobileOpen(false); login(); }}
                  className="w-full text-sm px-5 py-2.5 rounded-full font-medium"
                  style={{ background: "linear-gradient(135deg,var(--ember),var(--ember-2),var(--gold))", backgroundSize: "200% auto", color: "#F0E6E2" }}
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
