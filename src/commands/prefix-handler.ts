import { Message, PermissionFlagsBits, TextChannel, PermissionResolvable, EmbedBuilder } from 'discord.js';
import { DiscordService } from '../discord-service.js';
import { SecurityUtils, COMMAND_COOLDOWNS } from '../core/SecurityUtils.js';
import { getAIService, type OnRetryCallback } from '../ai-service.js';
import { generateImageUrl, getAvailableModels } from '../image-service.js';
import {
  isCreator,
  getCreatorName,
  lockVoice,
  unlockVoice,
  isVoiceLocked,
  canUseVoiceCommand,
  getLockStatus
} from '../voice-priority.js';
import {
  getGuildVoice,
  getGuildVoiceInfo,
  setGuildVoice,
  findVoice,
  formatVoiceList,
  getSuggestions,
  AVAILABLE_VOICES
} from '../voice-settings.js';
import { musicService } from '../services/music-service.js';
import {
  getFullPlayerInfo,
  getFullClanInfo,
  searchPlayerSuggestions,
  searchClanSuggestions,
  getPlayerShipsFormatted,
  formatTier,
  searchPlayer
} from '../services/wargaming-api.js';

const PREFIX = '!';

// Granular permission mapping - each command requires specific permissions
const COMMAND_PERMISSIONS: Record<string, PermissionResolvable[]> = {
  // Channel management - requires ManageChannels
  'createchannel': [PermissionFlagsBits.ManageChannels],
  'deletechannel': [PermissionFlagsBits.ManageChannels],
  'editchannel': [PermissionFlagsBits.ManageChannels],
  'createvoice': [PermissionFlagsBits.ManageChannels],
  'createforum': [PermissionFlagsBits.ManageChannels],
  'createannouncement': [PermissionFlagsBits.ManageChannels],
  'createstage': [PermissionFlagsBits.ManageChannels],
  'createcategory': [PermissionFlagsBits.ManageChannels],
  'deletecategory': [PermissionFlagsBits.ManageChannels],
  'setchannelposition': [PermissionFlagsBits.ManageChannels],
  'setchannelpositions': [PermissionFlagsBits.ManageChannels],
  'movechannel': [PermissionFlagsBits.ManageChannels],
  'organize': [PermissionFlagsBits.ManageChannels],
  'setcategoryprivate': [PermissionFlagsBits.ManageChannels],
  'setchannelprivate': [PermissionFlagsBits.ManageChannels],
  'bulkprivacy': [PermissionFlagsBits.ManageChannels],
  'channelmanagement': [PermissionFlagsBits.ManageChannels],
  'setchannelperms': [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles],
  'syncchannelperms': [PermissionFlagsBits.ManageChannels],

  // Role management - requires ManageRoles
  'createrole': [PermissionFlagsBits.ManageRoles],
  'deleterole': [PermissionFlagsBits.ManageRoles],
  'editrole': [PermissionFlagsBits.ManageRoles],
  'setrolepositions': [PermissionFlagsBits.ManageRoles],
  'setcategoryposition': [PermissionFlagsBits.ManageRoles],
  'addrole': [PermissionFlagsBits.ManageRoles],
  'removerole': [PermissionFlagsBits.ManageRoles],

  // Server settings - requires ManageGuild
  'editserver': [PermissionFlagsBits.ManageGuild],
  'editwelcome': [PermissionFlagsBits.ManageGuild],
  'setwidget': [PermissionFlagsBits.ManageGuild],
  'widgetsettings': [PermissionFlagsBits.ManageGuild],
  'prune': [PermissionFlagsBits.KickMembers],
  'previewprune': [PermissionFlagsBits.KickMembers],

  // Automod - requires ManageGuild
  'automod': [PermissionFlagsBits.ManageGuild],
  'createautomod': [PermissionFlagsBits.ManageGuild],
  'editautomod': [PermissionFlagsBits.ManageGuild],
  'deleteautomod': [PermissionFlagsBits.ManageGuild],

  // Emoji/Sticker - requires ManageEmojisAndStickers
  'createemoji': [PermissionFlagsBits.ManageGuildExpressions],
  'deleteemoji': [PermissionFlagsBits.ManageGuildExpressions],
  'createsticker': [PermissionFlagsBits.ManageGuildExpressions],
  'deletesticker': [PermissionFlagsBits.ManageGuildExpressions],

  // Webhooks - requires ManageWebhooks
  'createwebhook': [PermissionFlagsBits.ManageWebhooks],
  'deletewebhook': [PermissionFlagsBits.ManageWebhooks],
  'webhooksend': [PermissionFlagsBits.ManageWebhooks],

  // Templates - requires ManageGuild
  'createtemplate': [PermissionFlagsBits.ManageGuild],
  'synctemplate': [PermissionFlagsBits.ManageGuild],
  'deletetemplate': [PermissionFlagsBits.ManageGuild],

  // Member moderation - specific permissions
  'kick': [PermissionFlagsBits.KickMembers],
  'ban': [PermissionFlagsBits.BanMembers],
  'unban': [PermissionFlagsBits.BanMembers],
  'timeout': [PermissionFlagsBits.ModerateMembers],
  'removetimeout': [PermissionFlagsBits.ModerateMembers],
  'editmember': [PermissionFlagsBits.ManageNicknames],

  // Message moderation - requires ManageMessages
  'bulkdelete': [PermissionFlagsBits.ManageMessages],
  'purge': [PermissionFlagsBits.ManageMessages],
  'pin': [PermissionFlagsBits.ManageMessages],
  'unpin': [PermissionFlagsBits.ManageMessages],
  'clearreactions': [PermissionFlagsBits.ManageMessages],
  'clearemoji': [PermissionFlagsBits.ManageMessages],

  // Threads - requires ManageThreads
  'createthread': [PermissionFlagsBits.CreatePublicThreads],
  'archivethread': [PermissionFlagsBits.ManageThreads],
  'lockthread': [PermissionFlagsBits.ManageThreads],
  'unlockthread': [PermissionFlagsBits.ManageThreads],
  'addthreadmember': [PermissionFlagsBits.ManageThreads],
  'removethreadmember': [PermissionFlagsBits.ManageThreads],

  // Logs - requires ViewAuditLog
  'auditlog': [PermissionFlagsBits.ViewAuditLog],
  'bans': [PermissionFlagsBits.BanMembers],

  // Invites
  'createinvite': [PermissionFlagsBits.CreateInstantInvite],
  'deleteinvite': [PermissionFlagsBits.ManageGuild],
  'crosspost': [PermissionFlagsBits.ManageMessages],

  // Interactive components - requires ManageGuild
  'button': [PermissionFlagsBits.ManageGuild],
  'selectmenu': [PermissionFlagsBits.ManageGuild],
};

// Commands that require Administrator (fallback for unmapped admin commands)
const ADMIN_ONLY_COMMANDS = [
  'editserver', 'editwelcome', 'setwidget', 'widgetsettings',
  'createtemplate', 'synctemplate', 'deletetemplate',
  'button', 'selectmenu'
];

// ============================================
// SECURITY TIERS - Command Restrictions
// ============================================

// TIER 1: Commands that ONLY the bot owner can use
// These are the most dangerous/destructive commands
const BOT_OWNER_ONLY_COMMANDS = [
  // Role management (can break server hierarchy)
  'createrole',           // Creating roles with permissions
  'deleterole',           // Deleting roles
  'editrole',             // Editing role name/color/permissions
  'setrolepositions',     // Changing role hierarchy

  // Server-wide destructive actions
  'prune',                // Mass-kick inactive members (EXTREMELY DANGEROUS)
  'editserver',           // Change server name/icon/settings

  // Automod (can break server moderation)
  'createautomod',        // Create automod rules
  'editautomod',          // Edit automod rules
  'deleteautomod',        // Delete automod rules

  // Templates (can affect server structure)
  'createtemplate',       // Create server templates
  'synctemplate',         // Sync templates
  'deletetemplate',       // Delete templates

  // Mass operations
  'bulkprivacy',          // Mass change channel privacy
  'organize',             // Mass organize channels
  'setchannelpositions',  // Mass reorder channels
];

// TIER 2: Commands restricted to Admins (requires Administrator permission)
const ADMIN_REQUIRED_COMMANDS = [
  // Channel destruction/creation
  'deletechannel',        // Delete channels
  'deletecategory',       // Delete categories
  'createchannel',        // Create text channels
  'createvoice',          // Create voice channels
  'createforum',          // Create forum channels
  'createannouncement',   // Create announcement channels
  'createstage',          // Create stage channels
  'createcategory',       // Create categories

  // Channel management
  'editchannel',          // Edit channel settings
  'setchannelposition',   // Move single channel
  'movechannel',          // Move channel to category
  'setchannelprivate',    // Make channel private
  'setcategoryprivate',   // Make category private
  'setchannelperms',      // Set channel permissions
  'channelperms',         // View/edit channel permissions
  'syncchannelperms',     // Sync channel permissions

  // Webhook management (can be used for impersonation)
  'createwebhook',        // Create webhooks
  'deletewebhook',        // Delete webhooks

  // Server assets
  'createemoji',          // Create emojis
  'deleteemoji',          // Delete emojis
  'createsticker',        // Create stickers
  'deletesticker',        // Delete stickers

  // Events
  'createevent',          // Create server events
  'deleteevent',          // Delete events
  'editevent',            // Edit events

  // Invites management
  'deleteinvite',         // Delete invites

  // Server settings
  'editwelcome',          // Edit welcome screen
  'setwidget',            // Set widget settings
  'button',               // Create interactive buttons
  'selectmenu',           // Create select menus
];

// TIER 3: Commands restricted to Moderators (Kick/Ban/ManageMessages permissions)
const MOD_REQUIRED_COMMANDS = [
  // Member moderation
  'kick',                 // Kick members
  'ban',                  // Ban members
  'unban',                // Unban members
  'timeout',              // Timeout members
  'removetimeout',        // Remove timeout
  'untimeout',            // Alias for removetimeout
  'editmember',           // Edit member nickname

  // Message moderation
  'bulkdelete',           // Mass delete messages
  'purge',                // Alias for bulkdelete
  'clearreactions',       // Clear all reactions
  'clearemoji',           // Clear specific emoji reactions

  // Thread moderation
  'lockthread',           // Lock threads
  'unlockthread',         // Unlock threads
  'archivethread',        // Archive threads

  // Audit/logs access
  'auditlog',             // View audit logs
  'audit',                // Alias for auditlog
  'bans',                 // View ban list
  'getban',               // Get specific ban info
];

// TIER 4: Disabled by default (high abuse potential)
// These commands are COMPLETELY DISABLED unless bot owner enables them
const DISABLED_BY_DEFAULT_COMMANDS = [
  // DM commands (harassment potential)
  'dm',                   // Send DMs
  'editdm',               // Edit DM messages
  'deletedm',             // Delete DM messages
  'readdms',              // Read DM history

  // Message manipulation in channels
  'send',                 // Send messages as bot
  'edit',                 // Edit bot messages
  'delete',               // Delete messages
  'webhooksend',          // Send via webhook (impersonation)

  // Data export
  'exportchat',           // Export chat history
];

// Commands that only Commander or Executive Officer (XO/Co-Commander) can use
// These are Discord role names to check for - case insensitive
const COMMANDER_ROLE_NAMES = ['commander', 'co-commander', 'executive officer', 'xo', 'clan leader', 'deputy commander'];

// Role assignment commands restricted to Commander/XO only
const COMMANDER_ONLY_COMMANDS = [
  'addrole',    // Assigning roles to members
  'removerole'  // Removing roles from members
];

export class PrefixCommandHandler {
  private discordService: DiscordService;
  private breadHistory: Map<string, number[]> = new Map();

  constructor(discordService: DiscordService) {
    this.discordService = discordService;
  }

  async handleMessage(message: Message): Promise<void> {
    // Ignore bots
    if (message.author.bot) return;

    // Handle DMs - respond with AI automatically (no prefix needed)
    if (message.channel.isDMBased()) {
      await this.handleMention(message);
      return;
    }

    // Check if bot was mentioned
    const botMentioned = message.mentions.has(message.client.user!);
    if (botMentioned && !message.content.startsWith(PREFIX)) {
      await this.handleMention(message);
      return;
    }

    // Handle prefix commands
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    if (!command) return;

    // Rate limiting / cooldown check
    const cooldownMs = COMMAND_COOLDOWNS[command] || COMMAND_COOLDOWNS['default'];
    const cooldownCheck = SecurityUtils.checkCooldown(message.author.id, command, cooldownMs);
    if (!cooldownCheck.allowed) {
      const remainingSec = Math.ceil((cooldownCheck.remainingMs || 0) / 1000);
      await message.reply(`Please wait ${remainingSec}s before using this command again.`);
      return;
    }

    // Sanitize command arguments
    const sanitizedArgs = SecurityUtils.sanitizeCommandArgs(args);

    // Permission check
    const permissionResult = this.checkPermission(message, command);
    if (!permissionResult.allowed) {
      await message.reply(permissionResult.reason || 'You do not have permission to use this command.');
      return;
    }

    try {
      await this.executeCommand(message, command, sanitizedArgs);
    } catch (error) {
      console.error(`Command error [${command}]:`, error);
      // Sanitize error message to prevent information disclosure
      const safeMessage = SecurityUtils.sanitizeErrorMessage(error);
      await message.reply(`Error: ${safeMessage}`);
    }
  }

