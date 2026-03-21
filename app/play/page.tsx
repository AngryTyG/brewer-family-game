'use client';

import { useState, useEffect, useRef } from 'react';
import { GameState, Player } from '@/lib/types';

type Screen = 'join' | 'lobby' | 'question' | 'locked' | 'scores';

export default function PlayPage() {
  const [screen, setScreen] = useState<Screen>('join');
  const [nameInput, setNameInput] = useState('');
  const [player, setPlayer] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const currentQuestion = gameState
    ? gameState.questions[gameState.currentQuestionIndex]
    : null;

  // Poll game state
  useEffect(() => {
    if (!player) return;
    const poll = async () => {
      const res = await fetch('/api/state');
      const state: GameState = await res.json();
      setGameState(state);

      if (state.phase === 'lobby') setScreen('lobby');
      else if (state.phase === 'playing') {
        if (state.revealPhase === 'round-break') {
          setScreen('scores');
        } else if (state.revealPhase === 'scores' || state.revealPhase === 'reveal-family' ||
            state.revealPhase === 'reveal-ai' || state.revealPhase === 'reveal-subject') {
          setScreen('scores');
        } else if (submitted) {
          setScreen('locked');
        } else {
          setScreen('question');
        }
      } else if (state.phase === 'finished') {
        setScreen('scores');
      }

      // Reset submission state on new question
      if (state.phase === 'playing' && state.revealPhase === 'question' && screen === 'scores') {
        setSubmitted(false);
        setSelectedChoice(null);
        setScreen('question');
      }
    };

    poll();
    pollRef.current = setInterval(poll, 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [player, submitted, screen]);

  async function handleJoin() {
    if (!nameInput.trim()) return;
    const res = await fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInput.trim() }),
    });
    const p: Player = await res.json();
    setPlayer(p);
    setScreen('lobby');
  }

  async function handleAnswer(choiceId: string) {
    if (submitted || !player) return;
    setSelectedChoice(choiceId);
    setSubmitted(true);
    setScreen('locked');
    await fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: player.id, playerName: player.name, choiceId }),
    });
  }

  // ─── SCREENS ───────────────────────────────────────────────────────────────

  if (screen === 'join') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
        <h1 className="text-3xl font-bold text-white mb-2">Brewer Family</h1>
        <p className="text-cyan-400 text-lg mb-10">AI Game Night</p>
        <div className="w-full max-w-sm space-y-4">
          <input
            className="w-full bg-gray-800 text-white text-xl text-center rounded-xl p-4 outline-none border-2 border-gray-700 focus:border-cyan-400 transition-colors"
            placeholder="Your name"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            autoFocus
          />
          <button
            onClick={handleJoin}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-bold text-xl rounded-xl p-4 transition-colors"
          >
            Join Game
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'lobby') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-6">👋</div>
        <h2 className="text-2xl font-bold text-white mb-2">You're in, {player?.name}!</h2>
        <p className="text-gray-400 text-lg">Waiting for Ty to start the game...</p>
        <div className="mt-8 flex gap-2 justify-center">
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
        {gameState && (
          <p className="mt-8 text-gray-600 text-sm">
            {gameState.players.length} player{gameState.players.length !== 1 ? 's' : ''} joined
          </p>
        )}
      </div>
    );
  }

  if (screen === 'question' && currentQuestion) {
    const isSubject = currentQuestion.subjectName.toLowerCase() === player?.name.toLowerCase();
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col p-4">
        <div className="mb-4 pt-2">
          <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-1">
            Question {(gameState?.currentQuestionIndex ?? 0) + 1} of {gameState?.questions.length}
          </p>
          {isSubject && (
            <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-lg px-3 py-2 mb-2">
              <p className="text-yellow-400 text-sm font-medium">⭐ This question is about YOU</p>
            </div>
          )}
          <p className="text-white text-lg font-semibold leading-snug">
            {currentQuestion.prompt}
          </p>
        </div>
        <div className="flex flex-col gap-3 mt-2">
          {currentQuestion.choices.map((choice) => (
            <button
              key={choice.id}
              onClick={() => handleAnswer(choice.id)}
              className="w-full bg-gray-800 hover:bg-gray-700 active:bg-cyan-800 text-white text-left rounded-xl p-4 border-2 border-gray-700 hover:border-cyan-500 transition-all text-sm leading-relaxed"
            >
              <span className="font-bold text-cyan-400 mr-2">{choice.id.toUpperCase()}.</span>
              {choice.text}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (screen === 'locked') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-white mb-2">Answer locked in!</h2>
        {selectedChoice && currentQuestion && (
          <p className="text-gray-400 text-sm mb-6">
            You chose: <span className="text-cyan-400 font-semibold">
              {currentQuestion.choices.find(c => c.id === selectedChoice)?.text.slice(0, 60)}...
            </span>
          </p>
        )}
        <p className="text-gray-500">Waiting for everyone else...</p>
        <div className="mt-6 flex gap-2 justify-center">
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    );
  }

  if (screen === 'scores' && gameState) {
    const sorted = [...gameState.players].sort((a, b) => b.score - a.score);
    const myScore = gameState.players.find(p => p.id === player?.id)?.score ?? 0;
    const isFinished = gameState.phase === 'finished';
    const isRoundBreak = gameState.revealPhase === 'round-break';

    return (
      <div className="min-h-screen bg-gray-950 flex flex-col p-4">
        <h2 className="text-2xl font-bold text-white mb-1 pt-2">
          {isFinished ? '🏆 Final Scores' : isRoundBreak ? '⏸ Halftime' : '📊 Scores'}
        </h2>
        {isRoundBreak && (
          <p className="text-cyan-400 text-sm mb-2">Waiting for Ty to start Round 2...</p>
        )}
        <p className="text-cyan-400 text-sm mb-6">
          Your score: <span className="font-bold text-lg">{myScore}</span>
        </p>
        <div className="space-y-2">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center justify-between rounded-xl p-3 ${
                p.id === player?.id ? 'bg-cyan-900/40 border border-cyan-500/40' : 'bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-sm w-5">{i + 1}.</span>
                <span className="text-white font-medium">{p.name}</span>
                {p.id === player?.id && <span className="text-cyan-400 text-xs">(you)</span>}
              </div>
              <span className="text-white font-bold text-lg">{p.score}</span>
            </div>
          ))}
        </div>
        {!isFinished && (
          <p className="text-gray-600 text-sm text-center mt-8">Waiting for next question...</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  );
}
