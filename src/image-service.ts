/**
 * Image Generation Service using Pollinations.AI
 * https://pollinations.ai
 *
 * 100% free, no API key required, no signup needed
 * Uses URL-based image generation - Discord fetches the image directly
 */

export interface ImageOptions {
  width?: number;
  height?: number;
  model?: 'flux' | 'turbo' | 'flux-realism' | 'flux-anime' | 'flux-3d';
  seed?: number;
  nologo?: boolean;
}

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt/';

/**
 * Generate a Pollinations image URL for the given prompt
 * Discord will fetch and display the image from this URL
 */
export function generateImageUrl(prompt: string, options: ImageOptions = {}): string {
  const {
    width = 512,
    height = 512,
    model = 'flux',
    nologo = true,
    seed
  } = options;

  const encodedPrompt = encodeURIComponent(prompt.trim());

  let url = `${POLLINATIONS_BASE}${encodedPrompt}?width=${width}&height=${height}&nologo=${nologo}&model=${model}`;

  if (seed !== undefined) {
    url += `&seed=${seed}`;
  }

  return url;
}

/**
 * Check if the image service is available (always true for Pollinations)
 */
export function isImageServiceAvailable(): boolean {
  return true; // Pollinations is always available, no API key needed
}

/**
 * Get available image models
 */
export function getAvailableModels(): string[] {
  return ['flux', 'turbo', 'flux-realism', 'flux-anime', 'flux-3d'];
}
