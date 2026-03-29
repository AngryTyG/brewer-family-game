import { NextRequest, NextResponse } from 'next/server';

// Cache audio by speechId — one OpenAI call shared across all devices
const audioCache = new Map<number, Buffer>();
const MAX_CACHE = 5;

export async function POST(req: NextRequest) {
  const { text, speechId } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: 'no text' }, { status: 400 });

  // Return cached audio if we already generated this speechId
  if (typeof speechId === 'number' && audioCache.has(speechId)) {
    const buf = audioCache.get(speechId)!;
    return new Response(buf, { headers: { 'Content-Type': 'audio/mpeg' } });
  }

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'tts-1', input: text, voice: 'nova' }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: 500 });
  }

  const buf = Buffer.from(await res.arrayBuffer());

  if (typeof speechId === 'number') {
    audioCache.set(speechId, buf);
    // Evict oldest entries beyond MAX_CACHE
    if (audioCache.size > MAX_CACHE) {
      audioCache.delete(audioCache.keys().next().value!);
    }
  }

  return new Response(buf, { headers: { 'Content-Type': 'audio/mpeg' } });
}
