import { NextRequest, NextResponse } from 'next/server';
import { advance, startGame, getState, endGame, getBotPlayers, setPlayerAvatar } from '@/lib/gameState';
import { generateAvatar } from '@/lib/avatarStore';

export async function POST(req: NextRequest) {
  const { action } = await req.json().catch(() => ({ action: 'advance' }));

  if (action === 'start') {
    startGame();
    // Generate avatars for bot stand-ins in background
    for (const bot of getBotPlayers()) {
      generateAvatar(bot.id, bot.name).then(() => {
        setPlayerAvatar(bot.id, `/api/avatar/${bot.id}`);
      }).catch(() => {});
    }
  } else if (action === 'end-game') {
    endGame();
  } else {
    advance();
  }

  return NextResponse.json(getState());
}
