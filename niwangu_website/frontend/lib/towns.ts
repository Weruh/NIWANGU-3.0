export const TOWN_OPTIONS = [
  'Nairobi',
  'Mombasa',
  'Kisumu',
  'Nakuru',
  'Eldoret',
  'Thika',
  'Kiambu',
  'Machakos',
  'Naivasha',
  'Nyeri',
  'Meru',
  'Kisii',
  'Kakamega',
  'Kericho',
  'Kitale',
  'Malindi',
  'Garissa',
  'Embu',
  'Nanyuki',
  'Bungoma',
];

export const normalizeTown = (location: string) => location.split(',')[0]?.trim() ?? '';
