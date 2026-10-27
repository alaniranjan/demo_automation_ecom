/**
 * Mobile and tablet devices the framework can emulate, by dashboard category. Each name is a Playwright device
 * descriptor (real viewport, pixel density, touch, user agent). Apple devices run in WebKit (Safari's engine);
 * Android devices run in Google Chrome. Pick them with DEVICES (comma-separated keys, or "all").
 */
export const DEVICE_CATALOG = {
  iPhone: ['iPhone 17 Pro', 'iPhone 17 Pro Max', 'iPhone 16', 'iPhone 16e'],
  'Android Phone': ['Pixel 10 Pro', 'Pixel 9', 'Galaxy S24', 'Galaxy A55'],
  iPad: ['iPad Pro 11', 'iPad (gen 11)', 'iPad Mini'],
  'Android Tablet': ['Galaxy Tab S9', 'Galaxy Tab S4'],
} as const;

export type DeviceCategory = keyof typeof DEVICE_CATALOG;

/** "iPad (gen 11)" -> "ipad-gen-11": the project name and DEVICES key. */
export function deviceKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function osOf(category: DeviceCategory): 'iOS' | 'Android' {
  return category.startsWith('Android') ? 'Android' : 'iOS';
}
