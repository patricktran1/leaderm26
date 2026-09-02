/**
 * The only script a concept ships. Three small jobs, no framework, and
 * everything it enhances already works with JavaScript switched off:
 * the service list renders in full, the menu links are ordinary anchors.
 */

const reduced = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------- entrances */
function initRise(): void {
  const items = Array.from(document.querySelectorAll<HTMLElement>('.rise'));
  if (items.length === 0) return;
  if (reduced() || !('IntersectionObserver' in window)) {
    for (const el of items) el.classList.add('is-in');
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  for (const el of items) io.observe(el);
}

/* -------------------------------------------------------- service finder */
/**
 * CLINIC's list is long enough that scanning stops working. Filtering happens
 * over what is already in the DOM, so the page is complete without this and
 * a crawler or a reader-mode still sees every service.
 */
function initFinder(): void {
  const root = document.querySelector<HTMLElement>('[data-finder]');
  if (!root) return;
  const field = root.querySelector<HTMLInputElement>('[data-finder-input]');
  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-finder-cat]'));
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-service]'));
  const count = root.querySelector<HTMLElement>('[data-finder-count]');
  const empty = root.querySelector<HTMLElement>('[data-finder-empty]');
  let category = '';

  const apply = (): void => {
    const term = (field?.value ?? '').trim().toLowerCase();
    let shown = 0;
    for (const card of cards) {
      const haystack = (card.dataset.service ?? '').toLowerCase();
      const inCategory = !category || card.dataset.category === category;
      const matches = !term || haystack.includes(term);
      const show = inCategory && matches;
      card.hidden = !show;
      if (show) shown += 1;
    }
    if (count) count.textContent = `${shown} of ${cards.length}`;
    if (empty) empty.hidden = shown > 0;
  };

  field?.addEventListener('input', apply);
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const value = chip.dataset.finderCat ?? '';
      category = category === value ? '' : value;
      for (const other of chips) {
        other.setAttribute('aria-pressed', String(other.dataset.finderCat === category));
      }
      apply();
    });
  }
  apply();
}

/* ------------------------------------------------------------ full menu */
/** ATELIER hides navigation behind one word; that word has to behave. */
function initPanel(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-panel-open]');
  const panel = document.querySelector<HTMLElement>('#at-panel');
  if (!button || !panel) return;
  const close = panel.querySelector<HTMLButtonElement>('[data-panel-close]');
  const main = document.querySelector('main');

  const setOpen = (open: boolean): void => {
    button.setAttribute('aria-expanded', String(open));
    if (open) {
      panel.removeAttribute('hidden');
      requestAnimationFrame(() => panel.setAttribute('data-open', ''));
      main?.setAttribute('inert', '');
      document.documentElement.style.overflow = 'hidden';
      (close ?? panel.querySelector('a'))?.focus();
    } else {
      panel.removeAttribute('data-open');
      panel.setAttribute('hidden', '');
      main?.removeAttribute('inert');
      document.documentElement.style.overflow = '';
      button.focus();
    }
  };

  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  close?.addEventListener('click', () => setOpen(false));
  panel.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || panel.hasAttribute('hidden')) return;
    setOpen(false);
  });
  // Tab must not walk out of an overlay that covers the page.
  panel.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const stops = Array.from(
      panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ).filter((el) => el.offsetParent !== null);
    if (stops.length === 0) return;
    const first = stops[0]!;
    const last = stops[stops.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

const start = (): void => {
  initRise();
  initFinder();
  initPanel();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
