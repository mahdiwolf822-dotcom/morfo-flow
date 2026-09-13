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
