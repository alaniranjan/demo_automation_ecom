import { createElement, type ComponentType, type SVGProps } from 'react';
import type { SpecFile } from '@/lib/types';
import {
  FileIcon,
  FilterIcon,
  FolderIcon,
  GridIcon,
  HomeIcon,
  KeyIcon,
  PackageIcon,
  RefreshIcon,
  RouteIcon,
  SearchIcon,
  ShieldIcon,
  ShoppingBagIcon,
  SortIcon,
  TagIcon,
  UserIcon,
  ZapIcon,
} from './icons';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** First match wins, so the more specific patterns come first. Unknown names fall back to a generic icon. */
const SPEC_ICONS: ReadonlyArray<readonly [RegExp, IconComponent]> = [
  [/login|sign-?in|otp|auth/i, KeyIcon],
  [/guest|access|permission/i, ShieldIcon],
  [/order|checkout|payment/i, PackageIcon],
  [/account|profile/i, UserIcon],
  [/update-cart|quantity/i, RefreshIcon],
  [/cart|bag/i, ShoppingBagIcon],
  [/sort/i, SortIcon],
  [/filter/i, FilterIcon],
  [/search/i, SearchIcon],
  [/detail|pdp/i, TagIcon],
  [/list|catalog|grid|plp/i, GridIcon],
  [/home|landing/i, HomeIcon],
  [/e2e|journey|shopping|purchase|regression/i, RouteIcon],
];

const FEATURE_ICONS: ReadonlyArray<readonly [RegExp, IconComponent]> = [
  [/auth|login/i, KeyIcon],
  [/account/i, UserIcon],
  [/cart|bag/i, ShoppingBagIcon],
  [/order|checkout/i, PackageIcon],
  [/home/i, HomeIcon],
  [/product|catalog/i, GridIcon],
  [/regression|e2e|workflow/i, RouteIcon],
];

function pick(table: ReadonlyArray<readonly [RegExp, IconComponent]>, value: string, fallback: IconComponent): IconComponent {
  return table.find(([pattern]) => pattern.test(value))?.[1] ?? fallback;
}

/** "products/product-sort.spec.ts" -> SortIcon. */
export function specIcon(file: string): IconComponent {
  return pick(SPEC_ICONS, file.split(/[\\/]/).pop() ?? file, FileIcon);
}

/** Folder / feature name ("Auth", "Products") -> icon. */
export function featureIcon(feature: string): IconComponent {
  return pick(FEATURE_ICONS, feature, FolderIcon);
}

/** "cart/add-to-cart.spec.ts" -> "Add to cart", "regression/e2e-shopping.spec.ts" -> "E2E shopping". */
export function specTitle(file: string): string {
  const base = (file.split(/[\\/]/).pop() ?? file).replace(/\.(spec|test|setup)\.[cm]?[jt]sx?$/, '');
  const words = base.split(/[-_.]+/).filter(Boolean).map((word) => (/^(e2e|pdp|plp|otp|ui|api)$/i.test(word) ? word.toUpperCase() : word.toLowerCase()));
  const title = words.join(' ');
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/** "CART-01 Adds a product in the chosen size" -> { id: "CART-01", name: "Adds a product in the chosen size" }. */
export function splitTestTitle(title: string): { id: string | null; name: string } {
  const match = title.match(/^([A-Z][A-Z0-9]*-\d+)\s+(.+)$/);
  return match ? { id: match[1]!, name: match[2]! } : { id: null, name: title };
}

/** Icon + readable name, with the file path underneath. */
export function SpecName({ file, showPath = true }: { file: string; showPath?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
        {createElement(specIcon(file), { width: 15, height: 15 })}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{specTitle(file)}</span>
        {showPath && <span className="block truncate font-mono text-[11px] text-ink-3">{file}</span>}
      </span>
    </span>
  );
}

export function FeatureName({ feature }: { feature: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {createElement(featureIcon(feature), { width: 14, height: 14, className: 'shrink-0 text-ink-3' })}
      <span className="truncate">{feature}</span>
    </span>
  );
}

/** Test case ID badge ("AUTH-01"), the name, and a bolt for @smoke tests. */
export function TestCaseTitle({ title, tags = [], file }: { title: string; tags?: readonly string[]; file?: string }) {
  const { id, name } = splitTestTitle(title);
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {file && createElement(specIcon(file), { width: 14, height: 14, className: 'shrink-0 text-ink-3' })}
      {id && (
        <span className="shrink-0 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-strong">
          {id}
        </span>
      )}
      <span className="min-w-0 truncate text-ink">{name}</span>
      {tags.includes('@smoke') && (
        <span title="Smoke test" className="shrink-0 text-warning-text">
          <ZapIcon width={13} height={13} aria-label="Smoke test" />
        </span>
      )}
    </span>
  );
}

/** Signed-in specs run in the framework's "account" project with the saved session (`npm run auth:login`). */
export function isSignedInSpec(file: SpecFile): boolean {
  return file.tests.some((test) => test.project === 'account');
}

/** Specs whose tests are tagged @order place a real order on the signed-in account. */
export function placesRealOrder(file: SpecFile): boolean {
  return file.tests.some((test) => test.tags.includes('@order'));
}

/** Asks before starting a run that would place a real order; true when it may go ahead. */
export function confirmRealOrder(files: readonly SpecFile[]): boolean {
  const ordering = files.filter(placesRealOrder);
  if (ordering.length === 0) return true;
  return window.confirm(
    `${ordering.map((file) => specTitle(file.file)).join(', ')} places a REAL Cash on Delivery order on your account ` +
      '(it empties the bag first and orders one product). Continue?',
  );
}

/** "Signed in" / "Real order" chips next to a spec name. */
export function SpecBadges({ file }: { file: SpecFile }) {
  if (!isSignedInSpec(file)) return null;
  return (
    <span className="flex shrink-0 flex-wrap gap-1">
      <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-strong">
        <UserIcon width={11} height={11} /> Signed in
      </span>
      {placesRealOrder(file) && (
        <span className="inline-flex items-center gap-1 rounded-md bg-critical-soft px-1.5 py-0.5 text-[11px] font-medium text-critical-text">
          <PackageIcon width={11} height={11} /> Real order
        </span>
      )}
    </span>
  );
}
