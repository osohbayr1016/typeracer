# Хүлгийн цуглуулга — shop content & autonomous additions

This guide governs original TypeRacer Mongolia cosmetics, including future hourly scheduled improvement runs. No Nitro Type artwork, trademarks, or source files may be reused. Content must be earned by **in-game virtual coins**, with no paid loot boxes or purchases.

## Six rarity tiers (original 18 car identities, new user-provided artwork)

| Зэрэглэл | Level access | Initial car IDs | Coins |
|---|---:|---|---|
| Энгийн | 1–2 | falcon, nomad, rover | 300–400 |
| Сайжруулсан | 3–5 | sunflare, dune, cobalt | 550–750 |
| Ховор | 6–8 | glacier, fox, streak | 850–1,100 |
| Онцгой | 10–14 | ghost, onyx, meteor | 1,350–1,750 |
| Туульс | 17–23 | temple, nebula, eagle | 2,100–2,900 |
| Домогт | 26–35 | royal, aurora-x, dragon | 3,500–5,000 |

### 2026-10-12 — User-provided art replaces the SVG thumbnails (no new products)

The game now uses **29 distinct uploaded car artworks**, supplied directly by the project owner. Each existing `Skin` ID has two transparent alpha WebP assets with the *same ID*: 
- `frontend/public/cars/<id>.webp` — original-style 1024px shop, Garage, Battle Pass and larger previews.
- `frontend/public/cars/race/<id>.webp` — optimized 416px version in racing lanes, spectators and Play previews to reduce realtime bandwidth.

These are real committed binary assets, not external links, prompts, temporary ChatGPT URLs or placeholder SVG recolors. `frontend/src/pages/cars.ts` is the single source for all 29 car IDs, the full artwork URL and `raceCarIcon` helper. `frontend/src/progression.ts` retains **all existing catalog IDs, rarity, minLevel, virtual-coin prices, ownership, persistence, season rewards and effects**, while changing car preview URLs. Cloudflare Workers' existing static-assets deployment serves the WebP files from the frontend build: **R2 is not used** and no R2 upload or public bucket access is claimed. Older SVG files are retained temporarily for backwards compatibility, not used in the refreshed catalog.

The original 18 collectible slots remain three cars per `Энгийн`, `Сайжруулсан`, `Ховор`, `Онцгой`, `Туульс`, `Домогт` tier. No paid unlocks, loot boxes, competitive performance bonuses or new time-limited offers. Animations/effects remain cosmetic and respect `prefers-reduced-motion`.

**Required verification for this art update:** GitHub tracked files and image SHA; all 29 large and all 29 small WebP assets serve with `image/webp`; RIFF/WEBP header, alpha flag, distinct hashes, small-image size less than full image; Chromium image decode across desktop/mobile Shop, purchased/equipped Garage, public/private racing and Season. Check PR CI before merging and the **existing staging-only** deploy+smoke after merge. No production changes.



### Required implementation per new item

1. Verify there are no open in-progress feature PRs or failing CI and no higher-severity gameplay issues.
2. Create an original SVG (the actual asset, not an external image link) under `frontend/public/cars/`; inspect the icon at 70px and 160px and make sure Mongolian text isn't baked into tiny graphics.
3. Add a distinct `Skin` ID, color, label, icon, `rarity`, `effect` in `frontend/src/pages/cars.ts`.
4. Add shop `Cosmetic` with positive `price`, `minLevel`, exact matching rarity, name/description/preview to `frontend/src/progression.ts` in the **correct tier**. Keep prices non-decreasing with rarity. Never bypass the `buyItem` level/coin validation.
5. Update both server allowlists: `backend/src/quick.ts` and `backend/src/room.ts`. New car skins must render for real opponents but guest-supplied cosmetics remain **untrusted** until accounts exist.
6. Add/adjust unit tests for level, price, duplicate purchase and catalog IDs, plus E2E checks for served SVG, rarity filters, purchase, garage equip and mobile overflow. Update the collection count UI and tests when the catalog grows beyond 18 skins.
7. Use a scoped PR, require green typecheck/unit/build/E2E; merge only after review/verification; allow staging deploy only. Log source, test results and release risk in `docs/CONTINUOUS-IMPROVEMENT.md`.

### Automated content cadence

Use the **existing hourly TypeRacer Improvement Cycle**, rather than a new independent task. Prioritize broken gameplay, security and failing PRs above cosmetics. On **at most one cycle per day**, after inspecting actual user level progression, catalog gaps and item balance, create **one or two original new skins or companion trails/stickers/titles** with level-aware pricing and test coverage. Do not invent usage metrics. If there is no quality improvement, skip item generation that day. Avoid automatically granting players rare cars or creating daily monetization pressure.

The weekly Featured and daily spotlight are deterministic views computed in `shopRotation()` using Mongolia time and **do not remove any purchases from the full shop catalog**.

### 2026-10-11 economy rebalance (no new cosmetics)

Player earnings are intentionally slowed down without changing any car prices or level access:
- Quick live public race **placement coins:** 1st 30, 2nd 27, 3rd 24, 4th 21, 5th 18; unfinished 0. Server result controls this prize; frontend records it once.
- Solo practice coins: roughly 20–30 at normal human typing speeds, capped at 30. These are browser-local and do not enter ranked multiplayer.
- Daily quick race tasks: first finish 8 coins; finish **three** precision races (95%+) for 12; finish **five** speed races (70 WPM+) for 15. A single first race no longer instantly unlocks all three mission prizes.
- Competitive weekly Leaderboard **points** are separate from coins: formula uses speed × accuracy and yields about 19–33 points for typical 60–120 WPM finishes. Existing event scores are reweighted once in SQLite with a version marker so historic races do not unfairly dominate newer lower-score finishes.
- Historical wallet, owned car skins, claimed pass tiers, shop prices and user XP are retained. A 300-coin beginner car is now a meaningful multi-race goal (roughly 10 first-place races rather than three).
- No paid loot boxes, unfair gameplay bonuses, destructive migration or fake account economy. Future pricing/content audits should use these changed earning rates, not outdated 120-coins-per-race assumptions.

### Important economy limitation

All progress, rewards and coins currently live in localStorage. This is suitable for cosmetic beta progression but **not a cheat-proof, authenticated, transferable account economy**. Do not promise this until a server ledger is designed, secured and tested.
