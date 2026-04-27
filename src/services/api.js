// src/services/api.js

const OLLAMA_URL = '/api/chat';
const OLLAMA_HOST = '/ollama-root';

export async function checkOllamaStatus() {
  try {
    const res = await fetch(OLLAMA_HOST);
    return res.ok;
  } catch {
    return false;
  }
}

export async function callOllamaStream(model, messages, onChunk) {
  try {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: true,
      }),
    });

    if (!res.ok) throw new Error('Ollama connection failed');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.message && json.message.content) {
            fullText += json.message.content;
            onChunk(json.message.content, fullText);
          }
          if (json.done) break;
        } catch (e) {
          console.error('Error parsing JSON chunk', e);
        }
      }
    }
    return fullText;
  } catch (err) {
    console.error('Stream error:', err);
    throw err;
  }
}
