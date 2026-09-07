const STORAGE_KEY = "parking-bay-register-poc-v1";
const BAY_COUNT = 10;

const parkingStore = {
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  save(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  },

  all() {
    return this.load().sort((a, b) => new Date(b.timeIn) - new Date(a.timeIn));
  },

  activeForBay(bayNumber) {
    return this.load().find((record) => record.bayNumber === bayNumber && record.status === "Occupied") || null;
  },

  checkIn({ bayNumber, personName, carRegistration, timeIn, notes }) {
    const records = this.load();
    const alreadyOccupied = records.some((record) => record.bayNumber === bayNumber && record.status === "Occupied");

    if (alreadyOccupied) {
      throw new Error(`Bay ${bayNumber} is already occupied.`);
    }

    const selectedTimeIn = new Date(timeIn);

    if (Number.isNaN(selectedTimeIn.getTime())) {
      throw new Error("Choose a valid start time.");
    }

    if (selectedTimeIn > new Date()) {
      throw new Error("Start time cannot be in the future.");
    }

    const record = {
      id: createId(),
      bayNumber,
      personName,
      carRegistration: carRegistration.toUpperCase(),
      notes,
      timeIn: selectedTimeIn.toISOString(),
      timeOut: null,
      status: "Occupied",
      createdBy: "Local iPad POC",
      checkedOutBy: null
    };

    records.push(record);
    this.save(records);
    return record;
  },

  checkOut(recordId) {
    const records = this.load();
    const record = records.find((item) => item.id === recordId && item.status === "Occupied");

    if (!record) {
      throw new Error("This parking session has already changed.");
    }

    record.timeOut = new Date().toISOString();
    record.status = "Completed";
    record.checkedOutBy = "Local iPad POC";
    this.save(records);
    return record;
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  }
};

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const state = {
  selectedBay: null,
  selectedRecord: null,
  toastTimer: null
};

const elements = {
  bayGrid: document.querySelector("#bayGrid"),
  freeCount: document.querySelector("#freeCount"),
  occupiedCount: document.querySelector("#occupiedCount"),
  lastUpdated: document.querySelector("#lastUpdated"),
  refreshButton: document.querySelector("#refreshButton"),
  historyButton: document.querySelector("#historyButton"),
  checkInDialog: document.querySelector("#checkInDialog"),
  checkInForm: document.querySelector("#checkInForm"),
  checkInTitle: document.querySelector("#checkInTitle"),
  personNameInput: document.querySelector("#personNameInput"),
  carRegistrationInput: document.querySelector("#carRegistrationInput"),
  timeInInput: document.querySelector("#timeInInput"),
  notesInput: document.querySelector("#notesInput"),
  cancelCheckInButton: document.querySelector("#cancelCheckInButton"),
  checkOutDialog: document.querySelector("#checkOutDialog"),
  checkOutForm: document.querySelector("#checkOutForm"),
  checkOutTitle: document.querySelector("#checkOutTitle"),
  checkOutName: document.querySelector("#checkOutName"),
  checkOutRegistration: document.querySelector("#checkOutRegistration"),
  checkOutTimeIn: document.querySelector("#checkOutTimeIn"),
  checkOutDuration: document.querySelector("#checkOutDuration"),
  cancelCheckOutButton: document.querySelector("#cancelCheckOutButton"),
  historyDialog: document.querySelector("#historyDialog"),
  historyList: document.querySelector("#historyList"),
  historySearchInput: document.querySelector("#historySearchInput"),
  historyStatusSelect: document.querySelector("#historyStatusSelect"),
  closeHistoryButton: document.querySelector("#closeHistoryButton"),
  clearDemoDataButton: document.querySelector("#clearDemoDataButton"),
  toast: document.querySelector("#toast")
};

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function toDateTimeInputValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatDuration(timeIn, timeOut = new Date().toISOString()) {
  const start = new Date(timeIn);
  const end = new Date(timeOut);
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 2400);
}

function getBayModels() {
  return Array.from({ length: BAY_COUNT }, (_, index) => {
    const bayNumber = index + 1;
    const activeRecord = parkingStore.activeForBay(bayNumber);

    return {
      bayNumber,
      activeRecord,
      status: activeRecord ? "Occupied" : "Free"
    };
  });
}

function renderDashboard() {
  const bays = getBayModels();
  const occupiedCount = bays.filter((bay) => bay.status === "Occupied").length;
  const freeCount = BAY_COUNT - occupiedCount;

  elements.freeCount.textContent = freeCount;
  elements.occupiedCount.textContent = occupiedCount;
  elements.lastUpdated.textContent = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());

  elements.bayGrid.replaceChildren(...bays.map(createBayTile));
}

