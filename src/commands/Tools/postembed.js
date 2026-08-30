import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';

const MAX_JSON_BYTES = 100_000; // embeds are tiny; reject anything larger

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('postembed')
        .setDescription('Post an embed from raw JSON - paste it, or attach a .txt/.json file')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(o =>
            o.setName('json')
             .setDescription('Embed JSON: a single embed object or {"content":..., "embeds":[...]}')
             .setRequired(false))
        .addAttachmentOption(o =>
            o.setName('file')
             .setDescription('A .txt or .json file with the embed JSON (alternative to the json option)')
             .setRequired(false)),

    async execute(interaction) {
        // Defense-in-depth: setDefaultMemberPermissions can be overridden in Server Settings.
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: '⛔ You need the **Manage Messages** permission to use this.', flags: MessageFlags.Ephemeral });
        }
        if (!interaction.channel) {
            return interaction.reply({ content: '❌ Run this in a normal server text channel.', flags: MessageFlags.Ephemeral });
        }

        const jsonOpt = interaction.options.getString('json');
        const fileOpt = interaction.options.getAttachment('file');

        if (!jsonOpt && !fileOpt) {
            return interaction.reply({ content: '❌ Provide either the `json` text option or a `file` attachment.', flags: MessageFlags.Ephemeral });
        }
        if (jsonOpt && fileOpt) {
            return interaction.reply({ content: '❌ Provide only one of `json` or `file`, not both.', flags: MessageFlags.Ephemeral });
        }

        // Reading an attachment is network I/O -> defer so we don't hit the 3s interaction timeout.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let raw;
        if (fileOpt) {
            const name = (fileOpt.name || '').toLowerCase();
            if (!name.endsWith('.txt') && !name.endsWith('.json')) {
                return interaction.editReply({ content: '❌ Attachment must be a `.txt` or `.json` file.' });
            }
            if (fileOpt.size > MAX_JSON_BYTES) {
                return interaction.editReply({ content: `❌ File too large (${fileOpt.size} bytes; max ${MAX_JSON_BYTES}).` });
            }
            try {
                const res = await fetch(fileOpt.url);
                if (!res.ok) {
                    return interaction.editReply({ content: `❌ Couldn't download the attachment (HTTP ${res.status}).` });
                }
                raw = await res.text();
            } catch (err) {
                return interaction.editReply({ content: `❌ Couldn't read the attachment: ${err.message}` });
            }
        } else {
            raw = jsonOpt;
        }

        // Parse
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (err) {
            return interaction.editReply({ content: `❌ Invalid JSON: ${err.message}` });
        }

        // Normalize to an embeds array (accept Discohook/webhook payloads or a bare embed object)
        let embedObjects;
        let content;
        if (parsed && Array.isArray(parsed.embeds)) {
            embedObjects = parsed.embeds;
            if (typeof parsed.content === 'string' && parsed.content.trim().length > 0) content = parsed.content;
        } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            embedObjects = [parsed];
        } else {
            return interaction.editReply({ content: '❌ JSON must be an embed object, or an object with an `embeds` array.' });
        }

        if (embedObjects.length === 0) return interaction.editReply({ content: '❌ No embed found in the JSON.' });
        if (embedObjects.length > 10) return interaction.editReply({ content: `❌ Discord allows at most 10 embeds per message (you provided ${embedObjects.length}).` });

        // Build the embeds (final validation happens at send)
        let embeds;
        try {
            embeds = embedObjects.map(o => EmbedBuilder.from(o));
        } catch (err) {
            return interaction.editReply({ content: `❌ Invalid embed structure: ${err.message}` });
        }

        // Post to the current channel. allowedMentions neutralized so a crafted
        // payload can't @everyone/@here/ping roles via the content field.
        try {
            await interaction.channel.send({ content, embeds, allowedMentions: { parse: [] } });
        } catch (err) {
            return interaction.editReply({ content: `❌ Couldn't post here: ${err.message}\n(Confirm I have **Send Messages** + **Embed Links** in this channel.)` });
        }

        return interaction.editReply({ content: '✅ Embed posted.' });
    },
};
