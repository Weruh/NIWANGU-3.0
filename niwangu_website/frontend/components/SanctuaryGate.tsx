import { useRef, type FC } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Heart,
  LockKeyhole,
  MessageCircleHeart,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Star,
  UserRoundCheck,
} from 'lucide-react';
import { useSanctuaryStore } from '../store';
import { Button } from './Button';
import { OptimizedImage } from './OptimizedImage';
import { footerLinks } from '../lib/infoPages';

const galleryImages = [
  {
    src: 'https://images.unsplash.com/photo-1621829845053-c8114fc01eb3',
    alt: 'Black couple standing together in formalwear on a mountain overlook',
  },
  {
    src: 'https://images.unsplash.com/photo-1592599457454-e6ace3370314',
    alt: 'Black couple sharing a kiss outdoors',
  },
  {
    src: 'https://images.unsplash.com/photo-1653242832879-d730d48617f9',
    alt: 'Black couple smiling together in coordinated attire',
  },
  {
    src: 'https://images.unsplash.com/photo-1515531980326-6244280b99c8',
    alt: 'Black couple sharing a playful date moment',
  },
  {
    src: 'https://images.unsplash.com/photo-1515015520803-1a2e0aadb290',
    alt: 'Black couple posing closely against a brick wall',
  },
  {
    src: 'https://images.unsplash.com/photo-1745231991466-19d41014cc66',
    alt: 'Black couple embracing with affection',
  },
  {
    src: 'https://images.unsplash.com/photo-1631217875019-8cb2649c3478',
    alt: 'Black couple dressed for a meaningful occasion',
  },
  {
    src: 'https://images.unsplash.com/photo-1730342754572-1d1f426e40e2',
    alt: 'Black couple holding hands in a quiet moment',
  },
  {
    src: 'https://images.unsplash.com/photo-1522941471521-6ee21ec5cc26',
    alt: 'Black couple posing together in black and white',
  },
  {
    src: 'https://images.unsplash.com/photo-1570694660599-9dcdbfff8f55',
    alt: 'Black couple enjoying a beach moment together',
  },
  {
    src: 'https://images.unsplash.com/photo-1664646449779-ee70428b3936',
    alt: 'Black couple sharing a kiss',
  },
  {
    src: 'https://images.unsplash.com/photo-1544293180-6749b85ce918',
    alt: 'Black couple hugging each other',
  },
  {
    src: 'https://images.unsplash.com/photo-1515531980326-6244280b99c8',
    alt: 'Black couple standing closely during a date',
  },
  {
    src: 'https://images.unsplash.com/photo-1592599457454-e6ace3370314',
    alt: 'Black couple embracing outdoors',
  },
  {
    src: 'https://images.unsplash.com/photo-1515015520803-1a2e0aadb290',
    alt: 'Black couple sharing an intimate portrait',
  },
  {
    src: 'https://images.unsplash.com/photo-1621829845053-c8114fc01eb3',
    alt: 'Black couple standing together in soft natural light',
  },
  {
    src: 'https://images.unsplash.com/photo-1730342754572-1d1f426e40e2',
    alt: 'Black couple holding hands with intention',
  },
  {
    src: 'https://images.unsplash.com/photo-1570694660599-9dcdbfff8f55',
    alt: 'Black couple connecting by the ocean',
  },
];

const steps = [
  {
    icon: UserRoundCheck,
    title: 'Share Your Intention',
    description: 'Create a profile around values, pace, and the kind of connection you are ready to build.',
  },
  {
    icon: SearchCheck,
    title: 'Discover Compatible Souls',
    description: 'Meet people through thoughtful prompts and signals that go deeper than a quick swipe.',
  },
  {
    icon: MessageCircleHeart,
    title: 'Begin With Meaning',
    description: 'Start conversations with context, care, and enough room for honest curiosity.',
  },
  {
    icon: ShieldCheck,
    title: 'Move At Your Pace',
    description: 'Use clear boundaries and a calm experience designed for intentional dating.',
  },
];

const testimonials = [
 {image:'https://images.unsplash.com/photo-1524504388940-b1c1722653e1',quote:'What does building a life partnership look like for you?',name:'Conversation starter · Intentions'},
 {image:'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',quote:'We both value integrity. How does that show up in your everyday life?',name:'Conversation starter · Values'},
 {image:'https://images.unsplash.com/photo-1544005313-94ddf0286df2',quote:'What helps you feel comfortable when getting to know someone?',name:'Conversation starter · Boundaries'},
];


const NiwanguLogo = ({ className = 'h-16 w-16' }: { className?: string }) => (
  <img src="/niwangu-logo.png" alt="Niwangu" className={`${className} object-contain rounded-full`} />
);

