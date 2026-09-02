# Practice concepts

One folder per prospect. Everything here is read by `src/demo/registry.ts` and
rendered under `/demo/<slug>` — noindex, never linked from the public site.

`npm run demo:new` creates a folder. `docs/practice-demo-factory.md` is the
operator guide, including the list to check before a concept is sent.

## The three practices currently here are inventions

`northlight-dermatology`, `crosstown-skin-health` and `verre-aesthetics` are
**synthetic fixtures**. They exist to prove the three compositions hold up under
different amounts of content: eleven services against nineteen, one physician
against four, one deliberately sparse concept with no address, no hours and no
proof at all.

None of them is a real business. The names, physicians, services and notes were
made up for this purpose; every telephone number is in the reserved 555-01xx
range and every URL points at `example.com`. Each carries `"status":
"synthetic"`, which puts a banner on every page saying so, and the test suite
fails if any of that stops being true.

Any resemblance to a real practice is unintended. If one of these names turns
out to belong to somebody, rename the folder and the slug.
