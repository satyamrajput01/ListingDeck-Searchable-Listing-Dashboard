/**
 * ListingDeck — Production Frontend Engine
 * Vanilla ES6+ JavaScript implementing Fetch API, Debounced Search,
 * Logical-AND Combined Filtering, Immutable Sorting, Pagination, LocalStorage Bookmarks, and Async States.
 *
 * @author Satyam Rajput <satyamrajput9293@gmail.com>
 * @license Apache-2.0
 */

(() => {
  'use strict';

  const STORAGE_KEY = 'listingdeck_saved_ids';

  /**
   * Retrieves saved bookmark IDs from browser localStorage.
   * @returns {Set<string>}
   */
  function getSavedListingIds() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
    } catch {
      return new Set();
    }
  }

  /**
   * Persists saved bookmark IDs to browser localStorage.
   * @param {Set<string>} set
   */
  function persistSavedListingIds(set) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    } catch (err) {
      console.warn('Unable to persist bookmarks to localStorage:', err);
    }
  }

  // Application State
  const state = {
    allListings: [],
    filteredListings: [],
    searchQuery: '',
    categoryFilter: 'all',
    experienceFilter: 'all',
    workModeFilter: 'all',
    sortOrder: 'newest',
    currentView: 'all', // 'all' | 'saved'
    savedIds: getSavedListingIds(),
    currentPage: 1,
    pageSize: 6,
    status: 'loading', // 'loading' | 'success' | 'empty' | 'error'
    errorMessage: '',
    selectedListing: null
  };

  // DOM Elements Cache
  const elements = {
    tabAllListings: document.getElementById('tab-all-listings'),
    tabSavedListings: document.getElementById('tab-saved-listings'),
    savedCountBadge: document.getElementById('saved-count-badge'),
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    categorySelect: document.getElementById('category-filter'),
    experienceSelect: document.getElementById('experience-filter'),
    workModeSelect: document.getElementById('workmode-filter'),
    sortSelect: document.getElementById('sort-order'),
    pageSizeSelect: document.getElementById('page-size'),
    resetFiltersBtn: document.getElementById('reset-filters-btn'),
    resultsCount: document.getElementById('results-count'),
    activeFiltersContainer: document.getElementById('active-filters-container'),
    listingsContainer: document.getElementById('listings-container'),
    paginationContainer: document.getElementById('pagination-container'),
    modalBackdrop: document.getElementById('details-modal'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalContentContainer: document.getElementById('modal-content-container')
  };

  /**
   * Safe URL protocol validator to prevent javascript: or unsafe schemes.
   * @param {string} url
   * @returns {boolean}
   */
  function isSafeExternalUrl(url) {
    if (typeof url !== 'string') return false;
    try {
      const parsed = new URL(url, window.location.href);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  /**
   * Utility: Format ISO date string into readable English date.
   * @param {string} isoString
   * @returns {string}
   */
  function formatDisplayDate(isoString) {
    if (!isoString) return 'Recent';
    try {
      const parts = isoString.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[monthIndex] || 'Oct'} ${day}, ${year}`;
      }
      return isoString;
    } catch {
      return isoString;
    }
  }

  /**
   * Higher-order debounce utility for throttling high-frequency events.
   * @param {Function} func
   * @param {number} delay
   * @returns {Function}
   */
  function debounce(func, delay = 275) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(null, args);
      }, delay);
    };
  }

  /**
   * Safely highlights matching substrings using DOM text nodes and <mark> elements.
   * Completely avoids unsafe innerHTML injection.
   * @param {string} text
   * @param {string} query
   * @returns {DocumentFragment}
   */
  function createHighlightedFragment(text, query) {
    const fragment = document.createDocumentFragment();
    if (!text) return fragment;

    const trimmedQuery = query ? query.trim() : '';
    if (!trimmedQuery) {
      fragment.appendChild(document.createTextNode(text));
      return fragment;
    }

    // Escape regex special characters in query string
    const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);

    parts.forEach((part) => {
      if (part.toLowerCase() === trimmedQuery.toLowerCase()) {
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = part;
        fragment.appendChild(mark);
      } else if (part.length > 0) {
        fragment.appendChild(document.createTextNode(part));
      }
    });

    return fragment;
  }

  /**
   * Updates the count badge on the Saved Listings tab.
   */
  function updateSavedBadgeCount() {
    if (elements.savedCountBadge) {
      elements.savedCountBadge.textContent = String(state.savedIds.size);
    }
  }

  /**
   * Toggles bookmark state for a listing ID, saves to localStorage, and updates UI.
   * @param {string} id
   */
  function toggleBookmark(id) {
    const isSaved = state.savedIds.has(id);
    if (isSaved) {
      state.savedIds.delete(id);
    } else {
      state.savedIds.add(id);
    }

    persistSavedListingIds(state.savedIds);
    updateSavedBadgeCount();

    // If currently in Saved view, re-filter so removed item disappears smoothly
    if (state.currentView === 'saved') {
      applyFiltersAndSort();
    } else {
      // Update bookmark button state in rendered card
      const cardBtn = document.querySelector(`.bookmark-btn[data-id="${id}"]`);
      if (cardBtn) {
        const nowSaved = state.savedIds.has(id);
        cardBtn.classList.toggle('bookmarked', nowSaved);
        cardBtn.setAttribute('aria-pressed', nowSaved ? 'true' : 'false');
        cardBtn.setAttribute('aria-label', nowSaved ? 'Remove from saved listings' : 'Save listing');
        cardBtn.title = nowSaved ? 'Remove from saved' : 'Save listing';
        const svg = cardBtn.querySelector('svg');
        if (svg) {
          svg.setAttribute('fill', nowSaved ? 'currentColor' : 'none');
        }
      }
    }

    // Update modal bookmark button if open
    updateModalBookmarkButton(id);
  }

  /**
   * Synchronizes the modal bookmark button with current saved state.
   * @param {string} [id]
   */
  function updateModalBookmarkButton(id) {
    if (!state.selectedListing) return;
    if (id && state.selectedListing.id !== id) return;

    const modalBtn = document.getElementById('modal-bookmark-toggle');
    if (!modalBtn) return;

    const isSaved = state.savedIds.has(state.selectedListing.id);
    modalBtn.classList.toggle('bookmarked', isSaved);
    modalBtn.setAttribute('aria-pressed', isSaved ? 'true' : 'false');
    modalBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 15px; height: 15px; flex-shrink: 0;">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
      <span>${isSaved ? 'Saved' : 'Save Listing'}</span>
    `;
  }

  /**
   * Fetch listings dataset via Fetch API with robust error handling and multi-path resolution.
   */
  async function loadListingsData() {
    state.status = 'loading';
    state.errorMessage = '';
    renderDashboard();

    try {
      // Resolve candidate URLs to handle GitHub Pages subpaths and root domains
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      let repoSubpath = '';
      if (pathParts.length > 0) {
        const dirParts = pathParts[pathParts.length - 1].includes('.') ? pathParts.slice(0, -1) : pathParts;
        if (dirParts.length > 0) {
          repoSubpath = '/' + dirParts.join('/') + '/';
        }
      }

      const candidateUrls = [
        'data/listings.json',
        './data/listings.json',
        repoSubpath ? repoSubpath + 'data/listings.json' : null,
        '/data/listings.json'
      ].filter(Boolean);

      let data = null;
      let lastErr = null;

      for (const url of candidateUrls) {
        try {
          const response = await fetch(url, { cache: 'no-cache' });
          if (response.ok) {
            const parsed = await response.json();
            if (Array.isArray(parsed) && parsed.length > 0) {
              data = parsed;
              break;
            }
          }
        } catch (e) {
          lastErr = e;
        }
      }

      if (!data) {
        throw new Error(lastErr instanceof Error ? lastErr.message : 'Unable to retrieve listings dataset from server');
      }

      // Basic data sanitization and default fallback fields
      state.allListings = data.map((item, index) => ({
        id: String(item.id || `listing-${index + 1}`),
        title: String(item.title || 'Untitled Opportunity'),
        company: String(item.company || 'Sample Organization'),
        category: String(item.category || 'General'),
        experienceLevel: String(item.experienceLevel || 'Entry Level'),
        workMode: String(item.workMode || 'Hybrid'),
        location: String(item.location || 'Flexible'),
        skills: Array.isArray(item.skills) ? item.skills.map(String) : [],
        description: String(item.description || 'No description provided.'),
        postedDate: String(item.postedDate || '2026-10-01'),
        applicationUrl: isSafeExternalUrl(item.applicationUrl) ? item.applicationUrl : '#'
      }));

      updateSavedBadgeCount();
      applyFiltersAndSort();
    } catch (err) {
      state.status = 'error';
      state.errorMessage = err instanceof Error ? err.message : 'An error occurred while loading listings.';
      renderDashboard();
    }
  }

  /**
   * Combined Filters (Logical AND), Search Matching, Saved View Filter, and Immutable Sorting.
   */
  function applyFiltersAndSort() {
    const query = state.searchQuery.trim().toLowerCase().replace(/\s+/g, ' ');

    // 1. Filter dataset with Logical AND across all criteria
    const filtered = state.allListings.filter((item) => {
      // Saved View constraint
      if (state.currentView === 'saved' && !state.savedIds.has(item.id)) {
        return false;
      }

      // Search matching across title, company, skills, description, location
      if (query) {
        const titleMatch = item.title.toLowerCase().includes(query);
        const companyMatch = item.company.toLowerCase().includes(query);
        const descMatch = item.description.toLowerCase().includes(query);
        const locationMatch = item.location.toLowerCase().includes(query);
        const skillsMatch = item.skills.some((skill) => skill.toLowerCase().includes(query));

        if (!titleMatch && !companyMatch && !descMatch && !locationMatch && !skillsMatch) {
          return false;
        }
      }

      // Category / Domain filter
      if (state.categoryFilter !== 'all' && item.category !== state.categoryFilter) {
        return false;
      }

      // Experience Level filter
      if (state.experienceFilter !== 'all' && item.experienceLevel !== state.experienceFilter) {
        return false;
      }

      // Work Mode filter
      if (state.workModeFilter !== 'all' && item.workMode !== state.workModeFilter) {
        return false;
      }

      return true;
    });

    // 2. Immutable Sorting (shallow copy to prevent mutating source data)
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

    state.filteredListings = sorted;

    // 3. Page Clamping: Handle when filtering reduces total pages
    const totalPages = Math.max(1, Math.ceil(state.filteredListings.length / state.pageSize));
    if (state.currentPage > totalPages) {
      state.currentPage = 1;
    }

    // 4. Update status based on results length
    if (state.filteredListings.length === 0) {
      state.status = 'empty';
    } else {
      state.status = 'success';
    }

    renderDashboard();
  }

  /**
   * Main Render Coordinator.
   */
  function renderDashboard() {
    renderResultsBar();
    renderMainContent();
    renderPagination();
  }

  /**
   * Renders the status bar showing total results and active filter tags.
   */
  function renderResultsBar() {
    if (!elements.resultsCount || !elements.activeFiltersContainer) return;

    elements.activeFiltersContainer.innerHTML = '';

    if (state.status === 'loading') {
      elements.resultsCount.textContent = 'Loading listings...';
      return;
    }

    if (state.status === 'error') {
      elements.resultsCount.textContent = 'Error loading listings';
      return;
    }

    const total = state.filteredListings.length;
    const viewLabel = state.currentView === 'saved' ? 'saved listings' : 'listings';

    if (total === 0) {
      elements.resultsCount.textContent = `0 ${viewLabel} found`;
    } else {
      const startIndex = (state.currentPage - 1) * state.pageSize + 1;
      const endIndex = Math.min(startIndex + state.pageSize - 1, total);
      elements.resultsCount.innerHTML = `Showing <span class="results-count-bold">${startIndex}–${endIndex}</span> of <span class="results-count-bold">${total}</span> ${viewLabel}`;
    }

    // Render active filter chips for easy removal
    const activeFilters = [];

    // Chip for Saved View mode
    if (state.currentView === 'saved') {
      activeFilters.push({
        label: 'View: Saved Listings',
        onRemove: () => {
          switchView('all');
        }
      });
    }

    if (state.searchQuery.trim()) {
      activeFilters.push({
        label: `Search: "${state.searchQuery.trim()}"`,
        onRemove: () => {
          state.searchQuery = '';
          if (elements.searchInput) elements.searchInput.value = '';
          if (elements.searchClearBtn) elements.searchClearBtn.classList.remove('visible');
          state.currentPage = 1;
          applyFiltersAndSort();
        }
      });
    }

    if (state.categoryFilter !== 'all') {
      activeFilters.push({
        label: `Category: ${state.categoryFilter}`,
        onRemove: () => {
          state.categoryFilter = 'all';
          if (elements.categorySelect) elements.categorySelect.value = 'all';
          state.currentPage = 1;
          applyFiltersAndSort();
        }
      });
    }

    if (state.experienceFilter !== 'all') {
      activeFilters.push({
        label: `Level: ${state.experienceFilter}`,
        onRemove: () => {
          state.experienceFilter = 'all';
          if (elements.experienceSelect) elements.experienceSelect.value = 'all';
          state.currentPage = 1;
          applyFiltersAndSort();
        }
      });
    }

    if (state.workModeFilter !== 'all') {
      activeFilters.push({
        label: `Mode: ${state.workModeFilter}`,
        onRemove: () => {
          state.workModeFilter = 'all';
          if (elements.workModeSelect) elements.workModeSelect.value = 'all';
          state.currentPage = 1;
          applyFiltersAndSort();
        }
      });
    }

    // Render chips
    activeFilters.forEach((filter) => {
      const chip = document.createElement('span');
      chip.className = 'active-filter-chip';

      const label = document.createElement('span');
      label.textContent = filter.label;
      chip.appendChild(label);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'active-filter-remove';
      removeBtn.setAttribute('type', 'button');
      removeBtn.setAttribute('aria-label', `Remove filter ${filter.label}`);
      removeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 12px; height: 12px; flex-shrink: 0;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
      removeBtn.addEventListener('click', filter.onRemove);

      chip.appendChild(removeBtn);
      elements.activeFiltersContainer.appendChild(chip);
    });
  }

  /**
   * Switches dashboard view tab ('all' or 'saved').
   * @param {'all' | 'saved'} view
   */
  function switchView(view) {
    if (state.currentView === view) return;
    state.currentView = view;

    if (elements.tabAllListings) {
      elements.tabAllListings.classList.toggle('active', view === 'all');
      elements.tabAllListings.setAttribute('aria-selected', view === 'all' ? 'true' : 'false');
    }

    if (elements.tabSavedListings) {
      elements.tabSavedListings.classList.toggle('active', view === 'saved');
      elements.tabSavedListings.setAttribute('aria-selected', view === 'saved' ? 'true' : 'false');
    }

    state.currentPage = 1;
    applyFiltersAndSort();
  }

  /**
   * Renders Main Content area based on current status.
   */
  function renderMainContent() {
    if (!elements.listingsContainer) return;
    elements.listingsContainer.innerHTML = '';

    switch (state.status) {
      case 'loading':
        renderLoadingSkeleton();
        break;
      case 'error':
        renderErrorState();
        break;
      case 'empty':
        renderEmptyState();
        break;
      case 'success':
        renderSuccessCards();
        break;
    }
  }

  /**
   * Renders Skeleton loading cards matching the grid layout.
   */
  function renderLoadingSkeleton() {
    const fragment = document.createDocumentFragment();
    const count = state.pageSize || 6;

    for (let i = 0; i < count; i++) {
      const card = document.createElement('div');
      card.className = 'skeleton-card';
      card.setAttribute('aria-hidden', 'true');

      card.innerHTML = `
        <div class="skeleton-line skeleton-kicker"></div>
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-company"></div>
        <div class="skeleton-line skeleton-body-1"></div>
        <div class="skeleton-line skeleton-body-2"></div>
        <div class="skeleton-line skeleton-body-3"></div>
        <div class="skeleton-line skeleton-footer"></div>
      `;

      fragment.appendChild(card);
    }

    elements.listingsContainer.appendChild(fragment);
  }

  /**
   * Renders Error state with message and working Retry action.
   */
  function renderErrorState() {
    const errorWrapper = document.createElement('div');
    errorWrapper.className = 'state-error';
    errorWrapper.setAttribute('role', 'alert');

    const icon = document.createElement('div');
    icon.innerHTML = `<svg class="state-error-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 48px; height: 48px; max-width: 48px; max-height: 48px; flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    errorWrapper.appendChild(icon);

    const title = document.createElement('h3');
    title.className = 'state-error-title';
    title.textContent = 'Unable to Load Listings';
    errorWrapper.appendChild(title);

    const desc = document.createElement('p');
    desc.className = 'state-error-text';
    desc.textContent = state.errorMessage || 'An error occurred while communicating with the data source. Please check your connection.';
    errorWrapper.appendChild(desc);

    const actionsRow = document.createElement('div');
    actionsRow.style.display = 'flex';
    actionsRow.style.gap = '0.75rem';

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-primary';
    retryBtn.setAttribute('type', 'button');
    retryBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 16px; height: 16px; flex-shrink: 0;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> Try Again`;
    retryBtn.addEventListener('click', () => {
      loadListingsData();
    });
    actionsRow.appendChild(retryBtn);

    errorWrapper.appendChild(actionsRow);
    elements.listingsContainer.appendChild(errorWrapper);
  }

  /**
   * Renders Empty state when no listings match search, filters, or saved status.
   */
  function renderEmptyState() {
    const emptyWrapper = document.createElement('div');
    emptyWrapper.className = 'state-empty';

    const icon = document.createElement('div');

    if (state.currentView === 'saved' && state.savedIds.size === 0) {
      // User has no saved listings at all
      icon.innerHTML = `<svg class="state-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 48px; height: 48px; max-width: 48px; max-height: 48px; flex-shrink: 0;"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
      emptyWrapper.appendChild(icon);

      const title = document.createElement('h3');
      title.className = 'state-empty-title';
      title.textContent = 'No saved listings yet';
      emptyWrapper.appendChild(title);

      const text = document.createElement('p');
      text.className = 'state-empty-text';
      text.textContent = 'Click the bookmark icon on any opportunity card to save it here for quick access.';
      emptyWrapper.appendChild(text);

      const browseBtn = document.createElement('button');
      browseBtn.className = 'btn btn-primary';
      browseBtn.setAttribute('type', 'button');
      browseBtn.textContent = 'Browse All Listings';
      browseBtn.addEventListener('click', () => switchView('all'));
      emptyWrapper.appendChild(browseBtn);
    } else {
      // Standard filter empty state
      icon.innerHTML = `<svg class="state-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 48px; height: 48px; max-width: 48px; max-height: 48px; flex-shrink: 0;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>`;
      emptyWrapper.appendChild(icon);

      const title = document.createElement('h3');
      title.className = 'state-empty-title';
      title.textContent = state.currentView === 'saved' ? 'No matching saved listings' : 'No matching listings found';
      emptyWrapper.appendChild(title);

      const text = document.createElement('p');
      text.className = 'state-empty-text';
      text.textContent = 'Try adjusting your search terms, broadening your filter criteria, or clearing all active filters.';
      emptyWrapper.appendChild(text);

      const resetBtn = document.createElement('button');
      resetBtn.className = 'btn btn-secondary';
      resetBtn.setAttribute('type', 'button');
      resetBtn.textContent = 'Reset Filters';
      resetBtn.addEventListener('click', resetAllFilters);
      emptyWrapper.appendChild(resetBtn);
    }

    elements.listingsContainer.appendChild(emptyWrapper);
  }

  /**
   * Renders listing cards safely into the grid.
   */
  function renderSuccessCards() {
    const fragment = document.createDocumentFragment();

    const startIndex = (state.currentPage - 1) * state.pageSize;
    const paginatedItems = state.filteredListings.slice(startIndex, startIndex + state.pageSize);

    paginatedItems.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'listing-card';
      card.setAttribute('aria-labelledby', `title-${item.id}`);

      // 1. Header Row: Kicker Metadata + Bookmark Button
      const headerRow = document.createElement('div');
      headerRow.className = 'card-header-row';

      const kicker = document.createElement('div');
      kicker.className = 'card-kicker';

      const catSpan = document.createElement('span');
      catSpan.textContent = item.category;
      kicker.appendChild(catSpan);

      const sep1 = document.createElement('span');
      sep1.className = 'card-kicker-sep';
      sep1.textContent = '·';
      sep1.setAttribute('aria-hidden', 'true');
      kicker.appendChild(sep1);

      const expSpan = document.createElement('span');
      expSpan.textContent = item.experienceLevel;
      kicker.appendChild(expSpan);

      const sep2 = document.createElement('span');
      sep2.className = 'card-kicker-sep';
      sep2.textContent = '·';
      sep2.setAttribute('aria-hidden', 'true');
      kicker.appendChild(sep2);

      const modeSpan = document.createElement('span');
      modeSpan.textContent = item.workMode;
      kicker.appendChild(modeSpan);

      headerRow.appendChild(kicker);

      // Bookmark Button
      const isBookmarked = state.savedIds.has(item.id);
      const bookmarkBtn = document.createElement('button');
      bookmarkBtn.className = `bookmark-btn ${isBookmarked ? 'bookmarked' : ''}`;
      bookmarkBtn.setAttribute('type', 'button');
      bookmarkBtn.setAttribute('data-id', item.id);
      bookmarkBtn.setAttribute('aria-pressed', isBookmarked ? 'true' : 'false');
      bookmarkBtn.setAttribute('aria-label', isBookmarked ? `Remove ${item.title} from saved listings` : `Save ${item.title}`);
      bookmarkBtn.title = isBookmarked ? 'Remove from saved' : 'Save listing';
      bookmarkBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 16px; height: 16px; flex-shrink: 0;">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
      bookmarkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleBookmark(item.id);
      });
      headerRow.appendChild(bookmarkBtn);

      card.appendChild(headerRow);

      // 2. Title with safe search highlight
      const title = document.createElement('h3');
      title.id = `title-${item.id}`;
      title.className = 'card-title';
      title.appendChild(createHighlightedFragment(item.title, state.searchQuery));
      card.appendChild(title);

      // 3. Company & Location row
      const companyRow = document.createElement('div');
      companyRow.className = 'card-company-row';

      const companyText = document.createElement('span');
      companyText.appendChild(createHighlightedFragment(item.company, state.searchQuery));
      companyRow.appendChild(companyText);

      const sepComp = document.createElement('span');
      sepComp.className = 'card-kicker-sep';
      sepComp.textContent = '—';
      sepComp.setAttribute('aria-hidden', 'true');
      companyRow.appendChild(sepComp);

      const locText = document.createElement('span');
      locText.className = 'card-location';
      locText.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 12px; height: 12px; flex-shrink: 0;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
      const locLabel = document.createElement('span');
      locLabel.appendChild(createHighlightedFragment(item.location, state.searchQuery));
      locText.appendChild(locLabel);
      companyRow.appendChild(locText);

      card.appendChild(companyRow);

      // 4. Description with safe search highlight
      const desc = document.createElement('p');
      desc.className = 'card-description';
      desc.appendChild(createHighlightedFragment(item.description, state.searchQuery));
      card.appendChild(desc);

      // 5. Skills Tags (Clean metadata tags)
      if (item.skills && item.skills.length > 0) {
        const skillsSection = document.createElement('div');
        skillsSection.className = 'card-skills-section';

        const skillsLabel = document.createElement('div');
        skillsLabel.className = 'card-skills-label';
        skillsLabel.textContent = 'Required Skills';
        skillsSection.appendChild(skillsLabel);

        const skillsList = document.createElement('div');
        skillsList.className = 'card-skills-list';

        item.skills.forEach((skill) => {
          const tag = document.createElement('span');
          tag.className = 'card-skill-tag';
          tag.appendChild(createHighlightedFragment(skill, state.searchQuery));
          skillsList.appendChild(tag);
        });

        skillsSection.appendChild(skillsList);
        card.appendChild(skillsSection);
      }

      // 6. Card Footer: Posted date and actions
      const footer = document.createElement('div');
      footer.className = 'card-footer';

      const dateText = document.createElement('span');
      dateText.className = 'card-date';
      dateText.textContent = `Posted ${formatDisplayDate(item.postedDate)}`;
      footer.appendChild(dateText);

      const actions = document.createElement('div');
      actions.className = 'card-actions';

      const detailsBtn = document.createElement('button');
      detailsBtn.className = 'btn btn-secondary btn-sm';
      detailsBtn.setAttribute('type', 'button');
      detailsBtn.textContent = 'Details';
      detailsBtn.addEventListener('click', () => openListingModal(item));
      actions.appendChild(detailsBtn);

      const applyLink = document.createElement('a');
      applyLink.className = 'btn btn-primary btn-sm';
      applyLink.href = item.applicationUrl;
      applyLink.target = '_blank';
      applyLink.rel = 'noopener noreferrer';
      applyLink.setAttribute('aria-label', `View details for ${item.title} (opens external reference link)`);
      applyLink.innerHTML = `View <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 12px; height: 12px; flex-shrink: 0;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
      actions.appendChild(applyLink);

      footer.appendChild(actions);
      card.appendChild(footer);

      fragment.appendChild(card);
    });

    elements.listingsContainer.appendChild(fragment);
  }

  /**
   * Renders Pagination Controls.
   */
  function renderPagination() {
    if (!elements.paginationContainer) return;
    elements.paginationContainer.innerHTML = '';

    if (state.status !== 'success' || state.filteredListings.length === 0) {
      elements.paginationContainer.style.display = 'none';
      return;
    }

    elements.paginationContainer.style.display = 'flex';

    const totalPages = Math.max(1, Math.ceil(state.filteredListings.length / state.pageSize));

    const info = document.createElement('div');
    info.className = 'pagination-info';
    info.textContent = `Page ${state.currentPage} of ${totalPages}`;
    elements.paginationContainer.appendChild(info);

    const controls = document.createElement('div');
    controls.className = 'pagination-controls';

    // Previous Button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.setAttribute('type', 'button');
    prevBtn.setAttribute('aria-label', 'Previous Page');
    prevBtn.disabled = state.currentPage === 1;
    prevBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 16px; height: 16px; flex-shrink: 0;"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
    prevBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage -= 1;
        renderDashboard();
        scrollToTop();
      }
    });
    controls.appendChild(prevBtn);

    // Page Number Buttons
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `page-btn ${pageNum === state.currentPage ? 'active' : ''}`;
      pageBtn.setAttribute('type', 'button');
      pageBtn.setAttribute('aria-label', `Go to page ${pageNum}`);
      if (pageNum === state.currentPage) {
        pageBtn.setAttribute('aria-current', 'page');
      }
      pageBtn.textContent = String(pageNum);
      pageBtn.addEventListener('click', () => {
        if (state.currentPage !== pageNum) {
          state.currentPage = pageNum;
          renderDashboard();
          scrollToTop();
        }
      });
      controls.appendChild(pageBtn);
    }

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.setAttribute('type', 'button');
    nextBtn.setAttribute('aria-label', 'Next Page');
    nextBtn.disabled = state.currentPage === totalPages;
    nextBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 16px; height: 16px; flex-shrink: 0;"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
    nextBtn.addEventListener('click', () => {
      if (state.currentPage < totalPages) {
        state.currentPage += 1;
        renderDashboard();
        scrollToTop();
      }
    });
    controls.appendChild(nextBtn);

    elements.paginationContainer.appendChild(controls);
  }

  /**
   * Smoothly scrolls to the top of listings when changing pages.
   */
  function scrollToTop() {
    const anchor = document.getElementById('listings-heading');
    if (anchor) {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Resets all filters, search query, sorting, and pagination back to defaults.
   */
  function resetAllFilters() {
    state.searchQuery = '';
    state.categoryFilter = 'all';
    state.experienceFilter = 'all';
    state.workModeFilter = 'all';
    state.sortOrder = 'newest';
    state.currentPage = 1;

    if (elements.searchInput) elements.searchInput.value = '';
    if (elements.searchClearBtn) elements.searchClearBtn.classList.remove('visible');
    if (elements.categorySelect) elements.categorySelect.value = 'all';
    if (elements.experienceSelect) elements.experienceSelect.value = 'all';
    if (elements.workModeSelect) elements.workModeSelect.value = 'all';
    if (elements.sortSelect) elements.sortSelect.value = 'newest';

    applyFiltersAndSort();
  }

  /**
   * Opens the Listing Details modal.
   * @param {Object} item
   */
  function openListingModal(item) {
    if (!elements.modalBackdrop || !elements.modalContentContainer) return;
    state.selectedListing = item;

    elements.modalContentContainer.innerHTML = '';

    // Title
    const headerDiv = document.createElement('div');
    headerDiv.className = 'modal-header';

    const titleGroup = document.createElement('div');
    const kicker = document.createElement('div');
    kicker.className = 'modal-kicker';
    kicker.textContent = `${item.category} · ${item.experienceLevel} · ${item.workMode}`;
    titleGroup.appendChild(kicker);

    const title = document.createElement('h2');
    title.className = 'modal-title';
    title.id = 'modal-title';
    title.textContent = item.title;
    titleGroup.appendChild(title);
    headerDiv.appendChild(titleGroup);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close-btn';
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Close details modal');
    closeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 20px; height: 20px; flex-shrink: 0;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    closeBtn.addEventListener('click', closeListingModal);
    headerDiv.appendChild(closeBtn);

    elements.modalContentContainer.appendChild(headerDiv);

    // Metadata Grid
    const metaGrid = document.createElement('div');
    metaGrid.className = 'modal-meta-grid';

    const metaItems = [
      { label: 'Company / Project', value: item.company },
      { label: 'Location', value: item.location },
      { label: 'Work Mode', value: item.workMode },
      { label: 'Posted Date', value: formatDisplayDate(item.postedDate) }
    ];

    metaItems.forEach((m) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'modal-meta-item';

      const label = document.createElement('span');
      label.className = 'modal-meta-label';
      label.textContent = m.label;
      itemDiv.appendChild(label);

      const val = document.createElement('span');
      val.className = 'modal-meta-value';
      val.textContent = m.value;
      itemDiv.appendChild(val);

      metaGrid.appendChild(itemDiv);
    });

    elements.modalContentContainer.appendChild(metaGrid);

    // Description Section
    const descTitle = document.createElement('h3');
    descTitle.className = 'modal-section-title';
    descTitle.textContent = 'Role Overview & Responsibilities';
    elements.modalContentContainer.appendChild(descTitle);

    const desc = document.createElement('p');
    desc.className = 'modal-description';
    desc.textContent = item.description;
    elements.modalContentContainer.appendChild(desc);

    // Skills Section
    if (item.skills && item.skills.length > 0) {
      const skillsTitle = document.createElement('h3');
      skillsTitle.className = 'modal-section-title';
      skillsTitle.textContent = 'Target Skills & Technologies';
      elements.modalContentContainer.appendChild(skillsTitle);

      const skillsList = document.createElement('div');
      skillsList.className = 'card-skills-list';
      skillsList.style.marginBottom = '1.25rem';

      item.skills.forEach((skill) => {
        const tag = document.createElement('span');
        tag.className = 'card-skill-tag';
        tag.textContent = skill;
        skillsList.appendChild(tag);
      });

      elements.modalContentContainer.appendChild(skillsList);
    }

    // Disclaimer Box
    const disclaimer = document.createElement('div');
    disclaimer.className = 'modal-disclaimer-box';
    disclaimer.innerHTML = `<strong>Notice:</strong> This is an illustrative listing for demonstration purposes. Clicking the button below opens an external reference link (<code>example.com</code>).`;
    elements.modalContentContainer.appendChild(disclaimer);

    // Modal Footer
    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    // Bookmark button in modal
    const isBookmarked = state.savedIds.has(item.id);
    const modalBookmarkBtn = document.createElement('button');
    modalBookmarkBtn.id = 'modal-bookmark-toggle';
    modalBookmarkBtn.className = `btn btn-secondary modal-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}`;
    modalBookmarkBtn.setAttribute('type', 'button');
    modalBookmarkBtn.setAttribute('aria-pressed', isBookmarked ? 'true' : 'false');
    modalBookmarkBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 15px; height: 15px; flex-shrink: 0;">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      </svg>
      <span>${isBookmarked ? 'Saved' : 'Save Listing'}</span>
    `;
    modalBookmarkBtn.addEventListener('click', () => {
      toggleBookmark(item.id);
    });
    footer.appendChild(modalBookmarkBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.setAttribute('type', 'button');
    cancelBtn.textContent = 'Close';
    cancelBtn.addEventListener('click', closeListingModal);
    footer.appendChild(cancelBtn);

    const applyBtn = document.createElement('a');
    applyBtn.className = 'btn btn-primary';
    applyBtn.href = item.applicationUrl;
    applyBtn.target = '_blank';
    applyBtn.rel = 'noopener noreferrer';
    applyBtn.innerHTML = `View Reference Link <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width: 14px; height: 14px; flex-shrink: 0;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
    footer.appendChild(applyBtn);

    elements.modalContentContainer.appendChild(footer);

    // Open modal
    elements.modalBackdrop.classList.add('open');
    elements.modalBackdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Closes the Listing Details modal.
   */
  function closeListingModal() {
    if (!elements.modalBackdrop) return;
    elements.modalBackdrop.classList.remove('open');
    elements.modalBackdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    state.selectedListing = null;
  }

  /**
   * Bind event listeners for input and controls.
   */
  function setupEventListeners() {
    // View Tabs (All Listings vs. Saved Listings)
    if (elements.tabAllListings) {
      elements.tabAllListings.addEventListener('click', () => {
        switchView('all');
      });
    }

    if (elements.tabSavedListings) {
      elements.tabSavedListings.addEventListener('click', () => {
        switchView('saved');
      });
    }

    // 1. Debounced Search Input
    const debouncedSearch = debounce((query) => {
      state.searchQuery = query;
      state.currentPage = 1;
      applyFiltersAndSort();
    }, 275);

    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (elements.searchClearBtn) {
          if (val.length > 0) {
            elements.searchClearBtn.classList.add('visible');
          } else {
            elements.searchClearBtn.classList.remove('visible');
          }
        }
        debouncedSearch(val);
      });
    }

    // 2. Clear Search Button
    if (elements.searchClearBtn) {
      elements.searchClearBtn.addEventListener('click', () => {
        if (elements.searchInput) {
          elements.searchInput.value = '';
          elements.searchInput.focus();
        }
        elements.searchClearBtn.classList.remove('visible');
        state.searchQuery = '';
        state.currentPage = 1;
        applyFiltersAndSort();
      });
    }

    // 3. Category Filter Select
    if (elements.categorySelect) {
      elements.categorySelect.addEventListener('change', (e) => {
        state.categoryFilter = e.target.value;
        state.currentPage = 1;
        applyFiltersAndSort();
      });
    }

    // 4. Experience Level Filter Select
    if (elements.experienceSelect) {
      elements.experienceSelect.addEventListener('change', (e) => {
        state.experienceFilter = e.target.value;
        state.currentPage = 1;
        applyFiltersAndSort();
      });
    }

    // 5. Work Mode Filter Select
    if (elements.workModeSelect) {
      elements.workModeSelect.addEventListener('change', (e) => {
        state.workModeFilter = e.target.value;
        state.currentPage = 1;
        applyFiltersAndSort();
      });
    }

    // 6. Sort Order Select
    if (elements.sortSelect) {
      elements.sortSelect.addEventListener('change', (e) => {
        state.sortOrder = e.target.value;
        state.currentPage = 1;
        applyFiltersAndSort();
      });
    }

    // 7. Page Size Select
    if (elements.pageSizeSelect) {
      elements.pageSizeSelect.addEventListener('change', (e) => {
        state.pageSize = parseInt(e.target.value, 10) || 6;
        state.currentPage = 1;
        applyFiltersAndSort();
      });
    }

    // 8. Reset All Filters Button
    if (elements.resetFiltersBtn) {
      elements.resetFiltersBtn.addEventListener('click', resetAllFilters);
    }

    // 9. Modal Backdrop Click and Keyboard Escape
    if (elements.modalBackdrop) {
      elements.modalBackdrop.addEventListener('click', (e) => {
        if (e.target === elements.modalBackdrop) {
          closeListingModal();
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.modalBackdrop && elements.modalBackdrop.classList.contains('open')) {
        closeListingModal();
      }
    });
  }

  // Application Entry Point
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadListingsData();
  });
})();
