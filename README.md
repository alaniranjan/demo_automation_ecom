# Demo Store E2E Automation Framework

End-to-end test automation for the [Honebi demo store](https://demo.honebi.online/) (an Indian fashion e-commerce site), built with **Playwright**, **TypeScript** and **Allure Report**. It covers the guest storefront (sign-in validation, home, listings, sorting, filters, search, product pages, the bag), the signed-in account and a real **Cash on Delivery order**, plus **visual (UI comparison) testing** against approved baselines. A **Next.js QA dashboard** runs the suites and shows results, screenshots and videos in the browser.

## Technology stack

| Tool | Version | Purpose |
|---|---|---|
| [Playwright Test](https://playwright.dev/) | 1.64.1 (pinned) | Test runner, browser automation, screenshot and ARIA snapshot comparison |
| TypeScript | 7.x | Strictly typed test code |
| [allure-playwright](https://allurereport.org/docs/playwright/) | 3.x | Writes Allure results during the run |
| [Allure Report](https://allurereport.org/) (`allure` npm package) | 3.x | Generates and serves the HTML report (no Java needed) |
| dotenv | 18.x | Loads optional `.env` overrides |
| Jenkins / GitHub Actions | - | CI pipelines (`Jenkinsfile`, `.github/workflows/e2e.yml`) |
| Next.js + Tailwind CSS | 16 / 4 | QA dashboard (`dashboard/`) |

## Prerequisites

- **Node.js 20 or newer** (developed on Node 22) and npm
- **Google Chrome** (the default browser) and network access to `https://demo.honebi.online`
- For the signed-in tests: a store account you can sign in to with **your mobile number and an OTP**
- Docker, only if you run the Jenkins pipeline as written

## Installation

```bash
git clone https://github.com/alaniranjan/demo_automation_ecom.git
cd demo_automation_ecom
npm ci                      # installs exact versions from package-lock.json
npm run browsers:install    # installs Google Chrome, Firefox and WebKit for Playwright
```

## Folder structure

```text
demo_automation/
├── tests/
│   ├── auth/            # login.spec.ts (AUTH-01..13), guest-access.spec.ts (GUEST-01..06)
│   ├── home/            # home.spec.ts (HOME-01..09)
│   ├── products/        # product-list (PLP), product-sort (SORT), product-filter (FILT), search (SRCH), product-details (PDP)
│   ├── cart/            # add-to-cart.spec.ts, update-cart.spec.ts (CART-01..10)
│   ├── regression/      # e2e-shopping.spec.ts (E2E-01: guest journey up to the checkout sign-in)
│   ├── account/         # Signed-in only: login.setup.ts, account.spec.ts (ACC), place-order.spec.ts (ORD)
│   └── visual/          # UI comparison: storefront-ui.spec.ts, account-ui.spec.ts (VIS-01..16), capture.css
├── pages/               # Page Object Model
│   ├── BasePage.ts      # Shared header: logo, menu, search, wishlist, account, bag
│   ├── HomePage.ts, ProductListPage.ts, SearchPage.ts, ProductDetailsPage.ts, LoginPage.ts
│   ├── CheckoutPage.ts  # Signed-in checkout: prefilled address, payment, coupons, order summary
│   ├── AccountPage.ts   # My Account: profile, order history
│   ├── OrderPages.ts    # Thank-you page and order details
│   └── components/      # CartDrawer, SignInDialog, LocationDialog
├── fixtures/test-fixtures.ts   # Page-object fixtures, saved delivery location, `menListingPage`
├── test-data/           # Categories, products, sort options, search terms, phone-number cases, reference order
├── utils/               # hydration.ts (waits for the page to be interactive), test-helpers.ts, auth.ts, devices, recording
├── visual-baselines/    # Approved UI screenshots and ARIA snapshots (the "old UI")
├── dashboard/           # Next.js QA dashboard (see dashboard/README.md)
├── reporters/           # Live-progress and catalog reporters used by the dashboard
├── playwright.config.ts
├── allurerc.mjs, tsconfig.json, Jenkinsfile, .env.example, package.json
```

### How the framework fits together

- **Page objects** (`pages/`) own every locator and user action; specs never use raw selectors. The store marks key elements with stable `id`s (`product-card`, `product-name`, `add-to-cart-button`, …), so the config sets `testIdAttribute: 'id'` and page objects use `getByTestId` and `getByRole`.
- **Test IDs and names**: every test title starts with an ID (`AUTH-01`, `CART-05`, `VIS-07`, …). The dashboard shows them as badges, with an icon per spec file and folder.
- **Waiting for a live, server-rendered site**: pages appear before React makes them clickable, and early clicks are silently ignored. `utils/hydration.ts` waits for each key control to become interactive, and cart actions repeat a click only if the store never sent its `cart/update` request, so nothing is ever added twice. Navigation doesn't wait for every image to load.
- **Delivery location**: the store asks for a pincode before the first add to bag. A fixture saves one (560001 by default) in the browser before each test; `CART-04` tests the location dialog itself.
- Each test gets a fresh browser context (an empty guest bag), so tests share no state and can run in any order.

## Environment configuration

Every setting has a working default. To override one, copy the example file:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `https://demo.honebi.online` | Application under test |
| `DEMO_PINCODE`, `DEMO_LATITUDE`, `DEMO_LONGITUDE` | `560001`, `12.9716`, `77.5946` | Delivery location saved before each test |
| `DEMO_MOBILE` | unset | Your mobile number for `npm run auth:login` (only the OTP is then typed). Set it from the dashboard's **Settings → Customer account** card or in `.env` |
| `DEMO_REFERENCE_ORDER` | `ORDT1102292` | An existing order re-opened (never re-placed) by the visual tests of the thank-you and order details pages |
| `ORDER_DRY_RUN` | unset | `true` runs the order test up to, but not including, "Place order" |
| `BROWSERS` | `chrome` | Desktop browsers: `chrome`, `firefox`, `webkit`, or `all`; empty for device-only runs |
| `DEVICES` | none | Emulated phones and tablets (`iphone-17-pro`, `pixel-10-pro`, `ipad-pro-11`, … or `all`; list in `utils/devices.ts`) |
| `CROSS_BROWSER` | `false` | `true` is a shortcut for `chrome,firefox,webkit` |
| `LIVE_PREVIEW` | unset | `1` streams each running test's browser to the dashboard's live preview |
| `RECORDING_RESOLUTION` | `1080p` | Browser size and the size of failed tests' screenshots and videos: `720p`, `1080p` or `1440p` |
| `KEEP_ALLURE_RESULTS` | unset | `true` keeps previous `allure-results` instead of clearing them |
| `CI` | unset | CI mode: 2 retries, 2 workers, `forbidOnly`, JUnit output |

`.env` and the saved sign-in session (`playwright/.auth/`) are git-ignored. **Never commit a real phone number.**

## Running tests

### Guest storefront (no account needed)

| Command | What it does |
|---|---|
| `npm test` | Runs all 70 guest tests (Google Chrome) |
| `npm run test:smoke` | The 9 critical-path tests tagged `@smoke` |
| `npm run test:regression` | Every guest test (`@regression`) |
| `npm run test:e2e` | `E2E-01`: browse → sort → add products → search → bag → checkout sign-in |
| `npm run test:headed` / `test:debug` / `test:ui` | Visible browser / Playwright Inspector / UI mode |
| `npm run test:chrome` | The Google Chrome project only |
| `npm run typecheck` | Type-checks the whole project |

```bash
npm test -- tests/cart                              # one folder
npm test -- -g "CART-05"                            # one test by ID
BROWSERS= DEVICES=iphone-17-pro npm run test:smoke  # emulated phone only
```

### Signed-in account and a real order

Sign-in is **mobile number + OTP**, so it can't be automated end to end. Sign in once and the session is reused:

| Command | What it does |
|---|---|
| `npm run auth:login` | Opens Chrome on the login page. With `DEMO_MOBILE` set, it fills the number and requests the OTP; you type the OTP. The session is saved to `playwright/.auth/user.json` |
| `npm run test:account` | `ACC-01..03`: profile, order history, prefilled checkout and its totals. **No order is placed** |
| `npm run test:order:dry-run` | `ORD-01` up to "Place order": bag and checkout calculations, coupon attempts, Cash on Delivery. **No order is placed** |
| `npm run test:order` | `ORD-01`: **places a real Cash on Delivery order** (see below) |

`ORD-01` empties the account's bag, adds one product (the ₹379 muscle vest, size M), verifies the bag and checkout calculations, tries each offered voucher (applies the first one the store accepts, otherwise skips), pays on delivery, reads the order ID on the thank-you page, finds the order in **My Account → Orders**, and verifies its details (item, size, quantity, amounts, payment method, delivery address). Screenshots of the bag, checkout, thank-you page and order details are attached to the report.

These tests never run with `npm test` or the smoke/regression suites, and they are never retried (a retry after "Place order" would place a second order). Each `npm run test:order` places another real order.

### Visual testing (UI comparison)

Compares each screen with its **approved baseline** in `visual-baselines/` and fails when the UI changes: layout, styling, or missing or renamed elements.

| Command | What it does |
|---|---|
| `npm run test:visual` | Compares all 16 screens (`VIS-01..16`) |
| `npm run visual:update` | Approves the current UI as the new baseline (after an intended redesign) |

- **Screens:** header, promo bar, home, footer, listing, search, product page, size guide, sign-in dialog, login page, bag with one item, empty bag; signed in: checkout, thank-you page, order details, My Account menu. The signed-in ones are skipped without a session, and re-open an existing order, so **no order is placed**.
- **Structure checks** (ARIA snapshots) of the header, footer and sign-in dialog catch renamed or missing links even when few pixels change.
- **Masked** so they don't count as UI changes: product photos, names, prices and counts, the hero slider, delivery dates, and the customer's name, phone, email and address. The thank-you confetti is hidden.
- **Tolerance:** at most 100 differing pixels per screen. An absolute budget, because a missing menu link is only about 300 pixels (0.2% of the header), which a percentage would let through.
- Only changed screens keep media: the old (baseline), new and difference images plus a video.

## Reports

```bash
npm run allure:generate     # allure-results/ -> allure-report/
npm run allure:open         # serves the report locally and opens the browser
npm run report:playwright   # Playwright HTML report
```

The Allure report groups tests **Feature → Story**, shows every `test.step()`, severity, errors and environment details, and attaches media for failed tests only (a full-page screenshot and the video, at 1080p by default). Visual mismatches include the expected, actual and diff images.

## QA dashboard

`dashboard/` is a Next.js + Tailwind CSS app that runs this framework's tests and shows their results.

```bash
npm run dashboard:install   # once
npm run dashboard           # http://127.0.0.1:3000
```

- **Dashboard**: KPIs, pass-rate trend, latest run, failing tests
- **Test Suites**: npm suites and every spec file with its icon, readable name, test IDs and latest results; run selected files. Signed-in specs carry **Signed in** / **Real order** badges, and the order spec asks for confirmation before it runs
- **Desktop Browsers / Mobile & Tablet**: start runs and watch them live
- **Visual Testing** (UI Testing): run the UI comparison or approve the current UI; each changed screen shows old, new and difference images (side by side or with a slider) and its video, plus a gallery of approved baselines
- **Execution History, Allure Reports, Artifacts**: past runs, reports, screenshots and videos
- **Settings**: theme, the **Customer account** mobile number for `auth:login` (stored only in the local `.env`, shown masked), framework and backend details

The dashboard is a local tool: it binds to `127.0.0.1` and only runs this project's npm scripts and listed spec files. See [dashboard/README.md](dashboard/README.md) for the API and hosting notes.

## Implemented scenarios

**Authentication (13)**: login page tabs and fields; empty and too-short mobile numbers rejected; registration fields; first-name validation and its error clearing; sign-in dialog from the header; Get OTP disabled until a 10-digit number; digits-only and 10-digit limit; backdrop closes the dialog; terms and privacy links. No OTP is ever requested.

**Guest restrictions (6)**: wishlist (product page, header, card heart) and Buy Now ask a guest to sign in; checkout sends a guest to the login page; empty default wishlist.

**Home (9)**: header, hero and empty bag; featured sections; header and footer collection links; logo returns home; store policies in the footer; footer sub-collection link.

**Products (31)**: every collection's listing and count; card name, sale price, MRP and matching discount; card to product page; quick add from a card; infinite scroll; sub-collections; the card quantity stepper; sorting by price (the store sorts by MRP) and sort from a shared URL; size filter and clearing it; search, letter case, no results, result counter; product page pricing, sizes, delivery date, recommendations, colours, gallery and size guide.

**Bag (10)**: add in a chosen size; two products and the estimated total; bag price matches the product page; delivery location dialog on first add; quantity and total; decrease to empty; remove; persists after reload; close and keep shopping; Continue exploring.

**End-to-end (1)**: guest journey from the home page to the checkout sign-in.

**Signed in (4)**: profile, order history, prefilled checkout and its totals, and the full Cash on Delivery order (`ORD-01`).

**Visual (16)**: the screens listed under [Visual testing](#visual-testing-ui-comparison).

## CI

- **GitHub Actions** (`.github/workflows/e2e.yml`) runs the guest tests on every push to `main` and on demand from the hosted dashboard. Publishing results to the hosted dashboard needs a `BLOB_READ_WRITE_TOKEN` repository secret; without it that step is skipped.
- **Jenkins** (`Jenkinsfile`) runs in the `mcr.microsoft.com/playwright:v1.64.1-noble` image: checkout → `npm ci` → install Chrome → type check → tests (`SUITE` = all, smoke or regression), then publishes JUnit, Allure and Playwright reports. Failures mark the build UNSTABLE so reports are still published. Required plugins: Pipeline, Docker Pipeline, JUnit, HTML Publisher, Timestamper.

The signed-in and visual account tests need a real OTP sign-in, so they are not part of CI.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `browserType.launch: Executable doesn't exist` | Run `npm run browsers:install`. |
| Account or order tests fail at sign-in, or visual tests VIS-13..16 are skipped | The saved session is missing or expired: run `npm run auth:login` again. |
| "saved DEMO_MOBILE was rejected" during `auth:login` | The saved number isn't accepted by the store; update it in dashboard Settings or `.env`. |
| A visual check fails after an intended redesign | Review the old/new/difference images, then run `npm run visual:update` (or **Approve current UI** in the dashboard). |
| Occasional timeouts or "page did not become interactive" | The live demo server is slow under load. Runs use 2 workers and one local retry; retried passes show as *flaky*. |
| `allure: command not found` | Run `npm ci`; the scripts use the local `allure` package. |
| Allure report is blank when opened from disk | Use `npm run allure:open`, which serves it over HTTP. |
| Using `--reporter=…` produces no Allure or dashboard results | The flag replaces every configured reporter; add them back, e.g. `--reporter=list,json,allure-playwright`. |

## Known limitations

- This is a live demo store: its catalog, prices and stock change. Tests check behaviour and relationships (sort order, sale price ≤ MRP, totals adding up) rather than fixed product lists; the two products in `test-data/products.ts` may need updating if they are removed.
- Sign-in is by mobile number and OTP, so guest tests stop at the sign-in step, and the signed-in tests need `npm run auth:login` by a person.
- **Known site defect:** opening a listing with `?sort=` in the URL sorts the products but the Sort dropdown still shows "Featured". `SORT-05` is marked as an expected failure and will flag when the site is fixed.
- Entering an invalid pincode such as `000000` still shows a delivery date, so invalid pincodes aren't tested.
- Visual baselines are for Chrome at 1920×1080; other browsers or sizes would need their own baselines.
- Firefox, WebKit and the emulated devices are configured but opt-in.
