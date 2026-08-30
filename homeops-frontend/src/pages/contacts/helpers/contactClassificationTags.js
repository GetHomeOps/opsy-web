export const CLASSIFICATION_TAG_NAMES = ["Homeowner", "Professional"];

function tagName(tag) {
  if (tag == null) return "";
  return typeof tag === "object" ? String(tag.name || "") : String(tag);
}

export function isClassificationTag(tag) {
  const name = tagName(tag).trim().toLowerCase();
  return CLASSIFICATION_TAG_NAMES.some((n) => n.toLowerCase() === name);
}

export function classificationTagsFromContact(contact) {
  return (contact?.tags || []).filter(isClassificationTag);
}

export function classificationFilterOptions(accountTags = [], contacts = []) {
  const byName = new Map();
  const add = (tag) => {
    if (!isClassificationTag(tag)) return;
    const t = typeof tag === "object" ? tag : {id: tag, name: String(tag)};
    if (t?.id == null) return;
    const key = tagName(t).trim().toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, {id: t.id, name: t.name || key});
    }
  };
  accountTags.forEach(add);
  contacts.forEach((c) => (c.tags || []).forEach(add));
  return CLASSIFICATION_TAG_NAMES.map((name) => {
    const found = byName.get(name.toLowerCase());
    return found ? {value: String(found.id), label: found.name} : null;
  }).filter(Boolean);
}
