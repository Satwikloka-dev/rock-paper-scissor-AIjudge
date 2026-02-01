/**
 * AI Judge: one API call per round (Gemini or Claude — whichever key you set).
 * Responsibilities (delegated to the model via prompt):
 * - Intent understanding (VALID / INVALID / UNCLEAR + move + reason)
 * - Game logic (round_winner from moves + rules)
 * - Response generation (what the user sees)
 * We only call the API and parse the structured output; no game logic in code.
 */

const { buildRoundPrompt } = require('./rules-and-prompt.js');
const { TOTAL_ROUNDS } = require('./state.js');

const MAX_RETRIES = 2; // retry up to 2 times on 429 (3 attempts total)
const DEFAULT_RETRY_MS = 10_000; // 10s if no delay in error
const MAX_TOKENS = 1024;

// Claude
const ANTHROPIC_DEFAULT_MODEL = 'claude-3-5-haiku-latest';
// Gemini
const GEMINI_DEFAULT_MODEL = 'gemini-2.0-flash';

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

/** Short user-facing message for API errors. */
function shortError(err, provider) {
  const msg = (err && err.message) || '';
  if (/429|quota|Too Many Requests|rate limit/i.test(msg)) {
    const sec = Math.ceil(parseRetryDelayMs(err) / 1000);
    return `Rate limit exceeded. Wait ~${sec}s and try again.`;
  }
  if (/404|not found/i.test(msg)) {
    if (provider === 'gemini') return 'Model not found. Try setting GEMINI_MODEL (e.g. gemini-2.0-flash).';
    return 'Model not found. Try setting ANTHROPIC_MODEL (e.g. claude-3-5-haiku-latest).';
  }
  if (/401|403|API key|invalid api key/i.test(msg)) {
    return 'Invalid or missing API key. Set GEMINI_API_KEY or ANTHROPIC_API_KEY.';
  }
  return msg.length > 120 ? msg.slice(0, 120) + '…' : msg;
}

/**
 * Call Gemini and return raw text.
 */
async function callGemini(prompt, apiKey, modelId) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });
  const result = await model.generateContent(prompt);
  const response = result.response;
  return (response?.text?.() ?? response?.text ?? '').trim();
}

/**
 * Call Claude and return raw text.
 */
async function callClaude(prompt, apiKey, modelId) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: modelId,
    max_tokens: MAX_TOKENS,
    system: 'You are an AI Judge for a Rock–Paper–Scissors–Bomb game. Reply with only valid JSON, no markdown or extra text.',
    messages: [{ role: 'user', content: prompt }],
  });
  const textBlock = message.content && message.content.find((block) => block.type === 'text');
  return (textBlock && textBlock.text ? textBlock.text : '').trim();
}

/**
 * Choose provider and call the right API. Prefer Claude if both keys set.
 */
function getProvider(options) {
  const anthropicKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (anthropicKey) return { provider: 'claude', apiKey: anthropicKey };
  if (geminiKey) return { provider: 'gemini', apiKey: geminiKey };
  return { provider: null, apiKey: null };
}

/**
 * Call Judge API (Gemini or Claude) and return parsed round result.
 * On 429 (quota/rate limit), waits and retries up to MAX_RETRIES times.
 * @param {object} state - { round, userScore, botScore, bombUsed }
 * @param {string} userInput - User's free-text move
 * @param {string} botMove - Bot's move (rock/paper/scissors)
 * @param {object} options - { apiKey, model } (optional; overrides env)
 * @returns {Promise<{ intent, round_winner, response, raw }>}
 */
async function judgeRound(state, userInput, botMove, options = {}) {
  const { provider, apiKey } = getProvider(options);
  if (!provider || !apiKey) {
    return {
      intent: { status: 'INVALID', move: null, reason: 'No API key. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in .env.' },
      round_winner: null,
      response: 'Cannot run AI Judge: set either GEMINI_API_KEY or ANTHROPIC_API_KEY in .env.',
      raw: null,
    };
  }

  const prompt = buildRoundPrompt(state, userInput, botMove, TOTAL_ROUNDS);
  const modelId = options.model ||
    (provider === 'gemini' ? (process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL) : (process.env.ANTHROPIC_MODEL || ANTHROPIC_DEFAULT_MODEL));
  let lastErr;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const text = provider === 'gemini'
        ? await callGemini(prompt, apiKey, modelId)
        : await callClaude(prompt, apiKey, modelId);

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
        console.error(`AI Judge (${provider}): rate limit. Retrying in ${Math.ceil(delayMs / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES + 1})…`);
        await sleep(delayMs);
      } else {
        break;
      }
    }
  }

  const short = shortError(lastErr, provider);
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
