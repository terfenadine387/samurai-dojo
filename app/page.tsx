"use client";

import { useState, useEffect } from "react";

type Subject = "english" | "math" | "japanese";
type Mode = "flash" | "quiz" | "drill";

export default function Home() {
  const [subject, setSubject] = useState<Subject>("english");
  const [mode, setMode] = useState<Mode>("quiz");
  const [difficulty, setDifficulty] = useState(1);
  const [streak, setStreak] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  
  // ★直前に出題された問題のIDを記憶する
  const [lastQuestionId, setLastQuestionId] = useState<string | null>(null);
  
  const [question, setQuestion] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const fetchQuestion = async () => {
    setLoading(true);
    setFeedback(null);
    setShowExplanation(false);
    
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ★lastQuestionId を一緒に送る
        body: JSON.stringify({ subject, mode, difficulty, lastQuestionId }),
      });
      const data = await res.json();
      setQuestion(data.question);
    } catch (error) {
      console.error("問題取得エラー", error);
    }
    setLoading(false);
  };

  // 難易度が変わった時も問題を再取得するように修正
  useEffect(() => {
    fetchQuestion();
  }, [subject, mode, difficulty]);

  const handleAnswer = (isCorrect: boolean) => {
    // ★答えた問題のIDを記録する
    if (question && question.id) {
      setLastQuestionId(question.id);
    }

    if (isCorrect) {
      setFeedback("correct");
      const newStreak = streak + 1;
      setStreak(newStreak);
      setWrongCount(0);
      if (newStreak >= 3 && difficulty < 5) {
        setDifficulty((prev) => prev + 1);
        setStreak(0);
      }
    } else {
      setFeedback("incorrect");
      setStreak(0);
      const newWrong = wrongCount + 1;
      setWrongCount(newWrong);
      if (newWrong >= 2 && difficulty > 1) {
        setDifficulty((prev) => prev - 1);
        setWrongCount(0);
      }
    }
    setShowExplanation(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans">
      <header className="border-b border-white/10 bg-black/50 p-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-yellow-500">受験サムライ道場</h1>
          <div className="flex gap-4 text-sm">
            <span>🔥 {streak}連勝</span>
            <span className="text-yellow-400">★ レベル {difficulty}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 mt-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex bg-white/5 rounded-lg p-1">
            {(["english", "math", "japanese"] as Subject[]).map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className={`flex-1 py-2 text-sm rounded-md transition-all ${subject === s ? "bg-white/20 font-bold" : "text-gray-400"}`}
              >
                {s === "english" ? "📖 英語" : s === "math" ? "🔢 数学" : "🖊️ 国語"}
              </button>
            ))}
          </div>
          <div className="flex bg-white/5 rounded-lg p-1">
            {(["quiz", "flash", "drill"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm rounded-md transition-all ${mode === m ? "bg-white/20 font-bold" : "text-gray-400"}`}
              >
                {m === "quiz" ? "🎯 クイズ" : m === "flash" ? "📇 カード" : "⚔️ 特訓"}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white/10 border border-white/20 rounded-2xl p-6 min-h-[300px] flex flex-col justify-center shadow-2xl">
          {loading ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
              <p>AIが問題を生成中...</p>
            </div>
          ) : question ? (
            <div className="space-y-6">
              <h2 className="text-xl md:text-2xl font-bold">{question.content.questionText || question.content.front}</h2>
              
              {mode === "quiz" && !showExplanation && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                  {question.content.options.map((opt: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => handleAnswer(opt === question.content.correctAnswer)}
                      className="bg-white/5 hover:bg-white/20 border border-white/10 p-4 rounded-xl text-left"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {showExplanation && (
                <div className="mt-6 space-y-4">
                  <div className={`p-4 rounded-xl font-bold ${feedback === "correct" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {feedback === "correct" ? "⚔️ 見事！（正解）" : "🛡️ 無念…（不正解）"}
                  </div>
                  <div className="bg-black/30 p-4 rounded-xl text-gray-300">
                    <p className="font-bold text-white mb-2">解説：</p>
                    <p>{question.content.explanation || question.content.back}</p>
                    {question.content.correctAnswer && <p className="mt-2 text-yellow-400">正解: {question.content.correctAnswer}</p>}
                  </div>
                  <button
                    onClick={fetchQuestion}
                    className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-4 rounded-xl"
                  >
                    次の問題へいざ参る ➔
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-gray-500">問題データを読み込めませんでした。</p>
          )}
        </div>
      </main>
    </div>
  );
}