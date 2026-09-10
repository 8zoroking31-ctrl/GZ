/**
 * antiNuke.js
 * Discord.js v14 Anti-Nuke Module
 *
 * Protects against:
 * - Mass channel deletion
 * - Mass role deletion
 * - Mass bans/kicks
 * - Unauthorized bot additions
 * - Webhook abuse
 * - Dangerous permission changes
 *
 * Default punishment: remove dangerous roles/permissions.
 */

const {
  AuditLogEvent,
  PermissionsBitField,
} = require("discord.js");

const DEFAULT_CONFIG = {
  enabled: true,

  // Number of suspicious actions allowed
  // before protection triggers.
  threshold: 3,

  // Time window in milliseconds.
  // 10 seconds = 10000.
  windowMs: 10000,

  // "strip" = remove dangerous permissions
  // "kick"  = kick the user if possible
  punishment: "strip",

  // Optional channel ID for alerts.
  logChannelId: null,
};

const DANGEROUS_EVENTS = new Set([
  AuditLogEvent.ChannelDelete,
  AuditLogEvent.RoleDelete,
  AuditLogEvent.BanAdd,
  AuditLogEvent.Kick,
  AuditLogEvent.BotAdd,
  AuditLogEvent.WebhookCreate,
  AuditLogEvent.WebhookDelete,
  AuditLogEvent.GuildUpdate,
  AuditLogEvent.RoleUpdate,
  AuditLogEvent.ChannelOverwriteCreate,
  AuditLogEvent.ChannelOverwriteUpdate,
  AuditLogEvent.ChannelOverwriteDelete,
]);

class AntiNuke {
  constructor(client) {
    this.client = client;

    // Guild configuration
    this.configs = new Map();

    // Whitelisted users
    this.whitelists = new Map();

    // Recent suspicious actions
    this.activity = new Map();

    this.boundHandler = (entry, guild) => {
      this.handle(entry, guild);
    };
  }

  enable() {
    this.client.on(
      "guildAuditLogEntryCreate",
      this.boundHandler
    );

    console.log("✅ Anti-nuke protection enabled.");

    return this;
  }

  disable() {
    this.client.off(
      "guildAuditLogEntryCreate",
      this.boundHandler
    );

    console.log("🛑 Anti-nuke protection disabled.");

    return this;
  }

  setConfig(guildId, changes = {}) {
    const current =
      this.configs.get(guildId) ||
      { ...DEFAULT_CONFIG };

    const updated = {
      ...current,
      ...changes,
    };

    this.configs.set(guildId, updated);

    return updated;
  }

  getConfig(guildId) {
    return {
      ...(this.configs.get(guildId) ||
        DEFAULT_CONFIG),
    };
  }

  addWhitelist(guildId, userId) {
    if (!this.whitelists.has(guildId)) {
      this.whitelists.set(guildId, new Set());
    }

    this.whitelists
      .get(guildId)
      .add(userId);
  }

  removeWhitelist(guildId, userId) {
    this.whitelists
      .get(guildId)
      ?.delete(userId);
  }

  isWhitelisted(guildId, userId) {
    return (
      this.whitelists
        .get(guildId)
        ?.has(userId) || false
    );
  }

  async handle(entry, guild) {
    try {
      if (!guild) return;

      const config = this.getConfig(guild.id);

      // Anti-nuke disabled
      if (!config.enabled) return;

      // Ignore actions that aren't dangerous
      if (!DANGEROUS_EVENTS.has(entry.action)) {
        return;
      }

      const executorId = entry.executorId;

      if (!executorId) return;

      // Never punish the bot itself.
      if (
        executorId === this.client.user?.id
      ) {
        return;
      }

      // Never punish the server owner.
      if (executorId === guild.ownerId) {
        return;
      }

      // Ignore whitelisted users.
      if (
        this.isWhitelisted(
          guild.id,
          executorId
        )
      ) {
        return;
      }

      const key =
        `${guild.id}:${executorId}`;

      const now = Date.now();

      // Get recent actions.
      const recent =
        this.activity.get(key) || [];

      // Remove actions outside the time window.
      const validActions =
        recent.filter(
          timestamp =>
            now - timestamp <=
            config.windowMs
        );

      validActions.push(now);

      this.activity.set(
        key,
        validActions
      );

      console.log(
        `[AntiNuke] ${executorId} ` +
        `performed ${validActions.length} ` +
        `dangerous actions in guild ${guild.id}`
      );

      // Threshold not reached yet.
      if (
        validActions.length <
        config.threshold
      ) {
        return;
      }

      // Reset counter so the same user
      // isn't punished repeatedly.
      this.activity.set(key, []);

      const member =
        await guild.members
          .fetch(executorId)
          .catch(() => null);

      if (!member) return;

      console.log(
        `🚨 ANTI-NUKE TRIGGERED: ` +
        `${member.user.tag}`
      );

      // -------------------------
      // KICK PUNISHMENT
      // -------------------------

      if (
        config.punishment === "kick"
      ) {
        if (member.kickable) {
          await member
            .kick(
              "Anti-nuke: suspicious destructive activity"
            )
            .catch(console.error);
        }
      }

      // -------------------------
      // STRIP PERMISSIONS
      // -------------------------

      else {
        const dangerousPermissions =
          new PermissionsBitField([
            PermissionsBitField.Flags.Administrator,

            PermissionsBitField.Flags.ManageGuild,

            PermissionsBitField.Flags.ManageChannels,

            PermissionsBitField.Flags.ManageRoles,

            PermissionsBitField.Flags.ManageWebhooks,

            PermissionsBitField.Flags.BanMembers,

            PermissionsBitField.Flags.KickMembers,

            PermissionsBitField.Flags.ManageMessages,

            PermissionsBitField.Flags.ManageThreads,

            PermissionsBitField.Flags.ManageEmojisAndStickers,
          ]);

        const roles =
          member.roles.cache.filter(
            role =>
              role.id !== guild.id &&
              role.editable &&
              role.permissions.any(
                dangerousPermissions.toArray()
              )
          );

        for (const role of roles.values()) {
          await member.roles
            .remove(
              role,
              "Anti-nuke: suspicious destructive activity"
            )
            .catch(console.error);
        }
      }

      // Send alert.
      await this.sendLog(
        guild,
        entry,
        executorId,
        config
      );

    } catch (error) {
      console.error(
        "[AntiNuke Error]",
        error
      );
    }
  }

  async sendLog(
    guild,
    entry,
    executorId,
    config
  ) {
    if (!config.logChannelId) {
      return;
    }

    const channel =
      guild.channels.cache.get(
        config.logChannelId
      );

    if (
      !channel ||
      !channel.isTextBased()
    ) {
      return;
    }

    await channel
      .send({
        content:
          `🚨 **ANTI-NUKE TRIGGERED**\n\n` +
          `👤 User: <@${executorId}>\n` +
          `⚠️ Action: \`${entry.action}\`\n` +
          `🔢 Threshold: \`${config.threshold}\`\n` +
          `⏱️ Window: \`${config.windowMs / 1000}s\`\n` +
          `🛡️ Protection has been activated.`,
      })
      .catch(console.error);
  }
}

module.exports = {
  AntiNuke,
  DEFAULT_CONFIG,
};
