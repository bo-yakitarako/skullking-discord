import { Client, Message, TextChannel } from 'discord.js';
import { Embed } from '..';
import { Card, convertCardValue, TigresType } from './cards';
import { colors } from './embedColor';
import {
  checkEveryPlayerExpectedCount,
  checkEveryPlayerHand,
  games,
  putOutCard,
} from './game';

export type Player = {
  discordId: string;
  name: string;
  guildId: string;
  channelId: string;
  cardsHand: Card[];
  countExpected: number | null;
  countActual: number;
  point: number;
  collectedCards: Card[];
  goldBonus?: number;
};

export const currentPlayers: Player[] = [];

export async function sendAllMessage<T>(
  client: Client,
  player: Player,
  message: T,
) {
  const { players } = games[player.guildId]!;
  for (const p of players) {
    await sendPrivateMessage(client, p, message);
  }
  await sendPublicMessage(client, player, message);
}

export async function sendPrivateMessage<T>(
  client: Client,
  player: Player,
  message: T,
) {
  const user = await client.users.fetch(player.discordId, false);
  if (user === undefined) {
    return;
  }
  try {
    await user.send(message);
  } catch {
    await user.send('あほしねや');
  }
}

export async function sendPublicMessage<T>(
  client: Client,
  player: Player,
  message: T,
) {
  const { guildId, channelId } = player;
  const guild = client.guilds.cache.get(guildId)!;
  const channel = guild.channels.cache.get(channelId)! as TextChannel;
  await channel.send(message);
}

export const playerCommands = (message: Message) => {
  const command = message.content.split(' ');
  if (command[0] === '!join') {
    join(message);
    return;
  }
  if (command[0] === '!expect') {
    expectWinningCount(message);
    return;
  }
  if (command[0] === '!put') {
    put(message);
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

const getDisplayName = (message: Message) => {
  const member = message.guild!.members!.cache!.find(
    (member) => member.id === message.author.id,
  );
  return member?.displayName ?? message.author.username;
};

const join = (message: Message) => {
  const guildId = message.guild?.id ?? 'あほのID';
  if (!(guildId in games)) {
    message.channel.send('`!launch`で起動しようね');
    return;
  }
  const discordId = message.author.id;
  if (currentPlayers.some((p) => p.discordId === discordId)) {
    message.channel.send('おめぇの席あるから！');
    return;
  }
  const player = {
    discordId,
    name: getDisplayName(message),
    guildId,
    channelId: message.channel.id,
    cardsHand: [],
    countExpected: null,
    countActual: 0,
    point: 0,
    collectedCards: [],
  };
  games[guildId]!.players.push(player);
  currentPlayers.push(player);
  message.channel.send(`${player.name}が入ったぞい！`);
};

export const sendCardsHand = async (client: Client, player: Player) => {
  const { currentColor } = games[player.guildId]!;
  const hasColor = player.cardsHand.some(
    (card) => 'color' in card && card.color === currentColor,
  );
  const fields = player.cardsHand.map((card, index) => {
    const isInvalid =
      hasColor && 'color' in card && card.color !== currentColor;
    const name = `${index + 1}${isInvalid ? ' :x:' : ''}`;
    const value = convertCardValue(card);
    return { name, value, inline: true };
  });
  const embed: Embed = {
    title: '手札',
    color: colors.yellow,
    fields,
  };
  const user = await client.users.fetch(player.discordId, false);
  user.send({ embed });
};

const turnText = (player: Player, players: Player[]) => {
  const turn = players.findIndex((p) => p.discordId === player.discordId) + 1;
  if (turn === 1) {
    return '最初';
  }
  if (turn === players.length) {
    return '最後';
  }
  return `${turn}番目`;
};

export const urgeToExpect = (client: Client, player: Player) => {
  const gamePlayers = games[player.guildId]!.players;
  const turn = turnText(player, gamePlayers);
  const description =
    '```!expect [予想数]```\nで勝利数を予想しようね\n\n' +
    `ちなみに順番は${turn}らしいよ`;
  const embed: Embed = {
    title: '勝利数を予想しよう！',
    color: colors.info,
    description,
  };
  sendPrivateMessage(client, player, { embed });
};

export const expectWinningCount = async (message: Message) => {
  const discordId = message.author.id;
  const player = currentPlayers.find((p) => p.discordId === discordId);
  if (player === undefined) {
    message.channel.send(`<@!${discordId}> だれ？`);
    return;
  }
  if (message.guild !== null) {
    message.channel.send(`<@!${discordId}> DMでこっそり教えてほしいよー`);
    return;
  }
  if (player.countExpected !== null) {
    message.channel.send(`やり直しは効かぬのだ...！`);
    return;
  }
  const count = Number(message.content.split(' ')[1]);
  if (Number.isNaN(count)) {
    message.channel.send(`数字を教えてほしいよー`);
    return;
  }
  player.countExpected = count;
  message.channel.send(`${count}回だねーおっけー`);
  const gamePlayers = games[player.guildId]!.players;
  if (!gamePlayers.every(({ countExpected }) => countExpected !== null)) {
    return;
  }
  const guild = message.client.guilds.cache.get(player.guildId)!;
  const channel = guild.channels.cache.get(player.channelId)! as TextChannel;
  await checkEveryPlayerExpectedCount(channel, gamePlayers);
  const first = gamePlayers[0];
  games[player.guildId]!.status = 'putting';
  for (const player of gamePlayers) {
    const user = message.client.users.cache.get(player.discordId)!;
    await checkEveryPlayerExpectedCount(user, gamePlayers);
  }
  const publicMessage = `${first.name}くんから始めんぞい！`;
  await sendAllMessage(message.client, player, publicMessage);
  await urgeToPutDownCard(message.client, first);
};

export const urgeToPutDownCard = async (client: Client, player: Player) => {
  const description =
    '順番回ってきちゃったんでカード出そうね\n\n' +
    'カードの出し方はこんな感じ\n' +
    '```!put [カード番号]```\n' +
    '例えば`!put 2`と入力すると2枚目のカードを出すことになるよ\n' +
    '`!put`のように数字を省略した場合は手札の中の1枚目のカードを出すよ\n\n' +
    '手札を再度確認したい場合は`!check`と打てばいいんじゃないかな？\n\n' +
    'ちなみにこの入力はここのDMで打ち込んでもいいし、ゲーム開始したチャンネルで打ち込んでもいいよ\n' +
    'まあチャンネルだと手札確認しにくいし、ここで打ち込んじゃった方がいいんじゃない？';
  const embed: Embed = {
    title: 'カードを出すんだぞい',
    description,
    color: colors.info,
  };
  await sendPrivateMessage(client, player, { embed });
  await checkEveryPlayerHand(client, player);
  await sendCardsHand(client, player);
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
  const commands = message.content.split(' ');
  if (commands.length === 1) {
    await putOut(message, 0);
    return;
  }
  const inputNumber = Number(commands[1]);
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
    if (commands.length < 3 || !['pirates', 'escape'].includes(commands[2])) {
      await message.channel.send(
        'ティグレスを使うときは`pirates`か`escape`を入力してね\n' +
          `\`!put ${inputNumber} pirates\`もしくは\`!put ${inputNumber} escape\``,
      );
      return;
    }
  }
  const tigresType = (commands[2] ?? null) as TigresType;
  if ('type' in card) {
    card.tigresType = tigresType;
  }
  await putOut(message, inputNumber - 1);
};
