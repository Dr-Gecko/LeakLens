const usersState = {
    page: 1,
    pageSize: 16,
};

let allUsers = [];

async function getUsersData() {
    try {
        const response = await fetch("/api/auth/list", {
            headers: {
                "API-KEY": Cookies.get("auth")
            }
        });
        if (!response.ok) { if (response.status === 401) { failedAuth(); } return null; }
        const data = await response.json();
        return data.success
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

function renderUsersPagination(totalPages) {
    const el = document.getElementById("users_pagination");
    if (!el) return;

    const current = usersState.page;
    const pages = [];

    for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
    }

    el.innerHTML = `
        <li class="page-item ${current === 1 ? "disabled" : ""}">
            <a class="page-link" href="#" tabindex="-1" aria-disabled="${current === 1}" data-page="${current - 1}">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-1">
                    <path d="M15 6l-6 6l6 6" />
                </svg>
                prev
            </a>
        </li>
        ${pages.map(p => `
            <li class="page-item ${p === current ? "active" : ""}">
                <a class="page-link" href="#" data-page="${p}">${p}</a>
            </li>
        `).join("")}
        <li class="page-item ${current === totalPages ? "disabled" : ""}">
            <a class="page-link" href="#" data-page="${current + 1}">
                next
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-1">
                    <path d="M9 6l6 6l-6 6" />
                </svg>
            </a>
        </li>
    `;

    el.querySelectorAll("[data-page]").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();

            const page = parseInt(link.dataset.page);

            if (page >= 1 && page <= totalPages) {
                usersState.page = page;
                renderUsers();
            }
        });
    });
}

function renderUsers() {
    const usersContainer = document.getElementById("users");
    if (!usersContainer) {
        return;
    }

    const total = allUsers.length;
    const totalPages = Math.max(1, Math.ceil(total / usersState.pageSize));

    if (usersState.page > totalPages) usersState.page = totalPages;

    const start = (usersState.page - 1) * usersState.pageSize;
    const pageUsers = allUsers.slice(start, start + usersState.pageSize);

    usersContainer.innerHTML = pageUsers.map(createUserCard).join("");

    const countEl = document.getElementById("user_count");
    if (countEl) countEl.textContent = total;

    const infoEl = document.getElementById("users_info");
    if (infoEl) {
        infoEl.innerHTML = total === 0
            ? "No users found"
            : `${start + 1}-${Math.min(start + usersState.pageSize, total)} of <span id="user_count">${total}</span> users`;
    }

    renderUsersPagination(totalPages);
}

async function loadUsers() {
    const userData = await getUsersData();
    allUsers = Array.isArray(userData) ? userData : [];
    usersState.page = 1;
    renderUsers();
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadUsers();
});