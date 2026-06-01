const DEBUG = false;
const ONE_HOUR = 5 * 60 * 1000;
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
         return Math.round(elapsed/1000) + ' seconds ago';   
    }

    else if (elapsed < msPerHour) {
         return Math.round(elapsed/msPerMinute) + ' minutes ago';   
    }

    else if (elapsed < msPerDay ) {
         return Math.round(elapsed/msPerHour ) + ' hours ago';   
    }

    else if (elapsed < msPerMonth) {
        return 'approximately ' + Math.round(elapsed/msPerDay) + ' days ago';   
    }

    else if (elapsed < msPerYear) {
        return 'approximately ' + Math.round(elapsed/msPerMonth) + ' months ago';   
    }

    else {
        return 'approximately ' + Math.round(elapsed/msPerYear ) + ' years ago';   
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
function failedAuth(){
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
            if (response.status==401){
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
    document.getElementById("version").href=`/changelog#${leakLensData.version}`
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
});