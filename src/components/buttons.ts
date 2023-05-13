import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
} from 'discord.js';
import { dealCards, displayTurns, games } from '../utility/game';
import {
  Player,
  currentPlayers,
  getDisplayName,
  mention,
  urgeToExpect,
} from '../utility/player';
import { shuffle } from '../utility/cards';
import { cpuCountSelect } from './selectMenus';

/* eslint-disable @typescript-eslint/naming-convention */
export const BUTTON_ID = {
  JOIN: 'join',
  START: 'start',
  CPU_SET: 'cpu-set',
  START_CANCEL: 'start-cancel',
};
/* eslint-enable @typescript-eslint/naming-convention */

export const joinButton = {
  component: new ButtonBuilder()
    .setCustomId(BUTTON_ID.JOIN)
    .setLabel('参加する')
    .setStyle(ButtonStyle.Primary),
  execute: async (interaction: ButtonInteraction) => {
    const guildId = interaction.guild?.id ?? 'あほのID';
    const at = mention(interaction.user);
    if (!(guildId in games)) {
      await interaction.channel?.send(`${at} \`!launch\`で起動しようね`);
      await interaction.deferUpdate();
      return;
    }
    const discordId = interaction.user.id;
    if (currentPlayers.some((p) => p.discordId === discordId)) {
      await interaction.channel?.send(`${at} おめぇの席あるから！`);
      await interaction.deferUpdate();
      return;
    }
    if (games[guildId]!.status !== 'ready') {
      await interaction.channel?.send(
        `${at} 他の人たちやってるぽいからちょっとお待ちー`,
      );
      await interaction.deferUpdate();
      return;
    }
    if (games[guildId]!.players.length >= 6) {
      await interaction.channel?.send(`${at} 人数いっぱいいっぱい`);
      await interaction.deferUpdate();
      return;
    }
    const player = {
      discordId,
      name: getDisplayName(interaction),
      guildId,
      channelId: interaction.channel!.id,
      cardsHand: [],
      countExpected: null,
      countActual: 0,
      point: 0,
      history: [],
      collectedCards: [],
      isCp: false,
    };
    games[guildId]!.players.push(player);
    currentPlayers.push(player);
    await interaction.channel?.send(`${player.name}が入ったぞい！`);
    await interaction.deferUpdate();
  },
};

export const startButton = {
  component: new ButtonBuilder()
    .setCustomId(BUTTON_ID.START)
    .setLabel('スタート')
    .setStyle(ButtonStyle.Primary),
  execute: async (interaction: ButtonInteraction) => {
    const guildId = interaction.guild?.id ?? 'あほのID';
    const at = mention(interaction.user);
    if (!(guildId in games)) {
      await interaction.channel?.send(`${at} \`!launch\`で起動しようね`);
      await interaction.deferUpdate();
      return;
    }
    if (games[guildId]!.players.length === 0) {
      await interaction.channel?.send(`${at} 誰もいないよー`);
      await interaction.deferUpdate();
      return;
    }
    games[guildId]!.players = games[guildId]!.players.filter((p) => !p.isCp);
    games[guildId]!.cpuCount = 0;
    const maxCpuCount = 6 - games[guildId]!.players.length;
    const cpuRow = new ActionRowBuilder().addComponents(
      cpuCountSelect.component(maxCpuCount),
    );
    const cancelRow = new ActionRowBuilder().addComponents(
      cpuSetButton.component,
      startCancelButton.component,
    );
    await interaction.channel!.send({
      content: 'CPU何人いれる？',
      // @ts-ignore
      components: [cpuRow, cancelRow],
    });
    await interaction.message.delete();
  },
};

export const cpuSetButton = {
  component: new ButtonBuilder()
    .setCustomId(BUTTON_ID.CPU_SET)
    .setLabel('決定')
    .setStyle(ButtonStyle.Primary),
  execute: async (interaction: ButtonInteraction) => {
    const guildId = interaction.guild?.id ?? 'あほのID';
    const at = mention(interaction.user);
    if (!(guildId in games)) {
      interaction.channel?.send(`${at} \`!launch\`で起動しようね`);
      await interaction.deferUpdate();
      return;
    }
    const { players, cpuCount } = games[guildId]!;
    if (players.length + cpuCount < 2) {
      await interaction.channel?.send(`${at} 人数足りないよー`);
      await interaction.deferUpdate();
      return;
    }
    for (let i = 0; i < games[guildId]!.cpuCount; i += 1) {
      const cp: Player = {
        discordId: '',
        name: `コンピューター${i + 1}`,
        guildId,
        channelId: interaction.channel!.id,
        cardsHand: [],
        countExpected: null,
        countActual: 0,
        point: 0,
        history: [],
        collectedCards: [],
        isCp: true,
      };
      games[guildId]!.players.push(cp);
    }
    games[guildId]!.status = 'expecting';
    games[guildId]!.players = shuffle(players);
    await displayTurns(interaction);
    await dealCards(interaction);
    await interaction.channel?.send('DMで予想した勝利数を教えてちょー');
    await interaction.deferUpdate();
    games[guildId]!.players.forEach((player) => {
      player.point = 0;
      player.history = [];
      urgeToExpect(interaction.client, player);
    });
    await interaction.message.delete();
  },
};

export const startCancelButton = {
  component: new ButtonBuilder()
    .setCustomId(BUTTON_ID.START_CANCEL)
    .setLabel('キャンセル')
    .setStyle(ButtonStyle.Danger),
  execute: async (interaction: ButtonInteraction) => {
    const row = new ActionRowBuilder().addComponents([
      joinButton.component,
      startButton.component,
    ]);
    // componentsで型エラー出てるけど、バリバリ動いてたので無視
    await interaction.channel?.send({
      content: 'すかき～ん',
      // @ts-ignore
      components: [row],
    });
    await interaction.message.delete();
  },
};
