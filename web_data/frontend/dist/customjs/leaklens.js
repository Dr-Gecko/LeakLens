const DEBUG = false;
const ONE_HOUR = 60 * 60 * 1000;
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

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

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
    for (const id of ["setting_pfp", "avatar"]) {
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

document.addEventListener("DOMContentLoaded", async () => {
    if (!DEBUG && !localStorage.getItem("logged_in")) {
        window.location.href = "/sign-in";
        return;
    }

    let userData = JSON.parse(localStorage.getItem("user") || "{}");

    if (!userData.age || userData.age < Date.now() - ONE_HOUR) {
        userData = await getUserInfo();
    }

    if (userData) loadUserData();
});