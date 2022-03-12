type Color = 'green' | 'yellow' | 'purple' | 'black';
type ColorCard = {
  color: Color;
  number: number;
  bonus: number;
};

type Special = 'skullking' | 'pirates' | 'mermaids' | 'escape' | 'tigres';
type SpecialCard = {
  type: Special;
  escapeType?: 'standard' | 'gold' | 'kraken';
};

export type Card = ColorCard | SpecialCard;

const generateBonus = (type: Color | Special, number: number) => {
  if (number < 14) {
    return 0;
  }
  return type === 'black' ? 20 : 10;
};

const shuffle = (cards: Card[]) => {
  let shuffledCards: Card[] = [];
  while (cards.length > 0) {
    const index = Math.floor(Math.random() * cards.length);
    shuffledCards = [...shuffledCards, cards[index]];
    cards.splice(index, 1);
  }
  return shuffledCards;
};

export const generateDeck = () => {
  const colors: Color[] = ['green', 'yellow', 'purple', 'black'];
  const colorCards = colors.reduce((prev, color) => {
    const numberCards = [...Array(14)].map((_, index) => {
      const number = index + 1;
      const bonus = generateBonus(color, number);
      return { color, number, bonus };
    });
    return [...prev, ...numberCards];
  }, [] as ColorCard[]);

  const specialCards: SpecialCard[] = [
    { type: 'skullking' },
    ...[...Array(5)].map<SpecialCard>(() => ({ type: 'pirates' })),
    ...[...Array(2)].map<SpecialCard>(() => ({ type: 'mermaids' })),
    { type: 'tigres' },
    ...[...Array(5)].map<SpecialCard>(() => ({
      type: 'escape',
      escapeType: 'standard',
    })),
    ...[...Array(2)].map<SpecialCard>(() => ({
      type: 'escape',
      escapeType: 'gold',
    })),
    { type: 'escape', escapeType: 'kraken' },
  ];

  return shuffle([...colorCards, ...specialCards]);
};
