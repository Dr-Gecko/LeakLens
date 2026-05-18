let map = null;
let markerLayer = null;
let mapFetchTimeout = null;
let activeMapRequestId = 0;

const MAP_LIMIT = 5000;
const breachColors = {};

async function getTopStatsData() {
    try {
        const response = await fetch("/api/leaklense/stats");

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === "success") {
            localStorage.setItem("stats", JSON.stringify(data.data));
            return data.data;
        }

        return null;
    } catch (error) {
        console.error("Request failed:", error);
        return null;
    }
}

async function loadStatsData() {
    let statsData = null;

    const cachedStats = localStorage.getItem("stats");

    if (cachedStats) {
        try {
            statsData = JSON.parse(cachedStats);
        } catch (error) {
            console.error("Failed to parse cached stats:", error);
            localStorage.removeItem("stats");
        }
    }

    if (!statsData) {
        statsData = await getTopStatsData();
    }

    if (!statsData) {
        return;
    }


    const recordsElement = document.getElementById("records_count");
    const breachesElement = document.getElementById("breaches_count");

    if (recordsElement) {
        recordsElement.innerHTML =
            `${Number(statsData.total_entries || 0).toLocaleString()} records stored`;
    }

    if (breachesElement) {
        breachesElement.innerHTML =
            `${Number(statsData.breaches || 0).toLocaleString()} breaches monitored`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadStatsData();
});