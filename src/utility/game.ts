import { Message } from 'discord.js';
import { Embed } from '..';
import { Card, generateDeck, shuffle } from './cards';
import { colors } from './embedColor';
import { Player, sendCardsHand } from './player';

type Game = {
  status: 'ready' | 'playing' | 'finish';
  players: Player[];
  gameCount: number;
  cards: Card[];
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
    cards,
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

const dealCards = (message: Message) => {
  const game = games[message.guild!.id]!;
  const { players, gameCount, deadCards } = game;
  let { cards } = game;
  if (cards.length < players.length * gameCount) {
    cards = [...cards, ...shuffle(deadCards)];
    game.cards = [...cards];
    game.deadCards = [];
  }
  players.forEach((player) => {
    // spliceは該当箇所を返して元の配列から削除するものなのでこれで配る処理は完了
    player.cardsHand = cards.splice(0, gameCount); // eslint-disable-line no-param-reassign
    sendCardsHand(message, player);
  });
};

const start = (message: Message) => {
  const guildId = message.guild?.id ?? 'あほのID';
  if (!(guildId in games)) {
    message.channel.send('`!launch`で起動しようね');
    return;
  }
  if (games[guildId]!.players.length < 2) {
    message.channel.send('2人以上参加せんとできんぜよ');
    return;
  }
  games[guildId]!.status = 'playing';
  games[guildId]!.players = shuffle(games[guildId]!.players);
  displayTurns(message);
  dealCards(message);
};
