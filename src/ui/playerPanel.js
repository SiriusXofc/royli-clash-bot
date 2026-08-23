const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const {
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder
} = require('@discordjs/builders');
const { formatNumber, getCardImage, safeText } = require('../utils');

const PAGE_OPTIONS = [
  ['overview', 'Resumo', 'Perfil, troféus e estatísticas gerais'],
  ['cards', 'Cartas', 'Coleção e níveis das cartas'],
  ['battles', 'Batalhas', 'Histórico de batalhas recentes'],
  ['clan', 'Clã', 'Informações do clã do jogador']
];

function text(content) { return new TextDisplayBuilder().setContent(content); }
function separator() { return new SeparatorBuilder(); }

function selectMenu(tag, selected) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`royli:player:${tag.slice(1)}:select`)
    .setPlaceholder('Escolha uma seção')
    .addOptions(PAGE_OPTIONS.map(([value, label, description]) => new StringSelectMenuOptionBuilder()
      .setLabel(label).setDescription(description).setValue(value).setDefault(value === selected)));
  return new ActionRowBuilder().addComponents(menu);
}

function header(profile) {
  const clanBadge = profile.clan?.badge?.url || profile.clan?.badgeUrls?.medium
    || getCardImage(profile.currentFavouriteCard)
    || 'https://cdn.discordapp.com/embed/avatars/0.png';
  const section = new SectionBuilder().addTextDisplayComponents(
    text(`# ${safeText(profile.name)}`),
    text(`-# \`${safeText(profile.tag)}\` · Nível de experiência ${formatNumber(profile.expLevel)}`)
  );
  section.setThumbnailAccessory(new ThumbnailBuilder({ media: { url: clanBadge } }));
  return section;
}

function deckGallery(profile) {
  const cards = (profile.currentDeck || []).slice(0, 8).filter((card) => getCardImage(card));
  if (!cards.length) return null;
  return new MediaGalleryBuilder().addItems(cards.map((card) => new MediaGalleryItemBuilder()
    .setURL(getCardImage(card)).setDescription(`${card.name || 'Carta'} — nível ${card.level ?? '—'}`)));
}

function overview(profile) {
  const wins = Number(profile.wins) || 0;
  const losses = Number(profile.losses) || 0;
  const total = wins + losses;
  const winRate = total ? `${((wins / total) * 100).toFixed(2).replace('.', ',')}%` : '—';
  const container = new ContainerBuilder().setAccentColor(0xf6c928);
  container.addSectionComponents(header(profile));
  container.addSeparatorComponents(separator());
  container.addTextDisplayComponents(text(
    `**${formatNumber(profile.trophies)}** troféus   ·   **Máximo ${formatNumber(profile.bestTrophies)}**\n` +
    `-# ${safeText(profile.arena?.name)}   ·   Win rate **${winRate}**`
  ));
  container.addSeparatorComponents(separator());
  container.addTextDisplayComponents(text(
    `### Estatísticas\n` +
    `-# Desempenho geral\n` +
    `Vitórias **${formatNumber(wins)}**   ·   Derrotas **${formatNumber(losses)}**\n` +
    `Três coroas **${formatNumber(profile.threeCrownWins)}**   ·   Doações **${formatNumber(profile.donations)}**\n` +
    `Pontos estelares **${formatNumber(profile.starPoints)}**   ·   Batalhas **${formatNumber(profile.battleCount)}**`
  ));
  const gallery = deckGallery(profile);
  if (gallery) {
    container.addSeparatorComponents(separator());
    container.addTextDisplayComponents(text('### Deck atual'));
    container.addMediaGalleryComponents(gallery);
  }
  return container;
}

function cardsPage(profile) {
  const cards = profile.cards || [];
  const container = new ContainerBuilder().setAccentColor(0xf6c928)
    .addSectionComponents(header(profile)).addSeparatorComponents(separator());
  if (!cards.length) return container.addTextDisplayComponents(text('Não foi possível carregar as cartas deste jogador.'));
  const lines = cards.slice(0, 30).map((card) => `**${safeText(card.name)}** · nível ${card.level ?? '—'} · ${formatNumber(card.count)} cópias`);
  container.addTextDisplayComponents(text(`### Coleção (${cards.length} cartas)\n${lines.join('\n')}`));
  const galleryItems = cards.slice(0, 10).filter((card) => getCardImage(card)).map((card) => new MediaGalleryItemBuilder()
    .setURL(getCardImage(card)).setDescription(`${card.name || 'Carta'} — nível ${card.level ?? '—'}`));
  if (galleryItems.length) container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(galleryItems));
  if (cards.length > 30) container.addTextDisplayComponents(text(`-# Mostrando 30 de ${cards.length}.`));
  return container;
}

function battlesPage(profile, battlelog) {
  const container = new ContainerBuilder().setAccentColor(0xf6c928)
    .addSectionComponents(header(profile)).addSeparatorComponents(separator());
  if (!battlelog?.length) return container.addTextDisplayComponents(text('Nenhuma batalha recente foi retornada pela API.'));
  const lines = battlelog.slice(0, 10).map((battle) => {
    const team = battle.team?.[0] || {};
    const opponent = battle.opponent?.[0] || {};
    const crowns = Number(team.crowns) || 0;
    const opponentCrowns = Number(opponent.crowns) || 0;
    const result = crowns > opponentCrowns ? 'Vitória' : crowns < opponentCrowns ? 'Derrota' : 'Empate';
    return `${result} **${crowns}–${opponentCrowns}** · ${safeText(battle.type, 'Batalha')} · ${safeText(opponent.name, 'oponente')}`;
  });
  return container.addTextDisplayComponents(text(`### Últimas batalhas\n${lines.join('\n')}`));
}

function clanPage(profile) {
  const clan = profile.clan;
  const container = new ContainerBuilder().setAccentColor(0xf6c928)
    .addSectionComponents(header(profile)).addSeparatorComponents(separator());
  if (!clan) return container.addTextDisplayComponents(text('Este jogador não está em um clã.'));
  return container.addTextDisplayComponents(text(
    `### ${safeText(clan.name)}\n` +
    `Tag: \`${safeText(clan.tag)}\`\n` +
    `Membros: **${formatNumber(clan.members)}**\n` +
    `Pontuação: **${formatNumber(clan.clanScore)}**\n` +
    `Cargo do jogador: **${safeText(profile.role)}**`
  ));
}

function renderPlayerPanel(data, page = 'overview') {
  const profile = data.profile;
  const validPage = PAGE_OPTIONS.some(([value]) => value === page) ? page : 'overview';
  const container = validPage === 'cards' ? cardsPage(profile)
    : validPage === 'battles' ? battlesPage(profile, data.battlelog)
      : validPage === 'clan' ? clanPage(profile) : overview(profile);
  container.addSeparatorComponents(separator());
  container.addActionRowComponents(selectMenu(profile.tag, validPage));
  return { flags: 1 << 15, components: [container] };
}

module.exports = { renderPlayerPanel };
