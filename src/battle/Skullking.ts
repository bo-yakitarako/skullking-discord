import {
  ButtonInteraction,
  EmbedBuilder,
  Interaction,
  MessageCreateOptions,
  MessageFlags,
  MessagePayload,
  RepliableInteraction,
  StringSelectMenuInteraction,
  TextChannel,
} from 'discord.js';
import { Player } from './Player';
import { buildEmbed, makeButtonRow, makeSelectMenuRow, shuffle } from '../utils';
import { Card, Color } from './Card';
import { Judgement } from './Judgement';

export type Message = string | MessagePayload | MessageCreateOptions;

const guilds: { [guildId in string]: Skullking } = {};
export const battle = {
  get({ guildId }: Interaction) {
    if (guildId === null) {
      return null;
    }
    return guilds[guildId] ?? null;
  },
  create(interaction: RepliableInteraction) {
    const { guildId } = interaction;
    if (guildId === null) {
      return null;
    }
    guilds[guildId] = new Skullking(interaction);
    return guilds[guildId];
  },
  remove({ guildId }: Interaction) {
    if (guildId === null) {
      return;
    }
    delete guilds[guildId];
  },
};

type Status = 'ready' | 'expecting' | 'putting';
const differentStatusMessage = {
  ready: '他の人たちがやってるぽいからお待ちをば',
  expecting: '今は予想するときじゃあなかんべさ',
  putting: '今はカードを出すときじゃあなかんべさ',
};

const GAME_COUNT = 2;
const flags = MessageFlags.Ephemeral;

export class Skullking {
  private gameStatus: Status = 'ready';
  private attendees: Player[] = [];
  private players: Player[] = [];
  private cpuCount = 0;
  private gameCount = 1;
  private playerTurnIndex = 0;
  private cards = Card.generateDeck();
  private currentPutOuts: Card[] = [];
  private currentColor: Color | null = null;
  private deadCards: Card[] = [];
  private channel: TextChannel;

  constructor({ channel }: RepliableInteraction) {
    this.channel = channel as TextChannel;
  }

  public get color() {
    return this.currentColor;
  }

  public get count() {
    return this.gameCount;
  }

  public async checkStatus(interaction: RepliableInteraction, status: Status) {
    if (status === this.gameStatus) {
      return true;
    }
    const content = differentStatusMessage[status];
    await interaction.reply({ content, flags });
    return false;
  }

  public async join(interaction: ButtonInteraction) {
    if (this.gameStatus !== 'ready') {
      const content = '他の人たちやってるぽいからちょっとお待ちを';
      await interaction.reply({ content, flags });
      return;
    }
    await interaction.deferUpdate();
    const player = new Player(interaction, this);
    this.attendees = [...this.attendees, player];
    const message = `**${player.name}**を受け入れようぞ`;
    await this.channel.send(message);
  }

  public async start(interaction: ButtonInteraction) {
    if (!(await this.checkStatus(interaction, 'ready'))) {
      return;
    }
    if (this.attendees.length === 0) {
      const content = '誰もいないよー';
      await interaction.reply({ content, flags });
      return;
    }
    this.players = [...this.attendees];
    this.cpuCount = 0;
    const maxCpuCount = 6 - this.players.length;
    const cpuRow = makeSelectMenuRow('cpuCount', maxCpuCount);
    const setRow = makeButtonRow('cpuSet', 'startCancel');
    const components = [cpuRow, setRow];
    await interaction.reply({ content: 'CPU何人入れる？', components });
  }

  public setCpuCount(interaction: StringSelectMenuInteraction) {
    if (this.gameStatus !== 'ready') {
      return;
    }
    const value = interaction.values[0];
    this.cpuCount = Number(value);
  }

