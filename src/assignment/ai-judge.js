/**
 * AI Judge: single Claude API call per round.
 * Responsibilities (delegated to the model via prompt):
 * - Intent understanding (VALID / INVALID / UNCLEAR + move + reason)
 * - Game logic (round_winner from moves + rules)
 * - Response generation (what the user sees)
 * We only call the API and parse the structured output; no game logic in code.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { buildRoundPrompt } = require('./rules-and-prompt.js');
const { TOTAL_ROUNDS } = require('./state.js');

const DEFAULT_MODEL = 'claude-3-5-haiku-latest';
const MAX_RETRIES = 2; // retry up to 2 times on 429 (3 attempts total)
const DEFAULT_RETRY_MS = 10_000; // 10s if no delay in error
const MAX_TOKENS = 1024;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Detect 429 / quota and optional "retry in Xs" from error message. */
function isQuotaError(err) {
  const msg = (err && err.message) || '';
  return /429|quota|Too Many Requests|rate limit/i.test(msg);
}

/** Parse "Please retry in 7.845474055s" → 8000 ms. */
function parseRetryDelayMs(err) {
  const msg = (err && err.message) || '';
  const m = msg.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  if (m) return Math.ceil(parseFloat(m[1]) * 1000);
  return DEFAULT_RETRY_MS;
}

/** Short user-facing message for API errors (avoid dumping full error). */
function shortError(err) {
  const msg = (err && err.message) || '';
  if (/429|quota|Too Many Requests|rate limit/i.test(msg)) {
    const sec = Math.ceil(parseRetryDelayMs(err) / 1000);
    return `Rate limit exceeded. Wait ~${sec}s and try again, or check your Anthropic usage.`;
  }
  if (/404|not found/i.test(msg)) return 'Model not found. Try setting ANTHROPIC_MODEL (e.g. claude-3-5-haiku-latest or claude-3-haiku-20240307).';
  if (/401|403|API key|invalid api key/i.test(msg)) return 'Invalid or missing API key. Check ANTHROPIC_API_KEY.';
  return msg.length > 120 ? msg.slice(0, 120) + '…' : msg;
}

/**
 * Call Claude and return parsed round result.
 * On 429 (rate limit), waits and retries up to MAX_RETRIES times.
 * @param {object} state - { round, userScore, botScore, bombUsed }
 * @param {string} userInput - User's free-text move
 * @param {string} botMove - Bot's move (rock/paper/scissors)
 * @param {object} options - { apiKey, model }
 * @returns {Promise<{ intent, round_winner, response, raw }>}
 */
async function judgeRound(state, userInput, botMove, options = {}) {
  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      intent: { status: 'INVALID', move: null, reason: 'No API key. Set ANTHROPIC_API_KEY.' },
      round_winner: null,
      response: 'Cannot run AI Judge: ANTHROPIC_API_KEY is not set.',
      raw: null,
    };
  }

  const modelId = options.model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const prompt = buildRoundPrompt(state, userInput, botMove, TOTAL_ROUNDS);
  let lastErr;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model: modelId,
        max_tokens: MAX_TOKENS,
        system: 'You are an AI Judge for a Rock–Paper–Scissors–Bomb game. Reply with only valid JSON, no markdown or extra text.',
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = message.content && message.content.find((block) => block.type === 'text');
      const text = (textBlock && textBlock.text ? textBlock.text : '').trim();

      if (!text) {
        return {
          intent: { status: 'UNCLEAR', move: null, reason: 'Model returned no content.' },
          round_winner: null,
          response: 'No response from the Judge. Try again.',
          raw: null,
        };
      }

      const parsed = parseStructuredOutput(text);
      return { ...parsed, raw: text };
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES && isQuotaError(err)) {
        const delayMs = parseRetryDelayMs(err);
        console.error(`AI Judge: rate limit exceeded. Retrying in ${Math.ceil(delayMs / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES + 1})…`);
        await sleep(delayMs);
      } else {
        break;
      }
    }
  }

  const short = shortError(lastErr);
  console.error('AI Judge error:', short);
  return {
    intent: { status: 'INVALID', move: null, reason: short },
    round_winner: null,
    response: `Judge error: ${short}`,
    raw: null,
  };
}

/**
 * Parse JSON from model output (strip markdown code blocks if present).
 */
function parseStructuredOutput(text) {
  let jsonStr = text.trim();
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```$/;
  const m = jsonStr.match(codeBlock);
  if (m) jsonStr = m[1].trim();
  try {
    const obj = JSON.parse(jsonStr);
    const intent = obj.intent && typeof obj.intent === 'object'
      ? {
        status: ['VALID', 'INVALID', 'UNCLEAR'].includes(obj.intent.status) ? obj.intent.status : 'UNCLEAR',
        move: ['rock', 'paper', 'scissors', 'bomb'].includes(obj.intent.move) ? obj.intent.move : null,
        reason: String(obj.intent.reason ?? ''),
      }
      : { status: 'UNCLEAR', move: null, reason: 'Missing intent.' };
    const round_winner = ['user', 'bot', 'draw'].includes(obj.round_winner) ? obj.round_winner : null;
    const response = typeof obj.response === 'string' ? obj.response : String(obj.response ?? '');
    return { intent, round_winner, response };
  } catch (e) {
    return {
      intent: { status: 'UNCLEAR', move: null, reason: 'Response was not valid JSON.' },
      round_winner: null,
      response: text.slice(0, 500),
    };
  }
}

module.exports = {
  judgeRound,
  parseStructuredOutput,
};
