/**
 * Normalize user input for the conversational agent: fix common move misspellings
 * so the Judge can understand intent (e.g. "scissor" → "scissors").
 * This is spelling/typo correction only; game rules stay in the prompt.
 */

const CANONICAL = ['rock', 'paper', 'scissors', 'bomb'];

/** Common misspellings → canonical move (lowercase). */
const TYPO_MAP = {
  // scissors
  scissor: 'scissors',
  scisors: 'scissors',
  scisor: 'scissors',
  sissors: 'scissors',
  sissor: 'scissors',
  // rock
  roc: 'rock',
  rok: 'rock',
  rck: 'rock',
  // paper
  papper: 'paper',
  pape: 'paper',
  papr: 'paper',
  paer: 'paper',
  // bomb
  bom: 'bomb',
  bmb: 'bomb',
  bome: 'bomb',
};

/**
 * If the whole input is a known typo or canonical move, return canonical.
 * Otherwise return input unchanged.
 */
function normalizeExact(input) {
  const key = input.trim().toLowerCase();
  if (!key) return input;
  if (TYPO_MAP[key]) return TYPO_MAP[key];
  if (CANONICAL.includes(key)) return key;
  return input;
}

/**
 * Replace whole-word typos in the string with canonical moves.
 * E.g. "I choose scissor" → "I choose scissors"
 */
function normalizeWords(text) {
  const words = text.split(/\b/);
  return words
    .map((w) => {
      const key = w.toLowerCase();
      if (TYPO_MAP[key]) return TYPO_MAP[key];
      return w;
    })
    .join('');
}

/**
 * Normalize user move input: fix spelling so the Judge understands intent.
 * - If the entire input is one word (typo or canonical), return that canonical move.
 * - Otherwise replace any known typo words in the phrase with canonical spelling.
 * @param {string} raw - Raw user input
 * @returns {string} Normalized input to send to the Judge
 */
function normalizeMoveInput(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return trimmed;

  const singleWord = trimmed.split(/\s+/).length === 1;
  if (singleWord) return normalizeExact(trimmed);
  return normalizeWords(trimmed);
}

module.exports = {
  normalizeMoveInput,
  normalizeExact,
  TYPO_MAP,
  CANONICAL,
};
