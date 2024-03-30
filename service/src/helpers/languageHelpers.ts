import { Languages } from '../types';

const translations: Record<Languages, { true: string; false: string }> = {
  English: { true: 'True', false: 'False' },
  Spanish: { true: 'Verdadero', false: 'Falso' },
  French: { true: 'Vrai', false: 'Faux' },
  Mandarin: { true: '真', false: '假' },
  Portuguese: { true: 'Verdadeiro', false: 'Falso' },
  Ukranian: { true: 'Правда', false: 'Неправда' },
  Arabic: { true: 'صحيح', false: 'خاطئ' },
  Hindi: { true: 'सच', false: 'झूठ' },
  German: { true: 'Wahr', false: 'Falsch' },
  Italian: { true: 'Vero', false: 'Falso' },
  Turkish: { true: 'Doğru', false: 'Yanlış' },
  Vietnamese: { true: 'Đúng', false: 'Sai' },
  Swahili: { true: 'Kweli', false: 'Si kweli' },
  Polish: { true: 'Prawda', false: 'Fałsz' },
  Japanese: { true: '真実', false: '間違い' }
};

// Function to get true or false words in the specified language
export function getTrueFalseWordsInLanguage(language: Languages): {
  trueWord: string;
  falseWord: string;
} {
  let translation = translations[language];
  if (!translation) {
    translation = translations.English;
  }
  return { trueWord: translation.true, falseWord: translation.false };
}
