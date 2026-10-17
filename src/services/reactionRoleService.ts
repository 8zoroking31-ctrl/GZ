// reactionRoleService.js

import type { PermissionsString, Role } from 'discord.js';
import type { NexoClient } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { createError, ErrorTypes } from '../utils/errorHandler.js';
import { getReactionRoleKey, getReactionRolesPrefix } from '../utils/database/keys.js';

const MAX_ROLES_PER_MESSAGE = 25;

/** Stored reaction role panel (`guild:{guildId}:reaction_roles:{messageId}` style key from getReactionRoleKey). */
export interface ReactionRoleMessage {
    guildId: string;
    channelId: string;
    messageId: string;
    /** Role ids (select-menu panels), or emoji -> role id (legacy reaction mapping). */
    roles: string[] | Record<string, string>;
    createdAt?: string;
}

export interface ReactionRoleReconcileSummary {
    scannedGuilds: number;
    scannedMessages: number;
    removedMessages: number;
    errors: number;
}

/** Replit-era list/get results wrapped as `{ ok, value }`. */
interface WrappedListResult {
    value?: string[];
}

const DANGEROUS_PERMISSIONS: PermissionsString[] = [
    'Administrator',
    'ManageGuild',
    'ManageRoles',
    'ManageChannels',
    'ManageWebhooks',
    'BanMembers',
    'KickMembers'
];

function validateGuildId(guildId: string): void {
    if (!guildId || typeof guildId !== 'string' || !/^\d{17,19}$/.test(guildId)) {
        throw createError(
            `Invalid guild ID: ${guildId}`,
            ErrorTypes.VALIDATION,
            'Invalid server ID provided.',
            { guildId }
        );
    }
}

function validateMessageId(messageId: string): void {
    if (!messageId || typeof messageId !== 'string' || !/^\d{17,19}$/.test(messageId)) {
        throw createError(
            `Invalid message ID: ${messageId}`,
            ErrorTypes.VALIDATION,
            'Invalid message ID provided.',
            { messageId }
        );
    }
}

function validateRoleId(roleId: string): void {
    if (!roleId || typeof roleId !== 'string' || !/^\d{17,19}$/.test(roleId)) {
        throw createError(
            `Invalid role ID: ${roleId}`,
            ErrorTypes.VALIDATION,
            'Invalid role ID provided.',
            { roleId }
        );
    }
}

export function hasDangerousPermissions(role: Role | null | undefined): boolean {
    if (!role || !role.permissions) return false;
    
    for (const permission of DANGEROUS_PERMISSIONS) {
        if (role.permissions.has(permission)) {
            return true;
        }
    }
    return false;
}

async function validateRoleSafety(client: NexoClient, guildId: string, roleId: string): Promise<void> {
    const guild = client.guilds?.cache?.get(guildId) || await client.guilds?.fetch?.(guildId).catch(() => null);
    if (!guild) {
        throw createError(
            `Guild not found for role validation: ${guildId}`,
            ErrorTypes.VALIDATION,
            'Server not found while validating reaction roles.',
            { guildId, roleId }
        );
    }

    const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
        throw createError(
            `Role not found: ${roleId}`,
            ErrorTypes.VALIDATION,
            'One or more selected roles no longer exist.',
            { guildId, roleId }
        );
    }

    if (hasDangerousPermissions(role)) {
        throw createError(
            `Dangerous role permission detected: ${roleId}`,
            ErrorTypes.PERMISSION,
            'For security reasons, high-privilege roles cannot be assigned through reaction roles.',
            { guildId, roleId, roleName: role.name, dangerousPermissions: DANGEROUS_PERMISSIONS }
        );
    }

    const botHighestRole = guild.members.me?.roles?.highest;
    if (!botHighestRole || role.position >= botHighestRole.position) {
        throw createError(
            `Role above bot hierarchy: ${roleId}`,
            ErrorTypes.PERMISSION,
            'I cannot assign this role because it is equal to or above my highest role.',
            { guildId, roleId, rolePosition: role.position, botRolePosition: botHighestRole?.position }
        );
    }
}

