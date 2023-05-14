import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  TextChannel,
} from 'discord.js';
import {
  dealCards,
  displayTurns,
  games,
  reset,
  sendEveryPlayerExpectedCount,
} from '../utility/game';
import {
  Player,
  bye,
  currentPlayers,
  getDisplayName,
  mention,
  putOut,
  sendAllMessage,
  urgeToExpect,
  urgeToPutDownCard,
} from '../utility/player';
import { SpecialCard, emojis, shuffle } from '../utility/cards';
import { cpuCountSelect } from './selectMenus';

/* eslint-disable @typescript-eslint/naming-convention */
export const BUTTON_ID = {
  JOIN: 'join',
  START: 'start',
  CPU_SET: 'cpu-set',
  START_CANCEL: 'start-cancel',
  EXPECT_SEND: 'expect-send',
  CARD_SELECT_SEND: 'card-select-send',
  TIGRES_PIRATES: 'tigres-pirates',
  TIGRES_ESCAPE: 'tigres-escape',
  BYE: 'bye',
  RESET: 'reset',
};
/* eslint-enable @typescript-eslint/naming-convention */

export const joinButton = {
  component: new ButtonBuilder()
    .setCustomId(BUTTON_ID.JOIN)
    .setLabel('参加する')
    .setStyle(ButtonStyle.Primary),
  execute: async (interaction: ButtonInteraction) => {
    await interaction.deferUpdate();
    const guildId = interaction.guild?.id ?? 'あほのID';
    const at = mention(interaction.user);
    if (!(guildId in games)) {
      await interaction.channel?.send(`${at} \`!launch\`で起動しようね`);
      return;
    }
    const discordId = interaction.user.id;
    if (currentPlayers.some((p) => p.discordId === discordId)) {
      await interaction.channel?.send(`${at} おめぇの席あるから！`);
      return;
    }
    if (games[guildId]!.status !== 'ready') {
      await interaction.channel?.send(
        `${at} 他の人たちやってるぽいからちょっとお待ちー`,
      );
      return;
    }
    if (games[guildId]!.players.length >= 6) {
      await interaction.channel?.send(`${at} 人数いっぱいいっぱい`);
      return;
    }
    const player: Player = {
      discordId,
      name: getDisplayName(interaction),
      guildId,
      channelId: interaction.channel!.id,
      cardsHand: [],
      selectedCountExpected: null,
      selectedCardIndex: null,
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
  },
};

export const startButton = {
  component: new ButtonBuilder()
    .setCustomId(BUTTON_ID.START)
    .setLabel('スタート')
    .setStyle(ButtonStyle.Primary),
  execute: async (interaction: ButtonInteraction) => {
    await interaction.deferUpdate();
    const guildId = interaction.guild?.id ?? 'あほのID';
    const at = mention(interaction.user);
    if (!(guildId in games)) {
      await interaction.channel?.send(`${at} \`!launch\`で起動しようね`);
      return;
    }
    const { players, status } = games[guildId]!;
    if (players.length === 0) {
      await interaction.channel?.send(`${at} 誰もいないよー`);
      return;
    }
    if (!players.some((p) => p.discordId === interaction.user.id)) {
      await interaction.channel?.send(`${at} 参加してねー`);
      return;
    }
    if (status !== 'ready') {
      await interaction.channel?.send(
        `${at} 他の人たちやってるぽいからちょっとお待ちー`,
      );
      return;
    }
    await interaction.message.delete();
    games[guildId]!.players = players.filter((p) => !p.isCp);
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
    await interaction.deferUpdate();
    if (!(guildId in games)) {
      interaction.channel?.send(`${at} \`!launch\`で起動しようね`);
      return;
    }
    const { players, cpuCount, status } = games[guildId]!;
    if (players.length + cpuCount < 2) {
      await interaction.channel?.send(`${at} 人数足りないよー`);
      return;
    }
    if (status !== 'ready') {
      await interaction.channel?.send(`${at} なんだねチミは`);
      return;
    }
    await interaction.message.delete();
    for (let i = 0; i < games[guildId]!.cpuCount; i += 1) {
      const cp: Player = {
        discordId: '',
        name: `コンピューター${i + 1}`,
        guildId,
        channelId: interaction.channel!.id,
        cardsHand: [],
        selectedCountExpected: null,
        selectedCardIndex: null,
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
    games[guildId]!.players.forEach((player) => {
      player.point = 0;
      player.history = [];
      urgeToExpect(interaction.client, player);
    });
  },
};

export const startCancelButton = {
  component: new ButtonBuilder()
    .setCustomId(BUTTON_ID.START_CANCEL)
    .setLabel('キャンセル')
    .setStyle(ButtonStyle.Danger),
  execute: async (interaction: ButtonInteraction) => {
    await interaction.deferUpdate();
    const guildId = interaction.guild?.id ?? 'あほのID';
    const at = mention(interaction.user);
    if (!(guildId in games)) {
      await interaction.channel?.send(`${at} \`!launch\`で起動しようね`);
      return;
    }
    if (games[guildId]!.status !== 'ready') {
      await interaction.channel?.send(`${at} なんだねチミは`);
      return;
    }
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

export const expectSendButton = {
  component: new ButtonBuilder()
    .setCustomId(BUTTON_ID.EXPECT_SEND)
    .setLabel('送信')
    .setStyle(ButtonStyle.Primary),
  execute: async (interaction: ButtonInteraction) => {
    await interaction.deferUpdate();
    const discordId = interaction.user.id;
    const player = currentPlayers.find((p) => p.discordId === discordId);
    const at = mention(interaction.user);
    if (player === undefined) {
      await interaction.user.send(`${at} だれ？`);
      return;
    }
    const count = player.selectedCountExpected;
    if (count === null) {
      await interaction.user.send(`${at} 回数えらんでー`);
      return;
    }
    const { players } = games[player.guildId]!;
    player.countExpected = count;
    await interaction.user.send(`${count}回だねーおっけー`);
    await interaction.message.delete();
    if (!players.every(({ countExpected }) => countExpected !== null)) {
      return;
    }
    const guild = interaction.client.guilds.cache.get(player.guildId)!;
    const channel = guild.channels.cache.get(player.channelId)! as TextChannel;
    await sendEveryPlayerExpectedCount(channel, players);
    const first = players[0];
    games[player.guildId]!.status = 'putting';
    for (const player of players.filter((p) => !p.isCp)) {
      const user = interaction.client.users.cache.get(player.discordId)!;
      await sendEveryPlayerExpectedCount(user, players);
    }
    const publicMessage = `${first.name}くんから始めんぞい！`;
    await sendAllMessage(interaction.client, player, publicMessage);
    await urgeToPutDownCard(interaction, first);
  },
};

export const cardSelectSendButton = {
  component: new ButtonBuilder()
    .setCustomId(BUTTON_ID.CARD_SELECT_SEND)
    .setLabel('送信')
    .setStyle(ButtonStyle.Primary),
  execute: async (interaction: ButtonInteraction) => {
    await interaction.deferUpdate();
    const player = currentPlayers.find(
      (p) => p.discordId === interaction.user.id,
    );
    if (player === undefined) {
      await interaction.user.send('芸術は爆発だ');
      return;
    }
    const { selectedCardIndex } = player;
    if (selectedCardIndex === null) {
      await interaction.user.send('カード選んでー');
      return;
    }
    await interaction.message.delete();
    await putOut(interaction, selectedCardIndex);
  },
};

const tigresButtonGenerator = (type: 'pirates' | 'escape') => {
  const label = type === 'pirates' ? '海賊' : '逃走';
  const emoji = emojis[type];
  const component = new ButtonBuilder()
    .setCustomId(`tigres-${type}`)
    .setLabel(label)
    .setStyle(ButtonStyle.Primary)
    .setEmoji(emoji);
  const execute = async (interaction: ButtonInteraction) => {
    await interaction.deferUpdate();
    const player = currentPlayers.find(
      (p) => p.discordId === interaction.user.id,
    );
    if (player === undefined) {
      await interaction.user.send('芸術は爆発だ');
      return;
    }
    const { selectedCardIndex } = player;
    (player.cardsHand[selectedCardIndex!] as SpecialCard).tigresType = type;
    await interaction.message.delete();
    await putOut(interaction, selectedCardIndex!);
  };
  return { component, execute };
};

export const tigresPiratesButton = tigresButtonGenerator('pirates');
export const tigresEscapeButton = tigresButtonGenerator('escape');

export const byeButton = {
  component: new ButtonBuilder()
    .setCustomId(BUTTON_ID.BYE)
    .setLabel('抜ける')
    .setStyle(ButtonStyle.Secondary),
  execute: async (interaction: ButtonInteraction) => {
    await interaction.deferUpdate();
    await interaction.message.delete();
    await bye(interaction);
  },
};

export const resetButton = {
  component: new ButtonBuilder()
    .setCustomId(BUTTON_ID.RESET)
    .setLabel('ゲーム終了')
    .setStyle(ButtonStyle.Danger),
  execute: async (interaction: ButtonInteraction) => {
    await interaction.deferUpdate();
    await interaction.message.delete();
    await reset(interaction);
  },
};
