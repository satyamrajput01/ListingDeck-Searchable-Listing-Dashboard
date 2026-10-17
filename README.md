# ListingDeck — Searchable Listing Dashboard

A production-quality, responsive, and security-conscious web dashboard for exploring and filtering career and project opportunities. Built with semantic **HTML5**, modern **CSS3** (Flexbox & Grid), and pure **Vanilla ES6+ JavaScript** utilizing the native **Fetch API**.

---

## Maintainer Information

- **Project Author:** Satyam Rajput
- **Email Contact:** [satyamrajput9293@gmail.com](mailto:satyamrajput9293@gmail.com)

---

## Live Application

- **Development Live App:** `https://ais-dev-mxemgajhxo3gxvdkua7p7z-253586045174.asia-southeast1.run.app`
- **Shared Preview App:** `https://ais-pre-mxemgajhxo3gxvdkua7p7z-253586045174.asia-southeast1.run.app`

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Key Features](#key-features)
3. [Technology Stack](#technology-stack)
4. [Repository Structure](#repository-structure)
5. [Local Setup & Running](#local-setup--running)
6. [Engineering Architecture](#engineering-architecture)
   - [Asynchronous Data Loading & Resilient Error Handling](#asynchronous-data-loading--resilient-error-handling)
   - [Debounced Live Search](#debounced-live-search)
   - [Combined Filtering with Logical AND](#combined-filtering-with-logical-and)
   - [Immutable Sorting](#immutable-sorting)
   - [Client-Side Pagination](#client-side-pagination)
   - [Asynchronous UI States](#asynchronous-ui-states)
7. [Design & Anti-Slop Discipline](#design--anti-slop-discipline)
8. [Accessibility (a11y)](#accessibility-a11y)
9. [Application Security & Privacy](#application-security--privacy)
10. [Testing & Verification Guide](#testing--verification-guide)
11. [Data Transparency & Notice](#data-transparency--notice)

---

## Project Overview

**ListingDeck** provides immediate, zero-lag, intuitive access to complex records through clean client-side computational patterns.

Rather than relying on heavyweight frontend framework abstractions, this project leverages the browser's native capabilities:
- Efficient asynchronous data retrieval using `fetch()` and `async/await`.
- Multi-dimensional data filtering across keywords, categorical domains, experience levels, and work modes.
- Strict logical AND composition ensuring exact search precision.
- Defensive frontend security including Content Security Policy (CSP), strict XSS elimination through DOM node generation, and URL protocol verification.
- Fully accessible keyboard navigation and WCAG 2.1 AA contrast compliance.

---

## Key Features

1. **Rich Dataset:** 18 distinct, balanced opportunities across Frontend Engineering, UI/UX Design, Data Analytics, Systems/DevOps, and Product & QA.
2. **Debounced Real-Time Search:** Real-time query matching across role title, company name, skill tags, descriptions, and locations with a 275ms debounce to prevent layout thrashing.
3. **Multi-Attribute Combined Filters:** Domain/Category, Experience Level, and Work Mode filters combining seamlessly with the search query using strict boolean logical AND.
4. **Immutable Sorting:** Reorder results by Newest First, Oldest First, Title (A–Z), and Title (Z–A) without mutating the underlying data cache.
5. **Client-Side Pagination:** Adaptive pagination with customizable page sizes (6 or 12 items), dynamic page count recalculation, automated reset on query change, and keyboard-accessible controls.
6. **Complete Asynchronous State Handling:**
   - **Loading State:** 6 shimmering skeleton cards matching production card layout.
   - **Success State:** High-contrast responsive cards with clean metadata typography.
   - **Empty State:** Helpful empty state graphic, messaging, and a one-click filter reset action.
   - **Error State:** Polite, informative error feedback with a functioning "Try Again" recovery button.
7. **Listing Details Modal:** Accessible modal dialog with backdrop blur, full role specifications, skill breakdowns, keyboard escape handling, and reference link actions.
8. **Dedicated Legal Pages:** Fully styled `privacy.html` and `terms.html` pages documenting real client-side data handling practices and maintainer contact details.

---

## Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Structure** | Semantic HTML5 | Accessible landmark elements (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`) |
| **Styling** | Pure CSS3 (Flexbox & Grid) | CSS custom properties, responsive auto-fill grids, zero layout shifts, restrained aesthetics |
| **Logic** | Vanilla JavaScript (ES6+) | Functional array methods (`filter`, `sort`, `slice`, `map`, `some`), closures, and DOM APIs |
| **Data Fetching** | Fetch API | Native promise-based asynchronous data loading with robust error handling |
| **Data Format** | Local JSON | Structured schema (`id`, `title`, `company`, `category`, `skills`, `workMode`, etc.) |
| **Build & Tooling**| Vite 8 + TypeScript | Instant development environment and optimized static asset packaging |

*No third-party UI component libraries, external frameworks, or analytics trackers were added.*

---

## Repository Structure

```text
listingdeck/
├── index.html              # Main application entry point & semantic HTML structure
├── style.css               # Production design system, responsive grid, and component styles
├── script.js               # Vanilla ES6+ application engine & state coordinator
├── data/
│   └── listings.json       # Source JSON dataset (18 structured listings)
├── public/
│   ├── assets/
│   │   └── favicon.svg     # Geometric SVG favicon
│   └── data/
│       └── listings.json   # Static asset copy for direct web server hosting
├── privacy.html            # Dedicated Privacy Policy page
├── terms.html              # Dedicated Terms and Conditions page
├── metadata.json           # Application metadata manifest
├── vite.config.ts          # Multi-page build configuration
├── package.json            # Scripts and dependencies configuration
├── .gitignore              # Git ignore rules for node_modules, build output, and env files
└── README.md               # Technical project documentation
```

---

## Local Setup & Running

### Prerequisites

- Node.js (version 18.0.0 or higher recommended)
- npm (version 9.0.0 or higher)

### Installation & Launch

1. **Install development dependencies:**
   ```bash
   npm install
   ```

2. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open your browser to `http://localhost:3000` to interact with the dashboard.

3. **Build for production deployment:**
   ```bash
   npm run build
   ```
   Outputs optimized, static HTML, CSS, and JavaScript files into the `dist/` directory, ready to deploy to any static hosting service.

4. **Typecheck & Lint:**
   ```bash
   npm run lint
   ```

---

## Engineering Architecture

### Asynchronous Data Loading & Resilient Error Handling

Data is fetched asynchronously using `fetch()` during initialization:
```javascript
async function loadListingsData() {
  state.status = 'loading';
  state.errorMessage = '';
  renderDashboard();

  try {
    let response = await fetch('./data/listings.json');
    if (!response.ok) {
      response = await fetch('/data/listings.json');
    }
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: Unable to retrieve listings dataset`);
    }
    const data = await response.json();
    state.allListings = sanitizeAndNormalize(data);
    applyFiltersAndSort();
  } catch (err) {
    state.status = 'error';
    state.errorMessage = err.message;
    renderDashboard();
  }
}
```
If an HTTP failure or network abort occurs:
1. `state.status` transitions to `'error'`.
2. A restrained error container replaces the card grid, explaining the failure.
3. A working `"Try Again"` button invokes `loadListingsData()`, allowing seamless user recovery.

### Debounced Live Search

To prevent input stutter and unnecessary DOM re-renders, queries are processed with a 275ms debounce:
```javascript
function debounce(func, delay = 275) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
}
```
**Why 275ms?**
- Standard typing pauses average 150–300ms per keystroke.
- A 275ms threshold ensures the application waits until the user finishes typing before executing filter operations and DOM updates.
- Input values are trimmed, converted to lowercase, and internal whitespace normalized (`query.replace(/\s+/g, ' ')`).
- Searches match against `title`, `company`, `description`, `location`, and individual `skills`.

### Combined Filtering with Logical AND

All active filters and the search query are evaluated simultaneously. An opportunity must satisfy **all** selected conditions to appear:

$$\text{Visible} = \text{QueryMatch} \land \text{CategoryMatch} \land \text{LevelMatch} \land \text{WorkModeMatch}$$

Active filters generate dismissible chip tokens in the results bar, enabling users to remove individual filters or click `"Reset Filters"` to clear all selections.

### Immutable Sorting

Sorting preserves the raw dataset without mutations:
```javascript
const sorted = [...filtered].sort((a, b) => {
  switch (state.sortOrder) {
    case 'newest':
      return new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime();
    case 'oldest':
      return new Date(a.postedDate).getTime() - new Date(b.postedDate).getTime();
    case 'title-asc':
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    case 'title-desc':
      return b.title.localeCompare(a.title, undefined, { sensitivity: 'base' });
    default:
      return 0;
  }
});
```

### Client-Side Pagination

- **Page Slicing:** Computes the visible window based on `currentPage` and `pageSize`.
- **Dynamic Clamping:** If a search query or filter reduces the total pages below `state.currentPage`, `state.currentPage` is automatically reset to `1`.
- **Keyboard & Touch Accessible:** Previous and Next controls are disabled when at list boundaries, with numeric buttons indicating the active page via `aria-current="page"`.
- **Smooth Scroll:** Page transitions smoothly scroll back to the top of the listings section.

---

## Design & Anti-Slop Discipline

The visual design adheres to rigorous professional design standards:
- **Zero-Pill Metadata:** Listing cards lead with clean, unboxed text metadata separated by subtle typographic dots (`·`), rather than cluttered pill capsules.
- **Top Bar Contract:** Clean 3-zone header with single-element brand mark (`ListingDeck`), concise navigation links (`Listings`, `Search & Filters`, `Privacy`, `Terms`), and quick search action.
- **Restrained Color Palette:** 60% neutral canvas (`#F8FAFC`), 30% structural cards (`#FFFFFF` with subtle `#E2E8F0` borders), 10% purposeful accent (`#2563EB`).
- **Tabular Figures:** Numbers and timestamps use `font-variant-numeric: tabular-nums` to eliminate layout jitter.
- **No AI Slop:** No dark-purple gradients, no fake customer rating tickers, no decorative pulsing dots, no animated cursor trails, and no filler copy.
- **Micro-Interaction Budget:** Transitions settle in $\le 200\text{ms}$; respects `prefers-reduced-motion: reduce`.

---

## Accessibility (a11y)

- **Semantic HTML5:** Native landmark elements (`<header>`, `<main>`, `<nav>`, `<section>`, `<article>`, `<footer>`).
- **Skip Link:** Direct skip link to main content for screen reader and keyboard users (`.skip-link`).
- **Focus Rings:** High-contrast 2px focus outlines (`:focus-visible`) across all interactive buttons, inputs, selects, and links.
- **Form Affordances:** Explicit `<label>` elements for every input and select control.
- **Live Regions:** Status and results bar uses `aria-live="polite"` so screen readers announce result count updates.
- **Modal Dialog:** Accessible modal with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `Escape` key listeners.
- **Safe External Links:** `rel="noopener noreferrer"` and descriptive `aria-label` text indicating external navigation.

---

## Application Security & Privacy

1. **Cross-Site Scripting (XSS) Prevention:** User search inputs and dataset values are never injected into the DOM via raw `innerHTML`. Text matching is performed via `createHighlightedFragment()`, which creates native `Text` nodes and `<mark>` elements programmatically.
2. **Content Security Policy (CSP):** A restrictive CSP meta tag is configured across all HTML pages.
3. **Secret & Credential Inspection:** No API keys, tokens, or private secrets exist in the repository.
4. **Client-Side Privacy:** Searches and filters execute 100% locally in browser memory. No tracking cookies or advertising pixels exist.

---

## Testing & Verification Guide

### Functional Test Suite

| Test Case | Steps to Verify | Expected Outcome | Result |
|---|---|---|---|
| **TC-01: Dataset Loading** | Load application in browser | 18 sample listings load via Fetch API | **PASS** |
| **TC-02: Search by Title** | Enter "Frontend" into search input | Returns 4 frontend roles | **PASS** |
| **TC-03: Search by Skill** | Enter "Python" into search input | Returns roles requiring Python | **PASS** |
| **TC-04: Search Debounce** | Type rapidly in search box | Filtering executes 275ms after typing stops | **PASS** |
| **TC-05: Case-Insensitive** | Search "DOCKER" vs "docker" | Identical results returned | **PASS** |
| **TC-06: Category Filtering** | Select "UI/UX & Design" | Only design roles displayed | **PASS** |
| **TC-07: Combined AND Filter** | Search "Frontend" + Mode "Remote" | Only listings matching BOTH criteria appear | **PASS** |
| **TC-08: Empty State** | Search for "xyznonexistent" | Clean empty state with "Reset Filters" action | **PASS** |
| **TC-09: Filter Reset** | Click "Reset Filters" | Restores all 18 listings and resets dropdowns | **PASS** |
| **TC-10: Sorting (Newest)** | Select "Newest First" | Most recent postings appear at top | **PASS** |
| **TC-11: Sorting (A–Z)** | Select "Title (A to Z)" | Sorted alphabetically from A to Z | **PASS** |
| **TC-12: Pagination Clamping**| Go to page 3, filter to 2 results | Page clamps automatically to Page 1 | **PASS** |
| **TC-13: Details Modal** | Click "Details" on any card | Modal opens; closes on Esc or backdrop click | **PASS** |

---

## Data Transparency & Notice

All opportunities, company names (e.g., Kite Cloud Systems, Urban Transit Labs), and project descriptions in `listings.json` are illustrative entries provided for demonstration purposes.

For further information, please see the [Privacy Policy](/privacy.html) and [Terms and Conditions](/terms.html).
