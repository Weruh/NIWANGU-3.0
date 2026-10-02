# Development review

Work remains on `development`. Do not push, merge, deploy functions, or apply
production migrations without the owner's approval.

## Agreed behaviour

1. Register/sign in, confirm email if required, and complete all twelve answers.
2. Add three photos and preview the profile before selecting free/Premium access.
3. Free members use Focus and can open a locked Discover preview made of
   decorative silhouettes. Premium unlocks the scrolling Discover feed.
   Focus has no skip controls; a saved Like/Pass advances to the next profile.
4. Both modes share profiles and decisions. Bookmarks stay private.
   Saving a profile does not advance Focus or spend a decision.
5. Free members receive ten total Like/Pass decisions per Kenya calendar day.
6. Mutual likes create a match and offer Start chatting or Keep discovering.
7. Matched chat is free, including after the discovery allowance/pass expires.
8. Boundary acknowledgement precedes sending; messages support retry and draft retention.
9. Premium: unlimited decisions, Likes You, advanced filters, Undo, incognito,
   and included boosts. All pass durations have the same core feature set.
10. Saved profiles, pause/resume, notification preferences, blocking/reporting,
    moderator review, and account deletion are accessible from the app.

Midnight Kenya reset and included boost allowance are explicit implementation
choices from the proposed plan: two boosts per 30 purchased days, minimum one per pass.

## Local validation

- PASS: Frontend TypeScript and production build.
- PASS: Native PostgreSQL discovery/quota/matching/chat/block tests, including
  message rejection before boundary acknowledgement and Kenya midnight reset.
- PASS: Native PostgreSQL payment renewal/replay/price and moderator authorization tests.
- PASS: Five mocked webhook tests for signature, settlement, currency, outage and retry.
- PASS: Three mocked deletion tests for authentication, orphan cleanup and Storage failure.
- PASS: Type checks for all three Edge Functions.
- PASS: Browser review of Discover/Focus mobile and desktop; mutual match →
  Start chatting → send, with the message confirmed in native PostgreSQL.
  Browser runtime-error check was clear.

The browser-review Auth adapter is a temporary file under `/tmp`; it is not part
of the application and is not evidence of real Supabase email/Auth delivery.
Notifications require the app to remain open; offline push is not implemented.
The app uses typed towns, not GPS distance. Premium does not guarantee matches.

## Owner acceptance walkthrough

- Finish onboarding, reload midway, and confirm answers/photos persist.
- Open profiles and switch Discover/Focus without spending decisions.
- Like/Pass ten times, check the reset time, and confirm Messages stays accessible.
- Use two accounts to like each other, acknowledge boundaries, send/retry messages,
  and confirm unread indicators and notification preferences.
- Save/unsave a profile; apply basic filters; inspect empty/error states.
- In Paystack test mode, buy/renew a pass and boosts; check included credits and expiry.
- Check Likes You, advanced filters, Undo, incognito, and expiry back to free access.
- Block/report a member; use a moderator account to review and suspend.
- Test password recovery, photo replacement, pause/resume, and deletion on disposable accounts.
- Review mobile keyboard layout, desktop navigation, keyboard focus, and reduced motion.

The boost asset and promo design are retained. The temporary authentication bypass
was removed because it prevented real sessions and caused the original build failure.

## Release preparation — October 2, 2026

- Removed unused screenshots/scaffold metadata, duplicate logo copies, obsolete demo seed,
  duplicate ignore rules, generated builds, Vite caches, and accidental CLI directories.
- Pinned existing dependency versions and verified a clean frontend install.
- Added pull-request build, Edge Function, and isolated database checks.
- Eight mocked webhook/deletion tests and both SQL suites pass.
- Production migrations are applied. Updated payment functions and the new
  delete-account function require deployment before merging the frontend release.
- See the root README for deployment order and merge instructions.
