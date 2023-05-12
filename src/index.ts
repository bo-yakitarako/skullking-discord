import {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  Collection,
  REST,
  Routes,
  ChatInputCommandInteraction,
} from 'discord.js';
import { config } from 'dotenv';

config();

type Command = typeof command;
interface CommandClient extends Client {
  commands: Collection<string, Command>;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
  ],
}) as CommandClient;

client.once(Events.ClientReady, () => {
  console.log('すかき〜ん');
});

const command = {
  data: new SlashCommandBuilder()
    .setName('skullking')
    .setDescription('すかき～んって言わせろ！！！'),
  execute: async (interaction: ChatInputCommandInteraction) => {
    interaction.reply('すかき〜ん');
  },
};
const commands = [command.data.toJSON()];

client.on(
  Events.InteractionCreate,
  async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }
    // @ts-ignore
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      return;
    }
    try {
      await command.execute(interaction);
    } catch {
      console.error('だめです');
    }
    // gameCommands(message);
    // playerCommands(message);
  },
);

const TOKEN = process.env.TOKEN as string;
const CLIENT_ID = process.env.APPLICATION_ID as string;
const GUILD_ID = process.env.GUILD_ID as string;
client.commands = new Collection();
client.commands.set(command.data.name, command);
const rest = new REST().setToken(TOKEN);
(async () => {
  try {
    // @ts-ignore
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
  } catch (error) {
    console.error(error);
  }
})();
client.login(TOKEN);