export async function getReactionRoleMessage(client: NexoClient, guildId: string, messageId: string): Promise<ReactionRoleMessage | null> {
    try {
        validateGuildId(guildId);
        validateMessageId(messageId);
        
        const key = getReactionRoleKey(guildId, messageId);
        const data = await client.db.get<ReactionRoleMessage>(key);
        return data || null;
    } catch (error) {
        if ((error as Error).name === 'NexoBotError') {
            throw error;
        }
        logger.error(`Error getting reaction role message ${messageId} in guild ${guildId}:`, error);
        throw createError(
            `Database error retrieving reaction role message`,
            ErrorTypes.DATABASE,
            'Failed to retrieve reaction role data. Please try again.',
            { guildId, messageId, originalError: (error as Error).message }
        );
    }
}

export async function createReactionRoleMessage(
    client: NexoClient,
    guildId: string,
    channelId: string,
    messageId: string,
    roleIds: string[],
): Promise<ReactionRoleMessage> {
    try {
        validateGuildId(guildId);
        validateMessageId(messageId);
        
        if (!channelId || typeof channelId !== 'string' || !/^\d{17,19}$/.test(channelId)) {
            throw createError(
                `Invalid channel ID: ${channelId}`,
                ErrorTypes.VALIDATION,
                'Invalid channel ID provided.',
                { channelId }
            );
        }
        
        if (!Array.isArray(roleIds) || roleIds.length === 0) {
            throw createError(
                'No roles provided',
                ErrorTypes.VALIDATION,
                'You must provide at least one role.',
                { roleIds }
            );
        }
        
        if (roleIds.length > MAX_ROLES_PER_MESSAGE) {
            throw createError(
                `Too many roles: ${roleIds.length}`,
                ErrorTypes.VALIDATION,
                `You can only add up to ${MAX_ROLES_PER_MESSAGE} roles per reaction role message.`,
                { roleIds, limit: MAX_ROLES_PER_MESSAGE }
            );
        }

        for (const roleId of roleIds) {
            validateRoleId(roleId);
            await validateRoleSafety(client, guildId, roleId);
        }
        
        const reactionRoleData: ReactionRoleMessage = {
            guildId,
            channelId,
            messageId,
            roles: roleIds,
            createdAt: new Date().toISOString()
        };
        
        const key = getReactionRoleKey(guildId, messageId);
        await client.db.set(key, reactionRoleData);
        
        logger.info(`Created reaction role message ${messageId} in guild ${guildId} with ${roleIds.length} roles`);
        return reactionRoleData;
    } catch (error) {
        if ((error as Error).name === 'NexoBotError') {
            throw error;
        }
        logger.error(`Error creating reaction role message in guild ${guildId}:`, error);
        throw createError(
            `Database error creating reaction role message`,
            ErrorTypes.DATABASE,
            'Failed to save reaction role data. Please try again.',
            { guildId, messageId, originalError: (error as Error).message }
        );
    }
}

export async function addReactionRole(client: NexoClient, guildId: string, messageId: string, emoji: string, roleId: string): Promise<boolean> {
    try {
        validateGuildId(guildId);
        validateMessageId(messageId);
        validateRoleId(roleId);
        await validateRoleSafety(client, guildId, roleId);
        
        const key = getReactionRoleKey(guildId, messageId);
        const data: ReactionRoleMessage = await getReactionRoleMessage(client, guildId, messageId) || {
            messageId,
            guildId,
            channelId: '',
            roles: {}
        };

        (data.roles as Record<string, string>)[emoji] = roleId;
        
        await client.db.set(key, data);
        logger.info(`Added reaction role for emoji ${emoji} to message ${messageId} in guild ${guildId}`);
        return true;
    } catch (error) {
        if ((error as Error).name === 'NexoBotError') {
            throw error;
        }
        logger.error(`Error adding reaction role in guild ${guildId}:`, error);
        throw createError(
            `Database error adding reaction role`,
            ErrorTypes.DATABASE,
            'Failed to add reaction role. Please try again.',
            { guildId, messageId, originalError: (error as Error).message }
        );
    }
}

export async function deleteReactionRoleMessage(client: NexoClient, guildId: string, messageId: string): Promise<boolean> {
    try {
        validateGuildId(guildId);
        validateMessageId(messageId);
        
        const key = getReactionRoleKey(guildId, messageId);
        const data = await getReactionRoleMessage(client, guildId, messageId);
        
        if (!data) {
            
            logger.debug(`Reaction role message ${messageId} does not exist in guild ${guildId}, nothing to delete`);
            return true;
        }
        
        await client.db.delete(key);
        logger.info(`Deleted reaction role message ${messageId} in guild ${guildId}`);
        return true;
    } catch (error) {
        if ((error as Error).name === 'NexoBotError') {
            throw error;
        }
        logger.error(`Error deleting reaction role message in guild ${guildId}:`, error);
        throw createError(
            `Database error deleting reaction role message`,
            ErrorTypes.DATABASE,
            'Failed to delete reaction role message. Please try again.',
            { guildId, messageId, originalError: (error as Error).message }
        );
    }
}

