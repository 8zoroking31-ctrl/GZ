import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, StringSelectMenuBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getColor } from '../config/bot.js';

const botConfig = (await import('../config/bot.js')).botConfig;

export class TicketService {
  constructor(client) {
    this.client = client;
    this.db = client.db;
  }

  // CREATE TICKET
  async createTicket(guild, member, category, reason = 'No reason provided', panelType = 'general') {
    try {
      const ticketConfig = botConfig.tickets;
      const ticketNumber = await this.getNextTicketNumber(guild.id);
      const channelName = `${panelType}-ticket-${ticketNumber}`;

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: ticketConfig.defaultCategory,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: ['ViewChannel'],
          },
          {
            id: member.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
          },
          ...(ticketConfig.supportRoles?.map(roleId => ({
            id: roleId,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'],
          })) || []),
        ],
        topic: `Ticket #${ticketNumber} - ${category} - ${panelType}`,
      });

      await this.db.query(
        `INSERT INTO tickets (guild_id, channel_id, ticket_number, member_id, category, panel_type, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [guild.id, channel.id, ticketNumber, member.id, category, panelType, 'open']
      );

      const embed = new EmbedBuilder()
        .setColor(getColor('ticket.open'))
        .setTitle(`📋 Ticket #${ticketNumber}`)
        .setDescription(`**Category:** ${category}\n**Panel:** ${panelType}\n**Status:** Open`)
        .addFields(
          { name: '👤 Member', value: member.toString(), inline: true },
          { name: '📝 Reason', value: reason, inline: false }
        )
        .setFooter({ text: `Ticket ID: ${channel.id}` })
        .setTimestamp();

      const actionRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('ticket_claim')
            .setLabel('Claim Ticket')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('ticket_rename')
            .setLabel('Rename Ticket')
            .setStyle(ButtonStyle.Secondary)
        );

      await channel.send({ embeds: [embed], components: [actionRow] });

      if (ticketConfig.supportRoles?.length > 0) {
        const mentions = ticketConfig.supportRoles.map(roleId => `<@&${roleId}>`).join(' ');
        await channel.send(`${mentions} A new **${panelType}** ticket has been created!`);
      }

      await this.logTicket(guild, 'CREATED', { ticketNumber, member, category, channel, panelType });
      return channel;
    } catch (error) {
      logger.error('Error creating ticket:', error);
      throw error;
    }
  }

  // CLOSE TICKET
  async closeTicket(channel, closedBy) {
    try {
      const ticketData = await this.getTicketData(channel.id);

      if (!ticketData) {
        throw new Error('Ticket data not found');
      }

      await this.db.query(
        `UPDATE tickets SET status = $1, closed_by = $2, closed_at = NOW() WHERE channel_id = $3`,
        ['closed', closedBy.id, channel.id]
      );

      const embed = new EmbedBuilder()
        .setColor(getColor('ticket.closed'))
        .setTitle('🔒 Ticket Closed')
        .setDescription(`This ticket has been closed by ${closedBy.toString()}`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      await this.logTicket(channel.guild, 'CLOSED', {
        ticketNumber: ticketData.ticket_number,
        closedBy,
        channel,
      });

      setTimeout(() => channel.delete().catch(err => logger.error('Error deleting ticket channel:', err)), 5000);
    } catch (error) {
      logger.error('Error closing ticket:', error);
      throw error;
    }
  }

  // RENAME TICKET
  async renameTicket(channel, newName) {
    try {
      await channel.setName(newName);
      const embed = new EmbedBuilder()
        .setColor(getColor('primary'))
        .setDescription(`✏️ Ticket renamed to **${newName}**`)
        .setTimestamp();
      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Error renaming ticket:', error);
      throw error;
    }
  }

  // CLAIM TICKET
  async claimTicket(channel, staffMember) {
    try {
      const ticketData = await this.getTicketData(channel.id);
      if (!ticketData) throw new Error('Ticket data not found');

      await this.db.query(
        `UPDATE tickets SET claimed_by = $1, status = $2 WHERE channel_id = $3`,
        [staffMember.id, 'claimed', channel.id]
      );

      const embed = new EmbedBuilder()
        .setColor(getColor('ticket.claimed'))
        .setDescription(`✅ ${staffMember.toString()} has claimed this ticket`)
        .setTimestamp();
      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Error claiming ticket:', error);
      throw error;
    }
  }

  // GET TICKET DATA
  async getTicketData(channelId) {
    try {
      const result = await this.db.query(
        `SELECT * FROM tickets WHERE channel_id = $1 LIMIT 1`,
        [channelId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching ticket data:', error);
      return null;
    }
  }

  // GET NEXT TICKET NUMBER
  async getNextTicketNumber(guildId) {
    try {
      const result = await this.db.query(
        `SELECT MAX(ticket_number) as max_number FROM tickets WHERE guild_id = $1`,
        [guildId]
      );
      return (result.rows[0]?.max_number || 0) + 1;
    } catch (error) {
      logger.error('Error getting next ticket number:', error);
      return 1;
    }
  }

  // LOG TICKET ACTIONS
  async logTicket(guild, action, data) {
    try {
      const ticketConfig = botConfig.tickets;
      if (!ticketConfig.logChannel) return;

      const logChannel = await guild.channels.fetch(ticketConfig.logChannel).catch(() => null);
      if (!logChannel) return;

      let description = '';
      if (action === 'CREATED') {
        description = `**Ticket #${data.ticketNumber}** created by ${data.member.toString()}\n**Category:** ${data.category}\n**Panel:** ${data.panelType}\n**Channel:** ${data.channel.toString()}`;
      } else if (action === 'CLOSED') {
        description = `**Ticket #${data.ticketNumber}** closed by ${data.closedBy.toString()}`;
      }

      const embed = new EmbedBuilder()
        .setColor(action === 'CREATED' ? getColor('success') : getColor('error'))
        .setTitle(`📋 Ticket ${action}`)
        .setDescription(description)
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(err => logger.error('Error sending log:', err));
    } catch (error) {
      logger.error('Error logging ticket:', error);
    }
  }

  // BLACKLIST USER
  async blacklistUser(guildId, userId, reason = 'No reason provided') {
    try {
      await this.db.query(
        `INSERT INTO ticket_blacklist (guild_id, user_id, reason, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (guild_id, user_id) DO UPDATE SET reason = $3, created_at = NOW()`,
        [guildId, userId, reason]
      );
      return true;
    } catch (error) {
      logger.error('Error blacklisting user:', error);
      return false;
    }
  }

  // UNBLACKLIST USER
  async unblacklistUser(guildId, userId) {
    try {
      await this.db.query(
        `DELETE FROM ticket_blacklist WHERE guild_id = $1 AND user_id = $2`,
        [guildId, userId]
      );
      return true;
    } catch (error) {
      logger.error('Error removing user from blacklist:', error);
      return false;
    }
  }

  // CHECK IF BLACKLISTED
  async isUserBlacklisted(guildId, userId) {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM ticket_blacklist WHERE guild_id = $1 AND user_id = $2 LIMIT 1`,
        [guildId, userId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking blacklist:', error);
      return false;
    }
  }

  // CREATE TICKET PANEL
  async createTicketPanel(guild, channelId, panelName, categories, description = '') {
    try {
      const channel = await guild.channels.fetch(channelId);
      
      const embed = new EmbedBuilder()
        .setColor(getColor('primary'))
        .setTitle(`📋 ${panelName}`)
        .setDescription(description || `Click below to create a **${panelName}** ticket`)
        .setTimestamp();

      const options = categories.map((cat, index) => ({
        label: cat.name,
        value: `ticket_panel_${panelName.toLowerCase().replace(/\s+/g, '_')}_${cat.id}`,
        description: cat.description,
        emoji: cat.emoji || '📋',
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`ticket_panel_${panelName.toLowerCase().replace(/\s+/g, '_')}`)
        .setPlaceholder(`Select a ${panelName} category`)
        .addOptions(options);

      const actionRow = new ActionRowBuilder().addComponents(selectMenu);

      await this.db.query(
        `INSERT INTO ticket_panels (guild_id, channel_id, panel_name, categories, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (guild_id, panel_name) DO UPDATE SET categories = $4, channel_id = $2`,
        [guild.id, channelId, panelName, JSON.stringify(categories)]
      );

      await channel.send({ embeds: [embed], components: [actionRow] });
      return true;
    } catch (error) {
      logger.error('Error creating ticket panel:', error);
      throw error;
    }
  }
}

export default TicketService;
