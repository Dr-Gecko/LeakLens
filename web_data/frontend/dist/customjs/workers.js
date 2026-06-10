const tableState = {
    search: "",
    sortCol: "spawned_at",
    sortDir: "desc",
    page: 1,
    pageSize: 15,
};

let workerData = [];

async function getWorkerList() {
    try {
        const response = await fetch("/api/workers/", {
            headers: { "API-KEY": Cookies.get("auth") }
        });
        if (!response.ok) {
            if (response.status === 401) failedAuth();
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const json = await response.json();
        return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (error) {
        console.error("Request failed:", error);
        return [];
    }
}

async function stopWorker(worker_id) {
    const response = await fetch(`/api/workers/${worker_id}/stop`, {
        method: "POST",
        headers: { "API-KEY": Cookies.get("auth") }
    });
    return response.json();
}

async function startWorker(name, worker, args) {
    const response = await fetch("/api/workers/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", "API-KEY": Cookies.get("auth") },
        body: JSON.stringify({ name, worker, args })
    });
    return response.json();
}

function stateBadge(state) {
    const map = {
        running: ["bg-success", "Running"],
        stopping: ["bg-warning", "Stopping"],
        completed: ["bg-secondary", "Completed"],
        failed: ["bg-danger", "Failed"],
    };
    const [cls, label] = map[state] ?? ["bg-secondary", state];
    return `<span class="badge ${cls} me-1"></span>${label}`;
}

