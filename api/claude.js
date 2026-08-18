// api/claude.js — Proxy seguro para la API de Anthropic
// La API key vive en la variable de entorno ANTHROPIC_API_KEY (Vercel) y
// nunca se expone al navegador.

// Permite hasta 60s por documento (evita timeout en generaciones largas)
export const maxDuration = 60;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en el servidor' });
  }

  try {
    const { prompt, system } = req.body || {};
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt requerido' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 3000,
        output_config: { effort: 'low' },
        system: system || 'Eres asistente clínico especializado en optometría y oftalmología.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Error API' });
    }

    return res.status(200).json({ text: data.content?.[0]?.text || '' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
