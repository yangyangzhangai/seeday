// DOC-DEPS: LLM.md -> docs/ACTIVITY_LEXICON.md
//
// Italian category lexicon.
// Previously activityType.ts had ZERO Italian keywords for any category.
// This file provides full coverage matching the activity vocabulary in liveInputRules.it.ts.

import type { CategoryLexicon } from './types.js';

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
      'bere acqua', 'bevo acqua', 'idratarmi',
      'bere te', 'preparare il te', 'fare il caffe', 'preparare il caffe',
      'riempire la borraccia', 'rabboccare la borraccia',
      'bollire l\'acqua', 'ho bollito l\'acqua',
      'fare da mangiare', 'preparare pranzo', 'preparare cena',
      'cuocere il riso', 'cucinare il riso', 'lavare il riso',
      'preparare i pasti', 'fare la zuppa', 'fare il porridge', 'cucinare la pasta', 'preparare gli ingredienti',
      'tagliare le verdure', 'lavare le verdure',
      'spesa', 'supermercato', 'spesa alimentare', 'fare la spesa', 'comprare verdura', 'comprare frutta', 'andare al mercato',
      'comprare latte', 'comprare pane', 'comprare uova', 'fare scorta', 'rifornire la dispensa',
      'lavatrice', 'lavare i piatti', 'piatti', 'pulizie', 'pulire',
      'fare il bucato', 'stendere i panni', 'piegare i vestiti',
      'riordinare la stanza', 'rifare il letto', 'cambiare le lenzuola',
      'passare l\'aspirapolvere', 'lavare il pavimento',
      'immondizia', 'spazzatura', 'buttare la spazzatura', 'svuotare la spazzatura', 'portare fuori la spazzatura',
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
