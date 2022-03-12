import { Client, Message, TextChannel } from 'discord.js';
import { Embed } from '..';
import { Card, convertCardValue } from './cards';
import { colors } from './embedColor';
import { checkEveryPlayerExpectedCount, games } from './game';

export type Player = {
  discordId: string;
  name: string;
  guildId: string;
  channelId: string;
  cardsHand: Card[];
  countExpected: number | null;
  countActual: number;
  point: number;
};

const currentPlayers: Player[] = [];

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
  if (command[0] === '!check') {
    const player = currentPlayers.find(
      (p) => p.discordId === message.author.id,
    );
    if (player !== undefined) {
      sendCardsHand(message, player);
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
  };
  games[guildId]!.players.push(player);
  currentPlayers.push(player);
  message.channel.send(`${player.name}が入ったぞい！`);
};

export const sendCardsHand = async (message: Message, player: Player) => {
  const fields = player.cardsHand.map((card, index) => {
    const name = `${index + 1}`;
    const value = convertCardValue(card);
    return { name, value, inline: true };
  });
  const embed: Embed = {
    title: '手札',
    color: colors.yellow,
    fields,
  };
  const user = await message.client.users.fetch(player.discordId, false);
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
  const user = client.users.cache.get(player.discordId)!;
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
  user.send({ embed });
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
    message.channel.send(`<@!${discordId}> やり直しは効かぬのだ...！`);
    return;
  }
  const count = Number(message.content.split(' ')[1]);
  if (Number.isNaN(count)) {
    message.channel.send(`<@!${discordId}> 数字を教えてほしいよー`);
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
  channel.send(`${first.name}くんから始めんぞい！`);
  for (const player of gamePlayers) {
    const user = message.client.users.cache.get(player.discordId)!;
    await checkEveryPlayerExpectedCount(user, gamePlayers);
  }
  urgeToPutDownCard(message.client, first);
};

export const urgeToPutDownCard = async (client: Client, player: Player) => {
  const user = await client.users.fetch(player.discordId, false);
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
  user.send({ embed });
};
