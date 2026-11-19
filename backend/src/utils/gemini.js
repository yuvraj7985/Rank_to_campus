export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export function getGeminiModel(configuredModel) {
  const model = configuredModel?.trim();
  return model === 'gemini-2.0-flash' || !model
    ? DEFAULT_GEMINI_MODEL
    : model;
}

export async function generateGeminiAnswer({
  apiKey,
  model,
  systemInstruction,
  contents,
  fetchImpl = fetch
}) {
  let response;
  try {
    response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents
        }),
        signal: AbortSignal.timeout(30000)
      }
    );
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error('Gemini API request timed out. Please try again.');
    }
    throw new Error('Unable to connect to the Gemini API. Check the server connection and try again.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Gemini API returned an invalid response.');
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || `Gemini API request failed with status ${response.status}.`);
  }

  const answer = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();
  if (!answer) {
    throw new Error('Gemini API returned no response.');
  }
  return answer;
}
