require('dotenv').config();

const STEP_DELAY_MS = 10000;
const MULTIPASS_WAIT_MS = 60000;

async function loginToBackoffice(page, context) {
  await page.goto(process.env.BACKOFFICE_URL);
  await page.getByRole('textbox', { name: 'Username' }).fill(process.env.BACKOFFICE_USERNAME);
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.BACKOFFICE_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();

  const affiliateSearch = page.getByRole('combobox', { name: 'Affiliate Search' });
  await affiliateSearch.waitFor({ state: 'visible', timeout: 20000 });
  await affiliateSearch.click();
  await affiliateSearch.fill(process.env.AFFILIATE_ID);

  const affiliateResult = page.getByText(new RegExp(process.env.AFFILIATE_ID));
  await affiliateResult.waitFor({ state: 'visible', timeout: 20000 });
  await affiliateResult.click();

  const openBackOfficeLink = page.getByRole('link', { name: 'Open BackOffice' });
  await openBackOfficeLink.waitFor({ state: 'visible', timeout: 20000 });

  const backofficePromise = context.waitForEvent('page', { timeout: 20000 });
  await openBackOfficeLink.click();
  const backofficePage = await backofficePromise;
  await backofficePage.waitForLoadState();
  await backofficePage.getByRole('link', { name: 'Shop' }).waitFor({ state: 'visible', timeout: 20000 });

  return backofficePage;
}

async function clickShopAndWaitForPopup(sourcePage, context, debugScreenshotPath, attempts = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const pagesBefore = new Set(context.pages());
    const popupPromise = context.waitForEvent('page', { timeout: 20000 });
    await sourcePage.getByRole('link', { name: 'Shop' }).click();
    try {
      const newPage = await popupPromise;
      await newPage.waitForURL((url) => !url.toString().includes('/multipass'), {
        timeout: MULTIPASS_WAIT_MS,
      }).catch(() => {});
      return newPage;
    } catch (err) {
      lastErr = err;
      for (const p of context.pages()) {
        if (!pagesBefore.has(p) && !p.isClosed()) {
          await p.close().catch(() => {});
        }
      }
    }
  }
  await sourcePage.screenshot({ path: debugScreenshotPath }).catch(() => {});
  throw new Error(
    `"Shop" link click did not open a new tab after ${attempts} attempts (saw ${context.pages().length} open page(s)). ` +
    `Saved ${debugScreenshotPath}. Original: ${lastErr.message}`
  );
}

async function primeShopifyPasswordCache(backofficePage, context) {
  const newPage = await clickShopAndWaitForPopup(backofficePage, context, 'debug-shop-click-no-popup.png');
  await newPage.waitForLoadState('domcontentloaded').catch(() => {});

  await newPage.waitForURL(/myshopify\.com/, { timeout: 20000 }).catch(() => {});
  await newPage.waitForLoadState('domcontentloaded').catch(() => {});

  if (newPage.url().includes('/password')) {
    const enterPasswordButton = newPage.getByRole('button', { name: 'Enter using password' });
    await enterPasswordButton.waitFor({ state: 'visible', timeout: 20000 });
    await enterPasswordButton.click();
    await newPage.getByRole('textbox', { name: 'Your password' }).fill('kwik');
    await newPage.getByRole('button', { name: 'Enter', exact: true }).click();

    // Just confirm navigation away from /password STARTED — do not wait
    // for the destination page to finish loading (it's slow and we don't
    // need it, we only need the password cookie, which is set on click).
    await newPage.waitForURL((url) => !url.toString().includes('/password'), { timeout: 15000 }).catch(() => {});
  }

  await newPage.close();
}

async function openShop(backofficePage, context) {
  const shopPage = await clickShopAndWaitForPopup(backofficePage, context, 'debug-openshop-no-popup.png');
  await shopPage.waitForLoadState().catch(() => {});

  const addToCartButton = shopPage.getByRole('button', { name: /Add to cart/i }).first();
  const appeared = await addToCartButton
    .waitFor({ state: 'visible', timeout: 60000 })
    .then(() => true)
    .catch(() => false);

  if (!appeared) {
    await shopPage.reload().catch(() => {});
    await shopPage.waitForLoadState().catch(() => {});
    try {
      await addToCartButton.waitFor({ state: 'visible', timeout: 60000 });
    } catch (err) {
      await shopPage.screenshot({ path: 'debug-page-not-ready.png' }).catch(() => {});
      throw new Error(`Shop page never became ready, even after reload. Current URL: ${shopPage.url()}. Original: ${err.message}`);
    }
  }

  return shopPage;
}

async function closeStrayPages(context, pagesToKeep) {
  const keep = new Set(pagesToKeep);
  for (const p of context.pages()) {
    if (!keep.has(p) && !p.isClosed()) {
      await p.close().catch(() => {});
    }
  }
}

module.exports = { loginToBackoffice, primeShopifyPasswordCache, openShop, closeStrayPages, STEP_DELAY_MS };