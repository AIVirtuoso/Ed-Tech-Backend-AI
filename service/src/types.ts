const languages = [
  'English',
  'Spanish',
  'French',
  'Portuguese',
  'Ukranian',
  'Arabic',
  'Hindi',
  'German',
  'Italian',
  'Turkish',
  'Vietnamese',
  'Swahili',
  'Polish'
] as const;

export type Languages = (typeof languages)[number];
