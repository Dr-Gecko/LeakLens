let map = null;
let markerLayer = null;

const breachColors = {};
const STATS_MAX_AGE_MS = 60 * 60 * 1000;
const WORKERS_MAX_AGE_MS = 60 * 1000;
const MINUTE = 1*60*1000
const storageKeys = {
    topStats: "topStats",
    dockerStats: "dockerStats",
    workersData: "dashboardWorkersData"
};

async function loadTopStats() {
    const elRecords = document.getElementById("records_count");
    const elBreaches = document.getElementById("breaches_count");
    if (!elRecords && !elBreaches) return;

    let data = null;
    let fetchedAt = null;

    const cachedRaw = localStorage.getItem(storageKeys.topStats);
    if (cachedRaw) {
        try {
            const parsed = JSON.parse(cachedRaw);
            if (parsed?.fetchedAt && Date.now() - parsed.fetchedAt < STATS_MAX_AGE_MS) {
                data = parsed;
                fetchedAt = parsed.fetchedAt;
            } else {
                localStorage.removeItem(storageKeys.topStats);
            }
        } catch {
            localStorage.removeItem(storageKeys.topStats);
        }
    }

    if (!data) {
        try {
            const response = await fetch("/api/breaches/stats", { headers: { "API-KEY": Cookies.get("auth") } });
            if (response.status === 401) { failedAuth(); return; }
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const json = await response.json();
            if (!json.success) throw new Error("API returned unsuccessful response");
            fetchedAt = Date.now();
            data = { fetchedAt, ...json.data };
            localStorage.setItem(storageKeys.topStats, JSON.stringify(data));
        } catch (error) {
            throw_alert({ title: "Failed to Load Dashboard Statistics", message: error.message || "An unknown error occurred.", icon: "error", timer: 2000 });
            console.error("Top Stats Error:", error);
            return;
        }
    }

    const ageText = fetchedAt ? `Updated ${formatStatsAge(fetchedAt)}` : "";
    const ageSuffix = ageText ? `<small class="text-muted d-block" style="font-size:0.8em">${ageText}</small>` : "";
    if (elRecords) elRecords.innerHTML = `${Number(data.total_entries || 0).toLocaleString()} records stored${ageSuffix}`;
    if (elBreaches) elBreaches.innerHTML = `${Number(data.breaches || 0).toLocaleString()} breaches stored${ageSuffix}`;
}

async function loadDockerStats() {
    let data = null;
    let fetchedAt = null;

    const cachedRaw = localStorage.getItem(storageKeys.dockerStats);
    if (cachedRaw) {
        try {
            const parsed = JSON.parse(cachedRaw);
            if (parsed?.fetchedAt && Date.now() - parsed.fetchedAt < STATS_MAX_AGE_MS) {
                data = parsed.data;
                fetchedAt = parsed.fetchedAt;
            } else {
                localStorage.removeItem(storageKeys.dockerStats);
            }
        } catch {
            localStorage.removeItem(storageKeys.dockerStats);
        }
    }

    if (!data) {
        try {
            const response = await fetch("/api/server/stats", { headers: { "API-KEY": Cookies.get("auth") } });
            if (response.status === 401) { failedAuth(); return; }
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const json = await response.json();
            fetchedAt = Date.now();
            data = json.data;
            console.log(data)
            localStorage.setItem(storageKeys.dockerStats, JSON.stringify({ fetchedAt, data }));
        } catch (error) {
            throw_alert({ title: "Docker Stats Error", message: error.message || "Failed to load Docker stats.", icon: "error" });
            console.error("Docker Stats Error:", error);
            return;
        }
    }

    if (!Array.isArray(data)) return;
    const networkStats = document.getElementById("container-network-stats");
    const memoryStats = document.getElementById("container-memory-stats");
    const containerStats = document.getElementById("container-status-stats");
    if (!networkStats || !memoryStats || !containerStats) return;
    networkStats.innerHTML = "";
    memoryStats.innerHTML = "";
    containerStats.innerHTML = "";
    data.forEach(container => {
        networkStats.innerHTML += `<tr><td>${container.name}</td><td>${formatBytes(container.bytes_rx, 0)}</td><td>${formatBytes(container.bytes_tx, 0)}</td></tr>`;
        memoryStats.innerHTML += `<tr><td>${container.name}</td><td>${formatBytes(container.memory_usage, 0)}</td></tr>`;
        containerStats.innerHTML += `<tr><td>${container.name}</td><td>${container.status}</td></tr>`;
    });
}

