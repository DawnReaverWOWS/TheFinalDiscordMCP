/**
 * Decorator System for Prefix Commands (!)
 *
 * NecordJS-like ergonomics for prefix commands:
 * - @Command for defining prefix commands
 * - @Arg for positional arguments
 * - @RequirePermission for permission guards
 * - @UseInterceptor for logging/error handling
 * - @Cooldown for rate limiting
 * - @Alias for command aliases
 */

import { Message, PermissionFlagsBits, PermissionResolvable } from 'discord.js';
import { z } from 'zod';

// ============================================
// TYPES
// ============================================

export interface CommandArg {
  name: string;
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'user' | 'channel' | 'role' | 'boolean';
  rest?: boolean; // Consume all remaining args
}

export interface PrefixCommandMetadata {
  name: string;
  description: string;
  usage: string;
  aliases: string[];
  args: CommandArg[];
  permissions: PermissionResolvable[];
  guards: PrefixGuardFn[];
  interceptors: PrefixInterceptorFn[];
  cooldown: number; // seconds
  adminOnly: boolean;
  modOnly: boolean;
  schema?: z.ZodSchema;
  handler: PrefixCommandHandler;
  category: string;
}

export type PrefixCommandHandler = (
  message: Message,
  args: Record<string, any>,
  rawArgs: string[]
) => Promise<void>;

export type PrefixGuardFn = (message: Message) => boolean | Promise<boolean>;
export type PrefixInterceptorFn = (
  message: Message,
  next: () => Promise<void>
) => Promise<void>;

// ============================================
// COMMAND REGISTRY
// ============================================

class PrefixCommandRegistry {
  private commands: Map<string, PrefixCommandMetadata> = new Map();
  private aliases: Map<string, string> = new Map(); // alias -> command name
  private static instance: PrefixCommandRegistry;

  static getInstance(): PrefixCommandRegistry {
    if (!PrefixCommandRegistry.instance) {
      PrefixCommandRegistry.instance = new PrefixCommandRegistry();
    }
    return PrefixCommandRegistry.instance;
  }

  register(metadata: PrefixCommandMetadata): void {
    this.commands.set(metadata.name, metadata);
    // Register aliases
    for (const alias of metadata.aliases) {
      this.aliases.set(alias, metadata.name);
    }
  }

  get(name: string): PrefixCommandMetadata | undefined {
    // Check direct command
    if (this.commands.has(name)) {
      return this.commands.get(name);
    }
    // Check aliases
    const realName = this.aliases.get(name);
    if (realName) {
      return this.commands.get(realName);
    }
    return undefined;
  }

  getAll(): PrefixCommandMetadata[] {
    return Array.from(this.commands.values());
  }

  getByCategory(category: string): PrefixCommandMetadata[] {
    return this.getAll().filter(cmd => cmd.category === category);
  }

  getCategories(): string[] {
    return [...new Set(this.getAll().map(cmd => cmd.category))];
  }

  generateHelp(): string {
    const categories = this.getCategories();
    let help = '**Available Commands**\n\n';

    for (const category of categories) {
      const commands = this.getByCategory(category);
      help += `**${category}:**\n`;
      for (const cmd of commands) {
        help += `\`!${cmd.name}\` - ${cmd.description}\n`;
      }
      help += '\n';
    }

    return help;
  }
}

export const prefixCommandRegistry = PrefixCommandRegistry.getInstance();

// ============================================
// PENDING METADATA STORAGE
// ============================================

const pendingMetadata: Map<any, Partial<PrefixCommandMetadata>> = new Map();

function getOrCreateMetadata(target: any): Partial<PrefixCommandMetadata> {
  if (!pendingMetadata.has(target)) {
    pendingMetadata.set(target, {
      aliases: [],
      args: [],
      permissions: [],
      guards: [],
      interceptors: [],
      cooldown: 0,
      adminOnly: false,
      modOnly: false,
      category: 'General'
    });
  }
  return pendingMetadata.get(target)!;
}

// ============================================
// COMMAND DECORATOR
// ============================================

/**
 * @Command - Define a prefix command
 *
 * @example
 * @Command({
 *   name: 'ping',
 *   description: 'Check bot latency',
 *   category: 'Info'
 * })
 * async handlePing(message: Message) {
 *   await message.reply('Pong!');
 * }
 */
