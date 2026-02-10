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
    buttonsDiv.innerHTML += `
        <button onclick="goToCreate()">Nuevo parte</button>
        <button onclick="loadMyReports()">Mis partes</button>
    `;
}

if (role === "admin") {
    buttonsDiv.innerHTML += `
        <button onclick="loadAdminReports()">Ver todos los partes</button>
    `;
}

/* =======================
   FILTROS
======================= */
document.getElementById("filters").innerHTML = `
  <label>ID:</label>
  <input type="number" id="f_id" style="width:80px">

  <label style="margin-left:10px;">Estado:</label>
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

  <button style="margin-left:10px;" onclick="applyFilters()">Filtrar</button>
`;

/* =======================
   NAVEGACIÓN
======================= */
function goToCreate() {
    window.location.href = "create-report.html";
}

/* =======================
   FETCH
======================= */
async function loadMyReports() {
    const res = await fetch(`${API_BASE_URL}/my/work-reports`, {
        headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) return alert("Error cargando tus partes");
    currentReports = await res.json();
    renderReports(currentReports, false);
}

async function loadAdminReports() {
    const res = await fetch(`${API_BASE_URL}/admin/work-reports`, {
        headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) return alert("Error cargando partes");
    currentReports = await res.json();
    renderReports(currentReports, true);
}

async function updateStatus(id, status) {
    const res = await fetch(
        `${API_BASE_URL}/admin/work-reports/${id}?status=${status}`,
        {
            method: "PATCH",
            headers: { "Authorization": "Bearer " + token }
        }
    );
    if (!res.ok) return alert("Error actualizando estado");
    loadAdminReports();
}

/* =======================
   FILTROS LOGICA
======================= */
function applyFilters() {
    let filtered = [...currentReports];

    const fId = document.getElementById("f_id").value;
    const fStatus = document.getElementById("f_status").value;
    const fFrom = document.getElementById("f_from").value;
    const fTo = document.getElementById("f_to").value;

    if (fId) {
        filtered = filtered.filter(r => r.id == fId);
    }
    if (fStatus) {
        filtered = filtered.filter(r => r.status === fStatus);
    }
    if (fFrom) {
        filtered = filtered.filter(r => new Date(r.created_at) >= new Date(fFrom));
    }
    if (fTo) {
        filtered = filtered.filter(r => new Date(r.created_at) <= new Date(fTo + "T23:59:59"));
    }

    renderReports(filtered, role === "admin");
}

/* =======================
   RENDER
======================= */
function renderReports(reports, isAdmin) {
    const content = document.getElementById("content");
    content.innerHTML = "";

    if (!reports.length) {
        content.innerHTML = "<p>No hay partes</p>";
        return;
    }

    reports.forEach(r => {
        const div = document.createElement("div");
        div.className = "card";
        div.onclick = () => openModal(r);

        div.innerHTML = `
            <p><b>ID:</b> ${r.id}</p>
            <p><b>Ubicación:</b> ${r.location}</p>
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
   MODAL
======================= */
function openModal(report) {
    const modal = document.getElementById("modal");
    const modalContent = document.getElementById("modalContent");

    let photosHTML = "<p>No hay fotos</p>";

    if (report.data?.photos?.length) {
        photosHTML = report.data.photos.map(p => {
            const imgUrl = `${API_BASE_URL}/${p.replace(/^\/+/, "")}`;
            return `<img src="${imgUrl}" style="width:100%;margin-bottom:10px;border-radius:8px;">`;
        }).join("");
    }

    modalContent.innerHTML = `
        <h2>Parte #${report.id}</h2>
        <p><b>Ubicación:</b> ${report.location}</p>
        <p><b>Descripción:</b> ${report.data?.description || "-"}</p>
        <p><b>Estado:</b> ${report.status}</p>
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
