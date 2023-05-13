import {
  Client,
  Message,
  MessageCreateOptions,
  MessagePayload,
  TextChannel,
  APIEmbed,
  ButtonInteraction,
  Interaction,
  User,
  MessageComponentInteraction,
  StringSelectMenuInteraction,
  ActionRowBuilder,
} from 'discord.js';
import { Card, convertCardValue, TigresType } from './cards';
import { colors } from './embedColor';
import { sendEveryPlayerHand, games, putOutCard, cpPut } from './game';
import { BUTTON_ID, expectSendButton, joinButton } from '../components/buttons';
import { SELECT_MENU_ID, expectCountSelect } from '../components/selectMenus';

export type Player = {
  discordId: string;
  name: string;
  guildId: string;
  channelId: string;
  cardsHand: Card[];
  selectedCountExpected: number | null;
  countExpected: number | null;
  countActual: number;
  point: number;
  history: number[];
  collectedCards: Card[];
  goldBonus?: number;
  isCp: boolean;
};

export const currentPlayers: Player[] = [];

export async function sendAllMessage(
  client: Client,
  player: Player,
  message: string | MessagePayload | MessageCreateOptions,
) {
  if (!player) {
    return;
  }
  const { players } = games[player.guildId]!;
  for (const p of players) {
    await sendPrivateMessage(client, p, message);
  }
  await sendPublicMessage(client, player, message);
}

export async function sendPrivateMessage(
  client: Client,
  player: Player,
  message: string | MessagePayload | MessageCreateOptions,
) {
  if (player.isCp) {
    return;
  }
  const user = await client.users.fetch(player.discordId);
  if (user === undefined) {
    return;
  }
  try {
    await user.send(message);
  } catch {
    await user.send('あほしねや');
  }
}

export async function sendPublicMessage(
  client: Client,
  player: Player,
  message: string | MessagePayload | MessageCreateOptions,
) {
  const { guildId, channelId } = player;
  const guild = client.guilds.cache.get(guildId)!;
  const channel = guild.channels.cache.get(channelId)! as TextChannel;
  await channel.send(message);
}

export const playerCommands = (message: Message) => {
  const command = message.content.split(' ');
  const player = currentPlayers.find((p) => p.discordId === message.author.id);
  const status = games[player?.guildId ?? 'あほのID']?.status;
  if (!Number.isNaN(Number(command[0]))) {
    if (status === 'putting') {
      put(message);
      return;
    }
  }
  if (command[0] === '!bye') {
    bye(message);
    return;
  }
  if (command[0] === '!history') {
    showHistory(message);
    return;
  }
  if (command[0] === '!check') {
    const player = currentPlayers.find(
      (p) => p.discordId === message.author.id,
    );
    if (player !== undefined) {
      sendCardsHand(message.client, player);
    }
  }
};

export const playerButtons = (interaction: ButtonInteraction) => {
  const { customId } = interaction;
  if (customId === BUTTON_ID.JOIN) {
    joinButton.execute(interaction);
    return;
  }
  if (customId === BUTTON_ID.EXPECT_SEND) {
    expectSendButton.execute(interaction);
  }
};

export const playerSelectMenus = (interaction: StringSelectMenuInteraction) => {
  const { customId } = interaction;
  if (customId === SELECT_MENU_ID.EXPECT_COUNT) {
    expectCountSelect.execute(interaction);
  }
};

export const getDisplayName = (interaction: Interaction) => {
  const member = interaction.guild!.members!.cache!.find(
    (member) => member.id === interaction.user.id,
  );
  return member?.displayName ?? interaction.user.username;
};

export const mention = (user: User) => {
  return `<@!${user.id}>`;
};

export const sendCardsHand = async (client: Client, player: Player) => {
  if (player.isCp) {
    return;
  }
  const { currentColor } = games[player.guildId]!;
  const hasColor = player.cardsHand.some(
    (card) => 'color' in card && card.color === currentColor,
  );
  const { countExpected, countActual } = player;
  const fields = player.cardsHand.map((card, index) => {
    const isInvalid =
      hasColor && 'color' in card && card.color !== currentColor;
    const name = `${index + 1}${isInvalid ? ' :x:' : ''}`;
    const value = convertCardValue(card);
    return { name, value, inline: true };
  });
  const embed: APIEmbed = {
    title: '手札',
    description:
      countExpected === null
        ? undefined
        : `予想: ${countExpected}\n勝数: ${countActual}`,
    color: colors.yellow,
    fields,
  };
  const user = await client.users.fetch(player.discordId);
  user.send({ embeds: [embed] });
};

export const urgeToExpect = async (client: Client, player: Player) => {
  const game = games[player.guildId];
  if (game === undefined) {
    return;
  }
  if (player.isCp) {
    const { gameCount } = games[player.guildId]!;
    player.countExpected = Math.floor(Math.random() * (gameCount + 1));
    return;
  }
  const description = '勝利数を選んで送信しようね';
  const embed: APIEmbed = {
    title: '勝利数を予想しよう！',
    color: colors.info,
    description,
  };
  const selectRow = new ActionRowBuilder().addComponents(
    expectCountSelect.component(game.gameCount),
  );
  const buttonRow = new ActionRowBuilder().addComponents(
    expectSendButton.component,
  );
  await sendPrivateMessage(client, player, {
    embeds: [embed],
    // @ts-ignore
    components: [selectRow, buttonRow],
  });
};

