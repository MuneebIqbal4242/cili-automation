# CILI 3PL Test Order Automation — Project Context

## What this project does
Playwright automation that places real test orders through CILI's affiliate
backoffice + Shopify storefront, to validate order creation and 3PL/warehouse
routing across many country/product combinations. Built incrementally by
recording real user sessions with `npx playwright codegen`, then converting
confirmed selectors into reusable helper functions.

## The business flow (what a human does manually)
1. Log into **CBD Admin** (`https://cbd.kwik.dev/ords/r/cbd/cbd-admin/login`)
   using an internal admin account (currently Icham's credentials).
2. Search for a specific **affiliate ID** (currently `1167091`) in the
   "Affiliate Search" box. A dynamic text result appears — must be CLICKED,
   pressing Enter alone does not select it.
3. Click **"Open BackOffice"** — opens that affiliate's CILI backoffice in a
   new browser tab (`cili-backoffice/dashboard`).
4. From the backoffice, click **"Shop"** in the nav bar. This opens the
   Shopify storefront (`cili-prod.myshopify.com`) in ANOTHER new tab.
5. **Known quirk**: the FIRST time in a session, this Shop click lands on
   Shopify's password-gate page (`/password`) instead of the shop page,
   because the storefront isn't public — it needs a shared password
   (`kwik`) once per browser session. After entering it, Shopify redirects
   to its HOME page (not the shop collection) — this is a one-time
   annoyance. Close that tab, go back to the backoffice tab, click "Shop"
   again — THIS time it goes straight to the shop collection page, because
   the password cookie is now cached in the browser. This priming only
   needs to happen ONCE per automation run, not once per order.
6. On the shop page, switch the **country/currency selector** (top bar,
   a "flag" button showing something like "flag France ( € )") to the
   target country for this test scenario. This reloads the product list
   with region-appropriate pricing/availability.
7. Click **"Add to cart"** on the product(s) needed for this scenario. Each
   click opens a cart sidebar. If adding MORE than one product, close the
   sidebar (X / "Close" button) before adding the next one. On the LAST
   product, leave the sidebar open and click **"Check out"** directly from it.
8. On the checkout page, click **"Ship to"** to open the address panel, and
   select the saved address radio button matching the scenario's country
   (all 10 countries already have saved addresses on this test account —
   no new-address entry needed). Close the panel.
9. Check the **18+ confirmation** and **Terms & Conditions** checkboxes.
   If a "Same as shipping address" billing radio appears, check it too.
10. Click **"Continue to Payment"** — redirects to a sandbox payment
    processor (`checkout.cili.sandbox.u-payments.co`), using Worldpay's
    hosted iframe fields for card number / expiry / CVC (each field is
    inside its OWN iframe — `iframe[name="access-worldpay-pan"]` etc.).
    Test card: `4111 1111 1111 1111`, any future expiry, any CVC.
11. After payment, lands on a "thank-you" confirmation page. Click **"View
    account"** to see the order list — the FIRST row is always the most
    recently placed order (order numbers increment sequentially, e.g.
    CILI#3008 → CILI#3011 → CILI#3012), which is how we identify and
    capture the order number we just created.

## Key business decisions already confirmed with the client (Icham / Ann Marie)
- **Warehouse/3PL verification is OUT OF SCOPE for this automation.** The
  CILI team manually verifies warehouse receipt themselves. The script does
  NOT need to check fulfillment status — those result columns are marked
  "N/A - CILI team to verify".
- **Product name mapping is CONFIRMED.** The test sheet lists products
  generically ("Swish", "Spray", "Facial Mist") but the real store has
  multiple SKUs per category. Confirmed fixed mapping (see
  `data/product-mapping.js`): Swish → CILI CBD/CBG Swish, Spray → CILI
  BOOST Spray, Facial Mist → CILI FACIAL MIST REFILL.
- **Single backoffice account for all tests**: affiliate ID 1167091.
- **Sandbox payment was previously broken** (old code issue) — confirmed
  FIXED by the client as of Sept 2026.
- **Enrollment flow** (separate from Shop): after a new customer completes
  enrollment, there's a delay (roughly 5–15 min, unconfirmed exact number)
  before their new backoffice account becomes usable/loggable-into. Not yet
  automated — will need a wait/retry pattern when we build it.

## Project structure
```
/
├── .env                          # credentials, test card, affiliate ID (NEVER commit)
├── .gitignore                    # excludes node_modules, .env, test artifacts
├── data/
│   ├── group-a-scenarios.js      # 50 test rows (Group A: single/double item orders),
│   │                              generated directly from the client's Excel sheet
│   ├── country-addresses.js      # country -> saved address radio text + flag label
│   └── product-mapping.js        # category name -> real storefront product name
├── helpers/
│   ├── backoffice-login.js       # login, affiliate search, password-cache priming, openShop
│   └── checkout-flow.js          # country switch, add to cart, address, payment, capture order
└── tests/
    └── shop-order.spec.js        # main test: loops all Group A scenarios end-to-end,
                                    writes results to group-a-results.xlsx in project root
```

## Current status (as of this handoff)
- Group A (50 "single items" scenarios: single/double product orders across
  10 European countries) is the ONLY group built so far, out of ~191 total
  scenarios across 11 groups (A–K) in the client's full test sheet.
- The full end-to-end flow (login → shop → checkout → payment → order
  capture) has been PROVEN working manually via `codegen` recordings
  multiple times, with real order numbers captured (e.g. CILI#3008,
  CILI#3011, CILI#3012, CILI#3038).
- The automated script (running the loop unattended) has been tested with
  reduced scenario counts (1–3 at a time) and is still being hardened —
  we just moved from fixed `waitForTimeout()` delays to dynamic
  `waitFor({ state: 'visible' })` waits on real page elements, to avoid
  both false failures (page slower than the fixed wait) and wasted time
  (page faster than the fixed wait).
- Known trouble spots that needed fixing along the way: country selector
  sometimes not clickable if interacted with too early; the "Ship to"
  address panel behaving inconsistently when the target address is
  already the default selection (France).

## What's NOT built yet
- Groups B through K (~141 more scenarios) — likely include subscriptions,
  enrollment (new customer signup, different login flow entirely),
  multi-quantity orders, returns/reruns. Not yet reviewed in detail.
- Any retry/error-recovery logic beyond basic try/catch per scenario.
- GitHub repository setup (client confirmed they use GitHub, access being
  arranged).

## Environment / credentials reference (also in .env)
- Backoffice/admin login URL: `https://cbd.kwik.dev/ords/r/cbd/cbd-admin/login`
- Admin username: `Icham` / password: `CiliKwikA1`
- Affiliate ID under test: `1167091`
- Shopify storefront password: `kwik`
- Test card: `4111 1111 1111 1111`, any future expiry, any CVC
