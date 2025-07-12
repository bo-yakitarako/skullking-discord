import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';

config();

const TOKEN = process.env.TOKEN as string;
const CLIENT_ID = process.env.CLIENT_ID as string;
(async () => {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
  } catch (error) {
    console.error(error);
  }
})();
