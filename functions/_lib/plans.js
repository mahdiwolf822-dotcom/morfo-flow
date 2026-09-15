// محدودیت‌های هر پلن — نقطه مرکزی کنترل «رایگان در مقابل حرفه‌ای»
// وقتی درگاه پرداخت اضافه شد، همینجا فقط کافیه پلن کاربر از 'free' به 'pro' تغییر کنه.

export const PLAN_LIMITS = {
  free: {
    maxAutomations: 1,
    maxRulesPerAutomation: 3,
  },
  pro: {
    maxAutomations: 20,
    maxRulesPerAutomation: 200,
  },
};

export function limitsFor(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}
