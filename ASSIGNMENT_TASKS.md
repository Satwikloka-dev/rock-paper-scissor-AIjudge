# Assignment Task Breakdown — Prompt-Driven AI Judge

Use this as a step-by-step guide to build or refine your solution with clear human intuition. Each task maps to the assignment requirements.

---

## Objective (what you’re being evaluated on)

| Focus | What it means |
|-------|----------------|
| **Prompt quality** | Rules and instructions are clear; the model behaves correctly from the prompt alone. |
| **Instruction design** | System + instruction prompt drives intent, game logic, and response. |
| **Edge-case handling** | Ambiguous input, bomb-used-twice, invalid words, empty input are handled via prompt (not only code). |
| **Explainability** | Every decision (VALID/INVALID/UNCLEAR, round winner) has a stated reason. |

---

## Task 1 — Prompt: Rules (given to the AI)

**Requirement:** “Explains the rules clearly” and “Use prompting to drive decision-making.”

- [ ] **1.1** List valid moves in the prompt: `rock`, `paper`, `scissors`, `bomb`.
- [ ] **1.2** State that **bomb can be used only once** (enforced via prompt + minimal state).
- [ ] **1.3** Define outcomes: rock/paper/scissors matrix; bomb beats rock/paper/scissors; bomb vs bomb → draw.
- [ ] **1.4** Define: unclear/ambiguous → UNCLEAR; invalid (wrong word or bomb when already used) → INVALID; invalid/unclear → turn wasted (no score change).

**Where:** `src/assignment/rules-and-prompt.js` — `RULES` (or equivalent section).

---

## Task 2 — Prompt: Intent understanding

**Requirement:** “Intent understanding (What did the user try to do?)” — clear separation.

- [ ] **2.1** Instruct the model to output: **status** (VALID | INVALID | UNCLEAR), **move** (rock/paper/scissors/bomb or null), **reason** (one sentence).
- [ ] **2.2** In the prompt, give examples of intent: e.g. “I choose rock” → VALID/rock; “banana” → INVALID; “maybe paper or scissors” → UNCLEAR; “bomb” when bomb already used → INVALID.
- [ ] **2.3** Tell the model not to guess on ambiguous input — use UNCLEAR and null move.

**Where:** Same file — intent section of the prompt and `OUTPUT_SCHEMA` (intent object).

---

## Task 3 — Prompt: Game logic

**Requirement:** “Game logic (Is it valid? Who won the round?)” — clear separation.

- [ ] **3.1** Instruct: only when intent is VALID, compute **round_winner** (user | bot | draw) from player_move vs bot_move using the stated rules.
- [ ] **3.2** Instruct: if intent is INVALID or UNCLEAR, set **round_winner** to null (turn wasted).
- [ ] **3.3** Do not encode win matrix or bomb logic in code; the prompt is the source of truth for “who wins.”

**Where:** Same file — “Game logic” / “Your task” section and output schema (`round_winner`).

---

## Task 4 — Prompt: Response generation

**Requirement:** “Response generation (What should the user see next?)” — clear separation.

- [ ] **4.1** Require a **response** string: 2–4 sentences for the user.
- [ ] **4.2** Response must include: round number, moves played (or that move was invalid/unclear), who won or that the turn was wasted, and what happens next (scores / next round or final result on last round).
- [ ] **4.3** On the last round, response should lead to or align with the final result (User wins / Bot wins / Draw).

**Where:** Same file — “Response” part of “Your task” and `OUTPUT_SCHEMA.response`.

---

## Task 5 — Output format and parsing

**Requirement:** “Structured decisions” and “Explicit indication of round number, moves played, round winner.”

