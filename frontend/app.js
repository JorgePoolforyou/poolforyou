const API_BASE_URL = "https://poolforyou-api.onrender.com";

console.log("APP.JS CARGADO");

function setError(msg) {
    const errorEl = document.getElementById("error");
    if (errorEl) errorEl.innerText = msg || "";
}

async function doLogin() {
    const emailEl = document.getElementById("email");
    const passEl = document.getElementById("password");

    const email = emailEl ? emailEl.value.trim() : "";
    const password = passEl ? passEl.value : "";

    setError("");

    if (!email || !password) {
        setError("Rellena email y contraseña");
        return;
    }

    try {
        // 🔑 CAMBIO CLAVE: form-urlencoded (NO JSON)
        const formData = new URLSearchParams();
        formData.append("username", email); // FastAPI espera "username"
        formData.append("password", password);

        const response = await fetch(`${API_BASE_URL}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: formData.toString()
        });

        if (!response.ok) {
            const data = await response.json().catch(() => null);
            setError(
                data?.detail
                    ? data.detail
                    : `Error (${response.status}) al iniciar sesión`
            );
            return;
        }

        const data = await response.json();

        // Guardar token
        localStorage.setItem("token", data.access_token);

        // Redirigir al dashboard
        window.location.href = "dashboard.html";

    } catch (err) {
        console.error(err);
        setError("No se puede conectar con el servidor");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btnLogin");
    if (!btn) {
        console.error("NO EXISTE btnLogin");
        return;
    }

    btn.addEventListener("click", doLogin);

    const passEl = document.getElementById("password");
    if (passEl) {
        passEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") doLogin();
        });
    }
});
