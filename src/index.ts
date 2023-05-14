import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from 'dotenv';
import { gameButtons, gameCommands, gameSelectMenus } from './utility/game';
import { playerButtons, playerSelectMenus } from './utility/player';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once(Events.ClientReady, () => {
  console.log('すかき〜ん');
});

client.on(Events.MessageCreate, (message) => {
  if (message.author.bot) return;
  gameCommands(message);
});

client.on(Events.InteractionCreate, (interaction) => {
  if (interaction.isButton()) {
    playerButtons(interaction);
    gameButtons(interaction);
  }
  if (interaction.isStringSelectMenu()) {
    playerSelectMenus(interaction);
    gameSelectMenus(interaction);
  }
});

const TOKEN = process.env.TOKEN as string;
client.login(TOKEN);
