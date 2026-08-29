/* Field Notes — the only client-side JavaScript on the page.
   Reveal-on-scroll, the mobile index panel, and the photograph viewer. */

interface Slide {
  src: string;
  w: number;
  h: number;
  alt: string;
  caption: string;
  note: string;
  category: string;
}

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Focusable controls that are actually rendered — media queries hide some. */
const visibleControls = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')).filter(
    (el) => el.getClientRects().length > 0,
  );

/** Take the rest of the page out of the tab order and the accessibility tree. */
const setPageInert = (inert: boolean): void => {
  for (const selector of ['header', 'main', 'footer']) {
    const el = document.querySelector(selector);
    if (el) el.toggleAttribute('inert', inert);
  }
};

/** Cycle Tab inside a dialog. Returns true when the event was handled. */
function trapTab(event: KeyboardEvent, panel: HTMLElement): void {
  if (event.key !== 'Tab') return;
  const controls = visibleControls(panel);
  if (controls.length === 0) {
    event.preventDefault();
    panel.focus();
    return;
  }
  const first = controls[0]!;
  const last = controls[controls.length - 1]!;
  const active = document.activeElement;
  if (controls.length === 1) {
    event.preventDefault();
    first.focus();
    return;
  }
  if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/* ----------------------------------------------------------- reveal ---- */
function initReveal(): void {
  const targets = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
  if (targets.length === 0) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );

  targets.forEach((el) => observer.observe(el));
}

/* --------------------------------------------------------- masthead ---- */
function initMasthead(): void {
  const bar = document.getElementById('masthead');
  if (!bar) return;
  const sync = (): void => {
    bar.toggleAttribute('data-scrolled', window.scrollY > 8);
  };
  sync();
  window.addEventListener('scroll', sync, { passive: true });
}

/* ------------------------------------------------------ index panel ---- */
function initIndexPanel(): void {
  const panel = document.getElementById('index-panel');
  const openBtn = document.querySelector<HTMLButtonElement>('[data-menu-open]');
  if (!panel || !openBtn) return;

  const close = (): void => {
    panel.removeAttribute('data-open');
    window.setTimeout(() => panel.setAttribute('hidden', ''), prefersReducedMotion() ? 0 : 260);
    openBtn.setAttribute('aria-expanded', 'false');
    document.documentElement.style.removeProperty('overflow');
    setPageInert(false);
    openBtn.focus();
  };

  const open = (): void => {
    panel.removeAttribute('hidden');
    requestAnimationFrame(() => panel.setAttribute('data-open', ''));
    openBtn.setAttribute('aria-expanded', 'true');
    document.documentElement.style.overflow = 'hidden';
    setPageInert(true);
    panel.querySelector<HTMLAnchorElement>('a')?.focus();
  };

  openBtn.addEventListener('click', open);
  panel.querySelector('[data-menu-close]')?.addEventListener('click', close);
  panel.querySelectorAll('[data-menu-link]').forEach((link) => link.addEventListener('click', close));
  document.addEventListener('keydown', (event) => {
    if (!panel.hasAttribute('data-open')) return;
    if (event.key === 'Escape') close();
    else trapTab(event, panel);
  });
}

/* --------------------------------------------------------- lightbox ---- */
function initLightbox(): void {
  const root = document.getElementById('lightbox');
  const dataEl = document.getElementById('lightbox-data');
  if (!root || !dataEl?.textContent) return;

  const slides = JSON.parse(dataEl.textContent) as Slide[];
  if (slides.length === 0) return;

  const panel = root.querySelector<HTMLElement>('.lb__panel');
  const image = root.querySelector<HTMLImageElement>('[data-lb-image]');
  const caption = root.querySelector<HTMLElement>('[data-lb-caption]');
  const note = root.querySelector<HTMLElement>('[data-lb-note]');
  const counter = root.querySelector<HTMLElement>('[data-lb-count]');
  if (!panel || !image || !caption || !note || !counter) return;

  let current = 0;
  let opener: HTMLElement | null = null;

  const pad = (n: number): string => String(n).padStart(2, '0');

  const show = (index: number): void => {
    current = (index + slides.length) % slides.length;
    const slide = slides[current]!;
    image.removeAttribute('data-ready');
    image.src = slide.src;
    image.width = slide.w;
    image.height = slide.h;
    image.style.setProperty('--natural-w', `${slide.w}px`);
    image.alt = slide.alt;
    caption.textContent = slide.caption;
    note.textContent = slide.note;
    counter.textContent = `${pad(current + 1)} / ${pad(slides.length)}`;
    if (image.complete) image.setAttribute('data-ready', '');
    // Warm the neighbours so arrowing through feels instant.
    for (const step of [1, -1]) {
      const next = slides[(current + step + slides.length) % slides.length];
      if (next) new Image().src = next.src;
    }
  };

  image.addEventListener('load', () => image.setAttribute('data-ready', ''));

  const close = (): void => {
    root.removeAttribute('data-open');
    window.setTimeout(() => root.setAttribute('hidden', ''), prefersReducedMotion() ? 0 : 260);
    document.documentElement.style.removeProperty('overflow');
    setPageInert(false);
    opener?.focus();
    opener = null;
  };

  const open = (index: number, trigger: HTMLElement): void => {
    opener = trigger;
    show(index);
    root.removeAttribute('hidden');
    requestAnimationFrame(() => root.setAttribute('data-open', ''));
    document.documentElement.style.overflow = 'hidden';
    setPageInert(true);
    panel.focus();
  };

  document.querySelectorAll<HTMLElement>('[data-lightbox]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      open(Number(trigger.dataset.lightbox), trigger);
    });
  });

  root.querySelector('[data-lb-close]')?.addEventListener('click', close);
  // Clicking anywhere that is not the photograph or a control dismisses.
  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-lb-dismiss]') && !target.closest('button, img')) close();
  });
  root.querySelector('[data-lb-prev]')?.addEventListener('click', () => show(current - 1));
  root.querySelector('[data-lb-next]')?.addEventListener('click', () => show(current + 1));

  document.addEventListener('keydown', (event) => {
    if (!root.hasAttribute('data-open')) return;
    if (event.key === 'Escape') close();
    else if (event.key === 'ArrowLeft') show(current - 1);
    else if (event.key === 'ArrowRight') show(current + 1);
    else trapTab(event, panel);
  });

  // Horizontal swipe on touch devices.
  let startX = 0;
  let startY = 0;
  const stage = root.querySelector<HTMLElement>('[data-lb-stage]');
  stage?.addEventListener(
    'touchstart',
    (event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
    },
    { passive: true },
  );
  stage?.addEventListener(
    'touchend',
    (event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) show(current + (dx < 0 ? 1 : -1));
    },
    { passive: true },
  );
}

/* -------------------------------------------------------- scroll spy ---- */
function initScrollSpy(): void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-spy]'));
  if (links.length === 0 || !('IntersectionObserver' in window)) return;

  const sections = links
    .map((link) => document.getElementById(link.dataset.spy ?? ''))
    .filter((el): el is HTMLElement => el !== null);

  const visible = new Set<string>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      const current = sections.find((section) => visible.has(section.id))?.id;
      for (const link of links) {
        link.toggleAttribute('data-current', link.dataset.spy === current);
      }
    },
    { rootMargin: '-20% 0px -60% 0px' },
  );

  sections.forEach((section) => observer.observe(section));
}

initReveal();
initScrollSpy();
initMasthead();
initIndexPanel();
initLightbox();
