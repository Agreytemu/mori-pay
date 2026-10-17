import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const FALLBACK_SITE_URL = 'https://merchant.example.com';

type SiteMetaOptions = {
  siteUrl: string;
  allowIndexing: boolean;
  googleVerification: string;
};

function siteMeta({ siteUrl, allowIndexing, googleVerification }: SiteMetaOptions): Plugin {
  const robots = allowIndexing
    ? ['User-agent: *', 'Allow: /', '', `Sitemap: ${siteUrl}/sitemap.xml`, ''].join('\n')
    : ['# Mori Pay Merchant is a private business application.', 'User-agent: *', 'Disallow: /', ''].join('\n');

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${siteUrl}/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>`,
    '</urlset>',
    '',
  ].join('\n');

  const verificationTag = googleVerification
    ? `<meta name="google-site-verification" content="${googleVerification}" />`
    : '<!-- Add VITE_GOOGLE_SITE_VERIFICATION to enable Google Search Console verification. -->';

  const files: Record<string, { body: string; type: string }> = {
    '/robots.txt': { body: robots, type: 'text/plain; charset=utf-8' },
    '/sitemap.xml': { body: sitemap, type: 'application/xml; charset=utf-8' },
  };

  return {
    name: 'mori-site-meta',
    transformIndexHtml(html) {
      return html
        .replaceAll('%SITE_URL%', siteUrl)
        .replaceAll('%ROBOTS%', allowIndexing ? 'index, follow' : 'noindex, nofollow')
        .replaceAll('%GOOGLE_VERIFICATION%', verificationTag);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        const file = files[path];
        if (!file) {
          next();
          return;
        }
        res.setHeader('Content-Type', file.type);
        res.end(file.body);
      });
    },
    generateBundle() {
      for (const [fileName, file] of Object.entries(files)) {
        this.emitFile({ type: 'asset', fileName: fileName.replace(/^\//, ''), source: file.body });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = (env.VITE_SITE_URL || FALLBACK_SITE_URL).replace(/\/+$/, '');
  const allowIndexing = env.VITE_ALLOW_INDEXING === 'true';
  const googleVerification = env.VITE_GOOGLE_SITE_VERIFICATION ?? '';

  return {
    plugins: [react(), siteMeta({ siteUrl, allowIndexing, googleVerification })],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