  public async setCpuAndExpect(interaction: ButtonInteraction) {
    if (!(await this.checkStatus(interaction, 'ready'))) {
      return;
    }
    if (this.cpuCount + this.players.length < 2) {
      const content = '人数足りないよー';
      await interaction.reply({ content, flags });
    }
    await interaction.deferUpdate();
    await interaction.message.delete();
    this.gameStatus = 'expecting';
    const cps = [...Array(this.cpuCount)].map((_, i) => new Player(i + 1, this));
    this.players = shuffle([...this.players, ...cps]);
    await this.dealCards();
    await this.sendExpecting();
  }

  private async sendExpecting() {
    const orderEmbed = this.buildOrderEmbed();
    const content = 'この後はずっとDMだからDMへGoなのだよ';
    await this.channel.send({ content, embeds: [orderEmbed] });
    for (const player of this.players) {
      await player.sendExpecting(false);
    }
  }

  public buildOrderEmbed(hasCount = false) {
    const orders = this.players.map((p, i) => `${i + 1}. ${p.name}`);
    if (hasCount) {
      const fields = this.players.map((p) => p.buildCountField());
      return buildEmbed('順番', orders.join('\n'), 'info', fields);
    }
    return buildEmbed('順番', orders.join('\n'));
  }

  private async dealCards() {
    if (this.cards.length < this.players.length * this.gameCount) {
      await this.sendToAll('捨て札からカードを補充したぜよ');
      this.cards = [...this.cards, ...shuffle(this.deadCards)];
      this.deadCards = [];
    }
    const count = this.gameCount;
    this.players.forEach((p) => p.setHand(this.cards.splice(0, count)));
  }

  public async checkExpectationAndStartPutting() {
    if (this.attendees.some((p) => p.expectation === null)) {
      return;
    }
    this.gameStatus = 'putting';
    await this.startPutting([this.buildExpectationEmbed()]);
  }

  private async startPutting(alreadyEmbeds: EmbedBuilder[] = []) {
    this.playerTurnIndex = 0;
    this.currentColor = null;
    this.currentPutOuts = [];
    let baseEmbeds = [...alreadyEmbeds];
    for (const player of this.players) {
      if (!player.cp) {
        break;
      }
      const card = player.putOutByCp();
      baseEmbeds = [...baseEmbeds, this.buildCardEmbed(card)];
      this.playerTurnIndex += 1;
    }
    for (const player of this.attendees) {
      let embeds = [...baseEmbeds];
      if (player === this.players[this.playerTurnIndex]) {
        embeds = [...embeds, ...player.buildTurnEmbeds()];
      }
      await player.send({ embeds });
    }
  }

  public buildExpectationEmbed() {
    const fields = this.players.map((p) => ({
      name: p.name,
      value: `${p.expectation}回`,
      inline: false,
    }));
    return buildEmbed('みんなの予想回数！', '', 'info', fields);
  }

  public buildSubmitCardsEmbed() {
    const fields = this.currentPutOuts.map((card) => ({
      name: `${card.ownerName}くんの出したやつ`,
      value: card.value,
      inline: false,
    }));
    return buildEmbed('今までに出たカード', '', 'info', fields);
  }

  public async submitCard(card: Card) {
    if ('color' in card && this.currentColor === null) {
      this.currentColor = card.color;
    }
    this.currentPutOuts = [...this.currentPutOuts, card];
    await this.sendToAll({ embeds: [this.buildCardEmbed(card)] });
    this.playerTurnIndex += 1;
    if (this.playerTurnIndex < this.players.length) {
      const nextPlayer = this.players[this.playerTurnIndex];
      if (nextPlayer.cp) {
        await this.submitCard(nextPlayer.putOutByCp());
      } else {
        await nextPlayer.send({ embeds: nextPlayer.buildTurnEmbeds() });
      }
      return;
    }
    const judgement = new Judgement(this.currentPutOuts);
    if (judgement.hasKraken) {
      this.currentPutOuts.forEach((card) => card.initialize());
      this.deadCards = [...this.deadCards, ...this.currentPutOuts];
    } else {
      judgement.winner.win();
      judgement.winner.collectCards(this.currentPutOuts);
    }
    this.reorder(judgement);
    const embeds = [this.buildWinnerEmbed(judgement), this.buildOrderEmbed(true)];
    if (this.players[0].isPutFinished()) {
      await this.finishOneGame(embeds);
      return;
    }
    await this.startPutting(embeds);
  }

