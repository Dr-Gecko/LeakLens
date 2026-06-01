function tokenExpireLabel(now, then) {
    const diff = then - now;
    const abs = Math.abs(diff);
    const expired = diff < 0;

    const units = [
        { label: "year",   ms: 365 * 24 * 60 * 60 * 1000 },
        { label: "month",  ms: 30  * 24 * 60 * 60 * 1000 },
        { label: "day",    ms: 24  * 60 * 60 * 1000 },
        { label: "hour",   ms: 60  * 60 * 1000 },
        { label: "minute", ms: 60  * 1000 },
        { label: "second", ms: 1000 },
    ];

    for (const unit of units) {
        const val = Math.floor(abs / unit.ms);
        if (val >= 1) {
            const label = `${val} ${unit.label}${val !== 1 ? "s" : ""}`;
            return expired ? `Expired ${label} ago` : `Expires in ${label}`;
        }
    }
    return expired ? "Just expired" : "Expires shortly";
}

async function update_profile_picture() {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const path = userData.user_avatar_path;
    const bg = path ? `url('${path}')` : "url('/dist/img/default.png')";
    for (const id of ["settings-avatar", "avatar"]) {
        const el = document.getElementById(id);
        if (el) el.style.backgroundImage = bg;
    }
}
function throw_alert(reason,type){Swal.fire({position: "top-end",title: reason,showConfirmButton: false,background: "#182433",color: "#eeeeee",icon: type,timer: 1000})}


async function updateUserAvatar() {
    const button = document.getElementById("submitAvatar");
    const fileInput = document.getElementById("avatarFile");
    button.addEventListener("click", async (event) => {
        if (!fileInput.files.length) {
            throw_alert("Please make file selection","error")
            return;
        }
        const formData = new FormData();
        formData.append("file", fileInput.files[0]);
        try {
            const response = await fetch("/api/auth/avatar", {
                method: "POST",
                body: formData,
                headers: {
                    "API-KEY": Cookies.get("auth")
                }
            });
            const data = await response.json();
            if (response.ok) {
                const userData = JSON.parse(localStorage.getItem("user") || "{}");
                userData.user_avatar_path = data.data.avatar_path;
                localStorage.setItem("user", JSON.stringify(userData));
                await update_profile_picture();
                throw_alert("New avatar successfully uploaded","success")
            } else if (response.status === 401) {
                throw_alert("Invalid API Key","error")
                window.location.href = "/sign-in"
            } else {
                throw_alert("Upload Error","error")
            }
        } catch (error) {
            throw_alert("Upload Error","error")
        }
    });
}
async function changeUsername(newUsername) {
    try {
        const response = await fetch("/api/auth/update", {
            method: "POST",
            body: JSON.stringify({ "data": newUsername, "update":"username"}),
            headers: {
                "API-KEY": Cookies.get("auth"),
                "Content-Type": "application/json"
            }
        });
        const data = await response.json();
        if (response.ok) {
            await getUserInfo();
            loadUserData();
            throw_alert("Username updated", "success");
        } else if (response.status === 400) {
            throw_alert("Invalid API Key", "error");
            window.location.href = "/sign-in";
        } else {
            throw_alert("Update Error", "error");
        }
    } catch (error) {
        throw_alert("Update Error", "error");
    }
}

async function changePassword(newPassword) {
    try {
        const response = await fetch("/api/auth/update", {
            method: "POST",
            body: JSON.stringify({ "data": newPassword, "update":"password" }),
            headers: {
                "API-KEY": Cookies.get("auth"),
                "Content-Type": "application/json"
            }
        });
        const data = await response.json();
        if (response.ok) {
            await getUserInfo();
            loadUserData();
            throw_alert("Password updated", "success");
        } else if (response.status === 400) {
            throw_alert("Invalid API Key", "error");
            window.location.href = "/sign-in";
        } else {
            throw_alert("Update Error", "error");
        }
    } catch (error) {
        throw_alert("Update Error", "error");
    }
}

