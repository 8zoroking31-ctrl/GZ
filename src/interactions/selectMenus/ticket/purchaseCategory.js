import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../../utils/logger.js';

export default {
  name: 'purchase_category',
  async execute(interaction) {
    const category = interaction.values?.[0];
    if (!['Fortnite', 'Spotify', 'Discord'].includes(category)) {
      await interaction.reply({ content: 'Please choose a valid purchase category.', flags: MessageFlags.Ephemeral });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`purchase_ticket_modal:${category}`)
      .setTitle(`${category} Purchase Ticket`);

    const details = new TextInputBuilder()
      .setCustomId('details')
      .setLabel('What would you like to purchase?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Include the product and any details we need.')
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(details));
    try {
      await interaction.showModal(modal);
    } catch (error) {
      logger.error('Could not show purchase ticket modal:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Could not open the purchase form. Please try again.', flags: MessageFlags.Ephemeral });
      }
    }
  }
};
