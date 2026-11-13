// Basic name rule used by Department, Section, Employee, Leave type and Holiday forms:
// must start with a capital letter, contain no numbers, and may use letters, spaces
// and common name punctuation:  . ' ’ - & ( ) / ,
// e.g. "Dr. Ambedkar Jayanti", "Mother's Day", "Sales & Marketing".
const NAME_PATTERN = /^\p{Lu}[\p{L}\s.'’&()/,-]*$/u;

/**
 * Returns an error message for an invalid name, or "" when it is valid.
 * An empty value returns "" too — "required" is checked separately by each form.
 */
export function nameError(value, label = "Name") {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (!/^\p{Lu}/u.test(text)) return `${label} must start with a capital letter.`;
  if (/\d/.test(text)) return `${label} cannot contain numbers.`;
  if (!NAME_PATTERN.test(text))
    return `${label} contains characters that are not allowed (use letters, spaces and . ' - & ( ) / , only).`;
  return "";
}
