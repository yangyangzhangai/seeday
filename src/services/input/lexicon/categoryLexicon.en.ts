// DOC-DEPS: LLM.md -> docs/ACTIVITY_LEXICON.md
//
// English category lexicon.
// Previously activityType.ts only had 3-6 English keywords per category.
// This file extends coverage to match the activity vocabulary in liveInputRules.en.ts.

import type { CategoryLexicon } from './types';

export const enCategoryLexicon: CategoryLexicon = {
  keywords: {

    study: [
      'study', 'studying', 'studied',
      'review', 'reviewing', 'reviewed',
      'probability', 'statistics', 'statistical',
      'reviewing probability statistics',
      'learn', 'learning', 'learned',
      'lesson', 'class', 'lecture', 'course',
      'homework', 'assignment',
      'exam', 'quiz', 'test',
      'flashcards', 'notes', 'taking notes', 'took notes',
      'read textbook', 'read paper', 'research paper',
      'prep', 'practice problems',
    ],

    work: [
      'work', 'working', 'worked',
      'meeting', 'standup', 'daily standup', 'sync',
      'project', 'task', 'ticket', 'pr', 'pull request', 'roadmap',
      'office', 'commute', 'commuting',
      'code', 'coding', 'coded', 'debug', 'debugging',
      'deploy', 'deploying', 'deployed', 'release', 'ship', 'shipped',
      'presentation', 'slides', 'report', 'doc', 'document', 'documentation',
      'email', 'emails', 'mail', 'message', 'messages',
      'call', 'phone call', 'video call',
      'review', 'reviewing',
    ],

    social: [
      'social', 'friend', 'friends', 'family',
      'chat', 'chatting', 'chatted',
      'call', 'facetime',
      'hang out', 'hanging out', 'hung out',
      'meet friends', 'meet up',
      'party', 'gathering',
      'date', 'dating',
      'visited', 'visiting',
      'karaoke', 'board game', 'board games', 'game night',
      'lunch with', 'dinner with', 'brunch with',
    ],

    life: [
      'life',
      'meal', 'food', 'eat', 'eating', 'cooked', 'cooking',
      'breakfast', 'lunch', 'dinner', 'brunch', 'snack',
      'grocery', 'groceries', 'supermarket', 'shopping',
      'commute', 'commuting', 'drive', 'driving', 'taxi', 'subway', 'bus', 'train',
      'chores', 'clean', 'cleaning', 'laundry', 'dishes', 'washed dishes',
      'trash', 'garbage',
      'sleep', 'nap', 'rest',
      'shower', 'bath', 'skincare',
      'package', 'parcel', 'errand',
      'pay bills', 'paying bills',
    ],

    entertainment: [
      'entertainment', 'game', 'gaming', 'video game', 'games',
      'movie', 'movies', 'film', 'series', 'tv show', 'tv series',
      'anime', 'manga', 'novel', 'comic',
      'music', 'song', 'playlist', 'concert',
      'podcast', 'livestream', 'stream',
      'video', 'youtube', 'shorts',
      'relax', 'relaxing', 'chill', 'chilling',
      'exhibition', 'museum',
      'karaoke',
    ],

    health: [
      'health', 'healthy',
      'exercise', 'exercising', 'workout', 'training',
      'gym', 'fitness',
      'run', 'running', 'ran', 'jog', 'jogging',
      'walk', 'walking', 'hike', 'hiking',
      'swim', 'swimming',
      'yoga', 'pilates', 'stretching', 'stretch',
      'cycle', 'cycling', 'bike', 'biking',
      'football', 'soccer', 'basketball', 'badminton', 'tennis', 'ping pong', 'table tennis',
      'doctor', 'dentist', 'checkup', 'medical',
    ],
  },
};
