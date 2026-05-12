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
  {
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1',
    quote:
      'Niwangu made dating feel calm again. The prompts helped us talk about values before anything felt rushed.',
    name: 'Amina, Nairobi',
  },
  {
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
    quote:
      'I joined because I wanted something slower and more honest. Three weeks later, I met someone who wanted the same.',
    name: 'Daniel, Mombasa',
  },
  {
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
    quote:
      'The experience felt personal from the beginning. It gave us better questions and better reasons to keep showing up.',
    name: 'Leah, Kisumu',
  },
];

const footerLinks = [
  { label: 'Contact Us', href: '/contact-us' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms of Service', href: '/terms-of-service' },
  { label: 'Community Guidelines', href: '/community-guidelines' },
];

const footerPages = {
  '/contact-us': {
    eyebrow: 'Support',
    title: 'Contact Us',
    intro:
      'Questions, partnership requests, account concerns, and safety reports can be sent to the Niwangu team through the channels below.',
    sections: [
      {
        title: 'General Support',
        body: 'Email support@niwangu.com for account questions, onboarding help, billing questions, or feedback about your experience.',
      },
      {
        title: 'Safety and Trust',
        body: 'For urgent safety concerns, suspicious behavior, or community guideline reports, email safety@niwangu.com and include screenshots or relevant details when available.',
      },
      {
        title: 'Business Inquiries',
        body: 'For media, partnerships, or brand inquiries, contact hello@niwangu.com. We aim to respond to most messages within 2 business days.',
      },
    ],
  },
  '/faqs': {
    eyebrow: 'Help Center',
    title: 'Frequently Asked Questions',
    intro: 'Quick answers about how Niwangu works and what members can expect from an intentional dating experience.',
    sections: [
      {
        title: 'What is Niwangu?',
        body: 'Niwangu is a dating experience for people who want slower, more meaningful connection built around values, clarity, and intention.',
      },
      {
        title: 'How do matches work?',
        body: 'Members create a values-led profile, answer thoughtful prompts, and discover compatible people through a calmer daily experience.',
      },
      {
        title: 'Can I control my pace?',
        body: 'Yes. Niwangu is designed around boundaries, daily intention, and conversations that do not need to feel rushed.',
      },
      {
        title: 'How do I report a concern?',
        body: 'Use the reporting tools in the app when available, or contact safety@niwangu.com with the details of the concern.',
      },
    ],
  },
  '/privacy-policy': {
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    intro:
      'This page explains the types of information Niwangu may collect and how that information is used to operate and improve the service.',
    sections: [
      {
        title: 'Information We Collect',
        body: 'We may collect account details, profile information, photos, preferences, messages, usage activity, device data, and support communications you provide.',
      },
      {
        title: 'How We Use Information',
        body: 'We use information to create accounts, recommend compatible profiles, operate messaging, improve safety, provide support, prevent misuse, and improve Niwangu.',
      },
      {
        title: 'Sharing and Safety',
        body: 'We do not sell personal profile data. Information may be shared with service providers, legal authorities when required, or safety partners when needed to protect members.',
      },
      {
        title: 'Your Choices',
        body: 'You can update profile details, manage account settings, request account deletion, or contact privacy@niwangu.com for privacy-related requests.',
      },
    ],
  },
  '/terms-of-service': {
    eyebrow: 'Legal',
    title: 'Terms of Service',
    intro:
      'These terms describe the basic rules for using Niwangu. By using the service, members agree to act honestly, lawfully, and respectfully.',
    sections: [
      {
        title: 'Eligibility',
        body: 'You must be legally old enough to use dating services in your location and must provide accurate account information.',
      },
      {
        title: 'Member Responsibilities',
        body: 'Members are responsible for their profile content, conversations, conduct, and decisions to meet or communicate outside Niwangu.',
      },
      {
        title: 'Prohibited Behavior',
        body: 'Harassment, hate, scams, impersonation, explicit threats, spam, non-consensual content, and illegal activity are not permitted.',
      },
      {
        title: 'Service Changes',
        body: 'Niwangu may update, limit, suspend, or discontinue features as needed to improve the product, protect members, or comply with legal requirements.',
      },
    ],
  },
  '/community-guidelines': {
    eyebrow: 'Safety',
    title: 'Community Guidelines',
    intro: 'Niwangu is built for intentional connection. These guidelines help keep the community respectful, safe, and honest.',
    sections: [
      {
        title: 'Lead With Respect',
        body: 'Treat every member as a full person. No harassment, pressure, insults, hate speech, or degrading comments.',
      },
      {
        title: 'Be Honest',
        body: 'Use current photos, accurate profile information, and clear intentions. Do not impersonate anyone or misrepresent your relationship status.',
      },
      {
        title: 'Honor Consent and Boundaries',
        body: 'Respect someone’s pace, privacy, and decisions. If someone says no or stops responding, do not pressure them.',
      },
      {
        title: 'Protect the Community',
        body: 'Report scams, threats, suspicious behavior, or guideline violations. Niwangu may remove content or accounts that create harm.',
      },
    ],
  },
};

const NiwanguLogo = ({ className = 'h-16 w-16' }: { className?: string }) => (
  <img src="/niwangu-logo.png" alt="" className={`${className} object-contain`} aria-hidden="true" />
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
        key={panel.map((image) => image.src).join('-')}
        className="hero-gallery-panel"
        style={{ animationDelay: `${panelIndex * 3 - 0.7}s` }}
      >
        {panel.map((image, imageIndex) => (
          <div key={`${image.src}-${panelIndex}`} className={`hero-gallery-card hero-gallery-card-${imageIndex + 1}`}>
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

type FooterPage = (typeof footerPages)[keyof typeof footerPages];

const InfoPage = ({ page, currentYear }: { page: FooterPage; currentYear: number }) => (
  <motion.main
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="min-h-screen bg-sandstone text-midnight"
  >
    <header className="border-b border-midnight/10 bg-white/70 px-6 py-5 backdrop-blur sm:px-10 lg:px-14">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6">
        <a href="/" className="flex items-center gap-3 text-sage" aria-label="Return to Niwangu homepage">
          <NiwanguLogo className="h-10 w-10" />
          <span className="font-serif text-2xl text-midnight">Niwangu</span>
        </a>
        <a
          href="/"
          className="rounded-full border border-sage/40 bg-white px-5 py-2 text-sm font-medium text-midnight transition hover:border-midnight hover:bg-midnight hover:text-sandstone"
        >
          Back Home
        </a>
      </div>
    </header>

    <section className="px-6 py-16 sm:px-10 sm:py-20 lg:px-14">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sage">{page.eyebrow}</p>
        <h1 className="mt-4 font-serif text-5xl leading-tight text-midnight sm:text-6xl">{page.title}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-midnight/72">{page.intro}</p>

        <div className="mt-12 grid gap-5">
          {page.sections.map((section) => (
            <article key={section.title} className="rounded-lg border border-midnight/10 bg-white p-6 shadow-sm">
              <h2 className="font-serif text-2xl text-midnight">{section.title}</h2>
              <p className="mt-3 leading-7 text-midnight/70">{section.body}</p>
            </article>
          ))}
        </div>

        <p className="mt-10 text-sm text-midnight/55">
          Last updated {currentYear}. For formal legal or privacy requests, contact the Niwangu team directly.
        </p>
      </div>
    </section>
  </motion.main>
);

export const SanctuaryGate: FC = () => {
  const setView = useSanctuaryStore((state) => state.setView);
  const currentYear = new Date().getFullYear();
  const testimonialTrackRef = useRef<HTMLDivElement>(null);
  const footerPage = footerPages[window.location.pathname as keyof typeof footerPages];

  const scrollTestimonials = (direction: 'left' | 'right') => {
    testimonialTrackRef.current?.scrollBy({
      left: direction === 'left' ? -430 : 430,
      behavior: 'smooth',
    });
  };

  if (footerPage) {
    return <InfoPage page={footerPage} currentYear={currentYear} />;
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen overflow-hidden bg-sandstone text-midnight"
    >
      <section className="relative grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <div className="relative min-h-[46vh] overflow-hidden bg-[#f8d5dd] lg:min-h-screen">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.75),transparent_32%),linear-gradient(135deg,rgba(240,98,146,0.2),rgba(74,59,66,0.18))]" />
          <HeroGallery />
        </div>

        <div className="relative flex items-center bg-sandstone px-6 py-12 sm:px-10 lg:px-16 xl:px-20">
          <div className="mx-auto w-full max-w-[560px]">
            <div className="mb-12 flex items-center gap-5">
              <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-white text-sage shadow-xl shadow-sage/15 ring-1 ring-sage/10">
                <NiwanguLogo className="h-11 w-11" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sage sm:text-sm">Niwangu</p>
                <p className="mt-1 font-serif text-2xl leading-none text-midnight sm:text-3xl">Love, with Intention.</p>
              </div>
            </div>

            <h1 className="max-w-[520px] font-serif text-5xl leading-[0.98] text-midnight sm:text-6xl xl:text-[5.35rem]">
              Find your intentional love story.
            </h1>
            <p className="mt-7 max-w-[500px] text-lg leading-8 text-midnight/72 sm:text-xl sm:leading-9">
              Meet people who value depth, emotional clarity, and a gentler path toward real connection.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <Button
                variant="primary"
                onClick={() => setView('register')}
                className="min-h-[58px] px-8 text-base shadow-xl shadow-sage/25 sm:min-w-[230px]"
                data-analytics-id="homepage-join-primary"
              >
                <Heart className="h-5 w-5" aria-hidden="true" />
                Join Niwangu
              </Button>
              <Button
                variant="outline"
                onClick={() => setView('auth')}
                className="min-h-[58px] border-sage/40 bg-white/60 px-8 text-base hover:border-midnight sm:min-w-[170px]"
                data-analytics-id="homepage-login"
              >
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                Log In
              </Button>
            </div>

            <p className="mt-6 text-sm font-medium text-midnight/62">A space for slow, meaningful connection.</p>

            <div className="mt-12 grid grid-cols-3 gap-4 border-y border-midnight/10 py-6 text-sm text-midnight/68">
              <div>
                <strong className="block font-serif text-3xl leading-none text-midnight">3</strong>
                <span className="mt-2 block">thoughtful steps</span>
              </div>
              <div>
                <strong className="block font-serif text-3xl leading-none text-midnight">5</strong>
                <span className="mt-2 block">daily intentions</span>
              </div>
              <div>
                <strong className="block font-serif text-3xl leading-none text-midnight">1</strong>
                <span className="mt-2 block">calmer way</span>
              </div>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-b from-sandstone/0 via-sandstone/72 to-white sm:h-32" />
      </section>

      <section className="relative bg-white px-6 pb-28 pt-14 sm:px-10 sm:pt-16 lg:px-14" aria-labelledby="how-it-works">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sage">How it works</p>
            <h2 id="how-it-works" className="mt-3 font-serif text-4xl text-midnight sm:text-5xl">
              Built for connection with care.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="rounded-lg border border-midnight/10 bg-sandstone/70 p-6">
                  <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-full bg-white text-sage shadow-sm">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="font-serif text-2xl text-midnight">{step.title}</h3>
                  <p className="mt-3 leading-7 text-midnight/68">{step.description}</p>
                </article>
              );
            })}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-b from-white/0 via-white/72 to-[#4a3b42] sm:h-32" />
      </section>

      <section className="relative bg-[#4a3b42] px-6 pb-28 pt-20 text-white sm:px-10 lg:px-14" aria-labelledby="love-stories">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sageLight">Real love stories</p>
              <h2 id="love-stories" className="mt-3 font-serif text-4xl sm:text-5xl">
                A softer start can still be serious.
              </h2>
            </div>
            <div className="flex gap-3" aria-label="Testimonial navigation">
              <button
                type="button"
                onClick={() => scrollTestimonials('left')}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 text-white transition hover:bg-white hover:text-midnight focus:outline-none focus:ring-2 focus:ring-sageLight"
                aria-label="Previous testimonial"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollTestimonials('right')}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-midnight transition hover:bg-sageLight focus:outline-none focus:ring-2 focus:ring-sageLight"
                aria-label="Next testimonial"
              >
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div ref={testimonialTrackRef} className="no-scrollbar mt-12 flex snap-x gap-5 overflow-x-auto pb-4">
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
                    <div className="mt-1 flex gap-1 text-sage" aria-label="Five star rating">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star key={index} className="h-4 w-4 fill-current" aria-hidden="true" />
                      ))}
                    </div>
                  </div>
                </div>
                <blockquote className="mt-8 font-serif text-2xl leading-9">"{testimonial.quote}"</blockquote>
              </article>
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-b from-[#4a3b42]/0 via-[#4a3b42]/72 to-[#f7c4d0] sm:h-32" />
      </section>

      <section className="relative bg-[#f7c4d0] px-6 pb-28 pt-20 sm:px-10 lg:px-14" aria-labelledby="final-cta">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <Sparkles className="mb-5 h-9 w-9 text-midnight" aria-hidden="true" />
            <h2 id="final-cta" className="font-serif text-4xl text-midnight sm:text-5xl">
              Your intentional journey starts here.
            </h2>
            <p className="mt-4 text-lg leading-8 text-midnight/72">
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-b from-[#f7c4d0]/0 via-[#f7c4d0]/72 to-white sm:h-32" />
      </section>

      <footer className="bg-white px-6 pb-10 pt-12 text-midnight sm:px-10 lg:px-14">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 text-sage">
              <NiwanguLogo className="h-10 w-10" />
              <span className="font-serif text-2xl text-midnight">Niwangu</span>
            </div>
            <p className="mt-3 text-sm text-midnight/62">&copy; {currentYear} Niwangu. All rights reserved.</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-3 text-sm" aria-label="Footer navigation">
            {footerLinks.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-sage">
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </motion.main>
  );
};
