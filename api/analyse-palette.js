export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mediaType, archetype } = req.body;
  if (!imageBase64 || !mediaType) return res.status(400).json({ error: 'Missing image data' });

  const archetypeContext = archetype
    ? `The client's Brand Archetype is ${archetype}. Let this inform the emotional quality, naming, and mood of your palette suggestions — but extract colours from the image first, then layer archetype feeling on top.`
    : '';

  const prompt = `You are an expert brand colour consultant with deep knowledge of WCAG accessibility standards and web colour theory. Analyse this image and generate exactly 3 distinct colour palette suggestions.

${archetypeContext}

Each palette must contain EXACTLY 6 colours in this specific order:

1. PRIMARY — The dominant brand colour. Used on hero sections, nav backgrounds, primary buttons. Must be distinctive and ownable.
2. SECONDARY — Complements Primary without competing. Used for section backgrounds, card fills, hover states.
3. ACCENT — A warm or contrasting tone that supports Primary and Secondary. Used for subheadings, icon fills, subtle highlights.
4. POP — The drama colour. This should be BOLD, unexpected, and exciting — a colour that creates genuine visual tension with the rest of the palette. Used sparingly for CTAs, badges, hover effects, and key moments. This should feel like a statement.
5. DARK — A rich near-black for headlines and body text. NOT pure #000000 — use a deeply saturated dark version of the brand hue (e.g. deep navy, dark forest, near-black with warmth). Must achieve WCAG AA contrast ratio of at least 4.5:1 against Light.
6. LIGHT — A soft, pale tone for page backgrounds and breathing space. NOT pure #FFFFFF — use a warm or tinted off-white that harmonises with the palette. Must achieve WCAG AA contrast ratio of at least 4.5:1 against Dark.

CRITICAL COLOUR RULES:
- All hex codes must be valid 6-character web-safe hex codes starting with #
- DARK on LIGHT must achieve minimum 4.5:1 contrast ratio (WCAG AA) — check this carefully
- PRIMARY on LIGHT must achieve minimum 3:1 contrast ratio for large text use
- POP must be visually distinct from all other colours — this is the drama colour, make it count
- No two colours should be so similar they could be confused
- The 6 colours together must feel cohesive — a complete, professional brand system
- Avoid pure black (#000000) and pure white (#ffffff)
- Make 3 palettes with genuinely different moods (e.g. bold+saturated, muted+sophisticated, warm+earthy)

Return ONLY valid JSON, no markdown, no explanation, exactly this structure:

{
  "palettes": [
    {
      "name": "Palette name (evocative, 2-4 words)",
      "mood": "One sentence describing the brand personality and feeling",
      "colours": [
        { "role": "Primary", "hex": "#XXXXXX", "name": "Colour name", "use": "Hero sections, primary buttons, nav" },
        { "role": "Secondary", "hex": "#XXXXXX", "name": "Colour name", "use": "Section backgrounds, card fills" },
        { "role": "Accent", "hex": "#XXXXXX", "name": "Colour name", "use": "Subheadings, icons, highlights" },
        { "role": "Pop", "hex": "#XXXXXX", "name": "Colour name", "use": "CTAs, badges, key moments" },
        { "role": "Dark", "hex": "#XXXXXX", "name": "Colour name", "use": "Headlines, body text" },
        { "role": "Light", "hex": "#XXXXXX", "name": "Colour name", "use": "Page backgrounds, white space" }
      ]
    }
  ]
}`;

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
        max_tokens: 2000,
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
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Palette error:', error);
    return res.status(500).json({ error: 'Failed to analyse image. Please try again.' });
  }
}
