# Store listing — DrinkedInn

Copy for App Store Connect and Google Play Console, written to the positioning
we settled on: hospitality and moments, never "an app about alcohol".

Two rules applied throughout, both from the compliance review:

- **No comparison to any named social network** anywhere in metadata. Apple
  guideline 5.2.1 covers copycat names and metadata explicitly.
- **Lead with company, not consumption.** Guideline 1.4.3 rejects apps that
  encourage excessive drinking, and a listing is read as marketing.

---

## App name

```
DrinkedInn
```

**Subtitle (iOS, 30 char max):**
```
Every good story starts here
```
*(28 characters)*

**Short description (Play, 80 char max):**
```
Share the good moments and the people you spend them with. Pull up a chair.
```
*(74 characters)*

---

## Description

```
Some evenings are worth remembering. DrinkedInn is where you keep them.

Share the moment — the table, the view, the people, the glass in your hand.
Find others who care about what's in theirs. An inn has always been where
people gather; this is that, on your phone.

WHAT YOU CAN DO

• Share a pour — a photo, a note, where you are, who you're with
• Cheer and comment on what other people are drinking
• Build your shelf — keep track of bottles you own and want to try
• Join groups around whisky, wine, beer, cocktails and no/low
• Follow people whose taste you trust

BUILT TO BE PUT DOWN

We think an app about good evenings shouldn't ruin them. So:

• No notifications between 10pm and 8am, your local time
• A hard cap on how many we send in a day
• Streaks count days you took part in the community — never how much
  you drank
• Mocktails, alcohol-free spirits and coffee are all welcome here

18+ only. Date of birth is checked at sign-up.

Please drink responsibly. If drinking stops being fun, talk to someone —
free, confidential support is available in most countries.
```

---

## Keywords (iOS, 100 char max, comma separated)

```
drinks,whisky,wine,craft beer,cocktails,tasting,social,friends,community,bar,pub,collection
```
*(96 characters)*

**Avoid:** any competitor name. Apple rejects competitor keywords, and in this
case it would also undercut the trademark position.

---

## Category

| | Choice | Why |
|---|---|---|
| Primary | **Social Networking** | Matches what the app does. "Food & Drink" invites questions about alcohol sales. |
| Secondary (iOS) | Lifestyle | |

---

## Age rating

**Declare 18+ / Mature 17+ on both stores.**

Answer the questionnaires honestly:

- Alcohol, Tobacco or Drug Use or References → **Frequent/Intense**
- User Generated Content → **Yes**, with moderation and reporting
- Unrestricted Web Access → **No**

Under-rating is the fastest route to removal, and the 18+ rating is what the
whole age-gate architecture already assumes.

---

## Screenshots

Six per device size. Show the product doing its job.

| # | Screen | Caption |
|---|---|---|
| 1 | Home feed | Good moments, better company |
| 2 | A pour with a photo | Share what's worth remembering |
| 3 | Discover / people | Find people whose taste you trust |
| 4 | Profile with shelf | Keep track of what you've loved |
| 5 | Notification settings | Quiet hours, always on by default |
| 6 | Groups | Whisky nerds, wine pros, and the sober-curious |

**Rules for the images themselves** — screenshots are reviewed as marketing:

- No visibly intoxicated people
- No volume — no rows of empties, no shots lined up
- Nobody who could read as under 25
- At least one screenshot that isn't alcohol-forward (settings, profile, groups)

---

## Review notes (App Store Connect → App Review Information)

```
DrinkedInn is a social network for sharing good moments with friends.
Alcohol appears as part of the setting; the app does not sell alcohol and
has no purchase or delivery functionality.

DEMO ACCOUNT
  Email:    [create a fresh reviewer account]
  Password: [set one]
The account has seeded content so the feed is not empty.

MODERATION AND SAFETY (guideline 1.2)
  • Filtering: all posts and comments pass a server-side filter before
    publishing. It blocks content encouraging unsafe drinking, drink
    driving, rapid consumption and content involving minors.
  • Reporting: the "..." menu on any post opens a report flow with
    reasons, including "Encourages unsafe drinking".
  • Blocking: the same menu offers Block. Blocking is mutual and removes
    the connection.
  • Contact: hello@drinkedinn.app, also published in-app under
    Account → Terms & policies.

AGE (guideline 1.4.3)
  Date of birth is collected at registration and verified server-side
  against the legal drinking age of the user's country — 21 in the US,
  19 in Canada, 20 in Japan, 18 in the UK. Optional additional age
  verification is available under Account → Age verification.

ACCOUNT DELETION (guideline 5.1.1(v))
  Account → Privacy & data → Delete my account. Requires the account
  password and permanently erases all content.
```

---

## Data safety (Play) / Privacy nutrition label (iOS)

Declare honestly. A mismatch with observed traffic is a suspension, not a warning.

| Data | Collected | Linked to user | Purpose |
|---|---|---|---|
| Email address | Yes | Yes | Account, authentication |
| Name | Yes | Yes | Account, profile |
| Date of birth | Yes | Yes | Legal age verification |
| Photos | Yes | Yes | Content the user chooses to share |
| User content | Yes | Yes | App functionality |
| Approximate location | No | — | Only free-text place names the user types |
| Precise location | No | — | Never collected |
| Contacts | No | — | Never collected |
| Advertising ID | No | — | Never collected |
| Product interaction | Yes | Yes | Analytics — first party, not shared |
| Crash data | Yes | Yes | Diagnostics — first party, not shared |

**Data is not sold. Data is not shared with third parties for advertising.**
Both statements are currently true and enforced in code — keep them that way.

Also declare: **data can be deleted** (in-app account deletion), and
**data is encrypted in transit**.

---

## Required URLs

| Field | URL |
|---|---|
| Privacy policy | `https://www.drinkedinn.com/privacy` |
| Terms of use | `https://www.drinkedinn.com/terms` |
| Support | `https://www.drinkedinn.com/guidelines` or `mailto:hello@drinkedinn.app` |
| Marketing | `https://www.drinkedinn.com` |

All three legal pages are live and reachable without an account or the age gate.
