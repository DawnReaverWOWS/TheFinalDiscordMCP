# Eye of Sauron - Discord Bot

A Discord bot with AI-powered chat, voice TTS, World of Warships stats, and MCP (Model Context Protocol) integration for AI assistants.

## Features

- **AI Chat** - Powered by OpenRouter with 34+ free AI models (Gemini, Llama, Qwen, etc.)
- **Voice TTS** - Natural text-to-speech with 20+ Microsoft Edge neural voices
- **WoWS Stats** - Look up player stats and clan info from Wargaming API
- **Moderation** - Ban, kick, timeout, bulk delete messages
- **Server Management** - Create channels, roles, categories
- **MCP Integration** - 93 tools for AI assistant control (Claude, etc.)
- **HTTP API** - Optional REST API mode for web integrations
- **DM Support** - Bot responds automatically in private messages (no prefix needed)

## Quick Start

### Prerequisites

- Node.js 18+
- A Discord bot token
- (Optional) OpenRouter API key for AI features

### 1. Clone & Install

```bash
git clone https://github.com/DawnReaverWOWS/TheFinalDiscordMCP.git
cd TheFinalDiscordMCP
npm install
```

### 2. Configure

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required
DISCORD_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_server_id_here

# AI Features (Optional but recommended)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Creator Configuration (Optional)
BOT_CREATOR_ID=your_discord_user_id
BOT_CREATOR_NAME=YourName

# Notifications (Optional)
BOT_NOTIFY_CHANNEL_ID=channel_id_for_bot_notifications
```

### 3. Build & Run

```bash
npm run build
npm start
```

For development with hot reload:

```bash
npm run dev
```

## Getting a Discord Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to "Bot" tab -> "Add Bot"
4. Click "Reset Token" and copy it (this is your `DISCORD_TOKEN`)
5. Enable these Privileged Gateway Intents:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent
6. Go to "OAuth2" -> "URL Generator"
7. Select scopes: `bot`, `applications.commands`
8. Select permissions: `Administrator` (or select individual permissions)
9. Copy the generated URL and open it to invite the bot to your server

## AI Integration

Uses OpenRouter to access 34+ free AI models. Get your API key at [openrouter.ai/keys](https://openrouter.ai/keys).

### Supported Free Models

| Model | Context | Best For |
|-------|---------|----------|
| `google/gemini-2.0-flash-exp:free` | 1.05M | Fast, multimodal (default) |
| `meta-llama/llama-3.3-70b-instruct:free` | 131K | Multilingual chat |
| `qwen/qwen3-235b-a22b:free` | 131K | Reasoning, 100+ languages |
| `nousresearch/hermes-3-llama-3.1-405b:free` | 131K | 405B frontier model |
| `qwen/qwen3-coder:free` | 262K | Coding tasks |

See [context/openrouterAiModels.md](context/openrouterAiModels.md) for the full list of 34 free models.

### Using AI

- **Mention the bot**: `@BotName what's the best ship for ranked?`
- **DM the bot**: Just send a message directly - no prefix needed
- The bot will respond with context-aware answers

## Bot Commands

All commands use the `!` prefix (except DMs which work without prefix).

### AI & Chat

| Command | Description | Example |
|---------|-------------|---------|
| `@BotName <message>` | Chat with AI | `@BotName help me with builds` |
| DM the bot | AI responds automatically | Just send a message |

### Voice

| Command | Description | Example |
|---------|-------------|---------|
| `!join <channel>` | Join a voice channel | `!join War Room` |
| `!leave` | Leave voice channel | `!leave` |
| `!say <text>` | Speak text via TTS | `!say Hello everyone!` |
| `!voices` | List available TTS voices | `!voices` |
| `!setvoice <name>` | Change TTS voice | `!setvoice guy` |
| `!lockvoice` | Lock voice to creator only | `!lockvoice` |
| `!unlockvoice` | Unlock voice for everyone | `!unlockvoice` |
| `!voicestatus` | Check voice lock status | `!voicestatus` |

**Aliases:** `!vc` (join), `!disconnect` (leave), `!speak`/`!tts` (say)

### Available TTS Voices

20+ natural Microsoft Edge neural voices:

**US Female:** aria (default), jenny, sara, ana, michelle
**US Male:** guy, davis, tony, jason
**UK Female:** sonia, maisie, libby
**UK Male:** ryan, thomas, alfie
**Australian:** natasha, william

### World of Warships

| Command | Description | Example |
|---------|-------------|---------|
| `!wows <username>` | Look up player stats | `!wows PlayerName` |
| `!ships <username>` | Top 10 ships by battles | `!ships PlayerName` |
| `!allships <username>` | ALL ships grouped by tier | `!allships PlayerName` |
| `!clan <tag/name>` | Look up clan info | `!clan DROVA` |

**Aliases:** `!player`, `!lookup` (for wows), `!topships` (for ships), `!claninfo`, `!clanlookup` (for clan)

**Ships Command Options:**

- Filter by tier: `!ships PlayerName tier:10`
- Filter by type: `!ships PlayerName type:bb` (dd, ca, bb, cv, ss)
- Sort options: `!ships PlayerName sort:winrate` (battles, winrate, damage, recent)

### Info

| Command | Description |
|---------|-------------|
| `!ping` | Check bot latency |
| `!serverinfo` | Server information |
| `!members [limit]` | List server members |
| `!memberinfo @user` | Get user information |

### Moderation (Requires Permissions)

