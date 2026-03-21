import { NextRequest, NextResponse } from 'next/server';
import { submitAnswer } from '@/lib/gameState';

export async function POST(req: NextRequest) {
  const { playerId, playerName, choiceId } = await req.json();
  if (!playerId || !choiceId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  submitAnswer(playerId, playerName, choiceId);
  return NextResponse.json({ ok: true });
}
