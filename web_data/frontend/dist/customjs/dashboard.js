let map = null;
let markerLayer = null;

const breachColors = {};
const STATS_MAX_AGE_MS = 60 * 60 * 1000;


async function getTopStatsData() {
    try {
        const response = await fetch("/api/breaches/stats",{
            headers: {
                "API-KEY": Cookies.get("auth")
            }
        });
        if (!response.ok) {
            if (response.status==401){
                failedAuth()
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.status === "success") {
            return data.data;
        }
        return null;
    } catch (error) {
        console.error("Request failed:", error);
        return null;
    }
}
async function loadBreachBreakdown() {
    try {
        const response = await fetch("/api/breaches/list",{
            headers: {
                "API-KEY": Cookies.get("auth")
            }
        }
        );
        if (!response.ok) {
            if (response.status==401){
                failedAuth()
            }
            return null;
        }
        const data = await response.json();
        if (data.status !== "success") return null;
        return data.data
    } catch (e) {
        return null;
    }
}
async function loadDockerStats() {
    try {
        const response = await fetch("/api/server/stats",{
            headers: {
                "API-KEY": Cookies.get("auth")
            }
        });
        if (!response.ok) {
            if (response.status==401){
                failedAuth()
            }
            return null;
        }
        const data = await response.json();
        if (data.status !== "success") return null;
        return data.data
    } catch (e) {
        return null;
    }
}

async function getAllStats() {
    try {
        const dockerStatsObject = await loadDockerStats();
        const breachBreakdownObject = await loadBreachBreakdown();
        const topStatsObject = await getTopStatsData();
        const cachedData = { fetchedAt: Date.now(), dockerStats: dockerStatsObject, breachBreakdown: breachBreakdownObject, topStats: topStatsObject }
        localStorage.setItem("dashboardData", JSON.stringify(cachedData));
        return cachedData
    } catch (error) {
        console.error("Request failed:", error);
        return null;
    }
}


function formatStatsAge(fetchedAt) {
    const ageMs = Date.now() - fetchedAt;
    const minutes = Math.floor(ageMs / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
}

function loadUpperStats(fetchedAt, statsData) {
    const ageText = fetchedAt ? `Updated ${formatStatsAge(fetchedAt)}` : "";
    const ageSuffix = ageText ? `<small class="text-muted d-block" style="font-size:0.8em">${ageText}</small>` : "";
    const recordsElement = document.getElementById("records_count");
    const breachesElement = document.getElementById("breaches_count");
    const ingestersElement = document.getElementById("ingesters_count");
    if (recordsElement) recordsElement.innerHTML = `${Number(statsData.total_entries || 0).toLocaleString()} records stored${ageSuffix}`;
    if (ingestersElement) ingestersElement.innerHTML = `0 Ingesters running ${ageSuffix}`;
    if (breachesElement) breachesElement.innerHTML = `${Number(statsData.breaches || 0).toLocaleString()} breaches stored${ageSuffix}`;
}
async function loadAllData() {
    let fetchedAt = null;
    let statsData = null;

    const cachedRaw = localStorage.getItem("dashboardData");
    if (cachedRaw) {
        try {
            const parsed = JSON.parse(cachedRaw);
            if (parsed && parsed.fetchedAt && Date.now() - parsed.fetchedAt < STATS_MAX_AGE_MS) {
                fetchedAt = parsed.fetchedAt;
                statsData = parsed;
            } else {
                console.log("cached data expired, fetching fresh");
                localStorage.removeItem("dashboardData");
            }
        } catch (error) {
            console.error("Failed to parse cached stats:", error);
            localStorage.removeItem("dashboardData");
        }
    }

    if (!statsData) {
        statsData = await getAllStats();
        if (statsData) fetchedAt = statsData.fetchedAt;
    }
    if (!statsData) return;
    if (statsData.topStats) loadUpperStats(fetchedAt, statsData.topStats);
    if (statsData.dockerStats) loadContainerStats(statsData.dockerStats);
    if (statsData.breachBreakdown) renderBreachBreakdownChart(statsData.breachBreakdown);
}



async function renderBreachBreakdownChart(data) {
    if (!window.ApexCharts) return;
    if (!data) return;
    const typeCounts = {};
    for (const breach of data) { const type = breach.type || "Unknown"; typeCounts[type] = (typeCounts[type] || 0) + 1; }
    const labels = typeCounts ? Object.keys(typeCounts) : [];
    const series = typeCounts ? Object.values(typeCounts) : [];
    const tablerPalette = ["primary", "green", "yellow", "red", "purple", "azure", "orange", "teal", "pink", "cyan"];
    const isDark = document.documentElement.getAttribute("data-bs-theme") === "dark";
    const colors = labels.map((_, i) => tabler.getColor(tablerPalette[i % tablerPalette.length]));
    new ApexCharts(document.getElementById("chart-breakdown"), { chart: { type: "donut", fontFamily: "inherit", height: 240, parentHeightOffset: 0, toolbar: { show: false }, animations: { enabled: false }, }, series, labels, colors, tooltip: { theme: isDark ? "dark" : "light" }, legend: { position: "bottom", labels: { colors: tabler.getColor("body-color") }, }, responsive: [{ breakpoint: 480, options: { chart: { width: 200 }, legend: { position: "bottom" } }, }], }).render();
}
function loadContainerStats(statsData) {
    const networkStats = document.getElementById("container-network-stats");
    const memoryStats = document.getElementById("container-memory-stats");
    const containerStats = document.getElementById("container-status-stats");
    for (const item of [networkStats, memoryStats, containerStats]) {
        item.innerHTML = ""
    }
    statsData.forEach(container => {
        networkStats.innerHTML += `<tr><td>${container['name']}</td><td>${formatBytes(container['bytes_rx'], 0)}</td><td>${formatBytes(container['bytes_tx'], 0)}</td></tr>`
        memoryStats.innerHTML += `<tr><td>${container['name']}</td><td>${formatBytes(container['memory_usage'], 0)}</td></tr>`
        containerStats.innerHTML += `<tr><td>${container['name']}</td><td>${container['status']}</td></tr>`
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadAllData();
});