function getFilteredSorted() {
    let rows = workerData.filter(row => {
        if (!tableState.search) return true;
        const q = tableState.search.toLowerCase();
        return (
            String(row.name ?? "").toLowerCase().includes(q) ||
            String(row.worker ?? "").toLowerCase().includes(q) ||
            String(row.state ?? "").toLowerCase().includes(q) ||
            String(row.spawned_by ?? "").toLowerCase().includes(q) ||
            String(row.spawned_at ?? "").toLowerCase().includes(q)
        );
    });

    rows = rows.slice().sort((a, b) => {
        let aVal = a[tableState.sortCol];
        let bVal = b[tableState.sortCol];

        if (tableState.sortCol === "spawned_at") {
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

function renderWorkerTable() {
    const tbody = document.getElementById("worker-tbody");
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
            <td>${row.name ?? ""}</td>
            <td><code>${row.worker ?? ""}</code></td>
            <td>${stateBadge(row.state)}</td>
            <td>${row.spawned_by ?? ""}</td>
            <td>${row.spawned_at ? new Date(row.spawned_at).toLocaleString() : ""}</td>
            <td class="text-end">
                <span class="dropdown">
                    <button class="btn dropdown-toggle align-text-top" data-bs-boundary="viewport" data-bs-toggle="dropdown">Actions</button>
                    <div class="dropdown-menu dropdown-menu-end">
                        <a class="dropdown-item worker-logs" data-id="${row.worker_id}" data-name="${row.name}" href="#">View Logs</a>
                        ${row.state === "running" ? `<a class="dropdown-item worker-stop text-danger" data-id="${row.worker_id}" data-name="${row.name}" href="#">Stop</a>` : ""}
                    </div>
                </span>
            </td>
        </tr>
    `).join("");

    tbody.querySelectorAll(".worker-stop").forEach(link => {
        link.addEventListener("click", async e => {
            e.preventDefault();
            const result = await Swal.fire({
                title: `Stop "${link.dataset.name}"?`,
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Stop",
                cancelButtonText: "Cancel",
                confirmButtonColor: "var(--tblr-danger)",
                background: "var(--tblr-bg-surface)",
                color: "var(--tblr-body-color)",
            });
            if (!result.isConfirmed) return;
            const data = await stopWorker(link.dataset.id);
            if (data.success) {
                workerData = await getWorkerList();
                renderWorkerTable();
            }
        });
    });

    tbody.querySelectorAll(".worker-logs").forEach(link => {
        link.addEventListener("click", async e => {
            e.preventDefault();
            try {
                const response = await fetch(`/api/workers/${link.dataset.id}/logs`, {
                    headers: { "API-KEY": Cookies.get("auth") }
                });
                const json = await response.json();
                const logs = json.data?.logs ?? "No logs available.";
                await Swal.fire({
                    title: `Logs — ${link.dataset.name}`,
                    html: `<pre style="text-align:left;max-height:400px;overflow:auto;font-size:0.8rem">${logs.replace(/</g, "&lt;")}</pre>`,
                    width: "800px",
                    confirmButtonText: "Close",
                    background: "var(--tblr-bg-surface)",
                    color: "var(--tblr-body-color)",
                });
            } catch {
                Swal.fire({ title: "Error", text: "Failed to fetch logs.", icon: "error", background: "var(--tblr-bg-surface)", color: "var(--tblr-body-color)" });
            }
        });
    });

    if (infoEl) {
        infoEl.innerHTML = total === 0
            ? "No workers found"
            : `Showing <strong>${start + 1} to ${Math.min(start + tableState.pageSize, total)}</strong> of <strong>${total}</strong> entries`;
    }

    if (pagEl) renderPagination(pagEl, totalPages);
    updateSortIcons();
}

function renderPagination(el, totalPages) {
    const current = tableState.page;
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
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
                renderWorkerTable();
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

function initWorkerTable() {
    const searchInput = document.getElementById("table-search");
    const entriesInput = document.getElementById("table-entries");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            tableState.search = searchInput.value;
            tableState.page = 1;
            renderWorkerTable();
        });
    }

    if (entriesInput) {
        entriesInput.addEventListener("change", () => {
            const value = parseInt(entriesInput.value);
            if (value > 0) {
                tableState.pageSize = value;
                tableState.page = 1;
                renderWorkerTable();
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
            renderWorkerTable();
        });
    });

    renderWorkerTable();
}

async function fetchScriptArgs(scriptName) {
    try {
        const response = await fetch(`/api/workers/scripts/${encodeURIComponent(scriptName)}/args`, {
            headers: { "API-KEY": Cookies.get("auth") }
        });
        const json = await response.json();
        return json.success && Array.isArray(json.data) ? json.data : [];
    } catch {
        return [];
    }
}

function renderArgInputs(args) {
    const container = document.getElementById("worker-args-container");
    if (!container) return;
    if (!args.length) {
        container.innerHTML = "";
        return;
    }
    container.innerHTML = args.map(arg => {
        const label = arg.name.replace(/_/g, " ");
        const hint = arg.help ? `<span class="text-secondary ms-1 small">— ${arg.help}</span>` : "";
        const required = arg.required ? ` <span class="text-danger">*</span>` : "";

        if (arg.type === "bool") {
            return `<div class="mb-2">
                <label class="form-check">
                    <input type="checkbox" class="form-check-input worker-arg-input" data-arg="${arg.name}" data-type="bool"${arg.default === "True" ? " checked" : ""}>
                    <span class="form-check-label">${label}${required}${hint}</span>
                </label>
            </div>`;
        }

        const inputType = arg.type === "int" || arg.type === "float" ? "number" : "text";
        return `<div class="mb-2">
            <label class="form-label mb-1">${label}${required}${hint}</label>
            <input type="${inputType}" class="form-control worker-arg-input" data-arg="${arg.name}" data-type="${arg.type}" placeholder="${arg.default || arg.name}" value="${arg.default}">
        </div>`;
    }).join("");
}

function collectArgs() {
    const args = {};
    document.querySelectorAll(".worker-arg-input").forEach(input => {
        const key = input.dataset.arg;
        if (input.type === "checkbox") {
            if (input.checked) args[key] = true;
        } else if (input.value.trim()) {
            args[key] = input.dataset.type === "int" ? parseInt(input.value)
                      : input.dataset.type === "float" ? parseFloat(input.value)
                      : input.value.trim();
        }
    });
    return args;
}

async function populateScriptDropdown() {
    const select = document.getElementById("worker-start-script");
    const container = document.getElementById("worker-args-container");
    if (!select) return;
    try {
        const response = await fetch("/api/workers/scripts", {
            headers: { "API-KEY": Cookies.get("auth") }
        });
        const json = await response.json();
        const scripts = json.success && Array.isArray(json.data) ? json.data : [];
        select.innerHTML = scripts.length
            ? `<option value="" disabled selected>Select a script…</option>` + scripts.map(s => `<option value="${s}">${s}</option>`).join("")
            : `<option value="" disabled selected>No scripts found</option>`;
        if (container) container.innerHTML = "";
    } catch {
        select.innerHTML = `<option value="" disabled selected>Failed to load scripts</option>`;
    }

    select.onchange = async () => {
        if (!select.value) return;
        if (container) container.innerHTML = `<p class="text-secondary small">Loading args…</p>`;
        const args = await fetchScriptArgs(select.value);
        renderArgInputs(args);
    };
}

document.addEventListener("DOMContentLoaded", async () => {
    workerData = await getWorkerList();
    initWorkerTable();

    document.getElementById("modal-start-worker")?.addEventListener("show.bs.modal", populateScriptDropdown);

    document.getElementById("btn-start-worker-submit")?.addEventListener("click", async e => {
        e.preventDefault();
        const name = document.getElementById("worker-start-name")?.value?.trim() ?? "";
        const worker = document.getElementById("worker-start-script")?.value ?? "";
        if (!worker) {
            Swal.fire({ title: "No script selected", icon: "warning", background: "var(--tblr-bg-surface)", color: "var(--tblr-body-color)" });
            return;
        }
        const data = await startWorker(name, worker, collectArgs());
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById("modal-start-worker"))?.hide();
            workerData = await getWorkerList();
            renderWorkerTable();
        } else {
            Swal.fire({ title: "Error", text: data.message ?? "Failed to start worker.", icon: "error", background: "var(--tblr-bg-surface)", color: "var(--tblr-body-color)" });
        }
    });
});
