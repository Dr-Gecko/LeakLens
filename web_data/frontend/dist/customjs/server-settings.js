
function throw_alert(reason, type) { Swal.fire({ position: "top-end", title: reason, showConfirmButton: false, background: "#182433", color: "#eeeeee", icon: type, timer: 1000 }); }

const FIELD_MAP = [
    { id: "serverName", parent: "api", child: "name" },
    { id: "business_id", parent: "api", child: "business_id" },
    { id: "location", parent: "api", child: "location" },
    { id: "databaseIP", parent: "database", child: "host" },
    { id: "databasePort", parent: "database", child: "port" },
    { id: "databaseDB", parent: "database", child: "backend_db" },
    { id: "breachDB", parent: "database", child: "breaches_db" },
];

const originalValues = {};

async function saveServerSettings() {
    const updates = FIELD_MAP
        .map(({ id, parent, child }) => ({ id, parent, child, data: document.getElementById(id)?.value.trim() }))
        .filter(({ id, data }) => data !== undefined && data !== "" && data !== originalValues[id]);

    if (updates.length === 0) {
        throw_alert("Nothing to save", "warning");
        return;
    }
    try {
        const headers = { "API-KEY": Cookies.get("auth"), "Content-Type": "application/json" };
        const results = await Promise.all(
            updates.map(payload =>
                fetch("/api/server/config", { method: "POST", body: JSON.stringify(payload), headers })
            )
        );
        const anyUnauth = results.some(r => r.status === 401);
        if (anyUnauth) {
            throw_alert("Invalid API Key", "error");
            window.location.href = "/sign-in";
            return;
        }
        const allOk = results.every(r => r.ok);
        if (allOk) {
            throw_alert("Settings saved", "success");
        } else {
            throw_alert("Save failed", "error");
        }
    } catch (error) {
        throw_alert("Save failed", "error");
    }
}

async function loadServerSettings() {
    try {
        const response = await fetch("/api/server/config", {
            headers: { "API-KEY": Cookies.get("auth") }
        });
        if (response.status === 401) { window.location.href = "/sign-in"; return; }
        if (!response.ok) return;
        const config = await response.json();
        for (const { id, parent, child } of FIELD_MAP) {
            const el = document.getElementById(id);
            const val = config[parent]?.[child];
            if (el && val !== undefined) {
                el.value = val;
                originalValues[id] = String(val);
            }
        }
    } catch (_) {
        console.log(_)
    }
} 
function reloadRecordsCount() {
    const bar = document.getElementById("progress-bar");
    const bardiv = document.getElementById("bar-div");
    bar.style.width = "0%";
    bar.setAttribute("aria-valuenow", 0);
    bar.style.visibility = "visible";
    bardiv.style.visibility = "visible";
    const source = new EventSource("/api/breaches/reload");

    source.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const pct = Math.round(data.progress);
        bar.style.width = pct + "%";
        bar.setAttribute("aria-valuenow", pct);
        if (data.complete) {
            source.close();
            bar.style.visibility = "hidden";
            bardiv.style.visibility = "hidden";
        }
    };
    source.onerror = () => {
        source.close();
        bar.style.visibility = "hidden";
        bardiv.style.visibility = "hidden";
    };
}
document.addEventListener("DOMContentLoaded", () => {
    loadServerSettings();
    document.getElementById("submitServerSettings").addEventListener("click", (e) => {
        e.preventDefault();
        saveServerSettings();
    });
    document.getElementById("btn-update-records-count").addEventListener("click", (e) => {
        e.preventDefault();
        reloadRecordsCount()
    });
});
