const BREACHES_API = '/api/breaches/list';
const MAP_API = '/api/breaches/addresses';
const BATCH_SIZE = 1000;

let leafletMap = null;
let clusterLayer = null;
let tileLayer = null;
let fittedBounds = false;
let authFailed = false;

const TILES = {
    light: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
    dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
    },
};

function isDarkMode() {
    return localStorage.getItem("tablerTheme") === 'dark';
}

function applyTileTheme() {
    if (!leafletMap) return;
    const t = isDarkMode() ? TILES.dark : TILES.light;
    if (tileLayer) leafletMap.removeLayer(tileLayer);
    tileLayer = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 19 }).addTo(leafletMap);
    tileLayer.bringToBack();
}

function safeTableName(name) {
    return name.replace(/ /g, '_').toLowerCase();
}

function personIcon(color) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="28" viewBox="0 0 22 28">
        <circle cx="11" cy="7" r="6" fill="${color}" stroke="white" stroke-width="1.5"/>
        <path d="M1 28 Q1 16 11 16 Q21 16 21 28Z" fill="${color}" stroke="white" stroke-width="1.5"/>
    </svg>`;
    return L.divIcon({
        className: '',
        html: svg,
        iconSize: [22, 28],
        iconAnchor: [11, 28],
        popupAnchor: [0, -30],
    });
}

function buildPopup(point) {
    const skip = new Set(['lat', 'lng', 'id', 'pii', 'breach_name', 'extra','threat_actor', 'date_added']);
    const lines = [];

    let pii = {};
    if (point.pii) {
        try { pii = typeof point.pii === 'string' ? JSON.parse(point.pii) : point.pii; } catch {}
    }

    // Personal info: record-level name first, then all pii fields
    if (point.name) lines.push(`<strong>Name:</strong> ${point.name}`);
    for (const [k, v] of Object.entries(pii)) {
        if (v !== null && v !== '' && k !== 'name')
            lines.push(`<strong>${k.replace(/_/g, ' ')}:</strong> ${v}`);
    }

    // Any other top-level fields not in skip
    for (const [k, v] of Object.entries(point)) {
        if (!skip.has(k) && k !== 'name' && v !== null && v !== '')
            lines.push(`<strong>${k.replace(/_/g, ' ')}:</strong> ${v}`);
    }

    // Breach name at the very bottom
    if (point.breach_name)
        lines.push(`<hr style="margin:5px 0;opacity:0.3"><small style="opacity:0.65">${point.breach_name}</small>`);

    return lines.join('<br>') || `${point.lat}, ${point.lng}`;
}

function addMarkers(points) {
    const markers = [];
    for (const point of points) {
        const lat = parseFloat(point.lat);
        const lng = parseFloat(point.lng);
        if (!isNaN(lat) && !isNaN(lng))
            markers.push(L.marker([lat, lng], { icon: personIcon(stringToColor(point.breach_name || '')) })
                .bindPopup(buildPopup(point)));
    }
    if (!markers.length) return;
    clusterLayer.addLayers(markers);
    if (!fittedBounds) {
        leafletMap.fitBounds(clusterLayer.getBounds(), { padding: [30, 30] });
        fittedBounds = true;
    }
}

async function loadTable(tableName, authKey) {
    let offset = 0;
    while (true) {
        if (authFailed) return;
        const params = new URLSearchParams({ table_name: tableName, limit: BATCH_SIZE, offset });
        const resp = await fetch(`${MAP_API}?${params}`, { headers: { 'API-KEY': authKey } });
        if (resp.status === 401) {
            if (!authFailed) { authFailed = true; failedAuth(); }
            return;
        }
        if (!resp.ok) return;

        const json = await resp.json();
        if (!json.success || !Array.isArray(json.data) || !json.data.length) return;

        addMarkers(json.data);

        offset += json.data.length;
        if (json.data.length < BATCH_SIZE) return;

        await new Promise(r => setTimeout(r, 0));
    }
}

async function loadAndPlot() {
    const authKey = Cookies.get('auth');
    const resp = await fetch(BREACHES_API, { headers: { 'API-KEY': authKey } });
    if (resp.status === 401) { failedAuth(); return; }
    if (!resp.ok) return;

    const json = await resp.json();
    if (!json.success || !Array.isArray(json.data) || !json.data.length) return;

    const tables = json.data.map(b => safeTableName(b.name));
    Promise.allSettled(tables.map(t => loadTable(t, authKey)));
}

document.addEventListener('DOMContentLoaded', async () => {
    leafletMap = L.map('map').setView([39.5, -98.35], 4);
    applyTileTheme();

    new MutationObserver(applyTileTheme).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-bs-theme'],
    });

    clusterLayer = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 60 });
    leafletMap.addLayer(clusterLayer);

    loadAndPlot(); // intentionally not awaited — loads in background
});
