import {
  Client,
  Message,
  MessageCreateOptions,
  MessagePayload,
  TextChannel,
  APIEmbed,
  ButtonInteraction,
  Interaction,
  User,
  MessageComponentInteraction,
  StringSelectMenuInteraction,
  ActionRowBuilder,
} from 'discord.js';
import { Card, convertCardValue } from './cards';
import { colors } from './embedColor';
import { sendEveryPlayerHand, games, putOutCard, cpPut } from './game';
import {
  BUTTON_ID,
  byeButton,
  cardSelectSendButton,
  expectSendButton,
  joinButton,
  tigresEscapeButton,
  tigresPiratesButton,
} from '../components/buttons';
import {
  SELECT_MENU_ID,
  cardSelect,
  expectCountSelect,
} from '../components/selectMenus';

export type Player = {
  discordId: string;
  name: string;
  guildId: string;
  channelId: string;
  cardsHand: Card[];
  selectedCountExpected: number | null;
  selectedCardIndex: number | null;
  countExpected: number | null;
  countActual: number;
  point: number;
  history: number[];
  collectedCards: Card[];
  goldBonus?: number;
  isCp: boolean;
};

export const currentPlayers: Player[] = [];

export async function sendAllMessage(
  client: Client,
  player: Player,
  message: string | MessagePayload | MessageCreateOptions,
) {
  if (!player) {
    return;
  }
  const { players } = games[player.guildId]!;
  for (const p of players) {
    await sendPrivateMessage(client, p, message);
  }
  await sendPublicMessage(client, player, message);
}

export async function sendPrivateMessage(
  client: Client,
  player: Player,
  message: string | MessagePayload | MessageCreateOptions,
) {
  if (player.isCp) {
    return;
  }
  const user = await client.users.fetch(player.discordId);
  if (user === undefined) {
    return;
  }
  try {
    await user.send(message);
  } catch {
    await user.send('あほしねや');
  }
}

export async function sendPublicMessage(
  client: Client,
  player: Player,
  message: string | MessagePayload | MessageCreateOptions,
) {
  const { guildId, channelId } = player;
  const guild = client.guilds.cache.get(guildId)!;
  const channel = guild.channels.cache.get(channelId)! as TextChannel;
  await channel.send(message);
}

export const playerButtons = (interaction: ButtonInteraction) => {
  const { customId } = interaction;
  if (customId === BUTTON_ID.JOIN) {
    joinButton.execute(interaction);
    return;
  }
  if (customId === BUTTON_ID.EXPECT_SEND) {
    expectSendButton.execute(interaction);
  }
  if (customId === BUTTON_ID.CARD_SELECT_SEND) {
    cardSelectSendButton.execute(interaction);
    return;
  }
  if (customId === BUTTON_ID.TIGRES_PIRATES) {
    tigresPiratesButton.execute(interaction);
    return;
  }
  if (customId === BUTTON_ID.TIGRES_ESCAPE) {
    tigresEscapeButton.execute(interaction);
    return;
  }
  if (customId === BUTTON_ID.BYE) {
    byeButton.execute(interaction);
  }
};

export const playerSelectMenus = (interaction: StringSelectMenuInteraction) => {
  const { customId } = interaction;
  if (customId === SELECT_MENU_ID.EXPECT_COUNT) {
    expectCountSelect.execute(interaction);
  }
};

export const getDisplayName = (interaction: Interaction) => {
  const member = interaction.guild!.members!.cache!.find(
    (member) => member.id === interaction.user.id,
  );
  return member?.displayName ?? interaction.user.username;
};

export const mention = (user: User) => {
  return `<@!${user.id}>`;
};

