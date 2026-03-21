import { NextResponse } from 'next/server';
import { resetGame, getState } from '@/lib/gameState';

export async function POST() {
  resetGame();
  return NextResponse.json(getState());
}
