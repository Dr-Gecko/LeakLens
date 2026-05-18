const DEBUG = false;
const ONE_HOUR = 60 * 60 * 1000;

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