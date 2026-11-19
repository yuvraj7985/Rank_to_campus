import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGeminiAnswer, getGeminiModel } from '../src/utils/gemini.js';

test('Gemini model selection uses a supported default and replaces the retired alias', () => {
  assert.equal(getGeminiModel(''), 'gemini-3.5-flash-lite');
  assert.equal(getGeminiModel('gemini-2.0-flash'), 'gemini-3.5-flash-lite');
  assert.equal(getGeminiModel('gemini-3.6-flash'), 'gemini-3.6-flash');
});

test('Gemini request sends the server key and returns generated text', async () => {
  let request;
  const answer = await generateGeminiAnswer({
    apiKey: 'test-key',
    model: 'gemini-3.5-flash-lite',
    systemInstruction: 'Answer general and platform questions responsibly.',
    contents: [{ role: 'user', parts: [{ text: 'What is a cutoff?' }] }],
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'A cutoff is a reference rank.' }] } }]
        })
      };
    }
  });

  assert.equal(answer, 'A cutoff is a reference rank.');
  assert.match(request.url, /models\/gemini-3\.5-flash-lite:generateContent$/);
  assert.equal(request.options.headers['x-goog-api-key'], 'test-key');
  assert.equal(JSON.parse(request.options.body).systemInstruction.parts[0].text, 'Answer general and platform questions responsibly.');
});

test('Gemini provider errors and empty responses are reported explicitly', async () => {
  const options = {
    apiKey: 'test-key',
    model: 'gemini-3.5-flash-lite',
    systemInstruction: 'Test',
    contents: []
  };
  await assert.rejects(
    generateGeminiAnswer({
      ...options,
      fetchImpl: async () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Quota exceeded.' } })
      })
    }),
    /Quota exceeded/
  );
  await assert.rejects(
    generateGeminiAnswer({
      ...options,
      fetchImpl: async () => ({ ok: true, json: async () => ({ candidates: [] }) })
    }),
    /Gemini API returned no response/
  );
});
