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
  integrations: [sitemap({ filter: (page) => !/\/(404|admin)/.test(page) })],
  devToolbar: { enabled: false },
});
