let cachedBreaches = [];
let allResults = [];
let currentPage = 1;
let searchGeneration = 0;
let loadingMoreBreaches = 0;
const PAGE_SIZE = 100;
const SEARCH_KEYWORDS = ['name', 'uuid', 'id', 'pii', 'extra', 'socials', 'note'];

function formatPhoneNumber(digits) {
    if (digits.length === 10)
        return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits[0] === '1')
        return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
    return digits;
}

// Add entries here to handle new field types. `match` is tested against the field key name.
const KEY_RENDERERS = [
    {
        match: /phone|mobile|cell|fax/i,
        render: v => {
            const parts = v.split(',').map(s => s.trim()).filter(Boolean);
            const fmt = n => `${formatPhoneNumber(n.replace(/\D/g, ''))}`;
            return parts.length > 1
                ? `<ul class="mb-0 ps-3">${parts.map(n => `<li>${fmt(n)}</li>`).join('')}</ul>`
                : fmt(parts[0]);
        },
    },
    {
        match: /email/i,
        render: v => {
            const parts = v.split(',').map(s => s.trim()).filter(Boolean);
            const fmt = e => `${e}`;
            return parts.length > 1
                ? `<ul class="mb-0 ps-3">${parts.map(e => `<li>${fmt(e)}</li>`).join('')}</ul>`
                : fmt(parts[0]);
        },
    },
    {
        match: /url|website|link/i,
        render: v => {
            const parts = v.split(',').map(s => s.trim()).filter(Boolean);
            const fmt = u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`;
            return parts.length > 1
                ? `<ul class="mb-0 ps-3">${parts.map(u => `<li>${fmt(u)}</li>`).join('')}</ul>`
                : fmt(parts[0]);
        },
    },
    {
        match: /date|dob|birth/i,
        render: v => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
                const [y, m, d] = v.trim().split('-').map(Number);
                return new Date(y, m - 1, d).toLocaleDateString();
            }
            const d = new Date(v);
            return isNaN(d.getTime()) ? v : d.toLocaleDateString();
        },
    },
    {
        match: /addr|address|street|city|state|location|zip|postal/i,
        render: v => v,
    },
];

function renderValue(v, k = '') {
    if (v == null || v === '') return '—';
    const s = String(v);
    const renderer = KEY_RENDERERS.find(r => r.match.test(k));
    if (renderer) return renderer.render(s);
    const parts = s.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length > 1)
        return `<ul class="mb-0 ps-3">${parts.map(p => `<li>${p}</li>`).join('')}</ul>`;
    return parts[0] ?? '—';
}

function renderField([k, v]) {
    return `
        <div class="mb-3">
            <div class="subheader">${k.replace(/_/g, ' ')}</div>
            <div>${renderValue(v, k)}</div>
        </div>`;
}

function showKeywordDropdown(input, items) {
    let dropdown = document.getElementById('keyword-dropdown');
    if (!dropdown) { dropdown = document.createElement('div'); dropdown.id = 'keyword-dropdown'; dropdown.style.cssText = 'position:fixed;z-index:9999;background:var(--tblr-bg-surface);border:1px solid var(--tblr-border-color);border-radius:0.375rem;box-shadow:0 4px 12px rgba(0,0,0,.15);min-width:200px;overflow:hidden;'; document.body.appendChild(dropdown); }
    if (!items.length) { hideKeywordDropdown(); return; }
    const rect = input.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = rect.width + 'px';
    dropdown.innerHTML = items.map(kw =>
        `<div class="keyword-option" data-keyword="${kw}" style="padding:0.45rem 0.85rem;cursor:pointer;font-size:0.85rem;display:flex;justify-content:space-between;align-items:center;">
            <span><strong>${kw}</strong>:</span>
            <span style="color:var(--tblr-secondary);font-size:0.78rem;">search by ${kw}</span>
        </div>`
    ).join('');
    dropdown.style.display = 'block';
    dropdown.querySelectorAll('.keyword-option').forEach(opt => {
        opt.addEventListener('mousedown', e => {
            e.preventDefault();
            const parts = input.value.split(',');
            parts[parts.length - 1] = opt.dataset.keyword + ':';
            input.value = parts.join(',');
            hideKeywordDropdown();
            input.focus();
        });
        opt.addEventListener('mouseover', () => opt.style.background = 'var(--tblr-active-bg, rgba(0,0,0,.04))');
        opt.addEventListener('mouseout', () => opt.style.background = '');
    });
}

function hideKeywordDropdown() {
    const d = document.getElementById('keyword-dropdown');
    if (d) d.style.display = 'none';
}
function createCard(item, i) {
    const { _breach_data, _table_name, extra, pii: rawPii, ...entryData } = item;
    const preview = ['name', 'id', 'uuid']
        .map(k => [k, entryData[k]])
        .filter(([, v]) => v !== null && v !== undefined && v !== '');

    const extraFields = extra && typeof extra === 'object' ? Object.entries(extra) : [];
    let piiFields = [];
    try { piiFields = rawPii ? Object.entries(JSON.parse(rawPii)) : []; } catch { piiFields = []; }
    return `
        <div class="col-md-6 col-lg-4">
            <div class="card-tabs">
                <ul class="nav nav-tabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <a href="#card-${i}-overview" class="tab-top nav-link active" data-bs-toggle="tab" aria-selected="true" role="tab">Info</a>
                    </li>
                    <li class="nav-item" role="presentation">
                        <a href="#card-${i}-pii" class="nav-link" data-bs-toggle="tab" aria-selected="false" role="tab" tabindex="-1">PII</a>
                    </li>
                    <li class="nav-item" role="presentation">
                        <a href="#card-${i}-extra" class="nav-link" data-bs-toggle="tab" aria-selected="false" role="tab" tabindex="-1">Extra</a>
                    </li>
                    <li class="nav-item" role="presentation">
                        <a href="#card-${i}-actions" class="nav-link" data-bs-toggle="tab" aria-selected="false" role="tab" tabindex="-1">Actions</a>
                    </li>
                    <li class="nav-item" role="presentation">
                        <a class="nav-link" style="cursor:pointer"
                            data-bs-toggle="modal" data-bs-target="#ll-notes-view-modal"
                            data-table="${_table_name}" data-id="${item.id}">Notes</a>
                    </li>
                </ul>
                <div class="tab-content">
                    <div id="card-${i}-overview" class="card tab-pane active show" role="tabpanel">
                        <div class="card-body">
                            ${preview.length ? preview.map(renderField).join('') : '<span class="text-secondary">No data</span>'}
                            </div>
                            <div class="card-footer">
                            <div class="d-flex align-items-center mb-2">
                                <div class="flex-fill">
                                    <div class="card-title mb-0">${_breach_data?.name ?? '—'}</div>
                                </div>
                                <span class="badge" style="background-color: ${stringToColor(_breach_data?.threat_actor ?? 'Unknown')};color: var(--tblr-body-color);">${_breach_data?.threat_actor ?? 'Unknown'}</span>
                            </div>
                        </div>
                    </div>
                    <div id="card-${i}-pii" class="card tab-pane" role="tabpanel">
                        <div class="card-body" style="max-height:200px;overflow-y:auto;">
                            ${piiFields.length ? piiFields.map(renderField).join('') : '<span class="text-secondary">No PII data</span>'}
                        </div>
                    </div>
                    <div id="card-${i}-extra" class="card tab-pane" role="tabpanel">
                        <div class="card-body" style="max-height:200px;overflow-y:auto;">
                            ${extraFields.length ? extraFields.map(renderField).join('') : '<span class="text-secondary">No extra data</span>'}
                        </div>
                    </div>
                    <div id="card-${i}-actions" class="card tab-pane" role="tabpanel">
                        <div class="card-body d-flex gap-2 flex-wrap">
                            <button class="btn btn-primary"
                                data-bs-toggle="modal" data-bs-target="#ll-notes-modal"
                                data-table="${_table_name}" data-id="${item.id}">Add Notes</button>
                            <button class="btn btn-primary"
                                data-bs-toggle="modal" data-bs-target="#ll-links-modal"
                                data-table="${_table_name}" data-id="${item.id}">Add Links</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
}

function renderCards(items) {
    const grid = document.getElementById("search-results-grid");
    if (!grid) return;
    if (items.length === 0) {
        grid.innerHTML = `
            <div class="col-12 d-flex justify-content-center align-items-center" style="min-height: 200px;">
                <div class="text-center text-secondary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                        stroke-linejoin="round" class="mb-3 d-block mx-auto">
                        <path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
                        <path d="M21 21l-6 -6" />
                    </svg>
                    <p class="h3">No results found</p>
                </div>
            </div>`;
        return;
    }
    grid.innerHTML = items.map((item, i) => createCard(item, i)).join("");
}

function renderPagination() {
    const container = document.getElementById("search-pagination");
    if (!container) return;
    const totalPages = Math.ceil(allResults.length / PAGE_SIZE);
    if (totalPages <= 1 && loadingMoreBreaches === 0) { container.innerHTML = ""; container.style.display = "none"; return; }
    container.style.display = "";

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, allResults.length);

    const pageButtons = () => {
        const pages = [];
        const delta = 2;
        const left = Math.max(2, currentPage - delta);
        const right = Math.min(totalPages - 1, currentPage + delta);

        pages.push(1);
        if (left > 2) pages.push("...");
        for (let p = left; p <= right; p++) pages.push(p);
        if (right < totalPages - 1) pages.push("...");
        if (totalPages > 1) pages.push(totalPages);

        return pages.map(p => {
            if (p === "...") return `<li class="page-item disabled"><span class="page-link">…</span></li>`;
            const active = p === currentPage ? " active" : "";
            return `<li class="page-item${active}"><a class="page-link" href="#" data-page="${p}">${p}</a></li>`;
        }).join("");
    };

    container.innerHTML = `
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div class="text-secondary small">Showing ${start}–${end} of ${allResults.length} results${loadingMoreBreaches > 0 ? '&nbsp;<span class="badge bg-azure-lt">loading more…</span>' : ''}</div>
            <ul class="pagination mb-0">
                <li class="page-item${currentPage === 1 ? " disabled" : ""}">
                    <a class="page-link" href="#" data-page="${currentPage - 1}">prev</a>
                </li>
                ${pageButtons()}
                <li class="page-item${currentPage === totalPages ? " disabled" : ""}">
                    <a class="page-link" href="#" data-page="${currentPage + 1}">next</a>
                </li>
            </ul>
        </div>`;

    container.querySelectorAll("a.page-link[data-page]").forEach(a => {
        a.addEventListener("click", e => {
            e.preventDefault();
            const p = parseInt(a.dataset.page);
            if (isNaN(p) || p < 1 || p > totalPages || p === currentPage) return;
            currentPage = p;
            renderPage();
            document.getElementById("search-results-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });
}

function renderPage() {
    const start = (currentPage - 1) * PAGE_SIZE;
    renderCards(allResults.slice(start, start + PAGE_SIZE));
    renderPagination();
}

function parseFieldTokens(q) {
    const tokens = [];
    for (const part of q.split(',')) {
        const m = part.trim().match(/^([\w.]+):(.+)$/);
        if (!m) continue;
        const field = m[1].toLowerCase();
        let value = m[2].trim();
        let exact = false;
        if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
            exact = true;
            value = value.slice(1, -1);
        }
        if (/phone|mobile|cell|fax/i.test(field)) value = value.replace(/\D/g, '');
        tokens.push({ field, value, exact });
    }
    return tokens;
}

async function fetchSearchResults(tableName, searchValue, limit, offset = 0) {
    try {
        const tokens = parseFieldTokens(searchValue);
        const params = new URLSearchParams({ table_name: tableName.toLowerCase().replace(" ", "_") });
        if (tokens.length > 0) {
            for (const { field, value, exact } of tokens) {
                params.append("search_field", field);
                params.append("search_value", value);
                params.append("search_exact", exact ? "true" : "false");
            }
        } else {
            params.append("search_value", searchValue);
        }
        params.set("limit", limit);
        params.set("offset", offset);
        const response = await fetch(`/api/breaches/search?${params}`, {
            method: "GET",
            headers: { "API-KEY": Cookies.get("auth") }
        });
        if (!response.ok) {
            if (response.status==401){
                failedAuth()
            }
            return [];
        }
        const data = await response.json();
        if (!data.success) return [];
        const { breach_data, entries } = data.data;
        return entries.map(entry => ({ ...entry, _breach_data: breach_data, _table_name: tableName.toLowerCase().replace(/\s+/g, "_") }));
    } catch {
        return [];
    }
}

function renderSearching() {
    const grid = document.getElementById("search-results-grid");
    if (!grid) return;
    grid.innerHTML = `
        <div class="col-12">
            <div class="progress mb-2">
                <div class="progress-bar progress-bar-indeterminate"></div>
            </div>
            <div class="text-center text-secondary small">Searching...</div>
        </div>`;
}

async function filterCards(query) {
    const q = query.trim();
    if (!q) { renderCards([]); return; }

    const activeTags = [...document.querySelectorAll('input[name="form-tags[]"]:checked')]
        .map(cb => cb.value);
    const loadAll = document.getElementById('load-all-checkbox')?.checked;
    const chunkSize = parseInt(document.getElementById('breachsearchlimit').value) || 100;

    const tagsToSearch = activeTags.length > 0
        ? activeTags
        : cachedBreaches.filter(b => (b.ingested ?? "").toLowerCase() !== "no").map(b => b.name);

    const generation = ++searchGeneration;
    allResults = [];
    currentPage = 1;
    loadingMoreBreaches = 0;
    renderSearching();

    const noteTokens = parseFieldTokens(q).filter(t => t.field === 'note');
    if (noteTokens.length > 0) {
        const noteText = noteTokens.map(t => t.value).join(' ');
        allResults = await fetchNoteSearch(noteText, generation);
        if (generation !== searchGeneration) return;
        renderPage();
        return;
    }

    const noteSearchPromise = fetchNoteSearch(q, generation);

    if (loadAll) {
        await loadProgressively(tagsToSearch, q, chunkSize, generation);
    } else {
        const results = await Promise.all(tagsToSearch.map(name => fetchSearchResults(name, q, chunkSize, 0)));
        if (generation !== searchGeneration) return;
        allResults = results.flat();
        renderPage();
    }

    if (generation !== searchGeneration) return;
    const noteResults = await noteSearchPromise;
    if (generation !== searchGeneration) return;
    const existingKeys = new Set(allResults.map(r => `${r._table_name}:${r.id}`));
    const newFromNotes = (noteResults ?? []).filter(r => !existingKeys.has(`${r._table_name}:${r.id}`));
    if (newFromNotes.length > 0) {
        allResults.push(...newFromNotes);
        renderPage();
    }
}

async function loadProgressively(tagsToSearch, query, chunkSize, generation) {
    const offsets = Object.fromEntries(tagsToSearch.map(n => [n, 0]));
    let remaining = [...tagsToSearch];
    let isFirst = true;

    while (remaining.length > 0) {
        if (generation !== searchGeneration) return;

        const batch = await Promise.all(
            remaining.map(name => fetchSearchResults(name, query, chunkSize, offsets[name]))
        );

        if (generation !== searchGeneration) return;

        const nextRemaining = [];
        batch.forEach((results, i) => {
            const name = remaining[i];
            allResults.push(...results);
            offsets[name] += results.length;
            if (results.length >= chunkSize) nextRemaining.push(name);
        });
        remaining = nextRemaining;
        loadingMoreBreaches = remaining.length;

        if (isFirst) {
            renderPage();
            isFirst = false;
        } else {
            renderPagination();
        }
    }

    loadingMoreBreaches = 0;
    renderPagination();
}

async function fetchTags() {
    try {
        const response = await fetch("/api/breaches/list", {
            headers: { "API-KEY": Cookies.get("auth") }
        });
        if (!response.ok) {
            if (response.status==401){
                failedAuth()
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.success ? data.data : null;
    } catch {
        return null;
    }
}

function renderTags(tags) {
    const container = document.getElementById("tags-container");
    if (!container) return;
    let html = "";
    for (const tag of tags) {if (tag.ingested == "No") {html += `<label class="form-check"><input type="checkbox" class="form-check-input" name="form-tags[]" value="${tag.name}" disabled><span class="form-check-label">${tag.name}</span></label>`;} else{ html += `<label class="form-check"><input type="checkbox" class="form-check-input" name="form-tags[]" value="${tag.name}"><span class="form-check-label">${tag.name}</span></label>`;}}
    container.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", async () => {
    const tags = await fetchTags();
    cachedBreaches = tags ?? [];
    renderTags(cachedBreaches);

    const input = document.getElementById("page-search-input");
    const btn = document.getElementById("page-search-btn");

    const loadAllCheckbox = document.getElementById('load-all-checkbox');
    const limitInput = document.getElementById('breachsearchlimit');
    loadAllCheckbox.checked = true;
    limitInput.disabled = true;
    loadAllCheckbox.addEventListener('change', e => {
        if (e.target.checked) {
            limitInput.disabled = true;
        } else {
            limitInput.disabled = false;
        }
    });

    btn.addEventListener("click", () => filterCards(input.value));
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") { hideKeywordDropdown(); filterCards(input.value); }
        if (e.key === "Escape") hideKeywordDropdown();
    });
    input.addEventListener("input", () => {
        const lastToken = input.value.split(',').pop().trim();
        if (lastToken.includes(':')) { hideKeywordDropdown(); return; }
        const filtered = SEARCH_KEYWORDS.filter(kw => kw.startsWith(lastToken.toLowerCase()));
        lastToken.length > 0 ? showKeywordDropdown(input, filtered) : hideKeywordDropdown();
    });
    input.addEventListener("blur", () => setTimeout(hideKeywordDropdown, 150));
});




// ═══════════════════════════════════════════════════════════════
// ENTRY NOTES & LINKS  —  added below existing code for easy removal
// ═══════════════════════════════════════════════════════════════

// ── API helpers ────────────────────────────────────────────────

async function llApiGet(path) {
    const r = await fetch(path, { headers: { "API-KEY": Cookies.get("auth") } });
    return r.ok ? (await r.json()).data : null;
}

async function llApiPost(path, body) {
    const r = await fetch(path, {
        method: "POST",
        headers: { "API-KEY": Cookies.get("auth"), "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    return r.ok ? (await r.json()) : null;
}

async function llApiDelete(path) {
    const r = await fetch(path, { method: "DELETE", headers: { "API-KEY": Cookies.get("auth") } });
    return r.ok;
}

// ── Notes ──────────────────────────────────────────────────────

function renderNoteMarkdown(text) {
    if (typeof marked !== "undefined") {
        return marked.parse(text, { breaks: true });
    }
    return text.replace(/</g, "&lt;");
}

function renderNotesPane(pane, notes, table, id) {
    const list = notes.length
        ? notes.map(n => `
            <div class="d-flex align-items-start gap-2 mb-3">
                <div class="flex-fill">
                    <div class="ll-note-body">${renderNoteMarkdown(n.note)}</div>
                    <div class="text-secondary" style="font-size:0.75em">${n.created_by} · ${new Date(n.created_at).toLocaleString()}</div>
                </div>
                <button class="btn btn-sm btn-ghost-danger py-0 ll-delete-note" data-note-id="${n.id}">✕</button>
            </div>`).join("")
        : `<div class="text-secondary small">No notes yet</div>`;

    pane.innerHTML = `
        <div class="card-body" id="notes-list-${id}">${list}</div>
        <div class="card-footer d-flex gap-2">
            <textarea class="form-control form-control-sm ll-note-input" rows="2" placeholder="Add a note… (markdown supported)"></textarea>
            <button class="btn btn-sm btn-primary ll-save-note" data-table="${table}" data-id="${id}">Save</button>
        </div>`;

    pane.querySelectorAll(".ll-delete-note").forEach(btn => {
        btn.addEventListener("click", async () => {
            await llApiDelete(`/api/entries/notes/${btn.dataset.noteId}`);
            const fresh = await llApiGet(`/api/entries/notes?source_table=${table}&source_id=${id}`);
            renderNotesPane(pane, fresh ?? [], table, id);
        });
    });

    pane.querySelector(".ll-save-note").addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        const textarea = pane.querySelector(".ll-note-input");
        const text = textarea.value.trim();
        if (!text) return;
        btn.disabled = true;
        await llApiPost("/api/entries/notes", { source_table: table, source_id: id, note: text });
        const fresh = await llApiGet(`/api/entries/notes?source_table=${table}&source_id=${id}`);
        renderNotesPane(pane, fresh ?? [], table, id);
    });
}

// ── Links ──────────────────────────────────────────────────────

function renderLinksPane(pane, links, table, id) {
    const list = links.length
        ? links.map(l => {
            const isSource = l.source_table === table && l.source_id == id;
            const otherTable = isSource ? l.target_table : l.source_table;
            const otherId    = isSource ? l.target_id    : l.source_id;
            return `
            <div class="d-flex align-items-center gap-2 mb-2">
                <div class="flex-fill small">
                    <span class="badge bg-secondary me-1">${l.link_type}</span>
                    ${otherTable} #${otherId}
                    <div class="text-secondary" style="font-size:0.75em">${l.created_by} · ${new Date(l.created_at).toLocaleString()}</div>
                </div>
                <a class="btn btn-sm btn-ghost-primary py-0" href="spider.html?table=${table}&id=${id}" target="_blank">🕸</a>
                <button class="btn btn-sm btn-ghost-danger py-0 ll-delete-link" data-link-id="${l.id}">✕</button>
            </div>`;
          }).join("")
        : `<div class="text-secondary small">No links yet</div>`;

    pane.innerHTML = `
        <div class="card-body" style="max-height:180px;overflow-y:auto;">${list}</div>
        <div class="card-footer">
            <div class="d-flex gap-2 mb-2">
                <input class="form-control form-control-sm ll-link-table" placeholder="Target breach table" />
                <input class="form-control form-control-sm ll-link-id" placeholder="Entry ID" style="width:80px" type="number" />
                <select class="form-select form-select-sm ll-link-type" style="width:120px">
                    <option value="related">Related</option>
                    <option value="same person">Same Person</option>
                    <option value="alias">Alias</option>
                    <option value="family">Family</option>
                </select>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-primary ll-save-link" data-table="${table}" data-id="${id}">Link Entry</button>
                <a class="btn btn-sm btn-secondary" href="spider.html?table=${table}&id=${id}" target="_blank">Open Spider View</a>
            </div>
        </div>`;

    pane.querySelectorAll(".ll-delete-link").forEach(btn => {
        btn.addEventListener("click", async () => {
            await llApiDelete(`/api/entries/links/${btn.dataset.linkId}`);
            const fresh = await llApiGet(`/api/entries/links?source_table=${table}&source_id=${id}`);
            renderLinksPane(pane, fresh ?? [], table, id);
        });
    });

    pane.querySelector(".ll-save-link").addEventListener("click", async () => {
        const targetTable = pane.querySelector(".ll-link-table").value.trim();
        const targetId    = pane.querySelector(".ll-link-id").value.trim();
        const linkType    = pane.querySelector(".ll-link-type").value;
        if (!targetTable || !targetId) return;
        await llApiPost("/api/entries/links", {
            source_table: table, source_id: id,
            target_table: targetTable, target_id: parseInt(targetId),
            link_type: linkType
        });
        const fresh = await llApiGet(`/api/entries/links?source_table=${table}&source_id=${id}`);
        renderLinksPane(pane, fresh ?? [], table, id);
    });
}

// ── Modal data loaders ─────────────────────────────────────────
// Registered at module level — defer guarantees DOM is ready when this runs,
// but DOMContentLoaded has already fired so wrapping in it would silently no-op.

document.getElementById("ll-notes-modal").addEventListener("show.bs.modal", (e) => {
    const trigger  = e.relatedTarget;
    const table    = trigger?.dataset.table;
    const id       = trigger?.dataset.id;
    if (!table || !id) return;

    const modal    = document.getElementById("ll-notes-modal");
    const textarea = modal.querySelector("textarea");
    textarea.value = "";

    // Clone to drop any listener attached by a prior open
    const oldBtn = document.getElementById("btn-create-note-submit");
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.replaceWith(newBtn);

    newBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const text = textarea.value.trim();
        if (!text) return;
        newBtn.disabled = true;
        await llApiPost("/api/entries/notes", { source_table: table, source_id: parseInt(id), note: text });
        bootstrap.Modal.getInstance(modal)?.hide();
    });
});

document.getElementById("ll-notes-view-modal").addEventListener("show.bs.modal", async (e) => {
    const trigger = e.relatedTarget;
    const table   = trigger?.dataset.table;
    const id      = trigger?.dataset.id;
    if (!table || !id) return;
    document.getElementById("ll-notes-view-subtitle").textContent = `${table} #${id}`;
    const body = document.getElementById("ll-notes-view-body");

    async function renderViewNotes() {
        body.innerHTML = `<div class="text-secondary small">Loading…</div>`;
        const notes = await llApiGet(`/api/entries/notes?source_table=${table}&source_id=${id}`);
        if (!notes || !notes.length) {
            body.innerHTML = `<div class="text-secondary small">No notes yet</div>`;
            return;
        }
        body.innerHTML = notes.map(n => `
            <div class="mb-4 pb-4 border-bottom d-flex align-items-start gap-2">
                <div class="flex-fill">
                    <div class="ll-note-body">${renderNoteMarkdown(n.note)}</div>
                    <div class="text-secondary mt-2" style="font-size:0.75em">${n.created_by} · ${new Date(n.created_at).toLocaleString()}</div>
                </div>
                <button class="btn btn-sm btn-ghost-danger py-0 ll-delete-note-view" data-note-id="${n.id}">✕</button>
            </div>`).join("");
        body.querySelectorAll(".ll-delete-note-view").forEach(btn => {
            btn.addEventListener("click", async () => {
                btn.disabled = true;
                await llApiDelete(`/api/entries/notes/${btn.dataset.noteId}`);
                renderViewNotes();
            });
        });
    }

    renderViewNotes();
});

document.getElementById("ll-links-modal").addEventListener("show.bs.modal", async (e) => {
    const trigger = e.relatedTarget;
    const table   = trigger?.dataset.table;
    const id      = trigger?.dataset.id;
    if (!table || !id) return;
    document.getElementById("ll-links-modal-subtitle").textContent = `${table} #${id}`;
    const body = document.getElementById("ll-links-modal-body");
    body.innerHTML = `<div class="card-body text-secondary small">Loading…</div>`;
    const links = await llApiGet(`/api/entries/links?source_table=${table}&source_id=${id}`);
    renderLinksPane(body, links ?? [], table, id);
});

// ── Note search (used by note: keyword) ────────────────────────

async function fetchNoteSearch(noteText, generation) {
    const pairs = await llApiGet(`/api/entries/notes/search?note_text=${encodeURIComponent(noteText)}`);
    if (!pairs || !pairs.length) return [];
    const fetches = pairs.map(({ source_table, source_id }) =>
        fetchSearchResults(source_table, `id:"${source_id}"`, 1, 0)
    );
    const results = await Promise.all(fetches);
    if (generation !== searchGeneration) return [];
    return results.flat();
}
