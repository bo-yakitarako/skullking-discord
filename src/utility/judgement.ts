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
  if ('color' in judgeCard) {
    if (judgeByColor(judgeCard, currentWinner.card)) {
      game.currentWinner = { player, card };
    }
    return;
  }
  if (judgeBySpecial(judgeCard, currentWinner.card)) {
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