async function createAPIToken(name,expire_time,expire_unit) {
    try {
        const response = await fetch("/api/auth/token", {
            method: "POST",
            body: JSON.stringify({name:name, expire:{[expire_unit]: parseInt(expire_time)}}),
            headers: {
                "API-KEY": Cookies.get("auth"),
                "Content-Type": "application/json"
            }
        });
        const data = await response.json();
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById("modal-create-api")).hide();
            await loadAPITokens();
            document.getElementById("revealed-token").value = data.data.token;
            new bootstrap.Modal(document.getElementById("modal-token-reveal")).show();
            document.getElementById("btn-copy-token").onclick = () => {
                navigator.clipboard.writeText(data.data.token);
                throw_alert("Copied", "success");
            };
        } else if (response.status === 401) {
            throw_alert("Invalid API Key", "error");
            window.location.href = "/sign-in";
        } else {
            throw_alert("Token creation failed", "error");
        }
    } catch (error) {
        throw_alert("Token creation failed", "error");
    }
}

async function pullAPITokens() {
    try {
        const response = await fetch("/api/auth/token", {
            headers: {
                "API-KEY": Cookies.get("auth"),
                "Content-Type": "application/json"
            }
        });
        const data = await response.json();
        if (response.ok) {
            console.log(data)
            return data.data.tokens
        } else if (response.status === 401) {
            throw_alert("Invalid API Key", "error");
            window.location.href = "/sign-in";
        } else {
            throw_alert("Token Listing Error", "error");
        }
    } catch (error) {
        throw_alert("Token Listing Error", "error");
    }
}
async function revokeAPIToken(uuid) {
    try {
        const response = await fetch("/api/auth/token", {
            method: "DELETE",
            body: JSON.stringify({ uuid }),
            headers: {
                "API-KEY": Cookies.get("auth"),
                "Content-Type": "application/json"
            }
        });
        if (response.ok) {
            document.getElementById("api-tokens").innerHTML = "";
            await loadAPITokens();
            throw_alert("Token revoked", "success");
        } else if (response.status === 401) {
            failedAuth()
            return;
        } else {
            throw_alert("Revoke failed", "error");
        }
    } catch (error) {
        throw_alert("Revoke failed", "error");
    }
}

async function loadAPITokens(){
    const apiTokens = await pullAPITokens()
    document.getElementById("api-tokens").innerHTML = "";
    apiTokens.forEach(token => {
        document.getElementById("api-tokens").innerHTML+=
        `<tr>
														<td>${token.name}</td>
														<td>${tokenExpireLabel(Date.now(),new Date(token.auth_token_expire + 'Z').getTime())}</td>
														<td>${token.uses}</td>
														<td>
															<div class="btn-list flex-nowrap">
                                                                <a class="btn btn-1 btn-revoke-token" data-uuid="${token.uuid}"> Revoke </a>
															</div>
														</td>
													</tr>`
    })
    document.querySelectorAll(".btn-revoke-token").forEach(btn => {
        btn.addEventListener("click", (e) => { e.preventDefault(); revokeAPIToken(btn.dataset.uuid); });
    });
}
document.addEventListener("DOMContentLoaded", () => {
    updateUserAvatar();
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const currentUsername = userData.username;
    const usernameInput = document.getElementById("usernameInput");
    if (usernameInput && currentUsername) {
        usernameInput.placeholder = currentUsername;
    }
    document.getElementById("changeUsernameBtn").addEventListener("click", function (e) {e.preventDefault();const newUsername = document.getElementById("usernameInput").value.trim();if (!newUsername) {throw_alert("Username cannot be empty", "error");return;}changeUsername(newUsername);});
    document.getElementById("changePasswordBtn").addEventListener("click", function (e) {e.preventDefault();const newPassword = document.getElementById("passwordInput").value;if (!newPassword) {throw_alert("Password cannot be empty", "error");return;}changePassword(newPassword);});
    document.getElementById("btn-create-token-submit").addEventListener("click", (e) => {e.preventDefault();const name = document.getElementById("apiTokenName").value;const expire_time = document.getElementById("apiExpireTime").value;const expire_unit = document.getElementById("apiExpireUnit").value;createAPIToken(name,expire_time,expire_unit)});
    loadAPITokens()
});