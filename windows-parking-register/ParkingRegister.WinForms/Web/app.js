const BAY_COUNT = 10;
let state = null;
let selectedStaffSession = null;
let selectedVisitorSession = null;
let selectedBay = null;
let editingStaffProfile = null;

const $ = (id) => document.getElementById(id);

function send(type, payload = {}) {
  window.chrome.webview.postMessage({ type, payload });
}

window.parkingRegisterReceiveState = (json) => {
  state = JSON.parse(json);
  render();
};

function render() {
  if (!state) return;
  renderNotice();
  renderSummary();
  renderBays();
  renderStaffProfiles();
  renderSavedStaffSelect();
  renderVisitorBayChoices();
  renderSignedInVisitors();
  renderStaffHistory();
  renderVisitorHistory();
}

function renderNotice() {
  const text = state.loadError || state.message || "";
  $("notice").hidden = !text;
  $("notice").textContent = text;
}

function renderSummary() {
  const occupied = Array.from({ length: BAY_COUNT }, (_, index) => index + 1).filter((bay) => occupancyForBay(bay)).length;
  const signedInVisitors = state.data.visitorSessions.filter((visitor) => visitor.status === "Signed In").length;
  $("summary").innerHTML = [
    summaryItem(BAY_COUNT - occupied, "Free bays"),
    summaryItem(occupied, "Bays in use"),
    summaryItem(signedInVisitors, "Visitors signed in"),
    summaryItem(formatTime(new Date()), "Last updated"),
  ].join("");
}

function summaryItem(value, label) {
  return `<div><span>${escapeHtml(String(value))}</span><small>${escapeHtml(label)}</small></div>`;
}

function renderBays() {
  $("bayGrid").innerHTML = Array.from({ length: BAY_COUNT }, (_, index) => {
    const bayNumber = index + 1;
    const occupancy = occupancyForBay(bayNumber);
    if (!occupancy) {
      return `<button class="bay-tile free" data-bay="${bayNumber}" type="button">
        <span><strong class="bay-number">Bay ${bayNumber}</strong><strong class="bay-status">Free</strong></span>
        <span class="bay-meta"><strong>Available</strong><span>Tap for staff car</span></span>
      </button>`;
    }

    if (occupancy.kind === "staff") {
      const session = occupancy.session;
      return `<button class="bay-tile occupied" data-bay="${bayNumber}" type="button">
        <span><strong class="bay-number">Bay ${bayNumber}</strong><strong class="bay-status">Occupied</strong></span>
        <span class="bay-meta"><strong>${escapeHtml(session.personName)}</strong><span>${escapeHtml(session.carRegistration)}</span><span>Staff parking</span><span>In: ${formatDate(session.timeIn)}</span></span>
      </button>`;
    }

    const visitor = occupancy.session;
    return `<button class="bay-tile visitor" data-bay="${bayNumber}" type="button">
      <span><strong class="bay-number">Bay ${bayNumber}</strong><strong class="bay-status">Visitor</strong></span>
      <span class="bay-meta"><strong>${escapeHtml(visitor.visitorName)}</strong><span>${escapeHtml(visitor.companyName)}</span><span>Visitor</span><span>In: ${formatDate(visitor.timeIn)}</span></span>
    </button>`;
  }).join("");
}

function renderStaffProfiles() {
  const profiles = sortedProfiles();
  $("staffProfiles").innerHTML = profiles.length
    ? profiles.map((profile) => `<article class="staff-profile-row">
        <span><strong>${escapeHtml(profile.personName)}</strong><span>${escapeHtml(profile.carRegistration)}</span></span>
        <span class="profile-actions">
          <button class="secondary-button" data-edit-profile-name="${escapeAttr(profile.personName)}" data-edit-profile-reg="${escapeAttr(profile.carRegistration)}" type="button">Edit</button>
          <button class="secondary-button" data-profile-name="${escapeAttr(profile.personName)}" data-profile-reg="${escapeAttr(profile.carRegistration)}" type="button">Remove</button>
        </span>
      </article>`).join("")
    : `<p class="empty-state">No staff members saved on this PC.</p>`;
}

function renderSavedStaffSelect() {
  $("savedStaffSelect").innerHTML = `<option value="">Type details manually</option>` + sortedProfiles()
    .map((profile, index) => `<option value="${index}">${escapeHtml(profile.personName)} - ${escapeHtml(profile.carRegistration)}</option>`)
    .join("");
}

