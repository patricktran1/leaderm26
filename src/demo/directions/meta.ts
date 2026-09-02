/**
 * What each direction is for — descriptions only, no components.
 *
 * Kept apart from index.ts on purpose: importing that file pulls in all three
 * design systems, and the pitch page and the internal index want to talk about
 * the directions without shipping them.
 */
import type { DirectionId } from '../schema';

export interface Direction {
  id: DirectionId;
  name: string;
  /** One line, for the CLI's picker and the internal index. */
  fits: string;
  /** What actually differs, so the choice is made on structure not taste. */
  shape: string[];
}

/**
 * Kept apart from the descriptions above, and deliberately not annotated: the
 * inferred Astro component types are what let a route render
 * `DIRECTION_UI[id].home` without the checker losing track of what it is.
 */
export const DIRECTION_LIST: Direction[] = [
  {
    id: 'chapter',
    name: 'Chapter',
    fits: 'A medical and surgical practice of two or three physicians whose depth is the selling point.',
    shape: [
      'Centred masthead on a hard rule; navigation below it, nothing sticky.',
      'Hero holds a statement and one portrait, and no button at all.',
      'Services set as a book’s contents — grouped, ruled, name against one line.',
      'One physician per spread, portrait beside a real paragraph.',
      'One typeface throughout, bone and ink, an olive that only appears on hover.',
    ],
  },
  {
    id: 'clinic',
    name: 'Clinic',
    fits: 'A multi-clinician practice with same-week capacity and a scheduler already running.',
    shape: [
      'Sticky header carrying the phone number and the booking action on every screen.',
      'A fixed action bar at the thumb on a phone.',
      'Hero is short: a promise, two actions, and the three things people actually book.',
      'Services filter by text and category, because nineteen items is past scanning.',
      'Clinicians as a compact card grid; grotesque throughout, white, hairline borders.',
    ],
  },
  {
    id: 'atelier',
    name: 'Atelier',
    fits: 'A single-physician cosmetic practice being pulled into a price war it should not be in.',
    shape: [
      'Navigation hidden behind one word that opens a full-screen panel.',
      'Full-bleed hero plate with the sentence sitting on it.',
      'Treatments one per row, alternating, each with its own plate — never a menu.',
      'The physician is the second thing on the page, at portrait size.',
      'Light old-style serif on warm black; the only sans is the tiny tracked label.',
    ],
  },
];

export const DIRECTIONS_BY_ID = Object.fromEntries(
  DIRECTION_LIST.map((d) => [d.id, d]),
) as Record<DirectionId, Direction>;
