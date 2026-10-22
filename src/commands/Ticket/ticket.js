import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../services/config/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

import ticketConfig from './modules/ticket_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Manages the server's ticket system.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("setup")
                .setDescription("Sets up the ticket creation panel in a specified channel.")
                .addChannelOption((option) =>
                    option
                        .setName("panel_channel")
                        .setDescription("The channel where the ticket panel will be sent.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("panel_message")
                        .setDescription("The main message/description for the ticket panel.")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("button_label")
                        .setDescription("The label for the ticket creation button.")
                        .setRequired(false)
                )
                .addChannelOption((option) =>
                    option
                        .setName("category")
                        .setDescription("The category where new tickets will be created.")
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false)
                )
                .addChannelOption((option) =>
                    option
                        .setName("closed_category")
                        .setDescription("The category where closed tickets will be moved.")
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false)
                )
                .addRoleOption((option) =>
                    option
                        .setName("staff_role")
                        .setDescription("The role that can access tickets and be pinged.")
                        .setRequired(false)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("max_tickets_per_user")
                        .setDescription("Maximum number of tickets a user can create.")
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false)
                )
                .addBooleanOption((option) =>
                    option
                        .setName("dm_on_close")
                        .setDescription("Send a DM to the user when their ticket is closed.")
                        .setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("dashboard")
                .setDescription("Open the interactive ticket system dashboard")
        ),

    category: "ticket",

    async execute(interaction, config, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral
        });

        if (!deferred) return;

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            logger.warn('Ticket command permission denied', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'ticket'
            });

            return await replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: 'You need the `Manage Channels` permission for this action.'
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "dashboard") {
            return ticketConfig.execute(interaction, config, client);
        }

        if (subcommand !== "setup") return;

        const existingConfig = await getGuildConfig(client, interaction.guildId);

        if (existingConfig?.ticketPanelChannelId) {
            return await replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: `This server already has a ticket system set up (panel in <#${existingConfig.ticketPanelChannelId}>).\n\nUse \`/ticket dashboard\` to edit the existing setup, or select **Delete System** from the dashboard to remove it.`
            });
        }

        const panelChannel = interaction.options.getChannel("panel_channel");
        const categoryChannel = interaction.options.getChannel("category");
        const closedCategoryChannel = interaction.options.getChannel("closed_category");
        const staffRole = interaction.options.getRole("staff_role");

        const panelMessage = "Purchase";

        const buttonLabel = "Purchase";

        const maxTicketsPerUser = interaction.options.getInteger("max_tickets_per_user") || 3;
        const dmOnClose = interaction.options.getBoolean("dm_on_close") !== false;

        // ====== CYANSTAR PANEL (edit these 3 values) ======
        const PANEL_COLOR = "#00E5FF";
        const PANEL_THUMBNAIL = client.user.displayAvatarURL({ extension: "png", size: 256 });
        const PANEL_BANNER = "https://YOUR_BANNER_URL.png";  // optional, set to null to remove
        // ===================================================

        const setupEmbed = createEmbed({
            title: "Support Tickets",
            description: "💲 Purchase",
            color: "#00D9E8",
            thumbnail: PANEL_THUMBNAIL
        });

        const ticketButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("create_ticket")
                .setLabel(buttonLabel)
                .setStyle(ButtonStyle.Primary)
                .setEmoji("🛒")
        );

        try {
            const sentPanel = await panelChannel.send({
                embeds: [setupEmbed],
                components: [ticketButton]
            });

            if (client.db && interaction.guildId) {
                const currentConfig = existingConfig;

                currentConfig.ticketCategoryId = categoryChannel?.id || null;
                currentConfig.ticketClosedCategoryId = closedCategoryChannel?.id || null;
                currentConfig.ticketStaffRoleId = staffRole?.id || null;
                currentConfig.ticketPanelChannelId = panelChannel.id;
                currentConfig.ticketPanelMessageId = sentPanel.id;
                currentConfig.ticketPanelMessage = panelMessage;
                currentConfig.ticketButtonLabel = buttonLabel;
                currentConfig.maxTicketsPerUser = maxTicketsPerUser;
                currentConfig.dmOnClose = dmOnClose;

                await setGuildConfig(client, interaction.guildId, currentConfig);

                logger.info('Ticket configuration saved', {
                    guildId: interaction.guildId,
                    categoryId: categoryChannel?.id,
                    closedCategoryId: closedCategoryChannel?.id,
                    staffRoleId: staffRole?.id,
                    maxTickets: maxTicketsPerUser,
                    dmOnClose
                });
            } else {
                logger.error('Ticket setup: database unavailable; configuration was not saved', {
                    guildId: interaction.guildId
                });
            }

            let successMessage = `The ticket panel has been sent to ${panelChannel}.\n\n`;
            successMessage += categoryChannel
                ? `**Ticket Category:** ${categoryChannel.name}\n`
                : '**Ticket Category:** Default Tickets category\n';

            if (closedCategoryChannel) {
                successMessage += `**Closed Category:** ${closedCategoryChannel.name}\n`;
            }

            successMessage += staffRole
                ? `**Staff Role:** ${staffRole} (will be pinged when a ticket opens)\n`
                : '**Staff Role:** Not configured\n';

            successMessage += `**Max Tickets Per User:** ${maxTicketsPerUser}\n`;
            successMessage += `**DM on Close:** ${dmOnClose ? 'Enabled' : 'Disabled'}`;

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed("Ticket Panel Set Up", successMessage)
                ]
            });

            const logEmbed = createEmbed({
                title: "Ticket System Setup",
                description: `The ticket panel was set up in ${panelChannel} by ${interaction.user}.`,
                color: getColor('warning')
            }).addFields(
                {
                    name: "Panel Channel",
                    value: panelChannel.toString(),
                    inline: true
                },
                {
                    name: "Ticket Category",
                    value: categoryChannel?.toString() || "None specified",
                    inline: true
                },
                {
                    name: "Closed Category",
                    value: closedCategoryChannel?.toString() || "None specified",
                    inline: true
                },
                {
                    name: "Staff Role",
                    value: staffRole?.toString() || "None specified",
                    inline: true
                },
                {
                    name: "Max Tickets Per User",
                    value: String(maxTicketsPerUser),
                    inline: true
                },
                {
                    name: "DM on Close",
                    value: dmOnClose ? "Enabled" : "Disabled",
                    inline: true
                },
                {
                    name: "Moderator",
                    value: `${interaction.user.tag} (${interaction.user.id})`,
                    inline: false
                }
            );

            logger.info('Ticket panel setup completed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                panelChannelId: panelChannel.id,
                categoryId: categoryChannel?.id,
                closedCategoryId: closedCategoryChannel?.id,
                staffRoleId: staffRole?.id,
                maxTickets: maxTicketsPerUser,
                dmOnClose,
                commandName: 'ticket_setup'
            });

        } catch (error) {
            logger.error('Ticket setup error', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'ticket_setup'
            });

            if (interaction.deferred || interaction.replied) {
                await replyUserError(interaction, {
                    type: ErrorTypes.UNKNOWN,
                    message: "Could not send the ticket panel or save configuration. Check the bot's channel permissions and database connection."
                }).catch(err => {
                    logger.error('Failed to send error reply', {
                        error: err.message,
                        guildId: interaction.guildId
                    });
                });
            } else {
                await handleInteractionError(interaction, error, {
                    commandName: 'ticket_setup',
                    source: 'ticket_setup_command'
                });
            }
        }
    }
};
