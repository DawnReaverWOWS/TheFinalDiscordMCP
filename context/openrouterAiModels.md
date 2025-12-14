# OpenRouter Free AI Models

> Last Updated: December 2024
> Source: https://openrouter.ai/models?max_price=0

This document lists all **completely free** AI models available on OpenRouter (both input and output at $0/M tokens).

## Quick Reference - Recommended for Discord Bot

These models are recommended for DrovaBot based on quality, reliability, and context length:

| Model ID | Context | Best For |
|----------|---------|----------|
| `google/gemini-2.0-flash-exp:free` | 1.05M | Fast, multimodal, excellent quality |
| `meta-llama/llama-3.3-70b-instruct:free` | 131K | High quality multilingual chat |
| `qwen/qwen3-235b-a22b:free` | 131K | Reasoning, 100+ languages |
| `nousresearch/hermes-3-llama-3.1-405b:free` | 131K | 405B params, best open model |
| `amazon/nova-2-lite-v1:free` | 1M | Multimodal, video/image/text |
| `qwen/qwen3-coder:free` | 262K | Best for coding tasks |
| `z-ai/glm-4.5-air:free` | 131K | Agent-centric, MoE |

---

## All Free Models (34 Total)

### Tier 1: Best Quality (Recommended)

#### Google Gemini 2.0 Flash Experimental
- **Model ID:** `google/gemini-2.0-flash-exp:free`
- **Context:** 1.05M tokens
- **Description:** Faster time to first token (TTFT) compared to Gemini Flash 1.5, quality on par with Gemini Pro 1.5. Enhanced multimodal understanding, coding, complex instruction following, and function calling.
- **Best For:** General chat, coding, multimodal tasks

#### Meta Llama 3.3 70B Instruct
- **Model ID:** `meta-llama/llama-3.3-70b-instruct:free`
- **Context:** 131K tokens
- **Description:** 70B parameter multilingual LLM optimized for dialogue. Supports English, German, French, Italian, Portuguese, Hindi, Spanish, and Thai.
- **Best For:** Multilingual chat, general assistance

#### Nous Hermes 3 405B Instruct
- **Model ID:** `nousresearch/hermes-3-llama-3.1-405b:free`
- **Context:** 131K tokens
- **Description:** 405B parameter frontier-level model. Advanced agentic capabilities, roleplaying, reasoning, multi-turn conversation. Competitive with Llama-3.1 Instruct.
- **Best For:** Complex reasoning, roleplay, agentic tasks

#### Qwen3 235B A22B
- **Model ID:** `qwen/qwen3-235b-a22b:free`
- **Context:** 131K tokens
- **Description:** 235B parameter MoE model (22B active). Dual "thinking" and "non-thinking" modes. 100+ languages support. Strong reasoning and tool-calling.
- **Best For:** Reasoning, multilingual, agent workflows

#### Amazon Nova 2 Lite
- **Model ID:** `amazon/nova-2-lite-v1:free`
- **Context:** 1M tokens
- **Description:** Fast, cost-effective reasoning model for everyday workloads. Processes text, images, and videos. Excellent at document processing, video extraction, code generation.
- **Best For:** Multimodal tasks, documents, video

---

### Tier 2: Excellent Quality

#### Qwen3 Coder 480B A35B
- **Model ID:** `qwen/qwen3-coder:free`
- **Context:** 262K tokens
- **Description:** MoE code generation model (480B total, 35B active). Optimized for agentic coding, function calling, tool use, and long-context repository reasoning.
- **Best For:** Coding, software engineering

#### Z.AI GLM 4.5 Air
- **Model ID:** `z-ai/glm-4.5-air:free`
- **Context:** 131K tokens
- **Description:** Lightweight MoE model for agent-centric applications. Dual "thinking" and "non-thinking" modes via `reasoning` parameter.
- **Best For:** Agent tasks, real-time interaction

#### MoonshotAI Kimi K2
- **Model ID:** `moonshotai/kimi-k2:free`
- **Context:** 33K tokens
- **Description:** 1T total parameters (32B active). Excels at coding (LiveCodeBench, SWE-bench), reasoning (ZebraLogic, GPQA), and tool-use.
- **Best For:** Coding, reasoning, tool use

#### AllenAI Olmo 3 32B Think
- **Model ID:** `allenai/olmo-3-32b-think:free`
- **Context:** 66K tokens
- **Description:** 32B parameter model for deep reasoning, complex logic chains, and advanced instruction-following. Apache 2.0 license, fully open.
- **Best For:** Deep reasoning, logic

