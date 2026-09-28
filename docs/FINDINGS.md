# Accessibility Audit — SauceDemo (WCAG 2.2 AA)

| Item          | Detail                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------- |
| Target        | [saucedemo.com](https://www.saucedemo.com) — login → inventory → product → cart → checkout        |
| Reference     | [W3C Before-and-After Demo](https://www.w3.org/WAI/demos/bad/) (scanner validation)               |
| Standard      | WCAG 2.2, Level AA                                                                                |
| Date / tester | 2026-09-28 · Vincent Jerico                                                                       |
| Tools         | axe-core 4.13.0 via `@axe-core/playwright` · Playwright 1.63.0 (Chromium) · manual keyboard audit |
| Viewport      | Desktop Chrome, 1280×720                                                                          |

## Summary

**axe-core reported 0 violations on all 8 SauceDemo pages and states. The manual and keyboard audit
found 7 WCAG failures, including one that stops a keyboard-only user from checking out.**

That gap is the reason this audit exists. Automated scanning checks markup (names, roles, contrast,
labels in the accessibility tree). It cannot tell whether a control is reachable, whether focus is
visible, or where focus goes after a menu closes. Several WCAG 2.2 criteria, such as 2.4.11 Focus Not
Obscured, have no axe rule at all.

| Severity | Count | Meaning                                                               |
| -------- | ----- | --------------------------------------------------------------------- |
| Critical | 1     | Blocks a task outright for a group of users                           |
| Serious  | 3     | Major barrier; the task is possible only with a workaround or by luck |
| Moderate | 3     | Friction or confusion; the task is still completable                  |

## Findings

| ID                                                 | Issue                                            | WCAG SC (Level)                          | Severity | Found by |
| -------------------------------------------------- | ------------------------------------------------ | ---------------------------------------- | -------- | -------- |
| [F-1](#f-1--cart-is-not-reachable-by-keyboard)     | Cart is not reachable by keyboard                | 2.1.1 Keyboard (A)                       | Critical | Keyboard |
| [F-2](#f-2--no-visible-focus-indicator-anywhere)   | No visible focus indicator anywhere              | 2.4.7 Focus Visible (AA)                 | Serious  | Keyboard |
| [F-3](#f-3--menu-toggle-hides-its-state)           | Menu toggle doesn't expose open/closed state     | 4.1.2 Name, Role, Value (A)              | Serious  | Manual   |
| [F-7](#f-7--focus-moves-behind-the-open-menu)      | Focus moves onto controls hidden behind the menu | 2.4.11 Focus Not Obscured (Minimum) (AA) | Serious  | Keyboard |
| [F-4](#f-4--closing-the-menu-loses-focus)          | Closing the menu drops focus to `<body>`         | 2.4.3 Focus Order (A)                    | Moderate | Keyboard |
| [F-5](#f-5--page-titles-are-not-headings)          | Page titles aren't headings; pages have none     | 1.3.1 Info and Relationships (A)         | Moderate | Manual   |
| [F-6](#f-6--placeholder-is-the-only-visible-label) | Placeholder is the only visible label            | 3.3.2 Labels or Instructions (A)         | Moderate | Manual   |

Each finding is tracked by a test in
[`tests/saucedemo.known-issues.spec.ts`](../tests/saucedemo.known-issues.spec.ts). The test pins the
**current** defective behavior and carries an `issue` annotation naming the finding. It passes while
the defect exists and turns red the day the defect is fixed, which is the signal to flip it into a
regression guard. It also turns red on any unrelated failure, such as a broken login, and each
negative check sits behind a presence check so a renamed selector can't pass it.

---

### F-1 · Cart is not reachable by keyboard

**WCAG 2.1.1 Keyboard (A) · Critical** · all logged-in pages

- **Observed:** The cart is `<a class="shopping_cart_link" role="button" aria-label="Cart, empty">`
  with no `href` and no `tabindex`, so it never gets keyboard focus. Tab order after login: Open Menu →
  Sort → 6 × (product image, product name, Add to cart) → X, Facebook, LinkedIn → wraps to the top.
  The cart is skipped.
- **Impact:** A keyboard-only user can fill a cart but can never open it, so they **can't check out**.
  Screen reader users still hear "Cart, empty, button" when reading the page, so they are told about
  a button they can't Tab to.
- **Reproduce:** Log in as `standard_user`, add any item, and press Tab repeatedly. Focus never lands
  on the cart icon.
- **Recommendation:** The cart navigates, so make it a real link:
  `<a href="/cart.html" aria-label="Cart, 1 item">`. Drop `role="button"`.
- **Tracked by:** `F-1 · the cart is not reachable by keyboard`

### F-2 · No visible focus indicator anywhere

**WCAG 2.4.7 Focus Visible (AA) · Serious** · site-wide

- **Observed:** Every control computes `outline-style: none` with no `box-shadow`, border or
  background change on focus. `:focus-visible` matches, but nothing is drawn. Element screenshots
  taken before and after keyboard focus are **pixel-identical** for the Login button, Open Menu,
  the sort select, product links, Add to cart and the footer links.
- **Impact:** Sighted keyboard users can't see where they are on the page.
- **Evidence:** [`login-button-unfocused.png`](evidence/login-button-unfocused.png) vs
  [`login-button-focused.png`](evidence/login-button-focused.png). Same bytes, same pixels.
- **Recommendation:** Add a global `:focus-visible { outline: 3px solid #132322; outline-offset: 2px; }`.
  The indicator needs at least 3:1 contrast against adjacent colors (SC 1.4.11).
- **Tracked by:** `F-2 · the login button shows no visible focus indicator`

### F-3 · Menu toggle hides its state

**WCAG 4.1.2 Name, Role, Value (A) · Serious** · all logged-in pages

- **Observed:** `<button id="react-burger-menu-btn">Open Menu</button>` has no `aria-expanded` or
  `aria-controls`, and its name stays "Open Menu" while the menu is open. The "Dynamic Catalog" item
  _inside_ the menu does use `aria-expanded` and `aria-controls` correctly, so the pattern is already
  in the codebase.
- **Impact:** Screen reader users aren't told whether the menu opened, or which content it controls.
- **Recommendation:** `aria-expanded={isOpen}` and `aria-controls="<menu id>"` on the toggle.
- **Tracked by:** `F-3 · the menu button does not expose its expanded state`

### F-7 · Focus moves behind the open menu

**WCAG 2.4.11 Focus Not Obscured (Minimum) (AA) · Serious** · all logged-in pages

- **Observed:** Focus is not contained in the open menu. After the last item and the Close button,
  Tab moves into the page underneath. On Tab 7, focus lands on the first product's image link
  (x 111–261). The 300 px menu panel covers that link **completely**: `elementFromPoint` at its four
  corners and centre returns the menu every time.
- **Impact:** A sighted keyboard user loses track of focus completely, which is worse than F-2
  because there is nothing to see even with a focus style. They can also activate a control they
  can't see.
- **Evidence:** [`menu-focus-obscured.png`](evidence/menu-focus-obscured.png). Focus is on the Sauce
  Labs Backpack image link, fully under the menu.
- **Recommendation:** Treat the open menu as a modal: make the rest of the page `inert` (or trap
  focus), and add `aria-modal="true"`. Alternatively, close the menu when focus leaves it.
- **Why axe misses it:** axe-core has no rule for SC 2.4.11. This suite checks it with
  `isFocusEntirelyObscured()` in [`src/keyboard.ts`](../src/keyboard.ts).
- **Tracked by:** `F-7 · Tab moves focus onto a link hidden behind the open menu`

### F-4 · Closing the menu loses focus

**WCAG 2.4.3 Focus Order (A) · Moderate** · all logged-in pages

- **Observed:** Escape closes the menu (good), but focus ends on `<body>`. Timeline after Escape:
  `0 ms → Open Menu button`, `50 ms → BODY`, and it stays on `BODY`. Closing with the Close Menu button
  behaves the same way. Something blurs the toggle right after the library restores focus to it.
- **Impact:** A keyboard user is sent back to the top of the page and has to Tab through from the
  start. Screen readers may announce nothing at all.
- **Recommendation:** After the close transition ends, focus the toggle and make sure nothing blurs
  it afterwards.
- **Tracked by:** `F-4 · closing the menu with Escape drops focus to <body>`. The test waits for
  the close animation to settle, so it reads where focus ends up, not the brief 0 ms stop.

### F-5 · Page titles are not headings

**WCAG 1.3.1 Info and Relationships (A) · Moderate** · inventory, cart, checkout, login

- **Observed:** The visual page titles "Products", "Your Cart" and "Checkout: Your Information" are
  `<span class="title">`, and the "Swag Labs" logo is a `<div>`. The inventory, cart and checkout pages
  have **zero** heading elements. The login page has only two `<h4>`s, with no `h1`–`h3`.
- **Impact:** Screen reader users navigate by headings (the H key, the rotor). Here they get nothing,
  so they can't jump to content or learn the page structure.
- **Recommendation:** `<h1 class="title">Products</h1>` (and the same on every page). On login, add
  an `h1` and change the credential boxes to `h2`.
- **Tracked by:** `F-5 · the page title "Products" is not a heading`

### F-6 · Placeholder is the only visible label

**WCAG 3.3.2 Labels or Instructions (A) · Moderate** · login, checkout information

- **Observed:** Username, Password, First Name, Last Name and Zip/Postal Code have a `placeholder` and
  an `aria-label` but no `<label>`. The accessible name exists, so axe passes. The **visible** label
  disappears as soon as the user types.
- **Impact:** Users with memory or cognitive disabilities, and anyone who gets interrupted, lose track
  of what a filled field is for. Placeholder text is also usually low-contrast.
- **Recommendation:** Add a visible `<label for="user-name">Username</label>` for every field and keep
  the placeholder for examples only.
- **Tracked by:** `F-6 · login fields have placeholders but no visible labels`

---

## What works (regression-guarded)

These pass today and are locked in by
[`tests/saucedemo.keyboard.spec.ts`](../tests/saucedemo.keyboard.spec.ts). If one breaks, a user
loses something that currently works.

- `<html lang="en">` is set.
- Landmarks: exactly one `banner`, `main` and `contentinfo`. The menu's `navigation` joins the tree
  only while the menu is open.
- Login tab order is logical (Username → Password → Login), and login works entirely by keyboard.
- Login errors are announced: the error container has `role="alert"`.
- Add to cart works with Enter, and the button switches to Remove.
- The menu opens with Enter and moves focus to its first item.
- The login form's accessible structure is pinned with an ARIA snapshot (`form "Login"` → 2 textboxes
  → button).

## Scanner validation (W3C Before-and-After Demo)

A test suite that finds nothing is only meaningful if it _can_ find something. So the same scanner
runs against W3C's deliberately broken demo and its repaired twin:

| Page   | "Before" (inaccessible)                                                                                         | "After" (repaired) |
| ------ | --------------------------------------------------------------------------------------------------------------- | ------------------ |
| Home   | `image-alt` (33) · `link-name` (7) · `color-contrast` (2) · `html-has-lang` · `select-name` · `target-size` (2) | `target-size` (4)  |
| Survey | `image-alt` (24) · `label` (11) · `link-name` (4) · `select-name` (2) · `html-has-lang` · `target-size` (2)     | `target-size` (2)  |

The repaired site passes everything **except** `target-size`, which is
**F-8**: the demo predates WCAG 2.2 and SC 2.5.8 Target Size (Minimum). No rule is disabled. Each
after-page test pins `target-size` as the only rule that fails, so a new violation or the fix of
this one both turn it red.

[`tests/scanner-selftest.spec.ts`](../tests/scanner-selftest.spec.ts) also plants one defect at a time
into a clean page (`label`, `html-has-lang`, `button-name`, `image-alt`, `color-contrast`,
`autocomplete-valid`) and requires the `expectNoViolations()` gate to reject each one, naming the rule
and its impact. The plants mix critical and serious impacts and span WCAG 2.0 and 2.1 tags, so a gate
that filters by impact or drops a tag fails the self-test. That guards against a vacuous pass, where
axe scans a blank or wrong DOM. The same file checks that `exclude` skips a region and that axe's
needs-review results are counted in an `axe-incomplete` annotation rather than failing the gate.

## Not covered (known limits)

- **Screen reader pass:** Findings are based on the accessibility tree and ARIA, and were not
  confirmed with VoiceOver or NVDA. A VoiceOver pass on the menu (F-3, F-4, F-7) is the next step.
- **Zoom and reflow** (1.4.4, 1.4.10) and **text spacing** (1.4.12) were not tested.
- **Mobile and touch**, including target sizes on SauceDemo at small viewports, were not tested.
- **Contrast** was checked only by axe, which is reliable on solid backgrounds. Text over the product
  images was not checked.
- **2.5.7 Dragging Movements** does not apply: there is no drag interaction.
- **Observation (not scored):** every page has the same `<title>`, "Swag Labs", so the title doesn't
  describe each page (borderline for 2.4.2 Page Titled). It is worth fixing alongside F-5.