- [ ] **5.1** Define a single JSON schema in the prompt: `intent` (status, move, reason), `round_winner`, `response`.
- [ ] **5.2** Ask the model to reply with **only** that JSON (no markdown fence, or allow stripping ```json in code).
- [ ] **5.3** In code: parse JSON, validate allowed values (status, move, round_winner), and fallback safely if parse fails (e.g. UNCLEAR + null + raw text).

**Where:** `rules-and-prompt.js` (schema) and `ai-judge.js` (`parseStructuredOutput`).

---

## Task 6 — Minimal state

**Requirement:** “You may store minimal state (e.g. bomb used or not).”

- [ ] **6.1** State variables: **round** (1-based), **userScore**, **botScore**, **bombUsed** (boolean). Nothing else (no DB, no full history required).
- [ ] **6.2** After each round: update scores from `round_winner`; set `bombUsed = true` if `intent.move === 'bomb'`.
- [ ] **6.3** Pass current state into the prompt so the model knows bomb-used and scores for response generation.

**Where:** `src/assignment/state.js` — `createState`, `applyRoundResult`, and the prompt builder that receives `state`.

---

## Task 7 — Glue code (CLI loop)

**Requirement:** “Minimal glue code (optional)” and “No UI, no DB, no external APIs” (except Gemini).

- [ ] **7.1** Loop: for each round, get user input (free text), choose bot move (e.g. random rock/paper/scissors), call AI Judge with (state, userInput, botMove).
- [ ] **7.2** Print the judge’s **response** and optionally intent reason.
- [ ] **7.3** Apply result to state (`applyRoundResult`), then either next round or print final result (User wins / Bot wins / Draw).

**Where:** `src/assignment/index.js` — single CLI script.

---

## Task 8 — Edge cases (in prompt + code)

**Requirement:** “Edge-case handling” and “Explainability.”

- [ ] **8.1** Empty or whitespace input → prompt says treat as INVALID or UNCLEAR (your choice), reason stated.
- [ ] **8.2** “Bomb” when bomb already used → INVALID, reason: e.g. “Bomb can only be used once.”
- [ ] **8.3** Ambiguous: “paper or scissors” / “I’m thinking rock” → UNCLEAR, no guess.
- [ ] **8.4** Gibberish or off-topic → INVALID, reason stated.
- [ ] **8.5** Model returns non-JSON or malformed JSON → code sets UNCLEAR/INVALID and uses safe fallback message.

**Where:** Prompt (rules + examples) and `ai-judge.js` (parseStructuredOutput, error handling).

---

## Task 9 — README (deliverable)

**Requirement:** “A short README explaining: Why you structured the prompt this way; What failure cases you considered; What you would improve next.”

- [ ] **9.1** **Why this prompt structure:** e.g. one system block for rules + schema, then per-round context (round, scores, bomb used, user message, bot move) so the model has everything in one place; clear three-step task (Intent → Game logic → Response).
- [ ] **9.2** **Failure cases considered:** list 4–6 (e.g. ambiguous input, bomb twice, empty input, malformed JSON, API errors, quota).
- [ ] **9.3** **What you’d improve next:** e.g. few-shot examples in prompt, stricter JSON schema, or a second “critic” pass for explainability.

**Where:** `README.md` — section “Assignment: Prompt design” or “Assignment: README (deliverable).”

---

## Quick checklist (submit readiness)

| # | Item | Done |
|---|------|------|
| 1 | Rules (valid moves, bomb once, outcomes, unclear/invalid) in prompt | ☐ |
| 2 | Intent (VALID/INVALID/UNCLEAR + move + reason) in prompt and output | ☐ |
| 3 | Game logic (round_winner only when VALID) in prompt | ☐ |
| 4 | Response (round, moves, winner, next/final) in prompt | ☐ |
| 5 | Single JSON output schema; code parses and validates | ☐ |
| 6 | Minimal state: round, userScore, botScore, bombUsed | ☐ |
| 7 | CLI: input → Judge → print response → update state → final result | ☐ |
| 8 | Edge cases (empty, bomb twice, ambiguous, bad JSON) handled | ☐ |
| 9 | README: why prompt, failure cases, improvements | ☐ |

---

## File map (where to work)

| Task focus | File |
|------------|------|
| Prompt (rules, intent, game logic, response, schema) | `src/assignment/rules-and-prompt.js` |
| Call Gemini, parse JSON, errors | `src/assignment/ai-judge.js` |
| State (create, apply round, game over, final result) | `src/assignment/state.js` |
| CLI loop (ask, judge, print, update state) | `src/assignment/index.js` |
| README (why, failure cases, improvements) | `README.md` |

Run the assignment: `cp .env.example .env` (set `ANTHROPIC_API_KEY`), then `npm run assignment` or `npm start`.
