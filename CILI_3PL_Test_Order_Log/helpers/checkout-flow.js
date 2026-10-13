require('dotenv').config();
const countryAddresses = require('../data/country-addresses');
const productMapping = require('../data/product-mapping');

// The flag button does NOT exist until the current country/language
// display is clicked first. Anchored regex ensures we click the actual
// small widget, not a large ancestor div.
async function revealFlagButton(shopPage) {
  const flagButton = shopPage.getByRole('button', { name: /^flag/ });
  const alreadyVisible = await flagButton.isVisible().catch(() => false);
  if (alreadyVisible) return flagButton;

  const trigger = shopPage.locator('div').filter({
    hasText: /^[A-Za-z][A-Za-z\s]*\s*\((?:\$|€|£|kr|zł|CHF)\s*\)\s*(?:English)?$/,
  }).first();
  await trigger.waitFor({ state: 'visible', timeout: 30000 });
  await trigger.click();

  await flagButton.waitFor({ state: 'visible', timeout: 15000 });
  return flagButton;
}

// Full sequence: open widget -> pick country -> click Change -> the page
// reloads on its own (this is expected and normal, not an error) -> wait
// for that reload to settle -> confirm products are back -> return,
// letting the caller proceed straight to add-to-cart.
async function switchCountry(shopPage, targetCountry, attempts = 3) {
  const target = countryAddresses[targetCountry];
  if (!target) throw new Error(`No address data for country: ${targetCountry}`);

  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const flagButton = await revealFlagButton(shopPage);
      await flagButton.click();

      const currencySymbol = target.flagLabel.match(/\(\s*([^\s)]+)\s*\)/)[1];
      const escapedSymbol = currencySymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const countryOption = shopPage.locator('div').filter({
        hasText: new RegExp(`^${targetCountry}\\(${escapedSymbol}\\)$`),
      });
      await countryOption.waitFor({ state: 'visible', timeout: 20000 });
      await shopPage.waitForTimeout(800);
      await countryOption.click({ timeout: 10000 });

      const changeButton = shopPage.getByRole('button', { name: 'Change' });
      await changeButton.waitFor({ state: 'visible', timeout: 10000 });
      await changeButton.click();

      // The page reloads automatically here to apply the new country —
      // this IS the expected next step, not a failure. Wait it out.
      await shopPage.waitForLoadState('load', { timeout: 60000 }).catch(() => { });
      await shopPage.getByRole('button', { name: /Add to cart/i }).first()
        .waitFor({ state: 'visible', timeout: 45000 });

      return; // success — caller proceeds to addProductsToCart next
    } catch (err) {
      lastErr = err;
      await shopPage.keyboard.press('Escape').catch(() => { });
      await shopPage.waitForTimeout(1000);
    }
  }

  const screenshotPath = require('path').join(__dirname, '..', `error-country-switch-${targetCountry}.png`);
  await shopPage.screenshot({ path: screenshotPath }).catch(() => { });
  throw new Error(
    `Failed to switch country to ${targetCountry} after ${attempts} attempts. Saved ${screenshotPath}. Original: ${lastErr.message}`
  );
}

async function addProductsToCart(shopPage, productCategories) {
  for (let i = 0; i < productCategories.length; i++) {
    const category = productCategories[i];
    const productName = productMapping[category] || category;
    const isLast = i === productCategories.length - 1;

    await shopPage.getByRole('button', { name: new RegExp(`Add to cart.*${productName}`, 'i') }).click();

    const closeButton = shopPage.getByRole('button', { name: 'Close' });
    await closeButton.waitFor({ state: 'visible', timeout: 20000 });

    if (!isLast) {
      await closeButton.click();
    }
  }
}

async function goToCheckoutAndSelectAddress(shopPage, country) {
  const addressData = countryAddresses[country];

  await shopPage.getByRole('button', { name: 'Check out' }).click();

  const shipToButton = shopPage.getByRole('button', { name: 'Ship to' });
  await shipToButton.waitFor({ state: 'visible', timeout: 20000 });
  await shipToButton.click();

  const addressRadio = shopPage.getByRole('radio', { name: addressData.addressRadioText });
  await addressRadio.waitFor({ state: 'visible', timeout: 45000 });

  const alreadySelected = await addressRadio.isChecked().catch(() => false);
  if (!alreadySelected) {
    await addressRadio.check();
  }

  await shipToButton.click();

  await addressRadio.waitFor({ state: 'hidden', timeout: 5000 }).catch(async () => {
    await shopPage.keyboard.press('Escape');
  });

  await shopPage.getByRole('checkbox', { name: /18 years/i }).check();
  await shopPage.getByRole('checkbox', { name: /Terms/i }).check();

  const sameAsShipping = shopPage.getByRole('radio', { name: 'Same as shipping address' });
  if (await sameAsShipping.isVisible().catch(() => false)) {
    await sameAsShipping.check();
  }

  // Deliberate pause after checking the boxes — lets the checkout page
  // fully settle before clicking Continue to Payment, since this varies
  // a lot in how long it takes to load (sometimes instant, sometimes slow).
  await shopPage.waitForTimeout(35000);

  await shopPage.getByRole('button', { name: /Continue to Payment/i }).click();
}

async function fillPayment(shopPage) {
  await shopPage.waitForURL(/checkout\.cili\.sandbox/, { timeout: 90000 });

  const payWithCard = shopPage.getByTestId('payment-method-worldpay-access-card');
  await payWithCard.waitFor({ state: 'visible', timeout: 20000 });
  await payWithCard.click();
  await shopPage.getByTestId('access-add-new-card-button').click();

  const panField = shopPage.locator('iframe[name="access-worldpay-pan"]').contentFrame()
    .getByRole('textbox', { name: 'Card number' });
  await panField.waitFor({ state: 'visible', timeout: 20000 });
  await panField.fill(process.env.TEST_CARD_NUMBER);
  await shopPage.locator('iframe[name="access-worldpay-expiry"]').contentFrame()
    .getByRole('textbox', { name: 'Expiry date' }).fill(process.env.TEST_CARD_EXPIRY);
  await shopPage.locator('iframe[name="access-worldpay-cvv"]').contentFrame()
    .getByRole('textbox', { name: 'Security code' }).fill(process.env.TEST_CARD_CVC);
  await shopPage.getByTestId('access-card-name-input').fill('Automation Testing');
  await shopPage.getByTestId('submit-button').click();

  await shopPage.waitForURL(/thank-you/, { timeout: 150000 });
}

async function captureLatestOrder(shopPage) {
  const viewAccountLink = shopPage.getByRole('link', { name: 'View account' });
  await viewAccountLink.waitFor({ state: 'visible', timeout: 20000 });
  await viewAccountLink.click();

  const firstOrderLink = shopPage.getByRole('link', { name: /Order number CILI#/ }).first();
  await firstOrderLink.waitFor({ state: 'visible', timeout: 20000 });
  const orderText = await firstOrderLink.textContent();
  const orderNumber = orderText?.match(/CILI#\d+/)?.[0] || 'NOT CAPTURED';
  return orderNumber;
}

module.exports = {
  switchCountry,
  addProductsToCart,
  goToCheckoutAndSelectAddress,
  fillPayment,
  captureLatestOrder,
};