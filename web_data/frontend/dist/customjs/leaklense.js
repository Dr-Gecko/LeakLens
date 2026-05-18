const DEBUG=true
async function getUserInfo() {
    try {
        const response = await fetch("/api/auth/info", {headers: {"API-KEY": Cookies.get("auth")}});
        if (!response.ok) {throw new Error(`HTTP error! status: ${response.status}`);}

        const data = await response.json();
        var user_data={"age": new Date().getTime(),"user_info":data.data.user_info}
        localStorage.setItem("user",JSON.stringify(user_data));
        return data.status === "success"? data.data.users: null;

    } catch (error) {
        console.error("Request failed:", error);
        return null;
    }
}
async function loadUserData() {
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || "null";
    };
    const setAvatar = (id, url) => {
        const el = document.getElementById(id);
        if (el) el.style.backgroundImage = `url('${url || "/dist/img/default.png"}')`;
    };
    setAvatar("avatar", userData.avatar);
    setText("username", userData.username);
    setText("user_role", userData.user_role);
}


document.addEventListener("DOMContentLoaded", () => {
    if (!DEBUG){
        if(!localStorage.getItem("logged_in")){window.location.href = "/sign-in";}
    }
    if (!localStorage.getItem("user")){
        getUserInfo();
    }
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    if (userData.age > (new Date().getTime())-(60*60*1) )
    loadUserData();
});
