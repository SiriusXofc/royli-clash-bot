const TAG_CHARACTERS = /^[0289CGJLPQRUVY]+$/i;

function normalizePlayerTag(input) {
  const tag = String(input || '')
    .trim()
    .replaceAll('`', '')
    .replace(/^tag\s*[:#-]?\s*/i, '')
    .replace(/^#/, '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replaceAll('O', '0');
  if (!tag || !TAG_CHARACTERS.test(tag)) throw new Error('Informe uma tag válida do Clash Royale, por exemplo #C0G20PR2.');
  return `#${tag}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
}

function safeText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function getCardImage(card, evolved = false) {
  return evolved
    ? card?.iconUrls?.evolutionMedium || card?.iconUrls?.medium || null
    : card?.iconUrls?.medium || card?.iconUrls?.evolutionMedium || null;
}

module.exports = { formatNumber, getCardImage, normalizePlayerTag, safeText };
