"use client";

import { useEffect } from "react";
import Link from "next/link";

const HOW_IT_WORKS = [
  { step: "01", title: "Connect wallet",          desc: "Connect via Privy on Base Sepolia. No gas required to get started." },
  { step: "02", title: "Submit GitHub proof",     desc: "Provide your GitHub username, repository URL and demo link." },
  { step: "03", title: "Objective checks run",    desc: "The proof engine checks commits, README, files, demo URL and anti-farm rules." },
  { step: "04", title: "Attestation issued",      desc: "Passed submissions receive a public EAS attestation on Base Sepolia." },
  { step: "05", title: "Claim reward gaslessly",  desc: "QuestLock's verifier submits the claim transaction. You sign nothing and pay no gas." },
  { step: "06", title: "Receive token + badge",   desc: "QUEST tokens transfer and a soulbound ERC-1155 badge mints to your wallet." },
];

const PROOF_CHECKS = [
  { label: "Repository exists and is public",         pts: 10 },
  { label: "Owner matches submitted GitHub username",  pts: 10 },
  { label: "Updated after quest start",               pts: 10 },
  { label: "3+ commits after quest start",            pts: 15 },
  { label: "README file present",                     pts: 10 },
  { label: "README 500+ characters",                  pts: 10 },
  { label: "Frontend files detected",                 pts: 10 },
  { label: "Contract/backend files detected",         pts: 10 },
  { label: "Demo URL loads",                          pts: 10 },
  { label: "Not previously submitted",                pts: 5  },
];

const FEATURES = [
  { title: "Deterministic checks",                          desc: "No AI. No subjectivity. Pure objective rules." },
  { title: "EAS Attestations",                              desc: "Public-safe proof results on Base Sepolia." },
  { title: "Anti-farm rules",                               desc: "Duplicate detection prevents reward farming." },
  { title: "Gasless claim from the user's perspective",     desc: "QuestLock's verifier wallet signs and pays the claim transaction. No wallet signature, no ETH from you." },
];

