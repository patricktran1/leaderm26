/** The practice page's share card. Ink, so the two are told apart in a feed. */
import type { APIRoute } from 'astro';
import { ogCard, practiceCardPhoto } from '../data/ogcard';

export const GET: APIRoute = () => ogCard('assets/og-practices-plate.png', practiceCardPhoto());
