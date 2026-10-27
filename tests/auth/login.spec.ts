import { Severity, severity } from 'allure-js-commons';
import { test, expect } from '../../fixtures/test-fixtures';
import { AuthMessages, PhoneNumbers, createRegistration } from '../../test-data/customers';
import { labelTest } from '../../utils/test-helpers';

// Sign-in is mobile number + OTP. These tests cover everything up to the OTP request and never send one.
test.describe('Login page', { tag: '@regression' }, () => {
  test.beforeEach(async ({ loginPage }) => {
    await labelTest({ feature: 'Authentication', story: 'Login page' });
    await loginPage.goto();
  });

  test('AUTH-01 Shows the sign in and create account tabs', { tag: '@smoke' }, async ({ loginPage }) => {
    await severity(Severity.CRITICAL);

    await test.step('Verify the sign in form', async () => {
      await loginPage.expectLoaded();
      await expect(loginPage.phoneInput).toHaveAttribute('placeholder', '+91 XXXXX XXXXX');
      await expect(loginPage.signInButton).toBeVisible();
    });
  });

  const rejectedNumbers = [
    { title: 'AUTH-02 Rejects an empty mobile number', phone: PhoneNumbers.empty },
    { title: 'AUTH-03 Rejects a mobile number that is too short', phone: PhoneNumbers.tooShort },
  ];

  for (const { title, phone } of rejectedNumbers) {
    test(title, async ({ loginPage, page }) => {
      await test.step(`Submit "${phone}"`, async () => {
        await loginPage.signIn(phone);
      });

      await test.step('Verify the validation message and that no OTP step appears', async () => {
        await loginPage.expectError(AuthMessages.invalidMobile);
        await expect(page).toHaveURL(/\/login/);
        await expect(loginPage.signInButton).toBeVisible();
      });
    });
  }

  test('AUTH-04 Shows every registration field', async ({ loginPage }) => {
    await test.step('Open the create account tab', async () => {
      await loginPage.openCreateAccount();
    });

    await test.step('Verify the registration form', async () => {
      for (const field of [
        loginPage.firstNameInput,
        loginPage.lastNameInput,
        loginPage.emailInput,
        loginPage.registerPhoneInput,
        loginPage.referralInput,
      ]) {
        await expect(field).toBeVisible();
      }
      await expect(loginPage.emailInput).toHaveAttribute('type', 'email');
      await expect(loginPage.createAccountButton).toBeVisible();
    });
  });

  test('AUTH-05 Requires a first name to create an account', async ({ loginPage }) => {
    await test.step('Submit an empty registration form', async () => {
      await loginPage.openCreateAccount();
      await loginPage.createAccountButton.click();
    });

    await test.step('Verify the first name error', async () => {
      await loginPage.expectError(AuthMessages.firstNameRequired);
    });
  });

  test('AUTH-06 Clears the first name error once a first name is entered', async ({ loginPage, page }) => {
    const registration = createRegistration();

    await test.step('Trigger the first name error', async () => {
      await loginPage.openCreateAccount();
      await loginPage.createAccountButton.click();
      await loginPage.expectError(AuthMessages.firstNameRequired);
    });

    await test.step('Enter a first name and resubmit without a phone number', async () => {
      await loginPage.fillRegistration({ firstName: registration.firstName });
      await loginPage.createAccountButton.click();
    });

    await test.step('Verify the first name error is gone and the account was not created', async () => {
      await expect(page.getByText(AuthMessages.firstNameRequired, { exact: true })).toBeHidden();
      await expect(page).toHaveURL(/\/login/);
    });
  });
});

test.describe('Sign in dialog', { tag: '@regression' }, () => {
  test.beforeEach(async ({ homePage }) => {
    await labelTest({ feature: 'Authentication', story: 'Sign in dialog' });
    await homePage.goto();
    await homePage.expectLoaded();
  });

  test('AUTH-07 Opens from the header account icon', { tag: '@smoke' }, async ({ homePage }) => {
    await test.step('Click the account icon', async () => {
      await homePage.accountIcon.click();
    });

    await test.step('Verify the mobile number sign in dialog', async () => {
      await homePage.signInDialog.expectOpen();
      await expect(homePage.signInDialog.countryCode).toBeVisible();
      await expect(homePage.signInDialog.termsLink).toBeVisible();
      await expect(homePage.signInDialog.privacyLink).toBeVisible();
    });
  });

  test('AUTH-08 Keeps "Get OTP" disabled until a mobile number is entered', async ({ homePage }) => {
    await test.step('Open the dialog', async () => {
      await homePage.accountIcon.click();
      await homePage.signInDialog.expectOpen();
    });

    await test.step('Verify Get OTP is disabled for an empty number', async () => {
      await expect(homePage.signInDialog.mobileInput).toHaveValue('');
      await homePage.signInDialog.expectGetOtpDisabled();
    });
  });

  test('AUTH-09 Closes when the backdrop is clicked', async ({ homePage }) => {
    await test.step('Open the dialog', async () => {
      await homePage.accountIcon.click();
      await homePage.signInDialog.expectOpen();
    });

    await test.step('Click outside and verify the dialog closes', async () => {
      await homePage.signInDialog.dismiss();
      await expect(homePage.logoLink).toBeVisible();
    });
  });

  // The next tests type into the field but never click "Get OTP", so no SMS is sent.
  test('AUTH-10 Accepts digits only in the mobile number field', async ({ homePage }) => {
    const dialog = homePage.signInDialog;

    await test.step('Open the dialog', async () => {
      await homePage.accountIcon.click();
      await dialog.expectOpen();
    });

    await test.step('Type letters mixed with digits', async () => {
      await dialog.mobileInput.pressSequentially('abc12');
    });

    await test.step('Verify only the digits are kept', async () => {
      await expect(dialog.mobileInput).toHaveValue('12');
    });
  });

  test('AUTH-11 Enables "Get OTP" for a 10-digit number', async ({ homePage }) => {
    const dialog = homePage.signInDialog;

    await test.step('Open the dialog and type 5 digits', async () => {
      await homePage.accountIcon.click();
      await dialog.expectOpen();
      await dialog.mobileInput.pressSequentially(PhoneNumbers.wellFormed.slice(0, 5));
      await dialog.expectGetOtpDisabled();
    });

    await test.step('Complete a 10-digit number and verify "Get OTP" is enabled (not clicked)', async () => {
      await dialog.mobileInput.pressSequentially(PhoneNumbers.wellFormed.slice(5));
      await dialog.expectGetOtpEnabled();
    });
  });

  test('AUTH-12 Limits the mobile number to 10 digits', async ({ homePage }) => {
    const dialog = homePage.signInDialog;

    await test.step('Type 11 digits', async () => {
      await homePage.accountIcon.click();
      await dialog.expectOpen();
      await dialog.mobileInput.pressSequentially(`${PhoneNumbers.wellFormed}9`);
    });

    await test.step('Verify the field stops at 10', async () => {
      await expect(dialog.mobileInput).toHaveValue(PhoneNumbers.wellFormed);
    });
  });

  test('AUTH-13 Links to the terms of service and privacy policy', async ({ homePage }) => {
    await test.step('Open the dialog', async () => {
      await homePage.accountIcon.click();
      await homePage.signInDialog.expectOpen();
    });

    await test.step('Verify the legal links', async () => {
      await expect(homePage.signInDialog.termsLink).toHaveAttribute('href', '/terms-and-conditions');
      await expect(homePage.signInDialog.privacyLink).toHaveAttribute('href', '/privacy-policy');
    });
  });
});
