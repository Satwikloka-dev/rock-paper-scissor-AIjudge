#!/usr/bin/env node
/**
 * Assignment main: CLI game loop.
 * - Intent understanding + game logic + response generation are in the prompt (ai-judge).
 * - We only: get user input, pick bot move, call AI Judge, update minimal state, print.
 * No UI, no DB, no external APIs except Claude.
 */

require('dotenv').config();
const readline = require('readline');
const { createState, applyRoundResult, isGameOver, getFinalResult, TOTAL_ROUNDS } = require('./state.js');
const { judgeRound } = require('./ai-judge.js');
const { normalizeMoveInput } = require('./normalize-input.js');

const BOT_CHOICES = ['rock', 'paper', 'scissors'];

function randomBotMove() {
  return BOT_CHOICES[Math.floor(Math.random() * BOT_CHOICES.length)];
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve((answer || '').trim());
    });
  });
}

async function main() {
  console.log('--- Rock–Paper–Scissors–Bomb · AI Judge ---\n');
  console.log(`Rules: Valid moves are rock, paper, scissors, bomb (bomb once only; bomb beats all).`);
  console.log(`You have ${TOTAL_ROUNDS} rounds. Enter your move in free text.\n`);

  let state = createState();

  while (!isGameOver(state)) {
    console.log(`--- Round ${state.round} (User ${state.userScore} – Bot ${state.botScore}) ---`);
    const userInput = await ask('Your move (free text): ');
    if (userInput.toLowerCase() === 'quit' || userInput.toLowerCase() === 'exit') {
      console.log('Game ended.');
      process.exit(0);
    }

    const botMove = randomBotMove();
    const normalizedInput = normalizeMoveInput(userInput);
    const result = await judgeRound(state, normalizedInput, botMove);

    console.log('\n' + result.response + '\n');
    if (result.intent?.reason) {
      console.log(`[Intent: ${result.intent.status} — ${result.intent.reason}]\n`);
    }

    state = applyRoundResult(state, result);
  }

  const final = getFinalResult(state);
  console.log('--- Final result ---');
  console.log(`Scores: User ${state.userScore} – Bot ${state.botScore}`);
  console.log(final + '.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
