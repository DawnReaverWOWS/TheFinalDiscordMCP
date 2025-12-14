/**
 * Security utilities for input validation and sanitization
 */

// Discord snowflake ID regex (17-20 digits)
const SNOWFLAKE_REGEX = /^\d{17,20}$/;

// Allowed URL protocols for audio playback
const ALLOWED_AUDIO_PROTOCOLS = ['https:', 'http:'];
const ALLOWED_AUDIO_DOMAINS = [
  'cdn.discordapp.com',
  'media.discordapp.net',
  'youtube.com',
  'youtu.be',
  'soundcloud.com',
  'spotify.com',
  'open.spotify.com',
];

// SECURITY: Discord CDN domains whitelist for SSRF protection
const DISCORD_CDN_DOMAINS = [
  'cdn.discordapp.com',
  'media.discordapp.net',
  'images-ext-1.discordapp.net',
  'images-ext-2.discordapp.net',
];

// Blocked file paths and patterns
const BLOCKED_PATH_PATTERNS = [
  /\.\./,                    // Directory traversal
  /^\/etc\//i,              // Linux system dirs
  /^\/var\//i,
  /^\/root/i,
  /^\/home\//i,
  /^C:\\Windows/i,          // Windows system dirs
  /^C:\\Users/i,
  /^C:\\Program Files/i,
  /\.env/i,                 // Environment files
  /\.git/i,                 // Git directories
  /node_modules/i,          // Dependencies
  /password/i,
  /secret/i,
  /token/i,
  /credential/i,
  /\.pem$/i,                // Certificate files
  /\.key$/i,
  /\.crt$/i,
];

// Allowed file upload base directories (configure as needed)
const ALLOWED_UPLOAD_DIRS = [
  './uploads',
  './public',
  './assets',
];

export class SecurityUtils {
  /**
   * Validate Discord snowflake ID format
   */
  static isValidSnowflake(id: string): boolean {
    if (!id || typeof id !== 'string') return false;
    return SNOWFLAKE_REGEX.test(id);
  }

  /**
   * Validate and sanitize Discord snowflake ID
   * Returns null if invalid
   */
  static sanitizeSnowflake(id: string | undefined): string | null {
    if (!id) return null;
    // Remove any Discord mention formatting
    const cleaned = id.replace(/[<@#&!>]/g, '').trim();
    return this.isValidSnowflake(cleaned) ? cleaned : null;
  }

  /**
   * Validate URL for audio playback (prevent SSRF)
   */
  static isValidAudioUrl(url: string): { valid: boolean; reason?: string } {
    try {
      const parsed = new URL(url);

      // Check protocol
      if (!ALLOWED_AUDIO_PROTOCOLS.includes(parsed.protocol)) {
        return { valid: false, reason: 'Invalid protocol. Only HTTP/HTTPS allowed.' };
      }

      // Check for localhost/private IP ranges
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.endsWith('.local')
      ) {
        return { valid: false, reason: 'Private/local URLs not allowed.' };
      }

      // Warn if domain not in whitelist (but allow)
      const isWhitelisted = ALLOWED_AUDIO_DOMAINS.some(domain =>
        hostname === domain || hostname.endsWith('.' + domain)
      );

      return {
        valid: true,
        reason: isWhitelisted ? undefined : 'Domain not in trusted list. Proceed with caution.'
      };
    } catch {
      return { valid: false, reason: 'Invalid URL format.' };
    }
  }

  /**
   * Validate file path for upload (prevent path traversal)
   */
  static isValidFilePath(filePath: string): { valid: boolean; reason?: string } {
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, reason: 'Invalid file path.' };
    }

    // Normalize the path
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();

    // Check for blocked patterns
    for (const pattern of BLOCKED_PATH_PATTERNS) {
      if (pattern.test(normalizedPath) || pattern.test(filePath)) {
        return { valid: false, reason: 'Access to this path is not allowed.' };
      }
    }

    // Check if path is within allowed directories
    const isInAllowedDir = ALLOWED_UPLOAD_DIRS.some(dir =>
      normalizedPath.startsWith(dir.replace(/\\/g, '/').toLowerCase())
    );

