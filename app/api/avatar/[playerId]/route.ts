import { NextRequest, NextResponse } from 'next/server';
import { getAvatar } from '@/lib/avatarStore';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await params;
  const avatar = getAvatar(playerId);
  if (!avatar) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return new Response(avatar.data, {
    headers: { 'Content-Type': avatar.mimeType, 'Cache-Control': 'public, max-age=3600' },
  });
}
