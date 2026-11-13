// No live accounts, payments, browsers, or external API requests.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { build } from 'esbuild';
import { renderToStaticMarkup, renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import { createElement } from 'react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root, envDir: false, server: { middlewareMode: true }, appType: 'custom' });
try {
  const { getInfoPage, footerLinks } = await server.ssrLoadModule('/lib/infoPages.ts');
  const { InfoPage } = await server.ssrLoadModule('/components/InfoPage.tsx');
  const { TERMS_VERSION, PRIVACY_VERSION } = await server.ssrLoadModule('/lib/policies.ts');
  for (const { href } of footerLinks) {
    const page = getInfoPage(href);
    assert.ok(page, `Document exists: ${href}`);
    assert.equal(getInfoPage(`${href}/`), page, 'Trailing slash resolves');
    const html = renderToStaticMarkup(createElement(InfoPage, { page }));
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, 'One document heading');
    assert.ok(html.includes(page.title), 'Title renders');
    assert.ok(html.includes('Skip to document'), 'Skip link renders');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, 'No duplicate element IDs');
    for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) {
      assert.ok(ids.includes(target), `Contents link resolves: ${target}`);
    }
    for (const section of page.sections) {
      for (const link of section.links ?? []) {
        if (!link.href.startsWith('/')) continue;
        const [pathname, fragment] = link.href.split('#');
        const destination = getInfoPage(pathname);
        assert.ok(destination, `Related document exists: ${link.href}`);
        if (fragment) assert.ok(destination.sections.some((item) => item.id === fragment), `Cross-document fragment exists: ${link.href}`);
      }
    }
    console.log(`PASS document rendering, contents, and links: ${href} (${page.sections.length} sections)`);
  }
  assert.equal(getInfoPage('/toString'), undefined, 'Prototype keys are not routes');
  assert.equal(getInfoPage('/unknown'), undefined, 'Unknown pages retain app handling');
  const privacy = JSON.stringify(getInfoPage('/privacy-policy'));
  for (const disclosure of ['public storage URLs', 'not end-to-end encrypted', 'removes payment rows', 'Selected Ritual fields']) assert.ok(privacy.includes(disclosure), disclosure);

  // The public route must render before session/backend readiness, including
  // when a restored member would otherwise be sent to the gallery.
  const { default: App } = await server.ssrLoadModule('/App.tsx');
  const { useSanctuaryStore } = await server.ssrLoadModule('/store.ts');
  const initialState = useSanctuaryStore.getInitialState;
  const renderApp = () => new Promise((resolve, reject) => {
    const output = new PassThrough();
    let html = '';
    output.on('data', (chunk) => { html += chunk.toString(); });
    output.on('end', () => resolve(html));
    output.on('error', reject);
    const rendered = renderToPipeableStream(createElement(App), {
      onAllReady() { rendered.pipe(output); }, onError: reject,
    });
  });
  try {
    for (const state of ['uninitialised', 'restored-member']) {
      useSanctuaryStore.getInitialState = () => ({ ...initialState(),
        ...(state === 'restored-member' ? { sessionReady: true, view: 'gallery', currentProfile: { id: 'mock-member', profileReady: true } } : {}),
      });
      for (const route of ['/privacy-policy', '/terms-of-service', '/refund-policy']) {
        globalThis.window = { location: new URL(`https://niwangu.test${route}`) };
        const html = await renderApp();
        assert.ok(html.includes(getInfoPage(route).title), 'Requested document rendered');
        assert.ok(!html.includes('Connecting...'), 'Session boot does not block document');
        assert.ok(!html.includes('Set VITE_SUPABASE_URL'), 'Backend configuration does not block document');
      }
      console.log(`PASS public route rendering without backend credentials: ${state}`);
    }
  } finally {
    useSanctuaryStore.getInitialState = initialState;
    delete globalThis.window;
  }

  // Bundle the real signup function, replacing only its Supabase transport.
  const bundled = await build({
    entryPoints: [path.join(root, 'lib/api.ts')], bundle: true, write: false,
    format: 'esm', platform: 'node', plugins: [{
      name: 'mock-supabase-transport', setup(builder) {
        builder.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'mock', namespace: 'policy-test' }));
        builder.onLoad({ filter: /.*/, namespace: 'policy-test' }, () => ({ contents: 'export const getSupabase = () => globalThis.__policyTestTransport;', loader: 'js' }));
      },
    }],
  });
  const { signUpWithEmail } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
  let submitted;
  globalThis.__policyTestTransport = { auth: { signUp: async (payload) => { submitted = payload; return { data: { session: null }, error: null }; } } };
  const input = { fullName: 'Policy Test', age: 28, gender: 'female', location: 'Nairobi', email: 'policy-test@example.test', password: 'test-only-password' };
  await assert.rejects(() => signUpWithEmail({ ...input, acceptedTerms: false }), /Accept the Terms/);
  assert.equal(submitted, undefined, 'No request without acceptance');
  const result = await signUpWithEmail({ ...input, acceptedTerms: true });
  assert.equal(result.needsEmailConfirmation, true, 'Confirmation flow preserved');
  assert.equal(submitted.email, input.email);
  assert.equal(submitted.options.data.terms_version, TERMS_VERSION);
  assert.equal(submitted.options.data.privacy_notice_version, PRIVACY_VERSION);
  assert.ok(Number.isFinite(Date.parse(submitted.options.data.terms_accepted_at)), 'Valid acknowledgement timestamp');
  assert.equal(submitted.options.data.location, input.location, 'Profile payload preserved');
  console.log('PASS signup acceptance guard and versioned acknowledgement payload (mocked transport)');
  delete globalThis.__policyTestTransport;
} finally {
  await server.close();
}
