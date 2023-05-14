import {
  APIEmbed,
  ActionRowBuilder,
  ButtonInteraction,
  Client,
  Message,
  MessageComponentInteraction,
  StringSelectMenuInteraction,
  TextChannel,
  User,
} from 'discord.js';
import { Card, Color, convertCardValue, generateDeck, shuffle } from './cards';
import { colors, convertToColor } from './embedColor';
import {
  generateScores,
  updateBonus,
  updateCardWinning,
  updateGoldBonus,
} from './judgement';
import {
  currentPlayers,
  Player,
  sendAllMessage,
  sendCardsHand,
  sendPrivateMessage,
  sendPublicMessage,
  urgeToExpect,
  urgeToPutDownCard,
} from './player';
import {
  BUTTON_ID,
  byeButton,
  cpuSetButton,
  joinButton,
  resetButton,
  startButton,
  startCancelButton,
} from '../components/buttons';
import {
  SELECT_MENU_ID,
  cardSelect,
  cpuCountSelect,
  historySelect,
} from '../components/selectMenus';

type Game = {
  status: 'ready' | 'expecting' | 'putting' | 'finish';
  players: Player[];
  cpuCount: number;
  gameCount: number;
  playerTurnIndex: number;
  cards: Card[];
  currentPutOut: Card[];
  currentColor: Color | null;
  currentWinner: {
    player: Player;
    card: Card;
  } | null;
  deadCards: Card[];
};

type Games = { [guildId in string]?: Game };

export const games: Games = {};

const GAME_COUNT = 10;

export const gameCommands = (message: Message) => {
  const command = message.content.split(' ');
  if (command[0] === '!launch') {
    launch(message);
    return;
  }
  if (command[0] === '!reset') {
    reset(message);
  }
};

export const gameButtons = (interaction: ButtonInteraction) => {
  const { customId } = interaction;
  if (customId === BUTTON_ID.START) {
    startButton.execute(interaction);
    return;
  }
  if (customId === BUTTON_ID.CPU_SET) {
    cpuSetButton.execute(interaction);
    return;
  }
  if (customId === BUTTON_ID.START_CANCEL) {
    startCancelButton.execute(interaction);
    return;
  }
  if (customId === BUTTON_ID.RESET) {
    resetButton.execute(interaction);
  }
};

export const gameSelectMenus = (interaction: StringSelectMenuInteraction) => {
  const { customId } = interaction;
  if (customId === SELECT_MENU_ID.CPU_COUNT) {
    cpuCountSelect.execute(interaction);
    return;
  }
  if (customId === SELECT_MENU_ID.CARD_SELECT) {
    cardSelect.execute(interaction);
    return;
  }
  if (customId === SELECT_MENU_ID.HISTORY_SELECT) {
    historySelect.execute(interaction);
  }
};

const launch = (message: Message) => {
  if (message.guild === null) {
    message.channel.send('あほしね');
    return;
  }
  const guildId = message.guild.id;
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
  message.channel.send({ content: 'すかき～ん', components: [row] });
};

export const displayTurns = async (
  interaction: MessageComponentInteraction,
) => {
  let guildId = interaction.guild?.id;
  const discordId = interaction.user.id;
  if (guildId === undefined) {
    guildId = currentPlayers.find((p) => p.discordId === discordId)?.guildId;
    if (guildId === undefined) {
      return;
    }
  }
  const { players } = games[guildId]!;
  const turns = players
    .map(({ name }, index) => `${index + 1}. ${name}`)
    .join('\n');
  const embed: APIEmbed = {
    title: '順番',
    description: `${turns}`,
    color: colors.info,
  };
  if (players.every((p) => p.countExpected !== null)) {
    embed.fields = players.map(({ name, countExpected, countActual }) => ({
      name: `${name}くんの現状`,
      value: `予想: ${countExpected}\n勝数: ${countActual}`,
    }));
  }
  const row = new ActionRowBuilder().addComponents(
    historySelect.component(players),
  );
  const data = { embeds: [embed], components: [row] };
  for (const p of players) {
    // @ts-ignore
    await sendPrivateMessage(interaction.client, p, data);
  }
  // @ts-ignore
  await sendPublicMessage(interaction.client, players[0], data);
};

export const dealCards = async (interaction: MessageComponentInteraction) => {
  let guildId = interaction.guild?.id;
  if (guildId === undefined) {
    const p = currentPlayers.find((p) => p.discordId === interaction.user.id);
    guildId = p!.guildId;
  }
  const game = games[guildId]!;
  const { players, gameCount, deadCards } = game;
  let { cards } = game;
  if (cards.length < players.length * gameCount) {
    const alert = '捨て札からカード補充したぜよ';
    await sendAllMessage(interaction.client, players[0], alert);
    cards = [...cards, ...shuffle(deadCards)];
    game.cards = cards;
    game.deadCards = [];
  }
  for (const player of players) {
    // spliceは該当箇所を返して元の配列から削除するものなのでこれで配る処理は完了
    player.cardsHand = cards.splice(0, gameCount);
    await sendCardsHand(interaction.client, player);
  }
};

