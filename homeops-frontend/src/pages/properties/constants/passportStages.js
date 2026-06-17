/** Passport completion stages — each maps to a 20% band of overall completion. */
export const PASSPORT_STAGES = [
  {
    id: 1,
    slug: "rooted",
    name: "Rooted",
    description:
      "You've planted your flag. This home is officially yours to tend now. Every great story starts with someone deciding to write it down.",
  },
  {
    id: 2,
    slug: "settled-in",
    name: "Settled In",
    description:
      "You know your home. You've captured what makes this place run — the bones, the dates, the details most people lose track of. You're already ahead of where most homeowners ever get.",
  },
  {
    id: 3,
    slug: "caretaker",
    name: "Caretaker",
    description:
      "You don't just own it. You look after it. You're keeping things current — the mark of someone who treats their home like it matters. Future-you is already grateful.",
  },
  {
    id: 4,
    slug: "storykeeper",
    name: "Storykeeper",
    description:
      "Your home has a story worth telling. The improvements, the care, the proof of everything you've poured in — it's all here now. This is what turns a house into a legacy, and a sale into a number people don't argue with.",
  },
  {
    id: 5,
    slug: "good-ancestor",
    name: "Good Ancestor",
    description:
      "You built something that outlasts you. Your home's story is complete, current, and ready for whoever comes next — a buyer, your kids, the future you who forgot the details. You didn't just live here. You left it better. This is the whole point.",
  },
];

/** Resolve stage from a 0–100 completion percentage. */
export function getPassportStage(completionPercent) {
  const percent = Math.round(Math.max(0, Math.min(100, completionPercent)));
  if (percent <= 20) return PASSPORT_STAGES[0];
  if (percent <= 40) return PASSPORT_STAGES[1];
  if (percent <= 60) return PASSPORT_STAGES[2];
  if (percent <= 80) return PASSPORT_STAGES[3];
  return PASSPORT_STAGES[4];
}
