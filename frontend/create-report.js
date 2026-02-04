const API_BASE_URL = "https://poolforyou-api.onrender.com";


const token = localStorage.getItem("token");

if (!token) {
    alert("No estás autenticado");
    window.location.href = "login.html";
}

// Esperar a que cargue el DOM
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("reportForm");
    if (!form) {
        console.error("No existe reportForm");
        return;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const location = document.getElementById("location").value.trim();
        const description = document.getElementById("description").value.trim();
        const photosInput = document.getElementById("photos");

        const statusEl = document.getElementById("status");
        statusEl.innerText = "Enviando parte...";

        if (!location || !description) {
            statusEl.innerText = "❌ Rellena todos los campos obligatorios";
            return;
        }

        try {
            // 1️⃣ Crear el parte
            const res = await fetch(`${API_BASE_URL}/work-reports`, {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    location,
                    data: { description }
                })
            });

            if (!res.ok) {
                const txt = await res.text();
                console.error(txt);
                statusEl.innerText = "❌ Error al crear el parte";
                return;
            }

            const report = await res.json();
            const reportId = report.id;

            // 2️⃣ Subir fotos (si hay)
            if (photosInput && photosInput.files.length > 0) {
                const formData = new FormData();

                for (const file of photosInput.files) {
                    formData.append("files", file);
                }

                const photoRes = await fetch(
                    `${API_BASE_URL}/work-reports/${reportId}/photos`,
                    {
                        method: "POST",
                        headers: {
                            "Authorization": "Bearer " + token
                        },
                        body: formData
                    }
                );

                if (!photoRes.ok) {
                    console.warn("El parte se creó, pero falló la subida de fotos");
                }
            }

            statusEl.innerText = "✅ Parte enviado correctamente";
            form.reset();

        } catch (err) {
            console.error(err);
            statusEl.innerText = "❌ Error de red al enviar el parte";
        }
    });
});
