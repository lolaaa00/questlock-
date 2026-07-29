"use client";

// v1.2 — Proof submission dispatcher.
//
// Renders one of five sub-forms based on quest.proof_type. github_project keeps
// its original v1.1 form + /api/proof/submit endpoint (unchanged behaviour).
// The other four (manual_project, discord_role, x_post, lms_course) render
// adapter-specific fields and POST to /api/proof/multi.
//
// Creator/sponsor guard, wallet-connect gate, and post-submit redirect are
// shared across all sub-forms.

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ProofSubmissionFormProps {
  questId: string;
  questTitle: string;
  createdBy?: string | null;
  sponsorWallet?: string | null;
  proofType?: string;
}

const inputStyle = {
  background: "var(--card)",
  border: "1px solid var(--ql-cafe)",
  color: "#F0E6E2",
};
const inputClass = "w-full px-4 py-3 rounded-xl text-sm outline-none focus:ring-2";
const labelClass = "block text-sm font-medium mb-1.5";
const labelStyle = { color: "#F0E6E2" };
const helperClass = "text-xs mt-1";
const helperStyle = { color: "var(--ql-bear)" };
const errorClass = "text-xs mt-1";
const errorStyle = { color: "#7A2020" };

function WalletStrip({ address }: { address: string }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
      style={{ background: "var(--muted)" }}
    >
      <span style={{ color: "var(--ql-bear)" }}>Wallet:</span>
      <span className="font-mono text-xs" style={{ color: "#F0E6E2" }}>{address}</span>
      <span className="ml-auto text-xs px-2 py-0.5 rounded-full"
        style={{ background: "var(--ql-ashen)", color: "var(--ql-bear)" }}>
        Base Sepolia
      </span>
    </div>
  );
}

function SubmitButton({
  label, submitting, blockedBySelf, busyLabel,
}: { label: string; submitting: boolean; blockedBySelf: boolean; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={submitting || blockedBySelf}
      title={blockedBySelf ? "You created or sponsored this quest." : undefined}
      className="w-full py-4 rounded-full font-semibold text-base transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
      style={{ background: "#B01020", color: "#F6F1EA" }}
    >
      {blockedBySelf ? "You created or sponsored this quest" : submitting ? busyLabel : label}
    </button>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "#F0DADA", color: "#7A2020" }}>
      {message}
    </div>
  );
}

// ---------- shared submit helper for /api/proof/multi ----------

