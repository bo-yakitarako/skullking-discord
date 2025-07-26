import {
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  MessageCreateOptions,
  MessageFlags,
} from 'discord.js';
import { battle, Skullking } from '../battle/Skullking';
import { makeButtonRow } from '../utils';

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
      .setLabel('CPU人数を決定')
      .setStyle(ButtonStyle.Primary),
    async execute(interaction: ButtonInteraction, skullking: Skullking) {
      await skullking.setCpuAndExpect(interaction);
    },
  },
  expectSend: {
    component: new ButtonBuilder()
      .setCustomId('expectSend')
      .setLabel('回数を決定')
      .setStyle(ButtonStyle.Primary),
    async execute(interaction: ButtonInteraction, skullking: Skullking) {
      if (!(await skullking.checkStatus(interaction, 'expecting'))) {
        return;
      }
      const player = skullking.getInteractionPlayer(interaction);
      if (player === null) {
        await interaction.reply({ content: 'だれ？', flags });
        return;
      }
      if (!player.isTouchedExpectationSelect()) {
        await interaction.reply({ content: '予想の数えらんでー', flags });
        return;
      }
      await interaction.deferUpdate();
      // embedのうち予想Timeのものを消して、順番と手札のものは残す
      const embeds = interaction.message.embeds.slice(0, -1);
      // 戦績表示のセレクトボックスを残して他は全部消す
      let components: MessageCreateOptions['components'] = [];
      if (interaction.message.components.length > 2) {
        components = interaction.message.components.slice(-1);
      }
      if (skullking.isParentInAttendees() && skullking.isParent(interaction)) {
        components = [...components, makeButtonRow('expectComplete')];
      }
      await interaction.message.edit({ embeds, components });
      await player.submitExpectation();
    },
  },
  expectComplete: {
    component: new ButtonBuilder()
      .setCustomId('expectComplete')
      .setLabel('全員の予想が終わったら押すやつ')
      .setStyle(ButtonStyle.Success),
    async execute(interaction: ButtonInteraction, skullking: Skullking) {
      await skullking.completeExpectation(interaction);
    },
  },
  putOut: {
    component: new ButtonBuilder()
      .setCustomId('putOut')
      .setLabel('カードを出す')
      .setStyle(ButtonStyle.Primary),
    async execute(interaction: ButtonInteraction, skullking: Skullking) {
      if (!(await skullking.checkStatus(interaction, 'putting'))) {
        return;
      }
      const player = skullking.getInteractionPlayer(interaction);
      if (player === null) {
        await interaction.reply({ content: 'だれ？', flags });
        return;
      }
      await player.putOut(interaction);
    },
  },
  tigresPirate: tigresButtonGenerator('pirate'),
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
      .setLabel('やめる')
      .setStyle(ButtonStyle.Secondary),
    async execute(interaction: ButtonInteraction, skullking: Skullking) {
      await interaction.deferUpdate();
      await skullking.reset(interaction);
    },
  },
};

function tigresButtonGenerator(type: 'pirate' | 'escape') {
  const label = type === 'pirate' ? '海賊' : '逃走';
  const emoji = type === 'pirate' ? '⚔️' : '🏃';
  const component = new ButtonBuilder()
    .setCustomId(`tigres${type.charAt(0).toUpperCase() + type.slice(1)}`)
    .setLabel(label)
    .setStyle(ButtonStyle.Primary)
    .setEmoji(emoji);
  const execute = async (interaction: ButtonInteraction, skullking: Skullking) => {
    const player = skullking.getInteractionPlayer(interaction);
    if (player === null) {
      await interaction.reply({ content: 'だれ？', flags });
      return;
    }
    await interaction.deferUpdate();
    await interaction.message.delete();
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
