
async function getUsersData() {
    try {
        const response = await fetch("/api/auth/list", {
            headers: {
                "API-KEY": Cookies.get("auth")
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        return data.status === "success"
            ? data.data.users
            : null;

    } catch (error) {
        console.error("Request failed:", error);
        return null;
    }
}

function getInitials(name = "") {
    return name
        .split(" ")
        .map(part => part[0])
        .join("")
        .toUpperCase();
}

function createUserCard(user) {
    const avatar = `<span class="avatar avatar-xl mb-3 rounded" style="background-image: url('.${user.user_avatar_path}')"></span>`;

    const badge = user.role ? `<span class="badge ${user.badge || "bg-secondary-lt"}">${user.role}</span>` : "";

    return `
    <div class="col-md-6 col-lg-3">
        <div class="card">
            <div class="card-body p-4 text-center">
                ${avatar}

                <h3 class="m-0 mb-1">
                    <a href="#">${user.username || "Unknown"}</a>
                </h3>

                <div class="text-secondary">
                    User ID: ${user.user_id || ""}
                </div>

                <div class="mt-3">
                    ${badge}
                </div>
            </div>

            <div class="d-flex">
                <a href="mailto:${user.email || "#"}" class="card-btn">
                    Email
                </a>

                <a href="tel:${user.phone || "#"}" class="card-btn">
                    Call
                </a>
            </div>
        </div>
    </div>
    `;
}

async function loadUsers() {
    const usersContainer = document.getElementById("users");
    if (!usersContainer) {
        return;
    }
    const userData = await getUsersData();
    const usersToRender = Array.isArray(userData)? userData: [];
    usersContainer.innerHTML = usersToRender.map(createUserCard).join("");

}

document.addEventListener("DOMContentLoaded", async () => {
    await loadUsers();
});