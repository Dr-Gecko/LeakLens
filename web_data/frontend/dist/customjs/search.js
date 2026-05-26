let cachedBreaches = [];
let allResults = [];
let currentPage = 1;
const PAGE_SIZE = 100;
const SEARCH_KEYWORDS = ['name', 'uuid', 'id', 'pii', 'extra', 'socials'];

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
            input.value = opt.dataset.keyword + ':';
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
    const { _breach_data, extra, pii: rawPii, ...entryData } = item;
    const preview = ['name', 'id', 'uuid']
        .map(k => [k, entryData[k]])
        .filter(([, v]) => v !== null && v !== undefined && v !== '');

    const ADDRESS_KEYS = /addr|address|street|city|state|location|zip|postal/i;
    const renderValue = (v, k = '') => {
        if (v == null || v === '') return '—';
        if (ADDRESS_KEYS.test(k)) return String(v);
        const parts = String(v).split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length > 1)
            return `<ul class="mb-0 ps-3">${parts.map(item => `<li>${item}</li>`).join('')}</ul>`;
        return parts[0] ?? '—';
    };
    const renderField = ([k, v]) => `
        <div class="mb-3">
            <div class="subheader">${k.replace(/_/g, ' ')}</div>
            <div>${renderValue(v, k)}</div>
        </div>`;

    const extraFields = extra && typeof extra === 'object' ? Object.entries(extra) : [];
    let piiFields = [];
    try { piiFields = rawPii ? Object.entries(JSON.parse(rawPii)) : []; } catch { piiFields = []; }
    return `
        <div class="col-md-6 col-lg-4">
            <div class="card-tabs">
                <ul class="nav nav-tabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <a href="#card-${i}-overview" class="nav-link active" data-bs-toggle="tab" aria-selected="true" role="tab">Overview</a>
                    </li>
                    <li class="nav-item" role="presentation">
                        <a href="#card-${i}-pii" class="nav-link" data-bs-toggle="tab" aria-selected="false" role="tab" tabindex="-1">PII</a>
                    </li>
                    <li class="nav-item" role="presentation">
                        <a href="#card-${i}-extra" class="nav-link" data-bs-toggle="tab" aria-selected="false" role="tab" tabindex="-1">Extra</a>
                    </li>
                    <li class="nav-item" role="presentation">
                        <a href="#card-${i}-source" class="nav-link" data-bs-toggle="tab" aria-selected="false" role="tab" tabindex="-1">Source</a>
                    </li>
                </ul>
                <div class="tab-content">
                    <div id="card-${i}-overview" class="card tab-pane active show" role="tabpanel">
                        <div class="card-body">
                            ${preview.length ? preview.map(renderField).join('') : '<span class="text-secondary">No data</span>'}
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
                    <div id="card-${i}-source" class="card tab-pane" role="tabpanel">
                        <div class="card-body">
                            <div class="d-flex align-items-center mb-2">
                                <div class="flex-fill">
                                    <div class="card-title mb-0">${_breach_data?.name ?? '—'}</div>
                                    <div class="text-secondary small">#${_breach_data?.id ?? '—'}</div>
                                </div>
                                <span class="badge" style="background-color: ${stringToColor(_breach_data?.threat_actor ?? 'Unknown')};color: var(--tblr-body-color);">${_breach_data?.threat_actor ?? 'Unknown'}</span>
                            </div>
                            <div class="d-flex gap-3 mt-2">
                                <div>
                                    <div class="text-secondary small">Records</div>
                                    <div class="fw-bold">${_breach_data?.record_count?.toLocaleString() ?? '—'}</div>
                                </div>
                                <div>
                                    <div class="text-secondary small">Added</div>
                                    <div class="fw-bold">${_breach_data?.date_added ? new Date(_breach_data.date_added).toLocaleDateString() : '—'}</div>
                                </div>
                            </div>
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
    if (totalPages <= 1) { container.innerHTML = ""; container.style.display = "none"; return; }
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
            <div class="text-secondary small">Showing ${start}–${end} of ${allResults.length} results</div>
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

async function fetchSearchResults(tableName, searchValue, limit) {
    try {
        const keywordMatch = searchValue.match(/^(\w+):(.+)$/);
        const params = new URLSearchParams({ table_name: tableName.toLowerCase().replace(" ", "_") });
        if (keywordMatch) {
            params.set("search_field", keywordMatch[1].toLowerCase());
            params.set("search_value", keywordMatch[2].trim());
            params.set("limit", limit)
        } else {
            params.set("limit", limit)
            params.set("search_value", searchValue);
        }
        const response = await fetch(`/api/breaches/search?${params}`, {
            method: "GET",
            headers: { "API-KEY": Cookies.get("auth") }
        });
        if (!response.ok) return [];
        const data = await response.json();
        if (data.status !== "success") return [];
        const { breach_data, entries } = data.data;
        return entries.map(entry => ({ ...entry, _breach_data: breach_data }));
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
    const activeTags = [...document.querySelectorAll('input[name="form-tags[]"]:checked')]
        .map(cb => cb.value);
    const limit = document.querySelector('input[name="breachsearchlimit"]').value;
    if (!q) { renderCards([]); return; }

    renderSearching();

    const tagsToSearch = activeTags.length > 0
        ? activeTags
        : cachedBreaches.filter(b => (b.ingested ?? "").toLowerCase() !== "no").map(b => b.name);

    const results = await Promise.all(tagsToSearch.map(name => fetchSearchResults(name, q, limit)));
    allResults = results.flat();
    currentPage = 1;
    renderPage();
}

async function fetchTags() {
    try {
        const response = await fetch("/api/breaches/list", {
            headers: { "API-KEY": Cookies.get("auth") }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.status === "success" ? data.data : null;
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

    btn.addEventListener("click", () => filterCards(input.value));
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") { hideKeywordDropdown(); filterCards(input.value); }
        if (e.key === "Escape") hideKeywordDropdown();
    });
    input.addEventListener("input", () => {
        const val = input.value;
        if (val.includes(':')) { hideKeywordDropdown(); return; }
        const filtered = SEARCH_KEYWORDS.filter(kw => kw.startsWith(val.toLowerCase()));
        val.length > 0 ? showKeywordDropdown(input, filtered) : hideKeywordDropdown();
    });
    input.addEventListener("blur", () => setTimeout(hideKeywordDropdown, 150));
});