| Command | Description | Example |
|---------|-------------|---------|
| `!ban @user [reason]` | Ban a member | `!ban @user spamming` |
| `!unban <userId>` | Unban a member | `!unban 123456789` |
| `!kick @user [reason]` | Kick a member | `!kick @user warning` |
| `!timeout @user [seconds] [reason]` | Timeout a member | `!timeout @user 300 cool down` |
| `!bulkdelete <count>` | Delete messages (1-100) | `!bulkdelete 10` |

**Aliases:** `!b` (ban), `!k` (kick), `!mute`/`!to` (timeout), `!clear`/`!purge` (bulkdelete)

### Messages

| Command | Description | Example |
|---------|-------------|---------|
| `!send #channel <message>` | Send a message | `!send #general Hello!` |
| `!read [limit]` | Read recent messages | `!read 20` |

### Channels (Admin Only)

| Command | Description | Example |
|---------|-------------|---------|
| `!createchannel <name>` | Create text channel | `!createchannel announcements` |
| `!createvoice <name>` | Create voice channel | `!createvoice Gaming` |
| `!deletechannel #channel` | Delete a channel | `!deletechannel #old-channel` |
| `!createcategory <name>` | Create a category | `!createcategory Projects` |

### Roles

| Command | Description | Example |
|---------|-------------|---------|
| `!createrole <name> [color]` | Create a role (Admin) | `!createrole VIP #ff0000` |
| `!addrole @user @role` | Add role to user (Mod) | `!addrole @user @Member` |
| `!removerole @user @role` | Remove role from user (Mod) | `!removerole @user @Member` |

### Utility

| Command | Description | Cooldown |
|---------|-------------|----------|
| `!createinvite` | Create server invite | 30s |
| `!exportchat` | Export channel chat log | 60s |
| `!createthread [#channel] <name>` | Create a thread (Mod) | - |

### Fun

| Command | Description | Example |
|---------|-------------|---------|
| `!8ball <question>` | Ask the magic 8-ball | `!8ball Will I win today?` |
| `!bread` | Get a random breadstick picture | `!bread` |

**Aliases:** `!breadsticks`, `!breadstick`, `!carbs`

## Creator Mode

The bot supports a "creator priority" system for voice commands:

- Set `BOT_CREATOR_ID` in `.env` to your Discord user ID
- Use `!lockvoice` to lock voice commands to creator only
- While locked, only the creator can control voice features
- Use `!unlockvoice` to allow everyone again

When asked about its creator, the bot will speak highly of them!

## MCP Integration (For AI Assistants)

This bot also functions as an MCP server, allowing AI assistants like Claude to control Discord.

### Claude Desktop Configuration

Add to your Claude Desktop config (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": ["/path/to/FinalDiscordMCP/dist/index.js"],
      "env": {
        "DISCORD_TOKEN": "your_token_here",
        "DISCORD_GUILD_ID": "your_server_id",
        "OPENROUTER_API_KEY": "your_openrouter_key"
      }
    }
  }
}
```

### HTTP API Mode

Start with HTTP API enabled:

```bash
MCP_HTTP_PORT=3001 npm start
```

Or run in HTTP-only mode (no Discord bot, just API):

```bash
HTTP_ONLY=true MCP_HTTP_PORT=3001 npm start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Your Discord bot token |
| `DISCORD_GUILD_ID` | No | Default server ID |
| `OPENROUTER_API_KEY` | No | OpenRouter API key for AI features |
| `OPENROUTER_MODEL` | No | Override default AI model |
| `BOT_CREATOR_ID` | No | Creator's Discord user ID (for voice lock) |
| `BOT_CREATOR_NAME` | No | Creator's display name |
| `BOT_NOTIFY_CHANNEL_ID` | No | Channel for startup/shutdown notifications |
| `BOT_OWNER_ID` | No | User ID for DM notifications (fallback) |
| `MCP_HTTP_PORT` | No | Enable HTTP API on this port |
| `HTTP_ONLY` | No | Run without Discord bot (API only) |
| `ENABLE_LOGGING` | No | Enable operation logging |
| `RATE_LIMIT_PROTECTION` | No | Enable rate limiting (default: true) |

## Project Structure

```text
TheFinalDiscordMCP/
├── src/
│   ├── index.ts              # Entry point
│   ├── discord-service.ts    # Discord.js wrapper
│   ├── ai-service.ts         # OpenRouter AI integration
│   ├── voice-settings.ts     # TTS voice configuration
│   ├── voice-priority.ts     # Creator voice lock system
│   ├── commands/
│   │   ├── decorated-commands.ts  # Bot commands
│   │   └── prefix-handler.ts      # Command routing & AI
│   ├── services/
│   │   └── wargaming-api.ts  # WoWS API integration
│   ├── decorators/
│   │   └── prefix.ts         # Command decorators
│   └── core/
│       ├── DiscordController.ts
│       ├── ConfigManager.ts
│       ├── RateLimiter.ts
│       └── ...
├── context/
│   └── openrouterAiModels.md # Full list of 34 free AI models
├── dist/                     # Compiled JS
├── .env                      # Your config (not committed)
├── .env.example              # Example config
└── package.json
```

## Deployment

The bot includes GitHub Actions workflows for automated deployment:

- **CI** - Runs on all pushes, builds and tests
- **Deploy** - Deploys to VM1 and VM2 on push to main

See `.github/workflows/` for configuration.

## Development

```bash
# Install dependencies
npm install

# Run in dev mode (hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Type check
npx tsc --noEmit
```

## License

MIT - See [LICENSE](LICENSE)
