// Discord role proof. v1.2 ships the structure + OAuth scaffold; deterministic
// guild-role lookup requires the Discord bot token + guild membership to be
// configured by the operator (DISCORD_BOT_TOKEN env). If not configured, the
// adapter falls back to manual review.

import type { ProofAdapter, ValidationResult, AdapterScoringResult, PublicProofPayload, AdapterContext } from "./types";

export interface DiscordInput {
  // The required guild + role are taken from quest.requirements_json.
  evidenceNote?: string;
}

export interface DiscordEvidence {
  linkedDiscordId: string | null;
  linkedDiscordUsername: string | null;
  guildIdRequired?: string;
  roleIdRequired?: string;
  guildName?: string;
  roleName?: string;
  hasRole: boolean | null; // null when undeterminable (no bot token)
  reason: string;
}

export const discordRoleAdapter: ProofAdapter<DiscordInput, DiscordEvidence> = {
  proofType: "discord_role",
  displayName: "Discord Role",

  validateInput(_input, ctx): ValidationResult {
    const errors: string[] = [];
    if (!ctx.linkedDiscord) errors.push("Connect Discord on your profile first.");
    return { ok: errors.length === 0, errors };
  },

  async fetchEvidence(_input, ctx): Promise<DiscordEvidence> {
    const requirements = (ctx.quest.requirements_json as Record<string, string>) || {};
    const guildId = requirements.guildId;
    const roleId = requirements.roleId;
    const linked = ctx.linkedDiscord;

    if (!linked) {
      return {
        linkedDiscordId: null, linkedDiscordUsername: null,
        guildIdRequired: guildId, roleIdRequired: roleId,
        hasRole: false, reason: "Discord not linked.",
      };
    }

    // Bot-token-backed role check (only if DISCORD_BOT_TOKEN is configured).
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken || !guildId) {
      return {
        linkedDiscordId: linked.id, linkedDiscordUsername: linked.username,
        guildIdRequired: guildId, roleIdRequired: roleId,
        hasRole: null,
        reason: "Discord guild check unavailable in this deploy — admin will verify manually.",
      };
    }
    try {
      const res = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${linked.id}`,
        { headers: { Authorization: `Bot ${botToken}` } }
      );
      if (!res.ok) {
        return {
          linkedDiscordId: linked.id, linkedDiscordUsername: linked.username,
          guildIdRequired: guildId, roleIdRequired: roleId,
          hasRole: false, reason: `Guild lookup failed: ${res.status}`,
        };
      }
      const body = (await res.json()) as { roles: string[] };
      const hasRole = roleId ? body.roles.includes(roleId) : true;
      return {
        linkedDiscordId: linked.id, linkedDiscordUsername: linked.username,
        guildIdRequired: guildId, roleIdRequired: roleId,
        hasRole, reason: hasRole ? "Role confirmed." : "Required role missing.",
      };
    } catch (err) {
      return {
        linkedDiscordId: linked.id, linkedDiscordUsername: linked.username,
        guildIdRequired: guildId, roleIdRequired: roleId,
        hasRole: null,
        reason: `Discord API error: ${(err as Error).message}`,
      };
    }
  },

  async scoreEvidence(evidence): Promise<AdapterScoringResult> {
    if (evidence.hasRole === null) {
      return {
        score: 0, passed: false,
        failureReasons: [evidence.reason],
        warnings: ["Manual review required because deterministic verification is unavailable."],
        checks: [{ check_name: "discord_role", passed: false, points_awarded: 0, max_points: 100, details: evidence.reason }],
        requiresManualReview: true,
      };
    }
    if (evidence.hasRole) {
      return {
        score: 100, passed: true,
        failureReasons: [], warnings: [],
        checks: [{ check_name: "discord_role", passed: true, points_awarded: 100, max_points: 100, details: evidence.reason }],
        requiresManualReview: false,
      };
    }
    return {
      score: 0, passed: false,
      failureReasons: [evidence.reason], warnings: [],
      checks: [{ check_name: "discord_role", passed: false, points_awarded: 0, max_points: 100, details: evidence.reason }],
      requiresManualReview: false,
    };
  },

  buildPublicProofPayload(evidence): PublicProofPayload {
    return {
      proof_type: "discord_role",
      summary: `Discord role verified: ${evidence.linkedDiscordUsername ?? "—"}`,
      fields: {
        discord_username: evidence.linkedDiscordUsername,
        guild_name: evidence.guildName ?? null,
        role_name: evidence.roleName ?? null,
      },
    };
  },

  buildPrivateEvidence(evidence) {
    return {
      discord_id: evidence.linkedDiscordId,
      guild_id: evidence.guildIdRequired ?? null,
      role_id: evidence.roleIdRequired ?? null,
      hasRole: evidence.hasRole,
    };
  },

  requiresManualReview() { return false; }, // determined per-submission
  supportsAutoApproval() { return true; },
};