function renderVisitorBayChoices() {
  $("visitorBay").innerHTML = `<option value="">No bay / not applicable</option>` + Array.from({ length: BAY_COUNT }, (_, index) => index + 1)
    .map((bay) => `<option value="${bay}" ${occupancyForBay(bay) ? "disabled" : ""}>Bay ${bay}${occupancyForBay(bay) ? " - occupied" : ""}</option>`)
    .join("");
}

function renderSignedInVisitors() {
  const visitors = state.data.visitorSessions.filter((visitor) => visitor.status === "Signed In");
  $("signedInVisitors").innerHTML = visitors.length
    ? visitors.map((visitor) => `<button class="visitor-row" data-visitor-id="${visitor.id}" type="button">
      <span>
        <strong>${escapeHtml(visitor.visitorName)}</strong>
        <span>${escapeHtml(visitor.companyName)} | Visiting ${escapeHtml(visitor.visiting)}</span>
        <span>In: ${formatDate(visitor.timeIn)} | Bay: ${visitor.bayNumber ?? "None"} | Reg: ${escapeHtml(visitor.carRegistration || "N/A")} | Pass: ${escapeHtml(visitor.doorPassNumber || "N/A")}</span>
      </span>
      <span class="status-pill">${escapeHtml(visitor.status)}</span>
    </button>`).join("")
    : `<p class="empty-state">No visitors currently signed in.</p>`;
}

function renderStaffHistory() {
  const query = $("staffHistorySearch").value.trim().toLowerCase();
  const status = $("staffHistoryStatus").value;
  const sessions = state.data.staffSessions
    .filter((session) => status === "All" || session.status === status)
    .filter((session) => !query || session.personName.toLowerCase().includes(query) || session.carRegistration.toLowerCase().includes(query))
    .sort((a, b) => new Date(b.timeIn) - new Date(a.timeIn));

  $("staffHistory").innerHTML = sessions.length
    ? sessions.map((session) => `<article class="history-row">
      <div>
        <strong>Bay ${session.bayNumber} - ${escapeHtml(session.carRegistration)}</strong>
        <span>${escapeHtml(session.personName)} | In: ${formatDate(session.timeIn)} | ${session.timeOut ? `Out: ${formatDate(session.timeOut)}` : "Currently parked"} | ${formatDuration(session.timeIn, session.timeOut)}</span>
      </div>
      <span class="status-pill ${session.status === "Completed" ? "completed" : ""}">${escapeHtml(session.status)}</span>
    </article>`).join("")
    : `<p class="empty-state">No staff parking records found.</p>`;
}

function renderVisitorHistory() {
  const query = $("visitorHistorySearch").value.trim().toLowerCase();
  const status = $("visitorHistoryStatus").value;
  const visitors = state.data.visitorSessions
    .filter((visitor) => status === "All" || visitor.status === status)
    .filter((visitor) => !query || [visitor.visitorName, visitor.companyName, visitor.visiting, visitor.carRegistration].some((value) => value.toLowerCase().includes(query)))
    .sort((a, b) => new Date(b.timeIn) - new Date(a.timeIn));

  $("visitorHistory").innerHTML = visitors.length
    ? visitors.map((visitor) => `<article class="history-row">
      <div>
        <strong>${escapeHtml(visitor.visitorName)} - ${escapeHtml(visitor.companyName)}</strong>
        <span>Visiting ${escapeHtml(visitor.visiting)} | In: ${formatDate(visitor.timeIn)} | ${visitor.timeOut ? `Out: ${formatDate(visitor.timeOut)}` : "Currently signed in"} | Bay: ${visitor.bayNumber ?? "None"}</span>
      </div>
      <span class="status-pill ${visitor.status === "Signed Out" ? "completed" : ""}">${escapeHtml(visitor.status)}</span>
    </article>`).join("")
    : `<p class="empty-state">No visitor records found.</p>`;
}

function occupancyForBay(bayNumber) {
  const staff = state.data.staffSessions.find((session) => session.bayNumber === bayNumber && session.status === "Occupied");
  if (staff) return { kind: "staff", session: staff };
  const visitor = state.data.visitorSessions.find((item) => item.bayNumber === bayNumber && item.status === "Signed In");
  if (visitor) return { kind: "visitor", session: visitor };
  return null;
}

function sortedProfiles() {
  return [...state.data.staffProfiles].sort((a, b) => a.personName.localeCompare(b.personName));
}

