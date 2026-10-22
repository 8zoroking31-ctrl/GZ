import { MessageFlags } from 'discord.js';
import { createTicket } from '../../../services/ticket.js';
import { getGuildConfig } from '../../../services/config/guildConfig.js';
import { successEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

export default {
  name: 'purchase_ticket_modal',
  async execute(interaction, client, args = []) {
    try {
      if (!interaction.inGuild()) {
        await interaction.reply({ content: 'This can only be used in a server.', flags: MessageFlags.Ephemeral });
        return;
      }

      const category = args[0];
      if (!['Fortnite', 'Spotify', 'Discord'].includes(category)) {
        await interaction.reply({ content: 'Invalid purchase category. Please start again from the purchase button.', flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const details = interaction.fields.getTextInputValue('details').trim();
      const config = await getGuildConfig(client, interaction.guildId);
      const { channel } = await createTicket(
        interaction.guild,
        interaction.member,
        config.ticketCategoryId || null,
        details,
        'none',
        category
      );

      await interaction.editReply({
        embeds: [successEmbed('Purchase Ticket Created', `Your **${category}** purchase ticket is ready: ${channel}`)]
      });
    } catch (error) {
      logger.error('Error submitting purchase ticket form:', error);
      await handleInteractionError(interaction, error, { type: 'modal', handler: 'purchase_ticket_modal', customId: interaction.customId });
    }
  }
};
