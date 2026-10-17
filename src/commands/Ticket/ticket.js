import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
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
                        .setDescription("The label for the ticket creation button (default: Create Ticket)")
                        .setRequired(false)
                )
                .addChannelOption((option) =>
                    option
                        .setName("category")
                        .setDescription("The category where new tickets will be created (optional).")
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false)
                )
                .addChannelOption((option) =>
                    option
                        .setName("closed_category")
                        .setDescription("The category where closed tickets will be moved (optional).")
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false)
                )
                .addRoleOption((option) =>
                    option
                        .setName("staff_role")
                        .setDescription("The role that can access tickets (optional).")
                        .setRequired(false)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("max_tickets_per_user")
                        .setDescription("Maximum number of tickets a user can create (default: 3)")
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false)
                )
                .addBooleanOption((option) =>
                    option
                        .setName("dm_on_close")
                        .setDescription("Send DM to user when their ticket is closed (default: true)")
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
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) {
            return;
        }

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

        if (subcommand === "setup") {
            const existingConfig = await getGuildConfig(client, interaction.guildId);
            if (existingConfig?.ticketPanelChannelId) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.UNKNOWN, 
                    message: `This server already has a ticket system set up (panel in <#${existingConfig.ticketPanelChannelId}>).\n\nOnly one ticket system is supported per server. Use \`/ticket dashboard\` to edit or update the existing setup, or select **Delete System** from the dashboard to remove it and start fresh.` 
                });
            }

            const panelChannel = interaction.options.getChannel("panel_channel");
            const categoryChannel = interaction.options.getChannel("category");
            const closedCategoryChannel = interaction.options.getChannel("closed_category");
            const staffRole = interaction.options.getRole("staff_role");
            const panelMessage = interaction.options.getString("panel_message");
            const buttonLabel = interaction.options.getString("button_label") || "Create Ticket";
            const maxTicketsPerUser = interaction.options.getInteger("max_tickets_per_user") || 3;
            const dmOnClose = interaction.options.getBoolean("dm_on_close") !== false;

            // Formats the custom text layout along with the custom cloud banner asset directly
            const setupEmbed = createEmbed({ 
                description: panelMessage,
                color: getColor('info')
            }).setImage("https://discordapp.com");

            const ticketButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("create_ticket")
                    .setLabel(buttonLabel)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji("📩")
            );

            try {
                const sentPanel = await panelChannel.send({
                    embeds: [setupEmbed],
                    components: [ticketButton],
                });

                if (client.db && interaction.guildId) {
                    const currentConfig = existingConfig || {};
                    currentConfig.ticketCategoryId = categoryChannel ? categoryChannel.id : null;
                    currentConfig.ticketClosedCategoryId = closedCategoryChannel ? closedCategoryChannel.id : null;
                    currentConfig.ticketStaffRoleId = staffRole ? staffRole.id : null;
                    currentConfig.ticketPanelChannelId = panelChannel.id;
                    currentConfig.ticketPanelMessageId = sentPanel?.id || null;
                    currentConfig.ticketPanelMessage = panelMessage;
                    currentConfig.ticketButtonLabel = buttonLabel;
                    currentConfig.maxTicketsPerUser = maxTicketsPerUser;
                    currentConfig.dmOnClose = dmOnClose;

                    await setGuildConfig(client, interaction.guildId, currentConfig);
                    
                    logger.info('Ticket configuration saved successfully', {
                        guildId: interaction.guildId,
                        channelId: panelChannel.id,
                        categoryId: categoryChannel?.id || null
                    });
                }

                await interaction.editReply({
                    embeds: [successEmbed(`Ticket system setup completed successfully! Panel sent to ${panelChannel}.`)]
                });

            } catch (error) {
                logger.error(`Error executing ticket setup: ${error.message}`, error);
                await handleInteractionError(interaction, error);
            }
        }
    }
};
