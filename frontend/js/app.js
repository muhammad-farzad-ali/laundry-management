const API_BASE = "/api";
const POLL_INTERVAL = 30000;

let allMachines = [];
let dormitories = [];
let machineTypes = [];
let currentMachineId = null;
let countdownIntervals = {};
let pollTimer = null;

async function init() {
    await loadDormitories();
    await loadMachineTypes();
    await loadMachines();
    setupFilters();
    startPolling();
}

async function loadDormitories() {
    const res = await fetch(`${API_BASE}/dormitories`);
    dormitories = await res.json();
    const select = document.getElementById("dormitory-filter");
    dormitories.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = d.name;
        select.appendChild(opt);
    });
}

async function loadMachineTypes() {
    const res = await fetch(`${API_BASE}/machine-types`);
    machineTypes = await res.json();
    const select = document.getElementById("type-filter");
    machineTypes.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.name;
        select.appendChild(opt);
    });
}

async function loadMachines() {
    const dormitory = document.getElementById("dormitory-filter").value;
    const type = document.getElementById("type-filter").value;

    let url = `${API_BASE}/machines`;
    const params = [];
    if (dormitory) params.push(`dormitory=${dormitory}`);
    if (type) params.push(`type=${type}`);
    if (params.length) url += `?${params.join("&")}`;

    const res = await fetch(url);
    allMachines = await res.json();
    renderMachines();
}

function setupFilters() {
    document.getElementById("dormitory-filter").addEventListener("change", loadMachines);
    document.getElementById("type-filter").addEventListener("change", loadMachines);
}

function renderMachines() {
    const container = document.getElementById("machine-list");

    if (allMachines.length === 0) {
        container.innerHTML = '<div class="no-machines">No machines found</div>';
        return;
    }

    const grouped = {};
    allMachines.forEach(m => {
        if (!grouped[m.dormitory_id]) {
            grouped[m.dormitory_id] = {
                name: m.dormitory_name,
                machines: []
            };
        }
        grouped[m.dormitory_id].machines.push(m);
    });

    container.innerHTML = Object.entries(grouped).map(([dormId, dorm]) => `
        <div class="dormitory-section">
            <div class="dormitory-header">${dorm.name}</div>
            <table class="machine-table">
                <thead>
                    <tr>
                        <th>Machine</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Operational</th>
                        <th>Occupied</th>
                    </tr>
                </thead>
                <tbody>
                    ${dorm.machines.map(m => renderMachineRow(m)).join("")}
                </tbody>
            </table>
        </div>
    `).join("");

    startCountdowns();
}

function renderMachineRow(machine) {
    const status = getStatus(machine);
    const statusClass = getStatusClass(status);
    const occupiedDisabled = !machine.operational ? "disabled" : "";

    let extraInfo = "";
    if (machine.occupied && machine.occupied_until) {
        const countdown = getCountdown(machine.occupied_until);
        extraInfo += `<div class="countdown" data-until="${machine.occupied_until}">⏱ ${countdown}</div>`;
    }
    if (machine.occupied && machine.occupied_by_name) {
        const phone = machine.occupied_by_phone ? ` ${machine.occupied_by_phone}` : "";
        extraInfo += `<div class="occupant-info">${escapeHtml(machine.occupied_by_name)}${escapeHtml(phone)}</div>`;
    }

    return `
        <tr>
            <td class="machine-name">${escapeHtml(machine.name)}</td>
            <td>${escapeHtml(machine.machine_type_name)}</td>
            <td>
                <span class="status-badge ${statusClass}">${status}</span>
                ${extraInfo}
            </td>
            <td>
                <button class="toggle-btn ${machine.operational ? "active" : ""}"
                        onclick="toggleOperational('${machine.id}', ${!machine.operational})">
                    ${machine.operational ? "Yes" : "No"}
                </button>
            </td>
            <td>
                <button class="toggle-btn ${machine.occupied ? "active" : ""}"
                        onclick="handleOccupiedClick('${machine.id}', ${machine.occupied})"
                        ${occupiedDisabled}>
                    ${machine.occupied ? "Yes" : "No"}
                </button>
            </td>
        </tr>
    `;
}

function getStatus(machine) {
    if (!machine.operational) return "Out of Order";
    if (machine.occupied) return "Occupied";
    return "Available";
}

function getStatusClass(status) {
    switch (status) {
        case "Available": return "status-available";
        case "Occupied": return "status-occupied";
        case "Out of Order": return "status-out-of-order";
        default: return "";
    }
}

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

async function toggleOperational(machineId, value) {
    await updateMachine(machineId, { operational: value });
}

function handleOccupiedClick(machineId, isOccupied) {
    if (isOccupied) {
        updateMachine(machineId, { occupied: false });
    } else {
        openModal(machineId);
    }
}

function openModal(machineId) {
    currentMachineId = machineId;
    document.getElementById("timer-hours").value = 1;
    document.getElementById("timer-minutes").value = 20;
    document.getElementById("occupant-name").value = "";
    document.getElementById("occupant-country-code").value = "+49";
    document.getElementById("occupant-phone").value = "";
    document.getElementById("modal-overlay").style.display = "flex";
}

function closeModal() {
    currentMachineId = null;
    document.getElementById("modal-overlay").style.display = "none";
}

async function confirmOccupied() {
    if (!currentMachineId) return;

    const hours = parseInt(document.getElementById("timer-hours").value) || 0;
    const minutes = parseInt(document.getElementById("timer-minutes").value) || 0;
    const name = document.getElementById("occupant-name").value.trim();
    const countryCode = document.getElementById("occupant-country-code").value.trim();
    const phone = document.getElementById("occupant-phone").value.trim();

    if (hours === 0 && minutes === 0) {
        alert("Please specify a duration greater than 0.");
        return;
    }

    const fullPhone = phone ? `${countryCode}${phone}` : "";

    await updateMachine(currentMachineId, {
        occupied: true,
        occupied_hours: hours,
        occupied_minutes: minutes,
        occupied_by_name: name || null,
        occupied_by_phone: fullPhone || null,
    });

    closeModal();
}

async function updateMachine(machineId, data) {
    const res = await fetch(`${API_BASE}/machines/${machineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to update machine");
        return;
    }

    const updated = await res.json();
    const idx = allMachines.findIndex(m => m.id === machineId);
    if (idx !== -1) {
        allMachines[idx] = updated;
    }
    renderMachines();
}

function getCountdown(until) {
    const now = new Date();
    const untilDate = new Date(until);
    const diff = untilDate - now;

    if (diff <= 0) return "00:00";

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function startCountdowns() {
    Object.values(countdownIntervals).forEach(clearInterval);
    countdownIntervals = {};

    document.querySelectorAll(".countdown[data-until]").forEach(el => {
        const until = el.getAttribute("data-until");
        const interval = setInterval(() => {
            el.textContent = `⏱ ${getCountdown(until)}`;
        }, 1000);
        countdownIntervals[until] = interval;
    });
}

async function expireMachines() {
    try {
        const res = await fetch(`${API_BASE}/machines/expire`, { method: "POST" });
        const data = await res.json();

        if (data.expired && data.expired.length > 0 && data.machines) {
            allMachines = data.machines;
            renderMachines();
        }
    } catch (e) {
        // ignore polling errors
    }
}

function startPolling() {
    pollTimer = setInterval(expireMachines, POLL_INTERVAL);
}

document.addEventListener("DOMContentLoaded", init);
