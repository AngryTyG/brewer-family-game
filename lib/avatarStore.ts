// In-memory avatar store — playerId → image buffer
const store = new Map<string, { data: ArrayBuffer; mimeType: string }>();

// Personalized prompts for each Brewer family member
const PROMPTS: Record<string, string> = {
  ty:      'cartoon game show contestant portrait, friendly 57-year-old man, CIO executive energy, chef vibes, warm smile, absurdist humor in the eyes. Vibrant colors, circular avatar style.',
  kristi:  'cartoon game show contestant portrait, elegant 59-year-old woman, calm and confident, retired VP energy, warm maternal smile, dog lover vibe. Vibrant colors, circular avatar style.',
  stormy:  'cartoon game show contestant portrait, cool 31-year-old tattoo artist woman, visible tattoo art, dry wit expression, neo-traditional style influence, edgy but warm. Vibrant colors, circular avatar style.',
  shane:   'cartoon game show contestant portrait, sharp 29-year-old man, finance and compliance professional, competitive smirk, debate champion energy, gamer vibe. Vibrant colors, circular avatar style.',
  destiny: 'cartoon game show contestant portrait, patient 27-year-old woman, workforce manager, calm superpower energy, knowing smile, throw pillow collector energy. Vibrant colors, circular avatar style.',
  eric:    'cartoon game show contestant portrait, chill 29-year-old man, low-key data developer, secretly super athletic, casual friendly smile. Vibrant colors, circular avatar style.',
  logan:   'cartoon game show contestant portrait, even-keeled 22-year-old man, computer science student, dad joke ready expression, serious work ethic hidden under chill exterior. Vibrant colors, circular avatar style.',
  kyle:    'cartoon game show contestant portrait, competitive 28-year-old man, property manager, former weightlifter build, fun and engaging, party energy. Vibrant colors, circular avatar style.',
  brooke:  'cartoon game show contestant portrait, quiet 29-year-old woman, peaceful energy, works at a university, Fort Worth Texan, warm once you know her smile. Vibrant colors, circular avatar style.',
  ai:      'cartoon robot game show contestant portrait, friendly glowing eyes, sleek metallic head, game show host bow tie, purple and cyan color scheme, playful and confident. Vibrant colors, circular avatar style.',
};

function getPrompt(name: string): string {
  return (
    PROMPTS[name.toLowerCase()] ??
    `cartoon game show contestant portrait, friendly person named ${name}, warm smile, fun energy. Vibrant colors, circular avatar style.`
  );
}

export function getAvatar(playerId: string) {
  return store.get(playerId) ?? null;
}

export async function generateAvatar(playerId: string, name: string): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: getPrompt(name) }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      }
    );

    if (!res.ok) return;

    const json = await res.json();
    const parts: Array<{ inline_data?: { data: string; mime_type: string } }> =
      json?.candidates?.[0]?.content?.parts ?? [];

    for (const part of parts) {
      if (part.inline_data?.data) {
        const binary = atob(part.inline_data.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        store.set(playerId, { data: bytes.buffer, mimeType: part.inline_data.mime_type ?? 'image/png' });
        return;
      }
    }
  } catch { /* silent — avatar just stays empty */ }
}
