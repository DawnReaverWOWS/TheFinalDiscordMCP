/**
 * Voice Priority Service
 *
 * Manages creator priority lock for voice commands.
 * When the creator locks the bot, only they can control voice features.
 */

interface VoiceLock {
  lockedBy: string;        // User ID who locked
  lockedAt: Date;
  guildId: string;
  channelId?: string;      // The voice channel the creator is in
}

// Per-guild voice locks
const voiceLocks: Map<string, VoiceLock> = new Map();

/**
 * Get the bot creator's user ID from environment
 */
export function getCreatorId(): string | undefined {
  return process.env.BOT_CREATOR_ID;
}

/**
 * Get the bot creator's display name
 */
export function getCreatorName(): string {
  return process.env.BOT_CREATOR_NAME || 'the Creator';
}

/**
 * Check if a user is the bot creator
 */
export function isCreator(userId: string): boolean {
  const creatorId = getCreatorId();
  return !!creatorId && userId === creatorId;
}

/**
 * Lock voice commands to creator only
 */
export function lockVoice(guildId: string, userId: string, channelId?: string): boolean {
  if (!isCreator(userId)) {
    return false;
  }

  voiceLocks.set(guildId, {
    lockedBy: userId,
    lockedAt: new Date(),
    guildId,
    channelId
  });

  return true;
}

/**
 * Unlock voice commands for everyone
 */
export function unlockVoice(guildId: string, userId: string): boolean {
  // Only creator can unlock
  if (!isCreator(userId)) {
    return false;
  }

  voiceLocks.delete(guildId);
  return true;
}

/**
 * Check if voice is locked in a guild
 */
export function isVoiceLocked(guildId: string): boolean {
  return voiceLocks.has(guildId);
}

/**
 * Get the voice lock info for a guild
 */
export function getVoiceLock(guildId: string): VoiceLock | undefined {
  return voiceLocks.get(guildId);
}

/**
 * Check if a user can use voice commands
 * Returns { allowed: boolean, reason?: string }
 */
export function canUseVoiceCommand(guildId: string, userId: string): { allowed: boolean; reason?: string } {
  const lock = voiceLocks.get(guildId);

  // No lock - everyone can use
  if (!lock) {
    return { allowed: true };
  }

  // Creator always allowed
  if (isCreator(userId)) {
    return { allowed: true };
  }

  // Voice is locked by creator
  return {
    allowed: false,
    reason: `Voice commands are currently locked by ${getCreatorName()}. Only the creator can control the bot right now.`
  };
}

/**
 * Get lock status message
 */
export function getLockStatus(guildId: string): string {
  const lock = voiceLocks.get(guildId);

  if (!lock) {
    return 'Voice commands are unlocked - anyone can control the bot.';
  }

  const duration = Math.floor((Date.now() - lock.lockedAt.getTime()) / 1000 / 60);
  return `Voice locked by ${getCreatorName()} for ${duration} minute(s).`;
}
