import { SlashCommandBuilder, MessageFlags, type ActionRowBuilder, type ButtonBuilder, type GuildTextBasedChannel, type Message } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createControlButtons, formatTime, startCountdown } from '../../handlers/countdownButtons.js';
import type { Command } from '../../types/index.js';

/** Live countdown state, shared with handlers/countdownButtons. */
export interface CountdownData {
    message: Message;
    endTime: number;
    remainingTime: number;
    isPaused: boolean;
    title: string;
    lastUpdate: number;
    interval: ReturnType<typeof setInterval> | null;
}

const activeCountdowns = new Map<string, CountdownData>();

export { activeCountdowns };

export default {
    data: new SlashCommandBuilder()
        .setName("countdown")
        .setDescription("Start a countdown timer")
        .addIntegerOption((option) =>
            option
                .setName("minutes")
                .setDescription("Number of minutes to count down (0-1440)")
                .setMinValue(0)
                .setMaxValue(1440)
                .setRequired(false),
        )
        .addIntegerOption((option) =>
            option
                .setName("seconds")
                .setDescription("Number of seconds to count down (0-59)")
                .setMinValue(0)
                .setMaxValue(59)
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName("title")
                .setDescription("Optional title for the countdown")
                .setRequired(false),
        ),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Countdown interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'countdown'
            });
            return;
        }

        const minutes = interaction.options.getInteger("minutes") || 0;
        const seconds = interaction.options.getInteger("seconds") || 0;
        const title = interaction.options.getString("title") || "Countdown Timer";

        const totalSeconds = minutes * 60 + seconds;

        if (totalSeconds <= 0) {
            throw new Error("Please specify a duration of at least 1 second.");
        }

        if (totalSeconds > 86400) {
            throw new Error("Countdown cannot be longer than 24 hours.");
        }

        const endTime = Date.now() + totalSeconds * 1000;
        const countdownId = `${interaction.channelId}-${Date.now()}`;

        const row = createControlButtons(countdownId) as ActionRowBuilder<ButtonBuilder>;

        const initialEmbed = successEmbed(
            `⏱️ ${title}`,
            `Time remaining: **${formatTime(totalSeconds)}**`,
        );

        const message = await (interaction.channel as GuildTextBasedChannel).send({
            embeds: [initialEmbed],
            components: [row],
        });

        const countdownData: CountdownData = {
            message,
            endTime,
            remainingTime: totalSeconds * 1000,
            isPaused: false,
            title,
            lastUpdate: Date.now(),
            interval: null,
        };

        activeCountdowns.set(countdownId, countdownData);
        startCountdown(countdownId, countdownData, activeCountdowns);

        await InteractionHelper.safeEditReply(interaction, {
            content: "✅ Countdown started!",
            flags: MessageFlags.Ephemeral,
        });
    },
} satisfies Command;