export function Command(options: {
  name: string;
  description: string;
  usage?: string;
  category?: string;
}): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata = getOrCreateMetadata(descriptor.value);
    metadata.name = options.name;
    metadata.description = options.description;
    metadata.usage = options.usage || `!${options.name}`;
    metadata.category = options.category || 'General';
    metadata.handler = descriptor.value;

    // Register command
    prefixCommandRegistry.register(metadata as PrefixCommandMetadata);

    return descriptor;
  };
}

// ============================================
// ARGUMENT DECORATORS
// ============================================

/**
 * @Arg - Define a positional argument
 *
 * @example
 * @Arg({ name: 'user', type: 'user', required: true })
 * @Arg({ name: 'reason', type: 'string', rest: true })
 * @Command({ name: 'ban', description: 'Ban a user' })
 */
export function Arg(options: {
  name: string;
  description?: string;
  type?: 'string' | 'number' | 'user' | 'channel' | 'role' | 'boolean';
  required?: boolean;
  rest?: boolean;
}): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata = getOrCreateMetadata(descriptor.value);
    metadata.args!.unshift({ // unshift because decorators apply bottom-up
      name: options.name,
      description: options.description || options.name,
      type: options.type || 'string',
      required: options.required ?? true,
      rest: options.rest || false
    });
    return descriptor;
  };
}

/**
 * @Args - Define multiple arguments at once
 */
export function Args(args: Array<{
  name: string;
  description?: string;
  type?: 'string' | 'number' | 'user' | 'channel' | 'role' | 'boolean';
  required?: boolean;
  rest?: boolean;
}>): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata = getOrCreateMetadata(descriptor.value);
    for (const arg of args.reverse()) {
      metadata.args!.unshift({
        name: arg.name,
        description: arg.description || arg.name,
        type: arg.type || 'string',
        required: arg.required ?? true,
        rest: arg.rest || false
      });
    }
    return descriptor;
  };
}

// ============================================
// ALIAS DECORATOR
// ============================================

/**
 * @Alias - Add command aliases
 *
 * @example
 * @Alias('r', 'rm')
 * @Command({ name: 'remove', description: 'Remove something' })
 */
export function Alias(...aliases: string[]): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata = getOrCreateMetadata(descriptor.value);
    metadata.aliases!.push(...aliases);
    return descriptor;
  };
}

// ============================================
// PERMISSION DECORATORS
// ============================================

/**
 * @RequirePermission - Require specific Discord permissions
 */
export function RequirePermission(...permissions: PermissionResolvable[]): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata = getOrCreateMetadata(descriptor.value);
    metadata.permissions!.push(...permissions);
    return descriptor;
  };
}

/**
 * @AdminOnly - Only server administrators can use this command
 */
export function AdminOnly(): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata = getOrCreateMetadata(descriptor.value);
    metadata.adminOnly = true;
    return descriptor;
  };
}

/**
 * @ModOnly - Only moderators (Manage Messages) can use this command
 */
export function ModOnly(): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata = getOrCreateMetadata(descriptor.value);
    metadata.modOnly = true;
    return descriptor;
  };
}

// ============================================
// GUARD DECORATOR
// ============================================

/**
 * @UseGuard - Add a custom guard function
 */
export function UseGuard(guard: PrefixGuardFn): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata = getOrCreateMetadata(descriptor.value);
    metadata.guards!.push(guard);
    return descriptor;
  };
}

// Built-in guards
export const PrefixGuards = {
  guildOnly: (message: Message) => !!message.guild,
  dmOnly: (message: Message) => !message.guild,
  ownerOnly: (ownerId: string) => (message: Message) => message.author.id === ownerId,
  hasRole: (roleId: string) => (message: Message) =>
    message.member?.roles.cache.has(roleId) ?? false,
  inChannel: (channelId: string) => (message: Message) =>
    message.channelId === channelId,
  notBot: (message: Message) => !message.author.bot,
  hasAttachment: (message: Message) => message.attachments.size > 0,
};

// ============================================
// INTERCEPTOR DECORATOR
// ============================================

