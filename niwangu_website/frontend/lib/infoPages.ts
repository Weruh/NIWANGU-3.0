import { legalPages, POLICY_UPDATED, TERMS_VERSION, type InfoPageDefinition } from './policies';
export type { InfoPageDefinition } from './policies';

const helpPages: Record<string, InfoPageDefinition> = {
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
        body: 'Free members can use Focus to consider one person at a time. Premium also unlocks actual profiles in Discover; free members see a locked preview. Both modes share your decisions. Switching modes, refreshing, and opening a profile never consume decisions.',
      },
      {
        title: 'What does “Why you align” mean on a profile?',
        body: 'The specific things you and that person answered the same way — wanting children, a shared timeline, the same core value. Niwangu only claims something when you genuinely share it, so a profile with fewer reasons listed simply overlaps with you on fewer answers.',
      },
      {
        title: 'How much can I use for free?',
        body: 'Ten Like or Pass decisions each day in Focus. Browsing and opening profiles use no decisions. Discovery pauses after your tenth decision, while matched chat stays free. Premium unlocks actual Discover profiles and removes the decision limit. The allowance resets at midnight Kenya time.',
      },
      {
        title: 'What do passes cost and how do I pay?',
        body: 'The available pass prices, durations, and included Premium tools are shown at checkout. Passes remove the daily Like/Pass decision limit for their duration. Payment is by M-Pesa: you enter your Safaricom number, approve the STK prompt on your phone, and access opens as soon as the payment is confirmed.',
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
  '/community-guidelines': {
    eyebrow: 'Safety',
    title: 'Community Guidelines',
    updated: POLICY_UPDATED,
    version: TERMS_VERSION,
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
        body: 'No harassment, hate speech, threats, slurs, or content that degrades anyone. No sexual content sent to someone who has not asked for it. Do not upload photos or identifying information involving minors. Suspected child exploitation or other crimes may be reported to the authorities where required or appropriate.',
      },
      {
        title: 'Never Send Money',
        body: 'No genuine member will ask you for money, M-Pesa transfers, airtime, or help with a business or emergency. Requests like these are a warning sign of a scam. Do not send anything, and report it to safety@niwangu.com straight away.',
      },
      {
        title: 'Protect Your Own Details',
        body: 'Keep conversations in the Parlor until you trust someone. Be careful about sharing your ID, workplace, home area, or financial details early. If someone pushes hard to move to another app immediately, treat it as a warning sign.',
      },
      {
        title: 'Report What You See',
        body: 'You can close any conversation with a reason, which ends it without confrontation. Use Safety on a profile or conversation to report or block. You can also email safety@niwangu.com with the member’s name and relevant evidence. Reports are handled confidentially, although incident details may let someone infer who reported them.',
      },
      {
        title: 'What Happens When These Are Broken',
        body: 'Depending on severity we may issue a warning, remove content, limit an account, or remove it permanently. Serious concerns such as impersonation, scams, threats, or suspected underage accounts may require immediate restriction while investigated. If you believe a decision is mistaken, email safety@niwangu.com to request review.',
      },
    ],
  },
};


export const footerLinks = [
  { label: 'Contact Us', href: '/contact-us' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms of Service', href: '/terms-of-service' },
  { label: 'Refund Policy', href: '/refund-policy' },
  { label: 'Community Guidelines', href: '/community-guidelines' },
];

export const getInfoPage = (pathname: string): InfoPageDefinition | undefined => {
  const path = pathname.replace(/\/+$/, '') || '/';
  return Object.hasOwn(legalPages, path) ? legalPages[path] : Object.hasOwn(helpPages, path) ? helpPages[path] : undefined;
};
