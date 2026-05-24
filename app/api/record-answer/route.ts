import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question_id, subject, mode, difficulty, is_correct, response_time_ms } = body;

    const { error } = await supabase
      .from('answers')
      .insert({
        question_id,
        subject,
        mode,
        difficulty,
        is_correct,
        response_time_ms,
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Record answer error:', error);
    return NextResponse.json({ error: '記録に失敗しました' }, { status: 500 });
  }
}