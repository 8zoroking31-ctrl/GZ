import { SlashCommandBuilder } from 'discord.js';

export default {
    slashOnly: true,

    data: new SlashCommandBuilder()
        .setName('pčr')
        .setDescription('Základní informace o Policii České republiky'),

    category: 'Community',

    async execute(interaction) {
        await interaction.reply({
            content:
                '🇨🇿 **Policie České republiky (PČR)**\n\n' +
                '🚔 Policie ČR je bezpečnostní sbor České republiky.\n' +
                '🛡️ Zajišťuje ochranu osob a majetku, veřejný pořádek a odhalování trestné činnosti.\n\n' +
                '📌 Pro více informací použij:\n' +
                '`/hodnost` – policejní hodnosti\n' +
                '`/utvar` – útvary PČR\n' +
                '`/vozidlo` – policejní vozidla'
        });
    }
};
