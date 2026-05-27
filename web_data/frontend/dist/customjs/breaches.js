const BREACH_CACHE_KEY = "breaches";
const tableState = {
    search: "",
    sortCol: "id",
    sortDir: "asc",
    page: 1,
    pageSize: 15,
};

let breachData = [];

function openBreachModal(row) {document.getElementById("modal-breach-name").textContent = row.name ?? "—";document.getElementById("modal-breach-id").textContent = row.id ? `#${row.id}` : "";document.getElementById("modal-breach-actor").textContent = row.threat_actor ?? "Unknown";document.getElementById("modal-breach-records").textContent = Number(row.record_count || 0).toLocaleString();document.getElementById("modal-breach-date").textContent = row.date_added? new Date(row.date_added).toLocaleDateString(): "—";document.getElementById("modal-breach-extra").innerHTML = "";const modal = new bootstrap.Modal(document.getElementById("modal-breach-detail"));modal.show();}


function getCachedBreachList() {
    const cached = localStorage.getItem(BREACH_CACHE_KEY);
    if (!cached) return null;

    try {
        const parsed = JSON.parse(cached);

        if (!parsed.fetchedAt || !Array.isArray(parsed.data)) {
            localStorage.removeItem(BREACH_CACHE_KEY);
            return null;
        }

        if (Date.now() - parsed.fetchedAt > ONE_HOUR) {
            localStorage.removeItem(BREACH_CACHE_KEY);
            return null;
        }

        return parsed.data;
    } catch (error) {
        console.error("Invalid breach cache:", error);
        localStorage.removeItem(BREACH_CACHE_KEY);
        return null;
    }
}

function setCachedBreachList(data) {
    localStorage.setItem(BREACH_CACHE_KEY, JSON.stringify({
        data: data,
        fetchedAt: Date.now()
    }));
}