async function submitMultiProof(
  questId: string,
  walletAddress: string,
  input: Record<string, unknown>
): Promise<{ submissionId?: string; status?: string; error?: string }> {
  const res = await fetch("/api/proof/multi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questId, walletAddress, input }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "Submission failed." };
  return { submissionId: data.submissionId, status: data.status };
}

// ============================================================
//   GitHub project (unchanged v1.1 path → /api/proof/submit)
// ============================================================

function GithubProjectForm({ questId, wallet, createdBy, sponsorWallet }: {
  questId: string; wallet: string; createdBy?: string | null; sponsorWallet?: string | null;
}) {
  const router = useRouter();
  const [githubStatus, setGithubStatus] = useState<{ connected: boolean; github_login?: string } | null>(null);
  const [form, setForm] = useState({ githubUsername: "", repoUrl: "", demoUrl: "", explanation: "" });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/auth/github/status?wallet=${wallet}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setGithubStatus(d);
        if (d?.connected && d.github_login) setForm((f) => ({ ...f, githubUsername: d.github_login }));
      })
      .catch(() => setGithubStatus({ connected: false }));
  }, [wallet]);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.githubUsername.trim()) e.githubUsername = "GitHub username is required.";
    if (!form.repoUrl.trim()) e.repoUrl = "Repository URL is required.";
    else if (!form.repoUrl.includes("github.com")) e.repoUrl = "Must be a GitHub URL.";
    if (form.demoUrl && !form.demoUrl.startsWith("http")) e.demoUrl = "Demo URL must start with http:// or https://";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true); setErrorMsg(null);
    try {
      const res = await fetch("/api/proof/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questId, walletAddress: wallet,
          githubUsername: form.githubUsername.trim(),
          repoUrl: form.repoUrl.trim(),
          demoUrl: form.demoUrl.trim() || undefined,
          explanation: form.explanation.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error || "Submission failed."); return; }
      if (data.submissionId) router.push(`/submit/${questId}?submissionId=${data.submissionId}`);
    } catch { setErrorMsg("Network error. Please try again."); }
    finally { setSubmitting(false); }
  }

  // GitHub linking gate
  if (githubStatus && githubStatus.connected === false) {
    return (
      <div className="rounded-[18px] p-8 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <p className="font-serif text-lg mb-2" style={{ color: "#F0E6E2" }}>Connect GitHub before submitting proof</p>
        <p className="text-sm mb-4" style={{ color: "var(--ql-bear)" }}>
          QuestLock verifies that the repository owner matches your linked GitHub account.
        </p>
        <Link href="/me" className="inline-block px-6 py-3 rounded-full font-medium text-sm"
          style={{ background: "#1A0A08", color: "#F6F1EA" }}>
          Connect GitHub on Profile →
        </Link>
      </div>
    );
  }

  const w = wallet.toLowerCase();
  const blockedBySelf = createdBy?.toLowerCase() === w || sponsorWallet?.toLowerCase() === w;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className={labelClass} style={labelStyle}>GitHub Username <span style={{ color: "#B01020" }}>*</span></label>
        <input type="text" value={form.githubUsername} readOnly={Boolean(githubStatus?.connected)}
          onChange={(e) => setForm({ ...form, githubUsername: e.target.value })}
          placeholder="your-github-username" className={inputClass}
          style={{ ...inputStyle, background: githubStatus?.connected ? "var(--muted)" : "var(--card)",
            border: `1px solid ${errors.githubUsername ? "#7A2020" : "var(--ql-cafe)"}` }} />
        {githubStatus?.connected && (
          <p className={helperClass} style={helperStyle}>Locked to your linked GitHub account @{githubStatus.github_login}.</p>
        )}
        {errors.githubUsername && <p className={errorClass} style={errorStyle}>{errors.githubUsername}</p>}
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>Repository URL <span style={{ color: "#B01020" }}>*</span></label>
        <input type="url" value={form.repoUrl} onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
          placeholder="https://github.com/username/repo-name" className={`${inputClass} font-mono`}
          style={{ ...inputStyle, border: `1px solid ${errors.repoUrl ? "#7A2020" : "var(--ql-cafe)"}` }} />
        {errors.repoUrl && <p className={errorClass} style={errorStyle}>{errors.repoUrl}</p>}
        <p className={helperClass} style={helperStyle}>Must be public. Repository owner must match your GitHub username.</p>
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>Demo URL</label>
        <input type="url" value={form.demoUrl} onChange={(e) => setForm({ ...form, demoUrl: e.target.value })}
          placeholder="https://your-demo.vercel.app" className={`${inputClass} font-mono`}
          style={{ ...inputStyle, border: `1px solid ${errors.demoUrl ? "#7A2020" : "var(--ql-cafe)"}` }} />
        {errors.demoUrl && <p className={errorClass} style={errorStyle}>{errors.demoUrl}</p>}
        <p className={helperClass} style={helperStyle}>Required for demo URL check (10 points).</p>
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>Short Explanation <span className="text-xs font-normal" style={{ color: "var(--ql-bear)" }}>(optional)</span></label>
        <textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })}
          placeholder="Briefly describe your project and what you built." rows={3}
          className={`${inputClass} resize-none`} style={inputStyle} />
      </div>
      <WalletStrip address={wallet} />
      {errorMsg && <ErrorBox message={errorMsg} />}
      <SubmitButton label="Submit Proof" busyLabel="Running Proof Checks…" submitting={submitting} blockedBySelf={blockedBySelf} />
      {submitting && <p className="text-xs text-center" style={helperStyle}>Checking GitHub, scoring proof, running anti-farm checks… 10–30 seconds.</p>}
    </form>
  );
}

