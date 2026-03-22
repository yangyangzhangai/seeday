// DOC-DEPS: LLM.md -> docs/ACTIVITY_LEXICON.md
//
// Italian category lexicon.
// Previously activityType.ts had ZERO Italian keywords for any category.
// This file provides full coverage matching the activity vocabulary in liveInputRules.it.ts.

import type { CategoryLexicon } from './types';

export const itCategoryLexicon: CategoryLexicon = {
  keywords: {

    study: [
      'studio', 'studiare', 'studiando', 'ho studiato',
      'ripasso', 'ripassando', 'ripassato',
      'imparo', 'imparare', 'imparando',
      'lezione', 'corso', 'classe', 'conferenza',
      'compiti', 'homework', 'esame', 'quiz',
      'appunti', 'prendo appunti', 'sto prendendo appunti',
      'lettura', 'leggo', 'leggendo',
      'finanza aziendale', 'statistica',
    ],

    work: [
      'lavoro', 'lavorare', 'lavorando', 'ho lavorato', 'sto lavorando',
      'riunione', 'meeting', 'standup',
      'progetto', 'compito', 'ticket', 'roadmap',
      'ufficio', 'pendolare',
      'codice', 'programmazione', 'debug', 'debuggando',
      'rilascio', 'rilasciato', 'pubblico', 'pubblicato', 'inviato',
      'presentazione', 'slide', 'report', 'documento',
      'email', 'mail', 'messaggio', 'rispondo', 'rispondendo',
      'chiamata', 'telefonata', 'videochiamata',
      'revisiono', 'revisionando',
    ],

    social: [
      'amici', 'famiglia',
      'chatto', 'chattare', 'chiacchiero', 'chiacchierare',
      'chiamata', 'telefonata',
      'uscita', 'uscire', 'uscendo',
      'incontro', 'incontrare', 'incontrando',
      'appuntamento',
      'festa',
      'karaoke', 'gioco da tavolo', 'giochi da tavolo',
      'pranzo con', 'cena con',
    ],

    life: [
      'pasto', 'mangiare', 'mangiando',
      'pranzo', 'cena', 'colazione', 'spuntino',
      'spesa', 'supermercato', 'spesa alimentare',
      'lavatrice', 'lavare i piatti', 'piatti', 'pulizie', 'pulire',
      'immondizia', 'spazzatura', 'buttare la spazzatura',
      'cucinare', 'sto cucinando',
      'dormire', 'sonno', 'riposare',
      'doccia', 'bagno', 'routine',
      'pendolare', 'pendolando', 'metro', 'autobus', 'treno', 'guidando',
      'shopping', 'comprato', 'ho comprato',
      'bollette', 'pagare bollette',
    ],

    entertainment: [
      'videogioco', 'videogiochi', 'gioco', 'giocare', 'giocando',
      'film', 'serie', 'streaming',
      'anime', 'manga', 'romanzo', 'libro',
      'musica', 'canzone', 'concerto',
      'podcast', 'streaming', 'livestream',
      'mostra', 'museo',
      'karaoke',
      'relax', 'rilassarsi', 'rilassandomi',
    ],

    health: [
      'allenamento', 'palestra', 'fitness',
      'correre', 'correndo', 'ho corso', 'corsa',
      'camminare', 'camminando', 'camminata', 'passeggiata',
      'escursione', 'trekking',
      'nuoto', 'nuotare', 'nuotando',
      'yoga', 'pilates', 'stretching', 'stretch',
      'bici', 'bicicletta', 'pedalare', 'pedalando',
      'calcio', 'basket', 'pallavolo', 'tennis', 'badminton',
      'visita medica', 'dentista', 'visita dal dentista',
    ],
  },
};
