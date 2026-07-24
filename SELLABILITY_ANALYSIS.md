# Fintrax — Sellability Analysis & Launch Plan

_Analysis date: 2026-07-24. Assesses what it takes to sell Fintrax as a commercial one-time-purchase Windows desktop app. Based on a full code audit, competitive market research, and a go-to-market/legal review._

---

## TL;DR

**The engine is done and done well. The product isn't finished.**

Fintrax is a genuinely well-engineered app — a correct, tested finance backend (163 tests), a sophisticated offline encryption vault, and a working Tauri desktop pipeline. But between "works on my machine" and "a stranger pays for it" sit a handful of blockers that would each, alone, sink a paid listing:

1. **License is GPL-v3** — legally lets any buyer redistribute your source for free. Incompatible with a paid proprietary product.
2. **Currency is hardcoded to Serbian Dinar (RSD)** — every amount, axis, and total shows "RSD" with no setting. Unsellable outside Serbia.
3. **Empty README + cold first-run** — a buyer opens it to a blank dashboard and can't even add a transaction until they manually create a category.
4. **Unsigned installer** — Windows SmartScreen "unknown publisher" warning on every install.

Fix ~6 things (≈2–3 focused weeks) and this is a credible **$29 one-time** product. Not $10 — **$10 actively signals "hobby project" and leaves money on the table** (see Pricing).

**Engineering maturity: ~80%. Product maturity: ~40%.**

---

## 1. What's already built (verified in code)

Every feature in the dev notes is real, wired to a route, and tested. Nothing is stubbed.

| Area | Status |
|---|---|
| JWT auth + refresh, multi-account, per-user data isolation | ✅ solid (dedicated isolation test class) |
| Master-password vault — envelope encryption (scrypt KEK + recovery key, DEK in memory only) | ✅ sophisticated, better than most indie apps |
| Transactions (add/edit/search/filter/delete), categories | ✅ |
| Budgets + alerts, recurring (pause/resume/skip/edit) | ✅ |
| Savings accounts + monthly interest accrual (atomic, `select_for_update`) | ✅ |
| Trading 212 portfolio sync (cached, FX-converted) | ✅ |
| CSV import/export (capped 5000 rows) | ✅ |
| Receipt scanning (RapidOCR + LLM extraction) | ✅ |
| Multi-provider LLM chat (OpenAI / Anthropic / Ollama / LM Studio, bring-your-own-key) | ✅ |
| Analytics (net worth, income/expense, category trends, savings rate) | ✅ |
| API-key encryption at rest (Fernet) | ✅ |
| Tauri desktop packaging + reproducible build (`desktop/build.md`) | ✅ |

**Strengths that are hard to buy:** the security architecture (vault + per-user isolation + key encryption), the test suite (163 methods / ~2,050 lines), typed error hierarchies mapped to clean HTTP responses, and the offline-first, bring-your-own-AI-key design. This is the differentiated, hard-to-replicate part.

---

## 2. Pricing — charge $29, not $10

The research is unambiguous: **$10 is too low and works against you.**

- **Sub-$10 is a documented trap.** On Gumroad, products under $10 are ~35% of listings but capture ~0.8% of revenue; the $30–49 band converts ~28% *better* than sub-$10. Low price reads as low value and attracts refund-prone buyers.
- **Fee drag is brutal at $10.** Flat per-sale fees eat ~21% of a $10 sale on Gumroad (~$2.10) vs ~$1.00 on Lemon Squeezy. Above $20 the percentage improves sharply.
- **Your anchor is spectacular.** You compete against **YNAB $109/yr, Monarch $100–199/yr, Copilot $95/yr, Quicken $35–100/yr**. Against those, **"$29 once, then free forever"** is an overwhelming lifetime-cost story. The one paid local-first peer, **Moneydance, sells at $49.99 one-time — with no AI.**