// ============================================================
//   Manual project — admin reviews
// ============================================================

function ManualProjectForm({ questId, wallet, createdBy, sponsorWallet }: {
  questId: string; wallet: string; createdBy?: string | null; sponsorWallet?: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ projectTitle: "", demoUrl: "", explanation: "", supportingLink: "" });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.projectTitle.trim()) e.projectTitle = "Project title required.";
    if (!form.demoUrl.trim() || !form.demoUrl.startsWith("http")) e.demoUrl = "Valid demo URL required (must start with http).";
    if (!form.explanation.trim() || form.explanation.trim().length < 30) e.explanation = "Explanation required (min 30 chars).";
    if (form.supportingLink && !form.supportingLink.startsWith("http")) e.supportingLink = "Supporting link must start with http.";
    setErrors(e); return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true); setErrorMsg(null);
    const result = await submitMultiProof(questId, wallet, {
      projectTitle: form.projectTitle.trim(),
      demoUrl: form.demoUrl.trim(),
      explanation: form.explanation.trim(),
      supportingLink: form.supportingLink.trim() || undefined,
    });
    setSubmitting(false);
    if (result.error) { setErrorMsg(result.error); return; }
    if (result.submissionId) router.push(`/submit/${questId}?submissionId=${result.submissionId}`);
  }

  const w = wallet.toLowerCase();
  const blockedBySelf = createdBy?.toLowerCase() === w || sponsorWallet?.toLowerCase() === w;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "var(--muted)", color: "var(--ql-bear)" }}>
        ⓘ This quest is admin-reviewed. You will be notified when a verifier approves or rejects your submission (typically within 72 hours).
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>Project Title <span style={{ color: "#B01020" }}>*</span></label>
        <input type="text" value={form.projectTitle} onChange={(e) => setForm({ ...form, projectTitle: e.target.value })}
          placeholder="My awesome project" className={inputClass}
          style={{ ...inputStyle, border: `1px solid ${errors.projectTitle ? "#7A2020" : "var(--ql-cafe)"}` }} />
        {errors.projectTitle && <p className={errorClass} style={errorStyle}>{errors.projectTitle}</p>}
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>Demo URL <span style={{ color: "#B01020" }}>*</span></label>
        <input type="url" value={form.demoUrl} onChange={(e) => setForm({ ...form, demoUrl: e.target.value })}
          placeholder="https://your-project.com" className={`${inputClass} font-mono`}
          style={{ ...inputStyle, border: `1px solid ${errors.demoUrl ? "#7A2020" : "var(--ql-cafe)"}` }} />
        {errors.demoUrl && <p className={errorClass} style={errorStyle}>{errors.demoUrl}</p>}
        <p className={helperClass} style={helperStyle}>Live URL the admin can open and verify.</p>
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>What did you build? <span style={{ color: "#B01020" }}>*</span></label>
        <textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })}
          placeholder="Describe what you built and how it meets the quest requirements (min 30 characters)."
          rows={5} className={`${inputClass} resize-none`}
          style={{ ...inputStyle, border: `1px solid ${errors.explanation ? "#7A2020" : "var(--ql-cafe)"}` }} />
        {errors.explanation && <p className={errorClass} style={errorStyle}>{errors.explanation}</p>}
        <p className={helperClass} style={helperStyle}>This text is private — only admins see it, not the public certificate.</p>
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>Supporting link <span className="text-xs font-normal" style={{ color: "var(--ql-bear)" }}>(optional)</span></label>
        <input type="url" value={form.supportingLink} onChange={(e) => setForm({ ...form, supportingLink: e.target.value })}
          placeholder="https://docs.example.com or blog post URL" className={`${inputClass} font-mono`}
          style={{ ...inputStyle, border: `1px solid ${errors.supportingLink ? "#7A2020" : "var(--ql-cafe)"}` }} />
        {errors.supportingLink && <p className={errorClass} style={errorStyle}>{errors.supportingLink}</p>}
      </div>
      <WalletStrip address={wallet} />
      {errorMsg && <ErrorBox message={errorMsg} />}
      <SubmitButton label="Submit for Review" busyLabel="Submitting…" submitting={submitting} blockedBySelf={blockedBySelf} />
    </form>
  );
}

