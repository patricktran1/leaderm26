/**
 * The practice page's content and, more importantly, its numbers.
 *
 * Everything measurable on `/for-practices` is derived here from the photo
 * index and the published gallery, never typed in. A claim on a sales page
 * that quietly goes stale is worse than no claim, and this one is the whole
 * argument: the site is the case study, so it has to be able to count itself.
 */
import { photos, photoIndexMeta, journalDays, publishedAt } from './photos';
import { author, site } from './site';

/* ------------------------------------------------------------- the numbers */

const sourcePixels = photos.reduce(
  (total, photo) => total + photo.sourceWidth * photo.sourceHeight,
  0,
);

export const evidence = {
  /** Photographs on the page right now. */
  published: photos.length,
  /** Files that have been dropped into the inbox folder over the meeting. */
  filesIngested: photoIndexMeta.counts.files,
  /** Frames kept in the repository but held off the page — soft, duplicated. */
  heldBack: photoIndexMeta.hidden.length,
  /** Frames replaced automatically by a higher-resolution copy of themselves. */
  superseded: photoIndexMeta.counts.superseded,
  /** Frames carrying a description written by a person, not a placeholder. */
  described: photos.filter((photo) => !photo.altIsGenerated).length,
  captioned: photos.filter((photo) => !photo.captionIsMissing).length,
  /** Megapixels of original photography that went through the pipeline. */
  megapixels: Math.round(sourcePixels / 1_000_000),
  /** Distinct cameras whose clocks had to be reconciled with each other. */
  cameras: new Set(photos.map((photo) => photo.camera).filter(Boolean)).size,
  days: journalDays,
  /** The largest edge any master is stored at, in pixels. */
  maxEdge: photoIndexMeta.maxEdge,
  lastAdded: publishedAt,
} as const;

/** The four figures worth printing large. Everything else is prose. */
export const figures: { n: string; k: string }[] = [
  { n: String(evidence.published), k: 'photographs published' },
  { n: String(evidence.filesIngested), k: 'files dropped in a folder' },
  { n: `${evidence.megapixels}MP`, k: 'of originals processed' },
  { n: `${evidence.described}/${evidence.published}`, k: 'written descriptions' },
];

/* -------------------------------------------------------------- the offer */

export interface Offer {
  id: string;
  name: string;
  summary: string;
  items: string[];
}

export const offers: Offer[] = [
  {
    id: 'presence',
    name: 'Presence',
    summary: 'The site itself, and everything a stranger decides about you in four seconds.',
    items: [
      'A homepage that earns trust before it asks for anything',
      'Physician and team pages that read like people, not directory rows',
      'Conditions and procedures organised the way patients actually search',
      'Your own photography, shot and handled properly',
      'The phone treated as the primary screen, because it is',
      'The unglamorous local-search foundations, done once and correctly',
    ],
  },
  {
    id: 'operations',
    name: 'Operations',
    summary: 'The repetitive work around the site that quietly eats a morning.',
    items: [
      'Intake and forms that stop the desk re-typing what a patient already typed',
      'Routing, so a message reaches whoever can actually answer it',
      'Recalls and follow-ups that do not depend on someone remembering',
      'Results and referral correspondence that does not live in one person’s inbox',
      'The handful of small tasks that are done fifty times a week',
    ],
  },
  {
    id: 'intelligence',
    name: 'Intelligence',
    summary: 'Language models put where they are genuinely good, and kept out of everywhere else.',
    items: [
      'Drafting: letters, summaries, post-visit instructions — read by a clinician before they go',
      'Content operations: keeping a large site accurate without a marketing retainer',
      'Search across your own protocols and documents, answering in your own words',
      'Never a clinical decision, and never passed off to a patient as though a person wrote it',
    ],
  },
];

/**
 * Small numbers are spelled out in prose and set as numerals in the figures,
 * which is the ordinary rule and the reason the two are written separately.
 */
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const spell = (n: number): string => WORDS[n] ?? String(n);