#### OpenAI gpt-oss-120b
- **Model ID:** `openai/gpt-oss-120b:free`
- **Context:** 131K tokens
- **Description:** 117B parameter MoE model (5.1B active per pass). Configurable reasoning depth, native tool use, function calling, browsing, structured output.
- **Best For:** Reasoning, agentic tasks, tool use

#### OpenAI gpt-oss-20b
- **Model ID:** `openai/gpt-oss-20b:free`
- **Context:** 131K tokens
- **Description:** 21B parameter MoE model (3.6B active). Apache 2.0 license. Lower latency, consumer-friendly hardware. Function calling and structured outputs.
- **Best For:** Fast inference, tool use

---

### Tier 3: Specialized / Smaller Models

#### Kwaipilot KAT-Coder-Pro V1
- **Model ID:** `kwaipilot/kat-coder-pro:free`
- **Context:** 256K tokens
- **Description:** Advanced agentic coding model. 73.4% on SWE-Bench Verified. Optimized for tool-use, multi-turn interaction, instruction following.
- **Best For:** Software engineering, agentic coding

#### NVIDIA Nemotron Nano 12B 2 VL
- **Model ID:** `nvidia/nemotron-nano-12b-v2-vl:free`
- **Context:** 128K tokens
- **Description:** 12B multimodal reasoning model for video understanding and document intelligence. Hybrid Transformer-Mamba architecture.
- **Best For:** Document OCR, video, multimodal

#### NVIDIA Nemotron Nano 9B V2
- **Model ID:** `nvidia/nemotron-nano-9b-v2:free`
- **Context:** 128K tokens
- **Description:** 9B LLM trained from scratch. Unified model for reasoning and non-reasoning tasks. Configurable via system prompt.
- **Best For:** General reasoning, efficiency

#### Mistral Small 3.1 24B
- **Model ID:** `mistralai/mistral-small-3.1-24b-instruct:free`
- **Context:** 128K tokens
- **Description:** 24B multimodal model. Vision tasks, image analysis, programming, math, multilingual. Function calling support.
- **Best For:** Multimodal, vision, coding

#### TNG DeepSeek R1T2 Chimera
- **Model ID:** `tngtech/deepseek-r1t2-chimera:free`
- **Context:** 164K tokens
- **Description:** 671B MoE model merged from DeepSeek R1-0528, R1, and V3-0324. 20% faster than original R1. Long-context analysis.
- **Best For:** Reasoning, long-context analysis

#### TNG DeepSeek R1T Chimera
- **Model ID:** `tngtech/deepseek-r1t-chimera:free`
- **Context:** 164K tokens
- **Description:** Merge of DeepSeek-R1 and V3 (0324). Combines reasoning capabilities with token efficiency. MIT license.
- **Best For:** Reasoning, efficiency

#### TNG R1T Chimera
- **Model ID:** `tngtech/tng-r1t-chimera:free`
- **Context:** 164K tokens
- **Description:** Experimental LLM for creative storytelling and character interaction. EQ-Bench3 ~1305. Improved tool calling.
- **Best For:** Creative writing, roleplay

#### Arcee AI Trinity Mini
- **Model ID:** `arcee-ai/trinity-mini:free`
- **Context:** 131K tokens
- **Description:** 26B MoE model (3B active, 128 experts). Efficient reasoning over long contexts. Function calling and agent workflows.
- **Best For:** Long-context reasoning, agents

#### Alibaba Tongyi DeepResearch 30B A3B
- **Model ID:** `alibaba/tongyi-deepresearch-30b-a3b:free`
- **Context:** 131K tokens
- **Description:** 30B total (3B active). Optimized for deep information-seeking tasks. State-of-the-art on Humanity's Last Exam, GAIA, FRAMES.
- **Best For:** Research, deep search

#### Nex AGI DeepSeek V3.1 Nex N1
- **Model ID:** `nex-agi/deepseek-v3.1-nex-n1:free`
- **Context:** 131K tokens
- **Description:** Flagship Nex-N1 series model. Designed for agent autonomy, tool use, real-world productivity. Strong at coding and HTML generation.
- **Best For:** Agent tasks, coding

---

### Tier 4: Smaller/Lightweight Models