// ============================================================
//   Discord role
// ============================================================

function DiscordRoleForm({ questId, wallet, createdBy, sponsorWallet }: {
  questId: string; wallet: string; createdBy?: string | null; sponsorWallet?: string | null;
}) {
  const router = useRouter();
  const [discordStatus, setDiscordStatus] = useState<{ connected: boolean; discord_username?: string } | null>(null);
  const [evidenceNote, setEvidenceNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/auth/discord/status?wallet=${wallet}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDiscordStatus(d))
      .catch(() => setDiscordStatus({ connected: false }));
  }, [wallet]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setErrorMsg(null);
    const result = await submitMultiProof(questId, wallet, {
      evidenceNote: evidenceNote.trim() || undefined,
    });
    setSubmitting(false);
    if (result.error) { setErrorMsg(result.error); return; }
    if (result.submissionId) router.push(`/submit/${questId}?submissionId=${result.submissionId}`);
  }

  if (discordStatus && discordStatus.connected === false) {
    return (
      <div className="rounded-[18px] p-8 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <p className="font-serif text-lg mb-2" style={{ color: "#F0E6E2" }}>Connect Discord before submitting</p>
        <p className="text-sm mb-4" style={{ color: "var(--ql-bear)" }}>
          We need your Discord identity to verify guild membership and role.
        </p>
        <Link href="/me" className="inline-block px-6 py-3 rounded-full font-medium text-sm"
          style={{ background: "#1A0A08", color: "#F6F1EA" }}>
          Connect Discord on Profile →
        </Link>
      </div>
    );
  }

  const w = wallet.toLowerCase();
  const blockedBySelf = createdBy?.toLowerCase() === w || sponsorWallet?.toLowerCase() === w;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "var(--muted)", color: "var(--ql-bear)" }}>
        ⓘ Verification uses the linked Discord account{discordStatus?.discord_username && <> (<span className="font-mono">{discordStatus.discord_username}</span>)</>}.
        If the operator has configured a bot token for this guild, verification is automatic; otherwise an admin reviews manually.
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>Note for the admin <span className="text-xs font-normal" style={{ color: "var(--ql-bear)" }}>(optional)</span></label>
        <textarea value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} rows={3}
          placeholder="Optional context (e.g. how you earned the role, screenshot link…)"
          className={`${inputClass} resize-none`} style={inputStyle} />
      </div>
      <WalletStrip address={wallet} />
      {errorMsg && <ErrorBox message={errorMsg} />}
      <SubmitButton label="Submit Discord Proof" busyLabel="Submitting…" submitting={submitting} blockedBySelf={blockedBySelf} />
    </form>
  );
}

// ============================================================
//   X / Twitter post
// ============================================================

