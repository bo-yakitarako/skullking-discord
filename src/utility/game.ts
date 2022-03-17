import { Client, Message, TextChannel, User } from 'discord.js';
import { Embed } from '..';
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

type Game = {
  status: 'ready' | 'expecting' | 'putting' | 'finish';
  players: Player[];
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

export const gameCommands = (message: Message) => {
  const command = message.content.split(' ');
  if (command[0] === '!launch') {
    launch(message);
    return;
  }
  if (command[0] === '!start') {
    start(message);
    return;
  }
  if (command[0] === '!reset') {
    reset(message);
  }
};

const launch = (message: Message) => {
  if (message.guild === null) {
    message.channel.send('あほしね');
    return;
  }
  const guildId = message.guild.id;
  const cards = generateDeck();
  games[guildId] = {
    status: 'ready',
    players: [],
    gameCount: 1,
    playerTurnIndex: 0,
    cards,
    currentPutOut: [],
    currentColor: null,
    currentWinner: null,
    deadCards: [],
  };
  message.channel.send('すかき〜ん(`!join`で参加しよう)');
};

const displayTurns = async (message: Message) => {
  let guildId = message.guild?.id;
  const discordId = message.author.id;
  if (guildId === undefined) {
    guildId = currentPlayers.find((p) => p.discordId === discordId)?.guildId;
    if (guildId === undefined) {
      return;
    }
  }
  const { players } = games[guildId]!;
  const description = players
    .map(({ name }, index) => `${index + 1}. ${name}`)
    .join('\n');
  const embedBase: Embed = {
    title: '順番',
    description,
    color: colors.info,
  };
  if (players.every((p) => p.countExpected !== null)) {
    embedBase.fields = players.map(({ name, countExpected, countActual }) => ({
      name: `${name}くんの現状`,
      value: `予想: ${countExpected}\n勝数: ${countActual}`,
    }));
  }
  for (const p of players) {
    const embed = { ...embedBase };
    if (embed.fields !== undefined) {
      const index = players.findIndex((ps) => ps.discordId === p.discordId);
      embed.fields = embed.fields.filter((_, i) => i !== index);
    }
    await sendPrivateMessage(message.client, p, { embed });
  }
  await sendPublicMessage(message.client, players[0], { embed: embedBase });
};

const dealCards = async (message: Message) => {
  let guildId = message.guild?.id;
  if (guildId === undefined) {
    const p = currentPlayers.find((p) => p.discordId === message.author.id);
    guildId = p!.guildId;
  }
  const game = games[guildId]!;
  const { players, gameCount, deadCards } = game;
  let { cards } = game;
  if (cards.length < players.length * gameCount) {
    const alert = '捨て札からカード補充したぜよ';
    await sendAllMessage(message.client, players[0], alert);
    cards = [...cards, ...shuffle(deadCards)];
    game.cards = cards;
    game.deadCards = [];
  }
  for (const player of players) {
    // spliceは該当箇所を返して元の配列から削除するものなのでこれで配る処理は完了
    player.cardsHand = cards.splice(0, gameCount);
    await sendCardsHand(message.client, player);
  }
};

const start = async (message: Message) => {
  const guildId = message.guild?.id ?? 'あほのID';
  if (!(guildId in games)) {
    message.channel.send('`!launch`で起動しようね');
    return;
  }
  const cp: Player = {
    discordId: '',
    name: 'コンピューター',
    guildId,
    channelId: message.channel.id,
    cardsHand: [],
    countExpected: null,
    countActual: 0,
    point: 0,
    collectedCards: [],
    isCp: true,
  };
  if (games[guildId]!.players.length < 2) {
    message.channel.send('2人以上参加せんとできんぜよ');
    return;
  }
  if (games[guildId]!.players.length < 3) {
    games[guildId]!.players.push(cp);
  }
  games[guildId]!.status = 'expecting';
  games[guildId]!.players = shuffle(games[guildId]!.players);
  await displayTurns(message);
  await dealCards(message);
  message.channel.send('DMで予想した勝利数を教えてちょー');
  games[guildId]!.players.forEach((player) => {
    urgeToExpect(message.client, player);
  });
};

export const checkEveryPlayerExpectedCount = async (
  channel: TextChannel | User,
  players: Player[],
) => {
  const fields = players.map(({ name, countExpected }) => ({
    name: `${name}くん`,
    value: `${countExpected}回`,
  }));
  const embed: Embed = {
    title: 'みんなの予想回数！',
    fields,
    color: colors.info,
  };
  await channel.send({ embed });
};

export const checkEveryPlayerHand = async (client: Client, player: Player) => {
  const { currentPutOut } = games[player.guildId]!;
  if (currentPutOut.length === 0) {
    return;
  }
  const fields = currentPutOut.map((card) => ({
    name: `${card.owner?.name}くんの出したやつ`,
    value: convertCardValue(card),
  }));
  const embed: Embed = {
    title: '今までに出たカード',
    fields,
    color: colors.info,
  };
  await sendPrivateMessage(client, player, { embed });
};

export const putOutCard = async (
  message: Message,
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
  const embed: Embed = {
    title: `${name}くんの出したカード`,
    description: convertCardValue(card),
    color: convertToColor(card),
  };
  await sendAllMessage(message.client, player, { embed });
  updateCardWinning(player, card);
  await nextTurn(message, player);
};

const alertWinner = async (message: Message, p: Player, hasKraken: boolean) => {
  const { currentWinner } = games[p.guildId]!;
  const { player, card } = currentWinner!;
  const title = hasKraken ? '残念ながら...' : `${player.name}くんの勝ち！`;
  const description = hasKraken
    ? 'クラーケンが出たのでお流れです...'
    : `${convertCardValue(card)}を出したよ！`;
  const color = colors.gold;
  const embed: Embed = { title, description, color };
  await sendAllMessage(message.client, player, { embed });
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

const resultOnOneGame = async (message: Message, guildId: string) => {
  const game = games[guildId]!;
  const { players } = game;
  const scores = generateScores(guildId);
  const fields = players.map((player, index) => {
    player.point += scores[index];
    const { name } = player;
    const sign = scores[index] > 0 ? '+' : '';
    return {
      name: `${name}くんの結果`,
      value: `**${sign}${scores[index]}点**`,
    };
  });
  const embed: Embed = {
    title: '今回の得点は...！？',
    fields,
    color: colors.info,
  };
  await sendAllMessage(message.client, players[0], { embed });
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
  if (game.gameCount <= 10) {
    const nextMessage = `第${game.gameCount}戦目やってこー`;
    await sendAllMessage(message.client, players[0], nextMessage);
    game.status = 'expecting';
    await displayTurns(message);
    await dealCards(message);
    game.players.forEach((player) => {
      urgeToExpect(message.client, player);
    });
    return;
  }
  await finish(message, players[0].guildId);
};

export const cpPut = async (message: Message, cp: Player) => {
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
  await putOutCard(message, cp, cardIndex);
};

const nextTurn = async (message: Message, player: Player) => {
  const game = games[player.guildId]!;
  game.playerTurnIndex += 1;
  const { players, playerTurnIndex } = game;
  if (playerTurnIndex < players.length) {
    const nextPlayer = players[playerTurnIndex];
    if (nextPlayer.isCp) {
      await cpPut(message, nextPlayer);
      return;
    }
    const publicMessage = `${nextPlayer.name}くんの番やで`;
    await sendPublicMessage(message.client, nextPlayer, publicMessage);
    await urgeToPutDownCard(message, nextPlayer);
    return;
  }
  const { currentPutOut: putOuts } = game;
  const hasKraken = putOuts.some(
    (card) => 'type' in card && card.escapeType === 'kraken',
  );
  await alertWinner(message, player, hasKraken);
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
    await resultOnOneGame(message, player.guildId);
    return;
  }
  await displayTurns(message);
  const resumeMessage = `${game.players[0].name}くんから再開や〜`;
  await sendAllMessage(message.client, player, resumeMessage);
  await urgeToPutDownCard(message, game.players[0]);
};

const finish = async (message: Message, guildId: string) => {
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
  const embed: Embed = {
    title: '結果はっぴょおぉ〜〜〜',
    fields,
    color: colors.pirates,
  };
  await sendAllMessage(message.client, players[0], { embed });
  players.forEach((p) => {
    p.point = 0;
  });
  game.cards = generateDeck();
  game.deadCards = [];
  game.gameCount = 1;
  game.status = 'ready';
  const resumeMessage =
    'またやる場合は鯖のチャンネルで`!start`って打ってね\n' +
    '自分だけ抜ける場合は`!bye`って打ってね\n' +
    '完全に終わらせる場合は`!reset`って打ってね';
  await sendAllMessage(message.client, players[0], resumeMessage);
};

const reset = async (message: Message) => {
  let guildId = message.guild?.id;
  if (guildId === undefined) {
    const p = currentPlayers.find((p) => p.discordId === message.author.id);
    guildId = p?.guildId;
    if (guildId === undefined) {
      return;
    }
  }
  if (!(guildId in games)) {
    return;
  }
  const game = games[guildId]!;
  await sendAllMessage(message.client, game.players[0], ':wave:');
  game.players.forEach((p) => {
    const index = currentPlayers.findIndex(
      (cp) => cp.discordId === p.discordId,
    );
    currentPlayers.splice(index, 1);
  });
  delete games[guildId];
};
