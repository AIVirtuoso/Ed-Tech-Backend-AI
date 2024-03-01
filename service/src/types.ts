const languages = [
  'English',
  'Spanish',
  'French',
  'Mandarin',
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
