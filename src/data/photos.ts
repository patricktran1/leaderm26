/**
 * PHOTO MANIFEST
 * ----------------------------------------------------------------------------
 * This is the only file you edit to publish a new photograph.
 *
 *   1. Drop the image file into `src/assets/photos/` (webp, jpg or png).
 *      Use the highest resolution you have — the build downsizes it.
 *   2. Add an entry below whose `id` matches the filename without extension.
 *   3. Commit. That's it.
 *
 * `weight` drives the editorial grid, not a hard column count:
 *   lead   — a full-width or double-width moment (use sparingly, 1–3 total)
 *   major  — a strong image given extra room
 *   minor  — supporting frames
 *
 * `feature: true` promotes the photograph into the hero / full-bleed slots.
 * Entries are rendered in array order; `category` powers the gallery filter
 * label and the lightbox metadata line.
 */

export const CATEGORIES = ['venue', 'room', 'people', 'artifact'] as const;
export type Category = (typeof CATEGORIES)[number];

export type Weight = 'lead' | 'major' | 'minor';

export interface Photo {
  /** Filename in `src/assets/photos/` without its extension. */
  id: string;
  /** Short editorial caption shown under the frame and in the lightbox. */
  caption: string;
  /** Screen-reader description. Describe the frame, never guess identities. */
  alt: string;
  /** Optional second line, lightbox only. */
  note?: string;
  category: Category;
  weight: Weight;
  /** Eligible for hero / full-bleed placement. */
  feature?: boolean;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  venue: 'Venue',
  room: 'The room',
  people: 'People',
  artifact: 'From the floor',
};

export const photos: Photo[] = [
  {
    id: 'DSC01757',
    caption: 'Arrival',
    alt: 'The covered entrance of the Pendry Newport Beach, looking through to a sunlit courtyard.',
    note: 'Eight in the morning, before the badges.',
    category: 'venue',
    weight: 'lead',
    feature: true,
  },
  {
    id: 'DSC01758',
    caption: 'An indoor garden',
    alt: 'A tall potted palm and low planting beds in a stone-floored interior courtyard off the hotel lobby.',
    category: 'venue',
    weight: 'minor',
  },
  {
    id: 'DSC01762',
    caption: 'Geometry overhead',
    alt: 'A hexagonal light sculpture of nested illuminated tubes suspended in a dark stairwell.',
    category: 'venue',
    weight: 'minor',
    feature: true,
  },
  {
    id: 'DSC01775',
    caption: 'Breakfast, first',
    alt: 'Attendees serving themselves from a breakfast buffet laid out on a long wooden counter.',
    category: 'people',
    weight: 'minor',
  },
  {
    id: 'IMG_7879',
    caption: 'Before the room fills',
    alt: 'An empty ballroom set with round banquet tables, projection screens lit and waiting.',
    note: 'Twenty tables, set for twenty conversations.',
    category: 'room',
    weight: 'major',
  },
  {
    id: 'IMG_7878',
    caption: 'Twenty tables, to scale',
    alt: 'A printed floor plan of the ballroom showing twenty round tables arranged in front of a stage.',
    category: 'artifact',
    weight: 'minor',
  },
  {
    id: 'IMG_7877',
    caption: 'The table themes board',
    alt: 'A printed board titled "Table Themes" listing twenty numbered tables, each with a faculty host and a discussion topic.',
    note: 'The full list is transcribed further down this page.',
    category: 'artifact',
    weight: 'minor',
  },
  {
    id: 'IMG_7885',
    caption: 'Opening remarks',
    alt: 'A speaker stands beside a projection screen reading "Welcome to LEADderm" in a hotel ballroom.',
    note: 'The first slide of the third annual meeting.',
    category: 'room',
    weight: 'major',
    feature: true,
  },
  {
    id: 'IMG_7886',
    caption: 'The floor',
    alt: 'A faculty member in a tweed jacket and bow tie speaking from notes in front of a red stage curtain.',
    category: 'people',
    weight: 'minor',
  },
  {
    id: 'IMG_7884',
    caption: 'Mid-session',
    alt: 'A wide view across banquet tables toward a lit stage during a talk, a coffee cup in the foreground.',
    category: 'room',
    weight: 'minor',
  },
  {
    id: 'DSC01774',
    caption: 'Between sessions',
    alt: 'A small group of attendees talking around a cocktail table beneath a chandelier in a hotel foyer.',
    note: 'Where the conference actually happens.',
    category: 'people',
    weight: 'minor',
  },
  {
    id: 'DSC01778',
    caption: '\u201cOne thing that keeps me grounded\u2026\u201d',
    alt: 'An easel holding a poster with a hand-drawn thought bubble reading "One thing that keeps me grounded is...", surrounded by sticky notes left by attendees.',
    note: 'The 2026 meeting is themed Strong Ground.',
    category: 'artifact',
    weight: 'lead',
    feature: true,
  },
  {
    id: 'DSC01783',
    caption: '\u201cLeadership isn\u2019t always quiet.\u201d',
    alt: 'A printed table card reading "Leadership isn\'t always quiet. Sometimes the best ideas make a little noise."',
    note: 'Left on the entrepreneurship table, beside a bowl of Pop Rocks.',
    category: 'artifact',
    weight: 'major',
  },
];
