import { z } from 'zod';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { quizSchema, flashcardSchema, drillSchema } from '../../../lib/schema';

export const runtime = 'edge';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { subject, mode, difficulty, excludeIds = [] } = body;

    const { data: dbQuestions } = await supabase
      .from('questions')
      .select('*')
      .eq('subject', subject)
      .eq('mode', mode)
      .eq('difficulty', difficulty)
      .limit(50);

    const availableQuestions = (dbQuestions || []).filter(
      (q) => !excludeIds.includes(q.id)
    );

    // ★在庫が10問以上あればランダムに10問選んで返す
    if (availableQuestions.length >= 10) {
      const shuffled = availableQuestions.sort(() => 0.5 - Math.random());
      return NextResponse.json({ questions: shuffled.slice(0, 10), source: 'database' });
    }

    const difficultyText = getDifficultyPrompt(difficulty);
    const subjectText = getSubjectPrompt(subject);

    let baseSchema;
    if (mode === 'quiz') baseSchema = quizSchema;
    else if (mode === 'flash') baseSchema = flashcardSchema;
    else baseSchema = drillSchema;

    // ★AIに「10問」作らせるようスキーマを変更
    const batchSchema = z.object({
      questions: z.array(baseSchema).length(10)
    });

    const { object: newBatch } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: batchSchema,
      prompt: `あなたは日本の中学生向け難関校受験予備校のカリスマ講師です。
以下の条件に従って、最高の学習問題を【必ず10問】作成してください。
【教科】: ${subjectText}
【問題形式】: ${mode}モード
【難易度設定】: レベル${difficulty} (${difficultyText})
注意事項：
- 全く異なるバリエーションの問題を10種類用意すること。
- 学習指導要領に準拠し、嘘を含めないこと。
- 日本語で出力すること。`,
    });

    const insertData = newBatch.questions.map((q: any) => ({
      subject,
      mode,
      difficulty,
      content: q,
      generated_by: 'gemini-2.5-flash',
      used_count: 1
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from('questions')
      .insert(insertData)
      .select();

    if (insertError) throw insertError;
    
    return NextResponse.json({ questions: insertedData, source: 'ai_generated' });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: '問題の生成に失敗しました' }, { status: 500 });
  }
}

function getDifficultyPrompt(level: number) {
  const levels = [
    '中学1年生の教科書標準レベル。',
    '中学2年生標準レベル。',
    '中学3年生の応用レベル。',
    '難関私立高校入試レベル。ひっかけや複合知識を問う。',
    '開成・灘・慶應義塾レベル。深い思考力が必要な難問。'
  ];
  return levels[level - 1] || levels[1];
}

function getSubjectPrompt(subject: string) {
  switch (subject) {
    case 'english': return '英語（単語、文法、長文読解）';
    case 'math': return '数学（計算、方程式、図形、関数）';
    case 'japanese': return '国語（漢字、語彙、四字熟語、古文）';
    default: return subject;
  }
}