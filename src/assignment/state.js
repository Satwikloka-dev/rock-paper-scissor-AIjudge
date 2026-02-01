/**
 * Minimal game state (assignment constraint: store minimal state).
 * Only: round count, scores, and whether the user has used bomb.
 */

const TOTAL_ROUNDS = 3;

function createState() {
  return {
    round: 1, // 1-based for display (Round 1, Round 2, ...)
    userScore: 0,
    botScore: 0,
    bombUsed: false,
  };
}

/**
 * Advance to next round and update scores/bomb from judge result.
 */
function applyRoundResult(state, result) {
  const next = {
    round: state.round + 1,
    userScore: state.userScore,
    botScore: state.botScore,
    bombUsed: state.bombUsed,
  };
  if (result.round_winner === 'user') next.userScore += 1;
  if (result.round_winner === 'bot') next.botScore += 1;
  if (result.intent?.move === 'bomb') next.bombUsed = true;
  return next;
}

function isGameOver(state) {
  return state.round > TOTAL_ROUNDS;
}

function getFinalResult(state) {
  if (state.userScore > state.botScore) return 'User wins';
  if (state.botScore > state.userScore) return 'Bot wins';
  return 'Draw';
}

module.exports = {
  TOTAL_ROUNDS,
  createState,
  applyRoundResult,
  isGameOver,
  getFinalResult,
};
