// این فایل مسئول صدا زدن مدل‌های هوش مصنوعیه — همیشه با کلید API خودِ مشتری، نه کلید ما.
// یعنی هزینه هر پیام رو خودِ مشتری به ارائه‌دهنده می‌ده، نه Morfo Flow.

// چهار ارائه‌دهنده از شش‌تا API سازگار با فرمت OpenAI هستن؛ فقط آدرس و مدل پیش‌فرض فرق داره.
const OPENAI_COMPATIBLE = {
  openai: { baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.1-8b-instant' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1/chat/completions', model: 'meta-llama/llama-3.1-8b-instruct:free' },
  deepseek: { baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
};

// اطلاعات نمایشی هر ارائه‌دهنده — برای رابط کاربری داشبورد (اسم و لینک گرفتن کلید رایگان)
export const PROVIDER_META = {
  gemini: { label: 'Gemini', keyUrl: 'https://aistudio.google.com/apikey' },
  openai: { label: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys' },
  anthropic: { label: 'Claude', keyUrl: 'https://console.anthropic.com/settings/keys' },
  groq: { label: 'Groq', keyUrl: 'https://console.groq.com/keys' },
  openrouter: { label: 'OpenRouter', keyUrl: 'https://openrouter.ai/keys' },
  deepseek: { label: 'DeepSeek', keyUrl: 'https://platform.deepseek.com/api_keys' },
};

export const SUPPORTED_PROVIDERS = Object.keys(PROVIDER_META);

export function isSupportedProvider(provider) {
  return SUPPORTED_PROVIDERS.includes(provider);
}

const DEFAULT_SYSTEM_PROMPT = 'تو یک دستیار پاسخگوی مشتریان یک کسب‌وکار هستی. کوتاه، مودبانه و مفید به فارسی جواب بده.';

export async function generateAiReply({ provider, apiKey, instructions, userMessage }) {
  const systemPrompt = instructions && instructions.trim() ? instructions.trim() : DEFAULT_SYSTEM_PROMPT;

  if (provider === 'gemini') {
    return generateGeminiReply({ apiKey, systemPrompt, userMessage });
  }
  if (provider === 'anthropic') {
    return generateAnthropicReply({ apiKey, systemPrompt, userMessage });
  }
  if (OPENAI_COMPATIBLE[provider]) {
    return generateOpenAiCompatibleReply({ provider, apiKey, systemPrompt, userMessage });
  }
  throw new Error(`ارائه‌دهنده هوش مصنوعی «${provider}» پشتیبانی نمی‌شود`);
}

async function generateGeminiReply({ apiKey, systemPrompt, userMessage }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: 300 },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'خطای نامشخص از Gemini');

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini پاسخی برنگرداند');
  return text.trim();
}

async function generateAnthropicReply({ apiKey, systemPrompt, userMessage }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'خطای نامشخص از Claude');

  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Claude پاسخی برنگرداند');
  return text.trim();
}

async function generateOpenAiCompatibleReply({ provider, apiKey, systemPrompt, userMessage }) {
  const { baseUrl, model } = OPENAI_COMPATIBLE[provider];

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `خطای نامشخص از ${PROVIDER_META[provider].label}`);

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${PROVIDER_META[provider].label} پاسخی برنگرداند`);
  return text.trim();
}
