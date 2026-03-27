/** US NANP digits only (10 digits; strips a leading 1 from 11-digit input). */
export function stripUSPhoneDigits(value) {
  const d = String(value ?? "").replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") return d.slice(1, 11);
  return d.slice(0, 10);
}

/**
 * Formats as (XXX) XXX-XXXX while typing. Non-digits are ignored except they
 * contribute to stripping; result is always derived from digit sequence.
 */
export function formatUSPhoneInput(value) {
  const d = stripUSPhoneDigits(value);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
}

/** tel: URI for US 10-digit numbers (E.164 +1). */
export function telUriFromUSPhone(value) {
  const d = stripUSPhoneDigits(value);
  if (d.length === 10) return `tel:+1${d}`;
  return "";
}
