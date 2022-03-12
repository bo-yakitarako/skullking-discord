export type Color = 'green' | 'yellow' | 'purple' | 'black';
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

export function shuffle<T>(array: T[]): T[] {
  let shuffledArray: T[] = [];
  while (array.length > 0) {
    const index = Math.floor(Math.random() * array.length);
    shuffledArray = [...shuffledArray, array[index]];
    array.splice(index, 1);
  }
  return shuffledArray;
}

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

  return shuffle([...colorCards, ...specialCards] as Card[]);
};

const cardValue = {
  green: ':green_square:',
  yellow: ':yellow_square:',
  purple: ':purple_square:',
  black: ':black_large_square:',
  skullking: 'スカルキング :skull:',
  pirates: '海賊 :crossed_swords:',
  mermaids: 'マーメイド :mermaid:',
  escape: '逃走 :runner:',
  gold: '略奪品 :gem:',
  tigres: 'ティグレス :woman_superhero:',
  kraken: 'クラーケン :octopus:',
};

export const convertCardValue = (card: Card) => {
  if ('color' in card) {
    return `${cardValue[card.color]}  ${card.number}`;
  }
  const { type, escapeType } = card;
  if (escapeType !== undefined) {
    const prop = escapeType === 'standard' ? 'escape' : escapeType;
    return cardValue[prop];
  }
  return cardValue[type];
};
