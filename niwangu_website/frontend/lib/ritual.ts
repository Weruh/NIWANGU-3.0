import { RitualQuestion } from '../types';

export const RITUAL_QUESTIONS: RitualQuestion[] = [
  {
    id: 1,
    category: 'Intent',
    question: 'What are you building right now?',
    type: 'choice',
    options: ['A Life Partnership', 'A Deep Friendship', 'A Family Foundation', 'Self-Discovery'],
  },
  {
    id: 2,
    category: 'Intent',
    question: 'What is your timeline for commitment?',
    type: 'choice',
    options: ['Immediate', 'Within a year', 'Open-ended', 'Taking it slow'],
  },
  {
    id: 3,
    category: 'Life Stage',
    question: 'Where are you in your career/purpose?',
    type: 'choice',
    options: ['Building', 'Established', 'Transitioning', 'Searching'],
  },
  {
    id: 4,
    category: 'Life Stage',
    question: 'Do you have children?',
    type: 'choice',
    options: ['Yes, and they are my world', 'Yes, they are independent', 'No'],
  },
  {
    id: 5,
    category: 'Life Stage',
    question: 'Do you desire future children?',
    type: 'choice',
    options: ['Yes, absolutely', 'Maybe, with the right person', 'No, my family is complete'],
  },
  {
    id: 6,
    category: 'Values',
    question: 'Choose your top Core Value (1 of 3)',
    type: 'choice',
    options: ['Integrity', 'Creativity', 'Security', 'Freedom', 'Community'],
  },
  {
    id: 7,
    category: 'Values',
    question: 'What is your top Non-Negotiable?',
    type: 'choice',
    options: ['Smoking', 'Dishonesty', 'Lack of Ambition', 'Emotional Unavailability'],
  },
  {
    id: 8,
    category: 'Style',
    question: 'How do you handle conflict?',
    type: 'choice',
    options: ['Space then Talk', 'Talk immediately', 'Process internally', 'Seek mediation'],
  },
  {
    id: 9,
    category: 'Style',
    question: 'What is your social energy?',
    type: 'choice',
    options: ['Introverted Homebody', 'Extroverted Explorer', 'Ambivert', 'Socially Selective'],
  },
  {
    id: 10,
    category: 'Readiness',
    question: 'Why Niwangu?',
    type: 'choice',
    options: ['Tired of swiping', 'Seeking depth', 'Recommended by friend', 'Curiosity'],
  },
  {
    id: 11,
    category: 'Readiness',
    question: 'How important is introspection to you?',
    type: 'choice',
    options: ['Vital', 'Important', 'Occasional', 'Not a priority'],
  },
  {
    id: 12,
    category: 'The Boundary',
    question: 'What are you no longer willing to entertain?',
    type: 'text',
    maxLength: 200,
  },
];

export const getProfileFieldsFromAnswers = (answers: Record<number, string>) => ({
  intent: answers[1] ?? '',
  core_value: answers[6] ?? '',
  why_niwangu: answers[10] ?? '',
  boundary: answers[12] ?? '',
  onboarding_completed: Boolean(answers[1] && answers[6] && answers[10] && answers[12]),
});
