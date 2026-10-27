import { test as setup, expect } from '../../fixtures/test-fixtures';
import { AuthMessages, CustomerMobile } from '../../test-data/customers';
import { AUTH_FILE } from '../../utils/auth';
import { labelTest } from '../../utils/test-helpers';

const SIGN_IN_TIMEOUT = 5 * 60_000;

/**
 * Interactive sign-in in a visible browser. With a saved number (DEMO_MOBILE, set from the dashboard's Settings
 * page) the number is filled and the OTP requested automatically, so the person only types the OTP; without one
 * they type the number too. Only the resulting browser session is saved, to the git-ignored AUTH_FILE.
 */
setup('ACC-00 Sign in with your mobile number and OTP', async ({ loginPage, page }) => {
  setup.setTimeout(SIGN_IN_TIMEOUT + 60_000);
  await labelTest({ feature: 'Authentication', story: 'Customer sign in' });

  const showBanner = (text: string) =>
    page.evaluate((message) => {
      const id = 'automation-banner';
      const banner = document.getElementById(id) ?? document.body.appendChild(document.createElement('div'));
      banner.id = id;
      banner.textContent = message;
      banner.setAttribute(
        'style',
        'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:14px;text-align:center;' +
          'font:600 16px system-ui,sans-serif;background:#1d4ed8;color:#fff;pointer-events:none',
      );
    }, text);

  await setup.step('Open the login page', async () => {
    await loginPage.goto();
    await loginPage.expectLoaded();
  });

  const mobile = CustomerMobile;
  if (mobile) {
    const masked = `••••••${mobile.slice(-4)}`;
    await setup.step(`Request an OTP for the saved number ${masked}`, async () => {
      await loginPage.signIn(mobile);
      await expect(page.getByText(AuthMessages.invalidMobile, { exact: true }), 'saved DEMO_MOBILE was rejected').toBeHidden();
      await showBanner(`OTP sent to ${masked}. Type the OTP to finish signing in.`);
      console.log(`\n>>> OTP requested for ${masked}. Type the OTP in the Chrome window (5 minutes).\n`);
    });
  } else {
    await setup.step('Ask for the mobile number', async () => {
      await showBanner('Type your mobile number, click SIGN IN, then enter the OTP. (Save the number in dashboard Settings to skip this.)');
      console.log('\n>>> No saved number (DEMO_MOBILE). Type your mobile number and the OTP in the Chrome window (5 minutes).\n');
    });
  }

  await setup.step('Wait for the customer to finish signing in', async () => {
    await expect(page).not.toHaveURL(/\/login/, { timeout: SIGN_IN_TIMEOUT });
  });

  await setup.step('Save the signed-in session', async () => {
    await page.context().storageState({ path: AUTH_FILE });
    console.log(`>>> Signed in. Session saved to ${AUTH_FILE}.`);
  });
});
