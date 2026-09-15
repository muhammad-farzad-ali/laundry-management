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
    setupModalRadios();
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

function setupModalRadios() {
    const operationalRadios = document.querySelectorAll('input[name="operational"]');
    const occupiedRadios = document.querySelectorAll('input[name="occupied"]');
    const occupiedFields = document.getElementById("occupied-fields");

    operationalRadios.forEach(radio => {
        radio.addEventListener("change", () => {
            const isNo = radio.value === "no" && radio.checked;
            const yesRadio = document.getElementById("occupied-yes");
            const noRadio = document.getElementById("occupied-no");
            yesRadio.disabled = isNo;
            noRadio.disabled = isNo;
            if (isNo) {
                noRadio.checked = true;
                yesRadio.checked = false;
                occupiedFields.classList.add("hidden");
            }
        });
    });

    occupiedRadios.forEach(radio => {
        radio.addEventListener("change", () => {
            if (radio.value === "yes" && radio.checked) {
                occupiedFields.classList.remove("hidden");
            } else if (radio.value === "no" && radio.checked) {
                occupiedFields.classList.add("hidden");
            }
        });
    });
}

function renderMachines() {
    const container = document.getElementById("machine-list");

    if (allMachines.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-500">No machines found</div>';
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
        <div>
            <h2 class="bg-slate-700 text-white px-4 py-3 font-semibold rounded-t-lg">${dorm.name}</h2>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 bg-white rounded-b-lg shadow-sm">
                ${dorm.machines.map(m => renderMachineCard(m)).join("")}
            </div>
        </div>
    `).join("");

    startCountdowns();
}

function renderMachineCard(machine) {
    const status = getStatus(machine);
    const badgeClass = getStatusBadgeClass(status);

    let extraInfo = "";
    if (machine.occupied && machine.occupied_until) {
        const countdown = getCountdown(machine.occupied_until);
        extraInfo += `<div class="text-sm font-semibold text-amber-700 mt-1" data-until="${machine.occupied_until}">⏱ ${countdown}</div>`;
    }
    if (machine.occupied && machine.occupied_by_name) {
        const phone = machine.occupied_by_phone ? ` ${machine.occupied_by_phone}` : "";
        extraInfo += `<div class="text-xs text-gray-500 mt-1 break-all">${escapeHtml(machine.occupied_by_name)}${escapeHtml(phone)}</div>`;
    }
    if (machine.occupied) {
        const consentText = machine.consent_to_remove ? "Yes" : "No";
        extraInfo += `<div class="text-xs text-gray-600 mt-1">Permission: ${consentText}</div>`;
    }

    return `
        <div class="border border-gray-200 rounded-lg p-4 flex flex-col">
            <div class="mb-2">
                <h3 class="font-semibold text-base">${escapeHtml(machine.name)}</h3>
                <p class="text-sm text-gray-500">${escapeHtml(machine.machine_type_name)}</p>
            </div>
            <div class="flex-1 mb-3">
                <span class="inline-block px-2 py-1 rounded text-xs font-semibold ${badgeClass}">${status}</span>
                ${extraInfo}
            </div>
            <button class="w-full py-2 px-4 border-2 border-blue-500 text-blue-500 rounded font-medium text-sm hover:bg-blue-500 hover:text-white transition-colors min-h-[44px]" onclick="openModal('${machine.id}')">Edit</button>
        </div>
    `;
}

function getStatus(machine) {
    if (!machine.operational) return "Out of Order";
    if (machine.occupied) return "Occupied";
    return "Available";
}

function getStatusBadgeClass(status) {
    switch (status) {
        case "Available": return "bg-green-100 text-green-800";
        case "Occupied": return "bg-amber-100 text-amber-800";
        case "Out of Order": return "bg-red-100 text-red-800";
        default: return "";
    }
}

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function openModal(machineId) {
    currentMachineId = machineId;
    const machine = allMachines.find(m => m.id === machineId);
    if (!machine) return;

    document.getElementById("modal-title").textContent = `Update Status: ${machine.name}`;

    const operationalYes = document.querySelector('input[name="operational"][value="yes"]');
    const operationalNo = document.querySelector('input[name="operational"][value="no"]');
    const occupiedYes = document.getElementById("occupied-yes");
    const occupiedNo = document.getElementById("occupied-no");
    const occupiedFields = document.getElementById("occupied-fields");

    operationalYes.checked = !!machine.operational;
    operationalNo.checked = !machine.operational;

    const isOperational = !!machine.operational;
    occupiedYes.disabled = !isOperational;
    occupiedNo.disabled = !isOperational;

    if (machine.occupied) {
        occupiedYes.checked = true;
        occupiedNo.checked = false;
        occupiedFields.classList.remove("hidden");

        if (machine.occupied_until) {
            const now = new Date();
            const until = new Date(machine.occupied_until);
            const diff = until - now;
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            document.getElementById("timer-hours").value = Math.max(0, hours);
            document.getElementById("timer-minutes").value = Math.max(0, minutes);
        } else {
            document.getElementById("timer-hours").value = 1;
            document.getElementById("timer-minutes").value = 20;
        }

        document.getElementById("occupant-name").value = machine.occupied_by_name || "";
        if (machine.occupied_by_phone) {
            const phone = machine.occupied_by_phone;
            const codeMatch = phone.match(/^\+\d+/);
            if (codeMatch) {
                document.getElementById("occupant-country-code").value = codeMatch[0];
                document.getElementById("occupant-phone").value = phone.slice(codeMatch[0].length);
            } else {
                document.getElementById("occupant-country-code").value = "+49";
                document.getElementById("occupant-phone").value = phone;
            }
        } else {
            document.getElementById("occupant-country-code").value = "+49";
            document.getElementById("occupant-phone").value = "";
        }

        document.getElementById("consent-yes").checked = !!machine.consent_to_remove;
        document.getElementById("consent-no").checked = !machine.consent_to_remove;
    } else {
        occupiedNo.checked = true;
        occupiedYes.checked = false;
        occupiedFields.classList.add("hidden");

        document.getElementById("timer-hours").value = 1;
        document.getElementById("timer-minutes").value = 20;
        document.getElementById("occupant-name").value = "";
        document.getElementById("occupant-country-code").value = "+49";
        document.getElementById("occupant-phone").value = "";
        document.getElementById("consent-yes").checked = false;
        document.getElementById("consent-no").checked = true;
    }

    document.getElementById("modal-overlay").style.display = "flex";
}

function closeModal() {
    currentMachineId = null;
    document.getElementById("modal-overlay").style.display = "none";
}

async function confirmUpdate() {
    if (!currentMachineId) return;

    const operationalYes = document.querySelector('input[name="operational"][value="yes"]');
    const occupiedYes = document.getElementById("occupied-yes");
    const operational = operationalYes.checked;
    const occupied = occupiedYes.checked;

    if (!operational && occupied) {
        alert("Cannot mark an out-of-order machine as occupied.");
        return;
    }

    const data = { operational, occupied };

    if (occupied) {
        const hours = parseInt(document.getElementById("timer-hours").value) || 0;
        const minutes = parseInt(document.getElementById("timer-minutes").value) || 0;

        if (hours === 0 && minutes === 0) {
            alert("Please specify a duration greater than 0.");
            return;
        }

        const name = document.getElementById("occupant-name").value.trim();
        const countryCode = document.getElementById("occupant-country-code").value.trim();
        const phone = document.getElementById("occupant-phone").value.trim();
        const fullPhone = phone ? `${countryCode}${phone}` : "";

        data.occupied_hours = hours;
        data.occupied_minutes = minutes;
        data.occupied_by_name = name || null;
        data.occupied_by_phone = fullPhone || null;
        data.consent_to_remove = document.getElementById("consent-yes").checked;
    }

    await updateMachine(currentMachineId, data);
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

    if (diff <= 0) return "00:00:00";

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function startCountdowns() {
    Object.values(countdownIntervals).forEach(clearInterval);
    countdownIntervals = {};

    document.querySelectorAll("[data-until]").forEach(el => {
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
