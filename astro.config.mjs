// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://leaderm26.vercel.app',
  build: { inlineStylesheets: 'always' },
  image: {
    // Photographs are already delivered as compressed WebP masters; keep the
    // encoder honest so faces and slide text do not smear.
    service: { entrypoint: 'astro/assets/services/sharp', config: { limitInputPixels: false } },
  },
  integrations: [
    sitemap({
      filter: (page) => !/\/(404|admin|demo)/.test(page),
      // Vercel serves these paths without a trailing slash and the canonical
      // tags say so; a sitemap that disagrees just lists a redirect.
      serialize: (item) => ({ ...item, url: item.url.replace(/(.+)\/$/, '$1') }),
    }),
  ],
  devToolbar: { enabled: false },
});