    if (!isInAllowedDir) {
      return {
        valid: false,
        reason: `File must be in one of: ${ALLOWED_UPLOAD_DIRS.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Sanitize error messages for user display
   * Removes sensitive information like paths and tokens
   */
  static sanitizeErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'An unexpected error occurred.';
    }

    let message = error.message;

    // Remove file paths
    message = message.replace(/[A-Za-z]:\\[^:]+/g, '[path]');
    message = message.replace(/\/[^\s:]+\/[^\s:]+/g, '[path]');

    // Remove potential tokens/secrets
    message = message.replace(/[A-Za-z0-9_-]{50,}/g, '[redacted]');
    message = message.replace(/token[=:]\s*\S+/gi, 'token=[redacted]');

    // Remove stack traces
    message = message.replace(/\s+at\s+.+/g, '');

    // Limit length
    if (message.length > 200) {
      message = message.substring(0, 200) + '...';
    }

    return message || 'An error occurred while processing your request.';
  }

  /**
   * Validate command input arguments
   */
  static sanitizeCommandArgs(args: string[]): string[] {
    return args.map(arg => {
      // Remove any null bytes or control characters
      return arg.replace(/[\x00-\x1F\x7F]/g, '').trim();
    }).filter(arg => arg.length > 0);
  }

  /**
   * Check if a URL is a webhook URL (contains token)
   */
  static isWebhookUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'discord.com' &&
             parsed.pathname.includes('/api/webhooks/');
    } catch {
      return false;
    }
  }

  /**
   * Rate limiter for commands
   */
  private static commandCooldowns = new Map<string, Map<string, number>>();

  static checkCooldown(userId: string, command: string, cooldownMs: number = 3000): {
    allowed: boolean;
    remainingMs?: number
  } {
    const now = Date.now();

    if (!this.commandCooldowns.has(command)) {
      this.commandCooldowns.set(command, new Map());
    }

    const commandCooldown = this.commandCooldowns.get(command)!;
    const lastUsed = commandCooldown.get(userId) || 0;
    const elapsed = now - lastUsed;

    if (elapsed < cooldownMs) {
      return { allowed: false, remainingMs: cooldownMs - elapsed };
    }

    commandCooldown.set(userId, now);

    // Clean up old entries periodically
    if (commandCooldown.size > 1000) {
      const cutoff = now - 60000; // 1 minute ago
      for (const [uid, time] of commandCooldown) {
        if (time < cutoff) commandCooldown.delete(uid);
      }
    }

    return { allowed: true };
  }

  /**
   * Validate timeout duration
   */
  static validateTimeoutDuration(seconds: number): { valid: boolean; reason?: string; clampedValue?: number } {
    const maxTimeout = 28 * 24 * 60 * 60; // 28 days in seconds
    const minTimeout = 1;

    if (seconds < minTimeout) {
      return { valid: false, reason: 'Timeout must be at least 1 second.' };
    }

    if (seconds > maxTimeout) {
      return {
        valid: true,
        reason: `Timeout clamped to maximum of 28 days.`,
        clampedValue: maxTimeout
      };
    }

    return { valid: true, clampedValue: seconds };
  }

  /**
   * Check if message is too old for bulk delete (14 days)
   */
  static isMessageTooOldForBulkDelete(messageId: string): boolean {
    try {
      // Discord snowflake contains timestamp
      // First 42 bits are timestamp (ms since Discord epoch: 2015-01-01)
      const discordEpoch = 1420070400000n;
      const timestamp = (BigInt(messageId) >> 22n) + discordEpoch;
      const messageAge = Date.now() - Number(timestamp);
      const fourteenDays = 14 * 24 * 60 * 60 * 1000;
      return messageAge > fourteenDays;
    } catch {
      return true; // Assume too old if we can't parse
    }
  }

  /**
   * Sanitize user content for safe display in responses
   * Escapes Discord markdown and mentions to prevent injection
   */
  static sanitizeUserContent(content: string, options?: {
    maxLength?: number;
    escapeMarkdown?: boolean;
    escapeMentions?: boolean;
  }): string {
    if (!content || typeof content !== 'string') return '';

    const opts = {
      maxLength: options?.maxLength ?? 1000,
      escapeMarkdown: options?.escapeMarkdown ?? true,
      escapeMentions: options?.escapeMentions ?? true,
    };

    let sanitized = content;

    // Escape Discord mentions to prevent pinging
    if (opts.escapeMentions) {
      sanitized = sanitized
        .replace(/@everyone/gi, '@\u200Beveryone')
        .replace(/@here/gi, '@\u200Bhere')
        .replace(/<@!?(\d+)>/g, '<@\u200B$1>')      // User mentions
        .replace(/<@&(\d+)>/g, '<@\u200B&$1>')      // Role mentions
        .replace(/<#(\d+)>/g, '<#\u200B$1>');       // Channel mentions
    }

    // Escape markdown characters
    if (opts.escapeMarkdown) {
      sanitized = sanitized.replace(/([*_~`|\\])/g, '\\$1');
    }

    // Truncate to max length
    if (sanitized.length > opts.maxLength) {
      sanitized = sanitized.substring(0, opts.maxLength - 3) + '...';
    }

    return sanitized;
  }

  /**
   * SECURITY: Validate URL is from Discord CDN to prevent SSRF attacks
   * Only allows fetching from trusted Discord domains
   */
  static isValidDiscordCdnUrl(url: string): { valid: boolean; reason?: string } {
    try {
      const parsed = new URL(url);

      // Only allow HTTPS for Discord CDN
      if (parsed.protocol !== 'https:') {
        return { valid: false, reason: 'Only HTTPS URLs are allowed for Discord CDN.' };
      }

      // Check hostname against Discord CDN whitelist
      const hostname = parsed.hostname.toLowerCase();
      const isDiscordCdn = DISCORD_CDN_DOMAINS.some(domain =>
        hostname === domain || hostname.endsWith('.' + domain)
      );

      if (!isDiscordCdn) {
        return {
          valid: false,
          reason: `URL must be from Discord CDN. Allowed domains: ${DISCORD_CDN_DOMAINS.join(', ')}`
        };
      }

      // Block any private/internal IPs that might be disguised
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.endsWith('.local')
      ) {
        return { valid: false, reason: 'Private/local URLs not allowed.' };
      }

      return { valid: true };
    } catch {
      return { valid: false, reason: 'Invalid URL format.' };
    }
  }

  /**
   * SECURITY: Sanitize and validate Discord CDN URL for safe fetching
   * Returns the sanitized URL if valid, null otherwise
   * This breaks the taint chain by reconstructing the URL from validated components
   */
  static sanitizeDiscordCdnUrl(url: string): string | null {
    try {
      const parsed = new URL(url);

      // Only allow HTTPS
      if (parsed.protocol !== 'https:') {
        return null;
      }

      // Validate hostname against Discord CDN whitelist
      const hostname = parsed.hostname.toLowerCase();
      const isDiscordCdn = DISCORD_CDN_DOMAINS.some(domain =>
        hostname === domain || hostname.endsWith('.' + domain)
      );

      if (!isDiscordCdn) {
        return null;
      }

      // Block private/internal IPs
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.endsWith('.local')
      ) {
        return null;
      }

      // SECURITY: Validate pathname matches Discord CDN attachment pattern
      // Discord CDN paths follow: /attachments/{channelId}/{attachmentId}/{filename}
      // or /ephemeral-attachments/{...} or /icons/{...} or /avatars/{...}
      const validPathPatterns = [
        /^\/attachments\/\d+\/\d+\/[^\/]+$/,
        /^\/ephemeral-attachments\/\d+\/\d+\/[^\/]+$/,
        /^\/icons\/\d+\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|gif|webp)$/,
        /^\/avatars\/\d+\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|gif|webp)$/,
        /^\/emojis\/\d+\.(png|gif|webp)$/,
        /^\/stickers\/\d+\.(png|gif|webp|json)$/,
      ];

      const pathIsValid = validPathPatterns.some(pattern => pattern.test(parsed.pathname));
      if (!pathIsValid) {
        return null;
      }

      // Reconstruct URL from validated components to break taint chain
      // Use only the validated hostname and pathname (no query string for extra safety)
      const safeHostname = DISCORD_CDN_DOMAINS.find(domain =>
        hostname === domain || hostname.endsWith('.' + domain)
      ) || hostname;

      return `https://${safeHostname}${parsed.pathname}`;
    } catch {
      return null;
    }
  }

  /**
   * Validate Discord intents are properly configured
   */
  static validateIntents(intents: number[], requiredIntents: string[]): { valid: boolean; missing: string[] } {
    // Map of intent names to their bit values
    const intentBits: Record<string, number> = {
      'Guilds': 1 << 0,
      'GuildMembers': 1 << 1,
      'GuildModeration': 1 << 2,
      'GuildEmojisAndStickers': 1 << 3,
      'GuildIntegrations': 1 << 4,
      'GuildWebhooks': 1 << 5,
      'GuildInvites': 1 << 6,
      'GuildVoiceStates': 1 << 7,
      'GuildPresences': 1 << 8,
      'GuildMessages': 1 << 9,
      'GuildMessageReactions': 1 << 10,
      'GuildMessageTyping': 1 << 11,
      'DirectMessages': 1 << 12,
      'DirectMessageReactions': 1 << 13,
      'DirectMessageTyping': 1 << 14,
      'MessageContent': 1 << 15,
      'GuildScheduledEvents': 1 << 16,
    };

    const combinedIntents = intents.reduce((a, b) => a | b, 0);
    const missing: string[] = [];

    for (const intent of requiredIntents) {
      const bit = intentBits[intent];
      if (bit && !(combinedIntents & bit)) {
        missing.push(intent);
      }
    }

    return { valid: missing.length === 0, missing };
  }
}

// Command cooldown defaults (in milliseconds)
export const COMMAND_COOLDOWNS: Record<string, number> = {
  // High-impact commands - longer cooldown
  'prune': 60000,           // 1 minute
  'bulkdelete': 10000,      // 10 seconds
  'createinvite': 10000,
  'exportchat': 30000,      // 30 seconds

  // Moderate commands
  'ban': 5000,
  'kick': 5000,
  'timeout': 5000,
  'createchannel': 5000,
  'deletechannel': 5000,
  'createrole': 5000,
  'deleterole': 5000,

  // Standard commands
  'default': 3000,          // 3 seconds

  // Fast commands
  'ping': 1000,
  'help': 2000,
};