const galleryPanels = [
  galleryImages.slice(0, 9),
  galleryImages.slice(5, 14),
  [...galleryImages.slice(11), ...galleryImages.slice(0, 4)],
];

const HeroGallery = () => (
  <div className="hero-gallery-viewport" aria-hidden="true">
    {galleryPanels.map((panel, panelIndex) => (
      <div
        // Keyed by position: the same photo appears more than once in a panel,
        // so a src-based key was not unique and React warned about it.
        key={panelIndex}
        className="hero-gallery-panel"
        style={{ animationDelay: `${panelIndex * 3 - 0.7}s` }}
      >
        {panel.map((image, imageIndex) => (
          <div key={`${panelIndex}-${imageIndex}`} className={`hero-gallery-card hero-gallery-card-${imageIndex + 1}`}>
            <OptimizedImage
              src={image.src}
              alt={image.alt}
              loading={panelIndex === 0 ? 'eager' : 'lazy'}
              fetchPriority={panelIndex === 0 && imageIndex < 3 ? 'high' : 'auto'}
              srcWidth={620}
              srcSetWidths={[320, 520, 760]}
              sizes="(min-width: 1024px) 14vw, 34vw"
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    ))}
  </div>
);

export const SanctuaryGate: FC = () => {
  const setView = useSanctuaryStore((state) => state.setView);
  const currentYear = new Date().getFullYear();
  const testimonialTrackRef = useRef<HTMLDivElement>(null);

  // One card plus the flex gap, so the arrows land on a card edge rather than
  // drifting out of alignment after a few presses.
  const TESTIMONIAL_STEP = 410 + 24;

  const scrollTestimonials = (direction: 'left' | 'right') => {
    testimonialTrackRef.current?.scrollBy({
      left: direction === 'left' ? -TESTIMONIAL_STEP : TESTIMONIAL_STEP,
      behavior: 'smooth',
    });
  };


  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-dvh overflow-hidden bg-sandstone text-midnight"
    >
      <section className="relative grid min-h-dvh grid-cols-1 lg:grid-cols-2">
        <div className="relative min-h-[46vh] overflow-hidden bg-[#f8d5dd] lg:min-h-dvh">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.75),transparent_32%),linear-gradient(135deg,rgba(240,98,146,0.2),rgba(74,59,66,0.18))]" />
          <HeroGallery />
        </div>

        <div className="relative flex items-center bg-sandstone px-6 py-12 sm:px-10 lg:px-16">
          <div className="mx-auto w-full max-w-[560px]">
            <div className="mb-10 flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-sageDeep shadow-lg shadow-sage/15 ring-1 ring-sage/10">
                <NiwanguLogo className="h-14 w-14" />
              </div>
              <div>

                <p className="mt-1.5 text-xl font-medium leading-none tracking-tight text-midnight sm:text-2xl">
                  Love, with Intention.
                </p>
              </div>
            </div>

            <h1 className="max-w-[520px] text-5xl font-semibold leading-[1.05] tracking-tight text-midnight sm:text-6xl xl:text-7xl">
              Find your intentional love story.
            </h1>
            <p className="mt-6 max-w-[480px] text-lg leading-8 text-midnight/80">
              Meet people who value depth, emotional clarity, and a gentler path toward real connection.
            </p>

            {/* Two equal columns with both buttons full width, so the pair reads
                as one control rather than a wide primary and a small secondary. */}
            <div className="mt-8 grid max-w-[480px] gap-3 sm:grid-cols-2">
              <Button
                variant="primary"
                fullWidth
                onClick={() => setView('register')}
                className="min-h-[54px] text-base shadow-lg shadow-sage/20"
                data-analytics-id="homepage-join-primary"
              >
                <Heart className="h-5 w-5" aria-hidden="true" />
                Join Niwangu
              </Button>
              <Button
                variant="outline"
                fullWidth
                onClick={() => setView('auth')}
                className="min-h-[54px] border-sage/40 bg-white/60 text-base hover:border-midnight"
                data-analytics-id="homepage-login"
              >
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                Log In
              </Button>
            </div>

            <p className="mt-5 text-sm text-midnight/70">A space for slow, meaningful connection.</p>

            <div className="mt-10 grid max-w-[480px] grid-cols-3 gap-4 border-t border-midnight/10 pt-6 text-sm text-midnight/80">
              <div>
                <strong className="block text-3xl font-semibold leading-none tracking-tight text-midnight">3</strong>
                <span className="mt-2 block">thoughtful steps</span>
              </div>
              <div>
                <strong className="block text-3xl font-semibold leading-none tracking-tight text-midnight">10</strong>
                <span className="mt-2 block">daily decisions</span>
              </div>
              <div>
                <strong className="block text-3xl font-semibold leading-none tracking-tight text-midnight">1</strong>
                <span className="mt-2 block">calmer way</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sections hold a minimum height and centre their content, so each one
          reads as a full band rather than a thin strip. Content taller than the
          minimum still grows normally. */}
      <section className="relative flex min-h-[85vh] items-center bg-white px-6 py-24 sm:px-10 sm:py-28 lg:px-14" aria-labelledby="how-it-works">
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sageDeep">How it works</p>
            <h2 id="how-it-works" className="mt-4 font-serif text-4xl text-midnight sm:text-5xl">
              Built for connection with care.
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:gap-8 xl:grid-cols-4">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <article
                  key={step.title}
                  className="rounded-lg border border-midnight/10 bg-sandstone/70 p-7 lg:p-8"
                >
                  <div className="mb-9 flex h-12 w-12 items-center justify-center rounded-full bg-white text-sageDeep shadow-sm">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="font-serif text-2xl leading-snug text-midnight">{step.title}</h3>
                  <p className="mt-4 leading-7 text-midnight/80">{step.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative flex min-h-[85vh] items-center bg-[#4a3b42] px-6 py-24 text-white sm:px-10 sm:py-28 lg:px-14" aria-labelledby="love-stories">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sageLight">A thoughtful first message</p>
              <h2 id="love-stories" className="mt-4 font-serif text-4xl sm:text-5xl">
                A softer start can still be serious.
              </h2>
            </div>
            <div className="flex gap-3" aria-label="Testimonial navigation">
              <button
                type="button"
                onClick={() => scrollTestimonials('left')}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 text-white transition hover:bg-white hover:text-midnight focus:outline-none focus:ring-2 focus:ring-sageLight"
                aria-label="Previous conversation starter"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollTestimonials('right')}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-midnight transition hover:bg-sageLight focus:outline-none focus:ring-2 focus:ring-sageLight"
                aria-label="Next conversation starter"
              >
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div ref={testimonialTrackRef} className="no-scrollbar mt-14 flex snap-x gap-6 overflow-x-auto pb-4">
            {testimonials.map((testimonial) => (
              <article
                key={testimonial.name}
                className="min-w-[82vw] snap-start rounded-lg bg-white p-6 text-midnight shadow-2xl shadow-black/20 sm:min-w-[410px]"
              >
                <div className="flex items-center gap-4">
                  <OptimizedImage
                    src={testimonial.image}
                    alt=""
                    srcWidth={180}
                    srcSetWidths={[120, 180, 260]}
                    sizes="72px"
                    className="h-[72px] w-[72px] rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>

                  </div>
                </div>
                <blockquote className="mt-8 font-serif text-2xl leading-9">"{testimonial.quote}"</blockquote>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Shorter minimum: this one is a single banner, not a content block. */}
      <section className="relative flex min-h-[60vh] items-center bg-[#f7c4d0] px-6 py-24 sm:px-10 sm:py-28 lg:px-14" aria-labelledby="final-cta">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <Sparkles className="mb-5 h-9 w-9 text-midnight" aria-hidden="true" />
            <h2 id="final-cta" className="font-serif text-4xl text-midnight sm:text-5xl">
              Your intentional journey starts here.
            </h2>
            <p className="mt-4 text-lg leading-8 text-midnight/80">
              Choose a dating experience that respects your time, your boundaries, and your desire for something real.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setView('register')}
            className="w-full px-8 py-4 text-base sm:w-auto"
            data-analytics-id="homepage-join-final"
          >
            <Heart className="h-5 w-5" aria-hidden="true" />
            Join Niwangu
          </Button>
        </div>
      </section>

      {/* Three parts on one line at desktop — brand, navigation, copyright —
          rather than a stacked brand block, which is what made this tall. */}
      <footer className="bg-white px-6 py-7 text-midnight sm:px-10 lg:px-14">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 text-center md:flex-row md:justify-between md:gap-8 md:text-left">
          <a
            href="/"
            className="flex shrink-0 items-center gap-2.5 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-midnight"
            aria-label="Niwangu home"
          >
            <NiwanguLogo className="h-10 w-10" />

          </a>

          <nav
            className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-midnight/80"
            aria-label="Footer navigation"
          >
            {footerLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-sm transition-colors hover:text-sageDeep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-midnight"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <p className="shrink-0 text-xs text-midnight/70">
            &copy; {currentYear} Niwangu. All rights reserved.
          </p>
        </div>
      </footer>
    </motion.main>
  );
};
