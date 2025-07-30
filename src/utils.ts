import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  EmbedField,
  StringSelectMenuBuilder,
} from 'discord.js';
import { button } from './components/buttons';
import { selectMenu } from './components/selectMenus';

export function shuffle<T>(array: T[]): T[] {
  let shuffledArray: T[] = [];
  while (array.length > 0) {
    const index = Math.floor(Math.random() * array.length);
    shuffledArray = [...shuffledArray, array[index]];
    array.splice(index, 1);
  }
  return shuffledArray;
}

type ButtonKey = keyof typeof button;
export const makeButtonRow = (...buttonKeys: ButtonKey[]) => {
  const buttons = buttonKeys.map((key) => button[key]);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
};

type SelectMenuKey = keyof typeof selectMenu;
type SelectMenuParam<T extends SelectMenuKey> = [
  T,
  ...Parameters<(typeof selectMenu)[T]['component']>,
];

export function makeSelectMenuRow<T extends SelectMenuKey>(...params: SelectMenuParam<T>) {
  const [key, ...args] = params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = (selectMenu[key].component as any)(...args);
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(component);
}

const colors = {
  info: 0x2eecf2,
  green: 0x00c951,
  yellow: 0xffe819,
  purple: 0x6a07db,
  black: 0x303030,
  skullking: 0x595502,
  pirate: 0xc90e0e,
  mermaid: 0x2ecbf2,
  escape: 0x0707f5,
  gold: 0xe8d44f,
  tigres: 0xc809d6,
  kraken: 0x8c2643,
};

type ColorKey = keyof typeof colors;
type DescriptionParams = [string] | [string, ColorKey];
type FieldsParams = [EmbedField[]] | [EmbedField[], ColorKey];
type AllParams = [string, EmbedField[]] | [string, EmbedField[], ColorKey];
export const buildEmbed = (
  title: string,
  ...params: DescriptionParams | FieldsParams | AllParams
) => {
  let description = '';
  let fields: EmbedField[] = [];
  let color: ColorKey = 'info';
  if (params[0] instanceof Array) {
    fields = params[0];
    if (typeof params[1] === 'string') {
      color = params[1];
    }
  } else {
    description = params[0];
    if (params[1] instanceof Array) {
      fields = params[1];
      if (typeof params[2] === 'string') {
        color = params[2];
      }
    } else if (typeof params[1] === 'string') {
      color = params[1];
    }
  }
  const embed = new EmbedBuilder();
  embed.setTitle(title);
  embed.setColor(colors[color]);
  if (description) {
    embed.setDescription(description);
  }
  if (fields.length > 0) {
    embed.addFields(fields);
  }
  return embed;
};

export const sign = (number: number) => {
  return number > 0 ? '+' : '';
};