function createBayTile(bay) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `bay-tile ${bay.status === "Occupied" ? "occupied" : "free"}`;
  button.addEventListener("click", () => openBay(bay.bayNumber));

  const top = document.createElement("div");
  const number = document.createElement("div");
  number.className = "bay-number";
  number.textContent = `Bay ${bay.bayNumber}`;

  const status = document.createElement("div");
  status.className = "bay-status";
  status.textContent = bay.status;

  top.append(number, status);

  const meta = document.createElement("div");
  meta.className = "bay-meta";

  if (bay.activeRecord) {
    const name = document.createElement("strong");
    name.textContent = bay.activeRecord.personName;

    const registration = document.createElement("span");
    registration.textContent = bay.activeRecord.carRegistration;

    const timeIn = document.createElement("span");
    timeIn.textContent = `In: ${formatDateTime(bay.activeRecord.timeIn)}`;

    const duration = document.createElement("span");
    duration.textContent = `Duration: ${formatDuration(bay.activeRecord.timeIn)}`;

    meta.append(name, registration, timeIn, duration);
  } else {
    const available = document.createElement("strong");
    available.textContent = "Available";

    const action = document.createElement("span");
    action.textContent = "Tap to check in";

    meta.append(available, action);
  }

  button.append(top, meta);
  return button;
}

function openBay(bayNumber) {
  const activeRecord = parkingStore.activeForBay(bayNumber);
  state.selectedBay = bayNumber;
  state.selectedRecord = activeRecord;

  if (activeRecord) {
    openCheckOut(activeRecord);
  } else {
    openCheckIn(bayNumber);
  }
}

function openCheckIn(bayNumber) {
  elements.checkInTitle.textContent = `Bay ${bayNumber}`;
  elements.checkInForm.reset();
  elements.timeInInput.value = toDateTimeInputValue();
  elements.timeInInput.max = toDateTimeInputValue();
  elements.checkInDialog.showModal();
  elements.personNameInput.focus();
}

function openCheckOut(record) {
  elements.checkOutTitle.textContent = `Bay ${record.bayNumber}`;
  elements.checkOutName.textContent = record.personName;
  elements.checkOutRegistration.textContent = record.carRegistration;
  elements.checkOutTimeIn.textContent = formatDateTime(record.timeIn);
  elements.checkOutDuration.textContent = formatDuration(record.timeIn);
  elements.checkOutDialog.showModal();
}

function renderHistory() {
  const query = elements.historySearchInput.value.trim().toLowerCase();
  const status = elements.historyStatusSelect.value;
  const records = parkingStore.all().filter((record) => {
    const matchesStatus = status === "All" || record.status === status;
    const matchesSearch =
      query.length === 0 ||
      record.personName.toLowerCase().includes(query) ||
      record.carRegistration.toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  if (records.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No parking records found.";
    elements.historyList.replaceChildren(empty);
    return;
  }

  elements.historyList.replaceChildren(...records.map(createHistoryRow));
}

function createHistoryRow(record) {
  const row = document.createElement("article");
  row.className = "history-row";

  const content = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = `Bay ${record.bayNumber} - ${record.carRegistration}`;

  const details = document.createElement("span");
  const outText = record.timeOut ? `Out: ${formatDateTime(record.timeOut)}` : "Currently parked";
  details.textContent = `${record.personName} | In: ${formatDateTime(record.timeIn)} | ${outText}`;

  content.append(title, details);

  const status = document.createElement("span");
  status.className = `status-pill ${record.status === "Completed" ? "completed" : ""}`;
  status.textContent = record.status;

  row.append(content, status);
  return row;
}

elements.refreshButton.addEventListener("click", () => {
  renderDashboard();
  showToast("Dashboard refreshed.");
});

elements.historyButton.addEventListener("click", () => {
  renderHistory();
  elements.historyDialog.showModal();
});

elements.checkInForm.addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    parkingStore.checkIn({
      bayNumber: state.selectedBay,
      personName: elements.personNameInput.value.trim(),
      carRegistration: elements.carRegistrationInput.value.trim(),
      timeIn: elements.timeInInput.value,
      notes: elements.notesInput.value.trim()
    });
    elements.checkInDialog.close();
    renderDashboard();
    showToast(`Bay ${state.selectedBay} checked in.`);
  } catch (error) {
    showToast(error.message);
    renderDashboard();
  }
});

elements.cancelCheckInButton.addEventListener("click", () => {
  elements.checkInDialog.close();
});

elements.checkOutForm.addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    parkingStore.checkOut(state.selectedRecord.id);
    elements.checkOutDialog.close();
    renderDashboard();
    showToast(`Bay ${state.selectedBay} checked out.`);
  } catch (error) {
    showToast(error.message);
    renderDashboard();
  }
});

elements.cancelCheckOutButton.addEventListener("click", () => {
  elements.checkOutDialog.close();
});

elements.historySearchInput.addEventListener("input", renderHistory);
elements.historyStatusSelect.addEventListener("change", renderHistory);

elements.closeHistoryButton.addEventListener("click", () => {
  elements.historyDialog.close();
});

elements.clearDemoDataButton.addEventListener("click", () => {
  const confirmed = window.confirm("Clear all local POC parking records from this browser?");

  if (!confirmed) {
    return;
  }

  parkingStore.clear();
  renderHistory();
  renderDashboard();
  showToast("Local POC data cleared.");
});

window.setInterval(renderDashboard, 60000);
renderDashboard();