export default function LandingPage() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("on"); obs.unobserve(e.target); }
      }),
      { threshold: 0.08 }
    );
    document.querySelectorAll(".reveal").forEach((el) => {
      const sibs = el.parentElement?.querySelectorAll(".reveal");
      if (sibs && sibs.length > 1) {
        const idx = Array.from(sibs).indexOf(el as Element);
        (el as HTMLElement).style.transitionDelay = `${idx * 0.1}s`;
      }
      obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <div>
      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-badge">
          <span className="badge-dot" />
          Base Sepolia · Proof-Powered · EAS Attestations
        </div>

        <h1 className="ht">
          <span className="ln"><span className="w" style={{ animationDelay: ".15s" }}>Rewards should</span></span>
          <span className="ln"><span className="gw" style={{ animationDelay: ".38s" }}>follow proof,</span></span>
          <span className="ln"><span className="w" style={{ animationDelay: ".62s" }}>not farming.</span></span>
        </h1>

        <p className="hero-sub">
          QuestLock is a <span className="hl">deterministic proof platform</span>. Submit your GitHub
          project, pass objective checks, receive a public attestation, claim rewards gaslessly.
        </p>

        <div className="hero-btns">
          <Link href="/quests" className="btn btn-p">Browse Quests <span className="arr">→</span></Link>
          <Link href="/create" className="btn btn-g">Create Quest</Link>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <div className="divider" />
      <div className="sec">
        <div className="reveal">
          <div className="sec-lbl">How it works</div>
          <h2 className="st">Six steps. <span className="gs">Zero subjectivity.</span></h2>
          <p className="sec-sub">Every step is transparent. No subjective scoring. No AI.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "1rem", marginTop: "3rem" }}>
          {HOW_IT_WORKS.map(({ step, title, desc }) => (
            <div
              key={step}
              className="reveal ql-scan-top"
              style={{
                background: "rgba(40,15,12,0.75)",
                border: "1px solid rgba(180,20,40,0.14)",
                borderRadius: "8px",
                padding: "1.5rem",
                backdropFilter: "blur(14px)",
                position: "relative",
              }}
            >
              <div style={{ fontFamily: "var(--mono)", fontSize: ".65rem", letterSpacing: ".18em", color: "var(--ember-3)", marginBottom: ".75rem" }}>{step}</div>
              <div style={{ fontFamily: "var(--sg)", fontSize: "1rem", fontWeight: 700, color: "var(--mist-3)", marginBottom: ".5rem" }}>{title}</div>
              <div style={{ fontFamily: "var(--body)", fontSize: ".9375rem", color: "var(--mauve)", lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── PROOF CHECKS ── */}
      <div className="divider" />
      <div className="sec">
        <div className="reveal">
          <div className="sec-lbl">Objective proof checks</div>
          <h2 className="st">100 points. <span className="gs">70 to pass.</span></h2>
          <p className="sec-sub">Every check is deterministic. Every failure has a reason.</p>
        </div>
        <div
          className="reveal"
          style={{
            marginTop: "2.5rem",
            border: "1px solid rgba(180,20,40,0.18)",
            borderRadius: "8px",
            overflow: "hidden",
            maxWidth: "680px",
          }}
        >
          {PROOF_CHECKS.map(({ label, pts }, i) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: ".875rem 1.25rem",
                borderTop: i > 0 ? "1px solid rgba(240,230,226,0.05)" : undefined,
                background: i % 2 === 0 ? "rgba(40,15,12,0.6)" : "rgba(30,10,8,0.5)",
              }}
            >
              <span style={{ fontFamily: "var(--body)", fontSize: ".9375rem", color: "var(--mist-2)" }}>{label}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: ".75rem", fontWeight: 600, color: "var(--gold-2)", whiteSpace: "nowrap", marginLeft: "1rem" }}>+{pts} pts</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── WHY QUESTLOCK ── */}
      <div className="divider" />
      <div className="sec" id="why">
        <div className="reveal">
          <div className="sec-lbl">Why QuestLock</div>
          <h2 className="st">Proof over hype. <span className="gs">Trust over noise.</span></h2>
          <p className="sec-sub">
            Deterministic checks, not AI or subjective scoring. Every decision is explainable
            and every failure has a transparent reason.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "1rem", marginTop: "3rem" }}>
          {FEATURES.map(({ title, desc }) => (
            <div
              key={title}
              className="reveal"
              style={{
                background: "linear-gradient(135deg,rgba(176,16,32,.08) 0%,rgba(40,15,12,.75) 100%)",
                border: "1px solid rgba(200,155,60,.15)",
                borderRadius: "8px",
                padding: "1.5rem",
                display: "flex",
                gap: "1rem",
                alignItems: "flex-start",
              }}
            >
              <div style={{ width: "3px", borderRadius: "3px", background: "linear-gradient(180deg,var(--ember-2),var(--gold))", flexShrink: 0, alignSelf: "stretch" }} />
              <div>
                <div style={{ fontFamily: "var(--sg)", fontSize: ".9375rem", fontWeight: 700, color: "var(--mist-3)", marginBottom: ".375rem" }}>{title}</div>
                <div style={{ fontFamily: "var(--body)", fontSize: ".875rem", color: "var(--mauve)", lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FINAL CTA ── */}
      <div className="fcta reveal">
        <div className="fcta-i">
          <h2>Ready to prove your work?<br /><span className="gs2">Browse open quests.</span></h2>
          <p>Submit GitHub proof, pass deterministic checks, receive a public EAS attestation and claim your reward gaslessly on Base Sepolia.</p>
          <Link href="/quests" className="btn-lt">Browse Quests <span className="arr">→</span></Link>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="home-footer">
        <p>QuestLock v1 · Base Sepolia · Testnet infrastructure · Rewards follow proof, not farming.</p>
      </footer>
    </div>
  );
}
