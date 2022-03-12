import { Client } from 'discord.js';
import { config } from 'dotenv';

config();

const client = new Client();

client.on('ready', () => {
  console.log('すかき〜ん');
});

client.on('message', (message) => {
  if (message.author.bot) {
    return;
  }
  console.log('あほあほちーん');
});

const TOKEN = process.env.TOKEN as string;
client.login(TOKEN);
