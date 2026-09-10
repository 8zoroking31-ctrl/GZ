
import { AuditLogEvent } from 'discord.js';
import { handleAuditLogEntry } from '../services/antiNukeService.js';

export default {
    name: 'guildAuditLogEntryCreate',

    async execute(entry, guild, client) {
        if (!entry || !guild) return;

        await handleAuditLogEntry({
            entry,
            guild,
            client,
            AuditLogEvent,
        });
    },
};