export const sendCardsHand = async (client: Client, player: Player) => {
  if (player.isCp) {
    return;
  }
  const { currentColor } = games[player.guildId]!;
  const hasColor = player.cardsHand.some(
    (card) => 'color' in card && card.color === currentColor,
  );
  const { countExpected, countActual } = player;
  const fields = player.cardsHand.map((card, index) => {
    const isInvalid =
      hasColor && 'color' in card && card.color !== currentColor;
    const name = `${index + 1}${isInvalid ? ' :x:' : ''}`;
    const value = convertCardValue(card);
    return { name, value, inline: true };
  });
  const embed: APIEmbed = {
    title: '手札',
    description:
      countExpected === null
        ? undefined
        : `予想: ${countExpected}\n勝数: ${countActual}`,
    color: colors.yellow,
    fields,
  };
  const user = await client.users.fetch(player.discordId);
  user.send({ embeds: [embed] });
};

export const urgeToExpect = async (client: Client, player: Player) => {
  const game = games[player.guildId];
  if (game === undefined) {
    return;
  }
  if (player.isCp) {
    const { gameCount } = games[player.guildId]!;
    player.countExpected = Math.floor(Math.random() * (gameCount + 1));
    return;
  }
  const description = '勝利数を選んで送信しようね';
  const embed: APIEmbed = {
    title: '勝利数を予想しよう！',
    color: colors.info,
    description,
  };
  const selectRow = new ActionRowBuilder().addComponents(
    expectCountSelect.component(game.gameCount),
  );
  const buttonRow = new ActionRowBuilder().addComponents(
    expectSendButton.component,
  );
  await sendPrivateMessage(client, player, {
    embeds: [embed],
    // @ts-ignore
    components: [selectRow, buttonRow],
  });
};

export const urgeToPutDownCard = async (
  interaction: MessageComponentInteraction,
  player: Player,
) => {
  if (player.isCp) {
    await cpPut(interaction, player);
    return;
  }
  const description = '順番回ってきちゃったんでカード出そうね';
  const embed: APIEmbed = {
    title: 'カードを出すんだぞい',
    description,
    color: colors.info,
  };
  const { cardsHand, guildId } = player;
  if (!(guildId in games)) {
    await interaction.reply('芸術は爆発だ');
    return;
  }
  const { currentColor } = games[guildId]!;
  const selectRow = new ActionRowBuilder().addComponents(
    cardSelect.component(cardsHand, currentColor),
  );
  const sendRow = new ActionRowBuilder().addComponents(
    cardSelectSendButton.component,
  );
  await sendPrivateMessage(interaction.client, player, { embeds: [embed] });
  await sendEveryPlayerHand(interaction.client, player);
  await sendCardsHand(interaction.client, player);
  await sendPrivateMessage(interaction.client, player, {
    // @ts-ignore
    components: [selectRow, sendRow],
  });
};

export const putOut = async (
  interaction: MessageComponentInteraction,
  putOutIndex: number,
) => {
  const player = currentPlayers.find(
    (p) => p.discordId === interaction.user.id,
  )!;
  const { cardsHand } = player;
  const card = cardsHand[putOutIndex];
  if ('type' in card && card.type === 'tigres' && card.tigresType === null) {
    const row = new ActionRowBuilder().addComponents(
      tigresPiratesButton.component,
      tigresEscapeButton.component,
    );
    await sendPrivateMessage(interaction.client, player, {
      content: 'ティグレスどっちー？',
      // @ts-ignore
      components: [row],
    });
    return;
  }
  player.selectedCardIndex = null;
  await putOutCard(interaction, player, putOutIndex);
};

export const bye = async (
  callbackParam: Message | MessageComponentInteraction,
) => {
  const id = 'user' in callbackParam ? callbackParam.user.id : callbackParam.id;
  const index = currentPlayers.findIndex((p) => p.discordId === id);
  if (index < 0) {
    return;
  }
  const player = currentPlayers[index];
  const game = games[player.guildId]!;
  if (game.status !== 'ready') {
    await sendPrivateMessage(
      callbackParam.client,
      player,
      'プレイ中は途中で抜けられないよ><',
    );
    return;
  }
  game.players.splice(
    game.players.findIndex((p) => p.discordId === player.discordId),
    1,
  );
  currentPlayers.splice(index, 1);
  await sendPrivateMessage(callbackParam.client, player, ':wave:');
};
