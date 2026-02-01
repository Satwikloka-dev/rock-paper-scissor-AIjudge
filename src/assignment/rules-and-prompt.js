/**
 * Assignment: Prompt design for AI Judge.
 * Rules and instructions are in the prompt; the model drives intent, game logic, and response.
 * Clear separation in the prompt: (1) Intent understanding, (2) Game logic, (3) Response generation.
 */

const RULES = `
## Game rules (you must apply these exactly)

1. **Valid moves** (exactly these, nothing else):
   - rock
   - paper
   - scissors
   - bomb (can be used by the player ONLY ONCE in the entire game)

2. **Outcomes**:
   - rock beats scissors; scissors beats paper; paper beats rock.
   - bomb beats rock, paper, and scissors.
   - bomb vs bomb → draw.

3. **Move interpretation**:
   - If the user's message clearly indicates one valid move → VALID. Infer the move (rock/paper/scissors/bomb).
   - If the user's message is ambiguous or could mean multiple things → UNCLEAR. Do not guess; set move to null.
   - If the user's message is not a valid move (wrong word, irrelevant, or bomb when already used) → INVALID. Set move to null.

4. **Turn outcome**:
   - Invalid or unclear moves waste the turn (no score change; round_winner is null).
   - Valid move: determine round_winner from player_move vs bot_move using the rules above.
`;

const OUTPUT_SCHEMA = `
## Output format (respond with valid JSON only, no markdown or extra text)

{
  "intent": {
    "status": "VALID" | "INVALID" | "UNCLEAR",
    "move": "rock" | "paper" | "scissors" | "bomb" | null,
    "reason": "One sentence: why this status?"
  },
  "round_winner": "user" | "bot" | "draw" | null,
  "response": "2-4 sentences for the user: round number, moves played, who won (or that the turn was wasted), and what happens next. Be clear and concise."
}
`;

/**
 * Build the full prompt for one round.
 * @param {object} state - { round, userScore, botScore, bombUsed }
 * @param {string} userInput - Raw free-text move from user
 * @param {string} botMove - Bot's move for this round (rock/paper/scissors only)
 * @param {number} totalRounds - Total rounds in the game (so model can say "final result" on last round)
 */
function buildRoundPrompt(state, userInput, botMove, totalRounds = 3) {
  const { round, userScore, botScore, bombUsed } = state;
  const isLastRound = round >= totalRounds;
  return `${RULES}
${OUTPUT_SCHEMA}

---

## This round

- **Round number:** ${round}
- **Current scores:** User ${userScore} — Bot ${botScore}
- **Bomb already used by user this game?** ${bombUsed ? 'Yes' : 'No'}
- **User's message (free text):** "${userInput}"
- **Bot's move (already chosen):** ${botMove}
- **Is this the last round of the game?** ${isLastRound ? 'Yes' : 'No'}

---

## Your task

1. **Intent:** From the user's message, decide status (VALID / INVALID / UNCLEAR), the move if valid (rock/paper/scissors/bomb), and a short reason. If bomb was already used and user said bomb → INVALID. If ambiguous → UNCLEAR.

2. **Game logic:** If intent is VALID, determine round_winner (user / bot / draw) using the rules. If INVALID or UNCLEAR, set round_winner to null (turn wasted).

3. **Response:** Write the "response" string for the user: state the round number, what moves were played (or that the move was invalid/unclear), who won or that the turn was wasted, and what happens next (scores and next round, or final result if this is the last round). Do not include JSON in the response text—only in your overall output.

Reply with ONLY the JSON object (no markdown code fence, no explanation outside the JSON).`;
}

module.exports = {
  RULES,
  OUTPUT_SCHEMA,
  buildRoundPrompt,
};