async function getBreachList() {
    const cachedData = getCachedBreachList();

    if (cachedData) {
        return cachedData;
    }

    try {
        const response = await fetch("/api/breaches/list", {
            headers: {
                "API-KEY": Cookies.get("auth")
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const json = await response.json();

        const rows = json.status === "success" && Array.isArray(json.data)
            ? json.data
            : [];

        setCachedBreachList(rows);
        return rows;

    } catch (error) {
        console.error("Request failed:", error);
        return [];
    }
}

function getFilteredSorted() {
    let rows = breachData.filter(row => {
        if (!tableState.search) return true;

        const q = tableState.search.toLowerCase();

        return (
            String(row.id ?? "").toLowerCase().includes(q) ||
            String(row.name ?? "").toLowerCase().includes(q) ||
            String(row.threat_actor ?? "").toLowerCase().includes(q) ||
            String(row.date_added ?? "").toLowerCase().includes(q) ||
            String(row.record_count ?? "").toLowerCase().includes(q)
        );
    });

    rows = rows.slice().sort((a, b) => {
        let aVal = a[tableState.sortCol];
        let bVal = b[tableState.sortCol];

        if (["id", "record_count"].includes(tableState.sortCol)) {
            aVal = Number(aVal || 0);
            bVal = Number(bVal || 0);
            return tableState.sortDir === "asc" ? aVal - bVal : bVal - aVal;
        }

        if (tableState.sortCol === "date_added") {
            aVal = new Date(aVal || 0).getTime();
            bVal = new Date(bVal || 0).getTime();
            return tableState.sortDir === "asc" ? aVal - bVal : bVal - aVal;
        }

        return tableState.sortDir === "asc"
            ? String(aVal ?? "").localeCompare(String(bVal ?? ""))
            : String(bVal ?? "").localeCompare(String(aVal ?? ""));
    });

    return rows;
}

function openEditModal(row) {
    const modalEl = document.getElementById("modal-edit-breach");
    modalEl.dataset.breachId = row.id;
    modalEl.dataset.originalRow = JSON.stringify({
        name: row.name ?? "",
        threat_actor: row.threat_actor ?? "",
        record_count: String(row.record_count ?? ""),
        type: row.type ?? "",
        ingested: row.ingested ?? "",
    });
    document.getElementById("modal-edit-name").value = row.name ?? "";
    document.getElementById("modal-edit-actor").value = row.threat_actor ?? "";
    document.getElementById("modal-edit-records").value = row.record_count ?? "";
    document.getElementById("modal-edit-type").value = row.type ?? "";
    const ingestedEl = document.getElementById("modal-edit-ingested");
    const ingestedVal = (row.ingested ?? "").toLowerCase();
    for (const opt of ingestedEl.options) {
        if (opt.value.toLowerCase() === ingestedVal) { opt.selected = true; break; }
    }
    new bootstrap.Modal(modalEl).show();
}

async function onEditBreach(id, formData) {
    try {
        const response = await fetch("/api/breaches/edit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "API-KEY": Cookies.get("auth")
            },
            body: JSON.stringify({id:id,fields:formData })
        });

        const json = await response.json();

        if (!response.ok || json.status !== "success") {
            throw new Error(json.status ?? "unknown error");
        }

        localStorage.removeItem(BREACH_CACHE_KEY);
        breachData = await getBreachList();
        renderBreachTable();

        bootstrap.Modal.getInstance(document.getElementById("modal-edit-breach"))?.hide();
    } catch (error) {
        console.error("Failed to edit breach:", error);
        alert("Failed to edit breach: " + error.message);
    }
}

function renderBreachTable() {
    const tbody = document.getElementById("breach-tbody");
    const infoEl = document.getElementById("table-info");
    const pagEl = document.getElementById("table-pagination");

    if (!tbody) return;

    const rows = getFilteredSorted();
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / tableState.pageSize));

    if (tableState.page > totalPages) tableState.page = totalPages;

    const start = (tableState.page - 1) * tableState.pageSize;
    const pageRows = rows.slice(start, start + tableState.pageSize);
    tbody.innerHTML = pageRows.map(row => `
        <tr>
            <td>${row.id ?? ""}</td>
            <td>
                <a href="#" class="text-reset breach-name-link" data-breach-id="${row.id}">
                    ${row.name ?? ""}
                </a>
            </td>
            <td>${row.threat_actor ?? ""}</td>
            <td>${Number(row.record_count || 0).toLocaleString()}</td>
            <td>${(() => { const v = row.ingested ?? ""; if (v.toLowerCase() === "yes") return `<span class="badge bg-success me-1"></span>Yes`; if (v.toLowerCase() === "no") return `<span class="badge bg-danger me-1"></span>No`; if (v.toLowerCase() === "pending") return `<span class="badge bg-warning me-1"></span>Pending`; return v; })()}</td>
            <td>${row.type ?? ""}</td>
            <td>${row.date_added ?? ""}</td>
            <td class="text-end">
                            <span class="dropdown">
                              <button class="btn dropdown-toggle align-text-top" data-bs-boundary="viewport" data-bs-toggle="dropdown">Actions</button>
                              <div class="dropdown-menu dropdown-menu-end">
                                <a class="dropdown-item breach-edit" data-breach-id="${row.id}">Edit</a>
                                <a class="dropdown-item breach-delete" data-breach-id="${row.id}" data-breach-name="${row.name}">Delete</a>
                              </div>
                          </td>
        </tr>
    `).join("");
    tbody.querySelectorAll(".breach-edit").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();
            const id = parseInt(link.dataset.breachId);
            const row = breachData.find(b => b.id === id);
            if (row) openEditModal(row);
        });
    });
    tbody.querySelectorAll(".breach-delete").forEach(link => {
        link.addEventListener("click", async e => {
            e.preventDefault();
            const id = parseInt(link.dataset.breachId);
            const name = link.dataset.breachName;
            const result = await Swal.fire({
                title: `Delete "${name}"?`,
                text: "This will permanently delete the breach and all its data. This cannot be undone.",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Delete",
                cancelButtonText: "Cancel",
                confirmButtonColor: "var(--tblr-danger)",
                background: "var(--tblr-bg-surface)",
                color: "var(--tblr-body-color)",
            });
            if (!result.isConfirmed) return;
            const resp = await fetch("/api/breaches/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json", "API-KEY": Cookies.get("auth") },
                body: JSON.stringify({ id }),
            });
            const data = await resp.json();
            if (data.status === "success") {
                await Swal.fire({ title: "Deleted", icon: "success", timer: 1500, showConfirmButton: false, background: "var(--tblr-bg-surface)", color: "var(--tblr-body-color)" });
                loadBreaches();
            } else {
                Swal.fire({ title: "Error", text: "Failed to delete breach.", icon: "error", background: "var(--tblr-bg-surface)", color: "var(--tblr-body-color)" });
            }
        });
    });
    tbody.querySelectorAll(".breach-name-link").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();
            const id = parseInt(link.dataset.breachId);
            const row = breachData.find(b => b.id === id);
            if (row) openBreachModal(row);
        });
    });

    if (infoEl) {
        infoEl.innerHTML = total === 0
            ? "No entries found"
            : `Showing <strong>${start + 1} to ${Math.min(start + tableState.pageSize, total)}</strong> of <strong>${total}</strong> entries`;
    }

    if (pagEl) renderPagination(pagEl, totalPages);
    updateSortIcons();
}

