/**
 * Voice Settings Service
 *
 * Manages TTS voice selection per guild using Microsoft Edge TTS voices.
 * msedge-tts provides 100+ high-quality neural voices.
 */

export interface VoiceInfo {
  name: string;           // Full voice name (e.g., "en-US-JennyNeural")
  shortName: string;      // User-friendly name (e.g., "Jenny")
  locale: string;         // Language/region (e.g., "en-US")
  gender: 'Female' | 'Male';
  description: string;    // Brief description
}

// Curated list of best English voices from msedge-tts
export const AVAILABLE_VOICES: VoiceInfo[] = [
  // US Female
  { name: 'en-US-JennyNeural', shortName: 'Jenny', locale: 'en-US', gender: 'Female', description: 'Warm & friendly (Default)' },
  { name: 'en-US-AriaNeural', shortName: 'Aria', locale: 'en-US', gender: 'Female', description: 'Expressive & dynamic' },
  { name: 'en-US-MichelleNeural', shortName: 'Michelle', locale: 'en-US', gender: 'Female', description: 'Professional & clear' },
  { name: 'en-US-SaraNeural', shortName: 'Sara', locale: 'en-US', gender: 'Female', description: 'Youthful & casual' },
  { name: 'en-US-AnaNeural', shortName: 'Ana', locale: 'en-US', gender: 'Female', description: 'Child voice' },
  { name: 'en-US-AmberNeural', shortName: 'Amber', locale: 'en-US', gender: 'Female', description: 'Warm & mature' },
  { name: 'en-US-AshleyNeural', shortName: 'Ashley', locale: 'en-US', gender: 'Female', description: 'Friendly & upbeat' },
  { name: 'en-US-CoraNeural', shortName: 'Cora', locale: 'en-US', gender: 'Female', description: 'Calm & soothing' },
  { name: 'en-US-ElizabethNeural', shortName: 'Elizabeth', locale: 'en-US', gender: 'Female', description: 'Elegant & refined' },
  { name: 'en-US-JaneNeural', shortName: 'Jane', locale: 'en-US', gender: 'Female', description: 'Natural & balanced' },
  { name: 'en-US-NancyNeural', shortName: 'Nancy', locale: 'en-US', gender: 'Female', description: 'Mature & professional' },

  // UK Female
  { name: 'en-GB-SoniaNeural', shortName: 'Sonia', locale: 'en-GB', gender: 'Female', description: 'British, professional' },
  { name: 'en-GB-LibbyNeural', shortName: 'Libby', locale: 'en-GB', gender: 'Female', description: 'British, youthful' },
  { name: 'en-GB-MaisieNeural', shortName: 'Maisie', locale: 'en-GB', gender: 'Female', description: 'British, child voice' },

  // Australian Female
  { name: 'en-AU-NatashaNeural', shortName: 'Natasha', locale: 'en-AU', gender: 'Female', description: 'Australian accent' },

  // US Male
  { name: 'en-US-GuyNeural', shortName: 'Guy', locale: 'en-US', gender: 'Male', description: 'Natural & versatile' },
  { name: 'en-US-ChristopherNeural', shortName: 'Christopher', locale: 'en-US', gender: 'Male', description: 'Deep & authoritative' },
  { name: 'en-US-EricNeural', shortName: 'Eric', locale: 'en-US', gender: 'Male', description: 'Friendly & warm' },
  { name: 'en-US-JacobNeural', shortName: 'Jacob', locale: 'en-US', gender: 'Male', description: 'Casual & young' },
  { name: 'en-US-BrandonNeural', shortName: 'Brandon', locale: 'en-US', gender: 'Male', description: 'Energetic & clear' },
  { name: 'en-US-DavisNeural', shortName: 'Davis', locale: 'en-US', gender: 'Male', description: 'Calm & confident' },

  // UK Male
  { name: 'en-GB-RyanNeural', shortName: 'Ryan', locale: 'en-GB', gender: 'Male', description: 'British, natural' },
  { name: 'en-GB-ThomasNeural', shortName: 'Thomas', locale: 'en-GB', gender: 'Male', description: 'British, mature' },

  // Australian Male
  { name: 'en-AU-WilliamNeural', shortName: 'William', locale: 'en-AU', gender: 'Male', description: 'Australian accent' },
];

