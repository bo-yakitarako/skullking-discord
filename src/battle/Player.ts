import {
  ButtonInteraction,
  ChannelType,
  EmbedField,
  MessageFlags,
  StringSelectMenuInteraction,
  TextChannel,
} from 'discord.js';
import { Message, Skullking } from './Skullking';
import { buildEmbed, makeButtonRow, makeSelectMenuRow, sign } from '../utils';
import { Card, Color } from './Card';

const flags = MessageFlags.Ephemeral;

const bonusPoint = {
  green: 10,
  yellow: 10,
  purple: 10,
  black: 20,
  mermaid: 50,
  skullking: 30,
  goldGet: 20,
  goldGive: 20,
};

export class Player {
  private discordId: string;
  private displayName: string;
  private channel: TextChannel | null = null;
  private skullking: Skullking;
  private cardsHand: Card[] = [];
  private selectedCountExpected: number | null = null;
  private selectedCardIndex: number | null = null;
  private countExpected: number | null = null;
  private countActual = 0;
  private history: number[] = [];
  private gamePoint = 0;
  private collectedCards: Card[] = [];
  private goldGivenCount = 0;

  constructor(interaction: ButtonInteraction | number, skullking: Skullking) {
    this.skullking = skullking;
    if (typeof interaction === 'number') {
      this.discordId = `computer${interaction}`;
      this.displayName = `コンピューター${interaction}`;
      return;
    }
    this.discordId = interaction.user.id;
    this.displayName = this.getDisplayName(interaction);
  }

  public initialize() {
    this.cardsHand = [];
    this.selectedCountExpected = null;
    this.selectedCardIndex = null;
    this.countExpected = null;
    this.countActual = 0;
    this.history = [];
    this.gamePoint = 0;
    this.collectedCards = [];
  }

  public get id() {
    return this.discordId;
  }

  public get name() {
    return this.displayName;
  }

  public get at() {
    return `<@${this.id}>`;
  }

  public get cp() {
    return this.channel === null;
  }

  private getDisplayName({ guild, user }: ButtonInteraction) {
    return guild?.members.cache.get(this.discordId)?.displayName ?? user!.displayName;
  }

