let map = null;
let markerLayer = null;

const breachColors = {};
const STATS_MAX_AGE_MS = 60 * 60 * 1000;

async function getTopStatsData() {
    try {
        const response = await fetch("/api/breaches/stats");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.status === "success") {
            const cached = { data: data.data, fetchedAt: Date.now() };
            localStorage.setItem("stats", JSON.stringify(cached));
            return cached;
        }
        return null;
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

async function loadBreachBreakdown() {
    try {
        const response = await fetch("/api/breaches/list");
        if (!response.ok) return null;
        const data = await response.json();
        if (data.status !== "success") return null;
        const typeCounts = {};
        for (const breach of data.data) {
            const type = breach.type || "Unknown";
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        }
        return typeCounts;
    } catch (e) {
        return null;
    }
}

async function loadStatsData() {
    let statsData = null;
    let fetchedAt = null;

    const cachedStats = localStorage.getItem("stats");
    if (cachedStats) {
        try {
            const parsed = JSON.parse(cachedStats);
            if (parsed && parsed.fetchedAt) {
                if (Date.now() - parsed.fetchedAt < STATS_MAX_AGE_MS) {
                    statsData = parsed.data;
                    fetchedAt = parsed.fetchedAt;
                } else {
                    localStorage.removeItem("stats");
                }
            } else {
                localStorage.removeItem("stats");
            }
        } catch (error) {
            console.error("Failed to parse cached stats:", error);
            localStorage.removeItem("stats");
        }
    }

    if (!statsData) {
        const result = await getTopStatsData();
        if (result) {
            statsData = result.data;
            fetchedAt = result.fetchedAt;
        }
    }

    if (!statsData) return;

    const ageText = fetchedAt ? `Updated ${formatStatsAge(fetchedAt)}` : "";
    const ageSuffix = ageText
        ? `<small class="text-muted d-block" style="font-size:0.8em">${ageText}</small>`
        : "";

    const recordsElement = document.getElementById("records_count");
    const breachesElement = document.getElementById("breaches_count");
    const ingestersElement = document.getElementById("ingesters_count");

    if (recordsElement) recordsElement.innerHTML = `${Number(statsData.total_entries || 0).toLocaleString()} records stored${ageSuffix}`;
    if (ingestersElement) ingestersElement.innerHTML = `0 Ingesters running ${ageSuffix}`;
    if (breachesElement) breachesElement.innerHTML = `${Number(statsData.breaches || 0).toLocaleString()} breaches monitored${ageSuffix}`;
}

function renderTrafficChart() {
    if (!window.ApexCharts) return;
    const isDark = document.documentElement.getAttribute("data-bs-theme") === "dark";
    new ApexCharts(document.getElementById("chart-mentions"), {
        chart: {
            type: "bar",
            fontFamily: "inherit",
            height: 240,
            parentHeightOffset: 0,
            toolbar: { show: false },
            animations: { enabled: false },
            stacked: true,
        },
        plotOptions: { bar: { columnWidth: "50%" } },
        dataLabels: { enabled: false },
        fill: { opacity: 1 },
        series: [
            { name: "Web",    data: [1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 2, 12, 5, 8, 22, 6, 8, 6, 4, 1, 8, 24, 29, 51, 40, 47, 23, 26, 50, 26, 41, 22, 46, 47, 81, 46, 6] },
            { name: "Social", data: [2, 5, 4, 3, 3, 1, 4, 7, 5, 1, 2, 5, 3, 2, 6, 7, 7, 1, 5, 5, 2, 12, 4, 6, 18, 3, 5, 2, 13, 15, 20, 47, 18, 15, 11, 10, 0] },
            { name: "Other",  data: [2, 9, 1, 7, 8, 3, 6, 5, 5, 4, 6, 4, 1, 9, 3, 6, 7, 5, 2, 8, 4, 9, 1, 2, 6, 7, 5, 1, 8, 3, 2, 3, 4, 9, 7, 1, 6] },
        ],
        tooltip: { theme: isDark ? "dark" : "light" },
        grid: {
            padding: { top: -20, right: 0, left: -4, bottom: -4 },
            strokeDashArray: 4,
            xaxis: { lines: { show: true } },
        },
        xaxis: {
            labels: { padding: 0 },
            tooltip: { enabled: false },
            axisBorder: { show: false },
            type: "datetime",
        },
        yaxis: { labels: { padding: 4 } },
        labels: [
            "2020-06-20", "2020-06-21", "2020-06-22", "2020-06-23", "2020-06-24", "2020-06-25", "2020-06-26",
            "2020-06-27", "2020-06-28", "2020-06-29", "2020-06-30", "2020-07-01", "2020-07-02", "2020-07-03",
            "2020-07-04", "2020-07-05", "2020-07-06", "2020-07-07", "2020-07-08", "2020-07-09", "2020-07-10",
            "2020-07-11", "2020-07-12", "2020-07-13", "2020-07-14", "2020-07-15", "2020-07-16", "2020-07-17",
            "2020-07-18", "2020-07-19", "2020-07-20", "2020-07-21", "2020-07-22", "2020-07-23", "2020-07-24",
            "2020-07-25", "2020-07-26",
        ],
        colors: [tabler.getColor("primary"), tabler.getColor("primary", 0.8), tabler.getColor("green", 0.8)],
        legend: { show: false },
    }).render();
}

async function renderBreachBreakdownChart() {
    if (!window.ApexCharts) return;
    const typeCounts = await loadBreachBreakdown();
    const labels = typeCounts ? Object.keys(typeCounts) : [];
    const series = typeCounts ? Object.values(typeCounts) : [];
    const tablerPalette = ["primary", "green", "yellow", "red", "purple", "azure", "orange", "teal", "pink", "cyan"];
    const isDark = document.documentElement.getAttribute("data-bs-theme") === "dark";
    const colors = labels.map((_, i) => tabler.getColor(tablerPalette[i % tablerPalette.length]));
    new ApexCharts(document.getElementById("chart-breakdown"), {
        chart: {
            type: "donut",
            fontFamily: "inherit",
            height: 240,
            parentHeightOffset: 0,
            toolbar: { show: false },
            animations: { enabled: false },
        },
        series,
        labels,
        colors,
        tooltip: { theme: isDark ? "dark" : "light" },
        legend: {
            position: "bottom",
            labels: { colors: tabler.getColor("body-color") },
        },
        responsive: [{
            breakpoint: 480,
            options: { chart: { width: 200 }, legend: { position: "bottom" } },
        }],
    }).render();
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadStatsData();
    renderTrafficChart();
    await renderBreachBreakdownChart();
});
