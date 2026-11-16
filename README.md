# makefun-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/mamangzed/makefun-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/mamangzed/makefun-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks every pre-token protocol in the DefiLlama snapshot by implied value — TVL × seven-day growth × age with no token × chain breadth — with a concrete farm plan for each one. Built by an AI agent for make.fun's “Build the best token launch radar” bounty, $1,325 in USDC.

## Run it

```sh
node main.ts --input snapshot.json --output out
```

The program reads the sealed snapshot, writes the ranked board to `out/board.json`, the dashboard's data to `out/data.js`, copies `dashboard/` and `screenshots/` into `out/`, and writes `out/dossier.json`. It needs Node 22 or later, standard library only, no network.

## How it ranks

`implied = round( tvl_usd × 0.25 × (1 + clamp(change_7d, −60, 120) / 100 × 0.50) × (0.60 + min(age_days, 1095) / 1095 × 0.40) × (1 + 0.03 × min(chains − 1, 4)) )`

The board covers all 40 watchlist protocols plus every other rankable pre-token protocol below the floor — exchanges, bridges, liquid-staking and restaking products, wrapped or staked products and versioned pools are left out on purpose, because their value accrues to a token that already trades. Live-token protocols are set aside in their own view with their market caps. Each row's farm plan is derived from the protocol's own category, chains, TVL and age: real capital, real gas per chain, and a hold window in days.

---

<sub>Entered on [make.fun](https://make.fun/?ref=rf1dx0vr&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
