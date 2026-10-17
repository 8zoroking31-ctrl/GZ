import type { GuildMember } from 'discord.js';
import type { Player } from 'riffy';

export const VOICE_CHANNEL_DENIAL =
    'You need to be in the same voice channel as the bot to use music controls.';

export function canControlMusic(member: GuildMember | null | undefined, player: Player | null | undefined): boolean {
    const memberChannel = member?.voice?.channel;
    if (!memberChannel || !player?.voiceChannel) {
        return false;
    }
    return memberChannel.id === player.voiceChannel;
}

export function requireVoiceChannel(member: GuildMember | null | undefined): boolean {
    return Boolean(member?.voice?.channel);
}
