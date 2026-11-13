# Wave 6 — Typing and retention UX

## Fixes
- Daily challenge explicitly refreshes at the **Asia/Ulaanbaatar** calendar boundary while the tab stays open; resets timer, local input, visible score and the daily PB key. Visible/focused tabs re-check immediately after browser suspension.
- Quick results place the primary rematch/share/home actions above the full five-racer standings, so a mobile user does not need to scroll through the podium to retry.
- Keyboard Enter-to-rematch shortcut avoids form controls, links, editable elements, modifier combinations, key repeats and composition input.
- Result copy distinguishes server-calculated race placement from anti-cheat-verified official rankings.
- Touch keyboard focus state now keeps a readable multi-line Cyrillic prompt instead of shrinking the text area to 53px.
- New Playwright fake-clock daily rollover regression.

## Still required
Offline/practice XP and free coins remain in browser storage. Human-first PVP matching and SQL results have a separate PR. Full cross-device progression, device lab QA, ranked anti-cheat, accessibility audit and load profiles are pending.
