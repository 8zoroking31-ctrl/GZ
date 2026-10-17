import { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types/index.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
const SUPPORT_URL = "https://github.com/Robertwlt03/NexoBot/issues";
export default {
    data: new SlashCommandBuilder()
    .setName("support")
    .setDescription("Get help and report issues on GitHub"),

  async execute(interaction) {
    try {
      const supportButton = new ButtonBuilder()
        .setLabel("Open GitHub Issues")
        .setStyle(ButtonStyle.Link)
        .setURL(SUPPORT_URL);

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(supportButton);

      await InteractionHelper.safeReply(interaction, {
        embeds: [
          createEmbed({ title: "Need Help?", description: "Need help, found a bug or have a feature idea? Open an issue on GitHub." }),
        ],
        components: [actionRow],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('Support command error:', error);
      
      try {
        return await InteractionHelper.safeReply(interaction, {
          embeds: [createEmbed({ title: 'System Error', description: 'Could not display support information.', color: 'error' })],
          flags: MessageFlags.Ephemeral,
        });
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
} satisfies Command;