export const MOTIVATIONAL_QUOTES: string[] = [
  "The only bad workout is the one that didn't happen.",
  "Discipline beats motivation every time.",
  "Small weights today, heavy weights tomorrow.",
  "Your only competition is who you were yesterday.",
  "Show up. That's most of the battle.",
  "Strength is built one rep at a time.",
  "No excuses. Just reps.",
  "The iron never lies.",
  "Consistency is the real secret weapon.",
  "One more rep than yesterday.",
];

export function pickRandomQuote(): string {
  const index = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
  return MOTIVATIONAL_QUOTES[index];
}