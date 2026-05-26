/** Replace {{key}} tags with values (mirrors backend emailTemplateRenderer). */
export function renderEmailTemplate(template, data) {
  if (!template) return "";
  let out = String(template);
  for (const [key, value] of Object.entries(data || {})) {
    const replacement = value == null ? "" : String(value);
    const pattern = new RegExp(`\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`, "g");
    out = out.replace(pattern, replacement);
  }
  return out;
}
