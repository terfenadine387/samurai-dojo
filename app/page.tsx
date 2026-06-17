"use client";

import { useState, useEffect } from "react";

type Subject = "english" | "math" | "japanese";
type Mode = "flash" | "quiz" | "drill";

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);

  // ★ 教科ごとの進捗をオブジェクトで管理
  const [difficulties, setDifficulties] = useState({ english: 1, math: 1, japanese: 1 });
  const [streaks, setStreaks] = useState({ english: 0, math: 0, japanese: 0 });
  const [wrongCounts, setWrongCounts] = useState({ english: 0, math: 0, japanese: 0 });

  const [subject, setSubject] = useState<Subject>("english");
  const [mode, setMode] = useState<Mode>("quiz");
  
  const [questionQueue, setQuestionQueue] = useState<any[]>([]);
  const [solvedIds, setSolvedIds] = useState<string[]>([]);
  const [question, setQuestion] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // ★ 各モード専用のステート
  const [isFlipped, setIsFlipped] = useState(false); // カードめくり用
  const [inputText, setInputText] = useState("");     // 特訓入力用

  // 1. ページを開いた時、ブラウザの保存データ(localStorage)を読み込む
  useEffect(() => {
    setIsMounted(true);
    const savedDiff = localStorage.getItem("samurai_difficulties");
    const savedStreaks = localStorage.getItem("samurai_streaks");
    const savedSubj = localStorage.getItem("samurai_subject");
    const savedMode = localStorage.getItem("samurai_mode");

    if (savedDiff) setDifficulties(JSON.parse(savedDiff));
    if (savedStreaks) setStreaks(JSON.parse(savedStreaks));
    if (savedSubj) setSubject(savedSubj as Subject);
    if (savedMode) setMode(savedMode as Mode);
  }, []);

  // 2. レベルや教科が変わるたびに、ブラウザに自動セーブする
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("samurai_difficulties", JSON.stringify(difficulties));
      localStorage.setItem("samurai_streaks", JSON.stringify(streaks));
      localStorage.setItem("samurai_subject", subject);
      localStorage.setItem("samurai_mode", mode);
    }
  }, [difficulties, streaks, subject, mode, isMounted]);

  const currentDiff = difficulties[subject];
  const currentStreak = streaks[subject];
  const currentWrong = wrongCounts[subject];

  const fetchNewBatch = async () => {
    if (!isMounted) return;
    setLoading(true);
    setFeedback(null);
    setShowExplanation(false);
    setIsFlipped(false);
    setInputText("");
    setQuestion(null);
    setQuestionQueue([]);
    
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, mode, difficulty: currentDiff, excludeIds: solvedIds }),
      });
      const data = await res.json();
      
      if (data.questions && data.questions.length > 0) {
        setQuestion(data.questions[0]);
        setQuestionQueue(data.questions.slice(1));
      }
    } catch (error) {
      console.error("問題取得エラー", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isMounted) fetchNewBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, mode, currentDiff, isMounted]);

  const handleAnswer = (isCorrect: boolean) => {
    if (question && question.id) {
      setSolvedIds((prev) => [...prev, question.id]);
    }

    if (isCorrect) {
      setFeedback("correct");
      const newStreak = currentStreak + 1;
      setStreaks(prev => ({ ...prev, [subject]: newStreak }));
      setWrongCounts(prev => ({ ...prev, [subject]: 0 }));
      
      if (newStreak >= 3 && currentDiff < 5) {
        setDifficulties(prev => ({ ...prev, [subject]: currentDiff + 1 }));
        setStreaks(prev => ({ ...prev, [subject]: 0 }));
      }
    } else {
      setFeedback("incorrect");
      setStreaks(prev => ({ ...prev, [subject]: 0 }));
      const newWrong = currentWrong + 1;
      setWrongCounts(prev => ({ ...prev, [subject]: newWrong }));
      
      if (newWrong >= 2 && currentDiff > 1) {
        setDifficulties(prev => ({ ...prev, [subject]: currentDiff - 1 }));
        setWrongCounts(prev => ({ ...prev, [subject]: 0 }));
      }
    }
    setShowExplanation(true);
  };

  // ★特訓モードの採点ロジック（部分一致などで判定）
  const handleDrillSubmit = () => {
    if (!inputText.trim()) return;
    const answers: string[] = question.content.acceptableAnswers || [];
    const isCorrect = answers.some((ans) => 
      inputText.trim().toLowerCase() === ans.toLowerCase()
    );
    handleAnswer(isCorrect);
  };

  const handleNextQuestion = async () => {
    setFeedback(null);
    setShowExplanation(false);
    setIsFlipped(false);
    setInputText("");

    if (questionQueue.length > 0) {
      setQuestion(questionQueue[0]);
      setQuestionQueue((prev) => prev.slice(1));
    } else {
      fetchNewBatch();
    }
  };

  if (!isMounted) return null; // 初期ロード中のチラつき防止

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans">
      <header className="border-b border-white/10 bg-black/50 p-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-yellow-500">受験サムライ道場</h1>
          <div className="flex gap-4 text-sm items-center">
            <span className="text-gray-400 text-xs mr-2">残弾: {questionQueue.length}</span>
            <span>🔥 {currentStreak}連勝</span>
            <span className="text-yellow-400">★ レベル {currentDiff}</span>
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

        <div className="bg-white/10 border border-white/20 rounded-2xl p-6 min-h-[300px] flex flex-col justify-center shadow-2xl relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
              <p>AIが10問の特訓メニューを作成中...</p>
            </div>
          ) : question ? (
            <div className="space-y-6">
              <h2 className="text-xl md:text-2xl font-bold whitespace-pre-wrap">
                {mode === "flash" ? question.content.front : question.content.questionText}
              </h2>
              
              {/* 【クイズモードのUI】 */}
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

              {/* 【カードモードのUI】 */}
              {mode === "flash" && !showExplanation && (
                <div className="mt-6 flex flex-col items-center">
                  {!isFlipped ? (
                    <button onClick={() => setIsFlipped(true)} className="w-full bg-white/10 hover:bg-white/20 border border-white/20 p-8 rounded-xl font-bold text-lg">
                      答えを確認する（カードをめくる）
                    </button>
                  ) : (
                    <div className="w-full space-y-4 animate-in fade-in zoom-in-95 duration-300">
                      <div className="bg-black/30 p-6 rounded-xl border border-white/10">
                        <p className="text-gray-400 text-sm mb-2">裏面（答え・解説）：</p>
                        <p className="text-xl whitespace-pre-wrap font-bold text-yellow-400">{question.content.back}</p>
                        {question.content.hint && <p className="mt-4 text-sm text-gray-300">💡ヒント: {question.content.hint}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => handleAnswer(true)} className="bg-green-600/80 hover:bg-green-500 p-4 rounded-xl font-bold border border-green-500/50">
                          覚えた！（正解）
                        </button>
                        <button onClick={() => handleAnswer(false)} className="bg-red-600/80 hover:bg-red-500 p-4 rounded-xl font-bold border border-red-500/50">
                          忘れた（不正解）
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 【特訓モードのUI】 */}
              {mode === "drill" && !showExplanation && (
                <div className="mt-6 space-y-4">
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleDrillSubmit(); }}
                    placeholder="解答を入力してEnter..."
                    className="w-full bg-black/50 border border-white/20 p-4 rounded-xl text-white outline-none focus:border-yellow-500 transition-colors text-lg"
                  />
                  <button 
                    onClick={handleDrillSubmit}
                    className="w-full bg-yellow-600 hover:bg-yellow-500 p-4 rounded-xl font-bold text-black"
                  >
                    いざ、解答！
                  </button>
                </div>
              )}

              {/* フィードバックと解説（全モード共通） */}
              {showExplanation && (
                <div className="mt-6 space-y-4">
                  <div className={`p-4 rounded-xl font-bold ${feedback === "correct" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {feedback === "correct" ? "⚔️ 見事！（正解）" : "🛡️ 無念…（不正解）"}
                  </div>
                  
                  {mode !== "flash" && (
                    <div className="bg-black/30 p-4 rounded-xl text-gray-300">
                      <p className="font-bold text-white mb-2">解説：</p>
                      <p className="whitespace-pre-wrap">{question.content.explanation}</p>
                      {mode === "quiz" && <p className="mt-2 text-yellow-400">正解: {question.content.correctAnswer}</p>}
                      {mode === "drill" && <p className="mt-2 text-yellow-400">正解: {question.content.acceptableAnswers?.join(" / ")}</p>}
                    </div>
                  )}

                  <button
                    onClick={handleNextQuestion}
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