import {
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { games } from '../utility/game';
import { currentPlayers, mention } from '../utility/player';

/* eslint-disable @typescript-eslint/naming-convention */
export const SELECT_MENU_ID = {
  CPU_COUNT: 'cpu-count',
  EXPECT_COUNT: 'expect-count',
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
    const guildId = interaction.guild?.id ?? 'あほのID';
    const at = mention(interaction.user);
    if (!(guildId in games)) {
      await interaction.reply(`${at} \`!launch\`で起動しようね`);
      return;
    }
    const value = interaction.values[0];
    games[guildId]!.cpuCount = Number(value);
    await interaction.deferUpdate();
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
    const playerId = interaction.user.id;
    const player = currentPlayers.find((p) => p.discordId === playerId);
    if (player === undefined) {
      await interaction.reply('芸術は爆発だ');
      return;
    }
    player.selectedCountExpected = Number(interaction.values[0]);
    await interaction.deferUpdate();
  },
};
