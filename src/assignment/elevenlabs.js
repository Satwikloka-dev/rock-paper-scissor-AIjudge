/**
 * ElevenLabs: Speech-to-Text (transcribe) and Text-to-Speech (speak).
 * Used by the optional voice mode so the user can talk and hear the Judge response.
 */

const https = require('https');
const FormData = require('form-data');

const STT_HOST = 'api.elevenlabs.io';
const STT_PATH = '/v1/speech-to-text';
const STT_MODEL = 'scribe_v2';
const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam

/**
 * Transcribe audio buffer to text (ElevenLabs Scribe).
 * @param {Buffer} audioBuffer - Raw audio (WAV, MP3, WebM, etc.)
 * @param {string} apiKey - ELEVENLABS_API_KEY
 * @param {string} [mimeType='audio/webm'] - MIME type for the file
 * @returns {Promise<{ text: string }>}
 */
function transcribe(audioBuffer, apiKey, mimeType = 'audio/webm') {
  return new Promise((resolve, reject) => {
    if (!apiKey) {
      reject(new Error('ELEVENLABS_API_KEY is required'));
      return;
    }
    const form = new FormData();
    form.append('file', audioBuffer, { filename: 'audio.webm', contentType: mimeType });
    form.append('model_id', STT_MODEL);
    const headers = { ...form.getHeaders(), 'xi-api-key': apiKey };

    const req = https.request(
      { hostname: STT_HOST, path: STT_PATH, method: 'POST', headers },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`ElevenLabs STT failed (${res.statusCode}): ${body.slice(0, 200)}`));
            return;
          }
          try {
            const data = JSON.parse(body);
            const text = (data && data.text) ? String(data.text).trim() : '';
            resolve({ text });
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    form.pipe(req);
  });
}

/**
 * Convert text to speech (ElevenLabs TTS). Returns audio as Buffer.
 * @param {string} text - Text to speak
 * @param {string} apiKey - ELEVENLABS_API_KEY
 * @param {string} [voiceId] - Voice ID (default: Adam)
 * @returns {Promise<Buffer>}
 */
async function speak(text, apiKey, voiceId = DEFAULT_VOICE_ID) {
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is required');
  if (!text) return Buffer.alloc(0);

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = {
  transcribe,
  speak,
  DEFAULT_VOICE_ID,
};
