import { useEffect } from 'react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { footerLinks, type InfoPageDefinition } from '../lib/infoPages';

const sectionId = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const linkStyle = 'underline decoration-sage/60 underline-offset-4 hover:text-sageDeep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sageDeep';

export const InfoPage = ({ page }: { page: InfoPageDefinition }) => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${page.title} | Niwangu`;
    // Lazy loading means the native initial fragment scroll can precede the text.
    try {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (hash) document.getElementById(hash)?.scrollIntoView();
    } catch {
      // A malformed incoming fragment must not prevent reading the document.
    }
    return () => { document.title = previousTitle; };
  }, [page]);

  return (
    <div className="min-h-dvh bg-sandstone text-midnight">
      <a href="#document" className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-4 focus:z-50 focus:bg-white focus:p-3">Skip to document</a>
      <header className="border-b border-midnight/10 bg-white/60 px-6 py-5 sm:px-10 lg:px-14">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5">
          <a href="/" className="flex items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sageDeep" aria-label="Niwangu homepage">
            <img src="/niwangu-logo.png" alt="" width="48" height="48" className="h-12 w-12 rounded-full object-contain" />
            <span className="font-serif text-xl">Niwangu<span className="mt-0.5 block font-sans text-[10px] uppercase tracking-[0.2em] text-midnight/70">Trust & care</span></span>
          </a>
          <a href="/" className="inline-flex min-h-11 items-center gap-2 text-sm hover:text-sageDeep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sageDeep"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Niwangu</a>
        </div>
      </header>
      <main id="document" className="mx-auto max-w-6xl px-6 pb-16 pt-12 sm:px-10 sm:pt-16 lg:px-0 lg:pt-20" tabIndex={-1}>
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sageDeep">{page.eyebrow}</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-6xl">{page.title}</h1>
          <p className="mt-6 max-w-[60ch] text-lg leading-8 text-midnight/85">{page.intro}</p>
          {page.updated && <p className="mt-5 text-xs leading-6 text-midnight/70">Last updated <time dateTime={page.version}>{page.updated}</time><span className="mx-3" aria-hidden="true">/</span>Version {page.version}</p>}
        </div>
        {page.summary && <aside aria-label="At a glance" className="mt-9 max-w-3xl border-l-2 border-sageDeep bg-white/60 px-5 py-5 sm:px-7"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-sageDeep">At a glance</p><p className="mt-2 text-sm leading-7">{page.summary}</p><p className="mt-2 text-xs leading-6 text-midnight/70">A reading guide. The full sections below explain the details.</p></aside>}
        <div className="mt-12 grid items-start gap-12 border-t border-midnight/15 pt-8 lg:mt-16 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
          <nav aria-label={`${page.title} contents`} className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:pr-3">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-midnight/70">On this page</p>
            <ol className="grid gap-x-5 sm:grid-cols-2 lg:grid-cols-1">
              {page.sections.map((section, index) => <li key={section.id ?? section.title}><a href={`#${section.id ?? sectionId(section.title)}`} className="group flex min-h-11 gap-3 rounded-sm py-2 text-sm leading-6 hover:text-sageDeep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sageDeep"><span className="w-5 shrink-0 text-xs tabular-nums text-sageDeep">{String(index + 1).padStart(2, '0')}</span><span>{section.title}</span></a></li>)}
            </ol>
          </nav>
          <div className="min-w-0 space-y-10 sm:space-y-12">
            {page.sections.map((section, index) => <section id={section.id ?? sectionId(section.title)} key={section.id ?? section.title} className="scroll-mt-8 border-b border-midnight/10 pb-10 last:border-b-0 last:pb-0" aria-labelledby={`heading-${section.id ?? sectionId(section.title)}`}>
              <p className="mb-2 text-xs font-medium tabular-nums text-sageDeep" aria-hidden="true">{String(index + 1).padStart(2, '0')}</p>
              <h2 id={`heading-${section.id ?? sectionId(section.title)}`} className="font-serif text-2xl leading-snug sm:text-3xl">{section.title}</h2>
              <div className="mt-4 max-w-[68ch] space-y-4 break-words text-base leading-8 text-midnight/90">
                {section.body && <p>{section.body}</p>}
                {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && <ul className="list-disc space-y-3 pl-5 marker:text-sageDeep">{section.bullets.map((bullet) => <li key={bullet} className="pl-1">{bullet}</li>)}</ul>}
                {section.links && <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-1 text-sm">{section.links.map((link) => <li key={link.href}><a className={`inline-flex min-h-11 items-center gap-1.5 ${linkStyle}`} href={link.href}>{link.label}<ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /></a></li>)}</ul>}
              </div>
            </section>)}
            <a href="#document" className={`inline-flex min-h-11 items-center text-sm ${linkStyle}`}>Back to top</a>
          </div>
        </div>
      </main>
      <footer className="border-t border-midnight/15 bg-white/50 px-6 py-8 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <nav aria-label="Help and policies" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">{footerLinks.map((link) => <a key={link.href} href={link.href} aria-current={link.label === page.title ? 'page' : undefined} className={`inline-flex min-h-11 items-center ${linkStyle}`}>{link.label}</a>)}</nav>
          <p className="mt-5 text-xs leading-6 text-midnight/70">&copy; {new Date().getFullYear()} Niwangu · Kenya. Privacy requests: <a className={linkStyle} href="mailto:privacy@niwangu.com">privacy@niwangu.com</a></p>
        </div>
      </footer>
    </div>
  );
};
