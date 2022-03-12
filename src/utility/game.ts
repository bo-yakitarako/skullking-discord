import { Message } from 'discord.js';
import { Card, generateDeck } from './cards';
import type { Player } from './player';

type Game = {
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
    return;
  }
  console.log('ばかがよ');
};

const launch = (message: Message) => {
  if (message.guild === null) {
    message.channel.send('あほしね');
    return;
  }
  const guildId = message.guild.id;
  const cards = generateDeck();
  games[guildId] = {
    players: [],
    gameCount: 0,
    cards,
    deadCards: [],
  };
  console.log(games);
  message.channel.send('すかき〜ん(`!join`で参加しよう)');
};