export const urgeToPutDownCard = async (
  interaction: MessageComponentInteraction,
  player: Player,
) => {
  if (player.isCp) {
    await cpPut(interaction, player);
    return;
  }
  const description =
    '順番回ってきちゃったんでカード出そうね\n\n' +
    '何枚目のカード出すか教えてほし〜\n' +
    '例えば`2`と入力すると2枚目のカードを出すことになるよ';
  const embed: APIEmbed = {
    title: 'カードを出すんだぞい',
    description,
    color: colors.info,
  };
  await sendPrivateMessage(interaction.client, player, { embeds: [embed] });
  await sendEveryPlayerHand(interaction.client, player);
  await sendCardsHand(interaction.client, player);
};

const colorText = {
  green: '緑',
  yellow: '黄',
  purple: '紫',
  black: '黒',
};

const putOut = async (message: Message, putOutIndex: number) => {
  const player = currentPlayers.find((p) => p.discordId === message.author.id)!;
  const card = player.cardsHand[putOutIndex];
  if ('type' in card) {
    await putOutCard(message, player, putOutIndex);
    return;
  }
  const { currentColor } = games[player.guildId]!;
  const hasColor = player.cardsHand.some(
    (card) => 'color' in card && card.color === currentColor,
  );
  if (hasColor && card.color !== currentColor) {
    message.channel.send(
      `${colorText[currentColor!]}色持ってんのに${
        colorText[card.color]
      }色出しちゃだめだぞぉ♡`,
    );
    return;
  }
  await putOutCard(message, player, putOutIndex);
};

const canPutOutByHandCount = (player: Player) => {
  const { players, playerTurnIndex } = games[player.guildId]!;
  const opponents = players.filter((p) => p.discordId !== player.discordId);
  const handCount = player.cardsHand.length;
  if (playerTurnIndex === 0) {
    return opponents.every((p) => p.cardsHand.length === handCount);
  }
  if (playerTurnIndex === players.length - 1) {
    return opponents.every((p) => p.cardsHand.length === handCount - 1);
  }
  const maxHandCount = Math.max(...opponents.map((p) => p.cardsHand.length));
  return handCount === maxHandCount;
};

// eslint-disable-next-line complexity
const put = async (message: Message) => {
  const player = currentPlayers.find((p) => p.discordId === message.author.id);
  if (player === undefined) {
    return;
  }
  const { players, playerTurnIndex, status } = games[player.guildId]!;
  if (status !== 'putting') {
    await message.channel.send('その時はまだ早し...');
    return;
  }
  if (player.discordId !== players[playerTurnIndex].discordId) {
    await message.channel.send('まだターン回ってきてないよー');
    return;
  }
  if (!canPutOutByHandCount(player)) {
    await message.channel.send('なんか2枚以上出そうとしてない？');
    return;
  }
  const commands = message.content.split(' ');
  const inputNumber = Number(commands[0]);
  if (Number.isNaN(inputNumber)) {
    await message.channel.send('数字を教えてほしいよー');
    return;
  }
  const { cardsHand } = player;
  if (cardsHand.length === 1 && inputNumber !== 1) {
    await message.channel.send('1枚しかないよー');
    return;
  }
  if (inputNumber < 1 || inputNumber > cardsHand.length) {
    await message.channel.send(
      `1から${cardsHand.length}までの数字を教えてほしいよー`,
    );
    return;
  }
  const card = cardsHand[inputNumber - 1];
  if ('type' in card && card.type === 'tigres') {
    if (commands.length < 2 || !['pirates', 'escape'].includes(commands[1])) {
      await message.channel.send(
        'ティグレスを使うときは`pirates`か`escape`を入力してね\n' +
          `\`${inputNumber} pirates\`もしくは\`${inputNumber} escape\``,
      );
      return;
    }
  }
  const tigresType = (commands[1] ?? null) as TigresType;
  if ('type' in card) {
    card.tigresType = tigresType;
  }
  await putOut(message, inputNumber - 1);
};

const getHistoryPlayer = async (message: Message) => {
  const player = currentPlayers.find((p) => p.discordId === message.author.id);
  if (player === undefined) {
    return null;
  }
  const targetNumber = Number(message.content.split(' ')[1]);
  if (Number.isNaN(targetNumber)) {
    return player;
  }
  const { players } = games[player.guildId]!;
  if (targetNumber < 1 || targetNumber > players.length) {
    await message.channel.send(`1から${players.length}にしてね`);
    return null;
  }
  return players[targetNumber - 1];
};

const showHistory = async (message: Message) => {
  const player = await getHistoryPlayer(message);
  if (player === null) {
    return;
  }
  const { name, history } = player;
  const fields = history.map((point, index) => ({
    name: `${index + 1}戦目`,
    value: `${point > 0 ? '+' : ''}${point}`,
    inline: true,
  }));
  const embed: APIEmbed = {
    title: `${name}の戦績！`,
    description: `合計**${player.point}点**`,
    color: colors.info,
    fields,
  };
  await message.channel.send({ embeds: [embed] });
};

const bye = async (message: Message) => {
  const index = currentPlayers.findIndex(
    (p) => p.discordId === message.author.id,
  );
  if (index < 0) {
    return;
  }
  const player = currentPlayers[index];
  const game = games[player.guildId]!;
  if (game.status !== 'ready') {
    await sendPrivateMessage(
      message.client,
      player,
      'プレイ中は途中で抜けられないよ><',
    );
    return;
  }
  game.players.splice(
    game.players.findIndex((p) => p.discordId === player.discordId),
    1,
  );
  currentPlayers.splice(index, 1);
  await sendPrivateMessage(message.client, player, ':wave:');
};
