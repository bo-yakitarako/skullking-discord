import { shuffle } from '../utils';
import { Player } from './Player';

export type Color = 'green' | 'yellow' | 'purple' | 'black';
type Special = 'skullking' | 'pirate' | 'mermaid' | 'escape' | 'tigres';

type ColorParams = [Color, number];
type SpecialParams = ['skullking' | 'pirate' | 'mermaid' | 'tigres'];
type EscapeParams = ['escape', 'gold' | 'kraken' | null];
type Params = ColorParams | SpecialParams | EscapeParams;

const cardValue = {
  green: ':green_square:',
  yellow: ':yellow_square:',
  purple: ':purple_square:',
  black: ':black_large_square:',
  skullking: ':skull: スカルキング',
  pirate: ':crossed_swords: 海賊',
  mermaid: ':mermaid: マーメイド',
  escape: ':runner: 逃走',
  gold: ':gem: 略奪品',
  tigres: ':woman_superhero: ティグレス',
  kraken: ':octopus: クラーケン',
};

const emojis = {
  green: '🟩',
  yellow: '🟨',
  purple: '🟪',
  black: '⬛',
  skullking: '💀',
  pirate: '⚔️',
  mermaid: '🧜‍♀️',
  escape: '🏃',
  gold: '💎',
  tigres: '🦸‍♀️',
  kraken: '🐙',
};

export class Card {
  public type: 'color' | Special;
  public color: Color = 'black';
  public number = 0;
  public escapeType: 'gold' | 'kraken' | null = null;
  public tigresType: 'pirate' | 'escape' | null = null;
  public owner: Player | null = null;
  public beatCount = 0;

  constructor(...params: Params) {
    if (typeof params[1] === 'number') {
      const [color, number] = params;
      this.type = 'color';
      this.color = color;
      this.number = number;
      return;
    }
    const [type] = params;
    this.type = type;
    if (type === 'escape') {
      const [, escapeType] = params;
      this.escapeType = escapeType;
    }
  }

  public get isColor() {
    return this.type === 'color';
  }

  public setOwner(owner: Player) {
    this.owner = owner;
  }

  public get ownerName() {
    return this.owner?.name ?? '';
  }

  public is(type: 'pirate' | 'escape') {
    return this.type === type || this.tigresType === type;
  }

  public initialize() {
    this.tigresType = null;
    this.beatCount = 0;
    this.owner = null;
  }

  public get colorProp(): keyof typeof cardValue {
    if (this.type === 'color') {
      return this.color;
    }
    if (this.type === 'escape') {
      return this.escapeType === null ? 'escape' : this.escapeType;
    }
    return this.type;
  }

  public get value() {
    if (this.type === 'color') {
      return `${cardValue[this.color]}  ${this.number}`;
    }
    const { type, escapeType, tigresType } = this;
    if (this.type === 'escape') {
      const prop = escapeType === null ? 'escape' : escapeType;
      return cardValue[prop];
    }
    if (type === 'tigres' && tigresType !== null) {
      return `${cardValue[type]} (${cardValue[tigresType]})`;
    }
    return cardValue[type];
  }

  public get selectMenuValue() {
    if (this.type === 'color') {
      const label = `${this.number}`;
      const emoji = emojis[this.color];
      return { label, emoji };
    }
    const { type, escapeType } = this;
    let prop = type as keyof typeof cardValue;
    if (type === 'escape') {
      prop = escapeType === null ? 'escape' : escapeType;
    }
    const label = cardValue[prop].split(' ')[1];
    const emoji = emojis[prop];
    return { label, emoji };
  }

  public static generateDeck() {
    const colors: Color[] = ['green', 'yellow', 'purple', 'black'];
    let cards = colors.reduce((pre, cur) => {
      return [...pre, ...[...Array(14)].map((_, i) => new Card(cur, i + 1))];
    }, [] as Card[]);
    cards = [...cards, new Card('skullking')];
    cards = [...cards, ...[...Array(5)].map(() => new Card('pirate'))];
    cards = [...cards, ...[...Array(2)].map(() => new Card('mermaid'))];
    cards = [...cards, new Card('tigres')];
    cards = [...cards, ...[...Array(5)].map(() => new Card('escape', null))];
    cards = [...cards, ...[...Array(2)].map(() => new Card('escape', 'gold'))];
    cards = [...cards, new Card('escape', 'kraken')];
    return shuffle(cards);
  }

  public static sort(cards: Card[]) {
    return [...cards].sort((a, b) => {
      if (a.type === 'escape' && b.type === 'escape') {
        const order = [null, 'gold', 'kraken'] as const;
        return order.indexOf(a.escapeType) - order.indexOf(b.escapeType);
      }
      if (!a.isColor && !b.isColor) {
        const order = ['pirate', 'mermaid', 'skullking', 'escape', 'tigres'];
        return order.indexOf(a.type) - order.indexOf(b.type);
      }
      if (a.isColor && b.isColor) {
        if (a.color === b.color) {
          return a.number - b.number;
        }
        const order = ['green', 'yellow', 'purple', 'black'] as const;
        return order.indexOf(a.color) - order.indexOf(b.color);
      }
      return a.isColor && !b.isColor ? -1 : 1;
    });
  }
}