  private buildCardEmbed(card: Card) {
    const title = `${card.ownerName}くんの出したカード`;
    return buildEmbed(title, card.value, card.colorProp);
  }

  private buildWinnerEmbed({ winner, hasKraken, winningCardValue }: Judgement) {
    const title = hasKraken ? '残念ながら...' : `${winner.name}くんの勝ち！`;
    const description = hasKraken
      ? 'クラーケンが出たのでお流れです...'
      : `${winningCardValue}を出したよ！`;
    return buildEmbed(title, description, 'gold');
  }

  private reorder({ winner }: Judgement) {
    const index = this.players.indexOf(winner);
    const { players } = this;
    this.players = [...players.slice(index), ...players.slice(0, index)];
  }

  private async finishOneGame(alreadyEmbeds: EmbedBuilder[]) {
    this.players.forEach((p) => p.updateGoldBonus());
    const fields = this.players.map((p) => p.buildPointField());
    const resultEmbed = buildEmbed('今回の得点は...！？', '', 'info', fields);
    await this.sendToAll({ embeds: [...alreadyEmbeds, resultEmbed] });
    const playerDeadCards = this.players.reduce(
      (pre, p) => [...pre, ...p.initializeOneGame()],
      [] as Card[],
    );
    this.deadCards = [...this.deadCards, ...playerDeadCards];
    this.gameCount += 1;
    if (this.gameCount <= GAME_COUNT) {
      await this.dealCards();
      await this.sendExpecting();
      return;
    }
    await this.finish();
  }

  private async finish() {
    const rankedPlayers = [...this.players].sort((a, b) => b.point - a.point);
    const fields = rankedPlayers.map((p, index) => {
      const name = `${index + 1}位！`;
      return { name, value: p.displayPoint, inline: false };
    });
    this.cards = Card.generateDeck();
    this.deadCards = [];
    this.cpuCount = 0;
    this.gameCount = 1;
    this.gameStatus = 'ready';
    const rankEmbed = buildEmbed('結果はっぴょおぉ〜〜', '', 'pirate', fields);
    const resultEmbeds = rankedPlayers.map((p) => p.buildHistoryEmbed());
    let embeds = [rankEmbed, ...resultEmbeds];
    let components = [makeButtonRow('join', 'start', 'reset')];
    await this.channel.send({ embeds, components });
    const channelContent = `#${this.channel.name}チャンネルでスタートボタン押してね～`;
    embeds = [rankEmbed, buildEmbed('またやる場合は', channelContent)];
    components = [makeButtonRow('bye')];
    await this.sendToPlayers({ embeds, components });
  }

  public getAttendee(index: number) {
    return this.attendees[index];
  }

  public getInteractionPlayer({ user }: Interaction) {
    return this.players.find((p) => p.id === user.id) ?? null;
  }

  public get historySelectComponent() {
    return makeSelectMenuRow('history', this.attendees);
  }

  public get currentCount() {
    return this.gameCount;
  }

  public async sendToPlayers(message: Message) {
    for (const player of this.players) {
      await player.send(message);
    }
  }

  public async sendToAll(message: Message) {
    await this.channel.send(message);
    await this.sendToPlayers(message);
  }

  public async bye(interaction: ButtonInteraction) {
    const player = this.getInteractionPlayer(interaction);
    if (player === null) {
      await interaction.reply({ content: 'ほ？', flags });
      return;
    }
    await interaction.deferUpdate();
    await player.send(':bye:');
    this.attendees = this.attendees.filter((p) => p.id !== player.id);
  }

  public async reset(interaction: ButtonInteraction) {
    await interaction.deferUpdate();
    await this.sendToAll(':bye:');
    battle.remove(interaction);
  }
}
