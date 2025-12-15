/**
 * AI Service - Multi-provider support with fallback chain
 *
 * Supports 10+ FREE AI providers (tried in order):
 * 1. DeepSeek - 500K tokens/day free, excellent quality
 * 2. Google AI (Gemini) - 1M tokens/day free, fast
 * 3. Groq - 14.4K tokens/day free, VERY fast
 * 4. Cerebras - 1M tokens/day free, fast
 * 5. SambaNova - Free tier, fast
 * 6. Together AI - Free Llama models
 * 7. Mistral - Free tier available
 * 8. Cohere - 1000 requests/month free
 * 9. HuggingFace - 1000 requests/day free
 * 10. Cloudflare - 10K tokens/day free
 * 11. OpenRouter - Legacy fallback
 *
 * Configure multiple providers for MILLIONS of free tokens!
 */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  choices?: Array<{
    message: {
      content: string;
    };
  }>;
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  text?: string;
  generated_text?: string;
  error?: {
    message: string;
  };
}

// TTS pronunciation fixes
const TTS_PRONUNCIATIONS: Record<string, string> = {
  'amutantcow': 'a mutant cow',
  'AMutantCow': 'A Mutant Cow',
  'AMUTANTCOW': 'A MUTANT COW',
};

function fixTTSPronunciation(text: string): string {
  let result = text;
  for (const [word, replacement] of Object.entries(TTS_PRONUNCIATIONS)) {
    const regex = new RegExp(word, 'gi');
    result = result.replace(regex, (match) => {
      if (match === match.toUpperCase()) return replacement.toUpperCase();
      if (match === match.toLowerCase()) return replacement.toLowerCase();
      return replacement;
    });
  }
  return result;
}

// Provider configurations
interface ProviderConfig {
  name: string;
  envKey: string;
  endpoint: string | ((apiKey: string) => string);
  model: string;
  formatRequest: (messages: ChatMessage[], model: string) => object;
  parseResponse: (data: ChatResponse) => string;
  headers?: (apiKey: string) => Record<string, string>;
}

