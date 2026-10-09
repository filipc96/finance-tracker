# Fintrax product screenshots

Captured from a real local build of [finance-tracker](https://github.com/filipc96/finance-tracker)
(Django sidecar + built React SPA, served exactly as the packaged desktop app
serves it) driven headlessly through the actual UI — real login, real chart
rendering, real OCR upload. All images are 2× (retina); halve the pixel
dimensions for CSS size.

The account shown is a seeded demo profile (`alex`, EUR, ~14 months of history),
not a real person's finances. See `../../tools/screenshot-capture/` to
regenerate everything.

## Hero / marketing composites

| File | Size | Use |
| --- | --- | --- |
| `11-hero-desktop-and-phone.png` | 3600×2100 | Primary hero — desktop window + Telegram phone, the "runs on your PC, reach it from your phone" story |
| `10-hero-window.png` | 3200×2000 | Dashboard in a desktop window frame on a light gradient |
| `10b-hero-window-dark.png` | 3200×2000 | Same, dark theme |
| `12-hero-analytics.png` | 3200×2000 | Analytics-led variant for a "see where it goes" section |
| `13-og-card.png` | 2400×1260 | Social / OG card, 1200×630 at 1× |

## Feature screenshots

| File | Size | Shows |
| --- | --- | --- |
| `01-dashboard.png` | 3200×2000 | Net worth, balance, total spent, latest income/expense, year charts, budget alerts |
| `01b-dashboard-dark.png` | 3200×2000 | Dashboard, dark theme |
| `01c-dashboard-full.png` | 3200×3804 | Whole dashboard page, no scroll crop |
| `02-analytics.png` | 3200×2000 | Analytics header: period income/expenses/savings rate + net-worth change |
| `02b-analytics-charts.png` | 3200×2000 | Savings rate, category trends, income/expense year curves |
| `02c-analytics-breakdown.png` | 3200×2000 | Expense/income category pies + transactions over time |
| `02d-analytics-full.png` | 3200×6224 | Whole analytics page |
| `03-ai-chat.png` | 3200×2000 | AI assistant panel open over the dashboard |
| `03b-ai-chat-panel.png` | 800×1000 | Assistant panel alone — answer with a category table |
| `04-receipt-scan.png` | 3200×2000 | Dashboard with a scanned receipt turned into an expense draft |
| `04b-receipt-scan-card.png` | 804×856 | The scan card alone: merchant, amount, date and category all extracted |
| `05-history.png` | 3200×2000 | Transaction history with filters |
| `06-budgets.png` | 3200×2000 | Per-category monthly budgets |
| `07-account-picker.png` | 3200×2000 | Local account picker at launch — no cloud sign-up |
| `08-savings.png` | 3200×2000 | Savings accounts with APY and interest |
| `09-telegram-commands.png` | 1080×2020 | Telegram bot: `help`, `balance`, `add expense …` |
| `09b-telegram-receipt.png` | 1080×2020 | Telegram bot: receipt photo → parsed draft → `yes` → saved → `recent` |

## What is real and what is staged

Worth knowing before writing copy against these images:

- **Real**: every page, chart, number and interaction. The receipt in
  `04-*` and `09b-*` went through the app's own RapidOCR + extraction pipeline;
  the merchant, €44.33 total, date and Groceries category were parsed from the
  image, not typed in.
- **Demo data**: the ledger is generated (`tools/screenshot-capture/seed_demo.py`)
  and the clock is pinned to 28 Dec 2026 so the calendar-year charts are full
  rather than flat-lining after the capture date.
- **Staged**: the Telegram *chrome* is a mockup — there is no bot token in the
  capture environment — but every bot reply in it is verbatim output from the
  app's own `telegram_commands.dispatch()` running against the demo profile.
- **Staged**: the AI assistant answers come from a local OpenAI-compatible stub
  (no provider key available here). The stub composes its reply from the real
  financial context the app sends it, so the figures quoted in the chat match
  the dashboard. Wording from a hosted model would differ.
