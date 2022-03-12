import { Client } from 'discord.js';
import { config } from 'dotenv';
import { gameCommands } from './utility/game';
import { playerCommands } from './utility/player';

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