function XPostForm({ questId, wallet, createdBy, sponsorWallet }: {
  questId: string; wallet: string; createdBy?: string | null; sponsorWallet?: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ handle: "", postUrl: "", evidenceNote: "" });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.handle.trim()) e.handle = "X handle required.";
    if (!form.postUrl.trim()) e.postUrl = "Post URL required.";
    else if (!/^https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]{1,15}\/status\/\d{5,25}/i.test(form.postUrl)) {
      e.postUrl = "Must look like https://x.com/handle/status/123… or twitter.com/…";
    }
    setErrors(e); return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true); setErrorMsg(null);
    const result = await submitMultiProof(questId, wallet, {
      handle: form.handle.replace(/^@/, "").trim(),
      postUrl: form.postUrl.trim(),
      evidenceNote: form.evidenceNote.trim() || undefined,
    });
    setSubmitting(false);
    if (result.error) { setErrorMsg(result.error); return; }
    if (result.submissionId) router.push(`/submit/${questId}?submissionId=${result.submissionId}`);
  }

  const w = wallet.toLowerCase();
  const blockedBySelf = createdBy?.toLowerCase() === w || sponsorWallet?.toLowerCase() === w;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "var(--muted)", color: "var(--ql-bear)" }}>
        ⓘ URL + author handle are validated automatically. Post content (required hashtag/mention) is verified by an admin (v1.2 free tier — no paid X API).
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>Your X handle <span style={{ color: "#B01020" }}>*</span></label>
        <input type="text" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })}
          placeholder="@yourhandle" className={inputClass}
          style={{ ...inputStyle, border: `1px solid ${errors.handle ? "#7A2020" : "var(--ql-cafe)"}` }} />
        {errors.handle && <p className={errorClass} style={errorStyle}>{errors.handle}</p>}
        <p className={helperClass} style={helperStyle}>Must match the handle in the post URL.</p>
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>Post URL <span style={{ color: "#B01020" }}>*</span></label>
        <input type="url" value={form.postUrl} onChange={(e) => setForm({ ...form, postUrl: e.target.value })}
          placeholder="https://x.com/yourhandle/status/1234567890" className={`${inputClass} font-mono`}
          style={{ ...inputStyle, border: `1px solid ${errors.postUrl ? "#7A2020" : "var(--ql-cafe)"}` }} />
        {errors.postUrl && <p className={errorClass} style={errorStyle}>{errors.postUrl}</p>}
        <p className={helperClass} style={helperStyle}>Post must remain live until reviewed. Deleted posts auto-reject.</p>
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>Note for the admin <span className="text-xs font-normal" style={{ color: "var(--ql-bear)" }}>(optional)</span></label>
        <textarea value={form.evidenceNote} onChange={(e) => setForm({ ...form, evidenceNote: e.target.value })} rows={2}
          placeholder="Anything the admin should know" className={`${inputClass} resize-none`} style={inputStyle} />
      </div>
      <WalletStrip address={wallet} />
      {errorMsg && <ErrorBox message={errorMsg} />}
      <SubmitButton label="Submit X Post" busyLabel="Submitting…" submitting={submitting} blockedBySelf={blockedBySelf} />
    </form>
  );
}

// ============================================================
//   LMS / Course completion
// ============================================================