/* ------------------------------------------------ what this page proves */

export interface Proof {
  /** What the system does — stated as behaviour, not architecture. */
  does: string;
  /** Why a practice would care. */
  means: string;
}

export const proofs: Proof[] = [
  {
    does: 'New photography is published by dropping files into a folder.',
    means: `Nobody renames, resizes, crops or re-orders anything. Over ${spell(evidence.days)} days ${evidence.filesIngested} files went in and ${evidence.published} photographs came out, in the order they were taken.`,
  },
  {
    does: 'Every frame is dated from the camera and placed in time.',
    means: `Two cameras disagreed by twelve hours over the same moment. The site reconciles them, so the day reads in the order it happened rather than the order the files arrived.`,
  },
  {
    does: 'A better copy of a photograph replaces the old one on its own.',
    means: `${spell(evidence.superseded).replace(/^./, (c) => c.toUpperCase())} frames were quietly upgraded when the full-resolution originals turned up. The caption, the description and the link to each one all followed.`,
  },
  {
    does: 'Quality control is a recorded decision, not a deleted file.',
    means: `There are ${evidence.heldBack} frames kept and deliberately off the page — too soft, or duplicated. Nothing was thrown away, so any of them can come back the moment a sharper copy turns up.`,
  },
  {
    does: 'Every photograph carries a description written by a person.',
    means: `All ${evidence.described} of them. A screen reader gets a real sentence, and so does a search engine — the same discipline the rest of your patient-facing writing needs.`,
  },
  {
    does: 'The words live in one plain file, apart from the design.',
    means: 'Every caption and description on the journal sits in a single text file. Whoever knows the practice best can correct a name or rewrite a sentence without touching the layout, and without waiting for me.',
  },
  {
    does: 'The layout is computed from the pictures, not the other way round.',
    means: 'Nothing is cropped to fit a template. A tall frame and a wide one each get the room they need, at every screen width, with no decisions left to make.',
  },
  {
    does: 'The page is built ahead of time and served as finished files.',
    means: 'It opens fast on conference Wi-Fi and on a phone in a waiting room, which is where almost every first impression of a practice now happens.',
  },
  {
    does: 'The link preview composes itself from the current lead photograph.',
    means: 'Send the address to a colleague and it arrives looking considered, without anyone exporting an image or remembering to update one.',
  },
  {
    does: 'Every change is recorded, and the site republishes itself.',
    means: 'There is an account of what changed and when, and a way back to any earlier version of the site — including this sentence.',
  },
];

/* ----------------------------------------------------------- the diagnostic */

export const diagnostic: string[] = [
  'Does the first screen make a stranger trust you, before they have read a word?',
  'Can a patient find the right physician, or the right procedure, in two taps?',
  'Is the mobile experience the good one, or the leftover one?',
  'Are the photographs yours, or of people who have never been in your office?',
  'How many times is a patient’s name typed by staff before they are seen?',
  'Which follow-ups currently depend on somebody remembering?',
  'Does the site represent the standard of the medicine?',
];

/* -------------------------------------------------------------- boundaries */

export const boundaries: string[] = [
  'Invent testimonials, review counts, client logos or case studies.',
  'Put a language model anywhere near a clinical decision.',
  'Use stock photographs of people who have never been in your office.',
  'Build something that only works while I am still answering the phone.',
  'Sell you three things when the honest answer is one.',
];

/* --------------------------------------------------------- the conversion */

/**
 * One email, prefilled with the four things needed to answer usefully. No
 * form, no database, no third party holding a dermatologist's contact details
 * so that a page can claim to have captured a lead.
 */
export const startEmail = (() => {
  const subject = 'My practice';
  const body = [
    'Practice:',
    'City:',
    'Current website:',
    '',
    'What I would want to be better first:',
    '',
    '',
    `— from ${site.url}/for-practices`,
  ].join('\n');
  return `mailto:${author.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
})();
