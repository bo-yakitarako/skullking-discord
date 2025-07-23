import {
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { battle, Skullking } from '../battle/Skullking';
import { Player } from '../battle/Player';
import { Card, Color } from '../battle/Card';

const flags = MessageFlags.Ephemeral;

const registration = {
  cpuCount: {
    component: (count: number) => {
      const options = [...Array(count + 1)].map((_, index) =>
        new StringSelectMenuOptionBuilder().setLabel(`${index}人`).setValue(`${index}`),
      );
      options[0].setDefault(true);
      return new StringSelectMenuBuilder().setCustomId('cpuCount').addOptions(options);
    },
    async execute(interaction: StringSelectMenuInteraction, skullking: Skullking) {
      await interaction.deferUpdate();
      skullking.setCpuCount(interaction);
    },
  },
  expectCount: {
    component: (gameCount: number) => {
      const options = [...Array(gameCount + 1)].map((_, index) =>
        new StringSelectMenuOptionBuilder().setLabel(`${index}回`).setValue(`${index}`),
      );
      options[0].setDefault(true);
      return new StringSelectMenuBuilder().setCustomId('expectCount').addOptions(options);
    },
    async execute(interaction: StringSelectMenuInteraction, skullking: Skullking) {
      const player = skullking.getInteractionPlayer(interaction);
      if (player === null) {
        await interaction.reply({ content: 'ほ？', flags });
        return;
      }
      await interaction.deferUpdate();
      player.selectExpecting(interaction);
    },
  },
  cardSelect: {
    component: (cards: Card[], currentColor: Color | null) => {
      const indexes = Player.filterCardIndexes(cards, currentColor);
      const menus = indexes.map((index) => {
        const { label, emoji } = cards[index].selectMenuValue;
        return new StringSelectMenuOptionBuilder()
          .setLabel(label)
          .setValue(`${index}`)
          .setEmoji(emoji);
      });
      return new StringSelectMenuBuilder()
        .setCustomId('cardSelect')
        .setPlaceholder('カードを選んで送信しよう')
        .addOptions(menus);
    },
    async execute(interaction: StringSelectMenuInteraction, skullking: Skullking) {
      const player = skullking.getInteractionPlayer(interaction);
      if (player === null) {
        await interaction.reply({ content: 'ほ？', flags });
        return;
      }
      await interaction.deferUpdate();
      player.selectCard(interaction);
    },
  },
  history: {
    component: (attendees: Player[]) => {
      const menus = attendees.map(({ name }, index) =>
        new StringSelectMenuOptionBuilder().setLabel(`${name}くんの戦績`).setValue(`${index}`),
      );
      return new StringSelectMenuBuilder()
        .setCustomId('history')
        .setPlaceholder('戦績見ちゃう？')
        .addOptions(menus);
    },
    async execute(interaction: StringSelectMenuInteraction, skullking: Skullking) {
      const player = skullking.getAttendee(Number(interaction.values[0]));
      await interaction.reply({ embeds: [player.buildHistoryEmbed()], flags });
    },
  },
};

type CustomId = keyof typeof registration;

export const selectMenu = { ...registration };

export const selectMenuInteraction = async (interaction: StringSelectMenuInteraction) => {
  const skullking = battle.get(interaction);
  if (skullking === null) {
    const flags = MessageFlags.Ephemeral;
    await interaction.reply({ content: '`/launch`しようね', flags });
    return;
  }
  const customId = interaction.customId as CustomId;
  await registration[customId].execute(interaction, skullking);
};