  private checkPermission(message: Message, command: string): { allowed: boolean; reason?: string } {
    const member = message.member;
    if (!member) return { allowed: false, reason: 'Could not verify your server membership.' };

    const userId = message.author.id;
    const botOwnerId = process.env.BOT_OWNER_ID;
    const isOwner = botOwnerId && userId === botOwnerId;
    const isServerOwner = message.guild?.ownerId === userId;

    // ============================================
    // TIER 4: DISABLED BY DEFAULT
    // These commands are completely disabled unless owner enables them
    // ============================================
    if (DISABLED_BY_DEFAULT_COMMANDS.includes(command)) {
      // Only bot owner can use these (effectively disabled for everyone else)
      if (!isOwner) {
        return {
          allowed: false,
          reason: '🚫 **This command is disabled for security reasons.**\nDM, message manipulation, and export commands are restricted to prevent abuse.'
        };
      }
      return { allowed: true };
    }

    // ============================================
    // TIER 1: BOT OWNER ONLY
    // Most dangerous/destructive commands
    // ============================================
    if (BOT_OWNER_ONLY_COMMANDS.includes(command)) {
      if (!isOwner) {
        return {
          allowed: false,
          reason: '🔒 **This command is restricted to the bot owner only.**\nThis includes role management, server-wide changes, automod, templates, and mass operations.'
        };
      }
      return { allowed: true };
    }

    // ============================================
    // TIER 2: ADMIN REQUIRED
    // Requires Discord Administrator permission
    // ============================================
    if (ADMIN_REQUIRED_COMMANDS.includes(command)) {
      if (isOwner) return { allowed: true };

      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return {
          allowed: false,
          reason: '🔒 **This command requires Administrator permission.**\nChannel management, webhooks, server assets, and events require admin access.'
        };
      }
      return { allowed: true };
    }

    // ============================================
    // TIER 3: MODERATOR REQUIRED
    // Requires moderation permissions (Kick/Ban/ManageMessages)
    // ============================================
    if (MOD_REQUIRED_COMMANDS.includes(command)) {
      if (isOwner) return { allowed: true };

      // Check for any moderation permission
      const hasModPerms = member.permissions.has(PermissionFlagsBits.KickMembers) ||
                          member.permissions.has(PermissionFlagsBits.BanMembers) ||
                          member.permissions.has(PermissionFlagsBits.ManageMessages) ||
                          member.permissions.has(PermissionFlagsBits.ModerateMembers);

      if (!hasModPerms) {
        return {
          allowed: false,
          reason: '🔒 **This command requires Moderator permissions.**\nYou need Kick Members, Ban Members, Moderate Members, or Manage Messages permission.'
        };
      }
      return { allowed: true };
    }

    // ============================================
    // COMMANDER/XO ONLY (Role Assignment)
    // ============================================
    if (COMMANDER_ONLY_COMMANDS.includes(command)) {
      if (isOwner) return { allowed: true };

      // Check if user has a Commander or XO role
      const hasCommanderRole = member.roles.cache.some(role =>
        COMMANDER_ROLE_NAMES.some(name =>
          role.name.toLowerCase().includes(name.toLowerCase())
        )
      );

      if (!hasCommanderRole && !isServerOwner) {
        return {
          allowed: false,
          reason: '🔒 **Role assignment is restricted to Commanders and Executive Officers only.**\nYou need a Commander, Co-Commander, or Executive Officer role to assign or remove roles from members.'
        };
      }
      return { allowed: true };
    }

    // ============================================
    // GRANULAR DISCORD PERMISSIONS
    // Commands mapped to specific Discord permissions
    // ============================================
    const requiredPerms = COMMAND_PERMISSIONS[command];
    if (requiredPerms && requiredPerms.length > 0) {
      if (isOwner) return { allowed: true };

      const hasPerms = requiredPerms.every(perm => member.permissions.has(perm));
      if (!hasPerms) {
        return {
          allowed: false,
          reason: '❌ You do not have the required Discord permissions for this command.'
        };
      }
      return { allowed: true };
    }

