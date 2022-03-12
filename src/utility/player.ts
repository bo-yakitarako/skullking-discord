import { Message } from 'discord.js';
import type { Card } from './cards';
import { games } from './game';

export type Player = {
  discordId: string;
  name: string;
  guildId: string;
  channelId: string;
  cardsHand: Card[];
  countExpected: number;
  countActual: number;
  point: number;
};

export const playerCommands = (message: Message) => {
  const command = message.content.split(' ');
  if (command[0] === '!join') {
    join(message);
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
  if (games[guildId]!.players.some((p) => p.discordId === discordId)) {
    message.channel.send('おめぇの席あるから！');
    return;
  }
  const player = {
    discordId,
    name: getDisplayName(message),
    guildId,
    channelId: message.channel.id,
    cardsHand: [],
    countExpected: 0,
    countActual: 0,
    point: 0,
  };
  games[guildId]!.players.push(player);
  message.channel.send(`${player.name}が入ったぞい！`);
};
