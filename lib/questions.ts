import { Question } from './types';

// After this question index, show the round-break screen (0-based).
// 4 = after the 5th question (Ty, Kristi, Stormy, Shane, Eric) → break → (Logan, Destiny, Kyle, Brooke)
export const ROUND_BREAK_AFTER = 4;

// ─── BREWER FAMILY GAME QUESTIONS ────────────────────────────────────────────
// correctId   = what that person said about themselves
// aiPredictionId = what the AI predicted before the session (sometimes right, sometimes wrong)
// The game is more fun when the AI is wrong ~half the time

export const QUESTIONS: Question[] = [

  // ── TY ───────────────────────────────────────────────────────────────────
  {
    id: 'ty-1',
    subjectName: 'Ty',
    subjectId: 'ty',
    prompt: "Ty is mid-conversation and slowly realizes he may have accidentally offended someone. He:",
    choices: [
      { id: 'a', text: "Doesn't notice. He'll figure it out three days later in the shower." },
      { id: 'b', text: "Makes a self-deprecating joke to defuse it. Humor fixes most things." },
      { id: 'c', text: "Stops everything. Asks clarifying questions. Needs to understand what happened before moving on." },
      { id: 'd', text: "Doubles down. He probably wasn't wrong. He'll apologize if evidence emerges." },
    ],
    correctId: 'c',        // freeze = stop and understand
    aiPredictionId: 'a',   // AI picks the blind spot (doesn't read the room)
    aiComment: '',
  },

  // ── KRISTI ────────────────────────────────────────────────────────────────
  {
    id: 'kristi-1',
    subjectName: 'Kristi',
    subjectId: 'kristi',
    prompt: "Kristi's perfect Sunday afternoon looks like:",
    choices: [
      { id: 'a', text: "Completely alone. Shelby on her lap. Nobody needs anything from her. That's it." },
      { id: 'b', text: "Whole family over, some chaos, everyone talking. She's in her element." },
      { id: 'c', text: "Reorganizing something. A closet, a pantry. She finds it genuinely relaxing." },
      { id: 'd', text: "TV on, fully horizontal, achieving absolutely nothing. She's better at it than you think." },
    ],
    correctId: 'a',        // introverted + dog lover + can out-relax anyone
    aiPredictionId: 'c',   // AI assumes competent ops person defaults to organizing
    aiComment: '',
  },

  // ── STORMY ────────────────────────────────────────────────────────────────
  {
    id: 'stormy-1',
    subjectName: 'Stormy',
    subjectId: 'stormy',
    prompt: "A client walks in with an AI-generated tattoo design and asks Stormy to replicate it exactly. She:",
    choices: [
      { id: 'a', text: "Does it. Work is work. She's not here to judge what people want on their body." },
      { id: 'b', text: "Has a direct, honest conversation: here's what I can do, here's why it'll look better." },
      { id: 'c', text: "Quietly puts her own spin on it anyway. They'll thank her later." },
      { id: 'd', text: "Passes on the booking. She didn't build a portfolio to be a copy machine." },
    ],
    correctId: 'b',        // direct + freeze = handle it professionally and honestly
    aiPredictionId: 'd',   // AI assumes the artist ego wins
    aiComment: '',
  },

  // ── SHANE ─────────────────────────────────────────────────────────────────
  {
    id: 'shane-1',
    subjectName: 'Shane',
    subjectId: 'shane',
    prompt: "After a lively group conversation, Shane walks away thinking:",
    choices: [
      { id: 'a', text: "\"I definitely talked too much in there. I should let people finish.\"" },
      { id: 'b', text: "\"Great discussion — everyone made solid points. Really balanced.\"" },
      { id: 'c', text: "\"I made some strong arguments. Good conversation.\"" },
      { id: 'd', text: "\"I'm still not done. I have three more points I didn't get to make.\"" },
    ],
    correctId: 'c',        // smart + funny + misunderstood — he knows he was good, doesn't see the domination
    aiPredictionId: 'd',   // AI picks the debate energy
    aiComment: '',
  },

  // ── ERIC ──────────────────────────────────────────────────────────────────
  {
    id: 'eric-1',
    subjectName: 'Eric',
    subjectId: 'eric',
    prompt: "Which one sounds most like something Eric would actually say on a Monday morning?",
    choices: [
      { id: 'a', text: "\"I was up until 2am fixing a dashboard. But I got it. It's fine.\"" },
      { id: 'b', text: "\"Meal prepped, got a workout in, three coffees deep. Let's go.\"" },
      { id: 'c', text: "\"It's fine. Everything's fine. I'm fine.\"" },
      { id: 'd', text: "\"Did anyone look at this data? Something's off and I need a second opinion.\"" },
    ],
    correctId: 'c',        // casual, low-key, friendly — the low-drama response
    aiPredictionId: 'd',   // AI thinks data developer = always talking about data
    aiComment: '',
  },

  // ── LOGAN ─────────────────────────────────────────────────────────────────
  {
    id: 'logan-1',
    subjectName: 'Logan',
    subjectId: 'logan',
    prompt: "Logan gets assigned a group project with people he's never met. He:",
    choices: [
      { id: 'a', text: "Immediately starts organizing. Someone has to, might as well be him." },
      { id: 'b', text: "Does his part excellently and quietly. Shows up, delivers, doesn't make it weird." },
      { id: 'c', text: "Makes a dad joke to break the tension, then gets to work." },
      { id: 'd', text: "Scans the room first. Figure out who's actually going to carry this before committing." },
    ],
    correctId: 'b',        // serious work ethic (surprise) + nice + flight = doesn't push forward
    aiPredictionId: 'c',   // AI goes for the dad joke angle
    aiComment: '',
  },

  // ── DESTINY ───────────────────────────────────────────────────────────────
  {
    id: 'destiny-1',
    subjectName: 'Destiny',
    subjectId: 'destiny',
    prompt: "Destiny can't find the TV remote. It could be under any of the 40+ throw pillows on the couch. She:",
    choices: [
      { id: 'a', text: "Has a system. She knows exactly where everything is. The pillows are organized." },
      { id: 'b', text: "Patiently checks each one. No rush. It'll turn up." },
      { id: 'c', text: "Asks Shane to find it, waits peacefully, gets mildly sarcastic when he can't." },
      { id: 'd', text: "Just uses her phone. Moving on." },
    ],
    correctId: 'b',        // patience is her defining trait
    aiPredictionId: 'a',   // AI assumes organized workforce manager = organized home
    aiComment: '',
  },

  // ── KYLE ──────────────────────────────────────────────────────────────────
  {
    id: 'kyle-1',
    subjectName: 'Kyle',
    subjectId: 'kyle',
    prompt: "Kyle walks into a party where he only knows two people. He:",
    choices: [
      { id: 'a', text: "Makes a lap, finds the most interesting conversation happening, and inserts himself." },
      { id: 'b', text: "Sticks with the people he knows. He's here to have fun, not to network." },
      { id: 'c', text: "Finds the food. Best way to look busy while reading the room." },
      { id: 'd', text: "Has already introduced himself to five new people before his date has taken her coat off." },
    ],
    correctId: 'a',        // engaging + 7/10 competitive + fight response + cares about fun
    aiPredictionId: 'd',   // AI overestimates based on 7/10 competitive + engaging
    aiComment: '',
  },

  // ── BROOKE ────────────────────────────────────────────────────────────────
  {
    id: 'brooke-1',
    subjectName: 'Brooke',
    subjectId: 'brooke',
    prompt: "The friend group is planning a trip and the Google Doc is completely out of control. Brooke:",
    choices: [
      { id: 'a', text: "Adds her info, nothing else, no drama. Done in two minutes." },
      { id: 'b', text: "Quietly reformats the whole doc without telling anyone. She can't help it." },
      { id: 'c', text: "Follows whatever the group decides. She's just glad to be going." },
      { id: 'd', text: "Asks one clarifying question, gets what she needs, checks out of the thread." },
    ],
    correctId: 'c',        // peace-seeker + freeze + quiet + fun + friendly
    aiPredictionId: 'a',   // AI guesses she stays out of it but still acts (close, but misses the warmth)
    aiComment: '',
  },

];
