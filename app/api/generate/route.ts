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

    // 1. データベースから在庫を多めに取得
    const { data: dbQuestions } = await supabase
      .from('questions')
      .select('*')
      .eq('subject', subject)
      .eq('mode', mode)
      .eq('difficulty', difficulty)
      .limit(50);

    // 2. 既に解いた問題（excludeIds）を除外する
    const availableQuestions = (dbQuestions || []).filter(
      (q) => !excludeIds.includes(q.id)
    );

    // 3. もし在庫が5問以上あれば、ランダムに5問選んで即座に返す（AI不使用）
    if (availableQuestions.length >= 5) {
      const shuffled = availableQuestions.sort(() => 0.5 - Math.random());
      return NextResponse.json({ questions: shuffled.slice(0, 5), source: 'database' });
    }

    // =====================================
    // 4. 在庫がない場合、AIに「5問まとめて」生成させる
    // =====================================
    const difficultyText = getDifficultyPrompt(difficulty);
    const subjectText = getSubjectPrompt(subject);

    let baseSchema;
    if (mode === 'quiz') baseSchema = quizSchema;
    else if (mode === 'flash') baseSchema = flashcardSchema;
    else baseSchema = drillSchema;

    // AIに「5問の配列」を作らせるようスキーマを強化
    const batchSchema = z.object({
      questions: z.array(baseSchema).length(5)
    });

    const { object: newBatch } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: batchSchema,
      prompt: `あなたは日本の中学生向け難関校受験予備校のカリスマ講師です。
以下の条件に従って、最高の学習問題を【必ず5問】作成してください。
【教科】: ${subjectText}
【問題形式】: ${mode}モード
【難易度設定】: レベル${difficulty} (${difficultyText})
注意事項：
- 全く異なるバリエーションの問題を5種類用意すること。
- 学習指導要領に準拠し、嘘を含めないこと。
- 日本語で出力すること。`,
    });

    // 5. 生成した5問をデータベースに保存
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
    
    // 6. 保存した5問をまとめてフロントエンドに返す
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