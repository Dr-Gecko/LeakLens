const DEBUG = false;
const ONE_HOUR = 5 * 60 * 1000;
const navbar_pages = {
    home: {
        title: "Home",
        href: "./index.html",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-1"><path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></svg>`
    },
    breaches: {
        title: "Breaches",
        href: "./breaches.html",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-article"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -12" /><path d="M7 8h10" /><path d="M7 12h10" /><path d="M7 16h10" /></svg>`
    },
    users: {
        title: "Users",
        href: "./users.html",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-users"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg>`
    },
    search: {
        title: "Search",
        href: "./search.html",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-search"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>`
    },
    map: {
        title: "Map",
        href: "./map.html",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-map"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M3 7l6 -3l6 3l6 -3v13l-6 3l-6 -3l-6 3v-13" /><path d="M9 4v13" /><path d="M15 7v13" /></svg>`
    },
    workers: {
        title: "Workers",
        href: "./workers.html",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-cpu"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M5 5m0 1a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1z" /><path d="M9 9h6v6h-6z" /><path d="M3 10h2" /><path d="M3 14h2" /><path d="M10 3v2" /><path d="M14 3v2" /><path d="M21 10h-2" /><path d="M21 14h-2" /><path d="M10 21v-2" /><path d="M14 21v-2" /></svg>`
    }
};

function add_navbar_pages() {
    const list = document.getElementById("navbar-pages");

    list.innerHTML = "";

    const currentNorm = normalizePage(window.location.pathname);

    Object.values(navbar_pages).forEach(page => {

        const isActive = currentNorm === normalizePage(page.href);

        list.insertAdjacentHTML("beforeend", `
            <li class="nav-item ${isActive ? "active" : ""}">
                <a class="nav-link" href="${page.href}">
                    <span class="nav-link-icon d-md-none d-lg-inline-block">
                        ${page.icon}
                    </span>
                    <span class="nav-link-title">
                        ${page.title}
                    </span>
                </a>
            </li>
        `);
    });
}
function normalizePage(path) {
    return path
        .split("/")
        .pop()
        .replace(".html", "")
        .replace(/^$/, "index");
}

const stringToColor = (str) => {
    let hash = 0;
    str.split('').forEach(char => {
        hash = char.charCodeAt(0) + ((hash << 5) - hash)
    })
    let c = '#'
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xff
        c += value.toString(16).padStart(2, '0')
    }
    return c
}
function timeDifference(current, previous) {

    var msPerMinute = 60 * 1000;
    var msPerHour = msPerMinute * 60;
    var msPerDay = msPerHour * 24;
    var msPerMonth = msPerDay * 30;
    var msPerYear = msPerDay * 365;

    var elapsed = current - previous;

    if (elapsed < msPerMinute) {
        return Math.round(elapsed / 1000) + ' seconds ago';
    }

    else if (elapsed < msPerHour) {
        return Math.round(elapsed / msPerMinute) + ' minutes ago';
    }

    else if (elapsed < msPerDay) {
        return Math.round(elapsed / msPerHour) + ' hours ago';
    }

    else if (elapsed < msPerMonth) {
        return 'approximately ' + Math.round(elapsed / msPerDay) + ' days ago';
    }

    else if (elapsed < msPerYear) {
        return 'approximately ' + Math.round(elapsed / msPerMonth) + ' months ago';
    }

    else {
        return 'approximately ' + Math.round(elapsed / msPerYear) + ' years ago';
    }
}
function formatPhoneNumber(phoneNumberString) {
    var cleaned = ('' + phoneNumberString).replace(/\D/g, '');
    var match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
        return '(' + match[1] + ') ' + match[2] + '-' + match[3];
    }
    return null;
}
function failedAuth() {
    localStorage.clear()
    window.location = '/sign-in'
}
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
async function getUserInfo() {
    try {
        const response = await fetch("/api/auth/info", {
            headers: { "API-KEY": Cookies.get("auth") }
        });

        if (!response.ok) {
            if (response.status == 401) {
                failedAuth()
            }
            return null;
        }

        const data = await response.json();
        if (data.status === "success") {
            const userData = {
                age: Date.now(),
                ...data.data.user_info
            };

            localStorage.setItem("user", JSON.stringify(userData));
            return userData;
        }
        return null;
    } catch (error) {
        console.error("Request failed:", error);
        return null;
    }
}
function update_profile_picture() {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const path = userData.user_avatar_path;
    const bg = path ? `url('${path}')` : "url('/dist/img/default.png')";
    for (const id of ["settings-avatar", "avatar"]) {
        const el = document.getElementById(id);
        if (el) el.style.backgroundImage = bg;
    }
}
function loadUserData() {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || "null";
    };

    setText("username", userData.username);
    setText("user_role", userData.role);
    update_profile_picture();
}
function loadLeakLensData() {
    const leakLensData = JSON.parse(localStorage.getItem("leakLensData") || "{}");

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || "null";
    };

    setText("version", leakLensData.version);
    document.getElementById("version").href = `/changelog#${leakLensData.version}`
    update_profile_picture();
}

async function getServerInfo() {
    try {
        const response = await fetch("/api/server/info", {
            headers: { "API-KEY": Cookies.get("auth") }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();

        if (data.status === "success") {
            const leakLensData = {
                age: Date.now(),
                ...data.data
            };

            localStorage.setItem("leakLensData", JSON.stringify(leakLensData));
            return leakLensData;
        }

        return null;
    } catch (error) {
        console.error("Request failed:", error);
        return null;
    }
}
document.addEventListener("DOMContentLoaded", async () => {
    if (!DEBUG && !Cookies.get("auth")) {
        window.location.href = "/sign-in";
        return;
    }

    let userData = JSON.parse(localStorage.getItem("user") || "{}");

    if (!userData.age || userData.age < Date.now() - ONE_HOUR) {
        userData = await getUserInfo();
    }
    if (userData) loadUserData();

    let leakLensData = JSON.parse(localStorage.getItem("leakLensData") || "{}");

    if (!leakLensData.age || leakLensData.age < Date.now() - ONE_HOUR) {
        leakLensData = await getServerInfo();
    }

    if (leakLensData) loadLeakLensData();
    add_navbar_pages()
});