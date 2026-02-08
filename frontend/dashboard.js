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
    return String(text)
        .replace(/;/g, ",")
        .replace(/\r?\n/g, " ")
        .trim();
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
const filtersDiv = document.getElementById("filters");

const commonFilters = `
  <label>Estado:</label>
  <select id="f_status">
    <option value="">Todos</option>
    <option value="pendiente">Pendiente</option>
    <option value="revisado">Revisado</option>
    <option value="cerrado">Cerrado</option>
  </select>

  <label style="margin-left:10px;">Desde:</label>
  <input type="date" id="f_from">

  <label style="margin-left:10px;">Hasta:</label>
  <input type="date" id="f_to">
`;

filtersDiv.innerHTML = commonFilters;

/* =======================
   NAVEGACIÓN
======================= */
function goToCreate() {
    window.location.href = "create-report.html";
}

/* =======================
   FETCH DATA
======================= */
async function loadMyReports() {
    const res = await fetch(`${API_BASE_URL}/my/work-reports`, {
        headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) return alert("Error cargando tus partes");
    const data = await res.json();
    renderReports(data, false);
}

async function loadAdminReports() {
    const res = await fetch(`${API_BASE_URL}/admin/work-reports`, {
        headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) return alert("Error cargando partes");
    const data = await res.json();
    renderReports(data, true);
}

async function updateStatus(id, status) {
    const res = await fetch(
        `${API_BASE_URL}/admin/work-reports/${id}?status=${encodeURIComponent(status)}`,
        {
            method: "PATCH",
            headers: { "Authorization": "Bearer " + token }
        }
    );
    if (!res.ok) return alert("Error actualizando estado");
    await loadAdminReports();
}

/* =======================
   RENDER
======================= */
function renderReports(reports, isAdmin = false) {
    currentReports = reports;

    const content = document.getElementById("content");
    content.innerHTML = "";

    if (!reports.length) {
        content.innerHTML = "<p>No hay partes</p>";
        return;
    }

    reports
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .forEach(r => {
            const div = document.createElement("div");
            div.style.border = "1px solid #ccc";
            div.style.margin = "10px";
            div.style.padding = "10px";
            div.style.cursor = "pointer";
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
                <small>${new Date(r.created_at).toLocaleString()}</small>
            `;

            if (isAdmin) {
                div.innerHTML += `
                    <br>
                    <button onclick="updateStatus(${r.id}, 'revisado')">Revisado</button>
                    <button onclick="updateStatus(${r.id}, 'cerrado')">Cerrado</button>
                `;
            }

            content.appendChild(div);
        });
}

/* =======================
   MODAL
======================= */
function openModal(report) {
    const modal = document.getElementById("modal");
    const content = document.getElementById("modalContent");

    let photosHTML = "<p>No hay fotos</p>";
    if (report.data?.photos?.length) {
        photosHTML = report.data.photos.map(p => {
            const cleanPath = p.replace(/\\/g, "/");
            return `<img src="${API_BASE_URL}/${cleanPath}" style="width:100%;margin-bottom:10px;">`;
        }).join("");
    }

    content.innerHTML = `
        <h2>Parte #${report.id}</h2>
        <p><b>Ubicación:</b> ${report.location}</p>
        <p><b>Descripción:</b> ${report.data?.description || "-"}</p>
        <p><b>Estado:</b> ${report.status}</p>
        <p><b>Fecha:</b> ${new Date(report.created_at).toLocaleString()}</p>
        <hr>
        <h3>Fotos</h3>
        ${photosHTML}
    `;

    modal.style.display = "block";
}

function closeModal() {
    document.getElementById("modal").style.display = "none";
}

/* =======================
   CSV
======================= */
function exportCSV() {
    if (!currentReports.length) {
        alert("Primero carga los partes");
        return;
    }

    const headers = ["ID", "Ubicación", "Detalle", "Estado", "Usuario", "Fecha"];
    const rows = currentReports.map(r => [
        r.id,
        cleanText(r.location),
        cleanText(r.data?.description || ""),
        r.status,
        r.user_id,
        new Date(r.created_at).toLocaleString("es-ES")
    ]);

    const csv = [
        headers.join(";"),
        ...rows.map(r => r.join(";"))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "poolforyou_partes.csv";
    a.click();
}

/* =======================
   LOGOUT
======================= */
function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}