/**
 * @UseInterceptor - Add pre/post processing
 */
export function UseInterceptor(interceptor: PrefixInterceptorFn): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata = getOrCreateMetadata(descriptor.value);
    metadata.interceptors!.push(interceptor);
    return descriptor;
  };
}

// Built-in interceptors
export const PrefixInterceptors = {
  // Log command execution
  logging: async (message: Message, next: () => Promise<void>) => {
    const content = message.content.substring(0, 50);
    console.log(`[CMD] ${message.author.tag}: ${content}`);
    await next();
  },

  // Time command execution
  timing: async (message: Message, next: () => Promise<void>) => {
    const start = Date.now();
    await next();
    console.log(`[TIMING] Command took ${Date.now() - start}ms`);
  },

  // Show typing indicator
  typing: async (message: Message, next: () => Promise<void>) => {
    if ('sendTyping' in message.channel) {
      await (message.channel as any).sendTyping();
    }
    await next();
  },

  // Delete command message after execution
  deleteCommand: async (message: Message, next: () => Promise<void>) => {
    await next();
    try {
      await message.delete();
    } catch { /* Ignore if can't delete */ }
  },

  // React with loading emoji, then checkmark
  reactLoading: async (message: Message, next: () => Promise<void>) => {
    try {
      await message.react('⏳');
      await next();
      await message.reactions.removeAll();
      await message.react('✅');
    } catch {
      await next();
    }
  },

  // Error handling wrapper
  errorHandler: async (message: Message, next: () => Promise<void>) => {
    try {
      await next();
    } catch (error) {
      console.error('[ERROR]', error);
      await message.reply('❌ An error occurred while executing this command.');
    }
  },
};

// ============================================
// COOLDOWN DECORATOR
// ============================================

/**
 * @Cooldown - Add a cooldown to prevent spam
 *
 * @example
 * @Cooldown(10) // 10 second cooldown
 * @Command({ name: 'daily', description: 'Claim daily reward' })
 */
export function Cooldown(seconds: number): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata = getOrCreateMetadata(descriptor.value);
    metadata.cooldown = seconds;
    return descriptor;
  };
}

// ============================================
// VALIDATION DECORATOR
// ============================================

/**
 * @ValidateWith - Validate parsed arguments with Zod schema
 */
export function ValidateWith(schema: z.ZodSchema): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata = getOrCreateMetadata(descriptor.value);
    metadata.schema = schema;
    return descriptor;
  };
}

// ============================================
// CATEGORY DECORATOR
// ============================================

/**
 * @Category - Set command category (for help organization)
 */
export function Category(name: string): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata = getOrCreateMetadata(descriptor.value);
    metadata.category = name;
    return descriptor;
  };
}

// ============================================
// ARGUMENT PARSER
// ============================================

