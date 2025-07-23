import { Card } from './Card';
import { Player } from './Player';

export class Judgement {
  private cards: Card[];
  private gameWinner: Player;
  private judgeCard: Card;
  private winnerCard: Card;

  constructor(cards: Card[]) {
    this.cards = [...cards];
    this.winnerCard = cards[0].judgeClone;
    this.judgeCard = cards[1].judgeClone;
    this.gameWinner = this.judgeWinner();
  }

  public get winner() {
    return this.gameWinner;
  }

  public get hasKraken() {
    return this.cards.some((card) => card.escapeType === 'kraken');
  }

  public get winningCardValue() {
    return this.winnerCard.value;
  }

  private judgeWinner() {
    if (this.hasAllSpecial()) {
      this.winnerCard = this.cards.find(({ type }) => type === 'mermaid')!;
      return this.winnerCard.owner!;
    }
    for (const card of this.cards.slice(1)) {
      this.judgeCard = card.judgeClone;
      if (this.judgeByColor() || this.judgeBySpecial()) {
        this.winnerCard = this.judgeCard;
      }
    }
    return this.winnerCard.owner!;
  }

  private hasAllSpecial() {
    const cards = this.cards.map((p) => p.judgeClone);
    return (
      cards.some(({ type }) => type === 'pirate') &&
      cards.some(({ type }) => type === 'mermaid') &&
      cards.some(({ type }) => type === 'skullking')
    );
  }

  private judgeByColor() {
    const { winnerCard, judgeCard } = this;
    if (winnerCard.isColor) {
      if (judgeCard.isColor && judgeCard.color === winnerCard.color) {
        return judgeCard.number > winnerCard.number;
      }
      if (judgeCard.color === 'black' && winnerCard.color !== 'black') {
        return true;
      }
    }
    return winnerCard.type === 'escape';
  }

  private judgeBySpecial() {
    const { winnerCard, judgeCard } = this;
    if (winnerCard.isColor) {
      return judgeCard.type !== 'escape';
    }
    if (judgeCard.type === 'escape') {
      return false;
    }
    return (
      winnerCard.type === 'escape' ||
      (judgeCard.type === 'pirate' && winnerCard.type === 'mermaid') ||
      (judgeCard.type === 'mermaid' && winnerCard.type === 'skullking') ||
      (judgeCard.type === 'skullking' && winnerCard.type === 'pirate')
    );
  }

  public updateBonus() {
    this.cards.forEach((card, index, cards) => {
      if (card.isColor) {
        return;
      }
      const { type } = card;
      if (type === 'mermaid' && Judgement.includeCount(cards, 'skullking')) {
        card.bonus = 50;
      }
      if (type !== 'skullking') {
        return;
      }
      const prevCards = cards.slice(0, index);
      const piratesCount = Judgement.includeCount(prevCards, 'pirate');
      card.bonus = piratesCount * 30;
    });
  }

  private static includeCount(cards: Card[], type: 'pirate' | 'skullking') {
    return cards.filter((c) => c.type === type).length;
  }
}
