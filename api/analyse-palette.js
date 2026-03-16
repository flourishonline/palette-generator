export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mediaType, archetype } = req.body;
  if (!imageBase64 || !mediaType) return res.status(400).json({ error: 'Missing image data' });

  const archetypeContext = archetype
    ? `The client's Brand Archetype is ${archetype}. Let this inform the emotional quality and naming of your palette suggestions — but extract colours from the image first, then layer archetype feeling on top.`
    : '';

  const prompt = `You are an expert brand colour consultant. Analyse this image and generate exactly 3 distinct colour palette suggestions that a brand designer could use as a starting point.

${archetypeContext}

For each palette, extract and refine colours from the image into a cohesive brand palette. Each palette should have a distinct mood or direction — e.g. one could be bold and saturated, one muted and sophisticated, one light and airy.

Return ONLY valid JSON, no markdown, no explanation, exactly this structure:

{
  "palettes": [
    {
      "name": "Palette name (evocative, 2-4 words)",
      "mood": "One sentence describing the feeling/brand personality this palette evokes",
      "colours": [
        { "role": "Primary", "hex": "#XXXXXX", "name": "Colour name" },
        { "role": "Secondary", "hex": "#XXXXXX", "name": "Colour name" },
        { "role": "Accent", "hex": "#XXXXXX", "name": "Colour name" },
        { "role": "Neutral", "hex": "#XXXXXX", "name": "Colour name" }
      ]
    }
  ]
}

Rules:
- All hex codes must be valid 6-character hex codes starting with #
- Make colours work together as a real brand palette — not just colours extracted randomly
- Primary should be the dominant brand colour
- Secondary should complement Primary
- Accent should pop against both — used for CTAs and highlights  
- Neutral should work as a background or text colour
- Ensure sufficient contrast between colours for accessibility
- Name each colour evocatively (e.g. "Dusty Rose", "Slate Midnight", "Warm Ivory")`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'API error' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Strip any markdown fences just in case
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Palette error:', error);
    return res.status(500).json({ error: 'Failed to analyse image. Please try again.' });
  }
}