export function parseArgs(
  rawArgs: string[],
  argDefs: CommandArg[],
  message: Message
): Record<string, any> {
  const parsed: Record<string, any> = {};
  let argIndex = 0;

  for (const def of argDefs) {
    if (def.rest) {
      // Consume all remaining arguments
      parsed[def.name] = rawArgs.slice(argIndex).join(' ') || undefined;
      break;
    }

    const raw = rawArgs[argIndex];
    argIndex++;

    if (!raw) {
      if (def.required) {
        throw new Error(`Missing required argument: ${def.name}`);
      }
      continue;
    }

    // Parse by type
    switch (def.type) {
      case 'number':
        const num = parseInt(raw);
        if (isNaN(num)) throw new Error(`${def.name} must be a number`);
        parsed[def.name] = num;
        break;

      case 'boolean':
        parsed[def.name] = ['true', 'yes', 'on', '1'].includes(raw.toLowerCase());
        break;

      case 'user':
        // Extract user ID from mention or raw ID
        parsed[def.name] = raw.replace(/[<@!>]/g, '');
        break;

      case 'channel':
        // Extract channel ID from mention or raw ID
        parsed[def.name] = raw.replace(/[<#>]/g, '');
        break;

      case 'role':
        // Extract role ID from mention or raw ID
        parsed[def.name] = raw.replace(/[<@&>]/g, '');
        break;

      default:
        parsed[def.name] = raw;
    }
  }

  return parsed;
}

// ============================================
// COOLDOWN MANAGER
// ============================================

const cooldowns = new Map<string, Map<string, number>>();

export function checkCooldown(userId: string, commandName: string, cooldownSeconds: number): number {
  if (cooldownSeconds <= 0) return 0;

  const key = commandName;
  if (!cooldowns.has(key)) {
    cooldowns.set(key, new Map());
  }

  const userCooldowns = cooldowns.get(key)!;
  const now = Date.now();
  const expiry = userCooldowns.get(userId);

  if (expiry && now < expiry) {
    return Math.ceil((expiry - now) / 1000);
  }

  userCooldowns.set(userId, now + cooldownSeconds * 1000);
  return 0;
}

// ============================================
// COMMAND EXECUTOR
// ============================================

/**
 * Execute a registered prefix command with all guards and interceptors
 */
export async function executePrefixCommand(
  commandName: string,
  message: Message,
  rawArgs: string[]
): Promise<boolean> {
  const metadata = prefixCommandRegistry.get(commandName.toLowerCase());

  if (!metadata) {
    return false; // Command not found
  }

  // Check admin only
  if (metadata.adminOnly) {
    if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
      await message.reply('❌ This command is admin-only.');
      return true;
    }
  }

  // Check mod only
  if (metadata.modOnly) {
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await message.reply('❌ This command is moderator-only.');
      return true;
    }
  }

  // Check permissions
  for (const perm of metadata.permissions) {
    if (!message.member?.permissions.has(perm)) {
      await message.reply(`❌ You need the \`${perm}\` permission to use this command.`);
      return true;
    }
  }

  // Check guards
  for (const guard of metadata.guards) {
    const allowed = await guard(message);
    if (!allowed) {
      await message.reply('❌ You cannot use this command.');
      return true;
    }
  }

  // Check cooldown
  const remainingCooldown = checkCooldown(message.author.id, metadata.name, metadata.cooldown);
  if (remainingCooldown > 0) {
    await message.reply(`⏳ Please wait ${remainingCooldown}s before using this command again.`);
    return true;
  }

  // Parse arguments
  let parsedArgs: Record<string, any>;
  try {
    parsedArgs = parseArgs(rawArgs, metadata.args, message);
  } catch (error: any) {
    await message.reply(`❌ ${error.message}\nUsage: \`${metadata.usage}\``);
    return true;
  }

  // Validate with schema if present
  if (metadata.schema) {
    const result = metadata.schema.safeParse(parsedArgs);
    if (!result.success) {
      await message.reply(`❌ Validation error: ${result.error.message}`);
      return true;
    }
  }

  // Build interceptor chain
  const handler = () => metadata.handler(message, parsedArgs, rawArgs);

  const chain = metadata.interceptors.reduceRight(
    (next: () => Promise<void>, interceptor) =>
      () => interceptor(message, next),
    handler
  );

  await chain();
  return true;
}

// ============================================
// HELP GENERATOR
// ============================================

export function generateCommandHelp(commandName: string): string | null {
  const cmd = prefixCommandRegistry.get(commandName);
  if (!cmd) return null;

  let help = `**!${cmd.name}**\n`;
  help += `${cmd.description}\n\n`;
  help += `**Usage:** \`${cmd.usage}\`\n`;

  if (cmd.aliases.length > 0) {
    help += `**Aliases:** ${cmd.aliases.map(a => `\`!${a}\``).join(', ')}\n`;
  }

  if (cmd.args.length > 0) {
    help += `**Arguments:**\n`;
    for (const arg of cmd.args) {
      const req = arg.required ? '(required)' : '(optional)';
      help += `  • \`${arg.name}\` - ${arg.description} ${req}\n`;
    }
  }

  if (cmd.cooldown > 0) {
    help += `**Cooldown:** ${cmd.cooldown}s\n`;
  }

  if (cmd.adminOnly) {
    help += `**Requires:** Administrator\n`;
  } else if (cmd.modOnly) {
    help += `**Requires:** Moderator\n`;
  } else if (cmd.permissions.length > 0) {
    help += `**Requires:** ${cmd.permissions.join(', ')}\n`;
  }

  return help;
}