export async function removeReactionRole(client: NexoClient, guildId: string, messageId: string, emoji: string): Promise<boolean> {
    try {
        validateGuildId(guildId);
        validateMessageId(messageId);
        
        const key = getReactionRoleKey(guildId, messageId);
        const data = await getReactionRoleMessage(client, guildId, messageId);
        
        if (!data || !(data.roles as Record<string, string>)[emoji]) {
            return false;
        }

        delete (data.roles as Record<string, string>)[emoji];

        if (Object.keys(data.roles).length === 0) {
            await client.db.delete(key);
            logger.info(`Removed last reaction role from message ${messageId}, deleted message data`);
        } else {
            await client.db.set(key, data);
            logger.info(`Removed reaction role for emoji ${emoji} from message ${messageId}`);
        }
        
        return true;
    } catch (error) {
        if ((error as Error).name === 'NexoBotError') {
            throw error;
        }
        logger.error(`Error removing reaction role in guild ${guildId}:`, error);
        throw createError(
            `Database error removing reaction role`,
            ErrorTypes.DATABASE,
            'Failed to remove reaction role. Please try again.',
            { guildId, messageId, originalError: (error as Error).message }
        );
    }
}

export async function getAllReactionRoleMessages(client: NexoClient, guildId: string): Promise<ReactionRoleMessage[]> {
    try {
        validateGuildId(guildId);
        
        const prefix = getReactionRolesPrefix(guildId);
        
        let keys: unknown;
        try {
            keys = await client.db.list(prefix);
            
            if (keys && typeof keys === 'object') {
                if (Array.isArray(keys)) {
                    
                } else if ((keys as WrappedListResult).value && Array.isArray((keys as WrappedListResult).value)) {
                    keys = (keys as WrappedListResult).value;
                } else {
                    // list() without a prefix is outside the typed store contract; legacy fallback kept as is.
                    const allKeys: unknown = await (client.db.list as (prefix?: string) => Promise<unknown>)();
                    
                    if (Array.isArray(allKeys)) {
                        keys = (allKeys as string[]).filter(key => key.startsWith(prefix));
                    } else if ((allKeys as WrappedListResult).value && Array.isArray((allKeys as WrappedListResult).value)) {
                        keys = (allKeys as WrappedListResult).value!.filter(key => key.startsWith(prefix));
                    } else {
                        return [];
                    }
                }
            } else {
                return [];
            }
        } catch (listError) {
            logger.error(`Error listing reaction role keys for guild ${guildId}:`, listError);
            throw createError(
                'Database error listing reaction roles',
                ErrorTypes.DATABASE,
                'Failed to retrieve reaction role list. Please try again.',
                { guildId, originalError: (listError as Error).message }
            );
        }
        
        if (!keys || (keys as string[]).length === 0) {
            return [];
        }

        const messages: ReactionRoleMessage[] = [];
        
        for (const key of keys as string[]) {
            try {
                const data = await client.db.get<ReactionRoleMessage & { ok?: unknown; value?: ReactionRoleMessage }>(key);
                
                if (data) {
                    let actualData: ReactionRoleMessage | undefined;
                    if (data && data.ok && data.value) {
                        actualData = data.value;
                    } else if (data && data.value) {
                        actualData = data.value;
                    } else {
                        actualData = data;
                    }
                    
                    if (actualData && actualData.messageId && actualData.channelId) {
                        messages.push(actualData);
                    } else if (actualData) {
                        logger.warn(`Skipping malformed reaction role data for guild ${guildId}:`, actualData);
                    }
                }
            } catch (dataError) {
                logger.warn(`Error getting data for reaction role key ${key}:`, dataError);
                
            }
        }

        return messages;
    } catch (error) {
        if ((error as Error).name === 'NexoBotError') {
            throw error;
        }
        logger.error(`Error getting all reaction role messages for guild ${guildId}:`, error);
        throw createError(
            'Database error retrieving reaction roles',
            ErrorTypes.DATABASE,
            'Failed to retrieve reaction role messages. Please try again.',
            { guildId, originalError: (error as Error).message }
        );
    }
}

