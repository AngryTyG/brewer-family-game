import { GameState, Player, PlayerAnswer, Question } from './types';
import { QUESTIONS } from './questions';

// In-memory singleton — lives for the lifetime of the Node process
let state: GameState = buildInitialState();

function buildInitialState(): GameState {
  return {
    phase: 'lobby',
    round: 1,
    players: [],
    questions: QUESTIONS,
    currentQuestionIndex: 0,
    roundBreakAfter: -1, // computed at startGame
    revealPhase: 'waiting',
    answers: [],
    mcComment: '',
    mcStreaming: false,
    speechId: 0,
    lastUpdated: Date.now(),
  };
}

/**
 * Build the question list for the session based on who joined.
 *
 * Rules:
 *  - Filter QUESTIONS to only those whose subject is a joined player.
 *  - If 6+ distinct subjects: split in half → Round 1 / Round 2.
 *    roundBreakAfter = Math.ceil(n/2) - 1
 *  - If < 6 subjects: run all their questions in Round 1,
 *    then repeat the same set shuffled for Round 2.
 *    roundBreakAfter = subjectCount - 1
 */
function buildQuestionList(players: Player[]): { questions: Question[]; roundBreakAfter: number } {
  const names = new Set(players.map(p => p.name.toLowerCase()));
  const matched = QUESTIONS.filter(q => names.has(q.subjectName.toLowerCase()));

  // Fallback: if nobody matched (e.g. all names are typos), use all questions
  const pool = matched.length > 0 ? matched : QUESTIONS;

  if (players.length >= 6) {
    const mid = Math.ceil(pool.length / 2);
    return { questions: pool, roundBreakAfter: mid - 1 };
  } else {
    // Small group: play everyone once, then replay the same set
    const repeated = [...pool, ...pool.map(q => ({ ...q, id: q.id + '-r2' }))];
    return { questions: repeated, roundBreakAfter: pool.length - 1 };
  }
}

function touch() {
  state.lastUpdated = Date.now();
}

export function getState(): GameState {
  return state;
}

export function addPlayer(name: string): Player {
  const existing = state.players.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;

  const player: Player = {
    id: crypto.randomUUID(),
    name,
    score: 0,
    isSubject: false,
  };
  state.players.push(player);
  touch();
  return player;
}

export function startGame() {
  const { questions, roundBreakAfter } = buildQuestionList(state.players);
  state.phase = 'playing';
  state.round = 1;
  state.questions = questions;
  state.roundBreakAfter = roundBreakAfter;
  state.currentQuestionIndex = 0;
  state.revealPhase = 'question';
  state.answers = [];
  state.mcComment = '';
  markSubject();
  touch();
}

export function submitAnswer(playerId: string, playerName: string, choiceId: string) {
  // Don't allow changing answer
  if (state.answers.find(a => a.playerId === playerId)) return;
  state.answers.push({ playerId, playerName, choiceId });
  touch();
}

export function advance() {
  const sequence: GameState['revealPhase'][] = [
    'question', 'reveal-family', 'reveal-ai', 'reveal-subject', 'scores'
  ];
  const idx = sequence.indexOf(state.revealPhase);

  if (state.revealPhase === 'round-break') {
    // Host chose to continue to round 2
    state.currentQuestionIndex++;
    state.round = 2;
    state.revealPhase = 'question';
    state.answers = [];
    state.mcComment = '';
    state.effectiveCorrectId = undefined;
    markSubject();
  } else if (state.revealPhase === 'scores') {
    const isLastQuestion = state.currentQuestionIndex >= state.questions.length - 1;
    const isRoundBreakPoint = state.currentQuestionIndex === state.roundBreakAfter;

    if (isLastQuestion) {
      state.phase = 'finished';
      state.revealPhase = 'waiting';
    } else if (isRoundBreakPoint) {
      // Pause between rounds — host decides whether to continue
      state.revealPhase = 'round-break';
    } else {
      state.currentQuestionIndex++;
      state.revealPhase = 'question';
      state.answers = [];
      state.mcComment = '';
      state.effectiveCorrectId = undefined;
      markSubject();
    }
  } else {
    state.revealPhase = sequence[idx + 1] || 'scores';

    // Compute effective correct answer when subject reveal happens
    if (state.revealPhase === 'reveal-subject') {
      const q = state.questions[state.currentQuestionIndex];
      const subjectPlayer = state.players.find(p => p.isSubject);
      const subjectAnswer = subjectPlayer
        ? state.answers.find(a => a.playerId === subjectPlayer.id)
        : null;
      state.effectiveCorrectId = subjectAnswer ? subjectAnswer.choiceId : q.correctId;
    }

    // Score when subject answer reveals
    if (state.revealPhase === 'scores') {
      scoreRound();
    }
  }
  touch();
}

export function endGame() {
  state.phase = 'finished';
  state.revealPhase = 'waiting';
  touch();
}

export function setMcComment(text: string) {
  state.mcComment = text;
  touch();
}

export function appendMcComment(chunk: string) {
  state.mcComment += chunk;
  state.mcStreaming = true;
  touch();
}

export function setMcStreaming(val: boolean) {
  state.mcStreaming = val;
  if (!val && state.mcComment) state.speechId++;
  touch();
}

export function resetGame() {
  state = buildInitialState();
}

function markSubject() {
  const q = state.questions[state.currentQuestionIndex];
  state.players = state.players.map(p => ({
    ...p,
    isSubject: p.name.toLowerCase() === q.subjectName.toLowerCase(),
  }));
}

function scoreRound() {
  const q = state.questions[state.currentQuestionIndex];
  const correctId = state.effectiveCorrectId ?? q.correctId;
  const aiCorrect = q.aiPredictionId === correctId;

  state.players = state.players.map(player => {
    const answer = state.answers.find(a => a.playerId === player.id);
    if (!answer) return player;

    const playerCorrect = answer.choiceId === correctId;
    if (!playerCorrect) return player;

    // Beat the AI: 2pts. Match AI: 1pt.
    const points = (!aiCorrect) ? 2 : 1;
    return { ...player, score: player.score + points };
  });
  touch();
}
