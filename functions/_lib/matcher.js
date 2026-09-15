// پیدا کردن اولین قانونی که کلیدواژه‌اش داخل متن پیام باشه (بدون حساسیت به بزرگی/کوچکی حروف)
// جدا از بقیه کد نگه داشته شده تا بشه بدون نیاز به دیتابیس یا شبکه، مستقل تستش کرد.
export function findMatchingRule(rules, messageText) {
  if (!messageText || typeof messageText !== 'string') return null;
  const normalized = messageText.trim().toLowerCase();
  if (!normalized) return null;

  for (const rule of rules) {
    const keyword = (rule.keyword || '').trim().toLowerCase();
    if (keyword && normalized.includes(keyword)) {
      return rule;
    }
  }
  return null;
}