export const sendEveryPlayerExpectedCount = async (
  channel: TextChannel | User,
  players: Player[],
) => {
  const fields = players.map(({ name, countExpected }) => ({
    name: `${name}くん`,
    value: `${countExpected}回`,
  }));
  const embed: APIEmbed = {
    title: 'みんなの予想回数！',
    fields,
    color: colors.info,
  };
  await channel.send({ embeds: [embed] });
};

export const sendEveryPlayerHand = async (client: Client, player: Player) => {
  const { currentPutOut } = games[player.guildId]!;
  if (currentPutOut.length === 0) {
    return;
  }
  const fields = currentPutOut.map((card) => ({
    name: `${card.owner?.name}くんの出したやつ`,
    value: convertCardValue(card),
  }));
  const embed: APIEmbed = {
    title: '今までに出たカード',
    fields,
    color: colors.info,
  };
  await sendPrivateMessage(client, player, { embeds: [embed] });
};

export const putOutCard = async (
  interaction: MessageComponentInteraction,
  player: Player,
  putOutIndex: number,
) => {
  const { cardsHand, guildId, name } = player;
  const game = games[guildId]!;
  const card = cardsHand.splice(putOutIndex, 1)[0];
  game.currentPutOut.push(card);
  if ('color' in card && game.currentColor === null) {
    game.currentColor = card.color;
  }
  card.owner = player;
  const embed: APIEmbed = {
    title: `${name}くんの出したカード`,
    description: convertCardValue(card),
    color: convertToColor(card),
  };
  await sendAllMessage(interaction.client, player, { embeds: [embed] });
  updateCardWinning(player, card);
  await nextTurn(interaction, player);
};

const alertWinner = async (
  interaction: MessageComponentInteraction,
  p: Player,
  hasKraken: boolean,
) => {
  const { currentWinner } = games[p.guildId]!;
  const { player, card } = currentWinner!;
  const title = hasKraken ? '残念ながら...' : `${player.name}くんの勝ち！`;
  const description = hasKraken
    ? 'クラーケンが出たのでお流れです...'
    : `${convertCardValue(card)}を出したよ！`;
  const color = colors.gold;
  const embed: APIEmbed = { title, description, color };
  await sendAllMessage(interaction.client, player, { embeds: [embed] });
};

const reorder = (guildId: string) => {
  const game = games[guildId]!;
  const { currentWinner, players } = game;
  const winner = currentWinner?.player;
  if (winner === undefined) {
    return;
  }
  const index = players.indexOf(winner);
  game.players = [...players.slice(index), ...players.slice(0, index)];
};

const resultOnOneGame = async (
  interaction: MessageComponentInteraction,
  guildId: string,
) => {
  const game = games[guildId]!;
  const { players } = game;
  const scores = generateScores(guildId);
  const fields = players.map((player, index) => {
    const score = scores[index];
    player.point += score;
    player.history.push(score);
    const { name } = player;
    const sign = score > 0 ? '+' : '';
    const totalSign = player.point > 0 ? '+' : '';
    return {
      name: `${name}くんの結果`,
      value: `**${sign}${score}点** (合計${totalSign}${player.point}点)`,
    };
  });
  const embed: APIEmbed = {
    title: '今回の得点は...！？',
    fields,
    color: colors.info,
  };
  await sendAllMessage(interaction.client, players[0], { embeds: [embed] });
  const deadCards = players.reduce((acc, { collectedCards }) => {
    const initCards = collectedCards.map((card) => {
      if ('color' in card) {
        return { ...card, owner: undefined };
      }
      return {
        ...card,
        owner: undefined,
        bonus: 0,
        tigresType: null,
      };
    });
    return [...acc, ...initCards];
  }, [] as Card[]);
  players.forEach((player) => {
    player.countExpected = null;
    player.countActual = 0;
    player.collectedCards = [];
  });
  game.deadCards = [...game.deadCards, ...deadCards];
  game.gameCount += 1;
  if (game.gameCount <= GAME_COUNT) {
    const nextMessage = `第${game.gameCount}戦目やってこー`;
    await sendAllMessage(interaction.client, players[0], nextMessage);
    game.status = 'expecting';
    await displayTurns(interaction);
    await dealCards(interaction);
    game.players.forEach((player) => {
      urgeToExpect(interaction.client, player);
    });
    return;
  }
  await finish(interaction, players[0].guildId);
};

