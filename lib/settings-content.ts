// Shared default content + token rendering for academy-configurable message
// templates. Kept dependency-free so it can be imported from API routes and
// client components alike.

export const DEFAULT_REMINDER_TEMPLATE =
  "Dear {{parent_name}}, this is a reminder from {{academy_name}} that {{student_name}}'s fee of {{amount}} for {{month}} is {{status}}. Please clear it at your earliest convenience. Thank you."

export const REMINDER_TEMPLATE_TOKENS = ['parent_name', 'student_name', 'academy_name', 'amount', 'month', 'status'] as const

export function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => (key in vars ? vars[key] : match))
}
