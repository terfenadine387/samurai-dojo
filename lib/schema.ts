import { z } from 'zod';

export const quizSchema = z.object({
  questionText: z.string().describe('問題文。簡潔かつ明確に記述してください。'),
  options: z.array(z.string()).length(4).describe('選択肢4つ。必ず4つ用意してください。'),
  correctAnswer: z.string().describe('正解の選択肢。optionsの中に必ず含まれる文字列。'),
  explanation: z.string().describe('丁寧な解説。なぜその答えになるのか論理的に。'),
  hint: z.string().describe('生徒向けの短いヒント。'),
});

export const flashcardSchema = z.object({
  front: z.string().describe('カードの表面（問題や単語など）。'),
  back: z.string().describe('カードの裏面（答え、意味、例文など）。'),
  hint: z.string().optional().describe('覚え方のコツなど。'),
});

export const drillSchema = z.object({
  questionText: z.string().describe('問題文。'),
  acceptableAnswers: z.array(z.string()).describe('正解として許容される文字列のリスト。部分一致や表記揺れを考慮。'),
  explanation: z.string().describe('解説。'),
  hint: z.string().describe('ヒント。'),
});