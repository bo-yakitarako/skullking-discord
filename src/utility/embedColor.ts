import type { Card } from './cards';

export const colors = {
  info: 0x2eecf2,
  green: 0x00c951,
  yellow: 0xffe819,
  purple: 0x6a07db,
  black: 0x303030,
  skullking: 0x595502,
  pirates: 0xc90e0e,
  mermaids: 0x2ecbf2,
  escape: 0x0707f5,
  gold: 0xe8d44f,
  tigres: 0xc809d6,
  kraken: 0x8c2643,
};

export const convertToColor = (card: Card) => {
  if ('color' in card) {
    return colors[card.color];
  }
  const { type, escapeType } = card;
  if (escapeType !== undefined) {
    return escapeType === 'standard' ? colors.escape : colors[escapeType];
  }
  return colors[type];
};
