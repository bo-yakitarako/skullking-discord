import { Message } from 'discord.js';
import { Embed } from '..';
import { Card, convertCardValue } from './cards';
import { colors } from './embedColor';
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

const currentPlayers: Player[] = [];

export const playerCommands = (message: Message) => {
  const command = message.content.split(' ');
  if (command[0] === '!join') {
    join(message);
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
    countExpected: 0,
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
    color: colors.info,
    fields,
  };
  const user = await message.client.users.fetch(player.discordId, false);
  user.send({ embed });
};
