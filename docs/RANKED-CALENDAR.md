# Mongolia calendar boundaries for competitive scores

## Weekly leaderboards (all matches, human PvP, teams)
The weekly score window begins **Monday at 00:00 Asia/Ulaanbaatar**, equivalent to Sunday at 16:00 UTC. The Worker computes this boundary from the exact race completion timestamp; it does not use a browser clock or browser-supplied timezone.

Each completed race remains in the immutable SQLite ledger after the weekly score resets. Total lifetime race counts, personal best, online XP and purchased cosmetics are never reset by the weekly leaderboard window.

## Daily verified XP
Daily leaderboard and all online quest thresholds use the same Mongolia-local midnight (UTC+08). Solo sprint/daily practice on the device is not a ranked online event. During beta, guest rankings are not claimed to be cheat-proof.

## Production validation
- Just before and just after Mongolia Monday 00:00, verify the all-races, human PvP and team leaderboards switch in lockstep.
- Verify daily XP resets at Mongolia 00:00 each day.
- Verify historical personal records and balances are still present.
- Leave old UTC weekly event timestamps unchanged; historical events are evaluated in the new window according to their actual completion time.
