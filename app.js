/**
 * Cornerstone Connect — Main Application Scripts
 * Implements OCR scanning, contact parsing, vCard export, search/filter, and storage.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- State Variables ---
  let customBusinesses = [];
  let activeTab = 'explore';
  let activeCategory = 'All';
  let currentTheme = 'light';
  let editingBusinessId = null; // Track contact edits
  let tesseractWorker = null; // Lazy loaded

  // Real-Time Sync State
  const SYNC_BUCKET = '6Z8C7D2wX3yZ8vQ4tB5u';
  let mySyncCode = null;
  let isClientMode = false;

  // Branding Customization State
  let brandName = "Cornerstone Connect";
  let brandSlogan = "Mindy's Trusted Local Network \u00b7 Slow down. Restore. Return to you.";
  let brandColor = "#5f6654";
  let brandLogo = ""; // base64 representation

  // --- Elements ---
  const tabButtons = document.querySelectorAll('.bottom-nav button');
  const viewPanels = document.querySelectorAll('.view-panel');
  const searchInput = document.getElementById('search-input');
  const categoryPillsContainer = document.getElementById('category-pills-container');
  const directoryList = document.getElementById('directory-list');
  const themeToggle = document.getElementById('theme-toggle');
  const toast = document.getElementById('toast');

  // Scanner Elements
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('hidden-file-input');
  const previewContainer = document.getElementById('preview-container');
  const imagePreview = document.getElementById('card-image-preview');
  const ocrProgressContainer = document.getElementById('ocr-progress-container');
  const ocrProgressBar = document.getElementById('ocr-progress-bar');
  const ocrProgressText = document.getElementById('ocr-progress-text');
  const verificationPanel = document.getElementById('verification-panel');
  const rawTextContent = document.getElementById('raw-text-content');

  // Forms Elements
  const manualForm = document.getElementById('manual-entry-form');
  const verifyForm = document.getElementById('verify-entry-form');

  // Backup Elements
  const exportBtn = document.getElementById('btn-export');
  const importInput = document.getElementById('import-file-input');
  const resetBtn = document.getElementById('btn-reset');

  // Share Modal Elements
  const shareModal = document.getElementById('share-modal');
  const btnCloseShare = document.getElementById('btn-close-share');
  const btnShareSms = document.getElementById('btn-share-sms');
  const btnShareWa = document.getElementById('btn-share-wa');
  const btnShareCopy = document.getElementById('btn-share-copy');

  // --- Initialize App ---
  function init() {
    // 0. Register PWA Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Service Worker registered successfully!', reg.scope))
        .catch(err => console.error('Service Worker registration failed:', err));
    }

    // 1. Apply Custom Branding Settings
    applyBranding();

    // 1. Load Theme
    const savedTheme = localStorage.getItem('cornerstone_theme');
    if (savedTheme) {
      currentTheme = savedTheme;
      document.documentElement.setAttribute('data-theme', currentTheme);
      updateThemeIcon();
    }

    // 2. Load Custom Businesses
    const savedData = localStorage.getItem('cornerstone_custom_businesses');
    if (savedData) {
      try {
        customBusinesses = JSON.parse(savedData);
      } catch (e) {
        console.error("Failed to parse custom businesses:", e);
        customBusinesses = [];
      }
    }

    // 3. Render Categories Filter
    renderCategoryPills();

    // 4. Setup Forms Category Selects
    populateCategoryDropdowns();

    // 5. Check URL Query Parameters for client mode and setup sync
    const urlParams = new URLSearchParams(window.location.search);
    const syncParam = urlParams.get('sync');
    const tabParam = urlParams.get('tab');
    const searchParam = urlParams.get('search');

    if (syncParam) {
      isClientMode = true;
      mySyncCode = syncParam.toUpperCase();
      
      // Hide navigation header & footer for a premium self-contained guest experience
      document.getElementById('main-header').style.display = 'none';
      document.querySelector('.bottom-nav').style.display = 'none';
      
      // Show custom welcome header
      document.getElementById('client-welcome-header').style.display = 'block';
      
      // Show client-only toggles
      document.querySelectorAll('.client-only-toggle').forEach(el => {
        el.style.display = 'block';
      });

      // Setup client toggle links click listeners
      document.querySelectorAll('.client-toggle-view').forEach(link => {
        link.addEventListener('click', () => {
          if (activeTab === 'scan') {
            switchTab('manual');
          } else {
            switchTab('scan');
          }
        });
      });
      
      // Default client views to scan or manual
      const startTab = (tabParam === 'manual' || tabParam === 'add-client') ? 'manual' : 'scan';
      switchTab(startTab);
    } else {
      // Mindy/Owner Mode Setup
      let storedSyncCode = localStorage.getItem('cornerstone_sync_code');
      if (!storedSyncCode) {
        const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        storedSyncCode = `OHNS-${randStr}`;
        localStorage.setItem('cornerstone_sync_code', storedSyncCode);
      }
      mySyncCode = storedSyncCode;
      
      // Render QR code & Sync controls
      setupSyncControls();
      
      // Start polling
      startPollingLoop();

      // Render Directory Listings
      renderDirectory();

      // Check search parameter link
      if (searchParam) {
        searchInput.value = searchParam;
        renderDirectory();
      }
    }
  }

  // --- Theme Toggle ---
  themeToggle.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('cornerstone_theme', currentTheme);
    updateThemeIcon();
    showToast(`Switched to ${currentTheme} theme`);
  });

  function updateThemeIcon() {
    if (currentTheme === 'dark') {
      themeToggle.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z"/></svg>
      `;
    } else {
      themeToggle.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
      `;
    }
  }

  // --- Tab Management ---
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  function switchTab(tabId) {
    activeTab = tabId;
    
    // Update nav buttons
    tabButtons.forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update panels
    viewPanels.forEach(panel => {
      if (panel.id === `${tabId}-panel`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Reset temporary states on tab leave
    if (tabId !== 'scan') {
      resetScanState();
    }

    // Handle manual tab edit mode switching
    if (tabId === 'manual') {
      if (!editingBusinessId) {
        resetManualFormEditMode();
      }
    } else if (editingBusinessId && tabId !== 'manual') {
      resetManualFormEditMode();
    }
  }

  function resetScanState() {
    previewContainer.classList.remove('scanning');
    previewContainer.classList.remove('active');
    imagePreview.src = '';
    ocrProgressContainer.classList.remove('active');
    verificationPanel.style.display = 'none';
    verifyForm.reset();
  }

  // --- Categories & Filtering ---
  function renderCategoryPills() {
    categoryPillsContainer.innerHTML = '';
    const allPill = document.createElement('button');
    allPill.className = `category-pill ${activeCategory === 'All' ? 'active' : ''}`;
    allPill.textContent = 'All';
    allPill.addEventListener('click', () => selectCategory('All'));
    categoryPillsContainer.appendChild(allPill);

    CATEGORIES.forEach(cat => {
      const pill = document.createElement('button');
      pill.className = `category-pill ${activeCategory === cat ? 'active' : ''}`;
      pill.textContent = cat;
      pill.addEventListener('click', () => selectCategory(cat));
      categoryPillsContainer.appendChild(pill);
    });
  }

  function selectCategory(category) {
    activeCategory = category;
    renderCategoryPills();
    renderDirectory();
  }

  function populateCategoryDropdowns() {
    const dropdowns = [
      document.getElementById('manual-category'),
      document.getElementById('verify-category')
    ];

    dropdowns.forEach(select => {
      if (!select) return;
      select.innerHTML = '';
      CATEGORIES.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
      });
    });
  }

  // --- Directory Rendering ---
  function getCombinedList() {
    // Merge seed data with user added data
    // Local additions/edits override default seed listings with matching IDs.
    const customWithBadges = customBusinesses.map(b => ({ ...b, isCustom: true }));
    const filteredDefaults = DEFAULT_DIRECTORY.filter(
      d => !customBusinesses.some(c => c.id === d.id)
    );
    return [...filteredDefaults, ...customWithBadges];
  }

  function renderDirectory() {
    directoryList.innerHTML = '';
    const combined = getCombinedList();
    const query = searchInput.value.toLowerCase().trim();

    // Filter list
    const filtered = combined.filter(biz => {
      const matchesCategory = activeCategory === 'All' || biz.category === activeCategory;
      const matchesSearch = !query || 
        biz.name.toLowerCase().includes(query) ||
        biz.category.toLowerCase().includes(query) ||
        (biz.owner && biz.owner.toLowerCase().includes(query)) ||
        (biz.notes && biz.notes.toLowerCase().includes(query)) ||
        (biz.address && biz.address.toLowerCase().includes(query)) ||
        (biz.phone && biz.phone.toLowerCase().includes(query)) ||
        (biz.email && biz.email.toLowerCase().includes(query)) ||
        (biz.website && biz.website.toLowerCase().includes(query));
      
      return matchesCategory && matchesSearch;
    });

    // Sort order: Featured first, then alphabetical by Business Name
    filtered.sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return a.name.localeCompare(b.name);
    });

    if (filtered.length === 0) {
      directoryList.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <p>No businesses found matching your criteria.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(biz => {
      const card = document.createElement('div');
      card.className = `business-card ${biz.isFeatured ? 'featured' : ''}`;
      
      let badgeHtml = '';
      if (biz.isFeatured) {
        badgeHtml = `<span class="card-badge">Partner</span>`;
      } else if (biz.isCustom) {
        badgeHtml = `<span class="card-badge" style="background: rgba(180,127,92,0.12); color: var(--accent-copper); border-color: rgba(180,127,92,0.2)">My Circle</span>`;
      }

      // Generate HTML links for contact details
      const phoneLink = biz.phone ? `<a href="tel:${biz.phone.replace(/[^0-9+]/g, '')}" class="contact-item">
        <svg viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
        <span>${escapeHtml(biz.phone)}</span>
      </a>` : '';

      const emailLink = biz.email ? `<a href="mailto:${biz.email}" class="contact-item">
        <svg viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        <span>${escapeHtml(biz.email)}</span>
      </a>` : '';

      // Normalize website URL for linking
      let webHref = biz.website;
      if (webHref && !webHref.startsWith('http://') && !webHref.startsWith('https://')) {
        webHref = 'https://' + webHref;
      }
      const websiteLink = biz.website ? `<a href="${webHref}" target="_blank" rel="noopener" class="contact-item">
        <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
        <span>${escapeHtml(biz.website)}</span>
      </a>` : '';

      const addressLink = biz.address ? `<a href="https://maps.google.com/?q=${encodeURIComponent(biz.address)}" target="_blank" rel="noopener" class="contact-item address">
        <svg viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span>${escapeHtml(biz.address)}</span>
      </a>` : '';

      const socialInfo = biz.social ? `<div class="contact-item">
        <svg viewBox="0 0 24 24"><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zM17.5 6.5h.01"/></svg>
        <span>${escapeHtml(biz.social)}</span>
      </div>` : '';

      // Generate action buttons
      // Directions button
      let directionsBtnHtml = '';
      if (biz.address) {
        directionsBtnHtml = `
          <a href="https://maps.google.com/?q=${encodeURIComponent(biz.address)}" target="_blank" rel="noopener" class="btn-secondary btn-directions" title="Get Directions">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            Directions
          </a>
        `;
      }

      // Share button
      const shareBtnHtml = `
        <button class="btn-secondary btn-share" data-id="${biz.id}" title="Share Referral">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          Share
        </button>
      `;

      const editBtnHtml = `
        <button class="btn-icon btn-edit" data-id="${biz.id}" title="Edit Listing">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      `;

      let deleteBtnHtml = '';
      if (biz.isCustom) {
        deleteBtnHtml = `
          <button class="btn-icon btn-delete" data-id="${biz.id}" title="Delete Listing">
            <svg viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        `;
      }

      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-group">
            <h3>${escapeHtml(biz.name)}</h3>
            ${biz.owner ? `<div class="owner-name">Owner: ${escapeHtml(biz.owner)}</div>` : ''}
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            <span class="card-badge">${escapeHtml(biz.category)}</span>
            ${badgeHtml}
          </div>
        </div>
        <div class="card-body">
          ${biz.notes ? `<p class="card-notes">"${escapeHtml(biz.notes)}"</p>` : ''}
          <div class="contact-info-list">
            ${phoneLink}
            ${emailLink}
            ${websiteLink}
            ${addressLink}
            ${socialInfo}
          </div>
        </div>
        <div class="card-actions">
          <button class="btn-secondary btn-vcard" data-id="${biz.id}" title="Save to Contacts">
            <svg viewBox="0 0 24 24"><path d="M8.684 10.742l5.474-2.737m0 7.99l-5.474-2.737m7.894-3.523a3 3 0 11-6 0 3 3 0 016 0zM5.316 19.262a3 3 0 11-6 0 3 3 0 016 0zM17.368 4.21a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Save
          </button>
          ${directionsBtnHtml}
          ${shareBtnHtml}
          <div class="card-actions-right">
            ${editBtnHtml}
            ${deleteBtnHtml}
          </div>
        </div>
      `;

      directoryList.appendChild(card);
    });

    // Attach list action listeners
    attachCardActionListeners();
  }

  function attachCardActionListeners() {
    // Delete Button Listener
    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        deleteBusiness(id);
      });
    });

    // Save to Contacts (vCard) Listener
    document.querySelectorAll('.btn-vcard').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const biz = getCombinedList().find(b => b.id === id);
        if (biz) {
          triggerVCardDownload(biz);
        }
      });
    });

    // Edit Button Listener
    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        startEditingBusiness(id);
      });
    });

    // Share Referral Listener
    document.querySelectorAll('.btn-share').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const biz = getCombinedList().find(b => b.id === id);
        if (biz) {
          handleShareBusiness(biz);
        }
      });
    });
  }

  function startEditingBusiness(id) {
    const combined = getCombinedList();
    const biz = combined.find(b => b.id === id);
    if (!biz) return;

    editingBusinessId = id;

    // Fill manual form fields
    document.getElementById('manual-name').value = biz.name || '';
    document.getElementById('manual-category').value = biz.category || CATEGORIES[0];
    document.getElementById('manual-owner').value = biz.owner || '';
    document.getElementById('manual-phone').value = biz.phone || '';
    document.getElementById('manual-email').value = biz.email || '';
    document.getElementById('manual-website').value = biz.website || '';
    document.getElementById('manual-address').value = biz.address || '';
    document.getElementById('manual-social').value = biz.social || '';
    document.getElementById('manual-notes').value = biz.notes || '';

    // Update panel titles for edit mode
    document.querySelector('#manual-panel .section-title').textContent = 'Edit Business Details';
    const submitBtn = document.querySelector('#manual-entry-form button[type="submit"]');
    submitBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>
      Save Changes
    `;

    // Navigate to manual tab
    switchTab('manual');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetManualFormEditMode() {
    editingBusinessId = null;
    document.querySelector('#manual-panel .section-title').textContent = 'Add Business Listing';
    const submitBtn = document.querySelector('#manual-entry-form button[type="submit"]');
    submitBtn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
      Add to Directory
    `;
    manualForm.reset();
  }

  // Live search listener
  searchInput.addEventListener('input', () => {
    renderDirectory();
  });

  // --- Delete Business ---
  function deleteBusiness(id) {
    if (confirm("Are you sure you want to delete this business from your list?")) {
      customBusinesses = customBusinesses.filter(b => b.id !== id);
      localStorage.setItem('cornerstone_custom_businesses', JSON.stringify(customBusinesses));
      renderDirectory();
      showToast("Business deleted from list");
    }
  }

  // --- Dynamic vCard (.vcf) Generator ---
  function triggerVCardDownload(biz) {
    // Format VCard content (Version 3.0 standard)
    // Escapes commas, semicolons, and colons.
    const sanitize = (val) => {
      if (!val) return '';
      return val.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    };

    let vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${sanitize(biz.name)}`,
      `ORG:${sanitize(biz.name)}`
    ];

    if (biz.owner) {
      vcard.push(`N:${sanitize(biz.owner.split(' ').reverse().join(';'))};;;`); // Split lastName;firstName
      vcard.push(`TITLE:${sanitize(biz.owner)}`);
    } else {
      vcard.push(`N:;;;;`);
    }

    if (biz.phone) {
      vcard.push(`TEL;TYPE=WORK,VOICE:${sanitize(biz.phone)}`);
    }
    
    if (biz.email) {
      vcard.push(`EMAIL;TYPE=PREF,INTERNET:${sanitize(biz.email)}`);
    }

    if (biz.website) {
      vcard.push(`URL;TYPE=WORK:${sanitize(biz.website)}`);
    }

    if (biz.address) {
      vcard.push(`ADR;TYPE=WORK:;;${sanitize(biz.address)};;;;`);
    }

    // Add extra details into notes field
    let notesArr = [];
    if (biz.category) notesArr.push(`Category: ${biz.category}`);
    if (biz.social) notesArr.push(`Socials: ${biz.social}`);
    if (biz.notes) notesArr.push(`Notes: ${biz.notes}`);
    notesArr.push(`Recommended by Mindy's Local Network`);

    vcard.push(`NOTE:${sanitize(notesArr.join(' | '))}`);
    vcard.push('END:VCARD');

    const vcardContent = vcard.join('\r\n');
    const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${biz.name.replace(/[^a-zA-Z0-9]/g, '_')}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`Shared "${biz.name}" vCard file`);
  }

  // --- OCR Card Scanner Integration ---
  
  // Drag and drop / file picker clicks
  uploadArea.addEventListener('click', () => fileInput.click());

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--accent-gold)';
    uploadArea.style.backgroundColor = 'var(--bg-input)';
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = 'var(--border)';
    uploadArea.style.backgroundColor = 'var(--bg-card)';
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--border)';
    uploadArea.style.backgroundColor = 'var(--bg-card)';
    
    if (e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  });

  // client vCard file picker integration
  const clientVcardBtn = document.getElementById('btn-vcard-import-client');
  const clientVcardInput = document.getElementById('client-vcard-input');
  
  if (clientVcardBtn && clientVcardInput) {
    clientVcardBtn.addEventListener('click', () => clientVcardInput.click());
    
    clientVcardInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = function(event) {
        try {
          const text = event.target.result;
          const biz = parseVCardText(text);
          
          if (!biz.name) {
            showToast("Failed to parse contact card. Please check the file.");
            return;
          }
          
          // Pre-fill the verification form with parsed data
          document.getElementById('verify-name').value = biz.name;
          document.getElementById('verify-category').value = biz.category;
          document.getElementById('verify-owner').value = biz.owner;
          document.getElementById('verify-phone').value = biz.phone;
          document.getElementById('verify-email').value = biz.email;
          document.getElementById('verify-website').value = biz.website;
          document.getElementById('verify-address').value = biz.address;
          document.getElementById('verify-social').value = biz.social || '';
          document.getElementById('verify-notes').value = biz.notes;
          
          // Display the verification panel and scroll to it
          previewContainer.classList.remove('scanning');
          previewContainer.classList.remove('active');
          ocrProgressContainer.classList.remove('active');
          
          rawTextContent.textContent = text;
          verificationPanel.style.display = 'block';
          
          showToast("Contact card loaded! Please verify the details.");
          verificationPanel.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
          console.error("VCF parse error:", err);
          showToast("Error reading contact card file.");
        }
        clientVcardInput.value = ''; // Reset input
      };
      reader.readAsText(file);
    });
  }

  function parseVCardText(text) {
    const lines = text.split(/\r?\n/);
    const biz = {
      name: '',
      category: 'Other',
      owner: '',
      phone: '',
      email: '',
      website: '',
      address: '',
      social: '',
      notes: 'Imported via contact card file (.vcf)'
    };

    let orgName = '';
    let formattedName = '';
    
    lines.forEach(line => {
      const upperLine = line.toUpperCase();
      if (upperLine.startsWith('FN:')) {
        formattedName = line.substring(3).trim();
      } else if (upperLine.startsWith('ORG:')) {
        const orgParts = line.substring(4).split(';');
        orgName = orgParts[0].trim();
      } else if (upperLine.startsWith('TEL;') || upperLine.startsWith('TEL:')) {
        const parts = line.split(':');
        if (parts.length > 1) {
          biz.phone = parts[1].trim();
        }
      } else if (upperLine.startsWith('EMAIL;') || upperLine.startsWith('EMAIL:')) {
        const parts = line.split(':');
        if (parts.length > 1) {
          biz.email = parts[1].trim();
        }
      } else if (upperLine.startsWith('URL;') || upperLine.startsWith('URL:')) {
        const parts = line.split(':');
        if (parts.length > 1) {
          biz.website = parts.slice(1).join(':').trim();
        }
      } else if (upperLine.startsWith('ADR;') || upperLine.startsWith('ADR:')) {
        const parts = line.split(':');
        if (parts.length > 1) {
          const adrParts = parts[1].split(';').map(p => p.trim()).filter(p => p.length > 0);
          biz.address = adrParts.join(', ');
        }
      } else if (upperLine.startsWith('NOTE;') || upperLine.startsWith('NOTE:')) {
        const parts = line.split(':');
        if (parts.length > 1) {
          biz.notes = parts.slice(1).join(':').trim().replace(/\\n/g, '\n').replace(/\\,/g, ',');
        }
      } else if (upperLine.startsWith('X-SOCIALPROFILE;') || upperLine.startsWith('X-SOCIALPROFILE:')) {
        const parts = line.split(':');
        if (parts.length > 1) {
          biz.social = parts[1].trim();
        }
      }
    });

    if (orgName && formattedName) {
      biz.name = orgName;
      biz.owner = formattedName;
    } else if (orgName) {
      biz.name = orgName;
      biz.owner = '';
    } else if (formattedName) {
      biz.name = formattedName;
      biz.owner = formattedName;
    }

    if (biz.name) {
      const nameLower = biz.name.toLowerCase();
      if (/\b(nail|hair|salon|spa|beauty|barber|aesthetic|skincare|wellness|massage)\b/.test(nameLower)) {
        biz.category = 'Beauty & Wellness';
      } else if (/\b(real|realtor|realty|estate|agent|broker|home|inspect|house)\b/.test(nameLower)) {
        biz.category = 'Real Estate';
      } else if (/\b(plumb|ac|heat|electric|roof|landscape|garden|construct|repair|handy)\b/.test(nameLower)) {
        biz.category = 'Home Services';
      } else if (/\b(cpa|account|tax|law|attorney|legal|consult|advisor)\b/.test(nameLower)) {
        biz.category = 'Professional Services';
      } else if (/\b(coffee|cafe|bakery|restaurant|bites|sweet|pub|dine|eat|food|beverage)\b/.test(nameLower)) {
        biz.category = 'Food & Beverage';
      } else if (/\b(boutique|shop|posh|store|cloth|retail|wear)\b/.test(nameLower)) {
        biz.category = 'Retail & Boutiques';
      } else if (/\b(chiro|clinic|dent|medic|doctor|therapy|pharm)\b/.test(nameLower)) {
        biz.category = 'Health & Medical';
      }
    }

    return biz;
  }

  function preprocessImage(imageSrc) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Scale down massive images to optimize performance
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        try {
          const imgData = ctx.getImageData(0, 0, width, height);
          const d = imgData.data;
          const contrast = 128; // strong contrast enhancement
          const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
          
          for (let i = 0; i < d.length; i += 4) {
            // Convert to grayscale
            let gray = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
            // Apply high contrast boost
            let newVal = factor * (gray - 128) + 128;
            newVal = Math.max(0, Math.min(255, newVal));
            
            d[i] = newVal;     // Red
            d[i+1] = newVal;   // Green
            d[i+2] = newVal;   // Blue
          }
          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (e) {
          console.warn("Image threshold processing skipped:", e);
          resolve(imageSrc);
        }
      };
      img.onerror = () => resolve(imageSrc);
      img.src = imageSrc;
    });
  }

  function processFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast("Please upload an image file of the business card.");
      return;
    }

    // Display Preview
    const reader = new FileReader();
    reader.onload = function(event) {
      previewContainer.classList.add('active');
      previewContainer.classList.add('scanning');
      ocrProgressContainer.classList.add('active');
      
      preprocessImage(event.target.result).then(processedSrc => {
        imagePreview.src = processedSrc;
        // Run OCR with optimized image
        runOCR(processedSrc);
      });
    };
    reader.readAsDataURL(file);
  }

  function runOCR(imageSrc) {
    updateOCRProgress(10, 'Initializing OCR reader...');
    
    // Perform Client-Side recognition using loaded Tesseract library
    if (typeof Tesseract === 'undefined') {
      showToast("OCR Library loading error. Please ensure internet is connected.");
      previewContainer.classList.remove('scanning');
      ocrProgressContainer.classList.remove('active');
      return;
    }

    Tesseract.recognize(
      imageSrc,
      'eng',
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(m.progress * 100);
            updateOCRProgress(40 + (m.progress * 60), `Reading card content... ${pct}%`);
          } else {
            updateOCRProgress(20, `Analyzing layout: ${m.status}...`);
          }
        }
      }
    ).then(({ data: { text } }) => {
      previewContainer.classList.remove('scanning');
      ocrProgressContainer.classList.remove('active');
      
      // Show Verification Panel
      rawTextContent.textContent = text;
      verificationPanel.style.display = 'block';
      
      // Parse details
      parseCardTextAndFillForm(text);
      showToast("Scan finished! Please verify fields.");
      
      // Scroll to form
      verificationPanel.scrollIntoView({ behavior: 'smooth' });
    }).catch(err => {
      console.error("Tesseract scan error:", err);
      previewContainer.classList.remove('scanning');
      ocrProgressContainer.classList.remove('active');
      showToast("Card scanning failed. Please try a clearer picture or fill in manually.");
    });
  }

  function updateOCRProgress(percent, label) {
    ocrProgressBar.style.width = `${percent}%`;
    ocrProgressText.textContent = label;
  }

  // --- OCR Card Text Parser (Regex Heuristics) ---
  function parseCardTextAndFillForm(text) {
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/g;
    const urlRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/\S*)?/gi;

    let parsedEmail = '';
    let parsedPhone = '';
    let parsedWebsite = '';
    let parsedAddress = '';
    let parsedSocial = '';
    let unusedLines = [];

    // 1. Scan for obvious lines (Email, Phone, Websites)
    lines.forEach(line => {
      let isMatched = false;

      // Extract Email
      const emailMatches = line.match(emailRegex);
      if (emailMatches && !parsedEmail) {
        parsedEmail = emailMatches[0];
        isMatched = true;
      }

      // Extract Phone
      const phoneMatches = line.match(phoneRegex);
      if (phoneMatches && !parsedPhone) {
        parsedPhone = phoneMatches[0];
        isMatched = true;
      }

      // Extract Website URL (ensure it isn't the email we just extracted)
      const urlMatches = line.match(urlRegex);
      if (urlMatches && !isMatched) {
        const primaryUrl = urlMatches[0];
        if (!primaryUrl.includes('@')) {
          parsedWebsite = primaryUrl.toLowerCase();
          isMatched = true;
        }
      }

      // Extract Addresses (keywords like St, Ave, Road, Hwy, Slidell, ZIP code formats)
      const addressKeywords = /\b(street|st|ave|avenue|rd|road|blvd|boulevard|hwy|highway|ln|lane|ct|court|suite|ste|slidell|la|7045\d|7046\d)\b/i;
      if (addressKeywords.test(line) && !isMatched) {
        if (parsedAddress) {
          parsedAddress += ', ' + line;
        } else {
          parsedAddress = line;
        }
        isMatched = true;
      }

      // Extract Social Handles
      if ((line.includes('@') || line.toLowerCase().includes('instagram') || line.toLowerCase().includes('fb.com')) && !isMatched) {
        const handle = line.match(/@[a-zA-Z0-9._-]+/);
        if (handle) {
          parsedSocial = handle[0];
        } else {
          parsedSocial = line;
        }
        isMatched = true;
      }

      if (!isMatched) {
        unusedLines.push(line);
      }
    });

    // 2. Identify Business Name & Owner from remaining text
    let parsedBusinessName = '';
    let parsedOwner = '';

    if (unusedLines.length > 0) {
      // Typically, business cards put the Business Name first (in large text)
      // or Owner/Contact name.
      // Clean lines to remove trash characters (symbols, lone numbers)
      const cleanUnused = unusedLines.filter(l => l.replace(/[^a-zA-Z]/g, '').length > 3);
      
      if (cleanUnused.length > 0) {
        // Simple heuristic: The first line is usually the business name (or contact)
        parsedBusinessName = cleanUnused[0];
      }
      if (cleanUnused.length > 1) {
        // Second line is the owner/title
        parsedOwner = cleanUnused[1];
      }
    }

    // Auto-categorize based on parsed text keywords
    let autoCategory = 'Other';
    const textLower = text.toLowerCase();
    
    if (/\b(nail|hair|salon|spa|beauty|barber|aesthetic|skincare|wellness|massage)\b/.test(textLower)) {
      autoCategory = 'Beauty & Wellness';
    } else if (/\b(real|realtor|realty|estate|agent|broker|home|inspect|house)\b/.test(textLower)) {
      autoCategory = 'Real Estate';
    } else if (/\b(plumb|ac|heat|electric|roof|landscape|garden|construct|repair|handy)\b/.test(textLower)) {
      autoCategory = 'Home Services';
    } else if (/\b(cpa|account|tax|law|attorney|legal|consult|advisor)\b/.test(textLower)) {
      autoCategory = 'Professional Services';
    } else if (/\b(coffee|cafe|bakery|restaurant|bites|sweet|pub|dine|eat|food|beverage)\b/.test(textLower)) {
      autoCategory = 'Food & Beverage';
    } else if (/\b(boutique|shop|posh|store|cloth|retail|wear)\b/.test(textLower)) {
      autoCategory = 'Retail & Boutiques';
    } else if (/\b(chiro|clinic|dent|medic|doctor|therapy|pharm)\b/.test(textLower)) {
      autoCategory = 'Health & Medical';
    }

    // Fill form fields
    document.getElementById('verify-name').value = parsedBusinessName;
    document.getElementById('verify-category').value = autoCategory;
    document.getElementById('verify-owner').value = parsedOwner;
    document.getElementById('verify-phone').value = parsedPhone;
    document.getElementById('verify-email').value = parsedEmail;
    document.getElementById('verify-website').value = parsedWebsite;
    document.getElementById('verify-address').value = parsedAddress;
    document.getElementById('verify-social').value = parsedSocial;
    document.getElementById('verify-notes').value = 'Scanned via business card OCR';
  }

  // --- Custom Branding Helpers & Handlers ---

  function applyBranding() {
    brandName = localStorage.getItem('cornerstone_brand_name') || "Cornerstone Connect";
    brandSlogan = localStorage.getItem('cornerstone_brand_slogan') || "Mindy's Trusted Local Network \u00b7 Slow down. Restore. Return to you.";
    brandColor = localStorage.getItem('cornerstone_brand_color') || "#5f6654";
    brandLogo = localStorage.getItem('cornerstone_brand_logo') || "";

    // Apply color accent to CSS Variables dynamically
    if (brandColor) {
      document.documentElement.style.setProperty('--accent-olive', brandColor);
      document.documentElement.style.setProperty('--accent-copper', brandColor);
    }

    // Update text content in header and screens
    const mainHeaderH1 = document.querySelector('#main-header h1');
    const mainHeaderP = document.querySelector('#main-header p');
    if (mainHeaderH1) mainHeaderH1.textContent = brandName;
    if (mainHeaderP) mainHeaderP.textContent = brandSlogan;

    const clientHeaderH1 = document.querySelector('#client-welcome-header h1');
    const clientHeaderSpan = document.querySelector('#client-welcome-header span');
    if (clientHeaderH1) clientHeaderH1.textContent = `Join ${brandName}`;
    if (clientHeaderSpan) clientHeaderSpan.textContent = `Add your business card to ${brandName}!`;

    const successP = document.querySelector('#client-success-screen p');
    if (successP) successP.innerHTML = `Your business listing has been successfully synced to <strong style="white-space: nowrap;">${escapeHtml(brandName)}</strong> in real-time.`;


    // Swap logos
    const logoSrc = brandLogo || "photos/ohns-logo-espresso.png";
    const mainLogoImg = document.getElementById('main-brand-logo');
    const clientLogoImg = document.getElementById('client-brand-logo');
    const successLogoImg = document.getElementById('success-brand-logo');
    
    if (mainLogoImg) mainLogoImg.src = logoSrc;
    if (clientLogoImg) clientLogoImg.src = logoSrc;
    if (successLogoImg) successLogoImg.src = logoSrc;

    // Load inputs in form if they exist
    const nameInput = document.getElementById('brand-name-input');
    const sloganInput = document.getElementById('brand-slogan-input');
    const colorInput = document.getElementById('brand-color-input');
    const colorHex = document.getElementById('brand-color-hex');

    if (nameInput) nameInput.value = brandName;
    if (sloganInput) sloganInput.value = brandSlogan;
    if (colorInput) {
      colorInput.value = brandColor;
      if (colorHex) colorHex.textContent = brandColor;
    }
  }

  // Set up color picker hex update
  const brandColorInput = document.getElementById('brand-color-input');
  const brandColorHex = document.getElementById('brand-color-hex');
  if (brandColorInput && brandColorHex) {
    brandColorInput.addEventListener('input', (e) => {
      brandColorHex.textContent = e.target.value;
    });
  }

  // Submit Handler for Branding
  const brandingForm = document.getElementById('branding-settings-form');
  if (brandingForm) {
    brandingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const newName = document.getElementById('brand-name-input').value.trim() || "Cornerstone Connect";
      const newSlogan = document.getElementById('brand-slogan-input').value.trim() || "Mindy's Trusted Local Network \u00b7 Slow down. Restore. Return to you.";
      const newColor = document.getElementById('brand-color-input').value;
      const logoFile = document.getElementById('brand-logo-input').files[0];

      localStorage.setItem('cornerstone_brand_name', newName);
      localStorage.setItem('cornerstone_brand_slogan', newSlogan);
      localStorage.setItem('cornerstone_brand_color', newColor);

      if (logoFile) {
        const reader = new FileReader();
        reader.onload = function(event) {
          localStorage.setItem('cornerstone_brand_logo', event.target.result);
          applyBranding();
          showToast("Custom branding saved successfully!");
        };
        reader.readAsDataURL(logoFile);
      } else {
        applyBranding();
        showToast("Custom branding saved successfully!");
      }
    });
  }

  // Reset Handler for Branding
  const resetBrandingBtn = document.getElementById('btn-reset-branding');
  if (resetBrandingBtn) {
    resetBrandingBtn.addEventListener('click', () => {
      if (confirm("Reset branding configurations back to defaults?")) {
        localStorage.removeItem('cornerstone_brand_name');
        localStorage.removeItem('cornerstone_brand_slogan');
        localStorage.removeItem('cornerstone_brand_color');
        localStorage.removeItem('cornerstone_brand_logo');
        
        applyBranding();
        
        // Reset file input value
        const logoInput = document.getElementById('brand-logo-input');
        if (logoInput) logoInput.value = '';
        
        showToast("Branding reset to default");
      }
    });
  }

  // --- Sync & Sharing Helpers ---
  
  function setupSyncControls() {
    const syncCodeInput = document.getElementById('sync-code-input');
    const qrImage = document.getElementById('sync-qr-code');
    const copyLinkBtn = document.getElementById('btn-copy-link');
    const localIpInput = document.getElementById('local-ip-input');
    
    if (!syncCodeInput || !qrImage) return;
    
    syncCodeInput.value = mySyncCode;
    
    function generateQR() {
      const baseUri = window.location.origin + window.location.pathname;
      let finalUri = baseUri;
      
      // If user typed a local IP, swap 'localhost' or '127.0.0.1' with it
      if (localIpInput && localIpInput.value.trim()) {
        const ip = localIpInput.value.trim();
        finalUri = finalUri.replace('localhost', ip).replace('127.0.0.1', ip);
      }
      
      const inviteUrl = `${finalUri}?sync=${mySyncCode}&tab=scan`;
      qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(inviteUrl)}&color=3b3128&bgcolor=fbf8f2`;
      
      // Update clipboard copy listener
      copyLinkBtn.onclick = () => {
        navigator.clipboard.writeText(inviteUrl).then(() => {
          showToast("Invite link copied to clipboard!");
        }).catch(err => {
          syncCodeInput.value = inviteUrl;
          syncCodeInput.select();
          document.execCommand('copy');
          syncCodeInput.value = mySyncCode;
          showToast("Link highlighted. Copy manually.");
        });
      };
    }
    
    if (localIpInput) {
      localIpInput.addEventListener('input', generateQR);
      
      // Pre-fill local IP if they've used it before
      const savedIp = localStorage.getItem('cornerstone_testing_ip');
      if (savedIp) {
        localIpInput.value = savedIp;
      }
      
      localIpInput.addEventListener('change', (e) => {
        localStorage.setItem('cornerstone_testing_ip', e.target.value.trim());
      });
    }
    
    generateQR();
  }

  let eventSource = null;
  let localPollInterval = null;

  function handleReceivedBiz(newBiz) {
    if (newBiz && newBiz.name) {
      // Avoid duplicate IDs
      if (!customBusinesses.some(b => b.id === newBiz.id)) {
        customBusinesses.push(newBiz);
        localStorage.setItem('cornerstone_custom_businesses', JSON.stringify(customBusinesses));
        renderDirectory();
        showToast(`Synced "${newBiz.name}" in real-time!`);
      }
    }
  }

  function startPollingLoop() {
    if (!mySyncCode || isClientMode) return;
    
    // --- 1. Cloud Sync (ntfy.sh via SSE) ---
    if (eventSource) eventSource.close();
    
    const topic = `ohns_sync_${mySyncCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    eventSource = new EventSource(`https://ntfy.sh/${topic}/sse`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'message') {
          const newBiz = JSON.parse(data.message);
          handleReceivedBiz(newBiz);
        }
      } catch (err) {
        console.warn("Sync message parsing error:", err);
      }
    };
    
    eventSource.onerror = (err) => {
      console.warn("Sync listener connection error. Reconnecting...", err);
    };

    // --- 2. Local Sync (Offline-first polling fallback) ---
    if (localPollInterval) clearInterval(localPollInterval);
    localPollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/sync?code=${encodeURIComponent(mySyncCode)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.messages && data.messages.length > 0) {
            data.messages.forEach(newBiz => {
              handleReceivedBiz(newBiz);
            });
          }
        }
      } catch (err) {
        // Silently fail if local server is not running or CustomHandler endpoint isn't active
      }
    }, 2000);
  }

  async function uploadListingToSync(biz) {
    const topic = `ohns_sync_${mySyncCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const url = `https://ntfy.sh/${topic}`;
    
    let localSuccess = false;
    let cloudSuccess = false;

    // 1. Try local sync first (Offline-first, direct same-origin route)
    try {
      const localUrl = `${window.location.origin}/api/sync`;
      const response = await fetch(localUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          syncCode: mySyncCode,
          business: biz
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          localSuccess = true;
          console.log("Local offline sync upload successful!");
        }
      }
    } catch (err) {
      console.warn("Local sync endpoint unavailable/failed:", err);
    }

    // 2. Try cloud sync (ntfy.sh) as backup/parallel channel
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(biz)
      });
      if (response.ok) {
        cloudSuccess = true;
        console.log("Cloud sync upload successful!");
      }
    } catch (err) {
      console.error("Cloud sync upload error:", err);
    }

    return localSuccess || cloudSuccess;
  }


  async function handleListingSave(newBiz, isScanForm = false) {
    if (isClientMode) {
      const submitBtn = isScanForm 
        ? document.querySelector('#verify-entry-form button[type="submit"]')
        : document.querySelector('#manual-entry-form button[type="submit"]');
      
      const originalHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"><circle cx="12" cy="12" r="10"/><path d="M12 2v4"/></svg>
        Syncing to salon...
      `;

      const success = await uploadListingToSync(newBiz);
      
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHtml;

      if (success) {
        // Hide forms and headers
        document.getElementById('scan-panel').classList.remove('active');
        document.getElementById('manual-panel').classList.remove('active');
        document.getElementById('client-welcome-header').style.display = 'none';
        
        // Show success screen
        const successScreen = document.getElementById('client-success-screen');
        successScreen.style.display = 'block';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast("Sync Successful!");
      } else {
        showToast("Sync failed. Check connection and try again.");
      }
    } else {
      if (editingBusinessId) {
        const existingIndex = customBusinesses.findIndex(b => b.id === editingBusinessId);
        if (existingIndex > -1) {
          customBusinesses[existingIndex] = newBiz;
        } else {
          customBusinesses.push(newBiz);
        }
        localStorage.setItem('cornerstone_custom_businesses', JSON.stringify(customBusinesses));
        showToast(`Updated "${newBiz.name}" details`);
      } else {
        saveNewBusiness(newBiz);
        showToast(`Added "${newBiz.name}" to directory`);
      }
      
      if (isScanForm) {
        resetScanState();
      } else {
        resetManualFormEditMode();
      }
      renderDirectory();
      switchTab('explore');
    }
  }

  function handleShareBusiness(biz) {
    const shareTitle = `${brandName} Recommendation: ${biz.name}`;
    const shareText = `Hi! Here is the contact info for ${biz.name}${biz.owner ? ` (${biz.owner})` : ''} from the ${brandName} directory:\n` +
      `${biz.phone ? `Phone: ${biz.phone}\n` : ''}` +
      `${biz.email ? `Email: ${biz.email}\n` : ''}` +
      `${biz.website ? `Web: ${biz.website}\n` : ''}` +
      `Category: ${biz.category}\n` +
      `Notes: ${biz.notes || 'Highly recommended!'}\n\n` +
      `Thank you for supporting Slidell's local business community. We are honored to connect you with trusted partners.`;
    
    const baseUri = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUri}?search=${encodeURIComponent(biz.name)}`;

    if (navigator.share) {
      navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl
      }).then(() => {
        showToast("Shared successfully!");
      }).catch(err => {
        if (err.name !== 'AbortError') {
          openShareModal(biz, shareText, shareUrl);
        }
      });
    } else {
      openShareModal(biz, shareText, shareUrl);
    }
  }

  function openShareModal(biz, shareText, shareUrl) {
    shareModal.style.display = 'flex';
    
    btnShareSms.onclick = () => {
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const separator = isIos ? '&' : '?';
      window.open(`sms:${separator}body=${encodeURIComponent(shareText + '\n' + shareUrl)}`, '_blank');
      closeShareModal();
    };

    btnShareWa.onclick = () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`, '_blank');
      closeShareModal();
    };

    btnShareCopy.onclick = () => {
      navigator.clipboard.writeText(`${shareText}\nLink: ${shareUrl}`).then(() => {
        showToast("Recommendation copied!");
      }).catch(err => {
        console.error("Failed to copy share text:", err);
      });
      closeShareModal();
    };
  }

  function closeShareModal() {
    shareModal.style.display = 'none';
  }

  // Close sharing modal event wiring
  if (btnCloseShare) {
    btnCloseShare.addEventListener('click', closeShareModal);
  }
  
  if (shareModal) {
    shareModal.addEventListener('click', (e) => {
      if (e.target === shareModal) {
        closeShareModal();
      }
    });
  }

  // --- Save / Submit Handlers ---

  // Manual Form Submission
  manualForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const inputName = document.getElementById('manual-name').value.trim();
    if (!inputName) {
      showToast("Business name is required.");
      return;
    }

    const newBiz = {
      id: editingBusinessId || 'biz-' + Date.now(),
      name: inputName,
      category: document.getElementById('manual-category').value,
      owner: document.getElementById('manual-owner').value.trim(),
      phone: document.getElementById('manual-phone').value.trim(),
      email: document.getElementById('manual-email').value.trim(),
      website: document.getElementById('manual-website').value.trim(),
      address: document.getElementById('manual-address').value.trim(),
      social: document.getElementById('manual-social').value.trim(),
      notes: document.getElementById('manual-notes').value.trim()
    };

    handleListingSave(newBiz, false);
  });

  // Verify Form Submission
  verifyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const newBiz = {
      id: 'biz-' + Date.now(),
      name: document.getElementById('verify-name').value.trim(),
      category: document.getElementById('verify-category').value,
      owner: document.getElementById('verify-owner').value.trim(),
      phone: document.getElementById('verify-phone').value.trim(),
      email: document.getElementById('verify-email').value.trim(),
      website: document.getElementById('verify-website').value.trim(),
      address: document.getElementById('verify-address').value.trim(),
      social: document.getElementById('verify-social').value.trim(),
      notes: document.getElementById('verify-notes').value.trim()
    };

    if (!newBiz.name) {
      showToast("Business name is required.");
      return;
    }

    handleListingSave(newBiz, true);
  });

  function saveNewBusiness(biz) {
    customBusinesses.push(biz);
    localStorage.setItem('cornerstone_custom_businesses', JSON.stringify(customBusinesses));
    renderDirectory();
  }

  // --- Export / Import Backup Management ---

  // Export JSON
  exportBtn.addEventListener('click', () => {
    if (customBusinesses.length === 0) {
      showToast("No custom entries to export.");
      return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(customBusinesses, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `cornerstone_connect_backup_${Date.now()}.json`);
    dlAnchorElem.click();
    showToast("Directory network backup downloaded");
  });

  // Import JSON
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const importedData = JSON.parse(event.target.result);
        
        // Basic schema validation
        if (Array.isArray(importedData)) {
          let validCount = 0;
          importedData.forEach(item => {
            if (item.name && item.category) {
              // De-duplicate: replace existing matching id, or add as new
              const existingIndex = customBusinesses.findIndex(b => b.id === item.id);
              if (existingIndex > -1) {
                customBusinesses[existingIndex] = item;
              } else {
                // Ensure unique ID
                if (!item.id) item.id = 'biz-' + Math.random().toString(36).substr(2, 9);
                customBusinesses.push(item);
              }
              validCount++;
            }
          });

          localStorage.setItem('cornerstone_custom_businesses', JSON.stringify(customBusinesses));
          renderDirectory();
          showToast(`Successfully imported ${validCount} business contacts`);
        } else {
          showToast("Invalid backup file format.");
        }
      } catch (err) {
        console.error("Backup parse error:", err);
        showToast("Error importing file. Ensure it is a valid JSON backup.");
      }
      importInput.value = ''; // Reset input
    };
    reader.readAsText(file);
  });

  // Reset Storage to Seed Defaults
  resetBtn.addEventListener('click', () => {
    if (confirm("This will erase ALL your manually added and scanned business listings. Default seed listings will remain. Continue?")) {
      customBusinesses = [];
      localStorage.removeItem('cornerstone_custom_businesses');
      renderDirectory();
      showToast("Directory reset to default listings");
    }
  });

  // --- UI Toast Notifications Helper ---
  let toastTimer = null;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  // Helper function to escape HTML special characters for safety
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --- Run Init ---
  init();
});
