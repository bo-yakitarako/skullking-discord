import { Client, EmbedFieldData } from 'discord.js';
import { config } from 'dotenv';
import { gameCommands } from './utility/game';
import { playerCommands } from './utility/player';

export type Embed = {
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  title?: string;
  url?: string;
  description?: string;
  color?: number;
  timestamp?: Date;
  footer?: {
    icon_url?: string;
    text: string;
  };
  thumbnail?: {
    url: string;
  };
  image?: {
    url: string;
  };
  fields?: EmbedFieldData[];
};

config();

const client = new Client();

client.on('ready', () => {
  console.log('すかき〜ん');
});

client.on('message', (message) => {
  if (message.author.bot) {
    return;
  }
  gameCommands(message);
  playerCommands(message);
});

const TOKEN = process.env.TOKEN as string;
client.login(TOKEN);
