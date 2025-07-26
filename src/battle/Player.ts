import {
  ButtonInteraction,
  ChannelType,
  EmbedField,
  MessageFlags,
  StringSelectMenuInteraction,
  TextChannel,
} from 'discord.js';
import { Message, Skullking } from './Skullking';
import { buildEmbed, makeButtonRow, makeSelectMenuRow } from '../utils';
import { Card, Color } from './Card';

const flags = MessageFlags.Ephemeral;

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
  private goldBonus = 0;

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
    this.cardsHand = [...cards];
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

  public updateGoldBonus() {
    this.goldBonus = 0;
    if (!this.isSuccess()) {
      return;
    }
    this.collectedCards.forEach(({ escapeType, owner }) => {
      if (escapeType === 'gold' && owner?.isSuccess()) {
        this.goldBonus += 20;
      }
    });
  }

  public buildPointField(): EmbedField {
    const score = this.calculateCurrentScore();
    this.gamePoint += score;
    this.history = [...this.history, score];
    const { point } = this;
    const sign = score > 0 ? '+' : '';
    const totalSign = point > 0 ? '+' : '';
    return {
      name: `${this.name}くんの結果`,
      value: `**${sign}${score}点** (合計${totalSign}${point}点)`,
      inline: false,
    };
  }

  public get point() {
    return this.gamePoint;
  }

  public get displayPoint() {
    const sign = this.gamePoint > 0 ? '+' : '';
    return `**${this.name}**: ${sign}${this.gamePoint}点`;
  }

  private calculateCurrentScore() {
    const countDiff = Math.abs(this.countExpected! - this.countActual);
    const { count } = this.skullking;
    if (countDiff > 0) {
      return -(this.countExpected === 0 ? count : countDiff) * 10;
    }
    const basic = this.countActual === 0 ? count * 10 : this.countActual * 20;
    let bonus = this.goldBonus;
    for (const card of this.collectedCards) {
      bonus += card.bonus;
    }
    return basic + bonus;
  }

  public initializeOneGame() {
    this.countExpected = null;
    this.countActual = 0;
    const cards = [...this.collectedCards];
    this.collectedCards = [];
    cards.forEach((card) => card.initialize());
    return cards;
  }
}