function setStaffProfileEditMode(profile) {
  editingStaffProfile = profile;
  $("profileName").value = profile?.personName || "";
  $("profileRegistration").value = profile?.carRegistration || "";
  $("profileSaveButton").textContent = profile ? "Save changes" : "Add staff member";
  $("profileCancelEditButton").hidden = !profile;
  $("profileName").focus();
}

function showOnly(panelIds, panelToShow) {
  panelIds.forEach((id) => $(id).hidden = id !== panelToShow);
  updateModalBackdrop();
}

function closePanels() {
  ["staffCheckInPanel", "staffCheckOutPanel", "staffHistoryPanel", "visitorSignInPanel", "visitorSignOutPanel", "visitorHistoryPanel"].forEach((id) => $(id).hidden = true);
  hideMessageDialog();
  updateModalBackdrop();
}

function setTab(tab) {
  $("staffPanel").hidden = tab !== "staff";
  $("visitorsPanel").hidden = tab !== "visitors";
  document.querySelectorAll(".tab-bar button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  closePanels();
}

function setDateTimeInput(id) {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  $(id).value = date.toISOString().slice(0, 16);
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(value);
}

function formatDuration(timeIn, timeOut) {
  const minutes = Math.max(0, Math.round(((timeOut ? new Date(timeOut) : new Date()) - new Date(timeIn)) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours === 0 ? `${minutes} min` : `${hours} hr ${minutes % 60} min`;
}

function details(rows) {
  return rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

document.addEventListener("click", (event) => {
  const tabButton = event.target.closest("[data-tab]");
  if (tabButton) setTab(tabButton.dataset.tab);

  const bayButton = event.target.closest("[data-bay]");
  if (bayButton) {
    selectedBay = Number(bayButton.dataset.bay);
    const occupancy = occupancyForBay(selectedBay);
    if (!occupancy) {
      $("staffCheckInTitle").textContent = `Bay ${selectedBay}`;
      setDateTimeInput("staffTimeIn");
      showOnly(["staffCheckInPanel", "staffCheckOutPanel", "staffHistoryPanel"], "staffCheckInPanel");
    } else if (occupancy.kind === "staff") {
      selectedStaffSession = occupancy.session;
      $("staffCheckOutTitle").textContent = `Bay ${selectedStaffSession.bayNumber}`;
      $("staffCheckOutDetails").innerHTML = details([
        ["Name", selectedStaffSession.personName],
        ["Car registration", selectedStaffSession.carRegistration],
        ["Time in", formatDate(selectedStaffSession.timeIn)],
        ["Duration", formatDuration(selectedStaffSession.timeIn)],
      ]);
      showOnly(["staffCheckInPanel", "staffCheckOutPanel", "staffHistoryPanel"], "staffCheckOutPanel");
    } else {
      showMessageDialog("Bay occupied", `Bay ${selectedBay} is in use by visitor ${occupancy.session.visitorName}.`);
    }
  }

  if (event.target.matches("[data-close-panel]")) closePanels();
  if (event.target.id === "toggleStaffDetails") $("staffDetailsPanel").hidden = !$("staffDetailsPanel").hidden;
  if (event.target.id === "showStaffHistory") showOnly(["staffCheckInPanel", "staffCheckOutPanel", "staffHistoryPanel"], "staffHistoryPanel");
  if (event.target.id === "showVisitorSignIn") {
    setDateTimeInput("visitorTimeIn");
    showOnly(["visitorSignInPanel", "visitorSignOutPanel", "visitorHistoryPanel"], "visitorSignInPanel");
  }
  if (event.target.id === "showVisitorHistory") showOnly(["visitorSignInPanel", "visitorSignOutPanel", "visitorHistoryPanel"], "visitorHistoryPanel");
  if (event.target.id === "refreshButton") send("refresh");
  if (event.target.id === "exportButton") send("exportHistory");
  if (event.target.id === "staffCheckOutButton" && selectedStaffSession) send("checkOutStaff", { id: selectedStaffSession.id });
  if (event.target.id === "visitorSignOutButton" && selectedVisitorSession) send("signOutVisitor", { id: selectedVisitorSession.id });

  const visitorButton = event.target.closest("[data-visitor-id]");
  if (visitorButton) {
    selectedVisitorSession = state.data.visitorSessions.find((visitor) => visitor.id === Number(visitorButton.dataset.visitorId));
    $("visitorSignOutTitle").textContent = selectedVisitorSession.visitorName;
    $("visitorSignOutDetails").innerHTML = details([
      ["Company", selectedVisitorSession.companyName],
      ["Visiting", selectedVisitorSession.visiting],
      ["Car registration", selectedVisitorSession.carRegistration || "N/A"],
      ["Door pass", selectedVisitorSession.doorPassNumber || "N/A"],
      ["Bay", selectedVisitorSession.bayNumber ?? "None"],
      ["Time in", formatDate(selectedVisitorSession.timeIn)],
      ["Duration", formatDuration(selectedVisitorSession.timeIn)],
    ]);
    showOnly(["visitorSignInPanel", "visitorSignOutPanel", "visitorHistoryPanel"], "visitorSignOutPanel");
  }

  const deleteProfile = event.target.closest("[data-profile-name]");
  if (deleteProfile) {
    send("deleteStaffProfile", {
      personName: deleteProfile.dataset.profileName,
      carRegistration: deleteProfile.dataset.profileReg,
    });
  }

  const editProfile = event.target.closest("[data-edit-profile-name]");
  if (editProfile) {
    setStaffProfileEditMode({
      personName: editProfile.dataset.editProfileName,
      carRegistration: editProfile.dataset.editProfileReg,
    });
  }
});

$("staffCheckInForm").addEventListener("submit", (event) => {
  event.preventDefault();
  send("checkInStaff", {
    bayNumber: selectedBay,
    personName: $("staffName").value,
    carRegistration: $("staffRegistration").value,
    timeIn: $("staffTimeIn").value,
    notes: $("staffNotes").value,
  });
  event.target.reset();
  closePanels();
});

$("visitorSignInForm").addEventListener("submit", (event) => {
  event.preventDefault();
  send("signInVisitor", {
    visitorName: $("visitorName").value,
    companyName: $("companyName").value,
    visiting: $("visiting").value,
    carRegistration: $("visitorRegistration").value,
    doorPassNumber: $("doorPass").value,
    bayNumber: $("visitorBay").value ? Number($("visitorBay").value) : null,
    timeIn: $("visitorTimeIn").value,
    notes: $("visitorNotes").value,
  });
  event.target.reset();
  closePanels();
});

$("staffProfileForm").addEventListener("submit", (event) => {
  event.preventDefault();
  send("saveStaffProfile", {
    personName: $("profileName").value,
    carRegistration: $("profileRegistration").value,
    originalPersonName: editingStaffProfile?.personName || "",
    originalCarRegistration: editingStaffProfile?.carRegistration || "",
  });
  event.target.reset();
  setStaffProfileEditMode(null);
});

$("profileCancelEditButton").addEventListener("click", () => {
  $("staffProfileForm").reset();
  setStaffProfileEditMode(null);
});

$("savedStaffSelect").addEventListener("change", () => {
  const selected = $("savedStaffSelect").value;
  if (!selected) {
    $("staffName").value = "";
    $("staffRegistration").value = "";
    return;
  }
  const profile = sortedProfiles()[Number(selected)];
  $("staffName").value = profile.personName;
  $("staffRegistration").value = profile.carRegistration;
});

["staffHistorySearch", "staffHistoryStatus"].forEach((id) => $(id).addEventListener("input", renderStaffHistory));
["visitorHistorySearch", "visitorHistoryStatus"].forEach((id) => $(id).addEventListener("input", renderVisitorHistory));

$("modalBackdrop").addEventListener("click", closePanels);
$("messageOkButton").addEventListener("click", closePanels);

function showMessageDialog(title, message) {
  $("messageTitle").textContent = title;
  $("messageBody").textContent = message;
  $("messageDialog").hidden = false;
  updateModalBackdrop();
}

function hideMessageDialog() {
  $("messageDialog").hidden = true;
}

function updateModalBackdrop() {
  const modalOpen = ["staffCheckInPanel", "staffCheckOutPanel", "visitorSignInPanel", "visitorSignOutPanel", "messageDialog"].some((id) => !$(id).hidden);
  $("modalBackdrop").hidden = !modalOpen;
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePanels();
  }
});

function updateLogoSlot() {
  const image = $("brandLogoImage");
  image.parentElement.classList.toggle("has-logo", image.complete && image.naturalWidth > 0);
}

$("brandLogoImage").addEventListener("load", updateLogoSlot);
$("brandLogoImage").addEventListener("error", updateLogoSlot);
updateLogoSlot();
