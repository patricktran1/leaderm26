/** The journal's share card: the typographic plate plus the opening frame. */
import type { APIRoute } from 'astro';
import { heroPhoto } from '../data/gallery';
import { ogCard } from '../data/ogcard';

export const GET: APIRoute = () => ogCard('assets/og-plate.png', heroPhoto('IMG_7885', 'DSC01781'));
