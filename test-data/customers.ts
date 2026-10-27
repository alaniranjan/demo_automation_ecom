import { randomUUID } from 'node:crypto';

export interface DeliveryLocation {
  readonly pincode: string;
  readonly latitude: string;
  readonly longitude: string;
}

/**
 * The store asks for a delivery location before the first add to bag. Most tests preset it (see the
 * `deliveryLocation` fixture) so the dialog does not interrupt them; one test covers the dialog itself.
 * Override with DEMO_PINCODE / DEMO_LATITUDE / DEMO_LONGITUDE.
 */
export const DefaultLocation: DeliveryLocation = {
  pincode: process.env.DEMO_PINCODE ?? '560001',
  latitude: process.env.DEMO_LATITUDE ?? '12.9716',
  longitude: process.env.DEMO_LONGITUDE ?? '77.5946',
};

export interface Registration {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
}

/** Unique registration data so parallel runs never share inputs. Tests never submit a complete form. */
export function createRegistration(overrides: Partial<Registration> = {}): Registration {
  const suffix = randomUUID().slice(0, 8);
  return {
    firstName: `QA${suffix}`,
    lastName: 'Tester',
    email: `qa.${suffix}@example.com`,
    ...overrides,
  };
}

/**
 * Sign-in is by mobile number + OTP. Tests only use numbers the form rejects before any OTP is sent, so no SMS
 * ever reaches a real phone.
 */
export const PhoneNumbers = {
  empty: '',
  tooShort: '12345',
  /** Well-formed but fictional; only typed to check the form, never submitted. */
  wellFormed: '9876543210',
} as const;

/**
 * The customer's own mobile number for `npm run auth:login`, saved from the dashboard's Settings page into the
 * git-ignored .env (DEMO_MOBILE). Undefined when not set: the login step then waits for it to be typed by hand.
 */
export const CustomerMobile: string | undefined = process.env.DEMO_MOBILE?.replace(/\D/g, '').slice(-10) || undefined;

export const AuthMessages = {
  invalidMobile: 'Invalid mobile number',
  firstNameRequired: 'First name is required',
} as const;

export const EmptyBag = {
  heading: 'Your bag is empty',
  text: 'Discover something that moves you.',
} as const;

/**
 * An order that already exists on the signed-in account, re-opened (never re-placed) by the UI comparison of the
 * thank-you and order details pages. Override with DEMO_REFERENCE_ORDER.
 */
export const ReferenceOrder = process.env.DEMO_REFERENCE_ORDER ?? 'ORDT1102292';
