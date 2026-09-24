# Niwangu — LinkedIn launch captions

Paste the caption body as plain text. LinkedIn does not render markdown, so the
copy below uses line breaks only — no asterisks, no headings.

The first two lines are all anyone sees before "…see more". Each caption is
written so those two lines stand on their own.

Put the link in the first comment, not the post body — LinkedIn suppresses reach
on posts with outbound links in them.

---

## 1 — The launch post (default; speaks to users and recruiters at once)

Most dating apps are built to keep you swiping. I spent the last few months
building one designed to make you stop.

Niwangu is live.

It starts with the Alignment Ritual — twelve questions about what you are
building, your timeline, children, your core value, your non-negotiable, and the
one thing you will no longer entertain. Those answers decide who you meet.

Then the app gets quiet on purpose:

→ One profile at a time, because the point is to consider someone rather than
scroll past them.
→ Every profile tells you why you align — the specific answers you actually gave
in common, never a score you cannot inspect.
→ If your match stated a boundary, you read it before the message box opens. Once
per conversation, one tap.
→ Five considered profiles a day, free. Passes start at KSh 99 by M-Pesa and
never auto-renew.

Under the hood: React 19, TypeScript, Tailwind and Vite on the front; Supabase
for auth, Postgres, storage and realtime; two Deno edge functions handling
Paystack M-Pesa charges and signed webhooks. Prices live in the database, not the
client, so the UI can never quote a figure the server will not charge.

Built in Nairobi, for people who are done with the swipe.

If you know someone who wants something slower and more honest, send this to them.

#Niwangu #ProductLaunch #BuildInPublic #Kenya #React #TypeScript #Supabase

---

## 2 — The engineering post (aimed at recruiters and technical hiring managers)

A dating app is a payments system, a permissions system and a matching system
wearing a trench coat. Here is how I built Niwangu.

Four decisions I would defend in a design review:

1. Entitlements are server-granted, never client-claimed.
Premium is only ever activated by complete_payment(), called after the Paystack
webhook's HMAC signature is verified and the transaction is re-checked against
the API. The browser cannot write is_premium, premium_expires_at,
subscription_plan or payment_reference — a Postgres trigger rejects those writes
outright.

2. The payment row is written before the charge, not after.
We generate the reference first and insert a pending row, because the webhook can
land while the charge call is still returning. Writing it afterwards is a race
you lose in production, not in testing.

3. Prices are not in the frontend.
They live in the pricing_plans table, which is the same source the charge
function reads. The marketing copy sits in the client; the numbers do not. The UI
is structurally incapable of quoting a price the server disagrees with.

4. The free tier is enforced in the database.
Other members' profiles are unreadable through the table. They come back only via
get_gallery_profiles() and get_matches(), which meter the five-a-day limit
server-side under RLS. Querying profiles directly returns your own row and
nothing else. There is no client-side gate to bypass because there is no
client-side gate.

Stack: React 19, TypeScript, Tailwind, Vite, Zustand, Framer Motion, Supabase
(Postgres, RLS, Auth, Storage, Realtime, Edge Functions), Paystack over M-Pesa.
Typecheck gates the build and CI. Privacy written against the Kenya Data
Protection Act, 2019.

Live at niwangu.com. Happy to talk through any of the above — especially the
parts I would do differently.

#SoftwareEngineering #React #TypeScript #Supabase #PostgreSQL #Fintech #Kenya
#OpenToWork

---

## 3 — The short post (highest reach; best if you post more than once)

I built a dating app that shows you one person at a time.

No infinite feed. No score you cannot see. Twelve questions about what you
actually want, and matches that tell you exactly what you have in common.

Five profiles a day, free. Passes from KSh 99 on M-Pesa. Nothing auto-renews.

Niwangu is live. Built in Nairobi with React, TypeScript and Supabase.

#Niwangu #BuildInPublic #Kenya #React #Supabase

---

## 4 — First comment (use with any of the above)

Try it here → https://niwangu.com

Feedback is genuinely welcome, especially from anyone who has given up on dating
apps. That is the person this was built for.

---

## Posting notes

- Post Tuesday–Thursday, 8–10am EAT. Kenyan feed peaks before the workday settles.
- Upload `niwangu-linkedin-poster.png` (1200×1500). The 4:5 ratio takes the most
  vertical space LinkedIn allows in-feed, which is most of the reason a post gets
  noticed on mobile.
- Use `niwangu-linkedin-poster@2x.png` (2400×3000) only where you need print or
  retina resolution — it is 4.8 MB and LinkedIn will downscale it anyway.
- Add alt text on upload: "Niwangu poster — Find your intentional love story. A
  calmer dating app built with React, TypeScript and Supabase."
- Reply to every comment in the first two hours. LinkedIn weights early
  engagement heavily, and comment replies count.
- Caption 2 is the one to send recruiters directly, or to pin to your profile as
  a featured post.
