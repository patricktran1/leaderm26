export const site = {
  name: 'LEADderm 2026 — Field Notes',
  shortName: 'Field Notes',
  tagline: 'An independent visual journal from LEADderm 2026',
  description:
    'An independent photographic and editorial journal from LEADderm 2026 — the third annual leadership meeting for dermatology, held August 29–30 at the Pendry Newport Beach. Photographed and built on site by Patrick Tran, MD, FAAD.',
  url: 'https://leadderm26.vercel.app',
  locale: 'en_US',
} as const;

export const conference = {
  name: 'LEADderm 2026',
  edition: 'Third annual',
  theme: 'Strong Ground',
  dates: 'August 29–30, 2026',
  startDate: '2026-08-29',
  endDate: '2026-08-30',
  venue: 'Pendry Newport Beach',
  city: 'Newport Beach, California',
  official: 'https://www.leadderm.org/',
  /** Wording taken from the conference's own public description of itself. */
  positioning: 'the intersection of leadership, community and diversity in dermatology',
  organizer: 'LEADmed Foundation',
} as const;

export const author = {
  name: 'Patrick Tran, MD, FAAD',
  short: 'Patrick Tran',
  email: 'patrick@trandermatology.com',
  instagram: 'drpatricktran',
  instagramUrl: 'https://instagram.com/drpatricktran',
} as const;

export const nav = [
  { href: '#gathering', label: 'The gathering' },
  { href: '#journal', label: 'Journal' },
  { href: '#tables', label: 'Twenty tables' },
  { href: '#notes', label: 'Field notes' },
  { href: '#colophon', label: 'Colophon' },
] as const;
