-- ساختار جدول کاربران — روی Cloudflare D1 (رایگان تا ۵ گیگابایت و ۵ میلیون خواندن در روز) اجرا می‌شود
-- اجرا: wrangler d1 execute morfo-db --file=./db/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  password_salt TEXT,
  google_id TEXT UNIQUE,
  avatar_url TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- پلن کاربر: 'free' یا 'pro' — تعیین‌کننده محدودیت‌های استفاده از موتور اتوماسیون
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';

-- هر رکورد یعنی یک کانال اتوماسیون که مشتری به سیستم وصل کرده (تلگرام یا ویجت وب‌سایت)
CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL DEFAULT 'telegram', -- 'telegram' | 'website'
  bot_token TEXT,                                 -- فقط برای channel_type='telegram'
  bot_username TEXT,                              -- فقط برای channel_type='telegram'
  webhook_secret TEXT,                            -- فقط برای channel_type='telegram'
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_automations_user_id ON automations(user_id);

-- تنظیمات مشترک «هوش مصنوعی با کلید خودِ مشتری» روی هر اتوماسیون
ALTER TABLE automations ADD COLUMN ai_instructions TEXT;          -- دستورالعمل مشترک لحن/محتوا، مستقل از اینکه کدوم ارائه‌دهنده فعاله
ALTER TABLE automations ADD COLUMN ai_fallback_enabled INTEGER NOT NULL DEFAULT 0; -- «حالت هوشمند»: اگه فعال بود، به ترتیب همه کلیدهای وصل‌شده رو امتحان کن

-- فیلدهای مخصوص کانال اینستاگرام (channel_type='instagram') — به‌جای bot_token از OAuth استفاده می‌کنه
ALTER TABLE automations ADD COLUMN ig_page_id TEXT;                   -- شناسه پیج فیسبوک متصل
ALTER TABLE automations ADD COLUMN ig_account_id TEXT;                -- شناسه حساب اینستاگرام بیزینسی
ALTER TABLE automations ADD COLUMN ig_access_token_encrypted TEXT;    -- توکن دسترسی بلندمدت، رمزنگاری‌شده

CREATE INDEX IF NOT EXISTS idx_automations_ig_account_id ON automations(ig_account_id);

-- هر مشتری می‌تونه هم‌زمان کلید چند ارائه‌دهنده هوش مصنوعی رو وصل کنه (Gemini، OpenAI، Claude، Groq، ...)
-- is_active=1 یعنی همینو به‌عنوان ارائه‌دهنده اصلی انتخاب کرده (سوییچ)؛ فقط یکی می‌تونه در هر لحظه فعال باشه
CREATE TABLE IF NOT EXISTS ai_credentials (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL REFERENCES automations(id),
  provider TEXT NOT NULL,             -- 'gemini' | 'openai' | 'anthropic' | 'groq' | 'openrouter' | 'deepseek'
  api_key_encrypted TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0, -- ترتیب امتحان در حالت هوشمند (fallback)
  created_at TEXT NOT NULL,
  UNIQUE(automation_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_ai_credentials_automation_id ON ai_credentials(automation_id);

-- شمارنده محدودیت نرخ برای endpoint عمومی ویجت (چون CORS بازه و در معرض سوءاستفاده‌ست)
CREATE TABLE IF NOT EXISTS rate_limits (
  rate_key TEXT PRIMARY KEY,     -- مثلاً "widget:<automationId>:<ip>"
  count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);

-- ثبت هر پیام واقعی که جواب داده شده، برای آمار داشبورد («امروز چقدر کار کردی»)
-- پیام‌های تستی از داخل داشبورد (endpoint /test) عمداً اینجا ثبت نمی‌شن.
CREATE TABLE IF NOT EXISTS interactions (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL REFERENCES automations(id),
  source TEXT NOT NULL, -- 'rule' | 'ai' | 'none' | 'ai_error'
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_interactions_automation_id ON interactions(automation_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON interactions(created_at);

-- قوانین پاسخ خودکار هر اتوماسیون: وقتی پیام حاوی «کلیدواژه» بود، «پاسخ» فرستاده می‌شود
CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL REFERENCES automations(id),
  keyword TEXT NOT NULL,
  reply TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rules_automation_id ON automation_rules(automation_id);

-- درخواست‌های اتوماسیون — هم از فرم عمومی سایت (بدون حساب کاربری) و هم از داشبورد مشتری
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),      -- NULL یعنی از فرم عمومی سایت آمده (هنوز حساب نساخته)
  contact_name TEXT,                       -- فقط برای درخواست‌های بدون حساب کاربری پر می‌شود
  contact_phone TEXT,                      -- فقط برای درخواست‌های بدون حساب کاربری پر می‌شود
  business TEXT NOT NULL,
  type TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'در انتظار بررسی',
  source TEXT NOT NULL DEFAULT 'dashboard', -- 'landing' یا 'dashboard'
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
