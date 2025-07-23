import { shuffle } from '../utils';
import { Player } from './Player';

export type Color = 'green' | 'yellow' | 'purple' | 'black';
type Special = 'skullking' | 'pirate' | 'mermaid' | 'escape' | 'tigres';

type ColorParams = [Color, number];
type SpecialParams = ['skullking' | 'pirate' | 'mermaid' | 'tigres'];
type EscapeParams = ['escape', 'gold' | 'kraken' | null];
type Params = ColorParams | SpecialParams | EscapeParams | [Card];

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
  public bonus = 0;
  public escapeType: 'gold' | 'kraken' | null = null;
  public tigresType: 'pirate' | 'escape' | null = null;
  public owner: Player | null = null;

  constructor(...params: Params) {
    if (params[0] instanceof Card) {
      const c = params[0];
      this.type = c.type === 'tigres' ? c.tigresType! : c.type;
      this.color = c.color;
      this.number = c.number;
      this.bonus = c.bonus;
      this.escapeType = c.escapeType;
      this.tigresType = null;
      this.owner = c.owner;
      return;
    }
    if (typeof params[1] === 'number') {
      const [color, number] = params;
      this.type = 'color';
      this.color = color;
      this.number = number;
      if (number === 14) {
        this.bonus = color === 'black' ? 20 : 10;
      }
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

  public get judgeClone(): Card {
    return new Card(this);
  }

  public initialize() {
    this.tigresType = null;
    this.bonus = 0;
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

  public static getTigresEmoji(type: 'pirate' | 'escape') {
    return emojis[type];
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
}
