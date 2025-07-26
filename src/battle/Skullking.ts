import {
  ButtonInteraction,
  CategoryChannel,
  ChannelType,
  EmbedBuilder,
  Interaction,
  MessageCreateOptions,
  MessageFlags,
  MessagePayload,
  PermissionFlagsBits,
  RepliableInteraction,
  StringSelectMenuInteraction,
  TextChannel,
  Message as DiscordMessage,
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

const MAX_GAME_COUNT = 10;
const CATEGORY_NAME = 'すかき～ん';
const flags = MessageFlags.Ephemeral;

export class Skullking {
  private gameStatus: Status = 'ready';
  private gameCategory: CategoryChannel | null = null;
  private gameParentId: string;
  private parentChannel: TextChannel | null = null;
  private cpuMessage: DiscordMessage | null = null;
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

  constructor({ channel, user }: RepliableInteraction) {
    this.channel = channel as TextChannel;
    this.gameParentId = user.id;
  }

  public get color() {
    return this.currentColor;
  }

  public get count() {
    return this.gameCount;
  }

  public get category() {
    return this.gameCategory!;
  }

  public get parent() {
    return this.parentChannel!;
  }

  public isParent(player: Player | RepliableInteraction) {
    const id = player instanceof Player ? player.id : player.user.id;
    return id === this.gameParentId;
  }

  public isParentInAttendees() {
    return this.attendees.some((p) => p.id === this.gameParentId);
  }

  public async checkStatus(interaction: RepliableInteraction, status: Status) {
    if (status === this.gameStatus) {
      return true;
    }
    const content = differentStatusMessage[status];
    await interaction.reply({ content, flags });
    return false;
  }

  private async checkParent(interaction: RepliableInteraction) {
    if (!this.isParent(interaction)) {
      await interaction.reply({ content: '貴様にその資格はないのだよ', flags });
      return false;
    }
    return true;
  }

  public async recognizeCategory({ guild }: Interaction) {
    const existed = guild!.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME,
    ) as CategoryChannel;
    if (existed !== undefined) {
      this.gameCategory = existed;
      return;
    }
    this.gameCategory = await guild!.channels.create({
      name: CATEGORY_NAME,
      type: ChannelType.GuildCategory,
    });
  }

  public permissions(id: string) {
    return [
      {
        id: this.channel.guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AddReactions,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ];
  }

  public async recognizeParentChannel() {
    const name = `すかきん部屋-${this.gameParentId}`;
    const existed = this.gameCategory!.children.cache.find((c) => c.name === name) as TextChannel;
    if (existed !== undefined) {
      await existed.permissionOverwrites.set(this.permissions(this.gameParentId));
      this.parentChannel = existed;
      return;
    }
    this.parentChannel = await this.gameCategory!.guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: this.gameCategory!,
      permissionOverwrites: this.permissions(this.gameParentId),
    });
  }

  public async join(interaction: ButtonInteraction) {
    if (!(await this.checkStatus(interaction, 'ready'))) {
      return;
    }
    if (this.attendees.some((p) => p.id === interaction.user.id)) {
      const content = 'もうおるやんけ';
      await interaction.reply({ content, flags });
      return;
    }
    await interaction.deferUpdate();
    const player = new Player(interaction, this);
    this.attendees = [...this.attendees, player];
    await this.channel.send(`**${player.name}**くんを受け入れようぞ`);
    await this.parent.send(`**${player.name}**くんが参加したよー`);
    if (this.cpuMessage !== null) {
      await this.cpuMessage.delete();
      this.cpuCount = 0;
      this.cpuMessage = null;
    }
  }

  public async start(interaction: ButtonInteraction) {
    if (!(await this.checkParent(interaction)) || !(await this.checkStatus(interaction, 'ready'))) {
      return;
    }
    if (this.attendees.length === 0) {
      const content = '誰もいないよー';
      await interaction.reply({ content, flags });
      return;
    }
    await interaction.deferUpdate();
    this.players = [...this.attendees];
    this.cpuCount = 0;
    const maxCpuCount = 6 - this.players.length;
    const cpuRow = makeSelectMenuRow('cpuCount', maxCpuCount);
    const setRow = makeButtonRow('cpuSet');
    const components = [cpuRow, setRow];
    this.cpuMessage = await this.parent.send({ content: 'CPU何人入れる？', components });
  }

  public setCpuCount(interaction: StringSelectMenuInteraction) {
    if (this.gameStatus !== 'ready') {
      return;
    }
    const value = interaction.values[0];
    this.cpuCount = Number(value);
  }

  public async setCpuAndExpect(interaction: ButtonInteraction) {
    if (!(await this.checkParent(interaction)) || !(await this.checkStatus(interaction, 'ready'))) {
      return;
    }
    if (this.cpuCount + this.players.length < 2) {
      const content = '人数足りないよー';
      await interaction.reply({ content, flags });
    }
    await interaction.deferUpdate();
    await interaction.message.delete();
    await Promise.all(this.attendees.map((p) => p.recognizeChannel()));
    this.gameStatus = 'expecting';
    const cps = [...Array(this.cpuCount)].map((_, i) => new Player(i + 1, this));
    this.players = shuffle([...this.players, ...cps]);
    this.dealCards();
    await Promise.all(this.players.map((p) => p.sendExpecting(false)));
    const embeds = [this.buildOrderEmbed()];
    await this.send({ content: 'ほな各々呼ばれたところに散って1戦目の予想タイムじゃい', embeds });
    if (!this.isParentInAttendees()) {
      await this.parent.send({ components: [makeButtonRow('expectComplete')] });
    }
  }

  public buildOrderEmbed(hasCount = false) {
    const orders = this.players.map((p, i) => `${i + 1}. ${p.name}`);
    if (hasCount) {
      const fields = this.players.map((p) => p.buildCountField());
      return buildEmbed('順番と現状', orders.join('\n'), 'info', fields);
    }
    return buildEmbed('順番', orders.join('\n'));
  }

  private dealCards() {
    const isAdding = this.cards.length < this.players.length * this.gameCount;
    if (isAdding) {
      this.cards = [...this.cards, ...shuffle(this.deadCards)];
      this.deadCards = [];
    }
    const count = this.gameCount;
    this.players.forEach((p) => p.setHand(this.cards.splice(0, count)));
    return isAdding;
  }

  public async completeExpectation(interaction: ButtonInteraction) {
    if (!(await this.checkParent(interaction))) {
      return;
    }
    const notExpectedPlayerNames = this.getNotExpectedPlayerNames();
    if (notExpectedPlayerNames) {
      const content = `${notExpectedPlayerNames}がまだ予想してないよ`;
      await interaction.reply({ content, flags });
      return;
    }
    await interaction.deferUpdate();
    if (this.isParentInAttendees()) {
      const components = interaction.message.components.slice(0, -1);
      await interaction.message.edit({ components });
    } else {
      await interaction.message.delete();
    }
    await this.startPutting();
  }

  private getNotExpectedPlayerNames() {
    const names = this.attendees.filter((p) => p.expectation === null).map((p) => `${p.name}くん`);
    return names.join('と');
  }

  public async startPutting(alreadyEmbeds = [this.buildExpectationEmbed()]) {
    this.gameStatus = 'putting';
    let baseEmbeds = [...alreadyEmbeds];
    for (const player of this.players) {
      if (!player.cp) {
        break;
      }
      const card = player.putOutByCp();
      if (card.isColor && this.currentColor === null) {
        this.currentColor = card.color;
      }
      this.currentPutOuts = [...this.currentPutOuts, card];
      baseEmbeds = [...baseEmbeds, this.buildCardEmbed(card)];
      this.playerTurnIndex += 1;
    }
    for (const player of this.attendees) {
      let embeds = [...baseEmbeds];
      let components: MessageCreateOptions['components'] = undefined;
      if (player === this.players[this.playerTurnIndex]) {
        embeds = [...embeds, ...player.buildTurnEmbeds()];
        components = [player.buildCardSelectRow(), makeButtonRow('putOut')];
      }
      await player.send({ embeds, components });
    }
    await this.send({ embeds: baseEmbeds });
  }

  public buildExpectationEmbed() {
    const fields = this.players.map((p) => ({
      name: p.name,
      value: `${p.expectation}回`,
      inline: false,
    }));
    return buildEmbed('みんなの予想回数！', '', 'info', fields);
  }

  public buildPutOutsEmbed() {
    if (this.currentPutOuts.length === 0) {
      return null;
    }
    const fields = this.currentPutOuts.map((card) => ({
      name: `${card.ownerName}くんの出したやつ`,
      value: card.value,
      inline: false,
    }));
    return buildEmbed('今までに出たカード', '', 'info', fields);
  }

  public async submitCard(card: Card) {
    if (card.isColor && this.currentColor === null) {
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
        const components = [nextPlayer.buildCardSelectRow(), makeButtonRow('putOut')];
        await nextPlayer.send({ embeds: nextPlayer.buildTurnEmbeds(), components });
      }
      return;
    }
    const judgement = new Judgement(this.currentPutOuts);
    if (judgement.hasKraken) {
      this.currentPutOuts.forEach((card) => card.initialize());
      this.deadCards = [...this.deadCards, ...this.currentPutOuts];
    } else {
      judgement.updateWinningCardBeatCount();
      judgement.winner.win();
      judgement.winner.collectCards(this.currentPutOuts);
    }
    this.reorder(judgement);
    this.playerTurnIndex = 0;
    this.currentColor = null;
    this.currentPutOuts = [];
    const winnerEmbed = this.buildWinnerEmbed(judgement);
    if (this.players[0].isPutFinished()) {
      await this.finishOneGame([winnerEmbed]);
      return;
    }
    await this.startPutting([winnerEmbed, this.buildOrderEmbed(true)]);
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
    this.players.forEach((p) => p.calculateBonus());
    const fields = this.players.map((p) => p.buildPointField());
    const resultEmbed = buildEmbed('今回の得点は...！？', '', 'info', fields);
    await this.sendToAll({ embeds: [...alreadyEmbeds, resultEmbed] });
    const playerDeadCards = this.players.reduce(
      (pre, p) => [...pre, ...p.initializeOneGame()],
      [] as Card[],
    );
    this.deadCards = [...this.deadCards, ...playerDeadCards];
    this.gameCount += 1;
    if (this.gameCount <= MAX_GAME_COUNT) {
      this.gameStatus = 'expecting';
      const isAdding = this.dealCards();
      await Promise.all(this.players.map((p) => p.sendExpecting(true, isAdding)));
      const addition = isAdding ? '\n捨て札補充あったらしいから見どころだね' : '';
      const content = `**${this.gameCount}戦目**もしっかり見ていこうね${addition}`;
      await this.send({ content, embeds: [this.buildOrderEmbed()] });
      if (!this.isParentInAttendees()) {
        await this.parent.send({ components: [makeButtonRow('expectComplete')] });
      }
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
    let components = [makeButtonRow('join')];
    await this.channel.send({ embeds, components });
    components = [makeButtonRow('bye')];
    for (const player of this.attendees) {
      embeds = [rankEmbed, player.buildHistoryEmbed()];
      await player.send({ embeds, components });
    }
    embeds = [buildEmbed('もっかいやるかやめるか', 'やめる場合はやめるボタン押しといてけろ～')];
    components = [makeButtonRow('start', 'reset')];
    await this.parent.send({ embeds, components });
  }

  public getAttendee(index: number) {
    return this.attendees[index];
  }

  public getInteractionPlayer({ user }: Interaction) {
    return this.players.find((p) => p.id === user.id) ?? null;
  }

  public get historySelectRow() {
    return makeSelectMenuRow('history', this.attendees);
  }

  public async send(message: Message) {
    await this.channel.send(message);
    if (!this.isParentInAttendees()) {
      await this.parent.send(message);
    }
  }

  public async sendToAll(message: Message) {
    await this.send(message);
    await Promise.all(this.attendees.map((p) => p.send(message)));
  }

  public async bye(interaction: ButtonInteraction) {
    if (!(await this.checkStatus(interaction, 'ready'))) {
      return;
    }
    const player = this.getInteractionPlayer(interaction);
    if (player === null) {
      await interaction.reply({ content: 'ほ？', flags });
      return;
    }
    await interaction.deferUpdate();
    await player.send(':wave:');
    this.attendees = this.attendees.filter((p) => p.id !== player.id);
  }

  public async reset(interaction: ButtonInteraction) {
    if (!(await this.checkParent(interaction)) || !(await this.checkStatus(interaction, 'ready'))) {
      return;
    }
    await interaction.deferUpdate();
    await this.sendToAll(':wave:');
    battle.remove(interaction);
  }
}
