import { Card, ColorCard, SpecialCard } from './cards';
import { games } from './game';
import { Player } from './player';

export const updateCardWinning = (player: Player, card: Card) => {
  const game = games[player.guildId]!;
  const { currentWinner } = game;
  if (currentWinner === null) {
    game.currentWinner = { player, card };
    return;
  }
  const judgeCard = { ...card };
  if ('type' in judgeCard && judgeCard.type === 'tigres') {
    judgeCard.type = judgeCard.tigresType!;
  }
  const winnerCard = { ...currentWinner.card };
  if ('type' in winnerCard && winnerCard.type === 'tigres') {
    winnerCard.type = winnerCard.tigresType!;
  }
  if ('color' in judgeCard) {
    if (judgeByColor(judgeCard, winnerCard)) {
      game.currentWinner = { player, card };
    }
    return;
  }
  if (judgeBySpecial(judgeCard, winnerCard)) {
    game.currentWinner = { player, card };
  }
};

const judgeByColor = (card: ColorCard, winnerCard: Card) => {
  if ('color' in winnerCard) {
    if (winnerCard.color === card.color) {
      return card.number > winnerCard.number;
    }
    if (card.color === 'black' && winnerCard.color !== 'black') {
      return true;
    }
    return false;
  }
  return winnerCard.type === 'escape';
};

// eslint-disable-next-line complexity
const judgeBySpecial = (card: SpecialCard, winnerCard: Card) => {
  if ('color' in winnerCard) {
    return card.type !== 'escape';
  }
  if (card.type === 'escape') {
    return false;
  }
  return (
    winnerCard.type === 'escape' ||
    (card.type === 'pirates' && winnerCard.type === 'mermaids') ||
    (card.type === 'mermaids' && winnerCard.type === 'skullking') ||
    (card.type === 'skullking' && winnerCard.type === 'pirates')
  );
};

const includeCount = (cards: Card[], type: 'pirates' | 'skullking') => {
  return cards.filter((card) => 'type' in card && card.type === type).length;
};

export const updateBonus = (guildId: string) => {
  const game = games[guildId]!;
  const { currentPutOut } = game;
  currentPutOut.forEach((card, index, cards) => {
    if ('color' in card) {
      return;
    }
    const { type } = card;
    if (type === 'mermaids' && includeCount(currentPutOut, 'skullking')) {
      card.bonus = 50;
    }
    if (type !== 'skullking') {
      return;
    }
    const prevCards = cards.slice(0, index);
    const piratesCount = includeCount(prevCards, 'pirates');
    card.bonus = piratesCount * 30;
  });
};

const isSuccess = ({ countExpected, countActual }: Player) => {
  return countActual === countExpected;
};

export const updateGoldBonus = (guildId: string) => {
  const { players } = games[guildId]!;
  players.forEach((player) => {
    if (!isSuccess(player)) {
      return;
    }
    const { collectedCards } = player;
    collectedCards.forEach((card) => {
      if ('color' in card) {
        return;
      }
      const { escapeType, owner } = card;
      if (escapeType !== 'gold') {
        return;
      }
      if (owner !== undefined && isSuccess(owner)) {
        card.bonus = 20;
        if (owner.goldBonus === undefined) {
          owner.goldBonus = 20;
        } else {
          owner.goldBonus += 20;
        }
      }
    });
  });
};

export const generateScores = (guildId: string) => {
  const { players, gameCount } = games[guildId]!;
  return players.map((player) => {
    const { countExpected, countActual, collectedCards } = player;
    const countDiff = Math.abs(countExpected! - countActual);
    if (countDiff > 0) {
      return -(player.countExpected === 0 ? gameCount : countDiff) * 10;
    }
    const basic = countActual === 0 ? gameCount * 10 : countActual * 20;
    const bonus =
      collectedCards.reduce((prev, card) => prev + card.bonus, 0) +
      (player.goldBonus || 0);
    if ('goldBonus' in player) {
      delete player.goldBonus;
    }
    return basic + bonus;
  });
};
