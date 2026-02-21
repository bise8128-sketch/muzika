import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const ScoreSubmissionSchema = z.object({
  songId: z.string(),
  username: z.string().min(2).max(20),
  score: z.number().min(0).max(100),
  maxCombo: z.number().optional(),
  perfectionRate: z.number().optional(),
  harmonyBonus: z.number().optional(),
  pitchAdjustment: z.number().optional(),
  tempoMultiplier: z.number().optional(),
});

/**
 * GET: Retrieve leaderboard for a specific song or global rankings.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const songId = searchParams.get('songId');
  const limit = parseInt(searchParams.get('limit') || '10');

  try {
    const records = await prisma.leaderboardRecord.findMany({
      where: songId ? { songId } : {},
      orderBy: { score: 'desc' },
      take: limit,
      include: {
        song: {
          select: {
            title: true,
            artist: true,
          }
        }
      }
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error('[Leaderboard API] Failed to fetch records:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}

/**
 * POST: Submit a new performance score.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = ScoreSubmissionSchema.parse(body);

    const record = await prisma.leaderboardRecord.create({
      data: {
        songId: validatedData.songId,
        username: validatedData.username,
        score: validatedData.score,
        maxCombo: validatedData.maxCombo || 0,
        perfectionRate: validatedData.perfectionRate,
        harmonyBonus: validatedData.harmonyBonus || 0,
        pitchAdjustment: validatedData.pitchAdjustment || 0,
        tempoMultiplier: validatedData.tempoMultiplier || 1.0,
      },
    });

    // Also update song play count
    await prisma.songEntry.update({
      where: { id: validatedData.songId },
      data: { 
        playCount: { increment: 1 },
        lastPlayedAt: new Date(),
      }
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('[Leaderboard API] Failed to submit score:', error);
    return NextResponse.json({ error: 'Failed to submit score' }, { status: 500 });
  }
}
