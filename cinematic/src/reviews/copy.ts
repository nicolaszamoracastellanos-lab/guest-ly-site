/* The Reviews section's words, EN and ES (lazy chunk). The nav label is in
   ./head-copy.ts (first load). {placeholders} are filled by core.ts fill().
   check-copy-claims.mjs holds both dictionaries to every house rule. */
export const reviewsCopy = {
  en: {
    /* The FAQ is № 10 (№ 11 after the guides section), so this follows it. */
    no: '№ 11',
    noAfterGuides: '№ 12',
    kicker: 'Reviews',
    title: 'In their\nown words.',
    intro: 'Written by couples after their wedding with Guest-ly.',
    score: 'out of 5',
    countOne: 'based on 1 review',
    countMany: 'based on {n} reviews',
    stars: '{n} out of 5 stars',
    wedding: 'Wedding in {month}',
    newest: 'The {shown} most recent of {n} reviews.',
  },
  es: {
    no: '№ 11',
    noAfterGuides: '№ 12',
    kicker: 'Reseñas',
    title: 'En sus\npropias palabras.',
    intro: 'Escritas por parejas después de su boda con Guest-ly.',
    score: 'de 5',
    countOne: 'según 1 reseña',
    countMany: 'según {n} reseñas',
    stars: '{n} de 5 estrellas',
    wedding: 'Boda en {month}',
    newest: 'Las {shown} más recientes de {n} reseñas.',
  },
} as const;
