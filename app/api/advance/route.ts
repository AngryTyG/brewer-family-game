import { NextRequest, NextResponse } from 'next/server';
import { advance, startGame, getState, endGame } from '@/lib/gameState';

export async function POST(req: NextRequest) {
  const { action } = await req.json().catch(() => ({ action: 'advance' }));
  if (action === 'start') {
    startGame();
  } else if (action === 'end-game') {
    endGame();
  } else {
    advance();
  }
  return NextResponse.json(getState());
}
