"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type SubjectStats = {
  subject: string;
  total: number;
  correct: number;
  rate: number;
  avgTime: number;
};

type DifficultyStats = {
  difficulty: number;
  total: number;
  correct: number;
  rate: number;
};

export default function Dashboard() {
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  const [difficultyStats, setDifficultyStats] = useState<DifficultyStats[]>([]);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [todayAnswers, setTodayAnswers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);

    // 全回答データを取得
    const { data: answers } = await supabase
      .from("answers")
      .select("*")
      .order("answered_at", { ascending: false });

    if (!answers) return;

    setTotalAnswers(answers.length);

    // 今日の回答数
    const today = new Date().toISOString().split("T")[0];
    const todayData = answers.filter((a) =>
      a.answered_at.startsWith(today)
    );
    setTodayAnswers(todayData.length);

    // 教科別集計
    const subjects = ["english", "math", "japanese"];
    const sStats = subjects.map((subject) => {
      const data = answers.filter((a) => a.subject === subject);
      const correct = data.filter((a) => a.is_correct).length;
      const avgTime = data.length > 0
        ? Math.round(data.reduce((sum, a) => sum + (a.response_time_ms || 0), 0) / data.length / 1000)
        : 0;
      return {
        subject,
        total: data.length,
        correct,
        rate: data.length > 0 ? Math.round((correct / data.length) * 100) : 0,
        avgTime,
      };
    });
    setSubjectStats(sStats);

    // 難易度別集計
    const dStats = [1, 2, 3, 4, 5].map((difficulty) => {
      const data = answers.filter((a) => a.difficulty === difficulty);
      const correct = data.filter((a) => a.is_correct).length;
      return {
        difficulty,
        total: data.length,
        correct,
        rate: data.length > 0 ? Math.round((correct / data.length) * 100) : 0,
      };
    });
    setDifficultyStats(dStats);

    setLoading(false);
  };

  const subjectLabel = (s: string) =>
    s === "english" ? "📖 英語" : s === "math" ? "🔢 数学" : "🖊️ 国語";

  const getRateColor = (rate: number) => {
    if (rate >= 80) return "text-green-400";
    if (rate >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const getBarColor = (rate: number) => {
    if (rate >= 80) return "bg-green-500";
    if (rate >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans">
      <header className="border-b border-white/10 bg-black/50 p-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-yellow-500">⚔️ 戦績ダッシュボード</h1>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← 道場に戻る
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 mt-6 space-y-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* サマリーカード */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 border border-white/20 rounded-2xl p-5 text-center">
                <p className="text-gray-400 text-sm">累計回答数</p>
                <p className="text-4xl font-bold text-yellow-400 mt-1">{totalAnswers}</p>
                <p className="text-gray-500 text-xs mt-1">問</p>
              </div>
              <div className="bg-white/10 border border-white/20 rounded-2xl p-5 text-center">
                <p className="text-gray-400 text-sm">今日の回答数</p>
                <p className="text-4xl font-bold text-yellow-400 mt-1">{todayAnswers}</p>
                <p className="text-gray-500 text-xs mt-1">問</p>
              </div>
            </div>

            {/* 教科別正答率 */}
            <div className="bg-white/10 border border-white/20 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-yellow-400">📊 教科別 正答率</h2>
              {subjectStats.map((s) => (
                <div key={s.subject} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{subjectLabel(s.subject)}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{s.total}問 / 平均{s.avgTime}秒</span>
                      <span className={`font-bold text-lg ${getRateColor(s.rate)}`}>
                        {s.total > 0 ? `${s.rate}%` : "-"}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${getBarColor(s.rate)}`}
                      style={{ width: `${s.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 難易度別正答率 */}
            <div className="bg-white/10 border border-white/20 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-yellow-400">⭐ 難易度別 正答率</h2>
              {difficultyStats.map((d) => (
                <div key={d.difficulty} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">
                      {"★".repeat(d.difficulty)}{"☆".repeat(5 - d.difficulty)}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{d.total}問</span>
                      <span className={`font-bold text-lg ${getRateColor(d.rate)}`}>
                        {d.total > 0 ? `${d.rate}%` : "-"}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${getBarColor(d.rate)}`}
                      style={{ width: `${d.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 弱点アドバイス */}
            <div className="bg-white/10 border border-white/20 rounded-2xl p-6 space-y-3">
              <h2 className="text-lg font-bold text-yellow-400">🎯 弱点分析</h2>
              {subjectStats
                .filter((s) => s.total > 0 && s.rate < 60)
                .map((s) => (
                  <div key={s.subject} className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <p className="text-red-400 font-bold">{subjectLabel(s.subject)} が苦手です</p>
                    <p className="text-gray-400 text-sm mt-1">
                      正答率 {s.rate}% — この教科を重点的に特訓しましょう！
                    </p>
                  </div>
                ))}
              {subjectStats.every((s) => s.total === 0 || s.rate >= 60) && (
                <p className="text-gray-400 text-sm">まだデータが足りません。問題を解いて戦績を積み上げましょう！</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}