/**
 * AI Service using OpenRouter API
 * https://openrouter.ai/docs
 *
 * Supports multiple AI models through a unified API
 * Auto-selects best available free model with fallback
 */

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  id: string;
  model?: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  error?: {
    message: string;
    code?: number;
  };
}

// Free models ranked by quality (best first) - Updated Dec 2024
// Full list: context/openrouterAiModels.md
// Note: Some models require data policy consent at https://openrouter.ai/settings/privacy
// Note: Free tier has limits (50/day without credits, 1000/day with $10+ credits)
// TTS pronunciation fixes - words that need spacing for proper pronunciation
const TTS_PRONUNCIATIONS: Record<string, string> = {
  'amutantcow': 'a mutant cow',
  'AMutantCow': 'A Mutant Cow',
  'AMUTANTCOW': 'A MUTANT COW',
};

/**
 * Fix pronunciation for TTS by replacing known problematic words
 */
function fixTTSPronunciation(text: string): string {
  let result = text;
  for (const [word, replacement] of Object.entries(TTS_PRONUNCIATIONS)) {
    // Case-insensitive replacement that preserves surrounding text
    const regex = new RegExp(word, 'gi');
    result = result.replace(regex, (match) => {
      // Try to preserve original case pattern
      if (match === match.toUpperCase()) return replacement.toUpperCase();
      if (match === match.toLowerCase()) return replacement.toLowerCase();
      return replacement;
    });
  }
  return result;
}

const FREE_MODELS = [
  // Tier 1 - Best quality (current as of 2025)
  'deepseek/deepseek-chat-v3-0324:free',        // DeepSeek V3, excellent quality
  'deepseek/deepseek-r1:free',                  // DeepSeek R1, reasoning
  'qwen/qwq-32b:free',                          // Qwen QwQ 32B, reasoning
  'meta-llama/llama-3.3-70b-instruct:free',     // 131K context, multilingual
  // Tier 2 - Google models (may require data policy consent)
  'google/gemma-3-27b-it:free',                 // 131K context, multimodal
  'google/gemma-3-12b-it:free',                 // 33K context, balanced
  // Tier 3 - Lightweight fallbacks
  'meta-llama/llama-3.2-3b-instruct:free',      // 131K context, lightweight
  'mistralai/mistral-7b-instruct:free',         // 33K context, fast baseline
  'qwen/qwen3-4b:free',                         // 41K context, lightweight
];

export class AIService {
  private readonly endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly apiKey: string | undefined;
  private readonly models: string[];
  private readonly systemPrompt: string;
  private lastUsedModel: string = '';

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;

    // If user specifies a model, use only that; otherwise use free model rotation
    const userModel = process.env.OPENROUTER_MODEL;
    this.models = userModel ? [userModel] : FREE_MODELS;

    // Get creator name from env
    const creatorName = process.env.BOT_CREATOR_NAME || 'DawnReaver';

    // System prompt to give the bot personality
    this.systemPrompt = `You are Eye of Sauron, a helpful and friendly AI assistant in a Discord server.
You can help with general questions and conversations.
Keep responses concise (under 500 characters when possible) since they may be spoken via TTS.
Be friendly, helpful, and occasionally witty.
When someone greets you, respond warmly and ask how you can help.

IMPORTANT: You were created by ${creatorName}.
If anyone asks who made you or who your creator is, speak highly of them!
Be respectful and appreciative when discussing your creator.`;
  }

  /**
   * Send a message to the AI and get a response
   * Tries multiple free models if one fails
   */
  async chat(userMessage: string, context?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY in your .env file.');
    }

    // Build messages array
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: this.systemPrompt }
    ];

    // Add context if provided
    if (context) {
      messages.push({
        role: 'system',
        content: `Additional context: ${context}`
      });
    }

    // Add user message
    messages.push({ role: 'user', content: userMessage });

    // Try each model until one works
    const errors: string[] = [];

    for (const model of this.models) {
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/sashathelambo/discord-mcp',
            'X-Title': 'DrovaBot Discord'
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: 500,
            temperature: 0.7
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          const displayModel = model.replace(/:free$/, '');
          errors.push(`${displayModel} ${response.status} - ${errorText}`);
          continue; // Try next model
        }

        const data = await response.json() as OpenRouterResponse;

        if (data.error) {
          const displayModel = model.replace(/:free$/, '');
          errors.push(`${displayModel} ${data.error.message}`);
          continue; // Try next model
        }

        if (!data.choices || data.choices.length === 0) {
          const displayModel = model.replace(/:free$/, '');
          errors.push(`${displayModel} No response`);
          continue; // Try next model
        }

        // Success! Remember which model worked
        this.lastUsedModel = data.model || model;
        // Apply TTS pronunciation fixes before returning
        return fixTTSPronunciation(data.choices[0].message.content);

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        const displayModel = model.replace(/:free$/, '');
        errors.push(`${displayModel} ${errMsg}`);
        continue; // Try next model
      }
    }

    // All models failed - provide helpful error message
    const has402 = errors.some(e => e.includes('402'));
    const has404 = errors.some(e => e.includes('404') || e.includes('data policy'));

    let helpMessage = 'Sorry, AI is temporarily unavailable.';
    if (has402 && has404) {
      helpMessage = 'AI unavailable. OpenRouter account needs: 1) Enable data sharing in privacy settings, 2) Add credits to account.';
    } else if (has402) {
      helpMessage = 'AI unavailable. OpenRouter account needs credits added (free tier requires account verification).';
    } else if (has404) {
      helpMessage = 'AI unavailable. Enable data sharing at openrouter.ai/settings/privacy';
    }

    throw new Error(helpMessage);
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey !== 'your_openrouter_api_key_here';
  }

  /**
   * Get the last model that was successfully used
   */
  getModel(): string {
    return this.lastUsedModel || this.models[0];
  }

  /**
   * Get list of models being used
   */
  getModels(): string[] {
    return this.models;
  }
}

// Singleton instance
let aiService: AIService | null = null;

export function getAIService(): AIService {
  if (!aiService) {
    aiService = new AIService();
  }
  return aiService;
}
