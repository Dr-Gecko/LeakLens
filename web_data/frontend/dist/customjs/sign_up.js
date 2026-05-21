document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const username = document.querySelector('input[type="username"]').value;
        const password = document.querySelector('input[type="password"]').value;
        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            const data = await response.json();

            if (response.status==200) {
                window.location.href = "/sign-in"; 
            } else {
                Swal.fire({
                    title: "Login Error",
                    text: "You clicked the button!",
                    icon: "error"
                });
            }
        } catch (error) {
            console.error("Request error:", error);
            alert("Unable to connect to server");
        }
    });
});