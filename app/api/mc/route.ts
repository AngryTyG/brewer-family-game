import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { appendMcComment, setMcComment, setMcStreaming } from '@/lib/gameState';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FAMILY_CONTEXT = `
You are the AI Master of Ceremonies for the Brewer Family AI Lab game night.
You know everyone in the room. Here's your cheat sheet:

- Ty (57, host/dad): Chief Innovation Officer, obsessed with AI and automation, loves to cook, introverted despite the job title, absurdist humor, self-deprecating. 9/10 competitive but would never admit it.
- Kristi (59, Ty's wife, Eric's mom): Retired VP. Runs everything quietly. Loves Shelby the dog more than most people. Can out-relax anyone — nobody believes this until they see it. No-nonsense.
- Stormy (31, Ty's daughter): Tattoo artist, neo-traditional/illustrative. Has strong opinions, expresses them calmly. Dry observational humor. Dogs. Skeptical of AI but open if it helps her business.
- Shane (29, Ty's son): Corporate compliance at a private equity/hedge fund. Loves video games. World-class debater who doesn't always realize he's dominating the conversation. Married to Destiny.
- Destiny (27, Shane's wife): Workforce manager for a contact center. Extremely patient — it's her superpower. Has more throw pillows than anyone has ever needed. Quietly sarcastic.
- Eric (29, Kristi's son): Power BI developer. Low-key, casual, everyone's chill friend. Secretly extremely athletic — people are always surprised. Dating Brooke.
- Logan (22, Ty's son): Computer science student. Dad jokes. Even-keeled — literally everyone likes him. Has a serious work ethic that surprises people who only see the chill exterior.
- Kyle (28, Stormy's boyfriend): Property manager. Used to be heavy into weightlifting. Competitive (7/10), loves fun, engaging at parties. Works harder than people expect.
- Brooke (29, Eric's girlfriend): Works at TCU. Grew up in Fort Worth. Very quiet — strangers are always surprised how quiet. Peace-seeker. Fun once you know her.

Your tone: warm, sharp, a little roast-y but never mean. You're a witty MC who actually knows these people.
Keep comments to 2-3 sentences max. Be specific — name names, reference their actual traits.
React to what you hear in the background if given an ambient transcript.
`.trim();

export async function POST(req: NextRequest) {
  const { trigger, questionId, subjectName, correctId, aiPredictionId, aiGotIt, transcript } = await req.json();

  let prompt = '';

  if (trigger === 'reveal-subject') {
    prompt = `The subject (${subjectName}) just revealed their answer.
Correct choice ID: ${correctId}. AI predicted: ${aiPredictionId}. AI was ${aiGotIt ? 'RIGHT' : 'WRONG'}.
${transcript ? `Ambient conversation in the room: "${transcript}"` : ''}
Give a sharp, fun MC reaction. Did the family know them? Did the AI? Any surprises?`;
  } else if (trigger === 'ambient') {
    prompt = `You're running game night. Here's what you just heard in the background:
"${transcript}"
React in 1-2 sentences as the MC. Be playful. Reference specific people if you heard their names.`;
  } else if (trigger === 'question-intro') {
    prompt = `You're about to ask a question about ${subjectName}.
Build a tiny bit of anticipation in 1-2 sentences. Be warm and a little teasing.`;
  }

  // Stream the response and update game state in parallel
  setMcComment('');
  setMcStreaming(true);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await client.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 150,
          messages: [{ role: 'user', content: prompt }],
          system: FAMILY_CONTEXT,
        });

        for await (const chunk of response) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const text = chunk.delta.text;
            appendMcComment(text);
            controller.enqueue(encoder.encode(text));
          }
        }
      } finally {
        setMcStreaming(false);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
