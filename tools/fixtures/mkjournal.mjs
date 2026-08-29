/* Builds a sandbox repo whose photos/ holds N realistic frames with EXIF. */
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, readdirSync, writeFileSync, cpSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [, , countArg, daysArg, dirArg] = process.argv;
const count = Number(countArg || 40);
const days = Number(daysArg || 1);
const dir = dirArg || `/tmp/j${count}d${days}`;
const REPO = '/home/user/leaderm26';

rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
execSync(`git -C ${REPO} archive HEAD | tar -x -C ${dir}`);
cpSync(`${REPO}/node_modules`, `${dir}/node_modules`, { recursive: true, verbatimSymlinks: true });

const sources = readdirSync(`${REPO}/photos`).filter((f) => f.endsWith('.webp'));
rmSync(`${dir}/photos`, { recursive: true, force: true });
mkdirSync(`${dir}/photos`);

/**
 * Nobody photographs a conference at a metronome. Frames come in bursts around
 * the things that happen — arrival, breakfast, the opening, a break, dinner —
 * and thin out to almost nothing while somebody is talking. These anchors are
 * the shape of a real meeting day; the layout is meant to read it.
 */
const SATURDAY = [
  [455, 4], [470, 3], [500, 6], [530, 2], [545, 5], [575, 3], [600, 4],
  [640, 2], [665, 6], [700, 3], [740, 5], [780, 2], [810, 4], [845, 3],
  [880, 6], [920, 2], [960, 4], [1010, 5], [1060, 3], [1110, 6], [1180, 4],
];
const SUNDAY = [
  [460, 3], [485, 5], [515, 2], [545, 4], [580, 6], [620, 3], [660, 5],
  [700, 2], [745, 4], [800, 6], [845, 3],
];
const windows = days > 1 ? [[29, SATURDAY], [30, SUNDAY]] : [[29, SATURDAY]];
const per = Math.ceil(count / windows.length);

// Walk the anchors, spending each burst before moving to the next.
const stamps = [];
for (const [day, anchors] of windows) {
  let placed = 0;
  const scale = per / anchors.reduce((sum, [, n]) => sum + n, 0);
  for (const [start, burst] of anchors) {
    const take = Math.max(1, Math.round(burst * scale));
    for (let k = 0; k < take && placed < per; k += 1, placed += 1) {
      // Inside a burst the shutter goes every 20-70 seconds.
      stamps.push([day, start * 60 + k * (20 + ((k * 17) % 50))]);
    }
  }
}

let made = 0;
{
  for (const [day, seconds] of stamps) {
    if (made >= count) break;
    const mins = Math.floor(seconds / 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    const src = `${REPO}/photos/${sources[made % sources.length]}`;
    const meta = await sharp(src).metadata();
    // Keep the real aspect ratio, scaled up to a camera original.
    const long = 5472;
    const w = meta.width >= meta.height ? long : Math.round((long * meta.width) / meta.height);
    const h = meta.width >= meta.height ? Math.round((long * meta.height) / meta.width) : long;
    await sharp(src)
      .resize(w, h, { fit: 'fill' })
      .modulate({ hue: (made * 47) % 360, brightness: 0.9 + (made % 4) * 0.05 })
      .withExif({
        IFD0: {
          Make: 'SONY',
          Model: 'ZV-1M2',
          DateTime: `2026:08:${day} ${hh}:${mm}:${String(seconds % 60).padStart(2, '0')}`,
        },
      })
      .jpeg({ quality: 88 })
      .toFile(path.join(dir, 'photos', `DSC0${2000 + made}.JPG`));
    made += 1;
  }
}
writeFileSync(`${dir}/photos/captions.json`, JSON.stringify({ photos: {} }, null, 2));
console.log(`${dir}: ${made} frames over ${days} day(s)`);
