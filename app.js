/*
  Deployments Explorer - minimal client-side parser and UI
  - Loads deployments.md
  - Parses sections (### Title) followed by a markdown table
  - Normalizes to entries: { category, title, rows: [{ network, address, explorer, args, salt }] }
  - Search, network/category filters, cards/table view
*/

(function () {
  const state = {
    rawMarkdown: '',
    entries: [],
    networks: new Set(),
    categories: new Set(),
    search: '',
    filters: { network: '', category: '' },
    view: 'cards'
  };

  const els = {
    status: document.getElementById('statusText'),
    results: document.getElementById('results'),
    search: document.getElementById('searchInput'),
    networkFilter: document.getElementById('networkFilter'),
    categoryFilter: document.getElementById('categoryFilter'),
    viewMode: document.getElementById('viewMode'),
    loadFileBtn: document.getElementById('loadFileBtn'),
    fileInput: document.getElementById('fileInput'),
    cardTemplate: document.getElementById('cardTemplate'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    modalCloseBtn: document.getElementById('modalCloseBtn')
  };

  // Load markdown either via fetch or user file upload fallback
  async function init() {
    wireEvents();
    try {
      const res = await fetch('./deployments.md', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      state.rawMarkdown = await res.text();
      parseAndRender();
    } catch (err) {
      els.status.textContent = 'Could not auto-load deployments.md (likely due to file:// CORS). Use "Load file" to select it from disk.';
    }
  }

  function wireEvents() {
    els.search.addEventListener('input', (e) => {
      state.search = e.target.value.trim();
      render();
    });
    els.networkFilter.addEventListener('change', (e) => {
      state.filters.network = e.target.value;
      render();
    });
    els.categoryFilter.addEventListener('change', (e) => {
      state.filters.category = e.target.value;
      render();
    });
    els.viewMode.addEventListener('change', (e) => {
      state.view = e.target.value;
      render();
    });
    els.loadFileBtn.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      state.rawMarkdown = await file.text();
      parseAndRender();
    });

    // Modal events
    els.modal.addEventListener('click', (e) => {
      if (e.target === els.modal) closeModal();
    });
    els.modalCloseBtn.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.modal.hidden) closeModal();
    });
  }

  function parseAndRender() {
    const { entries, networks, categories } = parseMarkdown(state.rawMarkdown);
    state.entries = entries;
    state.networks = networks;
    state.categories = categories;
    populateFilters();
    els.status.textContent = `Loaded ${entries.length} sections · ${networks.size} networks`;
    render();
  }

  // Parser: find each '### Title' followed by a markdown table (Network | Address | Explorer | Constructor Args | Salt)
  function parseMarkdown(md) {
    const lines = md.split(/\r?\n/);
    const entries = [];
    const networks = new Set();
    const categories = new Set();

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const h3 = line.match(/^###\s+(.+?)\s*$/);
      if (h3) {
        const title = h3[1].trim();
        // Capture category from the nearest preceding H2 if present
        const category = findNearestCategory(lines, i);
        categories.add(category);

        // Look ahead for a table header row
        let j = i + 1;
        // Skip blank lines
        while (j < lines.length && /^\s*$/.test(lines[j])) j++;
        // Expect a header like: | Network | Address | Explorer | Constructor Args | Salt |
        if (j < lines.length && /\|\s*Network\s*\|\s*Address\s*\|/i.test(lines[j])) {
          // Skip header and separator line
          const headerLine = lines[j];
          const sepLine = lines[j + 1] || '';
          j += 2;
          const rows = [];
          while (j < lines.length) {
            const row = lines[j];
            if (!/^\|/.test(row)) break; // table ended
            const cells = splitMarkdownRow(row);
            if (cells.length >= 5) {
              const obj = {
                network: cells[0],
                address: cells[1],
                explorer: cells[2],
                args: cells[3],
                salt: cells[4]
              };
              if (obj.network) networks.add(obj.network);
              rows.push(obj);
            }
            j++;
          }
          entries.push({ category, title, rows });
          i = j;
          continue;
        }
      }
      i++;
    }
    return { entries, networks, categories };
  }

  function findNearestCategory(lines, index) {
    for (let k = index - 1; k >= 0; k--) {
      const m = lines[k].match(/^##\s+(.+?)\s*$/);
      if (m) return m[1].trim();
    }
    return 'Uncategorized';
  }

  function splitMarkdownRow(row) {
    // Remove leading and trailing '|' then split on '|'
    const parts = row.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map(s => s.trim());
    // Map "[Link](url)" to url and keep anchor text
    // Cells order: Network | Address | Explorer | Constructor Args | Salt
    const clean = parts.map((cell, idx) => {
      if (idx === 2) { // Explorer column -> extract URL
        const m = cell.match(/\(([^)]+)\)/);
        return m ? m[1] : cell;
      }
      return cell;
    });
    return clean;
  }

  function populateFilters() {
    fillSelect(els.networkFilter, ['', ...Array.from(state.networks).sort()]);
    fillSelect(els.categoryFilter, ['', ...Array.from(state.categories).sort()]);
  }

  function fillSelect(sel, values) {
    const current = sel.value;
    sel.innerHTML = '';
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v === '' ? 'All' : v;
      sel.appendChild(opt);
    });
    if (values.includes(current)) sel.value = current;
  }

  function render() {
    const { search, filters, view } = state;
    const q = search.toLowerCase();
    const filtered = state.entries
      .filter(e => !filters.category || e.category === filters.category)
      .map(e => ({
        ...e,
        rows: e.rows.filter(r => {
          const matchesNetwork = !filters.network || r.network === filters.network;
          if (!matchesNetwork) return false;
          if (!q) return true;
          const hay = `${e.title} ${e.category} ${r.network} ${r.address} ${r.explorer} ${r.args} ${r.salt}`.toLowerCase();
          return hay.includes(q);
        })
      }))
      .filter(e => e.rows.length > 0);

    // Update container class for view
    els.results.className = 'results ' + (view === 'table' ? 'table' : 'cards');
    els.results.innerHTML = '';

    if (view === 'table') {
      renderBigTable(filtered);
    } else {
      renderCards(filtered);
    }
    document.getElementById('statusText').textContent = `${filtered.length} sections shown`;
  }

  function renderCards(list) {
    const frag = document.createDocumentFragment();
    for (const entry of list) {
      const card = els.cardTemplate.content.firstElementChild.cloneNode(true);
      card.querySelector('.card-title').textContent = entry.title;
      card.querySelector('.badge.category').textContent = entry.category;
      // Chips: unique networks count, rows count
      const networks = Array.from(new Set(entry.rows.map(r => r.network))).sort();
      const chipRow = card.querySelector('.chip-row');
      chipRow.appendChild(makeChip(`${networks.join(', ')}`));
      chipRow.appendChild(makeChip(`${entry.rows.length} entr${entry.rows.length === 1 ? 'y' : 'ies'}`));

      // Modal open
      const btn = card.querySelector('.collapse-btn');
      btn.addEventListener('click', () => openEntryModal(entry));
      frag.appendChild(card);
    }
    els.results.appendChild(frag);
  }

  function renderBigTable(list) {
    const table = document.createElement('table');
    table.className = 'big';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Category</th>
          <th>Title</th>
          <th>Network</th>
          <th>Address</th>
          <th>Explorer</th>
          <th>Constructor Args</th>
          <th>Salt</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    for (const entry of list) {
      for (const r of entry.rows) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(entry.category)}</td>
          <td>${escapeHtml(entry.title)}</td>
          <td>${escapeHtml(r.network)}</td>
          <td class="addr">${escapeHtml(r.address)}</td>
          <td>${r.explorer && r.explorer.startsWith('http') ? `<a href="${escapeAttr(r.explorer)}" target="_blank" rel="noreferrer">open</a>` : ''}</td>
          <td>${escapeHtml(r.args)}</td>
          <td>${escapeHtml(r.salt)}</td>
        `;
        tbody.appendChild(tr);
      }
    }
    els.results.appendChild(table);
  }

  function makeChip(text) {
    const span = document.createElement('span');
    span.className = 'chip';
    span.textContent = text;
    return span;
  }

  function openEntryModal(entry) {
    els.modalTitle.textContent = `${entry.title} — ${entry.category}`;
    els.modalBody.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'mini-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Network</th>
          <th>Address</th>
          <th>Explorer</th>
          <th>Constructor Args</th>
          <th>Salt</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    for (const r of entry.rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(r.network)}</td>
        <td class="addr">${escapeHtml(r.address)}</td>
        <td>${r.explorer && r.explorer.startsWith('http') ? `<a href="${escapeAttr(r.explorer)}" target="_blank" rel="noreferrer">open</a>` : ''}</td>
        <td>${escapeHtml(r.args)}</td>
        <td>${escapeHtml(r.salt)}</td>
      `;
      tbody.appendChild(tr);
    }
    els.modalBody.appendChild(table);
    openModal();
  }

  function openModal() {
    els.modal.hidden = false;
  }
  function closeModal() {
    els.modal.hidden = true;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }

  // Boot
  init();
})();


