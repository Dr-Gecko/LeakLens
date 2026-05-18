document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const username = document.querySelector('input[type="username"]').value;
        const password = document.querySelector('input[type="password"]').value;
        try {
            const response = await fetch("/api/auth/login", {
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
                localStorage.setItem("logged_in",true)
                localStorage.setItem("user", JSON.stringify(data.data.user_data));
                const date = new Date(JSON.stringify(data.data.expire_time).replace(" ", "T"));
                Cookies.set('auth',data.data.token, { expires: date })
                window.location.href = "/"; 
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