const PROVIDERS: ProviderConfig[] = [
  // 1. DeepSeek - 500K tokens/day FREE, excellent quality
  {
    name: 'deepseek',
    envKey: 'DEEPSEEK_API_KEY',
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    formatRequest: (messages, model) => ({
      model,
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || '',
  },
  // 2. Google AI (Gemini) - 1M tokens/day FREE
  {
    name: 'google',
    envKey: 'GOOGLE_AI_KEY',
    endpoint: (apiKey) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    model: 'gemini-2.0-flash',
    formatRequest: (messages) => ({
      contents: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.role === 'system' ? `[System] ${m.content}` : m.content }]
      })),
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7,
      },
    }),
    parseResponse: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    headers: () => ({ 'Content-Type': 'application/json' }),
  },
  // 3. Groq - 14.4K tokens/day FREE, VERY fast (300+ tokens/sec)
  {
    name: 'groq',
    envKey: 'GROQ_API_KEY',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    formatRequest: (messages, model) => ({
      model,
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || '',
  },
  // 4. Cerebras - 1M tokens/day FREE, very fast
  {
    name: 'cerebras',
    envKey: 'CEREBRAS_API_KEY',
    endpoint: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'llama-3.3-70b',
    formatRequest: (messages, model) => ({
      model,
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || '',
  },
  // 5. SambaNova - Free tier, fast
  {
    name: 'sambanova',
    envKey: 'SAMBANOVA_API_KEY',
    endpoint: 'https://api.sambanova.ai/v1/chat/completions',
    model: 'Meta-Llama-3.1-70B-Instruct',
    formatRequest: (messages, model) => ({
      model,
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || '',
  },
  // 6. Together AI - Free Llama models
  {
    name: 'together',
    envKey: 'TOGETHER_API_KEY',
    endpoint: 'https://api.together.xyz/v1/chat/completions',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    formatRequest: (messages, model) => ({
      model,
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || '',
  },
  // 7. Mistral - Free tier
  {
    name: 'mistral',
    envKey: 'MISTRAL_API_KEY',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-small-latest',
    formatRequest: (messages, model) => ({
      model,
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || '',
  },
  // 8. Cohere - 1000 requests/month FREE
  {
    name: 'cohere',
    envKey: 'COHERE_API_KEY',
    endpoint: 'https://api.cohere.ai/v1/chat',
    model: 'command-r-plus',
    formatRequest: (messages) => ({
      model: 'command-r-plus',
      message: messages[messages.length - 1].content,
      preamble: messages.filter(m => m.role === 'system').map(m => m.content).join('\n'),
      max_tokens: 500,
      temperature: 0.7,
    }),
    parseResponse: (data) => data.text || '',
  },
  // 9. HuggingFace - 1000 requests/day FREE
  {
    name: 'huggingface',
    envKey: 'HUGGINGFACE_API_KEY',
    endpoint: 'https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-3B-Instruct/v1/chat/completions',
    model: 'meta-llama/Llama-3.2-3B-Instruct',
    formatRequest: (messages, model) => ({
      model,
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || data.generated_text || '',
  },
  // 10. Cloudflare Workers AI - 10K tokens/day FREE
  {
    name: 'cloudflare',
    envKey: 'CLOUDFLARE_AI_TOKEN',
    endpoint: (apiKey) => {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
      return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`;
    },
    model: '@cf/meta/llama-3.1-8b-instruct',
    formatRequest: (messages) => ({
      messages,
      max_tokens: 500,
    }),
    parseResponse: (data) => {
      // Cloudflare returns { result: { response: "..." } }
      const result = data as unknown as { result?: { response?: string } };
      return result?.result?.response || '';
    },
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }),
  },
  // 11. OpenRouter - Legacy fallback
  {
    name: 'openrouter',
    envKey: 'OPENROUTER_API_KEY',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'deepseek/deepseek-chat-v3-0324:free',
    formatRequest: (messages, model) => ({
      model,
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || '',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/DawnReaverWOWS/TheFinalDiscordMCP',
      'X-Title': 'Eye of Sauron Discord Bot',
    }),
  },
];

export type OnRetryCallback = (failedProvider: string, nextProvider: string, error: string) => void;

export class AIService {
  private readonly systemPrompt: string;
  private readonly availableProviders: ProviderConfig[] = [];
  private lastUsedProvider: string = '';

  constructor() {
    // Find available providers (ones with API keys set)
    for (const provider of PROVIDERS) {
      if (process.env[provider.envKey]) {
        this.availableProviders.push(provider);
      }
    }

    const creatorName = process.env.BOT_CREATOR_NAME || 'DawnReaver';

    this.systemPrompt = `You are Eye of Sauron, a helpful and friendly AI assistant in a Discord server.
You can help with general questions and conversations.
Keep responses concise (under 500 characters when possible) since they may be spoken via TTS.
Be friendly, helpful, and occasionally witty.
When someone greets you, respond warmly and ask how you can help.

IMPORTANT: You were created by ${creatorName}.
If anyone asks who made you or who your creator is, speak highly of them!
Be respectful and appreciative when discussing your creator.`;
  }

  async chat(userMessage: string, context?: string, onRetry?: OnRetryCallback): Promise<string> {
    if (this.availableProviders.length === 0) {
      throw new Error('No AI provider configured. Set DEEPSEEK_API_KEY, GOOGLE_AI_KEY, GROQ_API_KEY, or another provider in .env');
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt }
    ];

    if (context) {
      messages.push({ role: 'system', content: `Additional context: ${context}` });
    }

    messages.push({ role: 'user', content: userMessage });

    const errors: string[] = [];

    for (let i = 0; i < this.availableProviders.length; i++) {
      const provider = this.availableProviders[i];
      try {
        const response = await this.callProvider(provider, messages);
        if (response) {
          this.lastUsedProvider = provider.name;
          return fixTTSPronunciation(response);
        }
        const errMsg = 'Empty response';
        errors.push(`${provider.name}: ${errMsg}`);

        // Notify about retry if there's a next provider
        if (onRetry && i + 1 < this.availableProviders.length) {
          const nextProvider = this.availableProviders[i + 1];
          onRetry(provider.name, nextProvider.name, errMsg);
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${provider.name}: ${errMsg}`);

        // Notify about retry if there's a next provider
        if (onRetry && i + 1 < this.availableProviders.length) {
          const nextProvider = this.availableProviders[i + 1];
          onRetry(provider.name, nextProvider.name, errMsg);
        }
      }
    }

    throw new Error(`AI unavailable. ${errors.join('; ')}`);
  }

  private async callProvider(provider: ProviderConfig, messages: ChatMessage[]): Promise<string> {
    const apiKey = process.env[provider.envKey]!;

    const endpoint = typeof provider.endpoint === 'function'
      ? provider.endpoint(apiKey)
      : provider.endpoint;

    const headers: Record<string, string> = provider.headers
      ? provider.headers(apiKey)
      : {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        };

    const body = provider.formatRequest(messages, provider.model);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${response.status}: ${errorText.substring(0, 100)}`);
    }

    const data = await response.json() as ChatResponse;

    if (data.error) {
      throw new Error(data.error.message);
    }

    return provider.parseResponse(data);
  }

  isAvailable(): boolean {
    return this.availableProviders.length > 0;
  }

  getProvider(): string {
    return this.lastUsedProvider || (this.availableProviders[0]?.name || 'none');
  }

  getProviders(): string[] {
    return this.availableProviders.map(p => p.name);
  }
}

let aiService: AIService | null = null;

export function getAIService(): AIService {
  if (!aiService) {
    aiService = new AIService();
  }
  return aiService;
}