async function loadRunningWorkers() {
    const el = document.getElementById("workers_count");
    if (!el) return;

    let workers = null;
    let fetchedAt = null;

    const cachedRaw = localStorage.getItem(storageKeys.workersData);
    if (cachedRaw) {
        try {
            const parsed = JSON.parse(cachedRaw);
            if (parsed?.fetchedAt && Date.now() - parsed.fetchedAt < WORKERS_MAX_AGE_MS) {
                workers = parsed.workers;
                fetchedAt = parsed.fetchedAt;
            } else {
                localStorage.removeItem(storageKeys.workersData);
            }
        } catch {
            localStorage.removeItem(storageKeys.workersData);
        }
    }

    if (!workers) {
        try {
            const response = await fetch("/api/workers/", { headers: { "API-KEY": Cookies.get("auth") } });
            if (response.status === 401) { failedAuth(); return; }
            if (!response.ok) return;
            const json = await response.json();
            if (json.success && Array.isArray(json.data)) {
                workers = json.data;
                fetchedAt = Date.now();
                localStorage.setItem(storageKeys.workersData, JSON.stringify({ fetchedAt, workers }));
            }
        } catch { return; }
    }

    if (!workers) {
        el.innerHTML = "— workers";
        return;
    }

    const running = workers.filter(w => w.state === "running").length;
    const ageText = fetchedAt ? `Updated ${formatStatsAge(fetchedAt)}` : "";
    const ageSuffix = ageText ? `<small class="text-muted d-block" style="font-size:0.8em">${ageText}</small>` : "";
    el.innerHTML = `${running} worker${running !== 1 ? "s" : ""} running${ageSuffix}`;
}

async function loadBreachBreakdown() {
    try {
        const response = await fetch("/api/breaches/list", { headers: { "API-KEY": Cookies.get("auth") } });
        if (!response.ok) {
            if (response.status === 401) failedAuth();
            return null;
        }
        const data = await response.json();
        return data.success ? data.data : null;
    } catch { return null; }
}

async function renderBreachBreakdownChart(data) {
    if (!window.ApexCharts || !data) return;
    const typeCounts = {};
    for (const breach of data) {
        const type = breach.type || "Unknown";
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    const labels = Object.keys(typeCounts);
    const series = Object.values(typeCounts);
    const tablerPalette = ["primary", "green", "yellow", "red", "purple", "azure", "orange", "teal", "pink", "cyan"];
    const isDark = document.documentElement.getAttribute("data-bs-theme") === "dark";
    const colors = labels.map((_, i) => tabler.getColor(tablerPalette[i % tablerPalette.length]));
    new ApexCharts(document.getElementById("chart-breakdown"), {
        chart: { type: "donut", fontFamily: "inherit", height: 240, parentHeightOffset: 0, toolbar: { show: false }, animations: { enabled: false } },
        series, labels, colors,
        tooltip: { theme: isDark ? "dark" : "light" },
        legend: { position: "bottom", labels: { colors: tabler.getColor("body-color") } },
        responsive: [{ breakpoint: 480, options: { chart: { width: 200 }, legend: { position: "bottom" } } }]
    }).render();
}

document.addEventListener("DOMContentLoaded", async () => {
    const breachData = await loadBreachBreakdown();
    await Promise.all([
        loadTopStats(),
        loadDockerStats(),
        loadRunningWorkers(),
        breachData ? renderBreachBreakdownChart(breachData) : Promise.resolve()
    ]);

    setInterval(loadTopStats, MINUTE);
    setInterval(loadDockerStats, MINUTE);
    setInterval(loadRunningWorkers, WORKERS_MAX_AGE_MS);

    setInterval(() => {
        localStorage.removeItem(storageKeys.topStats);
        localStorage.removeItem(storageKeys.dockerStats);
        loadTopStats();
        loadDockerStats();
        loadBreachBreakdown().then(data => data && renderBreachBreakdownChart(data));
    }, STATS_MAX_AGE_MS);
});
