#!/usr/bin/env node
/**
 * Optional voice mode: user speaks → ElevenLabs STT → Judge (Claude) → ElevenLabs TTS.
 * Serves one page; POST /api/voice accepts base64 audio, returns transcribed text + Judge response + TTS audio.
 */

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const { createState, applyRoundResult, isGameOver, getFinalResult, TOTAL_ROUNDS } = require('./src/assignment/state.js');
const { judgeRound } = require('./src/assignment/ai-judge.js');
const { normalizeMoveInput } = require('./src/assignment/normalize-input.js');
const { transcribe, speak } = require('./src/assignment/elevenlabs.js');

const PORT = Number(process.env.VOICE_PORT) || 3001;
const BOT_CHOICES = ['rock', 'paper', 'scissors'];

let state = createState();

function randomBotMove() {
  return BOT_CHOICES[Math.floor(Math.random() * BOT_CHOICES.length)];
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function handleVoice(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'ELEVENLABS_API_KEY is not set.' }));
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const audioBase64 = body.audioBase64 || body.audio;
    const mimeType = body.mimeType || 'audio/webm';

    if (!audioBase64) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Missing audioBase64 in body.' }));
      return;
    }

    if (isGameOver(state)) {
      res.statusCode = 200;
      res.end(JSON.stringify({
        gameOver: true,
        finalResult: getFinalResult(state),
        userScore: state.userScore,
        botScore: state.botScore,
        message: 'Game over. Start a new game to play again.',
      }));
      return;
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const { text: transcribedText } = await transcribe(audioBuffer, apiKey, mimeType);
    const normalizedInput = normalizeMoveInput(transcribedText || '');
    const botMove = randomBotMove();
    const result = await judgeRound(state, normalizedInput, botMove);

    state = applyRoundResult(state, result);

    let responseAudioBase64 = null;
    try {
      const audio = await speak(result.response, apiKey);
      if (audio && audio.length > 0) responseAudioBase64 = audio.toString('base64');
    } catch (ttsErr) {
      console.error('TTS failed:', ttsErr.message);
    }

    res.statusCode = 200;
    res.end(JSON.stringify({
      transcribedText: transcribedText || '(no speech detected)',
      normalizedInput: normalizedInput || transcribedText,
      response: result.response,
      intent: result.intent,
      roundWinner: result.round_winner,
      round: isGameOver(state) ? TOTAL_ROUNDS : state.round,
      userScore: state.userScore,
      botScore: state.botScore,
      gameOver: isGameOver(state),
      finalResult: isGameOver(state) ? getFinalResult(state) : null,
      audioBase64: responseAudioBase64,
    }));
  } catch (err) {
    console.error('Voice handler error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message || 'Server error.' }));
  }
}

function handleNewGame(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end();
    return;
  }
  state = createState();
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, message: 'New game started.' }));
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';
  const method = req.method || 'GET';

  if (url === '/api/voice' && method === 'POST') {
    await handleVoice(req, res);
    return;
  }
  if (url === '/api/new-game' && method === 'POST') {
    handleNewGame(req, res);
    return;
  }
  if (url === '/' || url === '/index.html') {
    const file = path.join(__dirname, 'public-voice', 'voice.html');
    fs.readFile(file, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      res.setHeader('Content-Type', 'text/html');
      res.end(data);
    });
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Voice mode: http://localhost:${PORT}`);
  console.log(`Set ELEVENLABS_API_KEY and ANTHROPIC_API_KEY in .env`);
});
