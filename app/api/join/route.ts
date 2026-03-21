import { NextRequest, NextResponse } from 'next/server';
import { addPlayer } from '@/lib/gameState';

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const player = addPlayer(name.trim());
  return NextResponse.json(player);
}
