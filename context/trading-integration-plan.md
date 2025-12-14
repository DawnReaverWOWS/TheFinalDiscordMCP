# Trading Bot Integration Plan

> Private planning doc - add `context/trading-integration-plan.md` to .gitignore if not already excluded

## Overview

Integrate TradingView MCP as a separate service on VM2, with Eye of Sauron (VM1) calling its API for crypto/stock data.

## Architecture

```
VM1 (Discord Bot)                    VM2 (Trading API)
┌─────────────────────┐              ┌─────────────────────┐
│  Eye of Sauron      │   HTTP API   │  TradingView API    │
│  (Node.js)          │ ──────────►  │  (Python/FastAPI)   │
│                     │   :5001      │                     │
│  !gainers, !ta      │ ◄──────────  │  tradingview-ta     │
└─────────────────────┘    JSON      └─────────────────────┘
```

---

## VM2 Setup (Trading API)

### Step 1: Clone TradingView MCP

```bash
cd ~
git clone https://github.com/atilaahmettaner/tradingview-mcp.git
cd tradingview-mcp
```

### Step 2: Install UV (Python package manager)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc  # or restart shell
```

### Step 3: Install dependencies

```bash
cd ~/tradingview-mcp
uv sync
uv pip install fastapi uvicorn
```

### Step 4: Create FastAPI wrapper

Create `~/tradingview-mcp/api_server.py`:

```python
"""
FastAPI wrapper for TradingView MCP
Run with: uv run uvicorn api_server:app --host 0.0.0.0 --port 5001
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import sys
sys.path.insert(0, 'src')

from tradingview_mcp.core.scanner import get_top_gainers, get_top_losers
from tradingview_mcp.core.analysis import analyze_symbol
from tradingview_mcp.core.bollinger import bollinger_scan

app = FastAPI(title="TradingView API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/gainers/{exchange}")
async def gainers(exchange: str, timeframe: str = "15m", limit: int = 10):
    """Get top gainers for an exchange"""
    try:
        result = get_top_gainers(exchange.upper(), timeframe, limit)
        return {"exchange": exchange, "timeframe": timeframe, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/losers/{exchange}")
async def losers(exchange: str, timeframe: str = "15m", limit: int = 10):
    """Get top losers for an exchange"""
    try:
        result = get_top_losers(exchange.upper(), timeframe, limit)
        return {"exchange": exchange, "timeframe": timeframe, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analyze/{symbol}")
async def analyze(symbol: str, exchange: str = "BINANCE", timeframe: str = "1h"):
    """Get technical analysis for a symbol"""
    try:
        result = analyze_symbol(symbol.upper(), exchange.upper(), timeframe)
        return {"symbol": symbol, "exchange": exchange, "timeframe": timeframe, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/bollinger/{exchange}")
async def bollinger(exchange: str, timeframe: str = "1h", limit: int = 10):
    """Scan for Bollinger Band squeezes"""
    try:
        result = bollinger_scan(exchange.upper(), timeframe, limit)
        return {"exchange": exchange, "timeframe": timeframe, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/exchanges")
async def exchanges():
    """List supported exchanges"""
    return {
        "crypto": ["BINANCE", "KUCOIN", "BYBIT", "BITGET", "OKX", "COINBASE", "GATEIO"],
        "stocks": ["NASDAQ", "NYSE", "BIST"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
```

### Step 5: Run the API

```bash
cd ~/tradingview-mcp
uv run uvicorn api_server:app --host 0.0.0.0 --port 5001
```

### Step 6: Run as systemd service (production)

Create `/etc/systemd/system/trading-api.service`:

```ini
[Unit]
Description=TradingView API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/tradingview-mcp
ExecStart=/home/ubuntu/.local/bin/uv run uvicorn api_server:app --host 0.0.0.0 --port 5001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable trading-api
sudo systemctl start trading-api
```

---

## VM1 Changes (Discord Bot)

### Step 1: Add env variable

In `.env`:

```env
# Trading API (VM2)
TRADING_API_URL=http://VM2_INTERNAL_IP:5001
```

### Step 2: Create trading service

Create `src/services/trading-api.ts`:

```typescript
/**
 * Trading API Client
 * Calls the TradingView API running on VM2
 */

const TRADING_API_URL = process.env.TRADING_API_URL;

interface TradingResponse<T> {
  exchange?: string;
  symbol?: string;
  timeframe?: string;
  data: T;
}

interface GainerLoser {
  symbol: string;
  price: number;
  change: number;
  volume?: number;
}

interface Analysis {
  price: number;
  rsi: number;
  macd: { value: number; signal: number; histogram: number };
  bollinger: { upper: number; middle: number; lower: number; width: number };
  recommendation: string;
}

export class TradingAPI {
  private baseUrl: string;

  constructor() {
    if (!TRADING_API_URL) {
      throw new Error('TRADING_API_URL not configured');
    }
    this.baseUrl = TRADING_API_URL;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getGainers(exchange = 'BINANCE', timeframe = '15m', limit = 10): Promise<GainerLoser[]> {
    const res = await fetch(`${this.baseUrl}/gainers/${exchange}?timeframe=${timeframe}&limit=${limit}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = await res.json() as TradingResponse<GainerLoser[]>;
    return json.data;
  }

  async getLosers(exchange = 'BINANCE', timeframe = '15m', limit = 10): Promise<GainerLoser[]> {
    const res = await fetch(`${this.baseUrl}/losers/${exchange}?timeframe=${timeframe}&limit=${limit}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = await res.json() as TradingResponse<GainerLoser[]>;
    return json.data;
  }

  async analyze(symbol: string, exchange = 'BINANCE', timeframe = '1h'): Promise<Analysis> {
    const res = await fetch(`${this.baseUrl}/analyze/${symbol}?exchange=${exchange}&timeframe=${timeframe}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const json = await res.json() as TradingResponse<Analysis>;
    return json.data;
  }

  async getExchanges(): Promise<{ crypto: string[]; stocks: string[] }> {
    const res = await fetch(`${this.baseUrl}/exchanges`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  }
}

// Singleton
let tradingAPI: TradingAPI | null = null;

export function getTradingAPI(): TradingAPI | null {
  if (!TRADING_API_URL) return null;
  if (!tradingAPI) {
    tradingAPI = new TradingAPI();
  }
  return tradingAPI;
}
```

### Step 3: Add Discord commands

Add to `prefix-handler.ts` switch statement:

```typescript
// ============================================
// TRADING - Crypto & Stocks
// ============================================
case 'gainers': {
  const api = getTradingAPI();
  if (!api) {
    await message.reply('Trading API not configured.');
    break;
  }

  const exchange = args[0]?.toUpperCase() || 'BINANCE';
  const timeframe = args[1] || '15m';

  try {
    await message.channel.sendTyping();
    const gainers = await api.getGainers(exchange, timeframe, 10);

    let output = `**Top Gainers on ${exchange} (${timeframe})**\n\n`;
    gainers.forEach((g, i) => {
      const emoji = g.change > 10 ? '🚀' : g.change > 5 ? '📈' : '↗️';
      output += `${i + 1}. ${emoji} **${g.symbol}** $${g.price.toFixed(4)} (+${g.change.toFixed(2)}%)\n`;
    });

    await message.reply(output);
  } catch (error) {
    await message.reply(`Error fetching gainers: ${error}`);
  }
  break;
}

case 'losers': {
  const api = getTradingAPI();
  if (!api) {
    await message.reply('Trading API not configured.');
    break;
  }

  const exchange = args[0]?.toUpperCase() || 'BINANCE';
  const timeframe = args[1] || '15m';

  try {
    await message.channel.sendTyping();
    const losers = await api.getLosers(exchange, timeframe, 10);

    let output = `**Top Losers on ${exchange} (${timeframe})**\n\n`;
    losers.forEach((l, i) => {
      const emoji = l.change < -10 ? '💀' : l.change < -5 ? '📉' : '↘️';
      output += `${i + 1}. ${emoji} **${l.symbol}** $${l.price.toFixed(4)} (${l.change.toFixed(2)}%)\n`;
    });

    await message.reply(output);
  } catch (error) {
    await message.reply(`Error fetching losers: ${error}`);
  }
  break;
}

case 'ta':
case 'crypto':
case 'analyze': {
  const api = getTradingAPI();
  if (!api) {
    await message.reply('Trading API not configured.');
    break;
  }

  if (!args[0]) {
    await message.reply('Usage: `!ta BTCUSDT [exchange] [timeframe]`');
    break;
  }

  const symbol = args[0].toUpperCase();
  const exchange = args[1]?.toUpperCase() || 'BINANCE';
  const timeframe = args[2] || '1h';

  try {
    await message.channel.sendTyping();
    const analysis = await api.analyze(symbol, exchange, timeframe);

    const recEmoji = analysis.recommendation.includes('BUY') ? '🟢' :
                     analysis.recommendation.includes('SELL') ? '🔴' : '🟡';

    const output = `**${symbol} Technical Analysis** (${exchange} ${timeframe})

💰 **Price:** $${analysis.price.toFixed(4)}
📊 **RSI:** ${analysis.rsi.toFixed(1)}
📈 **MACD:** ${analysis.macd.value.toFixed(4)} (Signal: ${analysis.macd.signal.toFixed(4)})
🎯 **Bollinger Bands:**
   Upper: $${analysis.bollinger.upper.toFixed(4)}
   Middle: $${analysis.bollinger.middle.toFixed(4)}
   Lower: $${analysis.bollinger.lower.toFixed(4)}
   Width: ${(analysis.bollinger.width * 100).toFixed(2)}%

${recEmoji} **Recommendation:** ${analysis.recommendation}`;

    await message.reply(output);
  } catch (error) {
    await message.reply(`Error analyzing ${symbol}: ${error}`);
  }
  break;
}

case 'markets':
case 'exchanges': {
  const api = getTradingAPI();
  if (!api) {
    await message.reply('Trading API not configured.');
    break;
  }

  try {
    const exchanges = await api.getExchanges();
    const output = `**Supported Markets**

**Crypto Exchanges:**
${exchanges.crypto.map(e => `• ${e}`).join('\n')}

**Stock Markets:**
${exchanges.stocks.map(e => `• ${e}`).join('\n')}

**Usage:**
• \`!gainers BINANCE 15m\`
• \`!losers KUCOIN 1h\`
• \`!ta BTCUSDT BINANCE 4h\``;

    await message.reply(output);
  } catch (error) {
    await message.reply(`Error fetching exchanges: ${error}`);
  }
  break;
}
```

### Step 4: Update help message

Add to help messages:

```typescript
**Trading:** \`!gainers\` \`!losers\` \`!ta\` \`!markets\`
  • \`!gainers BINANCE 15m\` - Top crypto gainers
  • \`!losers KUCOIN 1h\` - Top crypto losers
  • \`!ta BTCUSDT\` - Technical analysis
```

---

## Networking

### Oracle Cloud VCN Setup

Both VMs need to be in the same VCN (Virtual Cloud Network) to communicate via internal IPs.

1. **Find VM2's internal IP:**
   ```bash
   # On VM2
   ip addr show ens3  # or similar
   # Look for 10.x.x.x address
   ```

2. **Add security rule in Oracle Cloud Console:**
   - Go to Networking > Virtual Cloud Networks > Your VCN
   - Click on the Security List
   - Add Ingress Rule:
     - Source: 10.0.0.0/16 (your VCN CIDR)
     - Protocol: TCP
     - Destination Port: 5001

3. **Also open in iptables on VM2:**
   ```bash
   sudo iptables -I INPUT -p tcp --dport 5001 -j ACCEPT
   sudo netfilter-persistent save
   ```

4. **Test from VM1:**
   ```bash
   curl http://VM2_INTERNAL_IP:5001/health
   ```

---

## API Endpoints Summary

| Endpoint | Method | Description | Example |
|----------|--------|-------------|---------|
| `/health` | GET | Health check | `/health` |
| `/gainers/{exchange}` | GET | Top gainers | `/gainers/BINANCE?timeframe=15m&limit=10` |
| `/losers/{exchange}` | GET | Top losers | `/losers/KUCOIN?timeframe=1h&limit=5` |
| `/analyze/{symbol}` | GET | Technical analysis | `/analyze/BTCUSDT?exchange=BINANCE&timeframe=4h` |
| `/bollinger/{exchange}` | GET | Bollinger squeeze scan | `/bollinger/BYBIT?timeframe=1h` |
| `/exchanges` | GET | List supported exchanges | `/exchanges` |

---

## Discord Commands Summary

| Command | Description | Example |
|---------|-------------|---------|
| `!gainers [exchange] [timeframe]` | Top gainers | `!gainers BINANCE 15m` |
| `!losers [exchange] [timeframe]` | Top losers | `!losers KUCOIN 1h` |
| `!ta <symbol> [exchange] [timeframe]` | Technical analysis | `!ta BTCUSDT BINANCE 4h` |
| `!markets` | List supported exchanges | `!markets` |

---

## Notes

- **Rate limits:** TradingView may rate limit - the MCP handles retries
- **Timeframes:** 5m, 15m, 1h, 4h, 1D, 1W, 1M
- **Default exchange:** BINANCE (most reliable data)
- **Error handling:** If VM2 is down, commands return "Trading API not configured"

---

## Future Ideas

- Add `!alerts` to set price alerts
- Add `!portfolio` to track holdings
- Add Bollinger squeeze notifications
- Cache results for 1-5 minutes to reduce API calls
