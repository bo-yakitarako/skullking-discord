import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { battle } from '../battle/Skullking';
import { makeButtonRow } from '../utils';

const flags = MessageFlags.Ephemeral;

const registration = {
  launch: {
    data: new SlashCommandBuilder().setName('launch').setDescription('スカルキングを起動する'),
    execute: async (interaction: ChatInputCommandInteraction) => {
      if (battle.get(interaction) !== null) {
        await interaction.reply({ content: 'もうすかきんしてるよ', flags });
        return;
      }
      battle.create(interaction);
      const content = 'すかき～ん';
      const components = [makeButtonRow('join', 'start')];
      await interaction.reply({ content, components });
    },
  },
  reset: {
    data: new SlashCommandBuilder().setName('reset').setDescription('ゲームをリセットして終了する'),
    execute: async (interaction: ChatInputCommandInteraction) => {
      const skullking = battle.get(interaction);
      if (skullking === null) {
        const content = 'この鯖ですかきんはしてないよ';
        await interaction.reply({ content, flags });
        return;
      }
      await interaction.reply({ content: 'ばいばーい', flags });
      await skullking.sendToAll(':bye:');
      battle.remove(interaction);
    },
  },
};

type CommandName = keyof typeof registration;

export const commands = Object.values(registration).map(({ data }) => data.toJSON());
export const slashCommandsInteraction = async (interaction: ChatInputCommandInteraction) => {
  if (!(interaction.channel instanceof TextChannel)) {
    await interaction.reply({ content: 'ほ？', flags });
    return;
  }
  const commandName = interaction.commandName as CommandName;
  await registration[commandName].execute(interaction);
};
