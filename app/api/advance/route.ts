import { NextRequest, NextResponse } from 'next/server';
import { advance, startGame, getState, endGame, getBotPlayers, setPlayerAvatar } from '@/lib/gameState';
import { generateAvatar } from '@/lib/avatarStore';

export async function POST(req: NextRequest) {
  const { action, disabledBots } = await req.json().catch(() => ({ action: 'advance', disabledBots: [] }));

  if (action === 'start') {
    startGame(disabledBots ?? []);
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
