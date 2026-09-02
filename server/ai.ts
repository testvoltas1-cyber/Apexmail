// server/ai.ts
// AI Integration for Smart Replies, Summarization, Email Drafting & Spam Scoring

import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    try {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch (err) {
      console.error('Failed to initialize GoogleGenAI client:', err);
    }
  }
  return aiClient;
}

export async function generateSmartReplies(subject: string, bodyText: string): Promise<string[]> {
  const ai = getAiClient();
  if (!ai) {
    return [
      'Thanks for the update! I will review this right away.',
      'Looks good to me. Proceed with the plan.',
      'Received with thanks. Let’s schedule a quick call to discuss.',
    ];
  }

  try {
    const prompt = `You are an executive email assistant. Given the following email, generate 3 concise, polite, professional one-sentence smart quick-replies that the user could click to reply instantly.
Subject: ${subject}
Body: ${bodyText.substring(0, 1000)}

Return ONLY a JSON array of 3 strings, e.g. ["Reply 1", "Reply 2", "Reply 3"]. No markdown, no backticks.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });

    const text = response.text?.trim() || '';
    const cleaned = text.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
    const replies = JSON.parse(cleaned);
    if (Array.isArray(replies) && replies.length > 0) {
      return replies.slice(0, 3);
    }
  } catch (err) {
    console.warn('Gemini Smart Reply fallback:', err);
  }

  return [
    'Thanks for the update! I will review this right away.',
    'Looks good to me. Proceed with the plan.',
    'Received with thanks. Let’s schedule a quick call to discuss.',
  ];
}

export async function summarizeEmail(subject: string, bodyText: string): Promise<string> {
  const ai = getAiClient();
  if (!ai) {
    return `Summary: Regarding "${subject}" — ${bodyText.substring(0, 180)}...`;
  }

  try {
    const prompt = `Summarize the following email in 2-3 bullet points or a single crisp sentence highlighting key action items and deadline if any:
Subject: ${subject}
Body: ${bodyText.substring(0, 2000)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });

    return response.text?.trim() || 'Summary could not be generated.';
  } catch (err) {
    console.warn('Gemini Summarize fallback:', err);
    return `Summary: Regarding "${subject}" — ${bodyText.substring(0, 180)}...`;
  }
}

export async function polishDraft(draftText: string, tone: 'professional' | 'casual' | 'persuasive' | 'concise' = 'professional'): Promise<string> {
  const ai = getAiClient();
  if (!ai) {
    return draftText;
  }

  try {
    const prompt = `Improve and rewrite the following email draft to be grammatically flawless, clear, and in a ${tone} tone. Keep the original intent and core facts intact.
Draft:
${draftText}

Return ONLY the polished email draft text.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });

    return response.text?.trim() || draftText;
  } catch (err) {
    console.warn('Gemini Polish draft fallback:', err);
    return draftText;
  }
}
