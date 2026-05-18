function update_profile_picture() {
    const element = document.getElementById("setting_pfp");
    const storage_pfp = localStorage.getItem("user_avatar");
    if (element) { if (storage_pfp) { element.style.backgroundImage = `url('${storage_pfp}')`; } else { element.style.backgroundImage = "url('/dist/img/default.png')"; } }
}

async function updateUserAvatar() {
    const button = document.getElementById("submitAvatar");
    const fileInput = document.getElementById("avatarFile");
    button.addEventListener("click", async (event) => {
        if (!fileInput.files.length) { Swal.fire({ position: "top-end", title: "Please make file selection", showConfirmButton: false, background: "#182433", color: "#eeeeee", icon: "error", timer: 1000 }); return; }
        const formData = new FormData();
        formData.append("file", fileInput.files[0]);
        try {
            const response = await fetch("/api/utils/avatar", { method: "POST", body: formData, headers: { "API-KEY": Cookies.get("auth") } });
            const data = await response.json();
            if (response.ok) { Swal.fire({ position: "top-end", title: "New avatar successfully uploaded", showConfirmButton: false, background: "#182433", color: "#eeeeee", icon: "success", timer: 1000 }); }
            else if (response.status = 400) { Swal.fire({ position: "top-end", title: "Invalid API Key", showConfirmButton: false, background: "#182433", color: "#eeeeee", icon: "error", timer: 1000 }); window.location.href = "/sign-in" }
            else { Swal.fire({ position: "top-end", title: "Upload Error", showConfirmButton: false, background: "#182433", color: "#eeeeee", icon: "error", timer: 1000 }); }
        } catch (error) { Swal.fire({ position: "top-end", title: "Upload error", showConfirmButton: false, background: "#182433", color: "#eeeeee", icon: "error", timer: 1000 }); }
    });
}
document.addEventListener("DOMContentLoaded", () => { 
    updateUserAvatar()
});