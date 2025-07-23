import {
  ButtonInteraction,
  EmbedField,
  Guild,
  Interaction,
  MessageFlags,
  StringSelectMenuInteraction,
  User,
} from 'discord.js';
import { Message, Skullking } from './Skullking';
import { buildEmbed, makeButtonRow, makeSelectMenuRow } from '../utils';
import { Card, Color } from './Card';

const flags = MessageFlags.Ephemeral;

export class Player {
  private discordId: string;
  private displayName: string;
  private user: User | null = null;
  private skullking: Skullking;
  private guild: Guild | null;
  private cardsHand: Card[] = [];
  private selectedCountExpected: number | null = null;
  private selectedCardIndex: number | null = null;
  private countExpected: number | null = null;
  private countActual = 0;
  private history: number[] = [];
  private gamePoint = 0;
  private collectedCards: Card[] = [];
  private goldBonus = 0;

  constructor(interaction: Interaction | number, skullking: Skullking) {
    this.skullking = skullking;
    if (typeof interaction === 'number') {
      this.discordId = `computer${interaction}`;
      this.displayName = `コンピューター${interaction}`;
      this.guild = null;
      return;
    }
    this.discordId = interaction.user.id;
    this.user = interaction.user;
    this.guild = interaction.guild;
    this.displayName = this.getDisplayName();
  }

  public get id() {
    return this.discordId;
  }

  public get name() {
    return this.displayName;
  }

  public get cp() {
    return this.user === null;
  }

  private getDisplayName() {
    return this.guild?.members.cache.get(this.discordId)?.displayName ?? this.user!.displayName;
  }

  public async send(message: Message) {
    await this.user?.send(message);
  }

  public setHand(cards: Card[]) {
    this.cardsHand = [...cards];
  }

  public async sendExpecting(hasHistory = true) {
    if (this.user === null) {
      const count = this.skullking.currentCount;
      this.countExpected = Math.floor(Math.random() * (count + 1));
      return;
    }
    this.countExpected = null;
    this.selectedCountExpected = null;
    const handEmbed = this.buildHandEmbed();
    const expectEmbed = buildEmbed('予想𝓣𝓲𝓶𝓮', '勝利数を選んで予想しようね');
    const embeds = [this.skullking.buildOrderEmbed(), handEmbed, expectEmbed];
    const { currentCount, historySelectComponent } = this.skullking;
    const expectComponent = makeSelectMenuRow('expectCount', currentCount);
    let components = [makeButtonRow('expectSend'), expectComponent];
    if (hasHistory) {
      components = [...components, historySelectComponent];
    }
    await this.send({ embeds, components });
  }

  public buildCountField(): EmbedField {
    const name = `${this.name}の現状`;
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
    const title = `${this.name}の戦績！`;
    const description = `合計**${this.point}点**`;
    const fields = this.history.map((point, index) => ({
      name: `${index + 1}戦目`,
      value: `${point > 0 ? '+' : ''}${point}`,
      inline: true,
    }));
    return buildEmbed(title, description, 'info', fields);
  }

  public async submitExpectation() {
    if (this.selectedCountExpected === null) {
      await this.send('予想の数えらんでー');
      return;
    }
    this.countExpected = this.selectedCountExpected;
    await this.send(`${this.countExpected}回だねーおっけー`);
    await this.skullking.checkExpectationAndStartPutting();
  }

  public get expectation() {
    return this.countExpected;
  }

  public buildTurnEmbeds() {
    const info = buildEmbed('出しまくりよ', '順番きちゃったんでカード出そうね');
    const submitCardsEmbed = this.skullking.buildSubmitCardsEmbed();
    return [info, submitCardsEmbed, this.buildHandEmbed()];
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
    const card = this.cardsHand[this.selectedCardIndex];
    if ('type' in card && card.type === 'tigres' && card.tigresType === null) {
      const row = makeButtonRow('tigresPirates', 'tigresEscape');
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
