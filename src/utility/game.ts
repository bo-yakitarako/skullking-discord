import { Client, Message, TextChannel, User } from 'discord.js';
import { Embed } from '..';
import { Card, Color, convertCardValue, generateDeck, shuffle } from './cards';
import { colors, convertToColor } from './embedColor';
import { updateBonus, updateCardWinning } from './judgement';
import {
  Player,
  sendAllMessage,
  sendCardsHand,
  sendPrivateMessage,
  sendPublicMessage,
  urgeToExpect,
  urgeToPutDownCard,
} from './player';

type Game = {
  status: 'ready' | 'expecting' | 'putting' | 'finish';
  players: Player[];
  gameCount: number;
  playerTurnIndex: number;
  cards: Card[];
  currentPutOut: Card[];
  currentColor: Color | null;
  currentWinner: {
    player: Player;
    card: Card;
  } | null;
  deadCards: Card[];
};

type Games = { [guildId in string]?: Game };

export const games: Games = {};

export const gameCommands = (message: Message) => {
  const command = message.content.split(' ');
  if (command[0] === '!launch') {
    launch(message);
  }
  if (command[0] === '!start') {
    start(message);
  }
};

const launch = (message: Message) => {
  if (message.guild === null) {
    message.channel.send('あほしね');
    return;
  }
  const guildId = message.guild.id;
  const cards = generateDeck();
  games[guildId] = {
    status: 'ready',
    players: [],
    gameCount: 10,
    playerTurnIndex: 0,
    cards,
    currentPutOut: [],
    currentColor: null,
    currentWinner: null,
    deadCards: [],
  };
  message.channel.send('すかき〜ん(`!join`で参加しよう)');
};

const displayTurns = (message: Message) => {
  const { players } = games[message.guild!.id]!;
  const description = players
    .map(({ name }, index) => `${index + 1}. ${name}`)
    .join('\n');
  const embed: Embed = {
    title: '順番',
    description,
    color: colors.info,
  };
  message.channel.send({ embed });
};

const dealCards = async (message: Message) => {
  const game = games[message.guild!.id]!;
  const { players, gameCount, deadCards } = game;
  let { cards } = game;
  if (cards.length < players.length * gameCount) {
    cards = [...cards, ...shuffle(deadCards)];
    game.cards = [...cards];
    game.deadCards = [];
  }
  for (const player of players) {
    // spliceは該当箇所を返して元の配列から削除するものなのでこれで配る処理は完了
    player.cardsHand = cards.splice(0, gameCount);
    await sendCardsHand(message.client, player);
  }
};

const start = async (message: Message) => {
  const guildId = message.guild?.id ?? 'あほのID';
  if (!(guildId in games)) {
    message.channel.send('`!launch`で起動しようね');
    return;
  }
  if (games[guildId]!.players.length < 2) {
    message.channel.send('2人以上参加せんとできんぜよ');
    return;
  }
  games[guildId]!.status = 'expecting';
  games[guildId]!.players = shuffle(games[guildId]!.players);
  displayTurns(message);
  await dealCards(message);
  message.channel.send('DMで予想した勝利数を教えてちょー');
  games[guildId]!.players.forEach((player) => {
    urgeToExpect(message.client, player);
  });
};

export const checkEveryPlayerExpectedCount = async (
  channel: TextChannel | User,
  players: Player[],
) => {
  const fields = players.map(({ name, countExpected }) => ({
    name: `${name}くん`,
    value: `${countExpected}回`,
  }));
  const embed: Embed = {
    title: 'みんなの予想回数！',
    fields,
    color: colors.info,
  };
  await channel.send({ embed });
};

export const checkEveryPlayerHand = async (client: Client, player: Player) => {
  const { currentPutOut } = games[player.guildId]!;
  if (currentPutOut.length === 0) {
    return;
  }
  const fields = currentPutOut.map((card) => ({
    name: `${card.owner?.name}くんの出したやつ`,
    value: convertCardValue(card),
  }));
  const embed: Embed = {
    title: '今までに出たカード',
    fields,
    color: colors.info,
  };
  await sendPrivateMessage(client, player, { embed });
};

export const putOutCard = async (
  message: Message,
  player: Player,
  putOutIndex: number,
) => {
  const { cardsHand, guildId, name } = player;
  const game = games[guildId]!;
  const card = cardsHand.splice(putOutIndex, 1)[0];
  game.currentPutOut.push(card);
  if ('color' in card && game.currentColor === null) {
    game.currentColor = card.color;
  }
  card.owner = player;
  const embed: Embed = {
    title: `${name}くんの出したカード`,
    description: convertCardValue(card),
    color: convertToColor(card),
  };
  await sendAllMessage(message.client, player, { embed });
  updateCardWinning(player, card);
  await nextTurn(message, player);
};

const nextTurn = async (message: Message, player: Player) => {
  const game = games[player.guildId]!;
  game.playerTurnIndex += 1;
  const { players, playerTurnIndex } = game;
  if (playerTurnIndex < players.length) {
    const nextPlayer = players[playerTurnIndex];
    const publicMessage = `${nextPlayer.name}くんの番やで`;
    await sendPublicMessage(message.client, nextPlayer, publicMessage);
    await urgeToPutDownCard(message.client, nextPlayer);
    return;
  }
  updateBonus(player.guildId);
};
