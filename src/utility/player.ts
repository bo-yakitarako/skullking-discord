import type { Card } from './cards';

export type Player = {
  name: string;
  guildId: string;
  channelId: string;
  cardsHand: Card[];
  countExpected: number;
  countActual: number;
  point: number;
};
