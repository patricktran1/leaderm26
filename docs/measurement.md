# Measuring the practice page

There is no analytics on this site, and nothing was added for `/for-practices`.
That is a decision, not an oversight.

## Why nothing is installed

The page collects nothing and calls nothing. The only conversion is a `mailto:`
that opens the visitor's own mail client with four lines prefilled — no form
handler, no database, no third party holding a dermatologist's contact details
so that a page can claim to have captured a lead. Adding a tracker to measure
that would mean loading a third-party script and putting every visitor into
someone else's dataset in order to learn a number that arrives by email anyway,
one reply at a time.

At this volume the honest metric is: how many people wrote.

## What is already in place

Every step of the funnel carries a `data-goal` attribute, so instrumentation is
a matter of listening for clicks, not of re-editing the page:

| `data-goal`            | Where                                       | What it means            |
| ---------------------- | ------------------------------------------- | ------------------------ |
| `practice-page`        | The journal's Practice section              | The bridge was taken     |
| `practice-start`       | `/for-practices`, first screen              | Primary action, top      |
| `practice-start-foot`  | `/for-practices`, closing section           | Primary action, bottom   |
| `email`                | `/for-practices`, closing section           | Plain address clicked    |
| `instagram`            | `/for-practices`, closing section           | Instagram clicked        |

`tools/practice.mjs` asserts that all five are present, so they cannot be lost
in a later edit.

## What to add, when there is enough traffic to justify it

In rough order of preference:

1. **Vercel Web Analytics** (`@vercel/analytics`). Already the host; no cookies,
   no cross-site identifiers, one script, and a custom event per `data-goal`
   above. This is the obvious first choice if anything is added at all.
2. **Plausible or Fathom**, self-hosted or paid. Same properties, independent of
   the host, at a small monthly cost.
3. **Server logs only.** Page views come free from the platform; the click
   events do not. Enough to answer "is anyone reading this?".

Google Analytics is not on the list. A page aimed at physicians should not ship
an advertising identifier to a third party, and the consent banner it would
require costs more attention than the data is worth here.

## If a form ever replaces the email

Keep it on this origin, keep the fields to the four already in the mailto, and
do not accept anything a patient could mistake for a place to describe a
symptom. The moment a page like this can receive health information it acquires
a compliance surface, and this one is deliberately built not to have one.
