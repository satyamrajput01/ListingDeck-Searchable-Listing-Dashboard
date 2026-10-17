# ListingDeck — Searchable Listing Dashboard

A responsive, accessible, and security-conscious dashboard for exploring and filtering career and project opportunities, built with HTML5, CSS3, and Vanilla JavaScript.

## 🚀 Live Demo

**Development Preview:** https://satyamrajput01.github.io/ListingDeck-Searchable-Listing-Dashboard/  

Explore the dashboard to search opportunities, combine filters, sort listings, and navigate paginated results.

## Features

- 18 illustrative opportunities across frontend development, UI/UX design, data analytics, DevOps, product, and QA.
- Debounced search across job titles, companies, skills, descriptions, and locations.
- Combined category, experience-level, and work-mode filters.
- Sorting by newest, oldest, and title (A–Z or Z–A).
- Client-side pagination with adjustable page sizes.
- Loading skeletons, empty states, and error recovery.
- Accessible listing details modal with keyboard support.
- Responsive layout for mobile, tablet, and desktop.
- Dedicated Privacy Policy and Terms and Conditions pages.
- Security-conscious DOM rendering, URL validation, and Content Security Policy (CSP).
- Keyboard navigation and reduced-motion support.

## Tech Stack

- HTML5
- CSS3 (Grid and Flexbox)
- Vanilla JavaScript (ES6+)
- JSON
- Fetch API
- Vite
- TypeScript tooling

## Project Structure

```text
listingdeck/
├── index.html
├── style.css
├── script.js
├── privacy.html
├── terms.html
├── metadata.json
├── data/
│   └── listings.json
├── public/
│   ├── assets/
│   │   └── favicon.svg
│   └── data/
│       └── listings.json
├── src/
├── vite.config.ts
├── package.json
├── .gitignore
└── README.md
```

## Run Locally

Requires Node.js and npm.

```bash
npm install
npm run dev
```

Open the local URL displayed in your terminal.

Build the production version:

```bash
npm run build
```

The optimized static files are generated in the `dist/` directory.

## How It Works

Listings are loaded asynchronously from a JSON dataset using the Fetch API. JavaScript manages search, combined filtering, immutable sorting, pagination, and UI state updates. The dashboard provides recovery controls for loading errors and an accessible modal for viewing listing details.

## Accessibility & Security

The dashboard uses semantic HTML, labelled form controls, visible keyboard focus, ARIA live regions, and keyboard-accessible modal interactions. DOM content is rendered using safe node-based methods, external URLs are validated, and a Content Security Policy helps restrict unwanted resource loading.

## Data Transparency

All listed opportunities, company names, and descriptions are illustrative examples created for demonstration purposes. They do not represent verified job openings.

## Maintainer

**Satyam Rajput**  
Email: satyamrajput9293@gmail.com  
GitHub: https://github.com/satyamrajput01

## Deployment

Deployed using Github pages
