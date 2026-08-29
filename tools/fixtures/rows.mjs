/* Prints the journal's row structure straight out of the built HTML. */
import { readFileSync } from 'node:fs';
const html = readFileSync(process.argv[2] || 'dist/index.html', 'utf8');
const journal = html.slice(html.indexOf('journal__body'), html.indexOf('id="tables"'));
const rows = journal.split(/<div class="jrow jrow--/).slice(1);
rows.forEach((row, i) => {
  const kind = row.slice(0, 4).replace(/[^a-z]/g, '');
  const caps = [...row.matchAll(/class="shot__cap balance"[^>]*>([^<]*)/g)].map((m) => m[1].trim());
  const bucket = /jrow__bucket label" id="[^"]*">([^<]*)/.exec(row)?.[1] ?? '';
  console.log(String(i).padStart(2), kind.padEnd(4), String(caps.length), bucket.padEnd(20), caps.join(' · '));
});
