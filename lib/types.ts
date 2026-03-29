export type RevealPhase = 'waiting' | 'question' | 'reveal-family' | 'reveal-ai' | 'reveal-subject' | 'scores' | 'round-break';

export interface AnswerChoice {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  subjectName: string;       // whose personality is being guessed
  subjectId: string;         // player id of the subject
  prompt: string;            // "Which best describes [name]?"
  choices: AnswerChoice[];
  correctId: string;         // what the subject answered about themselves
  aiPredictionId: string;    // what the AI predicted before the session
  aiComment: string;         // AI MC comment after reveal
}

export interface PlayerAnswer {
  playerId: string;
  playerName: string;
  choiceId: string;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  isSubject: boolean;        // is this person the current question's subject?
  isBot: boolean;            // true = auto-added stand-in for a missing family member
  avatarUrl: string;         // /api/avatar/{id} once generated, '' while pending
}

export interface GameState {
  phase: 'lobby' | 'playing' | 'finished';
  round: 1 | 2;
  players: Player[];
  questions: Question[];
  currentQuestionIndex: number;
  roundBreakAfter: number;   // question index after which round-break triggers
  revealPhase: RevealPhase;
  answers: PlayerAnswer[];   // answers for current question
  mcComment: string;         // streaming AI MC text
  mcStreaming: boolean;
  speechId: number;          // increments when a new MC comment finishes — phones use this to trigger auto-play
  subtitle: string;          // latest subtitle quip (from any device's mic)
  subtitleId: number;        // increments on each new subtitle so host page can react
  effectiveCorrectId?: string; // subject's live answer if they played, else correctId
  lastUpdated: number;
}
