import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `
You are providing real-time commentary for a family game show — like a witty subtitle crawl.
The family: Ty (57, CIO, loves to cook, absurdist humor), Kristi (59, retired VP, very calm, loves her dog Shelby),
Stormy (31, tattoo artist, dry wit, skeptical of AI), Shane (29, compliance/PE, world-class debater, dominates convos),
Destiny (27, workforce manager, extremely patient, quietly sarcastic), Eric (29, Power BI dev, casual/low-key, secretly very athletic),
Logan (22, CS student, dad jokes, even-keeled, serious work ethic surprises people),
Kyle (28, property manager, competitive, loves fun, used to lift weights),
Brooke (29, works at TCU, very quiet, peace-seeker, fun once you know her).

Rules:
- Respond with ONE punchy line. Maximum 12 words.
- Be warm but sharp. Gentle roast energy, never mean.
- Reference specific people by name if you heard them mentioned.
- If nothing interesting happened, respond with exactly: SKIP
- No quotes, no punctuation at the end, no emojis.
`.trim();

export async function POST(req: NextRequest) {
  const { transcript } = await req.json();
  if (!transcript?.trim()) return NextResponse.json({ comment: '' });

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 40,
      system: SYSTEM,
      messages: [{ role: 'user', content: `What just happened in the room: "${transcript}"` }],
    });

    const text = (msg.content[0] as { text: string }).text.trim();
    if (text === 'SKIP' || !text) return NextResponse.json({ comment: '' });
    return NextResponse.json({ comment: text });
  } catch {
    return NextResponse.json({ comment: '' });
  }
}
