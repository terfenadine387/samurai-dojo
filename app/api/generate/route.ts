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
    // lastQuestionId を受け取るように追加
    const { subject, mode, difficulty, lastQuestionId } = body;

    let query = supabase
      .from('questions')
      .select('*')
      .eq('subject', subject)
      .eq('mode', mode)
      .eq('difficulty', difficulty)
      .limit(50);

    // ★直前に出題された問題は在庫から除外する
    if (lastQuestionId) {
      query = query.neq('id', lastQuestionId);
    }

    const { data: unusedQuestions } = await query;

    if (unusedQuestions && unusedQuestions.length > 0) {
      const randomQuestion = unusedQuestions[Math.floor(Math.random() * unusedQuestions.length)];
      return NextResponse.json({ question: randomQuestion, source: 'database' });
    }

    const difficultyText = getDifficultyPrompt(difficulty);
    const subjectText = getSubjectPrompt(subject);

    let schema;
    if (mode === 'quiz') schema = quizSchema;
    else if (mode === 'flash') schema = flashcardSchema;
    else schema = drillSchema;

    const { object: newQuestionContent } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: schema,
      prompt: `あなたは日本の中学生向け難関校受験予備校のカリスマ講師です。
以下の条件に従って、最高の学習問題を1問作成してください。
【教科】: ${subjectText}
【問題形式】: ${mode}モード
【難易度設定】: レベル${difficulty} (${difficultyText})
注意事項：学習指導要領に準拠し、嘘を含めず、開成・灘・慶應などの受験に役立つ良質な問題にすること。日本語で出力すること。`,
    });

    const { data: insertedData, error: insertError } = await supabase
      .from('questions')
      .insert({
        subject, mode, difficulty, content: newQuestionContent, generated_by: 'gemini-2.5-flash', used_count: 1
      })
      .select().single();

    if (insertError) throw insertError;
    return NextResponse.json({ question: insertedData, source: 'ai_generated' });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: '問題の生成に失敗しました' }, { status: 500 });
  }
}

function getDifficultyPrompt(level: number) {
  const levels = [
    '中学1年生の教科書標準レベル。',
    '中学2年生標準レベル。',
    '中学3年生の応用レベル。公立高校入試の標準問題。',
    '難関私立高校入試レベル。ひっかけや複合的な知識を問う。',
    '開成・灘・慶應義塾レベル。深い思考力と高度な知識が要求される難問。'
  ];
  return levels[level - 1] || levels[1];
}

function getSubjectPrompt(subject: string) {
  switch (subject) {
    case 'english': return '英語（英単語、英文法、長文読解）';
    case 'math': return '数学（計算、方程式、図形、関数）';
    case 'japanese': return '国語（漢字、語彙、四字熟語、古文）';
    default: return subject;
  }
}