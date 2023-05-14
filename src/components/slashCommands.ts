import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { games, reset } from '../utility/game';
import { currentPlayers } from '../utility/player';
import { generateDeck } from '../utility/cards';
import { joinButton, startButton } from './buttons';

export const launchCommand = {
  data: new SlashCommandBuilder()
    .setName('launch')
    .setDescription('スカルキングを起動する'),
  execute: async (interaction: ChatInputCommandInteraction) => {
    if (interaction.guild === null) {
      await interaction.reply('あほしね');
      return;
    }
    const guildId = interaction.guild.id;
    if (games[guildId] !== undefined) {
      const { players } = games[guildId]!;
      players.forEach((p) => {
        const index = currentPlayers.findIndex(
          (ps) => ps.discordId === p.discordId,
        );
        currentPlayers.splice(index, 1);
      });
    }
    games[guildId] = {
      status: 'ready',
      players: [],
      cpuCount: 0,
      gameCount: 1,
      playerTurnIndex: 0,
      cards: generateDeck(),
      currentPutOut: [],
      currentColor: null,
      currentWinner: null,
      deadCards: [],
    };
    const row = new ActionRowBuilder().addComponents([
      joinButton.component,
      startButton.component,
    ]);
    // componentsで型エラー出てるけど、バリバリ動いてたので無視
    // @ts-ignore
    await interaction.reply({ content: 'すかき～ん', components: [row] });
  },
};

export const resetCommand = {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('ゲームをリセットして終了する'),
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.reply('ばいばーい');
    await reset(interaction);
  },
};
