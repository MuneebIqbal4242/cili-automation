# CILI 3PL Test Order Automation

**Scope note**: this automation currently covers only the **"Standard order"**
scenarios (Order Type = Standard order, Test Group A — "Single items") from
the test sheet — 50 scenarios across 10 countries and 5 product categories,
all placed through the basic Shopify cart/checkout flow. It does NOT yet
cover Subscriptions, Enrollment, or any other order type/group from the
sheet.

Playwright automation that places real test orders through CILI's affiliate
backoffice + Shopify storefront, for testing order fulfillment and 3PL
routing.

Read `PROJECT_CONTEXT.md` first for full background on the business flow,
known site quirks, and what's confirmed vs. still open.

## Setup

1. **Install Node.js** (v18+) if you don't have it — nodejs.org

2. **Clone/copy this folder**, then open a terminal inside it and run:
   ```
   npm install
   npx playwright install
   ```

3. **Create your `.env` file**: copy `.env.example` to `.env`, and fill in
   the real `BACKOFFICE_USERNAME` and `BACKOFFICE_PASSWORD` (ask Icham or
   Mateen for these — they are intentionally NOT included in this package
   or committed to any repo).

   ```
   copy .env.example .env      (Windows)
   cp .env.example .env        (Mac/Linux)
   ```

## Running the script

Run only on Chromium, one worker at a time (recommended — avoids the
multi-browser confusion and keeps output readable):

```
npx playwright test tests/shop-order.spec.js --headed --project=chromium --workers=1
```

- `--headed` shows the browser window so you can watch it work
- Remove `--headed` to run invisibly in the background (faster, but you
  can't watch it)

### Testing with fewer scenarios first

Before running the full batch, it's strongly recommended to trim
`data/group-a-scenarios.js` down to 1–3 entries, confirm those run clean,
then restore the full list. Open that file and comment out or delete all
but the first few `{ ... }` objects in the array (keep the
`module.exports = [ ... ];` wrapper).

### Results

After the run finishes, check the project root for `group-a-results.xlsx`
— one row per scenario with the Shopify order number, timestamp, pass/fail
status, and any error details.

## Known issues (environment, not the script)

The CILI backoffice / Shopify storefront environment has shown
intermittent slowness at several points — this is NOT a script bug, it's
the site itself being unpredictable run to run:

- The country/currency selector widget sometimes takes several seconds
  longer than usual to become interactive after the page "finishes"
  loading
- The "Add to cart" sidebar occasionally doesn't open on the first click
- Checkout checkboxes (18+, Terms & Conditions) sometimes render late
- Payment processing has occasionally taken 60–90+ seconds

The script has generous retry logic and long timeouts built in to absorb
this, but scenarios can still occasionally fail due to environment
slowness rather than a real bug. If a scenario fails, check the
`Comments / Defect Ref` column in the results file — it has the exact
error. Screenshots (`error-*.png`, `debug-*.png`) are also saved to the
project root on failure for visual debugging.

## Project structure

```
.env.example              # copy to .env and fill in real credentials
data/
  group-a-scenarios.js    # the 50 test rows, generated from the client's sheet
  country-addresses.js    # country -> saved shipping address + currency label
  product-mapping.js      # category name -> real storefront product (confirmed with client)
helpers/
  backoffice-login.js     # login, affiliate search, Shop-click popup handling
  checkout-flow.js        # country switch, add to cart, address, payment, order capture
tests/
  shop-order.spec.js      # main test — loops all scenarios, writes results to .xlsx
PROJECT_CONTEXT.md        # full background — read this first
```

## Still to build

- Groups B–K (~141 more scenarios — subscriptions, enrollment, multi-item
  orders, returns, etc.) — not yet reviewed or built
- Enrollment flow needs a different login pattern entirely (new customer
  signup, delayed backoffice account activation)
