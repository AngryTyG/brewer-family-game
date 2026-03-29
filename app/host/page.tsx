'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Question } from '@/lib/types';

type ThinkingStage = 'idle' | 'analyzing' | 'generating' | 'ready';

const ALL_SUBJECTS = ['Ty', 'Kristi', 'Stormy', 'Shane', 'Destiny', 'Eric', 'Logan', 'Kyle', 'Brooke'];
const MIN_PLAYERS = 5;
const TARGET_PLAYERS = 6;

export default function HostPage() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [mcText, setMcText] = useState('');
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [enabledBots, setEnabledBots] = useState<Set<string>>(new Set());

  // Theater state — client only, not synced to server
  const [thinkingStage, setThinkingStage] = useState<ThinkingStage>('idle');
  const [visibleChoices, setVisibleChoices] = useState(0);
  const prevQuestionIndex = useRef(-1);
  const prevRevealPhase = useRef('');

  // Subtitle state
  const [subtitle, setSubtitle] = useState('');
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const subtitleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const subtitleKey = useRef(0);

  // TTS state
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptBuffer = useRef('');
  const finalSentenceCount = useRef(0);
  const lastSubtitleId = useRef(0);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const ambientTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentQ: Question | null = gameState
    ? gameState.questions[gameState.currentQuestionIndex]
    : null;

  // Poll state
  useEffect(() => {
    const poll = async () => {
      const res = await fetch('/api/state');
      const state: GameState = await res.json();
      setGameState(state);
      setMcText(state.mcComment);
    };
    poll();
    pollRef.current = setInterval(poll, 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Show subtitle from any device (e.g. AI iPad mic → game state → here)
  useEffect(() => {
    if (!gameState) return;
    if (gameState.subtitleId === lastSubtitleId.current) return;
    if (!gameState.subtitle) return;
    lastSubtitleId.current = gameState.subtitleId;
    showSubtitle(gameState.subtitle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.subtitleId]);

  // Auto-compute which bots to enable based on real player count
  useEffect(() => {
    if (!gameState || gameState.phase !== 'lobby') return;
    const realNames = new Set(gameState.players.map(p => p.name.toLowerCase()));
    const missing = ALL_SUBJECTS.filter(s => !realNames.has(s.toLowerCase()));
    const realCount = gameState.players.length;
    if (realCount < MIN_PLAYERS) {
      const needed = Math.max(0, TARGET_PLAYERS - realCount);
      setEnabledBots(new Set(missing.slice(0, needed).map(s => s.toLowerCase())));
    } else {
      setEnabledBots(new Set());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.players.length, gameState?.phase]);

  // Trigger thinking theater when a new question starts
  useEffect(() => {
    if (!gameState) return;
    const { revealPhase, currentQuestionIndex } = gameState;

    const isNewQuestion =
      revealPhase === 'question' &&
      (currentQuestionIndex !== prevQuestionIndex.current || prevRevealPhase.current !== 'question');

    if (isNewQuestion) {
      prevQuestionIndex.current = currentQuestionIndex;
      prevRevealPhase.current = revealPhase;
      runThinkingSequence();
    } else {
      prevRevealPhase.current = revealPhase;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.revealPhase, gameState?.currentQuestionIndex]);

  function runThinkingSequence() {
    setThinkingStage('analyzing');
    setVisibleChoices(0);
    setMcText('');

    setTimeout(() => setThinkingStage('generating'), 1600);

    setTimeout(() => {
      setThinkingStage('ready');
      [0, 1, 2, 3].forEach(i =>
        setTimeout(() => setVisibleChoices(i + 1), i * 250)
      );
      // Fire question-intro MC comment once question is revealed
      triggerMC('question-intro');
    }, 2900);
  }

  // Show a subtitle, auto-hide after 6s
  function showSubtitle(text: string) {
    if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);
    subtitleKey.current++;
    setSubtitle(text);
    setSubtitleVisible(true);
    subtitleTimerRef.current = setTimeout(() => setSubtitleVisible(false), 6000);
  }

  async function speak(text: string) {
    if (!text?.trim() || speakingRef.current) return;
    speakingRef.current = true;
    setSpeaking(true);
    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        speakingRef.current = false;
        setSpeaking(false);
        finalSentenceCount.current = 0; // discard TTS transcript noise
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        speakingRef.current = false;
        setSpeaking(false);
      };
      audio.play();
    } catch {
      speakingRef.current = false;
      setSpeaking(false);
    }
  }

  // Fire subtitle API from ambient speech
  async function requestSubtitle(snippet: string) {
    if (speakingRef.current) return; // don't react to our own voice
    try {
      const res = await fetch('/api/subtitle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: snippet }),
      });
      const { comment } = await res.json();
      if (comment) showSubtitle(comment);
    } catch { /* silent */ }
  }

  // Web Speech API mic
  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const w = window as typeof window & {
      webkitSpeechRecognition?: new () => SpeechRecognition;
      SpeechRecognition?: new () => SpeechRecognition;
    };
    const SR = w.webkitSpeechRecognition || w.SpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          transcriptBuffer.current += e.results[i][0].transcript + ' ';
          finalSentenceCount.current++;

          // Every 2 completed sentences → fire a subtitle
          if (finalSentenceCount.current >= 2) {
            finalSentenceCount.current = 0;
            const snippet = transcriptBuffer.current.slice(-200);
            requestSubtitle(snippet);
          }
        } else {
          interim = e.results[i][0].transcript;
        }
      }
      setTranscript(transcriptBuffer.current + interim);
    };

    rec.onend = () => { if (listeningRef.current) rec.start(); };
    rec.start();
    recognitionRef.current = rec;
    setListening(true);

    // Every 20s also trigger the longer MC comment
    ambientTimerRef.current = setInterval(() => {
      if (transcriptBuffer.current.trim().length > 30) {
        triggerMC('ambient', { transcript: transcriptBuffer.current.slice(-300) });
        transcriptBuffer.current = '';
      }
    }, 20000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a ref so the onend closure sees latest listening value
  const listeningRef = useRef(false);
  useEffect(() => { listeningRef.current = listening; }, [listening]);

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
    if (ambientTimerRef.current) clearInterval(ambientTimerRef.current);
  };

  async function triggerMC(trigger: string, extra: Record<string, unknown> = {}) {
    if (!currentQ && trigger !== 'ambient') return;
    const body = {
      trigger,
      questionId: currentQ?.id,
      subjectName: currentQ?.subjectName,
      correctId: currentQ?.correctId,
      aiPredictionId: currentQ?.aiPredictionId,
      aiGotIt: currentQ?.aiPredictionId === currentQ?.correctId,
      ...extra,
    };
    const res = await fetch('/api/mc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const reader = res.body?.getReader();
    if (!reader) return;
    setMcText('');
    const decoder = new TextDecoder();
    let accumulated = '';
    let ttsPrewarmed = false;
    // speechId will be currentSpeechId+1 once this stream finishes
    const predictedSpeechId = (gameState?.speechId ?? 0) + 1;

    const prewarmTTS = (text: string) => {
      ttsPrewarmed = true;
      fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speechId: predictedSpeechId }),
      }).catch(() => {});
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      accumulated += chunk;
      setMcText(prev => prev + chunk);

      // Start TTS as soon as the first sentence is complete
      if (!ttsPrewarmed && /[.!?]/.test(accumulated)) {
        prewarmTTS(accumulated);
      }
    }

    // Fallback: no sentence boundary found — pre-warm with whatever we got
    if (!ttsPrewarmed && accumulated) {
      prewarmTTS(accumulated);
    }
  }

  async function advance(action = 'advance') {
    const disabledBots = action === 'start'
      ? ALL_SUBJECTS.filter(s => !enabledBots.has(s.toLowerCase()))
      : undefined;
    const res = await fetch('/api/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, disabledBots }),
    });
    const state: GameState = await res.json();
    setGameState(state);

    if (action === 'advance') {
      const q = state.questions[state.currentQuestionIndex];
      if (state.revealPhase === 'reveal-subject') {
        const effectiveCorrectId = state.effectiveCorrectId ?? q.correctId;
        const correctText = q.choices.find(c => c.id === effectiveCorrectId)?.text ?? '';
        triggerMC('reveal-subject', {
          transcript: transcriptBuffer.current.slice(-200),
          correctId: effectiveCorrectId,
          correctText,
          aiPredictionId: q.aiPredictionId,
          aiGotIt: q.aiPredictionId === effectiveCorrectId,
          subjectName: q.subjectName,
        });
      }
    }
  }

  async function reset() {
    await fetch('/api/reset', { method: 'POST' });
    setMcText('');
    setThinkingStage('idle');
    setVisibleChoices(0);
    prevQuestionIndex.current = -1;
    prevRevealPhase.current = '';
    transcriptBuffer.current = '';
    setTranscript('');
    setSubtitleVisible(false);
  }

  if (!gameState) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading...</div>;
  }

  const { phase, revealPhase, players, questions, currentQuestionIndex, answers } = gameState;
  const totalQuestions = questions.length;
  const answeredCount = answers.length;
  const totalPlayers = players.length;
  const isQuestionReady = thinkingStage === 'ready' || revealPhase !== 'question';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col overflow-hidden relative" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-cyan-400 font-bold text-lg tracking-wide">BREWER FAMILY</span>
          <span className="text-gray-600">·</span>
          <span className="text-gray-400 text-sm">AI Game Night</span>
          {gameState.round === 2 && (
            <span className="text-xs bg-cyan-900/40 text-cyan-400 border border-cyan-700/40 px-2 py-0.5 rounded-full">Round 2</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={listening ? stopListening : startListening}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              listening
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
            }`}
          >
            {listening ? '🎤 Live' : '🎤 Start Mic'}
          </button>
          {mcText && (
            <button
              onClick={() => speak(mcText)}
              disabled={speaking}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                speaking
                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 animate-pulse'
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-purple-500 hover:text-purple-400'
              }`}
            >
              {speaking ? '🔊 Speaking...' : '🔊 Speak'}
            </button>
          )}
          <button onClick={reset} className="px-3 py-1.5 rounded-lg text-sm bg-gray-800 text-gray-500 border border-gray-700 hover:text-red-400 transition-colors">
            Reset
          </button>
        </div>
      </div>

      {/* ── LOBBY ── */}
      {phase === 'lobby' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-white mb-3">Mission Control</h1>
            <p className="text-cyan-400 text-xl">Brewer Family AI Lab</p>
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-2xl w-full">
            {ALL_SUBJECTS.map(name => {
              const joined = players.find(p => p.name.toLowerCase() === name.toLowerCase());
              const key = name.toLowerCase();
              const botEnabled = enabledBots.has(key);
              if (joined) {
                return (
                  <div key={name} className="rounded-xl p-4 text-center border bg-gray-800 border-cyan-700/50">
                    <PlayerAvatar player={joined} size={56} className="mx-auto mb-2" />
                    <p className="text-white font-semibold">{name}</p>
                    <p className="text-cyan-400 text-xs mt-1">✓ joined</p>
                  </div>
                );
              }
              return (
                <div key={name} className={`rounded-xl p-4 text-center border transition-colors ${botEnabled ? 'bg-purple-950/40 border-purple-700/50' : 'bg-gray-900 border-gray-700/50 opacity-50'}`}>
                  <div className="text-3xl mb-2">{botEnabled ? '🤖' : '·'}</div>
                  <p className={`font-semibold text-sm ${botEnabled ? 'text-purple-300' : 'text-gray-500'}`}>{name}</p>
                  <button
                    onClick={() => setEnabledBots(prev => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key); else next.add(key);
                      return next;
                    })}
                    className={`mt-1 text-xs px-2 py-0.5 rounded border transition-colors ${botEnabled ? 'border-purple-600 text-purple-400 hover:border-red-500 hover:text-red-400' : 'border-gray-600 text-gray-500 hover:border-purple-500 hover:text-purple-400'}`}
                  >
                    {botEnabled ? 'remove bot' : 'add bot'}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2">
              <span className="text-gray-500 text-sm">Join at</span>
              <span className="text-cyan-400 font-mono font-semibold text-sm">
                {typeof window !== 'undefined' ? `${window.location.host}/play` : '/play'}
              </span>
            </div>
            <p className="text-gray-600 text-xs">
              {players.length} joined{enabledBots.size > 0 ? ` · ${enabledBots.size} AI bot${enabledBots.size !== 1 ? 's' : ''}` : ' · no bots'}
            </p>
            <button
              onClick={() => advance('start')}
              disabled={players.length < 1}
              className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-gray-950 font-bold text-xl rounded-2xl transition-colors"
            >
              Start Game →
            </button>
          </div>
        </div>
      )}

      {/* ── ROUND BREAK ── */}
      {phase === 'playing' && revealPhase === 'round-break' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
          <div className="text-center">
            <p className="text-cyan-400 text-sm font-semibold uppercase tracking-widest mb-2">End of Round 1</p>
            <h1 className="text-5xl font-bold text-white mb-2">Halftime</h1>
            <p className="text-gray-400">Round 2 has {totalQuestions - (gameState.roundBreakAfter ?? 4) - 1} more questions</p>
          </div>
          <div className="w-full max-w-sm space-y-2">
            {[...players].sort((a, b) => b.score - a.score).map((p, i) => (
              <div key={p.id} className={`flex items-center justify-between rounded-2xl p-4 ${i === 0 ? 'bg-yellow-900/30 border border-yellow-600/40' : 'bg-gray-800'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm w-5">{i + 1}.</span>
                  <PlayerAvatar player={p} size={36} />
                  <span className="text-white font-semibold text-lg">{p.name}</span>
                </div>
                <span className="text-cyan-400 font-bold text-xl">{p.score}</span>
              </div>
            ))}
          </div>
          {mcText && (
            <div className="bg-purple-950/60 border border-purple-600/40 rounded-2xl px-6 py-4 max-w-2xl w-full text-center">
              <p className="text-purple-400 text-xs uppercase tracking-widest mb-2">🤖 AI Master of Ceremonies</p>
              <p className="text-white text-2xl font-semibold leading-snug">{mcText}</p>
            </div>
          )}
          <div className="flex gap-4">
            <button onClick={() => advance()} className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-bold text-xl rounded-2xl transition-colors">
              Round 2 →
            </button>
            <button onClick={() => advance('end-game')} className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl rounded-2xl transition-colors">
              End Here
            </button>
          </div>
        </div>
      )}

      {/* ── PLAYING ── */}
      {phase === 'playing' && revealPhase !== 'round-break' && currentQ && (
        <div className="flex-1 flex flex-col p-6 gap-4 pb-16">

          {/* Progress */}
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm">Q {currentQuestionIndex + 1} / {totalQuestions}</span>
            <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }} />
            </div>
          </div>

          <div className="flex gap-4 flex-1 min-h-0">
            {/* ── LEFT: Question + Answers ── */}
            <div className="flex-1 flex flex-col gap-3 min-h-0">

              {/* Subject + thinking theater */}
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold border-2 transition-all duration-500 ${
                  thinkingStage === 'analyzing' || thinkingStage === 'generating'
                    ? 'border-cyan-400 bg-cyan-900/30 animate-pulse'
                    : 'border-gray-600 bg-gray-800'
                }`}>
                  {currentQ.subjectName[0]}
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">This round is about</p>
                  <p className="text-white text-2xl font-bold">{currentQ.subjectName}</p>
                </div>
                {(thinkingStage === 'analyzing' || thinkingStage === 'generating') && (
                  <div className="ml-2 flex items-center gap-2 text-cyan-400 text-sm">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                    <span className="text-cyan-400/70 text-xs">
                      {thinkingStage === 'analyzing' ? `Analyzing ${currentQ.subjectName}...` : 'Generating question...'}
                    </span>
                  </div>
                )}
              </div>

              {/* Question box */}
              <div className={`bg-gray-800/60 rounded-2xl p-5 border border-gray-700 transition-all duration-500 ${
                isQuestionReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}>
                <p className="text-white text-xl font-semibold leading-relaxed">{currentQ.prompt}</p>
              </div>

              {/* Answer choices with stagger */}
              <div className="grid grid-cols-1 gap-2">
                {currentQ.choices.map((choice, idx) => {
                  const answersForChoice = answers.filter(a => a.choiceId === choice.id);
                  const effectiveCorrectId = gameState.effectiveCorrectId ?? currentQ.correctId;
                  const isCorrect = (revealPhase === 'reveal-subject' || revealPhase === 'scores') && choice.id === effectiveCorrectId;
                  const isAiPick = (revealPhase === 'reveal-ai' || revealPhase === 'reveal-subject' || revealPhase === 'scores') && choice.id === currentQ.aiPredictionId;
                  const showFamilyAnswers = revealPhase !== 'question';
                  const isVisible = revealPhase !== 'question' || visibleChoices > idx;

                  return (
                    <div
                      key={choice.id}
                      className={`rounded-xl p-3 border transition-all duration-500 ${
                        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                      } ${
                        isCorrect ? 'bg-green-900/40 border-green-500/60'
                        : isAiPick ? 'bg-purple-900/40 border-purple-500/60'
                        : 'bg-gray-800/40 border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 flex-1">
                          <span className={`font-bold text-sm mt-0.5 w-5 shrink-0 ${isCorrect ? 'text-green-400' : isAiPick ? 'text-purple-400' : 'text-gray-500'}`}>
                            {choice.id.toUpperCase()}.
                          </span>
                          <p className="text-gray-200 text-sm leading-relaxed">{choice.text}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          {isAiPick && <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">🤖 AI</span>}
                          {isCorrect && <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-500/30">✓ {currentQ.subjectName}'s answer</span>}
                          {showFamilyAnswers && answersForChoice.map(a => {
                            const isSubject = a.playerName.toLowerCase() === currentQ.subjectName.toLowerCase();
                            return (
                              <span key={a.playerId} className={`text-xs px-2 py-0.5 rounded-full border ${
                                isSubject
                                  ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                                  : 'bg-cyan-900/40 text-cyan-300 border-cyan-700/40'
                              }`}>
                                {a.playerName}{isSubject ? ' ⭐' : ''}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {revealPhase === 'question' && isQuestionReady && (
                <p className="text-gray-500 text-sm">{answeredCount} / {totalPlayers} answered</p>
              )}
            </div>

            {/* ── RIGHT: Scoreboard + MC + Controls ── */}
            <div className="w-72 flex flex-col gap-4 shrink-0">
              <div className="bg-gray-800/60 rounded-2xl p-4 border border-gray-700">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Scores</p>
                {[...players].sort((a, b) => b.score - a.score).map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-700/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 text-xs w-4">{i + 1}.</span>
                      <PlayerAvatar player={p} size={24} />
                      <span className={`text-sm font-medium ${p.isSubject ? 'text-yellow-300' : p.isBot ? 'text-purple-300' : 'text-white'}`}>
                        {p.name} {p.isSubject && '⭐'}{p.isBot && '🤖'}
                      </span>
                    </div>
                    <span className="text-cyan-400 font-bold">{p.score}</span>
                  </div>
                ))}
              </div>

              {/* Question-intro MC — small, in the panel */}
              {mcText && revealPhase === 'question' && (
                <div className="bg-purple-900/20 rounded-xl p-3 border border-purple-700/30">
                  <p className="text-purple-300 text-xs uppercase tracking-wider mb-1">🤖 AI</p>
                  <p className="text-gray-300 text-sm leading-relaxed">{mcText}</p>
                </div>
              )}

              {listening && transcript && (
                <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800">
                  <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">Hearing...</p>
                  <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{transcript.slice(-150)}</p>
                </div>
              )}

              <div className="mt-auto space-y-2">
                <RevealButton
                  phase={revealPhase}
                  onAdvance={advance}
                  answeredCount={answeredCount}
                  totalPlayers={totalPlayers}
                  disabled={revealPhase === 'question' && !isQuestionReady}
                />
              </div>
            </div>
          </div>

          {/* ── MC BANNER — full width, appears after reveals ── */}
          {mcText && revealPhase !== 'question' && (
            <div className="mt-2 bg-purple-950/60 border border-purple-600/40 rounded-2xl px-6 py-4 backdrop-blur-sm">
              <p className="text-purple-400 text-xs uppercase tracking-widest mb-2 text-center">🤖 AI Master of Ceremonies</p>
              <p className="text-white text-2xl font-semibold leading-snug text-center">{mcText}</p>
            </div>
          )}
        </div>
      )}

      {/* ── FINISHED ── */}
      {phase === 'finished' && (() => {
        const sorted = [...players].sort((a, b) => b.score - a.score);
        const medals = ['🥇', '🥈', '🥉'];
        const podiumColors = [
          'bg-yellow-900/40 border-yellow-500/60',
          'bg-gray-700/60 border-gray-500/60',
          'bg-amber-900/30 border-amber-600/40',
        ];
        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 overflow-auto">
            <h1 className="text-5xl font-bold text-white tracking-tight">Game Over!</h1>

            {/* Top 3 podium */}
            <div className="flex items-end gap-6 justify-center">
              {sorted.slice(0, 3).map((p, i) => (
                <div key={p.id} className={`flex flex-col items-center rounded-2xl border p-5 ${podiumColors[i] ?? 'bg-gray-800 border-gray-700'}`}
                  style={{ minWidth: i === 0 ? 160 : 130, paddingBottom: i === 0 ? 28 : i === 1 ? 20 : 16 }}>
                  <span className="text-4xl mb-2">{medals[i]}</span>
                  <PlayerAvatar player={p} size={i === 0 ? 96 : 72} className="mb-3" />
                  <p className="text-white font-bold text-lg">{p.name}</p>
                  <p className="text-cyan-400 font-bold text-2xl">{p.score}</p>
                </div>
              ))}
            </div>

            {/* Rest of leaderboard */}
            {sorted.length > 3 && (
              <div className="flex flex-col gap-2 w-full max-w-md">
                {sorted.slice(3).map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-2 border border-gray-700">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-sm w-5">{i + 4}.</span>
                      <PlayerAvatar player={p} size={36} />
                      <span className="text-white font-medium">{p.name}</span>
                    </div>
                    <span className="text-white font-bold">{p.score}</span>
                  </div>
                ))}
              </div>
            )}

            {mcText && (
              <div className="bg-purple-950/60 border border-purple-600/40 rounded-2xl px-6 py-4 max-w-2xl w-full text-center">
                <p className="text-purple-400 text-xs uppercase tracking-widest mb-2">🤖 AI Master of Ceremonies</p>
                <p className="text-white text-2xl font-semibold leading-snug">{mcText}</p>
              </div>
            )}
            <button onClick={reset} className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-bold rounded-xl transition-colors">
              Play Again
            </button>
          </div>
        );
      })()}

      {/* ── SUBTITLE OVERLAY ── */}
      <div
        className={`fixed bottom-0 left-0 right-0 flex justify-center pb-4 pointer-events-none transition-all duration-500 ${
          subtitleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <div className="bg-black/75 backdrop-blur-sm rounded-xl px-6 py-3 max-w-2xl mx-4">
          <p className="text-white text-base font-medium text-center tracking-wide">{subtitle}</p>
        </div>
      </div>

    </div>
  );
}

function PlayerAvatar({ player, size, className = '' }: { player: { name: string; avatarUrl: string }; size: number; className?: string }) {
  if (player.avatarUrl) {
    return (
      <img
        src={player.avatarUrl}
        alt={player.name}
        width={size}
        height={size}
        className={`rounded-full object-cover border-2 border-gray-600 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  // Fallback: initials circle while avatar generates
  return (
    <div
      className={`rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center text-white font-bold ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {player.name[0]?.toUpperCase()}
    </div>
  );
}

function RevealButton({ phase, onAdvance, answeredCount, totalPlayers, disabled }: {
  phase: GameState['revealPhase'];
  onAdvance: (action?: string) => void;
  answeredCount: number;
  totalPlayers: number;
  disabled?: boolean;
}) {
  const config: Record<string, { label: string; color: string }> = {
    question:         { label: `Reveal Family Answers (${answeredCount}/${totalPlayers})`, color: 'bg-cyan-600 hover:bg-cyan-500' },
    'reveal-family':  { label: 'Reveal AI Prediction →',  color: 'bg-purple-600 hover:bg-purple-500' },
    'reveal-ai':      { label: 'Reveal Subject Answer →', color: 'bg-yellow-600 hover:bg-yellow-500' },
    'reveal-subject': { label: 'Show Scores →',           color: 'bg-green-600 hover:bg-green-500' },
    scores:           { label: 'Next Question →',          color: 'bg-cyan-600 hover:bg-cyan-500' },
    'round-break':    { label: '—',                        color: 'bg-gray-700 opacity-0 pointer-events-none' },
    waiting:          { label: '—',                        color: 'bg-gray-700' },
  };

  const { label, color } = config[phase] ?? config.waiting;

  return (
    <button
      onClick={() => onAdvance()}
      disabled={disabled}
      className={`w-full ${color} disabled:opacity-40 text-white font-bold py-3 px-4 rounded-xl transition-colors text-sm`}
    >
      {disabled ? 'Thinking...' : label}
    </button>
  );
}
