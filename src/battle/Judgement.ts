import { Card } from './Card';

export class Judgement {
  private cards: Card[];
  private winnerCard: Card;

  constructor(cards: Card[]) {
    this.cards = [...cards];
    this.winnerCard = this.judgeWinnerCard();
  }

  public get winner() {
    return this.winnerCard.owner!;
  }

  public get hasKraken() {
    return this.cards.some((card) => card.escapeType === 'kraken');
  }

  public get winningCardValue() {
    return this.winnerCard.value;
  }

  private judgeWinnerCard() {
    if (this.hasAllSpecial()) {
      return this.cards.find(({ type }) => type === 'mermaid')!;
    }
    let winnerCard = this.cards[0];
    for (const card of this.cards.slice(1)) {
      if (this.judgeByColor(card, winnerCard) || this.judgeBySpecial(card, winnerCard)) {
        winnerCard = card;
      }
    }
    return winnerCard;
  }

  private hasAllSpecial() {
    return (
      this.cards.some((card) => card.is('pirate')) &&
      this.cards.some(({ type }) => type === 'mermaid') &&
      this.cards.some(({ type }) => type === 'skullking')
    );
  }

  private judgeByColor(judgeCard: Card, winnerCard: Card) {
    if (!judgeCard.isColor) {
      return false;
    }
    if (winnerCard.isColor) {
      if (judgeCard.isColor && judgeCard.color === winnerCard.color) {
        return judgeCard.number > winnerCard.number;
      }
      if (judgeCard.color === 'black' && winnerCard.color !== 'black') {
        return true;
      }
    }
    return winnerCard.is('escape');
  }

  private judgeBySpecial(judgeCard: Card, winnerCard: Card) {
    if (judgeCard.isColor) {
      return false;
    }
    if (winnerCard.isColor) {
      return judgeCard.type !== 'escape';
    }
    if (judgeCard.is('escape')) {
      return false;
    }
    return (
      winnerCard.is('escape') ||
      (judgeCard.is('pirate') && winnerCard.type === 'mermaid') ||
      (judgeCard.type === 'mermaid' && winnerCard.type === 'skullking') ||
      (judgeCard.type === 'skullking' && winnerCard.is('pirate'))
    );
  }

  public updateWinningCardBeatCount() {
    const { type } = this.winnerCard;
    if (type !== 'mermaid' && type !== 'skullking') {
      return;
    }
    const target = { mermaid: 'skullking', skullking: 'pirate' } as const;
    const prevCards = this.cards.slice(0, this.cards.indexOf(this.winnerCard));
    this.winnerCard.beatCount = prevCards.filter((c) => c.type === target[type]).length;
  }
}
