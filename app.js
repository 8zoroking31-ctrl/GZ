// ADD THIS TO src/app.js or create a new handler

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  
  const prefix = botConfig.commands.prefix; // Default: '$'
  
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // TICKET COMMANDS
  if (command === 'ticket') {
    const ticketService = new TicketService(client);
    const category = args[0] || 'general';
    const reason = args.slice(1).join(' ') || 'No reason';

    const isBlacklisted = await ticketService.isUserBlacklisted(message.guildId, message.author.id);
    if (isBlacklisted) {
      return message.reply('❌ You are blacklisted from creating tickets.');
    }

    try {
      const channel = await ticketService.createTicket(
        message.guild,
        message.member,
        category,
        reason
      );
      message.reply(`✅ Ticket created! ${channel.toString()}`);
    } catch (error) {
      message.reply('❌ Error creating ticket');
    }
  }

  // CLOSE TICKET
  if (command === 'close') {
    const ticketService = new TicketService(client);
    const ticketData = await ticketService.getTicketData(message.channelId);
    
    if (!ticketData) {
      return message.reply('❌ This is not a ticket channel.');
    }

    try {
      await ticketService.closeTicket(message.channel, message.author);
      message.reply('🔒 Ticket closing...');
    } catch (error) {
      message.reply('❌ Error closing ticket');
    }
  }

  // RENAME TICKET
  if (command === 'rename') {
    const newName = args.join('-') || 'renamed-ticket';
    const ticketService = new TicketService(client);
    const ticketData = await ticketService.getTicketData(message.channelId);
    
    if (!ticketData) {
      return message.reply('❌ This is not a ticket channel.');
    }

    try {
      await ticketService.renameTicket(message.channel, newName);
      message.reply(`✏️ Ticket renamed to **${newName}**`);
    } catch (error) {
      message.reply('❌ Error renaming ticket');
    }
  }

  // BLACKLIST USER
  if (command === 'blacklist') {
    const userId = args[0];
    const reason = args.slice(1).join(' ') || 'No reason';
    const ticketService = new TicketService(client);

    try {
      await ticketService.blacklistUser(message.guildId, userId, reason);
      message.reply(`✅ User <@${userId}> has been blacklisted.\nReason: ${reason}`);
    } catch (error) {
      message.reply('❌ Error blacklisting user');
    }
  }

  // UNBLACKLIST USER
  if (command === 'unblacklist') {
    const userId = args[0];
    const ticketService = new TicketService(client);

    try {
      await ticketService.unblacklistUser(message.guildId, userId);
      message.reply(`✅ User <@${userId}> has been unblacklisted.`);
    } catch (error) {
      message.reply('❌ Error unblacklisting user');
    }
  }
});
