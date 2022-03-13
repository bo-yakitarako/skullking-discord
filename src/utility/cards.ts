import { Player } from './player';

export type Color = 'green' | 'yellow' | 'purple' | 'black';
export type ColorCard = {
  color: Color;
  number: number;
  bonus: number;
  owner?: Player;
};

type Special = 'skullking' | 'pirates' | 'mermaids' | 'escape' | 'tigres';
export type SpecialCard = {
  type: Special;
  escapeType?: 'standard' | 'gold' | 'kraken';
  bonus: number;
  owner?: Player;
  tigresType: TigresType;
};

export type Card = ColorCard | SpecialCard;

export type TigresType = 'pirates' | 'escape' | null;

const generateBonus = (type: Color, number: number) => {
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

  const base = { bonus: 0, tigresType: null };
  const specialCards: SpecialCard[] = [
    { type: 'skullking', ...base },
    ...[...Array(59)].map<SpecialCard>(() => ({ type: 'pirates', ...base })),
    ...[...Array(2)].map<SpecialCard>(() => ({ type: 'mermaids', ...base })),
    { type: 'tigres', ...base },
    ...[...Array(5)].map<SpecialCard>(() => ({
      type: 'escape',
      escapeType: 'standard',
      ...base,
    })),
    ...[...Array(29)].map<SpecialCard>(() => ({
      type: 'escape',
      escapeType: 'gold',
      ...base,
    })),
    { type: 'escape', escapeType: 'kraken', ...base },
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
  const { type, escapeType, tigresType } = card;
  if (escapeType !== undefined) {
    const prop = escapeType === 'standard' ? 'escape' : escapeType;
    return cardValue[prop];
  }
  if (tigresType !== null) {
    return `${cardValue[type]} (${cardValue[tigresType]})`;
  }
  return cardValue[type];
};
