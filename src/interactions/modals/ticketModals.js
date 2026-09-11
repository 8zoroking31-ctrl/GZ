import TicketService from '../../services/ticketService.js';

export default [
  {
    name: 'ticket_rename_modal',
    async execute(interaction) {
      const newName = interaction.fields.getTextInputValue('new_ticket_name');
      const ticketService = new TicketService(interaction.client);

      try {
        await interaction.deferReply();
        await ticketService.renameTicket(interaction.channel, newName);
        await interaction.editReply(`✏️ Ticket renamed to **${newName}**`);
      } catch (error) {
        await interaction.editReply('❌ Error renaming ticket');
      }
    },
  },
];
