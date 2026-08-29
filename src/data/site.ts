export const site = {
  name: 'LEADderm 2026 — Field Notes',
  shortName: 'Field Notes',
  tagline: 'An independent visual journal from LEADderm 2026',
  description:
    'An independent photographic and editorial journal from LEADderm 2026 — the third annual leadership meeting for dermatology, held August 29–30 at the Pendry Newport Beach. Photographed and built on site by Patrick Tran, MD, FAAD.',
  url: 'https://leaderm26.vercel.app',
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

/**
 * One source for the section sequence: the numerals printed beside each
 * heading, the masthead links and the mobile index all read from here, so they
 * can never disagree.
 */
export const sections = [
  { id: 'gathering', label: 'The gathering' },
  { id: 'journal', label: 'Journal' },
  { id: 'tables', label: 'Twenty tables' },
  { id: 'notes', label: 'Field notes' },
  { id: 'practice', label: 'Practice' },
  { id: 'colophon', label: 'Colophon' },
] as const;

export type SectionId = (typeof sections)[number]['id'];

export const sectionNumber = (id: SectionId): string =>
  String(sections.findIndex((s) => s.id === id) + 1).padStart(2, '0');

export const sectionLabel = (id: SectionId): string =>
  sections.find((s) => s.id === id)!.label;
