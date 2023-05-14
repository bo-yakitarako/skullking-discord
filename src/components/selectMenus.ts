import {
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { games } from '../utility/game';
import { currentPlayers, mention } from '../utility/player';
import { Card, Color, convertCardSelectMenuValue } from '../utility/cards';

/* eslint-disable @typescript-eslint/naming-convention */
export const SELECT_MENU_ID = {
  CPU_COUNT: 'cpu-count',
  EXPECT_COUNT: 'expect-count',
  CARD_SELECT: 'card-select',
};
/* eslint-enable @typescript-eslint/naming-convention */

export const cpuCountSelect = {
  component: (count: number) => {
    const component = new StringSelectMenuBuilder().setCustomId(
      SELECT_MENU_ID.CPU_COUNT,
    );
    const menus = [...Array(count + 1)].map((_, index) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`${index}人`)
        .setValue(`${index}`),
    );
    menus[0].setDefault(true);
    component.addOptions(menus);
    return component;
  },
  execute: async (interaction: StringSelectMenuInteraction) => {
    await interaction.deferUpdate();
    const guildId = interaction.guild?.id ?? 'あほのID';
    const at = mention(interaction.user);
    if (!(guildId in games)) {
      await interaction.user.send(`${at} \`!launch\`で起動しようね`);
      return;
    }
    const value = interaction.values[0];
    games[guildId]!.cpuCount = Number(value);
  },
};

export const expectCountSelect = {
  component: (gameCount: number) => {
    const component = new StringSelectMenuBuilder()
      .setCustomId(SELECT_MENU_ID.EXPECT_COUNT)
      .setPlaceholder('勝利回数を予想しよう');
    const menus = [...Array(gameCount + 1)].map((_, index) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`${index}回`)
        .setValue(`${index}`),
    );
    component.addOptions(menus);
    return component;
  },
  execute: async (interaction: StringSelectMenuInteraction) => {
    await interaction.deferUpdate();
    const playerId = interaction.user.id;
    const player = currentPlayers.find((p) => p.discordId === playerId);
    if (player === undefined) {
      await interaction.user.send('芸術は爆発だ');
      return;
    }
    player.selectedCountExpected = Number(interaction.values[0]);
  },
};

export const cardSelect = {
  component: (cards: Card[], currentColor: Color | null) => {
    const hasSameColor = cards.some(
      (card) => 'color' in card && card.color === currentColor,
    );
    const component = new StringSelectMenuBuilder()
      .setCustomId(SELECT_MENU_ID.CARD_SELECT)
      .setPlaceholder('カードを選んで送信しよう');
    const menus = cards.reduce((pre, card, index) => {
      if (hasSameColor && 'color' in card && card.color !== currentColor) {
        return [...pre];
      }
      const { label, emoji } = convertCardSelectMenuValue(card);
      const value = `${index}`;
      return [
        ...pre,
        new StringSelectMenuOptionBuilder()
          .setLabel(label)
          .setValue(value)
          .setEmoji(emoji),
      ];
    }, [] as StringSelectMenuOptionBuilder[]);
    return component.addOptions(menus);
  },
  execute: async (interaction: StringSelectMenuInteraction) => {
    await interaction.deferUpdate();
    const playerId = interaction.user.id;
    const player = currentPlayers.find((p) => p.discordId === playerId);
    if (player === undefined) {
      await interaction.user.send('芸術は爆発だ');
      return;
    }
    player.selectedCardIndex = Number(interaction.values[0]);
  },
};