function renderPagination(el, totalPages) {
    const current = tableState.page;
    const pages = [];

    for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
    }

    el.innerHTML = `
        <li class="page-item ${current === 1 ? "disabled" : ""}">
            <a class="page-link" href="#" data-page="${current - 1}">‹</a>
        </li>
        ${pages.map(p => `
            <li class="page-item ${p === current ? "active" : ""}">
                <a class="page-link" href="#" data-page="${p}">${p}</a>
            </li>
        `).join("")}
        <li class="page-item ${current === totalPages ? "disabled" : ""}">
            <a class="page-link" href="#" data-page="${current + 1}">›</a>
        </li>
    `;

    el.querySelectorAll("[data-page]").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();

            const page = parseInt(link.dataset.page);

            if (page >= 1 && page <= totalPages) {
                tableState.page = page;
                renderBreachTable();
            }
        });
    });
}

function updateSortIcons() {
    document.querySelectorAll("th[data-sort]").forEach(th => {
        const icon = th.querySelector(".sort-icon");
        if (!icon) return;

        icon.style.opacity = th.dataset.sort === tableState.sortCol ? "1" : "0.3";
        icon.style.transform =
            th.dataset.sort === tableState.sortCol && tableState.sortDir === "desc"
                ? "rotate(180deg)"
                : "rotate(0deg)";
    });
}

function initBreachTable() {
    const searchInput = document.getElementById("table-search");
    const entriesInput = document.getElementById("table-entries");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            tableState.search = searchInput.value;
            tableState.page = 1;
            renderBreachTable();
        });
    }

    if (entriesInput) {
        entriesInput.addEventListener("change", () => {
            const value = parseInt(entriesInput.value);

            if (value > 0) {
                tableState.pageSize = value;
                tableState.page = 1;
                renderBreachTable();
            }
        });
    }

    document.querySelectorAll("th[data-sort]").forEach(th => {
        th.addEventListener("click", () => {
            const col = th.dataset.sort;

            if (tableState.sortCol === col) {
                tableState.sortDir = tableState.sortDir === "asc" ? "desc" : "asc";
            } else {
                tableState.sortCol = col;
                tableState.sortDir = "asc";
            }

            renderBreachTable();
        });
    });

    renderBreachTable();
}

async function onCreateBreach(formData) {
    try {
        const response = await fetch("/api/breaches/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "API-KEY": Cookies.get("auth")
            },
            body: JSON.stringify(formData)
        });

        const json = await response.json();

        if (!response.ok || json.status !== "success") {
            throw new Error(json.status ?? "unknown error");
        }

        localStorage.removeItem(BREACH_CACHE_KEY);
        breachData = await getBreachList();
        renderBreachTable();

        bootstrap.Modal.getInstance(document.getElementById("modal-create-breach"))?.hide();
    } catch (error) {
        console.error("Failed to create breach:", error);
        alert("Failed to create breach: " + error.message);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    breachData = await getBreachList();
    initBreachTable();

    document.getElementById("btn-create-breach-submit")?.addEventListener("click", async e => {
        e.preventDefault();
        const modal = document.getElementById("modal-create-breach");
        const formData = {
            name: modal.querySelector('[name="addBreachVictim"]')?.value?.trim() ?? "",
            threat_actor: modal.querySelector('[name="addBreachThreatActor"]')?.value?.trim() ?? "",
            record_count: modal.querySelector('[name="addBreachCount"]')?.value?.trim() ?? "",
            type: modal.querySelector('[name="addBreachType"]')?.value?.trim() ?? "",
            ingested: modal.querySelector('[name="addBreachIngested"]')?.value ?? "Pending",
        };
        await onCreateBreach(formData);
    });

    document.getElementById("btn-edit-breach-submit")?.addEventListener("click", async e => {
        e.preventDefault();
        const modalEl = document.getElementById("modal-edit-breach");
        const id = parseInt(modalEl.dataset.breachId);
        const original = JSON.parse(modalEl.dataset.originalRow ?? "{}");
        const current = {
            name: document.getElementById("modal-edit-name")?.value?.trim() ?? "",
            threat_actor: document.getElementById("modal-edit-actor")?.value?.trim() ?? "",
            record_count: document.getElementById("modal-edit-records")?.value?.trim() ?? "",
            type: document.getElementById("modal-edit-type")?.value?.trim() ?? "",
            ingested: document.getElementById("modal-edit-ingested")?.value ?? "Pending",
        };
        const changed = Object.fromEntries(
            Object.entries(current).filter(([k, v]) => v !== (original[k] ?? ""))
        );
        if (Object.keys(changed).length === 0) {
            bootstrap.Modal.getInstance(modalEl)?.hide();
            return;
        }
        await onEditBreach(id, changed);
    });
});