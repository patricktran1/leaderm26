/**
 * The three compositions.
 *
 * They are not one template with a colour variable. Each direction has its own
 * typeface, its own scale, its own navigation model and its own answer to the
 * hardest question on a dermatology site — how a patient finds the thing they
 * need out of forty services.
 *
 * Importing this file pulls in all three design systems, which is why the
 * prose describing them lives in ./meta.ts: the pitch page and the internal
 * index talk about the directions without shipping them.
 */
import ChapterChrome from './chapter/Chrome.astro';
import ChapterHome from './chapter/Home.astro';
import ChapterPhysicians from './chapter/Physicians.astro';
import ChapterServices from './chapter/Services.astro';
import ChapterContact from './chapter/Contact.astro';

import ClinicChrome from './clinic/Chrome.astro';
import ClinicHome from './clinic/Home.astro';
import ClinicPhysicians from './clinic/Physicians.astro';
import ClinicServices from './clinic/Services.astro';
import ClinicContact from './clinic/Contact.astro';

import AtelierChrome from './atelier/Chrome.astro';
import AtelierHome from './atelier/Home.astro';
import AtelierPhysicians from './atelier/Physicians.astro';
import AtelierServices from './atelier/Services.astro';
import AtelierContact from './atelier/Contact.astro';

/**
 * Deliberately not annotated: the inferred Astro component types are what let
 * a route render `DIRECTION_UI[id].home` without the checker losing track of
 * what it is holding.
 */
export const DIRECTION_UI = {
  chapter: {
    Chrome: ChapterChrome,
    home: ChapterHome,
    physicians: ChapterPhysicians,
    services: ChapterServices,
    contact: ChapterContact,
  },
  clinic: {
    Chrome: ClinicChrome,
    home: ClinicHome,
    physicians: ClinicPhysicians,
    services: ClinicServices,
    contact: ClinicContact,
  },
  atelier: {
    Chrome: AtelierChrome,
    home: AtelierHome,
    physicians: AtelierPhysicians,
    services: AtelierServices,
    contact: AtelierContact,
  },
} as const;

export { DIRECTION_LIST, DIRECTIONS_BY_ID, type Direction } from './meta';