    // ============================================
    // LEGACY ADMIN-ONLY COMMANDS FALLBACK
    // ============================================
    if (ADMIN_ONLY_COMMANDS.includes(command)) {
      if (isOwner) return { allowed: true };

      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return {
          allowed: false,
          reason: '🔒 This command requires Administrator permission.'
        };
      }
      return { allowed: true };
    }

    // ============================================
    // SAFE COMMANDS - Everyone can use
    // ============================================
    return { allowed: true };
  }

  private async executeCommand(message: Message, command: string, args: string[]): Promise<void> {
    const guildId = message.guildId!;

    switch (command) {
      // ============================================
      // SERVER INFO
      // ============================================
      case 'serverinfo':
      case 'server': {
        const info = await this.discordService.getServerInfo(guildId);
        await message.reply(`\`\`\`\n${info}\n\`\`\``);
        break;
      }

      case 'serverstats':
      case 'stats': {
        const result = await this.discordService.getServerStats(guildId);
        await message.reply(`\`\`\`\n${result}\n\`\`\``);
        break;
      }

      case 'up':
      case 'uptime': {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        parts.push(`${seconds}s`);
        await message.reply(`🟢 Bot uptime: **${parts.join(' ')}**`);
        break;
      }

      case 'widget': {
        const result = await this.discordService.getServerWidget(guildId);
        await message.reply(`\`\`\`\n${result}\n\`\`\``);
        break;
      }

      case 'welcomescreen': {
        const result = await this.discordService.getWelcomeScreen(guildId);
        await message.reply(`\`\`\`\n${result}\n\`\`\``);
        break;
      }

      case 'structure': {
        const result = await this.discordService.getChannelStructure(guildId);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      // ============================================
      // WORLD OF WARSHIPS
      // ============================================
      case 'wows':
      case 'player':
      case 'lookup': {
        const playerName = args.join(' ');
        if (!playerName) {
          await message.reply('Usage: `!wows <player_name>` - Search for a World of Warships player\nExample: `!wows amutantcow`');
          return;
        }

        if ('sendTyping' in message.channel) {
          await message.channel.sendTyping();
        }

        try {
          const playerInfo = await getFullPlayerInfo(playerName);

          if (!playerInfo) {
            // Try to find suggestions
            const suggestions = await searchPlayerSuggestions(playerName, 5);
            if (suggestions.length > 0) {
              await message.reply(`❌ Player "${playerName}" not found.\n\n**Did you mean:**\n${suggestions.map(s => `• ${s}`).join('\n')}`);
            } else {
              await message.reply(`❌ Player "${playerName}" not found on NA server.`);
            }
            return;
          }

          if (playerInfo.hiddenProfile) {
            let response = `🔒 **${playerInfo.nickname}** (Profile Hidden)`;
            if (playerInfo.clan) {
              response += `\n**Clan:** [${playerInfo.clan.tag}] ${playerInfo.clan.name}`;
            }
            await message.reply(response);
            return;
          }

          // Format the stats nicely
          const prEmoji = playerInfo.pr >= 2100 ? '🟣' : playerInfo.pr >= 1750 ? '🔵' : playerInfo.pr >= 1400 ? '🟢' : playerInfo.pr >= 1100 ? '🟡' : '🔴';

          let response = `**${playerInfo.nickname}** - World of Warships Stats\n`;
          if (playerInfo.clan) {
            response += `**Clan:** [${playerInfo.clan.tag}] ${playerInfo.clan.name}\n`;
          }
          response += `\n`;
          response += `⚔️ **Battles:** ${playerInfo.battles.toLocaleString()}\n`;
          response += `🏆 **Win Rate:** ${playerInfo.winRate}%\n`;
          response += `💥 **Avg Damage:** ${playerInfo.avgDamage.toLocaleString()}\n`;
          response += `🎯 **Avg Frags:** ${playerInfo.avgFrags}\n`;
          response += `❤️ **Survival:** ${playerInfo.survivalRate}%\n`;
          response += `${prEmoji} **PR:** ${playerInfo.pr.toLocaleString()} (${playerInfo.prRating})`;

          if (playerInfo.lastBattle) {
            const lastBattleDate = new Date(playerInfo.lastBattle * 1000);
            response += `\n📅 **Last Battle:** ${lastBattleDate.toLocaleDateString()}`;
          }

          await message.reply(response);
        } catch (error) {
          console.error('WoWS player lookup error:', error);
          await message.reply(`❌ Error looking up player: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        break;
      }

      case 'clan':
      case 'claninfo':
      case 'clanlookup': {
        const clanQuery = args.join(' ');
        if (!clanQuery) {
          await message.reply('Usage: `!clan <tag or name>` - Search for a World of Warships clan\nExample: `!clan DROVA` or `!clan Dawn Reavers`');
          return;
        }

        if ('sendTyping' in message.channel) {
          await message.channel.sendTyping();
        }

        try {
          // Fetch clan info WITH members list
          const clanInfo = await getFullClanInfo(clanQuery, true);

          if (!clanInfo) {
            // Try to find suggestions
            const suggestions = await searchClanSuggestions(clanQuery, 5);
            if (suggestions.length > 0) {
              await message.reply(`❌ Clan "${clanQuery}" not found.\n\n**Did you mean:**\n${suggestions.map(s => `• ${s}`).join('\n')}`);
            } else {
              await message.reply(`❌ Clan "${clanQuery}" not found on NA server.`);
            }
            return;
          }

          if (clanInfo.isDisbanded) {
            await message.reply(`💀 **[${clanInfo.tag}] ${clanInfo.name}** - This clan has been disbanded.`);
            return;
          }

          // Build main clan info embed
          const mainEmbed = new EmbedBuilder()
            .setColor(0x1E90FF)
            .setTitle(`[${clanInfo.tag}] ${clanInfo.name}`)
            .setURL(`https://wows-numbers.com/clan/${clanInfo.clanId},${clanInfo.tag}/`);

          if (clanInfo.description) {
            mainEmbed.setDescription(clanInfo.description.substring(0, 300) + (clanInfo.description.length > 300 ? '...' : ''));
          }

          const createdDate = new Date(clanInfo.createdAt * 1000);
          let infoText = `👥 **Members:** ${clanInfo.membersCount}\n`;
          infoText += `👑 **Leader:** ${clanInfo.leaderName}\n`;
          infoText += `🎖️ **Creator:** ${clanInfo.creatorName}\n`;
          infoText += `📅 **Created:** ${createdDate.toLocaleDateString()}`;

          if (clanInfo.oldTag || clanInfo.oldName) {
            infoText += `\n📜 **Formerly:** [${clanInfo.oldTag || clanInfo.tag}] ${clanInfo.oldName || clanInfo.name}`;
          }

          mainEmbed.addFields({ name: 'Clan Info', value: infoText });

          // Build member list
          if (clanInfo.members && clanInfo.members.length > 0) {
            // Role emoji mapping
            const roleEmoji: Record<string, string> = {
              'commander': '👑',
              'executive_officer': '⭐',
              'recruitment_officer': '📋',
              'commissioned_officer': '🎖️',
              'officer': '⚔️',
              'private': '👤'
            };

            const roleNames: Record<string, string> = {
              'commander': 'Commander',
              'executive_officer': 'Executive Officer',
              'recruitment_officer': 'Recruitment Officer',
              'commissioned_officer': 'Commissioned Officer',
              'officer': 'Officer',
              'private': 'Member'
            };

            // Group members by role
            const membersByRole: Record<string, string[]> = {};
            for (const member of clanInfo.members) {
              const role = member.role || 'private';
              if (!membersByRole[role]) {
                membersByRole[role] = [];
              }
              membersByRole[role].push(member.nickname);
            }

            // Build member list string (sorted by role priority)
            const roleOrder = ['commander', 'executive_officer', 'recruitment_officer', 'commissioned_officer', 'officer', 'private'];
            let memberList = '';

            for (const role of roleOrder) {
              if (membersByRole[role] && membersByRole[role].length > 0) {
                const emoji = roleEmoji[role] || '👤';
                const roleName = roleNames[role] || role;
                const members = membersByRole[role].join(', ');
                memberList += `${emoji} **${roleName}${membersByRole[role].length > 1 ? 's' : ''}:** ${members}\n`;
              }
            }

            // Discord embed field limit is 1024 chars
            if (memberList.length > 1024) {
              // Split into multiple fields if too long
              const chunks: string[] = [];
              let currentChunk = '';

              for (const role of roleOrder) {
                if (membersByRole[role] && membersByRole[role].length > 0) {
                  const emoji = roleEmoji[role] || '👤';
                  const roleName = roleNames[role] || role;
                  const members = membersByRole[role].join(', ');
                  const line = `${emoji} **${roleName}${membersByRole[role].length > 1 ? 's' : ''}:** ${members}\n`;

                  if (currentChunk.length + line.length > 1000) {
                    if (currentChunk) chunks.push(currentChunk);
                    currentChunk = line;
                  } else {
                    currentChunk += line;
                  }
                }
              }
              if (currentChunk) chunks.push(currentChunk);

              // Add as multiple fields
              chunks.forEach((chunk, i) => {
                mainEmbed.addFields({
                  name: i === 0 ? `Roster (${clanInfo.membersCount})` : '​', // Zero-width space for continuation
                  value: chunk
                });
              });
            } else {
              mainEmbed.addFields({
                name: `Roster (${clanInfo.membersCount})`,
                value: memberList || 'No members found'
              });
            }
          }

          mainEmbed.setFooter({ text: 'World of Warships NA' });
          mainEmbed.setTimestamp();

          await message.reply({ embeds: [mainEmbed] });
        } catch (error) {
          console.error('WoWS clan lookup error:', error);
          await message.reply(`❌ Error looking up clan: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        break;
      }

      case 'ships':
      case 'topships': {
        // Parse arguments: !ships <player> [tier] [type] [sort]
        // Examples: !ships amutantcow, !ships amutantcow 10, !ships amutantcow 10 bb
        if (!args[0]) {
          await message.reply('Usage: `!ships <player> [tier] [type] [sort]`\nExamples:\n• `!ships amutantcow` - Top 10 ships by battles\n• `!ships amutantcow 10` - Tier X ships only\n• `!ships amutantcow 10 bb` - Tier X battleships\n• `!ships amutantcow 0 dd winrate` - All destroyers sorted by winrate\n\nTypes: `dd` (destroyer), `ca` (cruiser), `bb` (battleship), `cv` (carrier), `ss` (submarine)\nSort: `battles`, `winrate`, `damage`, `recent`');
          return;
        }

        const playerName = args[0];
        const tierArg = args[1] ? parseInt(args[1]) : undefined;
        const tier = tierArg && tierArg > 0 && tierArg <= 11 ? tierArg : undefined;

        // Map short type codes to full names
        const typeMap: Record<string, string> = {
          'dd': 'Destroyer',
          'ca': 'Cruiser',
          'cl': 'Cruiser',
          'bb': 'Battleship',
          'cv': 'AirCarrier',
          'ss': 'Submarine'
        };
        const typeArg = args[2]?.toLowerCase();
        const shipType = typeArg ? typeMap[typeArg] || typeArg : undefined;

        const sortArg = args[3]?.toLowerCase() as 'battles' | 'winrate' | 'damage' | 'recent' | undefined;
        const sortBy = ['battles', 'winrate', 'damage', 'recent'].includes(sortArg || '') ? sortArg : 'battles';

        if ('sendTyping' in message.channel) {
          await message.channel.sendTyping();
        }

        try {
          const result = await getPlayerShipsFormatted(playerName, {
            tier,
            type: shipType,
            sortBy,
            limit: 10
          });

          if (!result) {
            const suggestions = await searchPlayerSuggestions(playerName, 5);
            if (suggestions.length > 0) {
              await message.reply(`❌ Player "${playerName}" not found.\n\n**Did you mean:**\n${suggestions.map(s => `• ${s}`).join('\n')}`);
            } else {
              await message.reply(`❌ Player "${playerName}" not found on NA server.`);
            }
            return;
          }

          if (result.ships.length === 0) {
            let filterDesc = '';
            if (tier) filterDesc += ` Tier ${formatTier(tier)}`;
            if (shipType) filterDesc += ` ${shipType}`;
            await message.reply(`❌ No${filterDesc} ships found for **${result.player.nickname}**.`);
            return;
          }

          // Build response
          let filterDesc = '';
          if (tier) filterDesc += `Tier ${formatTier(tier)} `;
          if (shipType) filterDesc += `${shipType} `;

          let response = `**${result.player.nickname}**'s Top ${filterDesc}Ships (by ${sortBy})\n\n`;

          for (const ship of result.ships) {
            const prEmoji = ship.pr >= 2100 ? '🟣' : ship.pr >= 1750 ? '🔵' : ship.pr >= 1400 ? '🟢' : ship.pr >= 1100 ? '🟡' : '🔴';
            const premiumTag = ship.isPremium ? ' ⭐' : ship.isSpecial ? ' 🎖️' : '';

            response += `${ship.typeEmoji} **${formatTier(ship.tier)} ${ship.name}**${premiumTag}\n`;
            response += `   ${ship.battles} battles • ${ship.winRate}% WR • ${ship.avgDamage.toLocaleString()} dmg • ${prEmoji} ${ship.pr}\n`;
          }

          // Truncate if too long for Discord
          if (response.length > 1900) {
            response = response.substring(0, 1900) + '\n...';
          }

          await message.reply(response);
        } catch (error) {
          console.error('WoWS ships lookup error:', error);
          await message.reply(`❌ Error looking up ships: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        break;
      }

      case 'allships': {
        // Show ALL ships for a player (paginated via multiple messages if needed)
        const playerName = args[0];
        if (!playerName) {
          await message.reply('Usage: `!allships <player> [tier] [type]`\nShows all ships for a player.\nExample: `!allships amutantcow` or `!allships amutantcow 10`');
          return;
        }

        const tierArg = args[1] ? parseInt(args[1]) : undefined;
        const tier = tierArg && tierArg > 0 && tierArg <= 11 ? tierArg : undefined;

        const typeMap: Record<string, string> = {
          'dd': 'Destroyer', 'ca': 'Cruiser', 'cl': 'Cruiser',
          'bb': 'Battleship', 'cv': 'AirCarrier', 'ss': 'Submarine'
        };
        const typeArg = args[2]?.toLowerCase();
        const shipType = typeArg ? typeMap[typeArg] || typeArg : undefined;

        if ('sendTyping' in message.channel) {
          await message.channel.sendTyping();
        }

        try {
          const result = await getPlayerShipsFormatted(playerName, {
            tier,
            type: shipType,
            sortBy: 'battles',
            limit: 500 // Get all ships
          });

          if (!result) {
            const suggestions = await searchPlayerSuggestions(playerName, 5);
            if (suggestions.length > 0) {
              await message.reply(`❌ Player "${playerName}" not found.\n\n**Did you mean:**\n${suggestions.map(s => `• ${s}`).join('\n')}`);
            } else {
              await message.reply(`❌ Player "${playerName}" not found on NA server.`);
            }
            return;
          }

          if (result.ships.length === 0) {
            let filterDesc = '';
            if (tier) filterDesc += ` Tier ${formatTier(tier)}`;
            if (shipType) filterDesc += ` ${shipType}`;
            await message.reply(`❌ No${filterDesc} ships found for **${result.player.nickname}**.`);
            return;
          }

          // Build header
          let filterDesc = '';
          if (tier) filterDesc += `Tier ${formatTier(tier)} `;
          if (shipType) filterDesc += `${shipType} `;

          const header = `**${result.player.nickname}**'s ${filterDesc}Ships (${result.ships.length} total)\n\n`;

          // Group ships by tier for cleaner output
          const shipsByTier = new Map<number, typeof result.ships>();
          for (const ship of result.ships) {
            if (!shipsByTier.has(ship.tier)) {
              shipsByTier.set(ship.tier, []);
            }
            shipsByTier.get(ship.tier)!.push(ship);
          }

          // Build messages (split to avoid Discord limit)
          const messages: string[] = [];
          let currentMessage = header;

          // Sort tiers descending (X first)
          const sortedTiers = Array.from(shipsByTier.keys()).sort((a, b) => b - a);

          for (const tierNum of sortedTiers) {
            const ships = shipsByTier.get(tierNum)!;
            const tierHeader = `**── Tier ${formatTier(tierNum)} (${ships.length}) ──**\n`;

            // Check if adding this tier would exceed limit
            if (currentMessage.length + tierHeader.length > 1800 && currentMessage !== header) {
              messages.push(currentMessage);
              currentMessage = '';
            }

            currentMessage += tierHeader;

            for (const ship of ships) {
              const prEmoji = ship.pr >= 2100 ? '🟣' : ship.pr >= 1750 ? '🔵' : ship.pr >= 1400 ? '🟢' : ship.pr >= 1100 ? '🟡' : '🔴';
              const premiumTag = ship.isPremium ? '⭐' : ship.isSpecial ? '🎖️' : '';
              const line = `${ship.typeEmoji} ${ship.name}${premiumTag} • ${ship.battles}B ${ship.winRate}%WR ${prEmoji}\n`;

              if (currentMessage.length + line.length > 1900) {
                messages.push(currentMessage);
                currentMessage = '';
              }
              currentMessage += line;
            }
            currentMessage += '\n';
          }

          if (currentMessage.trim()) {
            messages.push(currentMessage);
          }

          // Send messages (max 3 to avoid spam)
          const maxMessages = Math.min(messages.length, 3);
          for (let i = 0; i < maxMessages; i++) {
            await message.reply(messages[i]);
          }

          if (messages.length > 3) {
            await message.reply(`... and ${messages.length - 3} more pages. Use filters like \`!allships ${playerName} 10\` to narrow results.`);
          }

        } catch (error) {
          console.error('WoWS allships lookup error:', error);
          await message.reply(`❌ Error looking up ships: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        break;
      }

      // ============================================
      // CHANNEL MANAGEMENT
      // ============================================
      case 'createchannel': {
        const name = args[0];
        const categoryId = args[1]?.replace(/[<#>]/g, '');
        if (!name) {
          await message.reply('Usage: `!createchannel <name> [categoryId]`');
          return;
        }
        const result = await this.discordService.createTextChannel(guildId, name, categoryId);
        await message.reply(result);
        break;
      }

      case 'createvoice': {
        const name = args[0];
        const categoryId = args[1]?.replace(/[<#>]/g, '');
        const userLimit = args[2] ? parseInt(args[2]) : undefined;
        const bitrate = args[3] ? parseInt(args[3]) : undefined;
        if (!name) {
          await message.reply('Usage: `!createvoice <name> [categoryId] [userLimit] [bitrate]`');
          return;
        }
        const result = await this.discordService.createVoiceChannel(guildId, name, categoryId, userLimit, bitrate);
        await message.reply(result);
        break;
      }

      case 'createforum': {
        const name = args[0];
        const categoryId = args[1]?.replace(/[<#>]/g, '');
        if (!name) {
          await message.reply('Usage: `!createforum <name> [categoryId]`');
          return;
        }
        const result = await this.discordService.createForumChannel(guildId, name, categoryId);
        await message.reply(result);
        break;
      }

      case 'createannouncement': {
        const name = args[0];
        const categoryId = args[1]?.replace(/[<#>]/g, '');
        if (!name) {
          await message.reply('Usage: `!createannouncement <name> [categoryId]`');
          return;
        }
        const result = await this.discordService.createAnnouncementChannel(guildId, name, categoryId);
        await message.reply(result);
        break;
      }

      case 'createstage': {
        const name = args[0];
        const categoryId = args[1]?.replace(/[<#>]/g, '');
        if (!name) {
          await message.reply('Usage: `!createstage <name> [categoryId]`');
          return;
        }
        const result = await this.discordService.createStageChannel(guildId, name, categoryId);
        await message.reply(result);
        break;
      }

      case 'deletechannel': {
        const channelId = args[0]?.replace(/[<#>]/g, '');
        if (!channelId) {
          await message.reply('Usage: `!deletechannel <#channel>`');
          return;
        }
        const result = await this.discordService.deleteChannel(guildId, channelId);
        await message.reply(result);
        break;
      }

      case 'editchannel': {
        const channelId = args[0]?.replace(/[<#>]/g, '');
        const newName = args[1];
        if (!channelId) {
          await message.reply('Usage: `!editchannel <#channel> [newName]`');
          return;
        }
        const result = await this.discordService.editChannelAdvanced(guildId, channelId, { name: newName });
        await message.reply(result);
        break;
      }

      case 'findchannel': {
        const name = args.join(' ');
        if (!name) {
          await message.reply('Usage: `!findchannel <name>`');
          return;
        }
        const result = await this.discordService.findChannel(guildId, name);
        await message.reply(`\`\`\`\n${result}\n\`\`\``);
        break;
      }

      case 'listchannels':
      case 'channels': {
        const result = await this.discordService.listChannels(guildId);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      case 'setchannelposition': {
        const channelId = args[0]?.replace(/[<#>]/g, '');
        const position = parseInt(args[1]);
        if (!channelId || isNaN(position)) {
          await message.reply('Usage: `!setchannelposition <#channel> <position>`');
          return;
        }
        const result = await this.discordService.setChannelPosition(guildId, channelId, position);
        await message.reply(result);
        break;
      }

      case 'movechannel': {
        const channelId = args[0]?.replace(/[<#>]/g, '');
        const categoryId = args[1]?.replace(/[<#>]/g, '') || null;
        if (!channelId) {
          await message.reply('Usage: `!movechannel <#channel> [categoryId]` (omit categoryId to remove from category)');
          return;
        }
        const result = await this.discordService.moveChannelToCategory(guildId, channelId, categoryId);
        await message.reply(result);
        break;
      }

      case 'setchannelprivate': {
        const channelId = args[0]?.replace(/[<#>]/g, '');
        if (!channelId) {
          await message.reply('Usage: `!setchannelprivate <#channel>`');
          return;
        }
        const result = await this.discordService.setChannelPrivate(guildId, channelId, { isPrivate: true });
        await message.reply(result);
        break;
      }

      case 'channelperms': {
        const channelId = args[0]?.replace(/[<#>]/g, '') || message.channelId;
        const result = await this.discordService.getChannelPermissions(channelId);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      case 'syncchannelperms': {
        const channelId = args[0]?.replace(/[<#>]/g, '');
        if (!channelId) {
          await message.reply('Usage: `!syncchannelperms <#channel>`');
          return;
        }
        const result = await this.discordService.syncChannelPermissions(channelId);
        await message.reply(result);
        break;
      }

      // ============================================
      // CATEGORY MANAGEMENT
      // ============================================
      case 'createcategory': {
        const name = args.join(' ');
        if (!name) {
          await message.reply('Usage: `!createcategory <name>`');
          return;
        }
        const result = await this.discordService.createCategory(guildId, name);
        await message.reply(result);
        break;
      }

      case 'deletecategory': {
        const categoryId = args[0];
        if (!categoryId) {
          await message.reply('Usage: `!deletecategory <categoryId>`');
          return;
        }
        const result = await this.discordService.deleteCategory(guildId, categoryId);
        await message.reply(result);
        break;
      }

      case 'findcategory': {
        const name = args.join(' ');
        if (!name) {
          await message.reply('Usage: `!findcategory <name>`');
          return;
        }
        const result = await this.discordService.findCategory(guildId, name);
        await message.reply(`\`\`\`\n${result}\n\`\`\``);
        break;
      }

      case 'listincategory': {
        const categoryId = args[0];
        if (!categoryId) {
          await message.reply('Usage: `!listincategory <categoryId>`');
          return;
        }
        const result = await this.discordService.listChannelsInCategory(guildId, categoryId);
        await message.reply(`\`\`\`\n${result}\n\`\`\``);
        break;
      }

      case 'setcategoryposition': {
        const categoryId = args[0];
        const position = parseInt(args[1]);
        if (!categoryId || isNaN(position)) {
          await message.reply('Usage: `!setcategoryposition <categoryId> <position>`');
          return;
        }
        const result = await this.discordService.setCategoryPosition(guildId, categoryId, position);
        await message.reply(result);
        break;
      }

      case 'setcategoryprivate': {
        const categoryId = args[0];
        if (!categoryId) {
          await message.reply('Usage: `!setcategoryprivate <categoryId>`');
          return;
        }
        const result = await this.discordService.setCategoryPrivate(guildId, categoryId, { isPrivate: true });
        await message.reply(result);
        break;
      }

      // ============================================
      // ROLE MANAGEMENT
      // ============================================
      case 'createrole': {
        const name = args[0];
        const color = args[1];
        if (!name) {
          await message.reply('Usage: `!createrole <name> [color]`');
          return;
        }
        const result = await this.discordService.createRole(guildId, name, color);
        await message.reply(result);
        break;
      }

      case 'deleterole': {
        const roleId = args[0]?.replace(/[<@&>]/g, '');
        if (!roleId) {
          await message.reply('Usage: `!deleterole <@role>`');
          return;
        }
        const result = await this.discordService.deleteRole(guildId, roleId);
        await message.reply(result);
        break;
      }

      case 'editrole': {
        const roleId = args[0]?.replace(/[<@&>]/g, '');
        const newName = args[1];
        const newColor = args[2];
        if (!roleId) {
          await message.reply('Usage: `!editrole <@role> [newName] [newColor]`');
          return;
        }
        const result = await this.discordService.editRole(guildId, roleId, newName, newColor);
        await message.reply(result);
        break;
      }

      case 'listroles':
      case 'roles': {
        const result = await this.discordService.getRoles(guildId);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      case 'addrole': {
        const userId = args[0]?.replace(/[<@!>]/g, '');
        const roleId = args[1]?.replace(/[<@&>]/g, '');
        if (!userId || !roleId) {
          await message.reply('Usage: `!addrole <@user> <@role>`');
          return;
        }
        const result = await this.discordService.addRoleToMember(guildId, userId, roleId);
        await message.reply(result);
        break;
      }

      case 'removerole': {
        const userId = args[0]?.replace(/[<@!>]/g, '');
        const roleId = args[1]?.replace(/[<@&>]/g, '');
        if (!userId || !roleId) {
          await message.reply('Usage: `!removerole <@user> <@role>`');
          return;
        }
        const result = await this.discordService.removeRoleFromMember(guildId, userId, roleId);
        await message.reply(result);
        break;
      }

      // ============================================
      // MEMBER MANAGEMENT
      // ============================================
      case 'members': {
        const limit = parseInt(args[0]) || 10;
        const result = await this.discordService.getMembers(guildId, limit);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      case 'searchmembers':
      case 'findmember': {
        const query = args.join(' ');
        const result = await this.discordService.searchMembers(guildId, query, 10);
        await message.reply(`\`\`\`\n${result}\n\`\`\``);
        break;
      }

      case 'memberinfo': {
        const userId = args[0]?.replace(/[<@!>]/g, '');
        if (!userId) {
          await message.reply('Usage: `!memberinfo <@user>`');
          return;
        }
        const result = await this.discordService.getMemberInfo(guildId, userId);
        await message.reply(`\`\`\`\n${result}\n\`\`\``);
        break;
      }

      case 'editmember': {
        const userId = args[0]?.replace(/[<@!>]/g, '');
        const nickname = args[1];
        if (!userId) {
          await message.reply('Usage: `!editmember <@user> [nickname]`');
          return;
        }
        const result = await this.discordService.editMember(guildId, userId, nickname);
        await message.reply(result);
        break;
      }

      case 'userid': {
        const username = args.join(' ');
        if (!username) {
          await message.reply('Usage: `!userid <username>`');
          return;
        }
        const result = await this.discordService.getUserIdByName(username, guildId);
        await message.reply(`User ID: \`${result}\``);
        break;
      }

      // ============================================
      // MODERATION
      // ============================================
      case 'kick': {
        const userId = SecurityUtils.sanitizeSnowflake(args[0]?.replace(/[<@!>]/g, ''));
        const reason = args.slice(1).join(' ') || 'No reason provided';
        if (!userId) {
          await message.reply('Usage: `!kick <@user> [reason]`');
          return;
        }
        const result = await this.discordService.kickMember(guildId, userId, reason);
        await message.reply(result);
        break;
      }

      case 'ban': {
        const userId = SecurityUtils.sanitizeSnowflake(args[0]?.replace(/[<@!>]/g, ''));
        const reason = args.slice(1).join(' ') || 'No reason provided';
        if (!userId) {
          await message.reply('Usage: `!ban <@user> [reason]`');
          return;
        }
        const result = await this.discordService.banMember(guildId, userId, reason);
        await message.reply(result);
        break;
      }

      case 'unban': {
        const userId = SecurityUtils.sanitizeSnowflake(args[0]);
        const reason = args.slice(1).join(' ') || 'No reason provided';
        if (!userId) {
          await message.reply('Usage: `!unban <userId> [reason]`');
          return;
        }
        const result = await this.discordService.unbanMember(guildId, userId, reason);
        await message.reply(result);
        break;
      }

      case 'timeout': {
        const userId = SecurityUtils.sanitizeSnowflake(args[0]?.replace(/[<@!>]/g, ''));
        const durationInput = parseInt(args[1]) || 60; // Default 60 seconds
        const reason = args.slice(2).join(' ') || 'No reason provided';
        if (!userId) {
          await message.reply('Usage: `!timeout <@user> [durationSeconds] [reason]`');
          return;
        }
        // SECURITY: Validate and clamp timeout duration
        const durationCheck = SecurityUtils.validateTimeoutDuration(durationInput);
        if (!durationCheck.valid) {
          await message.reply(`⚠️ ${durationCheck.reason}`);
          return;
        }
        const duration = durationCheck.clampedValue!;
        if (durationCheck.reason) {
          await message.reply(`⚠️ Note: ${durationCheck.reason}`);
        }
        const result = await this.discordService.timeoutMember(guildId, userId, duration, reason);
        await message.reply(result);
        break;
      }

      case 'removetimeout':
      case 'untimeout': {
        const userId = args[0]?.replace(/[<@!>]/g, '');
        const reason = args.slice(1).join(' ') || 'No reason provided';
        if (!userId) {
          await message.reply('Usage: `!removetimeout <@user> [reason]`');
          return;
        }
        const result = await this.discordService.removeTimeout(guildId, userId, reason);
        await message.reply(result);
        break;
      }

      case 'auditlog':
      case 'audit': {
        const limit = parseInt(args[0]) || 10;
        const result = await this.discordService.getAuditLogs(guildId, limit);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      case 'bans': {
        const result = await this.discordService.getBans(guildId);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      // ============================================
      // MESSAGE MANAGEMENT
      // ============================================
      case 'send': {
        const channelId = args[0]?.replace(/[<#>]/g, '');
        const content = args.slice(1).join(' ');
        if (!channelId || !content) {
          await message.reply('Usage: `!send <#channel> <message>`');
          return;
        }
        const result = await this.discordService.sendMessage(channelId, content);
        await message.reply(result);
        break;
      }

      case 'edit': {
        const channelId = args[0]?.replace(/[<#>]/g, '');
        const messageId = args[1];
        const newContent = args.slice(2).join(' ');
        if (!channelId || !messageId || !newContent) {
          await message.reply('Usage: `!edit <#channel> <messageId> <newContent>`');
          return;
        }
        const result = await this.discordService.editMessage(channelId, messageId, newContent);
        await message.reply(result);
        break;
      }

      case 'delete': {
        const channelId = args[0]?.replace(/[<#>]/g, '');
        const messageId = args[1];
        if (!channelId || !messageId) {
          await message.reply('Usage: `!delete <#channel> <messageId>`');
          return;
        }
        const result = await this.discordService.deleteMessage(channelId, messageId);
        await message.reply(result);
        break;
      }

      case 'read': {
        const channelId = args[0]?.replace(/[<#>]/g, '') || message.channelId;
        const count = args[1] || '10';
        const result = await this.discordService.readMessages(channelId, count);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      case 'history': {
        const channelId = args[0]?.replace(/[<#>]/g, '') || message.channelId;
        const limit = parseInt(args[1]) || 50;
        const result = await this.discordService.getMessageHistory(channelId, limit);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      case 'bulkdelete':
      case 'purge': {
        const count = parseInt(args[0]) || 10;
        if (count < 1 || count > 100) {
          await message.reply('Usage: `!bulkdelete <count>` (1-100)');
          return;
        }
        await message.delete().catch(() => {});
        const channel = message.channel as TextChannel;
        const messages = await channel.messages.fetch({ limit: count });

        // SECURITY: Filter out messages older than 14 days (Discord API limitation)
        const validMessageIds = messages
          .filter(m => !SecurityUtils.isMessageTooOldForBulkDelete(m.id))
          .map(m => m.id);

        const skippedCount = messages.size - validMessageIds.length;
        if (validMessageIds.length === 0) {
          const reply = await channel.send('⚠️ All messages are older than 14 days and cannot be bulk deleted.');
          setTimeout(() => reply.delete().catch(() => {}), 5000);
          break;
        }

        const result = await this.discordService.bulkDeleteMessages(message.channelId, validMessageIds);
        const skippedNote = skippedCount > 0 ? ` (${skippedCount} messages >14 days old were skipped)` : '';
        const reply = await channel.send(`${result}${skippedNote}`);
        setTimeout(() => reply.delete().catch(() => {}), 5000);
        break;
      }

      case 'pin': {
        const messageId = args[0];
        if (!messageId) {
          await message.reply('Usage: `!pin <messageId>`');
          return;
        }
        const result = await this.discordService.pinMessage(message.channelId, messageId);
        await message.reply(result);
        break;
      }

      case 'unpin': {
        const messageId = args[0];
        if (!messageId) {
          await message.reply('Usage: `!unpin <messageId>`');
          return;
        }
        const result = await this.discordService.unpinMessage(message.channelId, messageId);
        await message.reply(result);
        break;
      }

      case 'pinned': {
        const channelId = args[0]?.replace(/[<#>]/g, '') || message.channelId;
        const result = await this.discordService.getPinnedMessages(channelId);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      case 'crosspost': {
        const channelId = args[0]?.replace(/[<#>]/g, '');
        const messageId = args[1];
        if (!channelId || !messageId) {
          await message.reply('Usage: `!crosspost <#channel> <messageId>`');
          return;
        }
        const result = await this.discordService.crosspostMessage(channelId, messageId);
        await message.reply(result);
        break;
      }

      case 'react':
      case 'addreaction': {
        const channelId = args[0]?.replace(/[<#>]/g, '');
        const messageId = args[1];
        const emoji = args[2];
        if (!channelId || !messageId || !emoji) {
          await message.reply('Usage: `!react <#channel> <messageId> <emoji>`');
          return;
        }
        const result = await this.discordService.addReaction(channelId, messageId, emoji);
        await message.reply(result);
        break;
      }

      case 'unreact':
      case 'removereaction': {
        const channelId = args[0]?.replace(/[<#>]/g, '');
        const messageId = args[1];
        const emoji = args[2];
        if (!channelId || !messageId || !emoji) {
          await message.reply('Usage: `!unreact <#channel> <messageId> <emoji>`');
          return;
        }
        const result = await this.discordService.removeReaction(channelId, messageId, emoji);
        await message.reply(result);
        break;
      }

      case 'attachments': {
        const channelId = args[0]?.replace(/[<#>]/g, '') || message.channelId;
        const messageId = args[1];
        if (!messageId) {
          await message.reply('Usage: `!attachments [#channel] <messageId>`');
          return;
        }
        const result = await this.discordService.getMessageAttachments(channelId, messageId);
        await message.reply(`\`\`\`\n${result}\n\`\`\``);
        break;
      }

      case 'exportchat': {
        const channelId = args[0]?.replace(/[<#>]/g, '') || message.channelId;
        const format = args[1] || 'txt';
        const limit = parseInt(args[2]) || 100;
        const result = await this.discordService.exportChatLog(channelId, format, limit);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      // ============================================
      // PRIVATE MESSAGES
      // ============================================
      case 'dm': {
        const userId = args[0]?.replace(/[<@!>]/g, '');
        const content = args.slice(1).join(' ');
        if (!userId || !content) {
          await message.reply('Usage: `!dm <@user> <message>`');
          return;
        }
        const result = await this.discordService.sendPrivateMessage(userId, content);
        await message.reply(result);
        break;
      }

      case 'editdm': {
        const userId = args[0]?.replace(/[<@!>]/g, '');
        const messageId = args[1];
        const newContent = args.slice(2).join(' ');
        if (!userId || !messageId || !newContent) {
          await message.reply('Usage: `!editdm <@user> <messageId> <newContent>`');
          return;
        }
        const result = await this.discordService.editPrivateMessage(userId, messageId, newContent);
        await message.reply(result);
        break;
      }

      case 'deletedm': {
        const userId = args[0]?.replace(/[<@!>]/g, '');
        const messageId = args[1];
        if (!userId || !messageId) {
          await message.reply('Usage: `!deletedm <@user> <messageId>`');
          return;
        }
        const result = await this.discordService.deletePrivateMessage(userId, messageId);
        await message.reply(result);
        break;
      }

      case 'readdms': {
        const userId = args[0]?.replace(/[<@!>]/g, '');
        const count = args[1] || '10';
        if (!userId) {
          await message.reply('Usage: `!readdms <@user> [count]`');
          return;
        }
        const result = await this.discordService.readPrivateMessages(userId, count);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      // ============================================
      // THREADS
      // ============================================
      case 'createthread': {
        const channelId = args[0]?.replace(/[<#>]/g, '') || message.channelId;
        const name = args[1] || 'New Thread';
        const messageId = args[2];
        if (!name) {
          await message.reply('Usage: `!createthread [#channel] <threadName> [messageId]`');
          return;
        }
        const result = await this.discordService.createThread(channelId, name, undefined, messageId);
        await message.reply(result);
        break;
      }

      case 'archivethread': {
        const threadId = args[0]?.replace(/[<#>]/g, '');
        const reason = args.slice(1).join(' ');
        if (!threadId) {
          await message.reply('Usage: `!archivethread <#thread> [reason]`');
          return;
        }
        const result = await this.discordService.archiveThread(threadId, reason);
        await message.reply(result);
        break;
      }

      case 'unarchivethread': {
        const threadId = args[0]?.replace(/[<#>]/g, '');
        const reason = args.slice(1).join(' ');
        if (!threadId) {
          await message.reply('Usage: `!unarchivethread <#thread> [reason]`');
          return;
        }
        const result = await this.discordService.unarchiveThread(threadId, reason);
        await message.reply(result);
        break;
      }

      case 'lockthread': {
        const threadId = args[0]?.replace(/[<#>]/g, '');
        const reason = args.slice(1).join(' ');
        if (!threadId) {
          await message.reply('Usage: `!lockthread <#thread> [reason]`');
          return;
        }
        const result = await this.discordService.lockThread(threadId, reason);
        await message.reply(result);
        break;
      }

      case 'unlockthread': {
        const threadId = args[0]?.replace(/[<#>]/g, '');
        const reason = args.slice(1).join(' ');
        if (!threadId) {
          await message.reply('Usage: `!unlockthread <#thread> [reason]`');
          return;
        }
        const result = await this.discordService.unlockThread(threadId, reason);
        await message.reply(result);
        break;
      }

      case 'jointhread': {
        const threadId = args[0]?.replace(/[<#>]/g, '');
        if (!threadId) {
          await message.reply('Usage: `!jointhread <#thread>`');
          return;
        }
        const result = await this.discordService.joinThread(threadId);
        await message.reply(result);
        break;
      }

      case 'leavethread': {
        const threadId = args[0]?.replace(/[<#>]/g, '');
        if (!threadId) {
          await message.reply('Usage: `!leavethread <#thread>`');
          return;
        }
        const result = await this.discordService.leaveThread(threadId);
        await message.reply(result);
        break;
      }

      case 'threads': {
        const result = await this.discordService.getActiveThreads(guildId);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      // ============================================
      // WEBHOOKS
      // ============================================
      case 'createwebhook': {
        const channelId = args[0]?.replace(/[<#>]/g, '') || message.channelId;
        const name = args.slice(1).join(' ') || 'Bot Webhook';
        const result = await this.discordService.createWebhook(channelId, name);
        await message.reply(result);
        break;
      }

      case 'deletewebhook': {
        const webhookId = args[0];
        if (!webhookId) {
          await message.reply('Usage: `!deletewebhook <webhookId>`');
          return;
        }
        const result = await this.discordService.deleteWebhook(webhookId);
        await message.reply(result);
        break;
      }

      case 'listwebhooks':
      case 'webhooks': {
        const channelId = args[0]?.replace(/[<#>]/g, '') || message.channelId;
        const result = await this.discordService.listWebhooks(channelId);
        await message.reply(`\`\`\`\n${result}\n\`\`\``);
        break;
      }

      case 'webhooksend': {
        const webhookUrl = args[0];
        const content = args.slice(1).join(' ');
        if (!webhookUrl || !content) {
          await message.reply('Usage: `!webhooksend <webhookUrl> <message>`');
          return;
        }
        // SECURITY: Warn about webhook URL exposure and validate it's a webhook URL
        if (!SecurityUtils.isWebhookUrl(webhookUrl)) {
          await message.reply('⚠️ Invalid webhook URL format.');
          return;
        }
        // Delete the command message to avoid exposing the webhook token in chat history
        try {
          await message.delete();
        } catch {
          // May fail if missing permissions, continue anyway
        }
        const result = await this.discordService.sendWebhookMessage(webhookUrl, content);
        // Reply in DM to avoid exposing webhook in channel
        try {
          await message.author.send(`Webhook message sent: ${result}`);
        } catch {
          // If DM fails, just log it
          console.log('Webhook command executed (DM delivery failed)');
        }
        break;
      }

      // ============================================
      // VOICE (with Creator Priority)
      // ============================================

      // Creator-only: Lock voice commands
      case 'lockvoice':
      case 'vlock': {
        if (!isCreator(message.author.id)) {
          await message.reply(`❌ Only ${getCreatorName()} can lock voice commands.`);
          return;
        }

        // Get creator's current voice channel if they're in one
        const member = message.member;
        const voiceChannelId = member?.voice?.channelId;

        if (lockVoice(guildId, message.author.id, voiceChannelId || undefined)) {
          await message.reply(`🔒 Voice commands locked! Only you can control the bot now, ${getCreatorName()}.`);

          // If creator is in a voice channel, auto-join them
          if (voiceChannelId) {
            await this.discordService.joinVoiceChannel(guildId, voiceChannelId);
            await message.reply(`🎤 Joined your voice channel!`);
          }
        }
        break;
      }

      // Creator-only: Unlock voice commands
      case 'unlockvoice':
      case 'vunlock': {
        if (!isCreator(message.author.id)) {
          await message.reply(`❌ Only ${getCreatorName()} can unlock voice commands.`);
          return;
        }

        if (unlockVoice(guildId, message.author.id)) {
          await message.reply(`🔓 Voice commands unlocked! Everyone can control the bot now.`);
        }
        break;
      }

      // Check voice lock status
      case 'voicestatus':
      case 'vstatus': {
        await message.reply(getLockStatus(guildId));
        break;
      }

      case 'voicejoin':
      case 'join': {
        // Check voice priority
        const voiceCheck = canUseVoiceCommand(guildId, message.author.id);
        if (!voiceCheck.allowed) {
          await message.reply(voiceCheck.reason!);
          return;
        }

        const channelName = args.join(' ').trim();
        if (!channelName) {
          await message.reply('Usage: `!join <channel name>` - Example: `!join War Room`');
          return;
        }

        // Find voice channel by name (case-insensitive)
        const guild = message.guild;
        if (!guild) {
          await message.reply('This command can only be used in a server.');
          return;
        }

        const voiceChannel = guild.channels.cache.find(
          ch => ch.isVoiceBased() && ch.name.toLowerCase() === channelName.toLowerCase()
        );

        if (!voiceChannel) {
          const voiceChannels = guild.channels.cache
            .filter(ch => ch.isVoiceBased())
            .map(ch => ch.name)
            .slice(0, 10);
          await message.reply(`Voice channel "${channelName}" not found. Available: ${voiceChannels.join(', ')}`);
          return;
        }

        const result = await this.discordService.joinVoiceChannel(guildId, voiceChannel.id);
        await message.reply(result);
        break;
      }

      case 'voiceleave':
      case 'leave': {
        // Check voice priority
        const voiceCheck = canUseVoiceCommand(guildId, message.author.id);
        if (!voiceCheck.allowed) {
          await message.reply(voiceCheck.reason!);
          return;
        }

        const result = await this.discordService.leaveVoiceChannel(guildId, guildId);
        await message.reply(result);
        break;
      }

      case 'say':
      case 'speak':
      case 'tts': {
        // Check voice priority
        const voiceCheck = canUseVoiceCommand(guildId, message.author.id);
        if (!voiceCheck.allowed) {
          await message.reply(voiceCheck.reason!);
          return;
        }

        const text = args.join(' ').trim();
        if (!text) {
          await message.reply('Usage: `!say <text>` - Example: `!say Hello everyone!`');
          return;
        }
        if (text.length > 500) {
          await message.reply('Text too long. Maximum 500 characters.');
          return;
        }
        // Content filter - block slurs and hate speech
        const contentCheck = SecurityUtils.containsBlockedContent(text);
        if (contentCheck.blocked) {
          await message.reply('❌ I cannot say that. ' + contentCheck.reason);
          return;
        }
        const result = await this.discordService.speakText(guildId, text);
        await message.reply(result);
        break;
      }

      // Voice listing and selection
      case 'voices':
      case 'listvoices': {
        const voiceList = formatVoiceList();
        // Split into multiple messages if needed (Discord 2000 char limit)
        if (voiceList.length > 1900) {
          const lines = voiceList.split('\n');
          let chunk = '';
          for (const line of lines) {
            if (chunk.length + line.length > 1900) {
              await message.reply(chunk);
              chunk = line + '\n';
            } else {
              chunk += line + '\n';
            }
          }
          if (chunk) await message.reply(chunk);
        } else {
          await message.reply(voiceList);
        }
        break;
      }

      case 'voice':
      case 'currentvoice': {
        const voiceInfo = getGuildVoiceInfo(guildId);
        if (voiceInfo) {
          await message.reply(`🎤 Current voice: **${voiceInfo.shortName}** (${voiceInfo.locale} ${voiceInfo.gender})\n${voiceInfo.description}`);
        } else {
          await message.reply(`🎤 Current voice: **Jenny** (Default)`);
        }
        break;
      }

      case 'setvoice':
      case 'changevoice': {
        // Check voice priority - only creator can change when locked
        const setVoiceCheck = canUseVoiceCommand(guildId, message.author.id);
        if (!setVoiceCheck.allowed) {
          await message.reply(setVoiceCheck.reason!);
          return;
        }

        const voiceName = args.join(' ').trim();
        if (!voiceName) {
          await message.reply('Usage: `!setvoice <name>` - Example: `!setvoice aria`\nUse `!voices` to see available voices.');
          return;
        }

        const voice = findVoice(voiceName);
        if (!voice) {
          const suggestions = getSuggestions(voiceName);
          if (suggestions.length > 0) {
            await message.reply(`❌ Voice "${voiceName}" not found. Did you mean:\n${suggestions.map(v => `• \`${v.shortName}\` - ${v.description}`).join('\n')}`);
          } else {
            await message.reply(`❌ Voice "${voiceName}" not found. Use \`!voices\` to see available voices.`);
          }
          return;
        }

        if (setGuildVoice(guildId, voice.name)) {
          await message.reply(`✅ Voice changed to **${voice.shortName}** (${voice.locale} ${voice.gender})\n${voice.description}`);
        } else {
          await message.reply('❌ Failed to change voice.');
        }
        break;
      }

      case 'previewvoice':
      case 'testvoice': {
        // Check voice priority
        const previewCheck = canUseVoiceCommand(guildId, message.author.id);
        if (!previewCheck.allowed) {
          await message.reply(previewCheck.reason!);
          return;
        }

        const voiceName = args.join(' ').trim();
        if (!voiceName) {
          await message.reply('Usage: `!previewvoice <name>` - Example: `!previewvoice sonia`');
          return;
        }

        const voice = findVoice(voiceName);
        if (!voice) {
          await message.reply(`❌ Voice "${voiceName}" not found. Use \`!voices\` to see available voices.`);
          return;
        }

        try {
          await this.discordService.speakText(guildId, `Hello! I'm ${voice.shortName}, a ${voice.gender.toLowerCase()} voice from ${voice.locale}.`, voice.name);
          await message.reply(`🎤 Previewing: **${voice.shortName}** (${voice.locale} ${voice.gender})`);
        } catch (error) {
          await message.reply(`❌ Could not preview voice. Make sure the bot is in a voice channel first.`);
        }
        break;
      }

      // ============================================
      // AI CHAT (GitHub Models - Free)
      // ============================================
      case 'ask':
      case 'ai':
      case 'chat': {
        const question = args.join(' ').trim();
        if (!question) {
          await message.reply('Usage: `!ask <question>` - Example: `!ask What ship is best for beginners?`');
          return;
        }

        const aiService = getAIService();

        // Show typing indicator while processing
        await (message.channel as TextChannel).sendTyping();

        // Callback to notify user when provider fails and retrying
        const onRetry: OnRetryCallback = async (failedProvider, nextProvider, error) => {
          try {
            await (message.channel as TextChannel).send(`⚠️ \`${failedProvider}\` failed, trying \`${nextProvider}\`...`);
            await (message.channel as TextChannel).sendTyping();
          } catch {
            // Ignore errors sending retry message
          }
        };

        try {
          let response = await aiService.chat(question, undefined, onRetry);

          // Content filter - don't send inappropriate AI responses
          const aiContentCheck = SecurityUtils.containsBlockedContent(response);
          if (aiContentCheck.blocked) {
            response = "I can't respond to that in an appropriate way. Let's talk about something else!";
          }

          // Split long responses if needed
          if (response.length > 1900) {
            await message.reply(response.substring(0, 1900) + '...');
          } else {
            await message.reply(response);
          }
        } catch (error) {
          await message.reply(`AI error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        break;
      }

      case 'voiceask': {
        const question = args.join(' ').trim();
        if (!question) {
          await message.reply('Usage: `!voice <question>` - Bot will respond AND speak in voice channel');
          return;
        }

        const aiService = getAIService();

        // Show typing indicator while processing
        await (message.channel as TextChannel).sendTyping();

        // Callback to notify user when provider fails and retrying
        const onRetry: OnRetryCallback = async (failedProvider, nextProvider, error) => {
          try {
            await (message.channel as TextChannel).send(`⚠️ \`${failedProvider}\` failed, trying \`${nextProvider}\`...`);
            await (message.channel as TextChannel).sendTyping();
          } catch {
            // Ignore errors sending retry message
          }
        };

        try {
          let response = await aiService.chat(question, undefined, onRetry);

          // Content filter - don't send or speak inappropriate AI responses
          const voiceAiCheck = SecurityUtils.containsBlockedContent(response);
          if (voiceAiCheck.blocked) {
            response = "I can't respond to that in an appropriate way. Let's talk about something else!";
          }

          // Reply in text channel
          if (response.length > 1900) {
            await message.reply(response.substring(0, 1900) + '...');
          } else {
            await message.reply(response);
          }

          // Also speak it in voice channel if bot is connected
          try {
            // Truncate for TTS (max 500 chars)
            const ttsText = response.length > 500 ? response.substring(0, 497) + '...' : response;
            await this.discordService.speakText(guildId, ttsText);
          } catch {
            // Bot not in voice channel - that's okay, just don't speak
          }
        } catch (error) {
          await message.reply(`AI error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        break;
      }

      // ============================================
      // IMAGE GENERATION (Pollinations.AI - Free)
      // ============================================
      case 'image':
      case 'imagine':
      case 'generate':
      case 'img': {
        const prompt = args.join(' ').trim();
        if (!prompt) {
          await message.reply('Usage: `!image <prompt>` - Example: `!image a battleship at sunset`\nModels: `!image --model=flux-anime a cute cat`\nOptions: `--model=flux|turbo|flux-realism|flux-anime|flux-3d` `--size=WxH`');
          return;
        }

        // Parse options from prompt
        let model: 'flux' | 'turbo' | 'flux-realism' | 'flux-anime' | 'flux-3d' = 'flux';
        let width = 512;
        let height = 512;
        let cleanPrompt = prompt;

        // Extract --model option
        const modelMatch = prompt.match(/--model=(\S+)/i);
        if (modelMatch) {
          const validModels = getAvailableModels();
          if (validModels.includes(modelMatch[1])) {
            model = modelMatch[1] as typeof model;
          }
          cleanPrompt = cleanPrompt.replace(/--model=\S+/i, '').trim();
        }

        // Extract --size option
        const sizeMatch = prompt.match(/--size=(\d+)x(\d+)/i);
        if (sizeMatch) {
          width = Math.min(1024, Math.max(256, parseInt(sizeMatch[1])));
          height = Math.min(1024, Math.max(256, parseInt(sizeMatch[2])));
          cleanPrompt = cleanPrompt.replace(/--size=\d+x\d+/i, '').trim();
        }

        if (!cleanPrompt) {
          await message.reply('Please provide a prompt after the options.');
          return;
        }

        // Show typing indicator
        await (message.channel as TextChannel).sendTyping();

        try {
          // Generate the image URL
          const imageUrl = generateImageUrl(cleanPrompt, {
            width,
            height,
            model,
            nologo: true
          });

          // Create embed with the image
          const embed = new EmbedBuilder()
            .setTitle('🎨 Generated Image')
            .setDescription(`**Prompt:** ${cleanPrompt.substring(0, 200)}${cleanPrompt.length > 200 ? '...' : ''}`)
            .setImage(imageUrl)
            .setFooter({ text: `Model: ${model} | Size: ${width}x${height} | Powered by Pollinations.AI` })
            .setColor(0x7289DA)
            .setTimestamp();

          await message.reply({ embeds: [embed] });
        } catch (error) {
          await message.reply(`Image generation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        break;
      }

      case 'imagemodels': {
        const models = getAvailableModels();
        await message.reply(`**Available Image Models:**\n${models.map(m => `• \`${m}\``).join('\n')}\n\nUsage: \`!image --model=flux-anime your prompt here\``);
        break;
      }

      // ============================================
      // MUSIC COMMANDS
      // ============================================
      case 'play':
      case 'p':
      case 'music': {
        // Check voice priority
        const playVoiceCheck = canUseVoiceCommand(guildId, message.author.id);
        if (!playVoiceCheck.allowed) {
          await message.reply(playVoiceCheck.reason!);
          return;
        }

        const query = args.join(' ');
        if (!query) {
          await message.reply('🎵 **Music Commands:**\n`!play <song name or YouTube/Spotify URL>` - Play a song\n`!skip` - Skip current song\n`!stop` - Stop and clear queue\n`!pause` - Pause playback\n`!resume` - Resume playback\n`!queue` / `!q` - View queue\n`!np` - Now playing\n`!volume <0-150>` - Set volume\n`!loop` - Toggle loop');
          return;
        }

        if ('sendTyping' in message.channel) {
          await message.channel.sendTyping();
        }

        const playResult = await musicService.play(
          message.guild!,
          message.member!,
          query,
          message.channel.id
        );

        if (playResult.embed) {
          await message.reply({ embeds: [playResult.embed] });
        } else {
          await message.reply(playResult.message);
        }
        break;
      }

      case 'skip':
      case 's': {
        const playVoiceCheck2 = canUseVoiceCommand(guildId, message.author.id);
        if (!playVoiceCheck2.allowed) {
          await message.reply(playVoiceCheck2.reason!);
          return;
        }

        const skipResult = musicService.skip(guildId);
        await message.reply(skipResult.message);
        break;
      }

      case 'stop': {
        const stopVoiceCheck = canUseVoiceCommand(guildId, message.author.id);
        if (!stopVoiceCheck.allowed) {
          await message.reply(stopVoiceCheck.reason!);
          return;
        }

        const stopResult = musicService.stop(guildId);
        await message.reply(stopResult.message);
        break;
      }

      case 'pause': {
        const pauseVoiceCheck = canUseVoiceCommand(guildId, message.author.id);
        if (!pauseVoiceCheck.allowed) {
          await message.reply(pauseVoiceCheck.reason!);
          return;
        }

        const pauseResult = musicService.pause(guildId);
        await message.reply(pauseResult.message);
        break;
      }

      case 'resume':
      case 'unpause': {
        const resumeVoiceCheck = canUseVoiceCommand(guildId, message.author.id);
        if (!resumeVoiceCheck.allowed) {
          await message.reply(resumeVoiceCheck.reason!);
          return;
        }

        const resumeResult = musicService.resume(guildId);
        await message.reply(resumeResult.message);
        break;
      }

      case 'queue':
      case 'q': {
        const queueEmbed = musicService.getQueueEmbed(guildId);
        if (queueEmbed) {
          await message.reply({ embeds: [queueEmbed] });
        } else {
          await message.reply('📋 The queue is empty. Use `!play <song>` to add music!');
        }
        break;
      }

      case 'np':
      case 'nowplaying':
      case 'current': {
        const npEmbed = musicService.getNowPlaying(guildId);
        if (npEmbed) {
          await message.reply({ embeds: [npEmbed] });
        } else {
          await message.reply('🎵 Nothing is playing right now.');
        }
        break;
      }

      case 'volume':
      case 'vol': {
        const volVoiceCheck = canUseVoiceCommand(guildId, message.author.id);
        if (!volVoiceCheck.allowed) {
          await message.reply(volVoiceCheck.reason!);
          return;
        }

        const vol = parseInt(args[0]);
        if (isNaN(vol) || vol < 0 || vol > 150) {
          await message.reply('Usage: `!volume <0-150>`');
          return;
        }
        const volResult = musicService.setVolume(guildId, vol);
        await message.reply(volResult.message);
        break;
      }

      case 'loop':
      case 'repeat': {
        const loopVoiceCheck = canUseVoiceCommand(guildId, message.author.id);
        if (!loopVoiceCheck.allowed) {
          await message.reply(loopVoiceCheck.reason!);
          return;
        }

        const loopResult = musicService.toggleLoop(guildId);
        await message.reply(loopResult.message);
        break;
      }

      case 'voiceconnections': {
        const result = await this.discordService.getVoiceConnections();
        await message.reply(`\`\`\`\n${result}\n\`\`\``);
        break;
      }

      // ============================================
      // EVENTS
      // ============================================
      case 'createevent': {
        const name = args[0];
        const startTime = args[1];
        const entityType = args[2] || 'VOICE';
        if (!name || !startTime) {
          await message.reply('Usage: `!createevent <name> <startTime(ISO)> [VOICE|STAGE|EXTERNAL]`');
          return;
        }
        const result = await this.discordService.createEvent(guildId, name, startTime, entityType);
        await message.reply(result);
        break;
      }

      case 'deleteevent': {
        const eventId = args[0];
        if (!eventId) {
          await message.reply('Usage: `!deleteevent <eventId>`');
          return;
        }
        const result = await this.discordService.deleteEvent(guildId, eventId);
        await message.reply(result);
        break;
      }

      case 'events': {
        const result = await this.discordService.getEvents(guildId);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      // ============================================
      // INVITES
      // ============================================
      case 'createinvite': {
        const channelId = args[0]?.replace(/[<#>]/g, '') || message.channelId;
        const maxAge = parseInt(args[1]) || 86400;
        const maxUses = parseInt(args[2]) || 0;
        const result = await this.discordService.createInvite(channelId, maxAge, maxUses);
        await message.reply(result);
        break;
      }

      case 'deleteinvite': {
        const inviteCode = args[0];
        if (!inviteCode) {
          await message.reply('Usage: `!deleteinvite <inviteCode>`');
          return;
        }
        const result = await this.discordService.deleteInvite(inviteCode);
        await message.reply(result);
        break;
      }

      case 'invites': {
        const result = await this.discordService.getInvites(guildId);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      // ============================================
      // EMOJIS
      // ============================================
      case 'createemoji': {
        const name = args[0];
        const imageUrl = args[1];
        if (!name || !imageUrl) {
          await message.reply('Usage: `!createemoji <name> <imageUrl>`');
          return;
        }
        const result = await this.discordService.createEmoji(guildId, name, imageUrl);
        await message.reply(result);
        break;
      }

      case 'deleteemoji': {
        const emojiId = args[0];
        if (!emojiId) {
          await message.reply('Usage: `!deleteemoji <emojiId>`');
          return;
        }
        const result = await this.discordService.deleteEmoji(guildId, emojiId);
        await message.reply(result);
        break;
      }

      case 'emojis': {
        const result = await this.discordService.getEmojis(guildId);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      // ============================================
      // STICKERS
      // ============================================
      case 'createsticker': {
        const name = args[0];
        const description = args[1];
        const tags = args[2];
        const imageUrl = args[3];
        if (!name || !description || !tags || !imageUrl) {
          await message.reply('Usage: `!createsticker <name> <description> <tags> <imageUrl>`');
          return;
        }
        const result = await this.discordService.createSticker(guildId, name, description, tags, imageUrl);
        await message.reply(result);
        break;
      }

      case 'deletesticker': {
        const stickerId = args[0];
        if (!stickerId) {
          await message.reply('Usage: `!deletesticker <stickerId>`');
          return;
        }
        const result = await this.discordService.deleteSticker(guildId, stickerId);
        await message.reply(result);
        break;
      }

      case 'stickers': {
        const result = await this.discordService.getStickers(guildId);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      // ============================================
      // AUTOMOD
      // ============================================
      case 'automodrules':
      case 'automod': {
        const result = await this.discordService.getAutomodRules(guildId);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      case 'deleteautomod': {
        const ruleId = args[0];
        if (!ruleId) {
          await message.reply('Usage: `!deleteautomod <ruleId>`');
          return;
        }
        const result = await this.discordService.deleteAutomodRule(guildId, ruleId);
        await message.reply(result);
        break;
      }

      // ============================================
      // EMBEDS & COMPONENTS
      // ============================================
      case 'embed': {
        const channelId = args[0]?.replace(/[<#>]/g, '') || message.channelId;
        const title = args[1];
        const description = args.slice(2).join(' ');
        if (!title || !description) {
          await message.reply('Usage: `!embed [#channel] <title> <description>`');
          return;
        }
        const result = await this.discordService.sendEmbed(channelId, title, description);
        await message.reply(result);
        break;
      }

      // ============================================
      // FILE UPLOAD
      // ============================================
      case 'upload': {
        const channelId = SecurityUtils.sanitizeSnowflake(args[0]?.replace(/[<#>]/g, '')) || message.channelId;
        const filePath = args[1];
        const fileName = args[2];
        if (!filePath) {
          await message.reply('Usage: `!upload [#channel] <filePath> [fileName]`');
          return;
        }
        // SECURITY: Validate file path to prevent path traversal attacks
        const pathCheck = SecurityUtils.isValidFilePath(filePath);
        if (!pathCheck.valid) {
          await message.reply(`⚠️ Security error: ${pathCheck.reason}`);
          return;
        }
        const result = await this.discordService.uploadFile(channelId, filePath, fileName);
        await message.reply(result);
        break;
      }

      // ============================================
      // ADDITIONAL MISSING COMMANDS
      // ============================================

      // Edit Event
      case 'editevent': {
        const eventId = args[0];
        const name = args[1];
        const startTime = args[2];
        if (!eventId || !name) {
          await message.reply('Usage: `!editevent <eventId> <newName> [newStartTimeISO]`');
          return;
        }
        const result = await this.discordService.editEvent(guildId, eventId, name, startTime);
        await message.reply(result);
        break;
      }

      // Create AutoMod Rule
      case 'createautomod': {
        const name = args[0];
        const triggerType = args[1] || 'KEYWORD';
        if (!name) {
          await message.reply('Usage: `!createautomod <ruleName> [triggerType]`\nTrigger types: KEYWORD, SPAM, KEYWORD_PRESET, MENTION_SPAM');
          return;
        }
        const result = await this.discordService.createAutomodRule(guildId, name, triggerType);
        await message.reply(result);
        break;
      }

      // Edit AutoMod Rule
      case 'editautomod': {
        const ruleId = args[0];
        const name = args[1];
        if (!ruleId) {
          await message.reply('Usage: `!editautomod <ruleId> [newName]`');
          return;
        }
        const result = await this.discordService.editAutomodRule(guildId, ruleId, name);
        await message.reply(result);
        break;
      }

      // Edit Server
      case 'editserver': {
        const setting = args[0];
        const value = args.slice(1).join(' ');
        if (!setting || !value) {
          await message.reply('Usage: `!editserver <setting> <value>`\nSettings: name, description, afkTimeout');
          return;
        }
        const options: any = {};
        options[setting] = setting === 'afkTimeout' ? parseInt(value) : value;
        const result = await this.discordService.editServer(guildId, options);
        await message.reply(result);
        break;
      }

      // Edit Welcome Screen
      case 'editwelcome': {
        const enabled = args[0] === 'true' || args[0] === 'on';
        const description = args.slice(1).join(' ') || undefined;
        const result = await this.discordService.editWelcomeScreen(guildId, enabled, description);
        await message.reply(result);
        break;
      }

      // Send Button
      case 'button': {
        const channelId = args[0]?.replace(/[<#>]/g, '') || message.channelId;
        const label = args[1];
        const content = args.slice(2).join(' ') || 'Click the button!';
        if (!label) {
          await message.reply('Usage: `!button [#channel] <buttonLabel> [message]`');
          return;
        }
        const buttons = [{ label, style: 'PRIMARY', customId: `btn_${Date.now()}` }];
        const result = await this.discordService.sendButton(channelId, content, buttons);
        await message.reply(result);
        break;
      }

      // Send Select Menu
      case 'selectmenu': {
        const channelId = args[0]?.replace(/[<#>]/g, '') || message.channelId;
        const placeholder = args[1] || 'Select an option';
        const options = args.slice(2).join(' ').split(',').map((opt, i) => ({
          label: opt.trim(),
          value: `option_${i}`,
          description: `Option ${i + 1}`
        }));
        if (options.length === 0 || !options[0].label) {
          await message.reply('Usage: `!selectmenu [#channel] <placeholder> <option1,option2,option3>`');
          return;
        }
        const customId = `select_${Date.now()}`;
        const result = await this.discordService.sendSelectMenu(channelId, 'Select an option:', customId, placeholder, 1, 1, options);
        await message.reply(result);
        break;
      }

      // Read Images (OCR)
      case 'readimages':
      case 'ocr': {
        const channelId = args[0]?.replace(/[<#>]/g, '') || message.channelId;
        const limit = parseInt(args[1]) || 5;
        const result = await this.discordService.readImages(channelId, undefined, limit);
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      // Set Role Positions (batch)
      case 'setrolepositions': {
        // Format: roleId:position,roleId:position
        const positionsStr = args.join(' ');
        if (!positionsStr) {
          await message.reply('Usage: `!setrolepositions <roleId:position,roleId:position,...>`');
          return;
        }
        const positions = positionsStr.split(',').map(p => {
          const [roleId, pos] = p.trim().split(':');
          return { roleId: roleId.replace(/[<@&>]/g, ''), position: parseInt(pos) };
        });
        const result = await this.discordService.setRolePositions(guildId, positions);
        await message.reply(result);
        break;
      }

      // Set Channel Positions (batch)
      case 'setchannelpositions': {
        // Format: channelId:position,channelId:position
        const positionsStr = args.join(' ');
        if (!positionsStr) {
          await message.reply('Usage: `!setchannelpositions <channelId:position,channelId:position,...>`');
          return;
        }
        const positions = positionsStr.split(',').map(p => {
          const [channelId, pos] = p.trim().split(':');
          return { channelId: channelId.replace(/[<#>]/g, ''), position: parseInt(pos) };
        });
        const result = await this.discordService.setChannelPositions(guildId, positions);
        await message.reply(result);
        break;
      }

      // Set Channel Permissions
      case 'setchannelperms': {
        const channelId = args[0]?.replace(/[<#>]/g, '');
        const targetId = args[1]?.replace(/[<@&!>]/g, '');
        const permission = args[2];
        const allow = args[3] !== 'deny';
        if (!channelId || !targetId || !permission) {
          await message.reply('Usage: `!setchannelperms <#channel> <@role/@user> <permission> [allow|deny]`\nPermissions: VIEW_CHANNEL, SEND_MESSAGES, MANAGE_MESSAGES, etc.');
          return;
        }
        const perms = allow ? { allow: [permission] } : { deny: [permission] };
        const result = await this.discordService.setChannelPermissions(channelId, targetId, 'role', perms);
        await message.reply(result);
        break;
      }

      // Bulk Set Privacy
      case 'bulkprivacy': {
        const action = args[0]; // 'private' or 'public'
        const channelIds = args.slice(1).map(id => id.replace(/[<#>]/g, ''));
        if (!action || channelIds.length === 0) {
          await message.reply('Usage: `!bulkprivacy <private|public> <#channel1> <#channel2> ...`');
          return;
        }
        const targets = channelIds.map(channelId => ({
          type: 'channel' as const,
          id: channelId,
          isPrivate: action === 'private'
        }));
        const result = await this.discordService.bulkSetPrivacy(guildId, targets);
        await message.reply(result);
        break;
      }

      // Organize Channels
      case 'organize': {
        // This is a complex operation - simplified version
        await message.reply('Use `!structure` to view current layout, then use `!movechannel` and `!setchannelposition` to reorganize.');
        break;
      }

      // Get specific ban info
      case 'getban': {
        const userId = args[0]?.replace(/[<@!>]/g, '');
        if (!userId) {
          await message.reply('Usage: `!getban <userId>`');
          return;
        }
        // We don't have getBan specifically, but getBans works
        const result = await this.discordService.getBans(guildId);
        // Filter to find specific user
        await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
        break;
      }

      // Typing indicator
      case 'typing': {
        const channelId = args[0]?.replace(/[<#>]/g, '') || message.channelId;
        const channel = message.guild?.channels.cache.get(channelId) as TextChannel;
        if (channel) {
          await channel.sendTyping();
          await message.reply('Typing indicator sent!');
        }
        break;
      }

      // Get Guild Integrations (bots, apps)
      case 'integrations': {
        const guild = message.guild;
        if (!guild) return;
        const integrations = await guild.fetchIntegrations();
        const list = integrations.map(i => `${i.name} (${i.type})`).join('\n');
        await message.reply(`\`\`\`\nIntegrations:\n${list || 'None'}\n\`\`\``);
        break;
      }

      // Get Voice Regions
      case 'voiceregions': {
        const guild = message.guild;
        if (!guild) return;
        // Voice regions are now fetched via the REST API
        const regions = await this.discordService.getClient().rest.get('/voice/regions') as Array<{id: string, name: string, optimal?: boolean}>;
        const list = regions.map((r) => `${r.name} ${r.optimal ? '(optimal)' : ''}`).join('\n');
        await message.reply(`\`\`\`\nVoice Regions:\n${list}\n\`\`\``);
        break;
      }

      // Preview Prune
      case 'previewprune': {
        const days = parseInt(args[0]) || 7;
        if (days < 1 || days > 30) {
          await message.reply('Usage: `!previewprune [days]` (1-30)');
          return;
        }
        const guild = message.guild;
        if (!guild) return;
        const count = await guild.members.prune({ dry: true, days });
        await message.reply(`Prune preview: ${count} members would be removed (inactive ${days}+ days)`);
        break;
      }

      // Prune Members
      case 'prune': {
        const days = parseInt(args[0]) || 7;
        const reason = args.slice(1).join(' ') || 'Inactive member cleanup';
        if (days < 1 || days > 30) {
          await message.reply('Usage: `!prune [days] [reason]` (1-30 days)');
          return;
        }
        const guild = message.guild;
        if (!guild) return;

        // SECURITY: Prune is destructive - require confirmation via --confirm flag
        const hasConfirm = args.includes('--confirm');
        if (!hasConfirm) {
          // Preview the prune first
          const previewCount = await guild.members.prune({ days, dry: true });
          await message.reply(
            `⚠️ **Prune Preview**\n` +
            `This will remove **${previewCount}** members who have been inactive for ${days}+ days.\n\n` +
            `To confirm, run: \`!prune ${days} --confirm ${reason}\``
          );
          return;
        }

        const count = await guild.members.prune({ days, reason });
        await message.reply(`✅ Pruned ${count} inactive members (${days}+ days inactive)`);
        break;
      }

      // List Archived Threads
      case 'archivedthreads': {
        const channelId = args[0]?.replace(/[<#>]/g, '') || message.channelId;
        const channel = message.guild?.channels.cache.get(channelId) as TextChannel;
        if (!channel || !('threads' in channel)) {
          await message.reply('Invalid channel');
          return;
        }
        const archived = await channel.threads.fetchArchived({ type: 'public', limit: 10 });
        const list = archived.threads.map(t => `${t.name} (${t.id})`).join('\n');
        await message.reply(`\`\`\`\nArchived Threads:\n${list || 'None'}\n\`\`\``);
        break;
      }

      // Add Thread Member
      case 'addthreadmember': {
        const threadId = args[0]?.replace(/[<#>]/g, '');
        const userId = args[1]?.replace(/[<@!>]/g, '');
        if (!threadId || !userId) {
          await message.reply('Usage: `!addthreadmember <#thread> <@user>`');
          return;
        }
        const thread = message.guild?.channels.cache.get(threadId);
        if (thread?.isThread()) {
          await thread.members.add(userId);
          await message.reply('Added user to thread!');
        }
        break;
      }

      // Remove Thread Member
      case 'removethreadmember': {
        const threadId = args[0]?.replace(/[<#>]/g, '');
        const userId = args[1]?.replace(/[<@!>]/g, '');
        if (!threadId || !userId) {
          await message.reply('Usage: `!removethreadmember <#thread> <@user>`');
          return;
        }
        const thread = message.guild?.channels.cache.get(threadId);
        if (thread?.isThread()) {
          await thread.members.remove(userId);
          await message.reply('Removed user from thread!');
        }
        break;
      }

      // List Thread Members
      case 'threadmembers': {
        const threadId = args[0]?.replace(/[<#>]/g, '');
        if (!threadId) {
          await message.reply('Usage: `!threadmembers <#thread>`');
          return;
        }
        const thread = message.guild?.channels.cache.get(threadId);
        if (thread?.isThread()) {
          const members = await thread.members.fetch();
          const list = members.map(m => m.user?.tag || m.id).join('\n');
          await message.reply(`\`\`\`\nThread Members:\n${list}\n\`\`\``);
        }
        break;
      }

      // Delete All Reactions
      case 'clearreactions': {
        const channelId = args[0]?.replace(/[<#>]/g, '');
        const messageId = args[1];
        if (!channelId || !messageId) {
          await message.reply('Usage: `!clearreactions <#channel> <messageId>`');
          return;
        }
        const channel = message.guild?.channels.cache.get(channelId) as TextChannel;
        if (channel) {
          const msg = await channel.messages.fetch(messageId);
          await msg.reactions.removeAll();
          await message.reply('All reactions removed!');
        }
        break;
      }

      // Delete Reactions by Emoji
      case 'clearemoji': {
        const channelId = args[0]?.replace(/[<#>]/g, '');
        const messageId = args[1];
        const emoji = args[2];
        if (!channelId || !messageId || !emoji) {
          await message.reply('Usage: `!clearemoji <#channel> <messageId> <emoji>`');
          return;
        }
        const channel = message.guild?.channels.cache.get(channelId) as TextChannel;
        if (channel) {
          const msg = await channel.messages.fetch(messageId);
          const reaction = msg.reactions.cache.find(r => r.emoji.name === emoji || r.emoji.toString() === emoji);
          if (reaction) {
            await reaction.remove();
            await message.reply(`Removed all ${emoji} reactions!`);
          }
        }
        break;
      }

      // Follow Announcement Channel
      case 'follow': {
        const sourceChannelId = args[0]?.replace(/[<#>]/g, '');
        const targetChannelId = args[1]?.replace(/[<#>]/g, '') || message.channelId;
        if (!sourceChannelId) {
          await message.reply('Usage: `!follow <#announcementChannel> [#targetChannel]`');
          return;
        }
        const sourceChannel = message.guild?.channels.cache.get(sourceChannelId);
        if (sourceChannel?.type === 5) { // Announcement channel
          await (sourceChannel as any).addFollower(targetChannelId);
          await message.reply('Now following the announcement channel!');
        } else {
          await message.reply('Source must be an announcement channel');
        }
        break;
      }

      // Get Guild Vanity URL
      case 'vanityurl': {
        const guild = message.guild;
        if (!guild) return;
        try {
          const vanity = await guild.fetchVanityData();
          await message.reply(`Vanity URL: discord.gg/${vanity.code} (${vanity.uses} uses)`);
        } catch {
          await message.reply('This server does not have a vanity URL');
        }
        break;
      }

      // Guild Templates
      case 'templates': {
        const guild = message.guild;
        if (!guild) return;
        const templates = await guild.fetchTemplates();
        const list = templates.map(t => `${t.name}: ${t.code}`).join('\n');
        await message.reply(`\`\`\`\nServer Templates:\n${list || 'None'}\n\`\`\``);
        break;
      }

      // Create Template
      case 'createtemplate': {
        const name = args[0];
        const description = args.slice(1).join(' ');
        if (!name) {
          await message.reply('Usage: `!createtemplate <name> [description]`');
          return;
        }
        const guild = message.guild;
        if (!guild) return;
        const template = await guild.createTemplate(name, description);
        await message.reply(`Template created! Code: ${template.code}`);
        break;
      }

      // Sync Template
      case 'synctemplate': {
        const code = args[0];
        if (!code) {
          await message.reply('Usage: `!synctemplate <templateCode>`');
          return;
        }
        const guild = message.guild;
        if (!guild) return;
        const templates = await guild.fetchTemplates();
        const template = templates.find(t => t.code === code);
        if (template) {
          await template.sync();
          await message.reply('Template synced with current server state!');
        } else {
          await message.reply('Template not found');
        }
        break;
      }

      // Delete Template
      case 'deletetemplate': {
        const code = args[0];
        if (!code) {
          await message.reply('Usage: `!deletetemplate <templateCode>`');
          return;
        }
        const guild = message.guild;
        if (!guild) return;
        const templates = await guild.fetchTemplates();
        const template = templates.find(t => t.code === code);
        if (template) {
          await template.delete();
          await message.reply('Template deleted!');
        } else {
          await message.reply('Template not found');
        }
        break;
      }

      // Get Sticker Packs (Nitro)
      case 'stickerpacks': {
        const packs = await message.client.fetchPremiumStickerPacks();
        const list = packs.map(p => p.name).join('\n');
        await message.reply(`\`\`\`\nNitro Sticker Packs:\n${list.substring(0, 1900)}\n\`\`\``);
        break;
      }

      // Update My Nickname
      case 'mynick': {
        const newNick = args.join(' ') || null;
        const me = message.guild?.members.me;
        if (me) {
          await me.setNickname(newNick);
          await message.reply(newNick ? `Nickname changed to: ${newNick}` : 'Nickname reset');
        }
        break;
      }

      // Get Widget Settings
      case 'widgetsettings': {
        const guild = message.guild;
        if (!guild) return;
        const settings = await guild.fetchWidgetSettings();
        await message.reply(`\`\`\`\nWidget Enabled: ${settings.enabled}\nChannel: ${settings.channel?.name || 'None'}\n\`\`\``);
        break;
      }

      // Set Widget Settings
      case 'setwidget': {
        const enabled = args[0] === 'on' || args[0] === 'true';
        const channelId = args[1]?.replace(/[<#>]/g, '');
        const guild = message.guild;
        if (!guild) return;
        await guild.setWidgetSettings({ enabled, channel: channelId || null });
        await message.reply(`Widget ${enabled ? 'enabled' : 'disabled'}${channelId ? ` in channel ${channelId}` : ''}`);
        break;
      }

      // Get Guild Preview
      case 'preview': {
        const guildId = args[0] || message.guildId;
        try {
          const preview = await message.client.fetchGuildPreview(guildId!);
          await message.reply(`\`\`\`\n${preview.name}\nMembers: ~${preview.approximateMemberCount}\nOnline: ~${preview.approximatePresenceCount}\nFeatures: ${preview.features.join(', ')}\n\`\`\``);
        } catch {
          await message.reply('Could not fetch preview (server may not be discoverable)');
        }
        break;
      }

      // ============================================
      // HELP
      // ============================================
      case 'help': {
        // Split into multiple messages to stay under 2000 char limit
        const helpMessages = [
          `**📋 Bot Commands (1/2)**

**Info:** \`!ping\` \`!serverinfo\` \`!up\` \`!channels\` \`!roles\` \`!members\` \`!memberinfo\` \`!structure\` \`!widget\` \`!preview\` \`!vanityurl\` \`!integrations\` \`!voiceregions\`

**World of Warships:**
  • \`!wows PlayerName\` - Player stats
  • \`!ships PlayerName\` - Top 10 ships by battles
  • \`!allships PlayerName\` - ALL ships (grouped by tier)
  • \`!clan DROVA\` - Clan info by tag or name

**Channels:** \`!createchannel\` \`!createvoice\` \`!createforum\` \`!createannouncement\` \`!createstage\` \`!deletechannel\` \`!editchannel\` \`!movechannel\` \`!setchannelpositions\` \`!setchannelperms\` \`!bulkprivacy\`

**Categories:** \`!createcategory\` \`!deletecategory\` \`!findcategory\` \`!listincategory\`

**Roles:** \`!createrole\` \`!deleterole\` \`!editrole\` \`!setrolepositions\` \`!addrole\` \`!removerole\`

**Moderation:** \`!kick\` \`!ban\` \`!unban\` \`!timeout\` \`!removetimeout\` \`!bulkdelete\` \`!auditlog\` \`!bans\` \`!prune\` \`!previewprune\`

**Messages:** \`!send\` \`!edit\` \`!delete\` \`!read\` \`!pin\` \`!unpin\` \`!pinned\` \`!react\` \`!clearreactions\` \`!clearemoji\` \`!exportchat\` \`!follow\` \`!typing\`

**DMs:** \`!dm\` \`!editdm\` \`!deletedm\` \`!readdms\`

**Threads:** \`!createthread\` \`!threads\` \`!archivethread\` \`!unarchivethread\` \`!lockthread\` \`!unlockthread\` \`!addthreadmember\` \`!removethreadmember\` \`!threadmembers\` \`!archivedthreads\``,

          `**📋 Bot Commands (2/2)**

**AI Chat:** \`!ask\` \`!voice\` or just @mention the bot

**Image Generation:** \`!image\` \`!imagine\` \`!img\` \`!imagemodels\`
  • Example: \`!image a battleship at sunset\`
  • With model: \`!image --model=flux-anime a cute cat\`
  • With size: \`!image --size=1024x768 landscape\`

**Webhooks:** \`!createwebhook\` \`!deletewebhook\` \`!webhooks\` \`!webhooksend\`

**Voice/TTS:** \`!join\` \`!leave\` \`!say\` \`!voices\` \`!setvoice\` \`!lockvoice\` \`!unlockvoice\` \`!voicestatus\`

**Music:** \`!play\` \`!skip\` \`!stop\` \`!pause\` \`!resume\` \`!queue\` \`!np\` \`!volume\` \`!loop\`

**Events:** \`!createevent\` \`!editevent\` \`!deleteevent\` \`!events\`

**Invites:** \`!createinvite\` \`!deleteinvite\` \`!invites\`

**Emojis/Stickers:** \`!createemoji\` \`!deleteemoji\` \`!emojis\` \`!createsticker\` \`!deletesticker\` \`!stickers\` \`!stickerpacks\`

**Server Settings:** \`!editserver\` \`!editwelcome\` \`!widgetsettings\` \`!setwidget\` \`!mynick\`

**AutoMod:** \`!automod\` \`!createautomod\` \`!editautomod\` \`!deleteautomod\`

**Templates:** \`!templates\` \`!createtemplate\` \`!synctemplate\` \`!deletetemplate\`

**Interactive:** \`!button\` \`!selectmenu\`

**Fun:** \`!8ball\` \`!bread\`

**Other:** \`!embed\` \`!userid\` \`!searchmembers\` \`!readimages\``
        ];

        // Send all help messages via DM
        try {
          for (const msg of helpMessages) {
            await message.author.send(msg);
          }
          // Delete the user's !help command to keep channel clean
          await message.delete().catch(() => {});
        } catch {
          // If DMs are disabled, fall back to channel reply
          for (const msg of helpMessages) {
            await message.reply(msg);
          }
        }
        break;
      }

      case 'bread':
      case 'breadsticks':
      case 'breadstick':
      case 'carbs': {
        const breadImages = [
          { url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800', name: 'Artisan Breadsticks', desc: 'Classic Italian grissini - thin, crispy, and perfect for dipping in olive oil or balsamic.' },
          { url: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=800', name: 'Fresh Baguette', desc: 'A crusty French baguette with a soft, airy interior. The gold standard of bread.' },
          { url: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=800', name: 'Sourdough Loaf', desc: 'Naturally leavened with wild yeast, tangy flavor, and that iconic ear crust.' },
          { url: 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=800', name: 'Ciabatta', desc: 'Italian slipper bread - chewy, holey, and ideal for sandwiches and paninis.' },
          { url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800', name: 'Croissants', desc: 'Buttery, flaky, laminated perfection. 27 layers of pure carb heaven.' },
          { url: 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=800', name: 'Pretzel Bread', desc: 'Soft, chewy, with that distinctive lye-dipped crust and coarse salt topping.' },
          { url: 'https://images.unsplash.com/photo-1574085733277-851d9d856a3a?w=800', name: 'Focaccia', desc: 'Thick, dimpled Italian flatbread drizzled with olive oil and herbs. Chef\'s kiss.' },
          { url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800', name: 'Olive Garden Breadsticks', desc: 'The legendary unlimited breadsticks. Soft, buttery, garlicky. A cultural icon.' },
          { url: 'https://images.unsplash.com/photo-1600398538467-4ef7bba0a711?w=800', name: 'Challah', desc: 'Braided Jewish bread, slightly sweet and incredibly rich with eggs.' },
          { url: 'https://images.unsplash.com/photo-1603984042729-13190fc392c0?w=800', name: 'Rye Bread', desc: 'Dense, earthy, with caraway seeds. Perfect for deli sandwiches and toast.' },
          { url: 'https://images.unsplash.com/photo-1612240498936-65f5101365d2?w=800', name: 'Naan', desc: 'Soft, pillowy Indian flatbread. Best served hot from the tandoor with butter.' },
          { url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800', name: 'Brioche', desc: 'Rich, buttery French bread that blurs the line between bread and pastry.' },
          { url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800', name: 'Garlic Knots', desc: 'Twisted dough bombs of garlic butter and parsley. Pizza shop essential.' },
          { url: 'https://images.unsplash.com/photo-1587241321921-91a834d6d191?w=800', name: 'Pita Bread', desc: 'Pocket bread from the Middle East. Perfect for hummus, falafel, and gyros.' }
        ];

        const guildId = message.guild?.id || 'dm';
        let history = this.breadHistory.get(guildId) || [];

        // Reset history if we've shown all breads
        if (history.length >= breadImages.length - 1) {
          history = [];
        }

        // Pick random bread not in recent history
        let breadIndex: number;
        do {
          breadIndex = Math.floor(Math.random() * breadImages.length);
        } while (history.includes(breadIndex));

        history.push(breadIndex);
        this.breadHistory.set(guildId, history);

        const bread = breadImages[breadIndex];
        const funMessages = [
          '🍞 Fresh from the oven!',
          '🥖 Carb loading initiated...',
          '🥐 Gluten gang rise up!',
          '🍞 *bread noises*',
          '🥖 Unlimited breadsticks? Unlimited breadsticks.',
          '🍞 Bread 👍',
          '🥐 Low carb? Never heard of her.',
          '🍞 The yeast you could do is enjoy this.',
          '🥖 Proof that good things take time to rise.',
          '🍞 Knead I say more?'
        ];
        const randomMessage = funMessages[Math.floor(Math.random() * funMessages.length)];

        const embed = new EmbedBuilder()
          .setColor(0xD4A574)
          .setTitle(`🥖 ${bread.name}`)
          .setDescription(`${randomMessage}\n\n*${bread.desc}*`)
          .setImage(bread.url)
          .setFooter({ text: `Bread #${breadIndex + 1} of ${breadImages.length} • !bread for more carbs` });

        await message.reply({ embeds: [embed] });
        break;
      }

      default:
        // Unknown command - ignore silently
        break;
    }
  }

  /**
   * Handle @bot mentions for natural AI chat
   */
  private async handleMention(message: Message): Promise<void> {
    const aiService = getAIService();

    // Remove the bot mention from the message to get the actual question
    const question = message.content
      .replace(/<@!?\d+>/g, '') // Remove all mentions
      .trim();

    if (!question) {
      await message.reply("Hey! You can ask me anything. Just @mention me with your question!");
      return;
    }

    // Rate limiting for mentions
    const cooldownCheck = SecurityUtils.checkCooldown(message.author.id, 'ai_mention', 5000);
    if (!cooldownCheck.allowed) {
      const remainingSec = Math.ceil((cooldownCheck.remainingMs || 0) / 1000);
      await message.reply(`Please wait ${remainingSec}s before asking again.`);
      return;
    }

    // Show typing indicator while processing
    if ('sendTyping' in message.channel) {
      await message.channel.sendTyping();
    }

    // Callback to notify user when provider fails and retrying
    const onRetry: OnRetryCallback = async (failedProvider, nextProvider, error) => {
      try {
        await (message.channel as TextChannel).send(`⚠️ \`${failedProvider}\` failed, trying \`${nextProvider}\`...`);
        if ('sendTyping' in message.channel) {
          await message.channel.sendTyping();
        }
      } catch {
        // Ignore errors sending retry message
      }
    };

    try {
      // Add context about who's asking
      const context = `User ${message.author.username} is asking in the ${message.guild?.name || 'DM'} server.`;
      let response = await aiService.chat(question, context, onRetry);

      // Content filter - don't send or speak inappropriate AI responses
      const mentionAiCheck = SecurityUtils.containsBlockedContent(response);
      if (mentionAiCheck.blocked) {
        response = "I can't respond to that in an appropriate way. Let's talk about something else!";
      }

      // Split long responses if needed
      if (response.length > 1900) {
        await message.reply(response.substring(0, 1900) + '...');
      } else {
        await message.reply(response);
      }

      // If bot is in a voice channel in this guild, also speak the response
      if (message.guildId) {
        try {
          const ttsText = response.length > 500 ? response.substring(0, 497) + '...' : response;
          await this.discordService.speakText(message.guildId, ttsText);
        } catch {
          // Not in voice channel - that's fine
        }
      }
    } catch (error) {
      await message.reply(`Sorry, I had trouble thinking about that: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
