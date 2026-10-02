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
 {image:'https://images.unsplash.com/photo-1524504388940-b1c1722653e1',quote:'What does building a life partnership look like for you?',name:'Conversation starter · Intentions'},
 {image:'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',quote:'We both value integrity. How does that show up in your everyday life?',name:'Conversation starter · Values'},
 {image:'https://images.unsplash.com/photo-1544005313-94ddf0286df2',quote:'What helps you feel comfortable when getting to know someone?',name:'Conversation starter · Boundaries'},
];

const footerLinks = [
  { label: 'Contact Us', href: '/contact-us' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms of Service', href: '/terms-of-service' },
  { label: 'Community Guidelines', href: '/community-guidelines' },
];

// Shown on the policy pages. A fixed revision date, not the current year:
// these documents should say when they were last actually revised.
const POLICY_LAST_UPDATED = '1 October 2026';

const footerPages = {
  '/contact-us': {
    eyebrow: 'Support',
    title: 'Contact Us',
    intro:
      'Niwangu is run by a small team in Kenya. Use the address that matches what you need and we will route it to the right person.',
    sections: [
      {
        title: 'Accounts and Passes',
        body: 'Email support@niwangu.com for help with signing in, editing your profile, questions about a pass, or anything that looks wrong in the app. If your question is about a payment, include the M-Pesa confirmation code and the phone number you paid from — that is what lets us find the transaction.',
      },
      {
        title: 'Safety and Conduct',
        body: 'Email safety@niwangu.com to report harassment, threats, a fake or stolen profile, a request for money, or anyone who ignores a stated boundary. Include the member’s name as it appears in the app and a screenshot if you have one. Reports about someone’s immediate safety are read first.',
      },
      {
        title: 'Privacy and Your Data',
        body: 'Email privacy@niwangu.com to ask what information we hold about you, to correct it, or to request deletion of your account and its data. See the Privacy Policy for what we collect and how long it is kept.',
      },
      {
        title: 'Business and Media',
        body: 'For partnerships, press, or anything commercial, email hello@niwangu.com.',
      },
      {
        title: 'Emergencies',
        body: 'Niwangu is not an emergency service and is not monitored around the clock. If you are in immediate danger, contact the Kenya Police on 999 or 112 rather than waiting for a reply from us.',
      },
    ],
  },
  '/faqs': {
    eyebrow: 'Help Center',
    title: 'Frequently Asked Questions',
    intro: 'How Niwangu works, what it costs, and why it behaves differently from the apps you are used to.',
    sections: [
      {
        title: 'What is Niwangu?',
        body: 'A dating app for people looking for something serious. Instead of an endless feed, you answer a set of questions about what you want, and Niwangu uses those answers to decide who you meet and to tell you why.',
      },
      {
        title: 'What is the Alignment Ritual?',
        body: 'Twelve questions you answer when you join, covering what you are building, your timeline, where you are in life, children, your core value, your non-negotiable, how you handle conflict, your social energy, how much you value introspection, and one open question about what you will no longer entertain. Your answers shape who you are shown.',
      },
      {
        title: 'How does matching work?',
        body: 'Two things must line up before anyone is shown to you: you are each looking for the other’s gender, and your answers about wanting children are not irreconcilable. Everyone else is ranked, not filtered — people whose Ritual answers align with yours come up first, and anyone who has already liked you is moved to the front.',
      },
      {
        title: 'Can I browse profiles or focus on one person?',
        body: 'Choose Discover to browse profile cards or Focus to consider one person at a time. Both modes share your decisions and profiles. Switching modes, refreshing, and opening a profile never consume decisions.',
      },
      {
        title: 'What does “Why you align” mean on a profile?',
        body: 'The specific things you and that person answered the same way — wanting children, a shared timeline, the same core value. Niwangu only claims something when you genuinely share it, so a profile with fewer reasons listed simply overlaps with you on fewer answers.',
      },
      {
        title: 'How much can I use for free?',
        body: 'Ten Like or Pass decisions each day, shared across Discover and Focus. Browsing and opening profiles use no decisions. Discovery pauses after your tenth decision, while matched chat stays free. The allowance resets at midnight Kenya time.',
      },
      {
        title: 'What do passes cost and how do I pay?',
        body: 'Passes run from KSh 99 for 7 days up to KSh 1,799 for a year, and remove the daily view limit for that period. Payment is by M-Pesa: you enter your Safaricom number, approve the STK prompt on your phone, and access opens as soon as the payment is confirmed.',
      },
      {
        title: 'Does a pass renew automatically?',
        body: 'No. Nothing is ever charged again without you starting a new payment yourself. When a pass ends you simply return to the free daily limit.',
      },
      {
        title: 'What if I buy a pass before my current one ends?',
        body: 'The new days are added to the time you have left rather than replacing it, so you never lose days by renewing early.',
      },
      {
        title: 'Why do I have to read someone’s boundary first?',
        body: 'If your match stated a boundary in the Ritual, it replaces the message box until you acknowledge it. It takes one tap, it only happens once per conversation, and it means the first thing you say is written knowing where that person stands.',
      },
      {
        title: 'Can I change my Ritual answers later?',
        body: 'Yes. Update them from your profile and matching adjusts straight away, so who you are shown reflects your current answers rather than the ones you gave when you joined.',
      },
      {
        title: 'How do I end a conversation or report someone?',
        body: 'Any conversation can be closed with a reason, which ends it respectfully for both people. Use Safety on a profile or conversation to block someone or submit a confidential report. You can also email safety@niwangu.com.',
      },
    ],
  },
  '/privacy-policy': {
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    intro:
      'What Niwangu collects, why, who it is shared with, and what you can ask us to do with it. Written to be read rather than skimmed past.',
    sections: [
      {
        title: 'What You Give Us',
        body: 'Your email address and password when you register; your name, age, gender, the gender you are looking for, and the location you type; up to three photos; your twelve Ritual answers; and the messages you send to matches. Passwords are hashed by our authentication provider and are never visible to us.',
      },
      {
        title: 'What We Record As You Use Niwangu',
        body: 'Your likes and passes, saved profiles, matches, reports and blocks, notification preferences, when you last read a conversation, and standard technical logs. Decisions are recorded to enforce the daily allowance.',
      },
      {
        title: 'Location',
        body: 'Niwangu does not use GPS and does not track your location. The place shown on your profile is only the text you typed, and it is never more precise than what you chose to write.',
      },
      {
        title: 'Payments',
        body: 'Payments are processed by Paystack over M-Pesa. We store the phone number used, the amount, the plan, and the reference and receipt numbers so a payment can be reconciled and support can help you. We never see or store your M-Pesa PIN or any card details.',
      },
      {
        title: 'What Other Members Can See',
        body: 'Your name, age, gender, location, photos, your stated boundary, and the specific Ritual answers you have in common with the person viewing you. Your email address, phone number, payment records, and full set of Ritual answers are never shown to other members.',
      },
      {
        title: 'Who Else Processes Your Data',
        body: 'Supabase provides the database, authentication, and photo storage. GitHub Pages hosts the website. Paystack processes payments. We do not sell your personal data, and we do not share it for advertising.',
      },
      {
        title: 'How Long We Keep It',
        body: 'Your profile and content are kept while your account exists. When you delete your account, your profile, photos, Ritual answers, likes, and matches are removed. Records of completed payments are retained for the period required for financial and tax purposes.',
      },
      {
        title: 'Your Rights',
        body: 'Under the Kenya Data Protection Act, 2019 you may ask for a copy of your data, correct it, ask for it to be deleted, or object to how it is used. Email privacy@niwangu.com and we will respond within the statutory period. You may also complain to the Office of the Data Protection Commissioner.',
      },
      {
        title: 'Changes to This Policy',
        body: 'If we change how information is collected or used, this page is updated and the revision date below changes with it.',
      },
    ],
  },
  '/terms-of-service': {
    eyebrow: 'Legal',
    title: 'Terms of Service',
    intro:
      'The agreement between you and Niwangu. By creating an account you accept these terms.',
    sections: [
      {
        title: 'Who Can Join',
        body: 'You must be at least 18 years old to use Niwangu. Accounts found to belong to anyone under 18 are removed immediately and permanently.',
      },
      {
        title: 'Your Account',
        body: 'Give accurate information and keep your sign-in details to yourself. You are responsible for activity on your account. One person, one account — do not create an account on someone else’s behalf or impersonate anyone.',
      },
      {
        title: 'Free Access and Passes',
        body: 'Without a pass you have ten Like or Pass decisions per Kenya calendar day. Existing matched conversations stay free. A pass removes the decision limit and includes the Premium tools shown at checkout.',
      },
      {
        title: 'Payment',
        body: 'Passes are paid in Kenyan Shillings by M-Pesa through Paystack. A pass starts once payment is confirmed, not when the prompt is sent. Passes do not renew automatically and you will never be charged again without starting a new payment. Buying while a pass is still running adds the new days to your remaining time.',
      },
      {
        title: 'If Something Goes Wrong With a Payment',
        body: 'If money leaves your account and access does not open, email support@niwangu.com with the M-Pesa confirmation code and the number you paid from, and we will reconcile it. Contact us before attempting the payment a second time.',
      },
      {
        title: 'Your Content',
        body: 'Your photos, answers, and messages remain yours. You give Niwangu permission to store them and to display them to other members as the app is designed to do, for as long as your account exists.',
      },
      {
        title: 'How You Must Behave',
        body: 'The Community Guidelines form part of these terms. In short: be honest, respect stated boundaries and the word no, and do not harass, threaten, defraud, or solicit money from other members.',
      },
      {
        title: 'Suspension and Removal',
        body: 'We may limit, suspend, or remove an account that breaks these terms or the guidelines, or that puts other members at risk. Where a serious risk to someone is involved we will act first and explain afterwards.',
      },
      {
        title: 'What Niwangu Does Not Promise',
        body: 'We match people, we do not vet them. Niwangu does not run background or criminal record checks, and cannot guarantee that anyone is who they claim to be, that you will match with anyone, or how any meeting will go. Meet in public, tell someone where you are going, and never send money to someone you have met here.',
      },
      {
        title: 'Changes',
        body: 'Features and prices may change as Niwangu develops. Material changes to these terms will be reflected on this page with a new revision date. Continuing to use Niwangu after a change means you accept it.',
      },
      {
        title: 'Governing Law',
        body: 'These terms are governed by the laws of Kenya, and the courts of Kenya have jurisdiction over any dispute arising from them.',
      },
    ],
  },
  '/community-guidelines': {
    eyebrow: 'Safety',
    title: 'Community Guidelines',
    intro:
      'Niwangu only works if people arrive in good faith. These are the rules that make that possible, and what happens when they are broken.',
    sections: [
      {
        title: 'Respect the Boundary',
        body: 'Every member states something they are no longer willing to entertain, and you have to read it before you can send a first message. Acknowledging it is not a formality. Testing, arguing with, or ignoring someone’s stated boundary is treated as harassment.',
      },
      {
        title: 'Be Honest',
        body: 'Use recent photos that are actually of you, give your real age, and answer the Ritual truthfully. The whole app is built on those answers, so misrepresenting them wastes other people’s time as much as your own. Never present yourself as someone you are not.',
      },
      {
        title: 'Take No For an Answer',
        body: 'Someone may end a conversation, decline to meet, or stop replying at any point and does not owe you a reason. Pressure, guilt, repeated requests after a refusal, and abuse after rejection are all grounds for removal.',
      },
      {
        title: 'Keep It Free of Harm',
        body: 'No harassment, hate speech, threats, slurs, or content that degrades anyone. No sexual content sent to someone who has not asked for it. No content involving minors, ever — that is reported to the authorities as well as removed.',
      },
      {
        title: 'Never Send Money',
        body: 'No genuine member will ask you for money, M-Pesa transfers, airtime, or help with a business or emergency. Requests like these are the most common scam on Kenyan dating platforms. Do not send anything, and report it to safety@niwangu.com straight away.',
      },
      {
        title: 'Protect Your Own Details',
        body: 'Keep conversations in the Parlor until you trust someone. Be careful about sharing your ID, workplace, home area, or financial details early. If someone pushes hard to move to another app immediately, treat it as a warning sign.',
      },
      {
        title: 'Report What You See',
        body: 'You can close any conversation with a reason, which ends it without confrontation. For behaviour that others should be protected from, email safety@niwangu.com with the member’s name and a screenshot. Reporting is confidential and the person is not told who reported them.',
      },
      {
        title: 'What Happens When These Are Broken',
        body: 'Depending on severity we may issue a warning, remove content, limit an account, or remove it permanently. Impersonation, scams, threats, and anything involving minors result in immediate removal without warning.',
      },
    ],
  },
};

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

type FooterPage = (typeof footerPages)[keyof typeof footerPages];

const InfoPage = ({ page, currentYear }: { page: FooterPage; currentYear: number }) => (
  <motion.main
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="min-h-dvh bg-sandstone text-midnight"
  >
    <header className="border-b border-midnight/10 bg-white/70 px-6 py-5 backdrop-blur sm:px-10 lg:px-14">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6">
        <a href="/" className="flex items-center gap-3 text-sageDeep" aria-label="Return to Niwangu homepage">
          <NiwanguLogo className="h-14 w-14" />

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
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sageDeep">{page.eyebrow}</p>
        <h1 className="mt-4 font-serif text-5xl leading-tight text-midnight sm:text-6xl">{page.title}</h1>
        <p className="mt-6 max-w-[62ch] text-lg leading-8 text-midnight/80">{page.intro}</p>

        {/* No cards. These are documents, so the headings carry the structure.
            Body copy is capped in ch rather than px to hold a readable line
            length whatever the viewport does. */}
        <div className="mt-12 space-y-10">
          {page.sections.map((section) => (
            <article key={section.title}>
              <h2 className="font-serif text-2xl text-midnight">{section.title}</h2>
              <p className="mt-3 max-w-[68ch] leading-8 text-midnight/80">{section.body}</p>
            </article>
          ))}
        </div>

        <p className="mt-10 border-t border-midnight/10 pt-6 text-sm text-midnight/70">
          Last updated {POLICY_LAST_UPDATED}. &copy; {currentYear} Niwangu. For formal legal or privacy
          requests, email privacy@niwangu.com.
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

  // One card plus the flex gap, so the arrows land on a card edge rather than
  // drifting out of alignment after a few presses.
  const TESTIMONIAL_STEP = 410 + 24;

  const scrollTestimonials = (direction: 'left' | 'right') => {
    testimonialTrackRef.current?.scrollBy({
      left: direction === 'left' ? -TESTIMONIAL_STEP : TESTIMONIAL_STEP,
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