export const cpPut = async (
  interaction: MessageComponentInteraction,
  cp: Player,
) => {
  const indexes = [...Array(cp.cardsHand.length).keys()];
  const { currentColor } = games[cp.guildId]!;
  const hasColor = cp.cardsHand.some(
    (card) => 'color' in card && card.color === currentColor,
  );
  const validIndexes = indexes.filter((index) => {
    const card = cp.cardsHand[index];
    if ('type' in card || !hasColor) {
      return true;
    }
    return card.color === currentColor;
  });
  const cardIndex =
    validIndexes[Math.floor(Math.random() * validIndexes.length)];
  const card = cp.cardsHand[cardIndex];
  if ('type' in card && card.type === 'tigres') {
    card.tigresType = Math.random() < 0.5 ? 'pirates' : 'escape';
  }
  await putOutCard(interaction, cp, cardIndex);
};

const nextTurn = async (
  interaction: MessageComponentInteraction,
  player: Player,
) => {
  const game = games[player.guildId]!;
  game.playerTurnIndex += 1;
  const { players, playerTurnIndex } = game;
  if (playerTurnIndex < players.length) {
    const nextPlayer = players[playerTurnIndex];
    if (nextPlayer.isCp) {
      await cpPut(interaction, nextPlayer);
      return;
    }
    const publicMessage = `${nextPlayer.name}くんの番やで`;
    await sendPublicMessage(interaction.client, nextPlayer, publicMessage);
    await urgeToPutDownCard(interaction, nextPlayer);
    return;
  }
  const { currentPutOut: putOuts } = game;
  const hasKraken = putOuts.some(
    (card) => 'type' in card && card.escapeType === 'kraken',
  );
  await alertWinner(interaction, player, hasKraken);
  if (hasKraken) {
    game.deadCards.push(...putOuts);
  } else {
    game.currentWinner!.player.collectedCards.push(...putOuts);
    game.currentWinner!.player.countActual += 1;
  }
  updateBonus(player.guildId);
  reorder(player.guildId);
  game.playerTurnIndex = 0;
  game.currentWinner = null;
  game.currentColor = null;
  game.currentPutOut = [];
  if (player.cardsHand.length === 0) {
    updateGoldBonus(player.guildId);
    await resultOnOneGame(interaction, player.guildId);
    return;
  }
  await displayTurns(interaction);
  const resumeMessage = `${game.players[0].name}くんから再開や〜`;
  await sendAllMessage(interaction.client, player, resumeMessage);
  await urgeToPutDownCard(interaction, game.players[0]);
};

const finish = async (
  interaction: MessageComponentInteraction,
  guildId: string,
) => {
  const game = games[guildId]!;
  const { players } = game;
  const rankedPlayers = [...players].sort((a, b) => b.point - a.point);
  const fields = rankedPlayers.map((player, index) => {
    const { name, point } = player;
    const sign = point > 0 ? '+' : '';
    return {
      name: `${index + 1}位！`,
      value: `**${name}**: ${sign}${point}点`,
    };
  });
  const embed: APIEmbed = {
    title: '結果はっぴょおぉ〜〜〜',
    fields,
    color: colors.pirates,
  };
  await sendAllMessage(interaction.client, players[0], { embeds: [embed] });
  const restartRow = new ActionRowBuilder().addComponents([
    joinButton.component,
    startButton.component,
  ]);
  await sendPublicMessage(interaction.client, players[0], {
    content: 'すかき～ん',
    // @ts-ignore
    components: [restartRow],
  });
  game.cards = generateDeck();
  game.deadCards = [];
  game.cpuCount = 0;
  game.gameCount = 1;
  game.status = 'ready';
  const finishButtonRow = new ActionRowBuilder().addComponents([
    byeButton.component,
    resetButton.component,
  ]);
  for (const player of players) {
    await sendPrivateMessage(interaction.client, player, {
      content: 'またやる場合は鯖のチャンネルでスタートボタンを押してね～',
      // @ts-ignore
      components: [finishButtonRow],
    });
  }
};

export const reset = async (
  callbackParam: Message | MessageComponentInteraction,
) => {
  let guildId = callbackParam.guild?.id;
  if (guildId === undefined) {
    const id =
      'user' in callbackParam ? callbackParam.user.id : callbackParam.author.id;
    const p = currentPlayers.find((p) => p.discordId === id);
    guildId = p?.guildId;
    if (guildId === undefined) {
      return;
    }
  }
  if (!(guildId in games)) {
    return;
  }
  const game = games[guildId]!;
  await sendAllMessage(callbackParam.client, game.players[0], ':wave:');
  game.players.forEach((p) => {
    const index = currentPlayers.findIndex(
      (cp) => cp.discordId === p.discordId,
    );
    currentPlayers.splice(index, 1);
  });
  delete games[guildId];
};
