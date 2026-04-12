// api/claude.js — Proxy seguro para Anthropic API
// Esta función corre en Vercel, nunca expone la API key al navegador

export default async function handler(req, res) {
  // Solo permite POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS — solo permite tu dominio
  res.setHeader('Access-Control-Allow-Origin', 'https://panel.lentesespecializados.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { prompt, system } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt requerido' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY, // ← guardada en Vercel, nunca visible
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
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