function LmsCourseForm({ questId, wallet, createdBy, sponsorWallet }: {
  questId: string; wallet: string; createdBy?: string | null; sponsorWallet?: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ platform: "", certificateUrl: "", completionId: "", explanation: "" });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.platform.trim()) e.platform = "Platform / course name required.";
    if (!form.certificateUrl.trim() || !form.certificateUrl.startsWith("http")) e.certificateUrl = "Valid certificate URL required.";
    if (!form.explanation.trim() || form.explanation.trim().length < 30) e.explanation = "Explanation required (min 30 chars).";
    setErrors(e); return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true); setErrorMsg(null);
    const result = await submitMultiProof(questId, wallet, {
      platform: form.platform.trim(),
      certificateUrl: form.certificateUrl.trim(),
      completionId: form.completionId.trim() || undefined,
      explanation: form.explanation.trim(),
    });
    setSubmitting(false);
    if (result.error) { setErrorMsg(result.error); return; }
    if (result.submissionId) router.push(`/submit/${questId}?submissionId=${result.submissionId}`);
  }

  const w = wallet.toLowerCase();
  const blockedBySelf = createdBy?.toLowerCase() === w || sponsorWallet?.toLowerCase() === w;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "var(--muted)", color: "var(--ql-bear)" }}>
        ⓘ Course completions are admin-verified. Certificates that hide the learner name are rejected.
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>Platform / Course <span style={{ color: "#B01020" }}>*</span></label>
        <input type="text" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}
          placeholder="e.g. Coursera — Smart Contract Security" className={inputClass}
          style={{ ...inputStyle, border: `1px solid ${errors.platform ? "#7A2020" : "var(--ql-cafe)"}` }} />
        {errors.platform && <p className={errorClass} style={errorStyle}>{errors.platform}</p>}
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>Certificate URL <span style={{ color: "#B01020" }}>*</span></label>
        <input type="url" value={form.certificateUrl} onChange={(e) => setForm({ ...form, certificateUrl: e.target.value })}
          placeholder="https://coursera.org/verify/ABC123" className={`${inputClass} font-mono`}
          style={{ ...inputStyle, border: `1px solid ${errors.certificateUrl ? "#7A2020" : "var(--ql-cafe)"}` }} />
        {errors.certificateUrl && <p className={errorClass} style={errorStyle}>{errors.certificateUrl}</p>}
        <p className={helperClass} style={helperStyle}>Must be a publicly viewable certificate showing your name.</p>
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>Completion ID <span className="text-xs font-normal" style={{ color: "var(--ql-bear)" }}>(optional)</span></label>
        <input type="text" value={form.completionId} onChange={(e) => setForm({ ...form, completionId: e.target.value })}
          placeholder="Certificate ID if your platform shows one" className={`${inputClass} font-mono`}
          style={inputStyle} />
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>What did you learn? <span style={{ color: "#B01020" }}>*</span></label>
        <textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })}
          placeholder="Summarise the course and what you learnt (min 30 characters)." rows={4}
          className={`${inputClass} resize-none`}
          style={{ ...inputStyle, border: `1px solid ${errors.explanation ? "#7A2020" : "var(--ql-cafe)"}` }} />
        {errors.explanation && <p className={errorClass} style={errorStyle}>{errors.explanation}</p>}
      </div>
      <WalletStrip address={wallet} />
      {errorMsg && <ErrorBox message={errorMsg} />}
      <SubmitButton label="Submit Course Completion" busyLabel="Submitting…" submitting={submitting} blockedBySelf={blockedBySelf} />
    </form>
  );
}

// ============================================================
//   Top-level dispatcher
// ============================================================

export default function ProofSubmissionForm({
  questId, questTitle, createdBy, sponsorWallet, proofType = "github_project",
}: ProofSubmissionFormProps) {
  void questTitle; // currently unused at the dispatcher level
  const { user, authenticated, login } = usePrivy();
  const wallet = user?.wallet?.address;

  if (!authenticated || !wallet) {
    return (
      <div className="rounded-[18px] p-8 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <p className="font-serif text-lg mb-2" style={{ color: "#F0E6E2" }}>Connect your wallet to submit proof</p>
        <p className="text-sm mb-4" style={{ color: "var(--ql-bear)" }}>You need a connected wallet on Base Sepolia to participate.</p>
        <button onClick={login} className="px-6 py-3 rounded-full font-medium text-sm"
          style={{ background: "#B01020", color: "#F6F1EA" }}>Connect Wallet</button>
      </div>
    );
  }

  const shared = { questId, wallet, createdBy, sponsorWallet };

  switch (proofType) {
    case "manual_project": return <ManualProjectForm {...shared} />;
    case "discord_role":   return <DiscordRoleForm {...shared} />;
    case "x_post":         return <XPostForm {...shared} />;
    case "lms_course":     return <LmsCourseForm {...shared} />;
    case "github_project":
    default:               return <GithubProjectForm {...shared} />;
  }
}