// Default voice
export const DEFAULT_VOICE = 'en-US-JennyNeural';

// Per-guild voice selection
const guildVoices: Map<string, string> = new Map();

/**
 * Get the current voice for a guild
 */
export function getGuildVoice(guildId: string): string {
  return guildVoices.get(guildId) || DEFAULT_VOICE;
}

/**
 * Get voice info for a guild
 */
export function getGuildVoiceInfo(guildId: string): VoiceInfo | undefined {
  const voiceName = getGuildVoice(guildId);
  return AVAILABLE_VOICES.find(v => v.name === voiceName);
}

/**
 * Set the voice for a guild
 */
export function setGuildVoice(guildId: string, voiceName: string): boolean {
  const voice = findVoice(voiceName);
  if (!voice) {
    return false;
  }
  guildVoices.set(guildId, voice.name);
  return true;
}

/**
 * Find a voice by name (case-insensitive, supports partial matching)
 */
export function findVoice(query: string): VoiceInfo | undefined {
  const lowerQuery = query.toLowerCase().trim();

  // Try exact match on full name
  let voice = AVAILABLE_VOICES.find(v => v.name.toLowerCase() === lowerQuery);
  if (voice) return voice;

  // Try exact match on short name
  voice = AVAILABLE_VOICES.find(v => v.shortName.toLowerCase() === lowerQuery);
  if (voice) return voice;

  // Try partial match on short name
  voice = AVAILABLE_VOICES.find(v => v.shortName.toLowerCase().includes(lowerQuery));
  if (voice) return voice;

  // Try partial match on full name
  voice = AVAILABLE_VOICES.find(v => v.name.toLowerCase().includes(lowerQuery));
  if (voice) return voice;

  return undefined;
}

/**
 * Get voices grouped by category for display
 */
export function getVoicesByCategory(): { category: string; voices: VoiceInfo[] }[] {
  return [
    {
      category: 'US Female Voices',
      voices: AVAILABLE_VOICES.filter(v => v.locale === 'en-US' && v.gender === 'Female')
    },
    {
      category: 'UK Female Voices',
      voices: AVAILABLE_VOICES.filter(v => v.locale === 'en-GB' && v.gender === 'Female')
    },
    {
      category: 'Australian Female Voice',
      voices: AVAILABLE_VOICES.filter(v => v.locale === 'en-AU' && v.gender === 'Female')
    },
    {
      category: 'US Male Voices',
      voices: AVAILABLE_VOICES.filter(v => v.locale === 'en-US' && v.gender === 'Male')
    },
    {
      category: 'UK Male Voices',
      voices: AVAILABLE_VOICES.filter(v => v.locale === 'en-GB' && v.gender === 'Male')
    },
    {
      category: 'Australian Male Voice',
      voices: AVAILABLE_VOICES.filter(v => v.locale === 'en-AU' && v.gender === 'Male')
    }
  ];
}

/**
 * Format voices for display
 */
export function formatVoiceList(): string {
  const categories = getVoicesByCategory();
  let output = '**Available TTS Voices:**\n\n';

  for (const { category, voices } of categories) {
    if (voices.length === 0) continue;
    output += `${category}\n`;
    for (const voice of voices) {
      const isDefault = voice.name === DEFAULT_VOICE ? ' (Default)' : '';
      output += `- ${voice.shortName} - ${voice.description}${isDefault}\n`;
    }
    output += '\n';
  }

  output += `\n**Usage:** \`!setvoice <name>\` (e.g., \`!setvoice aria\`)`;
  return output;
}

/**
 * Get suggested voices when an invalid name is provided
 */
export function getSuggestions(query: string, limit: number = 3): VoiceInfo[] {
  const lowerQuery = query.toLowerCase();
  return AVAILABLE_VOICES
    .filter(v =>
      v.shortName.toLowerCase().includes(lowerQuery) ||
      v.name.toLowerCase().includes(lowerQuery) ||
      v.description.toLowerCase().includes(lowerQuery)
    )
    .slice(0, limit);
}
