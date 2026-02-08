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
        // 🔑 FastAPI OAuth2PasswordRequestForm → form-urlencoded
        const formData = new URLSearchParams();
        formData.append("username", email);
        formData.append("password", password);

        console.log("Intentando login contra:", `${API_BASE_URL}/login`);

        const response = await fetch(`${API_BASE_URL}/login`, {
            method: "POST",
            mode: "cors",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json"
            },
            body: formData.toString()
        });

        // ❗ Aquí ya NO es problema de red, el servidor respondió
        if (!response.ok) {
            let detail = `Error (${response.status}) al iniciar sesión`;

            try {
                const data = await response.json();
                if (data?.detail) detail = data.detail;
            } catch (_) {
                // No era JSON (por ejemplo HTML de error)
            }

            setError(detail);
            return;
        }

        const data = await response.json();

        if (!data.access_token) {
            setError("Respuesta inválida del servidor");
            return;
        }

        // Guardar token
        localStorage.setItem("token", data.access_token);

        // Redirigir
        window.location.href = "dashboard.html";

    } catch (err) {
        // 🔴 ESTE catch solo se ejecuta si:
        // - el backend está caído
        // - hay problema de CORS
        // - hay problema de red
        console.error("ERROR DE FETCH:", err);
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
