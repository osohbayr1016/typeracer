# Хүлгийн цуглуулга — shop content & autonomous additions

This guide governs original TypeRacer Mongolia cosmetics, including future hourly scheduled improvement runs. No Nitro Type artwork, trademarks, or source files may be reused. Content must be earned by **in-game virtual coins**, with no paid loot boxes or purchases.

## Six rarity tiers (18 original SVG cars in initial launch)

| Зэрэглэл | Level access | Initial car IDs | Coins |
|---|---:|---|---|
| Энгийн | 1–2 | falcon, nomad, rover | 300–400 |
| Сайжруулсан | 3–5 | sunflare, dune, cobalt | 550–750 |
| Ховор | 6–8 | glacier, fox, streak | 850–1,100 |
| Онцгой | 10–14 | ghost, onyx, meteor | 1,350–1,750 |
| Туульс | 17–23 | temple, nebula, eagle | 2,100–2,900 |
| Домогт | 26–35 | royal, aurora-x, dragon | 3,500–5,000 |

Each car has a unique SVG source at `frontend/public/cars/<id>.svg`, individualized silhouette/detail, tier colors and a named cosmetic effect; the `frontend/src/pages/ShopPage.css` glow and accent themes differentiate rarities while `GaragePage.css` animates equipped cars. Prefer reduced motion for accessibility; **animations never change speed, race fairness or rewards**.

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

### Important economy limitation

All progress, rewards and coins currently live in localStorage. This is suitable for cosmetic beta progression but **not a cheat-proof, authenticated, transferable account economy**. Do not promise this until a server ledger is designed, secured and tested.
