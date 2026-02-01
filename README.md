# Rock–Paper–Scissors–Bomb · AI Judge

Prompt-driven AI Judge for a Rock–Paper–Scissors–Bomb scenario. The user submits a move in free text; the AI Judge decides VALID / INVALID / UNCLEAR, applies the rules (including bomb once), and returns structured round feedback. Built in **JavaScript** for the Applied AI Engineer (Conversational Agents) assignment.

---

## Quick start

```bash
npm install
cp .env.example .env   # set ONE of: GEMINI_API_KEY or ANTHROPIC_API_KEY
npm start              # or: npm run assignment
```

Then enter your move in free text each round (3 rounds). Type `quit` or `exit` to end early.

**Judge API:** Use **either** Gemini or Claude. Set `GEMINI_API_KEY` ([Google AI Studio](https://aistudio.google.com/apikey)) **or** `ANTHROPIC_API_KEY` ([Anthropic Console](https://console.anthropic.com/)). If both are set, Claude is used.

### Optional: Voice mode (ElevenLabs)

Speak your move and hear the Judge response. You need **ELEVENLABS_API_KEY** plus **one** Judge key (Gemini or Claude). If ElevenLabs is not set, the CLI (text) is unchanged and works as before.

1. Add to `.env`: `ELEVENLABS_API_KEY=your_key` (get it from [ElevenLabs](https://elevenlabs.io/) → Profile → API key), and keep one Judge key (Gemini or Claude).
2. Run: `npm run voice`.
3. Open **http://localhost:3001**, allow the microphone, then **hold** the button while you say your move (e.g. “rock”, “scissors”, “bomb”) and release. The app transcribes with ElevenLabs, runs the Judge (Claude), and plays the response with TTS.

---

## Project structure

| File | Responsibility |
|------|----------------|
| `src/assignment/rules-and-prompt.js` | **Prompt design:** rules + intent/game/response instructions; single JSON output schema |
| `src/assignment/ai-judge.js` | One Gemini call per round; parse structured output; retry on 429 |
| `src/assignment/state.js` | Minimal state: round, userScore, botScore, bombUsed |
| `src/assignment/normalize-input.js` | Spelling correction for moves (e.g. "scissor" → "scissors") so the Judge understands intent |
| `src/assignment/index.js` | CLI loop: input → normalize → judge → print response → update state → final result |
| `.env.example` | Template for `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` (use one); optional voice keys |
| `ASSIGNMENT_TASKS.md` | Step-by-step task breakdown (optional reference) |
| `server-voice.js` | Optional voice server: STT (ElevenLabs) → Judge → TTS |
| `src/assignment/elevenlabs.js` | ElevenLabs transcribe + speak helpers |
| `public-voice/voice.html` | Voice UI: record, send, play response |

---

## Architecture (separation of concerns)

The solution separates:

1. **Intent understanding** — What did the user try to do? (VALID / INVALID / UNCLEAR + move + reason) — driven by the prompt.
2. **Game logic** — Is the move valid? Who won the round? (bomb beats all; bomb vs bomb = draw; bomb once only) — driven by the prompt.
3. **Response generation** — Round number, moves played, round winner, what happens next — driven by the prompt.

Rules and decisions live in **`src/assignment/rules-and-prompt.js`**. The code in `ai-judge.js` and `index.js` does **not** encode win conditions or intent rules; it only calls the chosen API (Gemini or Claude) with the built prompt and parses the JSON (`intent`, `round_winner`, `response`). State in `state.js` is minimal: round, user score, bot score, bomb used.

---

## Deliverables (README)

### Why this prompt structure

- **Single prompt per round:** Rules + output schema + this round’s context (round number, scores, bomb used, user message, bot move) are in one place so the model has full information and no hidden state.
- **Three-step task in the prompt:** (1) Intent → (2) Game logic → (3) Response. That keeps a clear separation of “what did the user try to do?”, “who won?”, and “what do we tell the user?” without multiple agents.
- **Rules in natural language:** Win conditions and bomb constraint are written in the prompt, not in code, so the model drives decisions and we avoid hardcoding logic.

### Failure cases considered

| Case | Handling |
|------|----------|
| Ambiguous input (“paper or scissors”) | Prompt says → UNCLEAR; do not guess; move = null; reason stated. |
| Bomb when already used | Prompt receives “Bomb already used? Yes”; instructs → INVALID; reason e.g. “Bomb can only be used once.” |
| Empty or whitespace input | Prompt says invalid/unclear; model returns INVALID or UNCLEAR with reason. |
| Gibberish / off-topic | Prompt says not a valid move → INVALID; reason stated. |
| Model returns non-JSON or malformed JSON | Code parses safely; on failure → UNCLEAR/INVALID and user-facing message (no crash). |
| API errors (quota, key, network) | Retry on 429; short user-facing error message; no raw stack in output. |

### What I would improve next

- **Few-shot examples in the prompt:** Add 2–3 example user messages with expected `intent` and `round_winner` to reduce drift on edge phrasing.
- **Stricter JSON schema:** Ask for a single top-level object only and optionally validate with a short schema description to cut markdown fences and extra text.
- **Explainability pass:** Optional second call or instruction: “In one sentence, justify round_winner given the two moves” for debugging and transparency.

---

## License

MIT.