export async function setReactionRoleChannel(client: NexoClient, guildId: string, messageId: string, channelId: string): Promise<boolean> {
    try {
        validateGuildId(guildId);
        validateMessageId(messageId);
        
        if (!channelId || typeof channelId !== 'string' || !/^\d{17,19}$/.test(channelId)) {
            throw createError(
                `Invalid channel ID: ${channelId}`,
                ErrorTypes.VALIDATION,
                'Invalid channel ID provided.',
                { channelId }
            );
        }
        
        const key = getReactionRoleKey(guildId, messageId);
        const data: ReactionRoleMessage = await getReactionRoleMessage(client, guildId, messageId) || {
            messageId,
            guildId,
            channelId: '',
            roles: {}
        };

        data.channelId = channelId;
        await client.db.set(key, data);
        logger.info(`Set channel ${channelId} for reaction role message ${messageId}`);
        return true;
    } catch (error) {
        if ((error as Error).name === 'NexoBotError') {
            throw error;
        }
        logger.error(`Error setting channel for reaction role message ${messageId}:`, error);
        throw createError(
            `Database error setting reaction role channel`,
            ErrorTypes.DATABASE,
            'Failed to update reaction role channel. Please try again.',
            { guildId, messageId, channelId, originalError: (error as Error).message }
        );
    }
}

export async function reconcileReactionRoleMessages(client: NexoClient, guildId: string | null = null): Promise<ReactionRoleReconcileSummary> {
    const summary: ReactionRoleReconcileSummary = {
        scannedGuilds: 0,
        scannedMessages: 0,
        removedMessages: 0,
        errors: 0
    };

    try {
        const targetGuildIds = guildId
            ? [guildId]
            : Array.from(client.guilds.cache.keys());

        for (const targetGuildId of targetGuildIds) {
            summary.scannedGuilds += 1;

            let reactionRoleMessages: ReactionRoleMessage[] = [];
            try {
                reactionRoleMessages = await getAllReactionRoleMessages(client, targetGuildId);
            } catch (error) {
                summary.errors += 1;
                logger.warn(`Failed to fetch reaction role messages for reconciliation in guild ${targetGuildId}:`, error);
                continue;
            }

            if (!reactionRoleMessages.length) {
                continue;
            }

            const guild = client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null);
            if (!guild) {
                for (const reactionRoleMessage of reactionRoleMessages) {
                    summary.scannedMessages += 1;
                    await client.db.delete(getReactionRoleKey(targetGuildId, reactionRoleMessage.messageId));
                    summary.removedMessages += 1;
                }
                logger.info(`Removed ${reactionRoleMessages.length} stale reaction role message(s) for unavailable guild ${targetGuildId}`);
                continue;
            }

            for (const reactionRoleMessage of reactionRoleMessages) {
                summary.scannedMessages += 1;

                try {
                    const channel = guild.channels.cache.get(reactionRoleMessage.channelId)
                        || await guild.channels.fetch(reactionRoleMessage.channelId).catch(() => null);

                    if (!channel || !channel.isTextBased?.()) {
                        await client.db.delete(getReactionRoleKey(targetGuildId, reactionRoleMessage.messageId));
                        summary.removedMessages += 1;
                        continue;
                    }

                    const message = await channel.messages.fetch(reactionRoleMessage.messageId).catch(() => null);
                    if (!message) {
                        await client.db.delete(getReactionRoleKey(targetGuildId, reactionRoleMessage.messageId));
                        summary.removedMessages += 1;
                    }
                } catch (messageCheckError) {
                    summary.errors += 1;
                    logger.warn(
                        `Failed to validate reaction role message ${reactionRoleMessage.messageId} during reconciliation:`,
                        messageCheckError
                    );
                }
            }
        }

        logger.info(
            `Reaction role reconciliation complete: scanned ${summary.scannedMessages} message(s) across ${summary.scannedGuilds} guild(s), removed ${summary.removedMessages}, errors ${summary.errors}`
        );

        return summary;
    } catch (error) {
        logger.error('Unexpected error during reaction role reconciliation:', error);
        summary.errors += 1;
        return summary;
    }
}