// یک محل واحد برای واکشی اعتبارنامه‌های AI هر اتوماسیون، تا در سه جای مختلف
// (وبهوک تلگرام، ویجت وب‌سایت، تست زنده داشبورد) کوئری تکرار نشه.
export async function getAiCredentials(env, automationId) {
  const { results } = await env.MORFO_DB
    .prepare('SELECT provider, api_key_encrypted, is_active, priority FROM ai_credentials WHERE automation_id = ? ORDER BY priority ASC')
    .bind(automationId)
    .all();
  return results;
}
