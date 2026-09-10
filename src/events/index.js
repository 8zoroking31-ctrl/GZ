const {
  Client,
  GatewayIntentBits,
  Events
} = require("discord.js");

const {
  createAntiNuke
} = require("./antinuke");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const antiNuke = new Map();

client.once(Events.ClientReady, async () => {
  console.log(`PrefixByte online as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    antiNuke.set(
      guild.id,
      createAntiNuke(guild, {
        trustedUsers: [
          guild.ownerId
        ],

        // Put your dedicated logging channel ID here.
        logChannelId: null
      })
    );
  }
});

client.on(Events.ChannelDelete, async (channel) => {
  const system = antiNuke.get(channel.guild.id);

  if (system) {
    await system.handle("channelDelete");
  }
});

client.on(Events.RoleDelete, async (role) => {
  const system = antiNuke.get(role.guild.id);

  if (system) {
    await system.handle("roleDelete");
  }
});

client.on(Events.GuildBanAdd, async (ban) => {
  const system = antiNuke.get(ban.guild.id);

  if (system) {
    await system.handle("ban");
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  // Audit-log based distinction between kick/leave.
  const system = antiNuke.get(member.guild.id);

  if (system) {
    await system.handle("kick");
  }
});

client.on(Events.WebhooksUpdate, async (channel) => {
  const system = antiNuke.get(channel.guild.id);

  if (system) {
    await system.handle("webhookDelete");
  }
});

client.login(process.env.DISCORD_TOKEN);
