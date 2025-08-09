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
  skullking: {
    data: new SlashCommandBuilder().setName('skullking').setDescription('スカルキングを起動する'),
    execute: async (interaction: ChatInputCommandInteraction) => {
      if (isSkullkingCategory(interaction)) {
        await interaction.reply({ content: '個人部屋で、すかき～んはできないよ', flags });
        return;
      }
      if (battle.get(interaction) !== null) {
        battle.remove(interaction);
      }
      const skullking = battle.create(interaction);
      if (skullking === null) {
        await interaction.reply({ content: '芸術は爆発だ', flags });
        return;
      }
      try {
        await skullking.recognizeCategory(interaction);
        await skullking.recognizeParentChannel();
      } catch {
        const content = 'すかきんがアクセスできないやつがあるから権限付与か消してやり直してみてね';
        await interaction.reply({ content, flags });
        return;
      }
      let content = 'すかき～ん';
      let components = [makeButtonRow('join')];
      await interaction.reply({ content, components });
      content = `<@${interaction.user.id}> こっちおいでー\n人集まったらスタートボタン押そうね`;
      components = [makeButtonRow('join', 'start')];
      await skullking.parent.send({ content, components });
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
      await skullking.reset(interaction);
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

const isSkullkingCategory = (interaction: ChatInputCommandInteraction) => {
  const { parent } = interaction.channel as TextChannel;
  return parent?.name === 'すかき～ん';
};