  public async recognizeChannel() {
    const { category } = this.skullking;
    const name = `すかきん部屋-${this.id}`;
    const existed = category.children.cache.find((c) => c.name === name) as TextChannel;
    if (existed !== undefined) {
      await existed.permissionOverwrites.set(this.skullking.permissions(this.id));
      this.channel = existed;
    } else {
      this.channel = await category.guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: category,
        permissionOverwrites: this.skullking.permissions(this.id),
      });
    }
    if (!this.skullking.isParent(this)) {
      await this.send(`${this.at} こっちおいでー`);
    }
  }

  public async send(message: Message) {
    await this.channel?.send(message);
  }

  public setHand(cards: Card[]) {
    this.cardsHand = Card.sort(cards);
  }

  public async sendExpecting(hasHistory: boolean, isAdding = false) {
    if (this.channel === null) {
      this.countExpected = Math.floor(Math.random() * (this.skullking.count + 1));
      return;
    }
    this.countExpected = null;
    this.selectedCountExpected = null;
    const content = `${this.skullking.count}戦目やってこうねー`;
    const handEmbed = this.buildHandEmbed();
    const alert = isAdding ? '\n**捨て札からカードを補充してるから注意なんだぞ**' : '';
    const expectEmbed = buildEmbed('予想𝓣𝓲𝓶𝓮', `勝利数を選んで予想しようね${alert}`);
    const embeds = [this.skullking.buildOrderEmbed(), handEmbed, expectEmbed];
    const expectComponent = makeSelectMenuRow('expectCount', this.skullking.count);
    let components = [expectComponent, makeButtonRow('expectSend')];
    if (hasHistory) {
      components = [...components, this.skullking.historySelectRow];
    }
    await this.send({ content, embeds, components });
  }

  public buildCountField(): EmbedField {
    const name = `${this.name}くんの現状`;
    const value = `予想: ${this.countExpected}\n勝数: ${this.countActual}`;
    return { name, value, inline: false };
  }

  private buildHandEmbed() {
    const count =
      this.countExpected === null ? '' : `予想: ${this.countExpected}\n勝数: ${this.countActual}`;
    const { color } = this.skullking;
    const validIndexes = Player.filterCardIndexes(this.cardsHand, color);
    const fields = this.cardsHand.map((card, index) => {
      const name = `${index + 1}${validIndexes.includes(index) ? '' : ' :x:'}`;
      return { name, value: card.value, inline: true };
    });
    return buildEmbed('手札', count, 'yellow', fields);
  }

  public selectExpecting(interaction: StringSelectMenuInteraction) {
    this.selectedCountExpected = Number(interaction.values[0]);
  }

  public buildHistoryEmbed() {
    const title = `${this.name}くんの戦績！`;
    const description = `合計**${this.point}点**`;
    const fields = this.history.map((point, index) => ({
      name: `${index + 1}戦目`,
      value: `${point > 0 ? '+' : ''}${point}`,
      inline: true,
    }));
    return buildEmbed(title, description, 'info', fields);
  }

  public isTouchedExpectationSelect() {
    return this.selectedCountExpected !== null;
  }

  public async submitExpectation() {
    if (this.countExpected !== null) {
      await this.send('もう決まっちゃってるねえ');
      return;
    }
    this.countExpected = this.selectedCountExpected;
    const content = `${this.countExpected}回だねーおっけー`;
    if (!this.skullking.isParent(this)) {
      await this.skullking.parent.send(`${this.name}くんが予想できたよ`);
    }
    await this.send({ content });
  }

  public get expectation() {
    return this.countExpected;
  }

  public buildTurnEmbeds() {
    const info = buildEmbed('出しまくりよ', '順番きちゃったんでカード出そうね');
    const putOutsEmbed = this.skullking.buildPutOutsEmbed();
    if (putOutsEmbed !== null) {
      return [info, putOutsEmbed, this.buildHandEmbed()];
    }
    return [info, this.buildHandEmbed()];
  }

  public buildCardSelectRow() {
    return makeSelectMenuRow('cardSelect', this.cardsHand, this.skullking.color);
  }

  public selectCard(interaction: StringSelectMenuInteraction) {
    this.selectedCardIndex = Number(interaction.values[0]);
  }

  public async putOut(interaction: ButtonInteraction) {
    if (this.selectedCardIndex === null) {
      await interaction.reply({ content: 'カードえらんでー', flags });
      return;
    }
    await interaction.deferUpdate();
    await interaction.message.edit({ components: [] });
    const card = this.cardsHand[this.selectedCardIndex];
    if ('type' in card && card.type === 'tigres' && card.tigresType === null) {
      const row = makeButtonRow('tigresPirate', 'tigresEscape');
      await this.send({ content: 'ティグレスどっちー？', components: [row] });
      return;
    }
    await this.submitCard(card);
  }

  public async selectTigres(type: 'pirate' | 'escape') {
    const card = this.cardsHand[this.selectedCardIndex!];
    card.tigresType = type;
    await this.submitCard(card);
  }

  public putOutByCp() {
    const { color } = this.skullking;
    const indexes = Player.filterCardIndexes(this.cardsHand, color);
    const cardIndex = indexes[Math.floor(Math.random() * indexes.length)];
    const card = this.cardsHand.splice(cardIndex, 1)[0];
    card.setOwner(this);
    if (card.type === 'tigres') {
      card.tigresType = Math.random() < 0.5 ? 'pirate' : 'escape';
    }
    return card;
  }

  public static filterCardIndexes(cards: Card[], color: Color | null) {
    const hasColor = color !== null && cards.some((card) => card.isColor && card.color === color);
    return [...Array(cards.length).keys()].filter((index) => {
      const card = cards[index];
      return !hasColor || !card.isColor || card.color === color;
    });
  }

  private async submitCard(card: Card) {
    card.setOwner(this);
    this.cardsHand = this.cardsHand.filter((c) => c !== card);
    this.selectedCardIndex = null;
    this.skullking.submitCard(card);
  }

  public win() {
    this.countActual += 1;
  }

  public collectCards(cards: Card[]) {
    this.collectedCards = [...this.collectedCards, ...cards];
  }

  public isSuccess() {
    return this.countActual === this.countExpected;
  }

  public isPutFinished() {
    return this.cardsHand.length === 0;
  }

  public buildPointField(): EmbedField {
    const baseScore = this.calculateBaseScore();
    const bonus = this.calculateBonus();
    const score = baseScore + Object.values(bonus).reduce((sum, point) => sum + point, 0);
    this.gamePoint += score;
    this.history = [...this.history, score];
    const { point } = this;
    let value = `**${sign(score)}${score}点** (合計${sign(point)}${point}点)`;
    const bonusEntries = Object.entries(bonus) as [keyof typeof bonusPoint, number][];
    if (bonusEntries.length > 0) {
      value += `\n基礎点: +${baseScore}点 (予想: ${this.countExpected}, 勝数: ${this.countActual})`;
      bonusEntries.forEach(([key, bonusScore]) => {
        if (key === 'mermaid' || key === 'skullking') {
          const emoji = key === 'mermaid' ? ':mermaid:' : ':skull:';
          const target = { mermaid: ':skull:', skullking: ':crossed_swords:' };
          value += `\n${emoji}で${target[key]}を倒した: +${bonusScore}点`;
          return;
        }
        if (key === 'goldGet' || key === 'goldGive') {
          const state = key === 'goldGet' ? '獲得' : '献上';
          value += `\n:gem:を${state}した: +${bonusScore}点`;
          return;
        }
        const square = key === 'black' ? ':black_large_square:' : `:${key}_square:`;
        value += `\n${square}14 を獲得した: +${bonusScore}点`;
      });
    } else {
      value += `\n予想: ${this.countExpected}, 勝数: ${this.countActual}`;
    }
    return { name: `${this.name}くんの結果`, value, inline: false };
  }

  public get point() {
    return this.gamePoint;
  }

  public get displayPoint() {
    const sign = this.gamePoint > 0 ? '+' : '';
    return `**${this.name}**: ${sign}${this.gamePoint}点`;
  }

  private calculateBaseScore() {
    const countDiff = Math.abs(this.countExpected! - this.countActual);
    const { count } = this.skullking;
    if (countDiff > 0) {
      return -(this.countExpected === 0 ? count : countDiff) * 10;
    }
    return this.countActual === 0 ? count * 10 : this.countActual * 20;
  }

  // eslint-disable-next-line complexity
  public calculateBonus() {
    const bonus: Partial<typeof bonusPoint> = {};
    if (!this.isSuccess()) {
      return bonus;
    }
    const sorted = Card.sort(this.collectedCards);
    for (const { type, color, beatCount, number, escapeType, owner } of sorted) {
      if (type === 'color' && number === 14) {
        bonus[color] = bonusPoint[color];
        continue;
      }
      if ((type === 'mermaid' || type === 'skullking') && beatCount > 0) {
        bonus[type] = bonusPoint[type] * beatCount;
        continue;
      }
      if (escapeType === 'gold' && owner?.isSuccess()) {
        owner!.giveGold();
        bonus.goldGet = (bonus.goldGet ?? 0) + bonusPoint.goldGet;
      }
    }
    if (this.goldGivenCount > 0) {
      bonus.goldGive = bonusPoint.goldGive * this.goldGivenCount;
    }
    return bonus;
  }

  public giveGold() {
    this.goldGivenCount += 1;
  }

  public initializeOneGame() {
    this.countExpected = null;
    this.countActual = 0;
    const cards = [...this.collectedCards];
    this.collectedCards = [];
    this.goldGivenCount = 0;
    cards.forEach((card) => card.initialize());
    return cards;
  }
}
