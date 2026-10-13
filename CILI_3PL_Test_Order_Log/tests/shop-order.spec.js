const { test } = require('@playwright/test');
const path = require('path');
require('dotenv').config();
function formatUtcTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}
const {
  loginToBackoffice,
  primeShopifyPasswordCache,
  openShop,
  closeStrayPages,
} = require('../helpers/backoffice-login');
const {
  switchCountry,
  addProductsToCart,
  goToCheckoutAndSelectAddress,
  fillPayment,
  captureLatestOrder,
} = require('../helpers/checkout-flow');

const scenarios = require('../data/group-a-scenarios');

const results = [];

test('Group A - all 50 single item scenarios', async ({ page, context }) => {
  test.setTimeout(1000 * 60 * 60 * 3); // 3 hours, to safely cover all 50 scenarios
  let backofficePage = await loginToBackoffice(page, context);
  await primeShopifyPasswordCache(backofficePage, context);

  for (const scenario of scenarios) {
    let status = 'Pass (order placed)';
    let orderNumber = 'NOT CAPTURED';
    let comments = '';
    let shopPage;

    // Self-heal: if the backoffice tab died since the last scenario
    // (session timeout, browser hiccup, etc.), log back in instead of
    // letting the whole hour-long run crash on one bad moment.
    if (backofficePage.isClosed()) {
      try {
        backofficePage = await loginToBackoffice(page, context);
        await primeShopifyPasswordCache(backofficePage, context);
      } catch (reloginErr) {
        results.push({
          testId: scenario.testId,
          country: scenario.country,
          warehouse: scenario.warehouse,
          products: scenario.products.join(' + '),
          shopifyOrderNumber: 'NOT CAPTURED',
          datePlaced: formatUtcTimestamp(new Date()),
          receivedByWarehouse: 'N/A - CILI team to verify',
          actualWarehouseResult: 'N/A - CILI team to verify',
          result: 'Fail',
          testedBy: process.env.TESTED_BY || 'Automation',
          comments: `Backoffice session lost and could not recover: ${reloginErr.message}`,
        });
        break;
      }
    }

    try {
      shopPage = await openShop(backofficePage, context);
      await switchCountry(shopPage, scenario.country);
      await addProductsToCart(shopPage, scenario.products);
      await goToCheckoutAndSelectAddress(shopPage, scenario.country);
      await fillPayment(shopPage);
      orderNumber = await captureLatestOrder(shopPage);
    } catch (err) {
      status = 'Fail';
      comments = String(err.message || err).slice(0, 300);
      if (shopPage && !shopPage.isClosed()) {
        const screenshotPath = path.join(__dirname, '..', `error-${scenario.testId}.png`);
        await shopPage.screenshot({ path: screenshotPath }).catch(() => { });
      }
    } finally {
      if (shopPage && !shopPage.isClosed()) {
        await shopPage.close().catch(() => { });
      }
    }

    results.push({
      testId: scenario.testId,
      country: scenario.country,
      warehouse: scenario.warehouse,
      products: scenario.products.join(' + '),
      shopifyOrderNumber: orderNumber,
      datePlaced: formatUtcTimestamp(new Date()),
      receivedByWarehouse: 'N/A - CILI team to verify',
      actualWarehouseResult: 'N/A - CILI team to verify',
      result: status,
      testedBy: process.env.TESTED_BY || 'Automation',
      comments,
    });

    // Everything below here used to be UNPROTECTED — any failure here
    // (e.g. backofficePage already closed) crashed the entire run instead
    // of just this one iteration. Now it's wrapped too.
    try {
      if (!backofficePage.isClosed()) {
        const backofficeOrigin = new URL(process.env.BACKOFFICE_URL).origin;
        await backofficePage.goto(`${backofficeOrigin}/ords/r/cbd/cili-backoffice/dashboard`);
        await backofficePage.getByRole('link', { name: 'Shop' }).waitFor({ state: 'visible', timeout: 20000 });
        await closeStrayPages(context, [page, backofficePage]);
      }
    } catch (cleanupErr) {
      results[results.length - 1].comments += ` | Cleanup issue: ${String(cleanupErr.message || cleanupErr).slice(0, 150)}`;
    }
  }
});

test.afterAll(async () => {
  const XLSX = require('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(results.map(r => ({
    'Test ID': r.testId,
    'Country': r.country,
    'Warehouse': r.warehouse,
    'Products': r.products,
    'Shopify Order Number': r.shopifyOrderNumber,
    'Date Placed': r.datePlaced,
    'Received by Warehouse (Y/N)': r.receivedByWarehouse,
    'Actual Warehouse Result': r.actualWarehouseResult,
    'Result (Pass/Fail)': r.result,
    'Tested By': r.testedBy,
    'Comments / Defect Ref': r.comments,
  })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Group A Results');
  XLSX.writeFile(workbook, path.join(__dirname, '..', 'group-a-results.xlsx'));
});