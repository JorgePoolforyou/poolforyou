const API_BASE_URL = "https://poolforyou-api.onrender.com";

/* =======================
   UTILIDADES
======================= */
function statusColor(status) {
    switch (status) {
        case "pendiente": return "#f1c40f";
        case "revisado": return "#2ecc71";
        case "cerrado": return "#e74c3c";
        default: return "#bdc3c7";
    }
}

function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
}

function cleanText(text) {
    if (!text) return "";
    return String(text).replace(/;/g, ",").replace(/\r?\n/g, " ").trim();
}

/* =======================
   AUTH
======================= */
const token = localStorage.getItem("token");
if (!token) {
    alert("No estás autenticado");
    window.location.href = "login.html";
}

const payload = parseJwt(token);
const role = payload.role;
let currentReports = [];

/* =======================
   UI INICIAL
======================= */
document.getElementById("role").innerText = "Rol: " + role;

const buttonsDiv = document.getElementById("buttons");
buttonsDiv.innerHTML = "";

if (role === "technician" || role === "lifeguard") {
    buttonsDiv.innerHTML = `
        <button onclick="goToCreate()">Nuevo parte</button>
        <button onclick="loadMyReports()">Mis partes</button>
    `;
}

if (role === "admin") {
    buttonsDiv.innerHTML = `
        <button onclick="loadAdminReports()">Ver todos los partes</button>
    `;
}

/* =======================
   FILTROS
======================= */
document.getElementById("filters").innerHTML = `
  <label>Estado:</label>
  <select id="f_status">
    <option value="">Todos</option>
    <option value="pendiente">Pendiente</option>
    <option value="revisado">Revisado</option>
    <option value="cerrado">Cerrado</option>
  </select>
`;

/* =======================
   NAVEGACIÓN
======================= */
function goToCreate() {
    window.location.href = "create-report.html";
}

/* =======================
   FETCH DATA
======================= */
async function fetchWithFallback(urls) {
    for (const url of urls) {
        const res = await fetch(url, {
            headers: { "Authorization": "Bearer " + token }
        });
        if (res.ok) return res.json();
    }
    throw new Error("No se pudo cargar el endpoint admin");
}

async function loadMyReports() {
    const res = await fetch(`${API_BASE_URL}/my/work-reports`, {
        headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) return alert("Error cargando tus partes");
    renderReports(await res.json(), false);
}

async function loadAdminReports() {
    try {
        const data = await fetchWithFallback([
            `${API_BASE_URL}/admin/work-reports`,
            `${API_BASE_URL}/admin/work-reports/`
        ]);
        renderReports(data, true);
    } catch (e) {
        alert("No se pudieron cargar los partes (admin)");
        console.error(e);
    }
}

async function updateStatus(id, status) {
    const urls = [
        `${API_BASE_URL}/admin/work-reports/${id}?status=${status}`,
        `${API_BASE_URL}/admin/work-reports/${id}/?status=${status}`
    ];

    for (const url of urls) {
        const res = await fetch(url, {
            method: "PATCH",
            headers: { "Authorization": "Bearer " + token }
        });
        if (res.ok) return loadAdminReports();
    }

    alert("Error actualizando estado");
}

/* =======================
   RENDER
======================= */
function renderReports(reports, isAdmin) {
    currentReports = reports;

    const content = document.getElementById("content");
    content.innerHTML = "";

    if (!reports.length) {
        content.innerHTML = "<p>No hay partes</p>";
        return;
    }

    reports.forEach(r => {
        const div = document.createElement("div");
        div.style.border = "1px solid #ccc";
        div.style.margin = "10px";
        div.style.padding = "10px";
        div.onclick = () => openModal(r);

        div.innerHTML = `
            <p><b>ID:</b> ${r.id}</p>
            <p><b>Ubicación:</b> ${r.location}</p>
            <p><b>Descripción:</b> ${r.data?.description || "-"}</p>
            <p><b>Estado:</b>
              <span style="background:${statusColor(r.status)};padding:4px 8px;">
                ${r.status}
              </span>
            </p>
        `;

        if (isAdmin) {
            div.innerHTML += `
              <button onclick="event.stopPropagation();updateStatus(${r.id},'revisado')">Revisado</button>
              <button onclick="event.stopPropagation();updateStatus(${r.id},'cerrado')">Cerrado</button>
            `;
        }

        content.appendChild(div);
    });
}

/* =======================
   CSV
======================= */
function exportCSV() {
    if (!currentReports.length) {
        alert("Primero carga los partes");
        return;
    }

    const rows = [
        ["ID", "Ubicación", "Detalle", "Estado", "Usuario", "Fecha"],
        ...currentReports.map(r => [
            r.id,
            cleanText(r.location),
            cleanText(r.data?.description),
            r.status,
            r.user_id,
            new Date(r.created_at).toLocaleString("es-ES")
        ])
    ];

    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "partes.csv";
    a.click();
}

/* =======================
   LOGOUT
======================= */
function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}
