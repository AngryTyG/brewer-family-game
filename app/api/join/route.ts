import { NextRequest, NextResponse } from 'next/server';
import { addPlayer, setPlayerAvatar } from '@/lib/gameState';
import { generateAvatar } from '@/lib/avatarStore';

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const player = addPlayer(name.trim());

  // Generate avatar in background — player joins immediately
  generateAvatar(player.id, player.name).then(() => {
    setPlayerAvatar(player.id, `/api/avatar/${player.id}`);
  }).catch(() => {});

  return NextResponse.json(player);
}
