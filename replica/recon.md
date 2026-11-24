# Recon: a search-first travel marketplace home (reference: Thrillophilia, public home page only)

Clean room, per replica-recon. Source: the public home page, read once as a visitor. No account, no scraping, no source or network inspection.
We rebuild patterns and functions. We do not take their name, logo, photos, videos, copy, ratings, counters or colours.

## Scope

- App and platform: web, customer-facing travel site.
- Slice: **discover and enquire**. Home page, search/browse results page, trip cards, "request a callback" lead capture. Trip detail redesign is a later slice.
- Who it is for: Aethel, a Bengaluru agency selling family holidays, senior group trips, treks and trips with strangers. Few trips today, many later.

## Sources

| source | what it gave |
| --- | --- |
| Reference home page (public) | section order, search-first hero, card contents, filter patterns |
| Aethel's own catalogue and itinerary data | what we can honestly show |

## Screen inventory

| ID | screen | route | purpose | key components | states |
| --- | --- | --- | --- | --- | --- |
| S01 | Home | `/` | start a search or pick a kind of trip | search box, popular-search chips, place circles, category tiles, trip cards, departures, how-it-works | no trips, few trips |
| S02 | Search and browse | `/search` | find trips by words, kind, length, price | search box, filter chips, sort, trip cards, empty state | no query, no match, many |
| S03 | Callback sheet | modal on any trip card | leave name and phone to be called back | dialog, form, success | idle, sending, error, sent |
| S04 | Trip page | `/packages/[slug]` | exists already (story page and classic page) | unchanged this slice | |
| S05 | Enquiry | `/enquire` | long-form enquiry | exists already | |

## Flows

- F01 Visitor searches: S01 search box -> S02 results -> S04 trip. Happy path: type, Enter, click card (3 actions).
- F02 Visitor browses by kind or place: S01 tile -> S02 (filtered) -> S04.
- F03 Visitor asks for a callback: any card -> S03 -> sent. Lands in admin Enquiries (source: callback).
- F04 Visitor enquires about a place we do not list: S01 place tile -> S05 prefilled.

## What the reference does that we deliberately do not copy

- Fake or unverifiable proof: customer counts, star ratings, "live travellers", countdown timers, "X% off" with struck-through prices. We have no reviews yet and no price history, so we show none.
- Video tiles, partner logos, awards, tourism-board logos: not ours.
- Their copy and imagery. All words and photos here are our own or open-licence.

## Inferred data (ours)

Packages already have: title, summary, duration_days, base_price_paise, price_note, highlights, tags (categories), destinations, departures with live seats.
Enquiries gain source `callback` (needs an enum value) and reuse name, phone, package_id, consent_at.

## Hard parts

Search over a small catalogue is plain filtering in memory (no search service). Callback needs spam protection (honeypot + rate limit now, Turnstile later). Size: S.
