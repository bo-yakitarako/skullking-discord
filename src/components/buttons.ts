import { ButtonBuilder, ButtonInteraction, ButtonStyle, MessageFlags } from 'discord.js';
import { battle, Skullking } from '../battle/Skullking';
import { Card } from '../battle/Card';

const flags = MessageFlags.Ephemeral;

const registration = {
  join: {
    component: new ButtonBuilder()
      .setCustomId('join')
      .setLabel('参加する')
      .setStyle(ButtonStyle.Primary),
    async execute(interaction: ButtonInteraction, skullking: Skullking) {
      await skullking.join(interaction);
    },
  },
  start: {
    component: new ButtonBuilder()
      .setCustomId('start')
      .setLabel('スタート')
      .setStyle(ButtonStyle.Success),
    async execute(interaction: ButtonInteraction, skullking: Skullking) {
      await skullking.start(interaction);
    },
  },
  cpuSet: {
    component: new ButtonBuilder()
      .setCustomId('cpuSet')
      .setLabel('決定')
      .setStyle(ButtonStyle.Primary),
    async execute(interaction: ButtonInteraction, skullking: Skullking) {
      await skullking.setCpuAndExpect(interaction);
    },
  },
  startCancel: {
    component: new ButtonBuilder()
      .setCustomId('startCancel')
      .setLabel('キャンセル')
      .setStyle(ButtonStyle.Secondary),
    async execute(interaction: ButtonInteraction) {
      await interaction.deferUpdate();
      await interaction.message.delete();
    },
  },
  expectSend: {
    component: new ButtonBuilder()
      .setCustomId('expectSend')
      .setLabel('送信')
      .setStyle(ButtonStyle.Primary),
    async execute(interaction: ButtonInteraction, skullking: Skullking) {
      const player = skullking.getInteractionPlayer(interaction);
      if (player === null) {
        await interaction.reply({ content: 'だれ？', flags });
        return;
      }
      await interaction.deferUpdate();
      await interaction.message.delete();
      await player.submitExpectation();
    },
  },
  putOut: {
    component: new ButtonBuilder()
      .setCustomId('putOut')
      .setLabel('カードを出す')
      .setStyle(ButtonStyle.Primary),
    async execute(interaction: ButtonInteraction, skullking: Skullking) {
      const player = skullking.getInteractionPlayer(interaction);
      if (player === null) {
        await interaction.reply({ content: 'だれ？', flags });
        return;
      }
      await player.putOut(interaction);
    },
  },
  tigresPirates: tigresButtonGenerator('pirate'),
  tigresEscape: tigresButtonGenerator('escape'),
  bye: {
    component: new ButtonBuilder()
      .setCustomId('bye')
      .setLabel('抜ける')
      .setStyle(ButtonStyle.Secondary),
    async execute(interaction: ButtonInteraction, skullking: Skullking) {
      await skullking.bye(interaction);
    },
  },
  reset: {
    component: new ButtonBuilder()
      .setCustomId('reset')
      .setLabel('ゲームを終わる')
      .setStyle(ButtonStyle.Secondary),
    async execute(interaction: ButtonInteraction, skullking: Skullking) {
      await skullking.reset(interaction);
    },
  },
};

function tigresButtonGenerator(type: 'pirate' | 'escape') {
  const label = type === 'pirate' ? '海賊' : '逃走';
  const emoji = Card.getTigresEmoji(type);
  const component = new ButtonBuilder()
    .setCustomId(`tigres-${type}`)
    .setLabel(label)
    .setStyle(ButtonStyle.Primary)
    .setEmoji(emoji);
  const execute = async (interaction: ButtonInteraction, skullking: Skullking) => {
    const player = skullking.getInteractionPlayer(interaction);
    if (player === null) {
      await interaction.reply({ content: 'だれ？', flags });
      return;
    }
    await interaction.message.delete();
    await interaction.deferUpdate();
    await player.selectTigres(type);
  };
  return { component, execute };
}

type CustomId = keyof typeof registration;

export const button = Object.fromEntries(
  (Object.keys(registration) as CustomId[]).map((id) => [id, registration[id].component] as const),
) as { [key in CustomId]: ButtonBuilder };

export const buttonInteraction = async (interaction: ButtonInteraction) => {
  const skullking = battle.get(interaction);
  if (skullking === null) {
    await interaction.reply({ content: '`/launch`しようね', flags });
    return;
  }
  const customId = interaction.customId as CustomId;
  await registration[customId].execute(interaction, skullking);
};
