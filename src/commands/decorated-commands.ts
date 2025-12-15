/**
 * Example Prefix Commands using Decorator System
 *
 * These show the NecordJS-like ergonomics for prefix commands.
 * Much cleaner than the giant switch statement!
 */

import { Message, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { z } from 'zod';
import { DiscordService } from '../discord-service.js';
import {
  Command,
  Arg,
  Args,
  Alias,
  Category,
  Cooldown,
  AdminOnly,
  ModOnly,
  RequirePermission,
  UseGuard,
  UseInterceptor,
  ValidateWith,
  PrefixGuards,
  PrefixInterceptors,
} from '../decorators/prefix.js';
import { getFullPlayerInfo, searchPlayerSuggestions, getPlayerShipsFormatted, formatTier, getFullClanInfo, searchClanSuggestions, type FormattedShipStats, type FormattedStats } from '../services/wargaming-api.js';
import { AttachmentBuilder } from 'discord.js';

// ============================================
// DECORATED COMMANDS CLASS
// ============================================

export class DecoratedCommands {
  constructor(private discord: DiscordService) {}

  // ============================================
  // INFO COMMANDS
  // ============================================

  @Category('Info')
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'ping', description: 'Check bot latency' })
  async ping(message: Message) {
    const sent = await message.reply('Pinging...');
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const wsLatency = message.client.ws.ping;
    await sent.edit(`🏓 **Pong!** Latency: ${latency}ms | WebSocket: ${wsLatency}ms`);
  }

  @Category('Info')
  @Alias('server', 'guild')
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'serverinfo', description: 'Get server information' })
  async serverInfo(message: Message) {
    const result = await this.discord.getServerInfo();
    await message.reply(`\`\`\`\n${result}\n\`\`\``);
  }

  @Category('Info')
  @Arg({ name: 'limit', type: 'number', required: false })
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'members', description: 'List server members', usage: '!members [limit]' })
  async members(message: Message, args: { limit?: number }) {
    const limit = args.limit || 20;
    const result = await this.discord.getMembers(message.guildId!, limit);
    await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
  }

  @Category('Info')
  @Alias('user', 'whois')
  @Arg({ name: 'user', type: 'user', required: true })
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'memberinfo', description: 'Get user information', usage: '!memberinfo @user' })
  async memberInfo(message: Message, args: { user: string }) {
    const result = await this.discord.getMemberInfo(message.guildId!, args.user);
    await message.reply(`\`\`\`\n${result}\n\`\`\``);
  }

  // ============================================
  // WORLD OF WARSHIPS COMMANDS
  // ============================================

  @Category('WoWS')
  @Alias('wows', 'player', 'lookup')
  @Cooldown(5)
  @UseInterceptor(PrefixInterceptors.typing)
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'stats', description: 'Look up World of Warships player stats and ships', usage: '!stats <username>' })
  async stats(message: Message, args: {}, rawArgs: string[]) {
    const username = rawArgs.join(' ').trim();

    if (!username) {
      await message.reply('Please provide a WoWS username. Usage: `!stats <username>`');
      return;
    }

    if (username.length < 3) {
      await message.reply('Username must be at least 3 characters.');
      return;
    }

    try {
      // Fetch player info and ship stats in parallel
      const [playerInfo, shipResult] = await Promise.all([
        getFullPlayerInfo(username),
        getPlayerShipsFormatted(username, { sortBy: 'battles', limit: 200 }),
      ]);

      if (!playerInfo) {
        const suggestions = await searchPlayerSuggestions(username);
        if (suggestions.length > 0) {
          await message.reply(`Player not found. Did you mean: **${suggestions.join('**, **')}**?`);
        } else {
          await message.reply(`Player "${username}" not found on NA server.`);
        }
        return;
      }

      // PR color config
      const prConfig: Record<string, { color: number }> = {
        'Unicum': { color: 0x9900cc },
        'Great': { color: 0x02c9b3 },
        'Very Good': { color: 0x318000 },
        'Good': { color: 0x44b300 },
        'Average': { color: 0xffc71f },
        'Below Average': { color: 0xfe7903 },
        'Bad': { color: 0xfe0e00 },
        'Hidden': { color: 0x808080 },
        'No PvP Data': { color: 0x808080 },
      };

      const config = prConfig[playerInfo.prRating] || { color: 0x00D4FF };
      const wowsNumbersUrl = `https://na.wows-numbers.com/player/${playerInfo.accountId},${encodeURIComponent(playerInfo.nickname)}/`;

      // Build the embed (compact summary)
      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setAuthor({
          name: 'World of Warships Stats',
          url: 'https://na.wows-numbers.com'
        })
        .setTitle(`${playerInfo.clan ? `[${playerInfo.clan.tag}] ` : ''}${playerInfo.nickname}`)
        .setURL(wowsNumbersUrl);

      if (playerInfo.hiddenProfile) {
        embed.setDescription('This player has set their profile to **private**.');
        await message.reply({ embeds: [embed] });
        return;
      } else if (playerInfo.battles === 0) {
        embed.setDescription('This player has no PvP battle data.');
        await message.reply({ embeds: [embed] });
        return;
      }

      // Win rate indicator
      const winRate = parseFloat(playerInfo.winRate);
      const wrEmoji = winRate >= 55 ? '🟢' : winRate >= 50 ? '🟡' : '🔴';

      // Compact description
      embed.setDescription(
        `**PR:** \`${playerInfo.pr.toLocaleString()}\` (${playerInfo.prRating})\n` +
        `**Battles:** \`${playerInfo.battles.toLocaleString()}\` | **WR:** \`${playerInfo.winRate}%\` ${wrEmoji} | **Avg Dmg:** \`${playerInfo.avgDamage.toLocaleString()}\`\n` +
        `**K/D:** \`${playerInfo.avgFrags}\` | **Survival:** \`${playerInfo.survivalRate}%\`` +
        (playerInfo.clan ? `\n**Clan:** [${playerInfo.clan.tag}] ${playerInfo.clan.name}` : '')
      );

      // Footer
      const footerParts = [];
      if (playerInfo.lastBattle) {
        const lastBattleDate = new Date(playerInfo.lastBattle * 1000);
        const daysAgo = Math.floor((Date.now() - lastBattleDate.getTime()) / (1000 * 60 * 60 * 24));
        footerParts.push(`Last battle: ${daysAgo}d ago`);
      }
      if (shipResult?.ships) {
        footerParts.push(`${shipResult.ships.length} ships played`);
      }
      footerParts.push('NA Server');
      embed.setFooter({ text: footerParts.join(' | ') });
      embed.setTimestamp();

      // Generate text file with full ship stats
      if (shipResult && shipResult.ships.length > 0) {
        const textContent = this.generateStatsTextFile(playerInfo, shipResult.ships);
        const attachment = new AttachmentBuilder(Buffer.from(textContent, 'utf-8'), {
          name: `${playerInfo.nickname}_stats.txt`,
        });

        // Add ship summary to embed
        const shipsByTier: Record<number, FormattedShipStats[]> = {};
        for (const ship of shipResult.ships) {
          if (!shipsByTier[ship.tier]) shipsByTier[ship.tier] = [];
          shipsByTier[ship.tier].push(ship);
        }

        const tierCounts = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
          .map(t => shipsByTier[t]?.length || 0)
          .filter((_, i) => [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1][i] >= 8 || shipsByTier[[11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1][i]]?.length);

        const tierSummary = [10, 9, 8].map(t => {
          const count = shipsByTier[t]?.length || 0;
          return `T${formatTier(t)}: ${count}`;
        }).join(' | ');

        embed.addFields({
          name: '🚢 Ships Summary',
          value: tierSummary + `\n*Full ship stats in attached file*`,
          inline: false,
        });

        await message.reply({ embeds: [embed], files: [attachment] });
      } else {
        await message.reply({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Error fetching WoWS stats:', error);
      await message.reply('Failed to fetch player stats. Please try again later.');
    }
  }

  @Category('WoWS')
  @Alias('claninfo', 'clanlookup')
  @Cooldown(5)
  @UseInterceptor(PrefixInterceptors.typing)
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'clan', description: 'Look up World of Warships clan info', usage: '!clan <tag or name>' })
  async clan(message: Message, args: {}, rawArgs: string[]) {
    const query = rawArgs.join(' ').trim();

    if (!query) {
      await message.reply('Please provide a clan tag or name. Usage: `!clan <tag or name>`');
      return;
    }

    if (query.length < 2) {
      await message.reply('Clan search must be at least 2 characters.');
      return;
    }

    try {
      const clanInfo = await getFullClanInfo(query);

      if (!clanInfo) {
        const suggestions = await searchClanSuggestions(query);
        if (suggestions.length > 0) {
          await message.reply(`Clan not found. Did you mean:\n${suggestions.map(s => `• ${s}`).join('\n')}`);
        } else {
          await message.reply(`Clan "${query}" not found on NA server.`);
        }
        return;
      }

      const wowsNumbersUrl = `https://na.wows-numbers.com/clan/${clanInfo.clanId},${encodeURIComponent(clanInfo.tag)}/`;

      // Calculate clan age
      const createdDate = new Date(clanInfo.createdAt * 1000);
      const ageInDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      const ageYears = Math.floor(ageInDays / 365);
      const ageMonths = Math.floor((ageInDays % 365) / 30);
      const ageStr = ageYears > 0 ? `${ageYears}y ${ageMonths}m` : `${ageMonths} months`;

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(clanInfo.isDisbanded ? 0x808080 : 0x00D4FF)
        .setAuthor({
          name: 'World of Warships Clan',
          url: 'https://na.wows-numbers.com'
        })
        .setTitle(`[${clanInfo.tag}] ${clanInfo.name}`)
        .setURL(wowsNumbersUrl);

      if (clanInfo.isDisbanded) {
        embed.setDescription('**This clan has been disbanded.**');
      } else {
        let description = `**Members:** \`${clanInfo.membersCount}/50\`\n`;
        description += `**Commander:** \`${clanInfo.leaderName}\`\n`;
        description += `**Founded:** ${createdDate.toLocaleDateString()} (${ageStr} ago)\n`;
        description += `**Founder:** \`${clanInfo.creatorName}\``;

        if (clanInfo.oldTag || clanInfo.oldName) {
          description += '\n\n**Previously:** ';
          if (clanInfo.oldTag && clanInfo.oldName) {
            description += `[${clanInfo.oldTag}] ${clanInfo.oldName}`;
          } else if (clanInfo.oldTag) {
            description += `[${clanInfo.oldTag}]`;
          } else if (clanInfo.oldName) {
            description += clanInfo.oldName;
          }
        }

        embed.setDescription(description);

        if (clanInfo.description) {
          // Truncate long descriptions
          const desc = clanInfo.description.length > 500
            ? clanInfo.description.substring(0, 497) + '...'
            : clanInfo.description;
          embed.addFields({
            name: 'Description',
            value: desc,
            inline: false,
          });
        }
      }

      embed.setFooter({ text: 'NA Server | Data from Wargaming API' });
      embed.setTimestamp();

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error fetching clan info:', error);
      await message.reply('Failed to fetch clan info. Please try again later.');
    }
  }

  /**
   * Generate a formatted text file with full player stats
   */
  private generateStatsTextFile(playerInfo: FormattedStats, ships: FormattedShipStats[]): string {
    const lines: string[] = [];
    const divider = '═'.repeat(70);
    const thinDivider = '─'.repeat(70);

    // Header
    lines.push(divider);
    lines.push(`  WORLD OF WARSHIPS PLAYER STATS`);
    lines.push(`  ${playerInfo.clan ? `[${playerInfo.clan.tag}] ` : ''}${playerInfo.nickname}`);
    lines.push(divider);
    lines.push('');

    // Overview
    lines.push('PLAYER OVERVIEW');
    lines.push(thinDivider);
    lines.push(`  PR Rating:     ${playerInfo.pr.toLocaleString()} (${playerInfo.prRating})`);
    lines.push(`  Total Battles: ${playerInfo.battles.toLocaleString()}`);
    lines.push(`  Win Rate:      ${playerInfo.winRate}%`);
    lines.push(`  Avg Damage:    ${playerInfo.avgDamage.toLocaleString()}`);
    lines.push(`  K/D Ratio:     ${playerInfo.avgFrags}`);
    lines.push(`  Survival:      ${playerInfo.survivalRate}%`);
    if (playerInfo.clan) {
      lines.push(`  Clan:          [${playerInfo.clan.tag}] ${playerInfo.clan.name}`);
    }
    if (playerInfo.lastBattle) {
      const lastBattleDate = new Date(playerInfo.lastBattle * 1000);
      lines.push(`  Last Battle:   ${lastBattleDate.toLocaleDateString()}`);
    }
    lines.push('');

    // Group ships by tier
    const shipsByTier: Record<number, FormattedShipStats[]> = {};
    for (const ship of ships) {
      if (!shipsByTier[ship.tier]) shipsByTier[ship.tier] = [];
      shipsByTier[ship.tier].push(ship);
    }

    // Ship type labels
    const typeLabels: Record<string, string> = {
      'Destroyer': 'DD',
      'Cruiser': 'CA',
      'Battleship': 'BB',
      'AirCarrier': 'CV',
      'Submarine': 'SS',
    };

    // Ships by tier (descending)
    const tiers = Object.keys(shipsByTier).map(Number).sort((a, b) => b - a);

    for (const tier of tiers) {
      const tierShips = shipsByTier[tier];
      tierShips.sort((a, b) => b.battles - a.battles);

      lines.push(`TIER ${formatTier(tier)} SHIPS (${tierShips.length} ships)`);
      lines.push(thinDivider);

      // Table header
      lines.push('  Type  Ship Name                    Battles   WR%    Avg Dmg    K/D');
      lines.push('  ' + '─'.repeat(66));

      for (const ship of tierShips) {
        const type = (typeLabels[ship.type] || '??').padEnd(4);
        const premium = ship.isPremium || ship.isSpecial ? '★' : ' ';
        const name = (ship.name + premium).padEnd(25).slice(0, 25);
        const battles = ship.battles.toString().padStart(7);
        const wr = (ship.winRate + '%').padStart(7);
        const dmg = ship.avgDamage.toLocaleString().padStart(10);
        const kd = ship.avgFrags.padStart(6);

        lines.push(`  ${type}  ${name}  ${battles}  ${wr}  ${dmg}  ${kd}`);
      }
      lines.push('');
    }

    // Summary stats by ship type
    lines.push('SUMMARY BY SHIP TYPE');
    lines.push(thinDivider);

    const shipsByType: Record<string, FormattedShipStats[]> = {};
    for (const ship of ships) {
      if (!shipsByType[ship.type]) shipsByType[ship.type] = [];
      shipsByType[ship.type].push(ship);
    }

    for (const [type, typeShips] of Object.entries(shipsByType)) {
      const totalBattles = typeShips.reduce((sum, s) => sum + s.battles, 0);
      const avgWr = typeShips.reduce((sum, s) => sum + parseFloat(s.winRate) * s.battles, 0) / totalBattles;
      const avgDmg = typeShips.reduce((sum, s) => sum + s.avgDamage * s.battles, 0) / totalBattles;

      const label = (typeLabels[type] || type).padEnd(12);
      lines.push(`  ${label} ${typeShips.length} ships | ${totalBattles.toLocaleString()} battles | ${avgWr.toFixed(2)}% WR | ${Math.round(avgDmg).toLocaleString()} avg dmg`);
    }
    lines.push('');

    // Footer
    lines.push(thinDivider);
    lines.push(`  Generated: ${new Date().toISOString()}`);
    lines.push(`  Data from: NA Server (api.worldofwarships.com)`);
    lines.push(divider);

    return lines.join('\n');
  }

  // ============================================
  // MODERATION COMMANDS
  // ============================================

  @Category('Moderation')
  @ModOnly()
  @Alias('b')
  @Args([
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'string', rest: true }
  ])
  @UseInterceptor(PrefixInterceptors.errorHandler)
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'ban', description: 'Ban a member', usage: '!ban @user [reason]' })
  async ban(message: Message, args: { user: string; reason?: string }) {
    const result = await this.discord.banMember(
      message.guildId!,
      args.user,
      args.reason || 'No reason provided'
    );
    await message.reply(result);
  }

  @Category('Moderation')
  @ModOnly()
  @Arg({ name: 'userId', type: 'string', required: true })
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'unban', description: 'Unban a member', usage: '!unban <userId>' })
  async unban(message: Message, args: { userId: string }) {
    const result = await this.discord.unbanMember(message.guildId!, args.userId);
    await message.reply(result);
  }

  @Category('Moderation')
  @ModOnly()
  @Alias('k')
  @Args([
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'string', rest: true }
  ])
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'kick', description: 'Kick a member', usage: '!kick @user [reason]' })
  async kick(message: Message, args: { user: string; reason?: string }) {
    const result = await this.discord.kickMember(
      message.guildId!,
      args.user,
      args.reason || 'No reason provided'
    );
    await message.reply(result);
  }

  @Category('Moderation')
  @ModOnly()
  @Alias('mute', 'to')
  @Args([
    { name: 'user', type: 'user', required: true },
    { name: 'duration', type: 'number', required: false },
    { name: 'reason', type: 'string', rest: true }
  ])
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'timeout', description: 'Timeout a member', usage: '!timeout @user [seconds] [reason]' })
  async timeout(message: Message, args: { user: string; duration?: number; reason?: string }) {
    const result = await this.discord.timeoutMember(
      message.guildId!,
      args.user,
      args.duration || 300,
      args.reason || 'No reason provided'
    );
    await message.reply(result);
  }

  @Category('Moderation')
  @ModOnly()
  @Alias('clear', 'purge')
  @Arg({ name: 'count', type: 'number', required: true })
  @UseInterceptor(PrefixInterceptors.typing)
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'bulkdelete', description: 'Delete multiple messages', usage: '!bulkdelete <count>' })
  async bulkDelete(message: Message, args: { count: number }) {
    if (args.count < 1 || args.count > 100) {
      await message.reply('Count must be between 1 and 100');
      return;
    }
    // bulkDeleteMessages expects channelId and array of messageIds
    // For count-based delete, we need to fetch messages first
    const channel = message.channel;
    if ('messages' in channel) {
      const messages = await channel.messages.fetch({ limit: args.count });
      const ids = messages.map(m => m.id);
      const result = await this.discord.bulkDeleteMessages(message.channelId, ids);
      const reply = await message.reply(result);
      setTimeout(() => reply.delete().catch(() => {}), 5000);
    }
  }

  // ============================================
  // MESSAGE COMMANDS
  // ============================================

  @Category('Messages')
  @Args([
    { name: 'channel', type: 'channel', required: true },
    { name: 'content', type: 'string', rest: true, required: true }
  ])
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'send', description: 'Send a message to a channel', usage: '!send #channel <message>' })
  async send(message: Message, args: { channel: string; content: string }) {
    const result = await this.discord.sendMessage(args.channel, args.content);
    await message.reply(result);
  }

  @Category('Messages')
  @Arg({ name: 'limit', type: 'number', required: false })
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'read', description: 'Read recent messages', usage: '!read [limit]' })
  async read(message: Message, args: { limit?: number }) {
    // readMessages expects (channelId, count?: string)
    const result = await this.discord.readMessages(message.channelId, String(args.limit || 10));
    await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
  }

  // ============================================
  // CHANNEL COMMANDS
  // ============================================

  @Category('Channels')
  @AdminOnly()
  @Arg({ name: 'name', type: 'string', required: true })
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'createchannel', description: 'Create a text channel', usage: '!createchannel <name>' })
  async createChannel(message: Message, args: { name: string }) {
    const result = await this.discord.createTextChannel(message.guildId!, args.name);
    await message.reply(result);
  }

  @Category('Channels')
  @AdminOnly()
  @Arg({ name: 'name', type: 'string', required: true })
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'createvoice', description: 'Create a voice channel', usage: '!createvoice <name>' })
  async createVoice(message: Message, args: { name: string }) {
    const result = await this.discord.createVoiceChannel(message.guildId!, args.name);
    await message.reply(result);
  }

  @Category('Channels')
  @AdminOnly()
  @Arg({ name: 'channel', type: 'channel', required: true })
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'deletechannel', description: 'Delete a channel', usage: '!deletechannel #channel' })
  async deleteChannel(message: Message, args: { channel: string }) {
    // deleteChannel expects (guildId, channelId)
    const result = await this.discord.deleteChannel(message.guildId!, args.channel);
    await message.reply(result);
  }

  // ============================================
  // VOICE COMMANDS
  // ============================================

  @Category('Voice')
  @Alias('vc')
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'join', description: 'Join a voice channel by name', usage: '!join <channel name>' })
  async joinVoice(message: Message, args: {}, rawArgs: string[]) {
    const channelName = rawArgs.join(' ').trim();
    if (!channelName) {
      await message.reply('Please provide a voice channel name. Usage: `!join War Room`');
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
      // List available voice channels
      const voiceChannels = guild.channels.cache
        .filter(ch => ch.isVoiceBased())
        .map(ch => ch.name)
        .slice(0, 10);
      await message.reply(`Voice channel "${channelName}" not found. Available: ${voiceChannels.join(', ')}`);
      return;
    }

    const result = await this.discord.joinVoiceChannel(message.guildId!, voiceChannel.id);
    await message.reply(result);
  }

  @Category('Voice')
  @Alias('disconnect')
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'leave', description: 'Leave the current voice channel', usage: '!leave' })
  async leaveVoice(message: Message) {
    const result = await this.discord.leaveVoiceChannel(message.guildId!, message.guildId!);
    await message.reply(result);
  }

  // ============================================
  // ROLE COMMANDS
  // ============================================

  @Category('Roles')
  @AdminOnly()
  @Args([
    { name: 'name', type: 'string', required: true },
    { name: 'color', type: 'string', required: false }
  ])
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'createrole', description: 'Create a role', usage: '!createrole <name> [color]' })
  async createRole(message: Message, args: { name: string; color?: string }) {
    const result = await this.discord.createRole(message.guildId!, args.name, args.color || '#99AAB5');
    await message.reply(result);
  }

  @Category('Roles')
  @ModOnly()
  @Args([
    { name: 'user', type: 'user', required: true },
    { name: 'role', type: 'role', required: true }
  ])
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'addrole', description: 'Add a role to a user', usage: '!addrole @user @role' })
  async addRole(message: Message, args: { user: string; role: string }) {
    const result = await this.discord.addRoleToMember(message.guildId!, args.user, args.role);
    await message.reply(result);
  }

  @Category('Roles')
  @ModOnly()
  @Args([
    { name: 'user', type: 'user', required: true },
    { name: 'role', type: 'role', required: true }
  ])
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'removerole', description: 'Remove a role from a user', usage: '!removerole @user @role' })
  async removeRole(message: Message, args: { user: string; role: string }) {
    const result = await this.discord.removeRoleFromMember(message.guildId!, args.user, args.role);
    await message.reply(result);
  }

  // ============================================
  // THREAD COMMANDS
  // ============================================

  @Category('Threads')
  @ModOnly()
  @Args([
    { name: 'channel', type: 'channel', required: false },
    { name: 'name', type: 'string', required: true }
  ])
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'createthread', description: 'Create a thread', usage: '!createthread [#channel] <name>' })
  async createThread(message: Message, args: { channel?: string; name: string }) {
    const channelId = args.channel || message.channelId;
    const result = await this.discord.createThread(channelId, args.name);
    await message.reply(result);
  }

  // ============================================
  // UTILITY WITH COOLDOWN
  // ============================================

  @Category('Utility')
  @Cooldown(30) // 30 second cooldown
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'createinvite', description: 'Create a server invite' })
  async createInvite(message: Message) {
    const result = await this.discord.createInvite(message.channelId, 86400, 0);
    await message.reply(result);
  }

  @Category('Utility')
  @Cooldown(60) // 1 minute cooldown
  @UseInterceptor(PrefixInterceptors.reactLoading)
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'exportchat', description: 'Export chat history' })
  async exportChat(message: Message) {
    const result = await this.discord.exportChatLog(message.channelId);
    await message.reply(`\`\`\`\n${result.substring(0, 1900)}\n\`\`\``);
  }

  // ============================================
  // WITH VALIDATION
  // ============================================

  @Category('Admin')
  @AdminOnly()
  @ValidateWith(z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(1024).optional()
  }))
  @Args([
    { name: 'name', type: 'string', required: true },
    { name: 'description', type: 'string', rest: true }
  ])
  @UseInterceptor(PrefixInterceptors.errorHandler)
  @Command({ name: 'createcategory', description: 'Create a category', usage: '!createcategory <name> [description]' })
  async createCategory(message: Message, args: { name: string; description?: string }) {
    const result = await this.discord.createCategory(message.guildId!, args.name);
    await message.reply(result);
  }

  // ============================================
  // CUSTOM GUARD EXAMPLE
  // ============================================

  @Category('Fun')
  @UseGuard(PrefixGuards.guildOnly)
  @Cooldown(5)
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: '8ball', description: 'Ask the magic 8 ball', usage: '!8ball <question>' })
  async eightBall(message: Message, args: {}, rawArgs: string[]) {
    const question = rawArgs.join(' ');
    if (!question) {
      await message.reply('You need to ask a question!');
      return;
    }

    const responses = [
      'It is certain.', 'It is decidedly so.', 'Without a doubt.',
      'Yes - definitely.', 'You may rely on it.', 'As I see it, yes.',
      'Most likely.', 'Outlook good.', 'Yes.', 'Signs point to yes.',
      'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.',
      'Cannot predict now.', 'Concentrate and ask again.',
      "Don't count on it.", 'My reply is no.', 'My sources say no.',
      'Outlook not so good.', 'Very doubtful.'
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];
    await message.reply(`🎱 ${response}`);
  }

  // Track shown breadstick images per guild to avoid repeats
  private breadstickHistory: Map<string, number[]> = new Map();

  // Curated list of delicious breadstick images
  private readonly BREADSTICK_IMAGES = [
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800', // Fresh breadsticks
    'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=800', // Garlic breadsticks
    'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800', // Bakery bread
    'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=800', // Italian bread
    'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800', // Fresh baked
    'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=800', // Bread basket
    'https://images.unsplash.com/photo-1608198093002-ad4e005f0cc3?w=800', // Breadsticks close-up
    'https://images.unsplash.com/photo-1574478728782-f585dbe7c03f?w=800', // Artisan bread
    'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=800', // Rustic bread
    'https://images.unsplash.com/photo-1549903072-7e6e0bedb7fb?w=800', // Warm breadsticks
    'https://images.unsplash.com/photo-1598373182133-52452f7691ef?w=800', // Bread rolls
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800', // Baguette style
    'https://images.unsplash.com/photo-1530610476181-d83430b64dcd?w=800', // Fresh from oven
    'https://images.unsplash.com/photo-1587088155172-e9355df99c30?w=800', // Italian style
    'https://images.unsplash.com/photo-1595535873420-a599195b3f4a?w=800', // Golden breadsticks
  ];

  @Category('Fun')
  @Alias('breadsticks', 'breadstick', 'carbs')
  @Cooldown(3)
  @UseInterceptor(PrefixInterceptors.logging)
  @Command({ name: 'bread', description: 'Get a random picture of delicious breadsticks 🥖', usage: '!bread' })
  async bread(message: Message) {
    const guildId = message.guildId || message.author.id;

    // Get history for this guild/user
    let history = this.breadstickHistory.get(guildId) || [];

    // If we've shown all images, reset the history
    if (history.length >= this.BREADSTICK_IMAGES.length) {
      history = [];
    }

    // Find an image we haven't shown recently
    let availableIndices = this.BREADSTICK_IMAGES
      .map((_, i) => i)
      .filter(i => !history.includes(i));

    // Pick a random one from available
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    const imageUrl = this.BREADSTICK_IMAGES[randomIndex];

    // Add to history
    history.push(randomIndex);
    this.breadstickHistory.set(guildId, history);

    // Random fun messages
    const messages = [
      '🥖 **Fresh breadsticks, coming right up!**',
      '🥖 **Mmm... carbs!**',
      '🥖 **Unlimited breadsticks? Yes please!**',
      '🥖 **Olive Garden called, they want their breadsticks back**',
      '🥖 **Garlic butter not included**',
      '🥖 **Straight from the oven!**',
      '🥖 ***chef\'s kiss***',
      '🥖 **Breadstick delivery!**',
      '🥖 **Warning: May cause carb cravings**',
      '🥖 **The best thing since sliced bread... sticks**',
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    const embed = new EmbedBuilder()
      .setColor(0xD4A574) // Bread-like color
      .setDescription(randomMessage)
      .setImage(imageUrl)
      .setFooter({ text: `Breadstick ${history.length}/${this.BREADSTICK_IMAGES.length} 🍞` });

    await message.reply({ embeds: [embed] });
  }
}
