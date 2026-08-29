/**
 * The twenty table themes, transcribed on site from the printed board
 * photographed in the gallery above (`IMG_7877`). Faculty names are recorded
 * exactly as they were printed.
 */
export interface TableTheme {
  table: number;
  host: string;
  theme: string;
}

export const tables: TableTheme[] = [
  { table: 1, host: 'Dr. Adam Friedman', theme: 'The power of saying yes… and no' },
  { table: 2, host: 'Dr. Dustin Portela', theme: 'Tips for running an efficient practice and lowering overhead' },
  { table: 3, host: 'Eva McLellan · Kaye Vitug', theme: 'Integrated health and the longevity leap: from living longer to living fully' },
  { table: 4, host: 'Gina Mangum', theme: 'Leaders bring the weather. What weather are you bringing?' },
  { table: 5, host: 'Jeff Bonnaud', theme: 'Incorporating and training PAs and NPs into your practice' },
  { table: 6, host: 'Josh Adamson', theme: 'Managing presentation anxiety' },
  { table: 7, host: 'Dr. Kristina Duffin', theme: 'Favorite book recently read' },
  { table: 8, host: 'Dr. Leon Kircik', theme: 'Travel' },
  { table: 9, host: 'Dr. Lisa Swanson', theme: 'Taylor Swift' },
  { table: 10, host: 'Dr. Manju Dawkins', theme: 'Heart-led entrepreneurship' },
  { table: 11, host: 'Nana Danso', theme: 'The keys to confident communication' },
  { table: 12, host: 'Nita Nautiyal', theme: 'The conversations that changed our careers' },
  { table: 13, host: 'Dr. Peter Lio', theme: 'Integrative dermatology: what actually works?' },
  { table: 14, host: 'Dr. Radhika Shah', theme: 'Dermatology hot takes' },
  { table: 15, host: 'Dr. Ranna Parekh', theme: 'Creating a culture of wellbeing at LEADderm' },
  { table: 16, host: 'Dr. Ross Levy', theme: 'Ask me anything about your start-up idea' },
  { table: 17, host: 'Laurie Baedke', theme: 'Coachability' },
  { table: 18, host: 'Dr. Shawn Allen', theme: 'Why do you hold back on direct feedback with peers, staff or leadership?' },
  { table: 19, host: 'Dr. Steve Daveluy', theme: 'Your favorite life hack' },
  { table: 20, host: 'Denise Mann', theme: 'Media' },
];
