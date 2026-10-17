// loggingUi.js

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import type { MessageActionRowComponentBuilder } from 'discord.js';
import { EVENT_TYPES } from '../../services/loggingService.js';

/** Per-event-type toggle map stored in the guild logging config (`false` = disabled). */
export type EnabledEventsMap = Record<string, boolean | undefined>;

const EVENT_TYPES_BY_CATEGORY = Object.values(EVENT_TYPES).reduce<Record<string, string[]>>((accumulator, eventType) => {
  const [category] = eventType.split('.');
  if (!accumulator[category]) {
    accumulator[category] = [];
  }
  accumulator[category].push(eventType);
  return accumulator;
}, {});

export const DASHBOARD_CATEGORIES = [
  'moderation',
  'message',
  'role',
  'member',
  'leveling',
  'reactionrole',
  'giveaway',
  'counter',
  'application',
  'report',
];

const DASHBOARD_CATEGORY_EMOJIS: Record<string, string> = {
  moderation: '🔨',
  message: '✉️',
  role: '🏷️',
  member: '👥',
  leveling: '📈',
  reactionrole: '🎭',
  giveaway: '🎁',
  counter: '📊',
  application: '📝',
  report: '🚨',
};

export const DASHBOARD_CATEGORY_LABELS: Record<string, string> = {
  moderation: 'Moderation',
  message: 'Messages',
  role: 'Roles',
  member: 'Members',
  leveling: 'Leveling',
  reactionrole: 'Reaction Roles',
  giveaway: 'Giveaways',
  counter: 'Counters',
  application: 'Applications',
  report: 'Reports',
};

function createBackButton(): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId('log_dash_back')
    .setLabel('Back to Dashboard')
    .setStyle(ButtonStyle.Secondary);
}

function createCategoryToggleButtons(enabledEvents: EnabledEventsMap = {}, loggingEnabled: boolean = false): ActionRowBuilder<ButtonBuilder>[] {
  const buttons = DASHBOARD_CATEGORIES.map((category) => {
    const wildcardDisabled = enabledEvents[`${category}.*`] === false;
    const categoryEvents = EVENT_TYPES_BY_CATEGORY[category] || [];
    const allEnabled = categoryEvents.length === 0
      ? true
      : categoryEvents.every((t) => enabledEvents[t] !== false);
    const isEnabled = loggingEnabled && !wildcardDisabled && allEnabled;
    const emoji = DASHBOARD_CATEGORY_EMOJIS[category] || '📌';
    const label = DASHBOARD_CATEGORY_LABELS[category] || category;

    return new ButtonBuilder()
      .setCustomId(`log_dash_toggle:${category}.*`)
      .setLabel(`${emoji} ${label}`)
      .setStyle(isEnabled ? ButtonStyle.Success : ButtonStyle.Danger);
  });

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}

export function createLoggingMainMenuSelect(): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('log_dash_menu')
      .setPlaceholder('Choose a setting to configure…')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Set Audit Log Channel')
          .setDescription('Moderation, messages, members, roles, etc.')
          .setValue('set:audit')
          .setEmoji('🧾'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Set Applications Channel')
          .setDescription('New applications and review updates')
          .setValue('set:applications')
          .setEmoji('📝'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Set Reports Channel')
          .setDescription('User reports filed via /report')
          .setValue('set:reports')
          .setEmoji('🚨'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Clear Audit Channel')
          .setValue('clear:audit')
          .setEmoji('🗑️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Clear Applications Channel')
          .setValue('clear:applications')
          .setEmoji('🗑️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Clear Reports Channel')
          .setValue('clear:reports')
          .setEmoji('🗑️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Event Categories')
          .setDescription('Toggle which log types are sent')
          .setValue('view:categories')
          .setEmoji('📋'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Manage Ignore Filters')
          .setDescription('Skip logs from specific users or channels')
          .setValue('view:filters')
          .setEmoji('🔇'),
      ),
  );
}

export function createLoggingMainActionRow(loggingEnabled: boolean = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('log_dash_toggle:audit_enabled')
      .setLabel('Audit Logging')
      .setStyle(loggingEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('log_dash_refresh')
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Primary),
  );
}

export function createLoggingDashboardComponents(_enabledEvents: EnabledEventsMap | null | undefined, loggingEnabled: boolean = false): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  return [
    createLoggingMainMenuSelect(),
    createLoggingMainActionRow(loggingEnabled),
  ];
}

export function createLoggingCategoryViewComponents(enabledEvents: EnabledEventsMap | undefined, loggingEnabled: boolean = false): ActionRowBuilder<ButtonBuilder>[] {
  const categoryRows = createCategoryToggleButtons(enabledEvents, loggingEnabled);

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    createBackButton(),
    new ButtonBuilder()
      .setCustomId('log_dash_toggle:all')
      .setLabel('Toggle All Categories')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('log_dash_refresh')
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Primary),
  );

  return [...categoryRows, actionRow];
}

export function createLoggingFilterComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      createBackButton(),
      new ButtonBuilder()
        .setCustomId('log_dash_add_filter:user')
        .setLabel('Add User Filter')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('log_dash_add_filter:channel')
        .setLabel('Add Channel Filter')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('log_dash_remove_filter')
        .setLabel('Remove Filter')
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

export { EVENT_TYPES_BY_CATEGORY };