#### Google Gemma 3 27B
- **Model ID:** `google/gemma-3-27b-it:free`
- **Context:** 131K tokens
- **Description:** Google's latest open source model. Multimodal (vision-language input). 140+ languages, math, reasoning, function calling.
- **Best For:** General purpose, multimodal

#### Google Gemma 3 12B
- **Model ID:** `google/gemma-3-12b-it:free`
- **Context:** 33K tokens
- **Description:** Mid-size Gemma 3 model. Multimodal, 140+ languages, structured outputs, function calling.
- **Best For:** Balanced quality/speed

#### Google Gemma 3 4B
- **Model ID:** `google/gemma-3-4b-it:free`
- **Context:** 33K tokens
- **Description:** Lightweight Gemma 3 model. Multimodal, good for resource-constrained environments.
- **Best For:** Fast inference, mobile

#### Google Gemma 3n 4B
- **Model ID:** `google/gemma-3n-e4b-it:free`
- **Context:** 8K tokens
- **Description:** Optimized for mobile/low-resource devices. Multimodal (text, visual, audio). 140+ languages. Memory efficient.
- **Best For:** Mobile, edge devices

#### Google Gemma 3n 2B
- **Model ID:** `google/gemma-3n-e2b-it:free`
- **Context:** 8K tokens
- **Description:** Smallest Gemma 3n model. MatFormer architecture, nested submodels. Low-resource deployment.
- **Best For:** Ultra-lightweight, mobile

#### Qwen3 4B
- **Model ID:** `qwen/qwen3-4b:free`
- **Context:** 41K tokens
- **Description:** 4B dense model. Dual-mode (thinking/non-thinking). Multi-turn chat, instruction following, agent workflows.
- **Best For:** Lightweight, fast chat

#### Meta Llama 3.2 3B Instruct
- **Model ID:** `meta-llama/llama-3.2-3b-instruct:free`
- **Context:** 131K tokens
- **Description:** 3B multilingual LLM. 8 languages, instruction-following, reasoning, tool use. Efficient and accurate.
- **Best For:** Lightweight multilingual chat

#### Mistral 7B Instruct
- **Model ID:** `mistralai/mistral-7b-instruct:free`
- **Context:** 33K tokens
- **Description:** Industry-standard 7.3B model. Optimized for speed and context length. Latest version variant.
- **Best For:** Fast, reliable baseline

#### Venice Uncensored
- **Model ID:** `cognitivecomputations/dolphin-mistral-24b-venice-edition:free`
- **Context:** 33K tokens
- **Description:** Fine-tuned Mistral-Small-24B. "Uncensored" instruct model. Steerability and transparent behavior.
- **Best For:** Unrestricted use cases

---

### Image Generation Models (Partial Free)

> Note: These models have free input but charge for output tokens (image generation).

#### Mistral Devstral
- **Model ID:** `mistralai/devstral-2512:free`
- **Context:** 262K tokens
- **Description:** Agentic coding model optimized for SWE-bench verified (75.3%). MoE with 22.6B active parameters.
- **Note:** Input free, some endpoints may charge for output

#### Sourceful Riverflow V2 (various)
- Models like `sourceful/riverflow-v2-fast-preview`
- **Note:** $0 input but $7.19/M output tokens for image generation

---

## Usage in Code

### OpenRouter API Endpoint
```
https://openrouter.ai/api/v1/chat/completions
```

### Example Request
```typescript
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://your-app.com',
    'X-Title': 'Your App Name'
  },
  body: JSON.stringify({
    model: 'google/gemini-2.0-flash-exp:free',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' }
    ],
    max_tokens: 500,
    temperature: 0.7
  })
});
```

### Model Selection Strategy

For DrovaBot, use this fallback order:
1. `google/gemini-2.0-flash-exp:free` - Best quality, 1M context
2. `meta-llama/llama-3.3-70b-instruct:free` - Reliable fallback
3. `qwen/qwen3-235b-a22b:free` - Strong reasoning
4. `nousresearch/hermes-3-llama-3.1-405b:free` - 405B frontier model
5. `z-ai/glm-4.5-air:free` - Good for agent tasks

---

## Notes

- **:free suffix** - Always append `:free` to the model ID to use the free tier
- **Rate limits** - Free models may have rate limits during high demand
- **Availability** - Models may be temporarily unavailable; always implement fallback
- **Context limits** - Actual usable context may be lower than advertised during peak times
- **Updates** - Check https://openrouter.ai/models?max_price=0 for the latest free models
