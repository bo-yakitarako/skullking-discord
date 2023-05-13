import {
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { games } from '../utility/game';
import { mention } from '../utility/player';

/* eslint-disable @typescript-eslint/naming-convention */
export const SELECT_MENU_ID = {
  CPU_COUNT: 'cpu-count',
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