**Recommendation:**
- **Launch price: $19 (intro) → settle at $29 one-time.** Optionally "pay-what-you-want, min $19."
- Reserve a free/lite tier only as a deliberate funnel, not as the main SKU.
- A separate **developer/source-code license ($49–199)** is a reasonable *secondary* channel (the AI receipt-scan + T212 code is what's worth paying for), but sell the packaged app to end-users as the primary business.

---

## 3. Positioning

**"Own your finances — and your data. Pay once. No subscription, no cloud, AI on your terms."**

The defensible wedge is a combination no subscription incumbent can copy without abandoning their business model:

- **Local-first / offline** — "your financial data never leaves your PC." Directly answers the #1 fear (handing bank credentials to Monarch/Plaid).
- **Bring-your-own-AI-key — or 100% offline with Ollama** — no vendor sees your spending; no per-month AI upcharge. Copilot/Cleo only offer AI by taking your data.
- **Windows-native** — fills the gap Copilot (Apple-only) and Banktivity (Mac-only) leave wide open.
- **Trading 212 sync** — narrow but real; nobody in the one-time-purchase lane has it.

**Competitive reality:** the paid competition is thin (basically Moneydance), but the *free* competition is strong (Actual Budget, GnuCash, HomeBank, Money Manager Ex). Your price must beat "free and private" — the **AI features + T212 + zero-setup polished UI** are what justify it. Position against free tools on "no Docker, no self-hosting, AI built in"; against Moneydance on "AI + modern UI, cheaper."

**Ideal buyers:** privacy-conscious ex-Mint / anti-subscription users; Windows users left out by Apple-only apps; Trading 212 investors; AI-curious tinkerers who already run Ollama or have an API key.

**Top objections to preempt:** (1) unsigned-app SmartScreen warning → sign it; (2) trust in an unknown solo dev with financial data → publish a privacy statement + refund guarantee; (3) no automatic bank sync → reframe via AI receipt scan + CSV import, and sell the privacy trade-off as intentional.

---

## 4. Gap analysis

### 🔴 MUST FIX — blockers before charging anything

| # | Gap | Where | Effort |
|---|---|---|---|
| 1 | **Relicense off GPL-v3** to a proprietary/commercial EULA. GPL lets buyers legally redistribute your source free. Confirm all deps allow closed-source distribution (Django BSD, DRF BSD, React MIT, RapidOCR/onnxruntime OK — audit to be sure). | `LICENSE` | 0.5 day |
| 2 | **Make currency configurable.** Hardcoded `BASE_CURRENCY="RSD"` and `DEFAULT_CURRENCY="RSD"` lock the whole UI to Dinar. Add a currency setting; plumb through `formatCurrency`, chart axes, and `fx.to_base`. | `backend/api/fx.py:18`, `frontend/src/utils/formatCurrency.js:1` | 2–3 days |
| 3 | **Real README + first-run experience.** README is 17 bytes. New users hit a blank dashboard and *can't add a transaction until they create a category first* (no seeding). Seed a starter category set (or an onboarding step) + write product docs/screenshots. | `README.md`, category seeding (none exists), `AddTransaction.jsx` | 1–2 days |
| 4 | **Code-sign the installer + exe.** Unsigned = SmartScreen "unknown publisher" on every install — a top reason paying buyers abandon. Use **Azure Trusted Signing (~$10/mo)**. | `src-tauri/tauri.conf.json`, `.spec` `codesign_identity` | 0.5 day + setup |
| 5 | **Enforce password strength at registration.** `UserSerializer.create` calls `create_user` without `validate_password` — you can register with password `"1"`. That password also derives the vault KEK, so a weak one directly weakens the at-rest encryption. | `backend/api/serializers.py:26-37` | 0.5 day |
| 6 | **Ship auto-update (Tauri updater).** Without it you cannot patch #5 or anything else after a sale — buyers are frozen on their version. | `src-tauri/tauri.conf.json` (no `updater` block) | 1 day |

### 🟡 SHOULD FIX — quality/trust before scaling

7. **Transaction type/category validation gap** — `TransactionSerializer` doesn't enforce that `type` matches `category.type`, but balance is derived from `category.type`. The API would accept `type=income` on an expense category and silently corrupt the running balance. (`RecurringTransactionSerializer` already enforces this — make them consistent.) `serializers.py:241-259`.
8. **Fix stale/false security docs** — `desktop/build.md:80-81` still says secrets are "stored plaintext," contradicting the shipped vault. Also: only the 4 API-key columns are encrypted, **not** transaction data. Market honestly ("API keys encrypted"), don't claim "your finances are encrypted."
9. **Opt-in crash reporting** — with no telemetry and no auto-update, field crashes are silent and unfixable. Add opt-in Sentry so you can see what breaks.
10. **`console=False` for the sidecar** (`.spec:103` is `console=True`) — risk of a black console window flashing on launch.
11. **Trim the ~132 MB installer** — the entire OCR stack (`onnxruntime` + `opencv` + models) is bundled just for receipt scanning. Make it optional or lazy-download the models.
12. **Idle vault re-lock** — DEK stays in memory until app close; add an inactivity timeout for a finance app.

### 🟢 NICE-TO-HAVE — polish

13. Branding/version consistency — repo/README say "finance-tracker", `package.json` is `"vite-test"` / `0.0.0`, tauri says `1.0.0`. Unify on "Fintrax" + a real version.
14. Wrong Settings nav icon (`App.jsx:60` uses `faCalendar`), leftover `console.log` (`ProtectedRoute.jsx:45`), duplicate URL name (`urls.py:33`).
15. Frontend tests + CI (backend is well-covered; frontend has none).
16. Unify locale — US date format (`MM/dd/yyyy`) mixed with RSD currency; resolve once currency is configurable. Consider multi-currency for international appeal.

---

## 5. Go-to-market

### Channel — own landing page + Lemon Squeezy (primary)

- **Lemon Squeezy: 5% + $0.50, Merchant of Record** — handles global VAT/sales tax for you (no compliance nightmare), self-serve signup, and **built-in License Key API** (activate/validate/deactivate) so payments + licensing are one integration. ~$1.00 fee on a $10 sale vs Gumroad's ~$2.10. (Paddle is the fallback if LS rejects you or you want deeper invoicing.)
- **Microsoft Store (MSIX) — strong secondary, add after launch.** Free code signing, free auto-update, **zero SmartScreen warnings**, and organic discovery. Downside: a finance app requires a **company** developer account + IARC age rating + EU DSA business verification — more paperwork, so not the launch-day-only channel.
- **Skip:** itch.io (games audience, off-brand), and Stripe-alone (leaves you as Merchant of Record = tax liability everywhere).

### Code signing

- **Azure Trusted Signing (~$10/mo)** is the 2026 best-value pick — no hardware token, CI-friendly, individuals can now apply (US/Canada/EU/UK). Since March 2024, **EV certs no longer instantly bypass SmartScreen**, so don't overpay for EV. Reputation now builds organically with downloads.
- Unsigned isn't a hard blocker (users can still click through), but it hurts conversion for a *financial* app and resets trust on every release. Sign it.

### Licensing / DRM

- **Don't over-invest at $29.** Anti-piracy has steep diminishing returns — aim for a speed-bump, not a fortress (≤1–2 days).
- **Lemon Squeezy License Keys** (simplest, since you're already using LS — but hard-code and verify `store_id`/`product_id`/`variant_id` or any LS key could unlock your app), **or** a **homemade Ed25519 signed-license** (one-time online activation → offline verification with an embedded public key) which fits an offline-first app cleanly. Don't phone home on every launch.

### Legal — four documents (finance app = extra care)

1. **EULA** — license grant, prohibited use, limitation of liability, "as is"/no warranty.
2. **Privacy Policy** — yes, even though data is local: your **AI features send data to third-party providers** (user's key) and **T212** pulls brokerage data; GDPR/CCPA apply by the *user's* location. Disclose what leaves the device and to whom (your exposure is lower because you don't hold the data — but you must disclose the flows).
3. **Terms of Use.**
4. **Prominent Financial/AI disclaimer (the critical one)** — placed *near the AI output*: "not a financial/investment advisor; educational/informational only; not personalized advice; past performance ≠ future results." Add clauses: not affiliated with/endorsed by Trading 212 (user responsible for their API key + T212's personal-use-only terms; recommend IP-restricting the key), and a disclaimer for user-supplied AI keys (third-party cost/availability/output).

A **pure tracker that never holds or moves money** generally needs no money-transmitter license; the real risk is FTC deceptive-practices if the AI gives specific investment advice — keep it framed as educational and backed by the disclaimer. Templates (Termly/iubenda ~$0–200) cover EULA/Privacy/Terms; have a lawyer sanity-check the financial disclaimer.

### Trust infrastructure buyers expect

Landing page (value prop + pricing + FAQ + legal links), **screenshots + a 60–90s demo video** (biggest conversion lever), a clear **14–30 day refund policy** (MoRs return their fees on refunds; Gumroad doesn't), a public changelog, the signed auto-updater, a support email, and a few beta testimonials.

---

## 6. Phased roadmap

**Phase 0 — Unblock (must-fix, ~1.5–2 weeks)**
Relicense → configurable currency → registration password validation → type/category validation fix → real README + seeded categories/onboarding. _Deliverable: an app a stranger can install and use in a currency they recognize._

**Phase 1 — Shippable installer (~1 week)**
Azure Trusted Signing set up + build signs installer & exe → Tauri auto-updater wired → `console=False` → version/branding cleanup → opt-in crash reporting. _Deliverable: a signed, updatable, patchable 1.0._

**Phase 2 — Commerce & legal (~1 week, parallelizable)**
Lemon Squeezy product + license-key validation in-app → 4 legal docs → landing page + screenshots + demo video → refund policy + support email + changelog.

**Phase 3 — Launch**
Beta with a handful of users (bugs + testimonials) → finalize price ($19 intro → $29) → launch on Show HN / Product Hunt / Indie Hackers / relevant subreddits, leading with the demo and "data stays local."

**Phase 4 — Post-launch (optional)**
Microsoft Store (MSIX) as a second channel; trim the 132 MB; idle re-lock; multi-currency; frontend tests + CI.

---

## 7. Launch checklist (code on disk → first paid sale)

- [ ] Relicense off GPL-v3 to a proprietary EULA; audit dependency licenses
- [ ] Make base currency a user setting (backend + frontend + charts)
- [ ] Seed starter categories / add first-run onboarding
- [ ] Enforce `validate_password` at registration
- [ ] Fix transaction type/category validation
- [ ] Write a real README (description, screenshots, install, support)
- [ ] Azure Trusted Signing account + sign installer & exe
- [ ] Wire Tauri signed auto-updater; set `console=False`; fix version/branding
- [ ] Add opt-in crash reporting
- [ ] Lemon Squeezy account + product + in-app license validation
- [ ] Draft 4 legal docs (EULA, Privacy, Terms, Financial/AI + T212/AI-key disclaimer)
- [ ] Landing page + screenshots + 60–90s demo video + refund policy + changelog + support email
- [ ] Beta test; collect testimonials
- [ ] Set price ($19 intro → $29); launch

---

## 8. Cost summary

| Item | Cost |
|---|---|
| Azure Trusted Signing | ~$10/mo |
| Domain | ~$10–15/yr |
| Lemon Squeezy | Free until you sell (5% + $0.50/sale) |
| Legal templates (Termly/iubenda) | $0–200 (+ optional lawyer review of the finance disclaimer, $500–2,000) |
| Landing page hosting (Netlify/Vercel/GH Pages) | Free |
| **Total upfront** | **~$10–30/mo + ~$15/yr + $0–500 optional legal** |

Low cash, mostly your time. The gating factor is engineering effort on the Phase 0/1 must-fixes, not money.

---

## 9. Bottom line

The hard, expensive part — a correct, secure, tested finance engine with a clever offline encryption vault and a working desktop build — is **already done**. What remains is the last mile that turns an engineer's project into a product: a compatible license, a currency people recognize, onboarding, a signed and updatable installer, and a storefront with the legal docs a finance app needs.

Ship it today and it embarrasses you on license, locale, and SmartScreen before a buyer sees a single feature. Spend ~2–3 focused weeks on Section 4's must-fixes and Section 6's Phase 0–2, price it at **$29 one-time**, and you have a credible, differentiated product in a lane where the only paid competitor charges $49.99 and has no AI.
