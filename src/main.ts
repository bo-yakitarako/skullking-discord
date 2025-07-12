import { Client, GatewayIntentBits, Events, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { gameButtons, gameCommands, gameSelectMenus } from './utility/game';
import { playerButtons, playerSelectMenus } from './utility/player';
import { launchCommand, resetCommand } from './components/slashCommands';

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

client.on(Events.InteractionCreate, (interaction) => {
  if (interaction.isChatInputCommand()) {
    gameCommands(interaction);
  }
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
const CLIENT_ID = process.env.CLIENT_ID as string;
const GUILD_ID = process.env.GUILD_ID ?? null;
const commands = [launchCommand.data.toJSON(), resetCommand.data.toJSON()];
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    if (GUILD_ID !== null) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
        body: commands,
      });
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), {
        body: commands,
      });
    }
  } catch (error) {
    console.error(error);
  }
})();
client.login(TOKEN);
