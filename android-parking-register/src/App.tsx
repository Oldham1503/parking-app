import { FormEvent, useEffect, useMemo, useState } from "react";

type ParkingStatus = "Occupied" | "Completed";
type VisitorStatus = "Signed In" | "Signed Out";
type AppTab = "staff" | "visitors";
type StaffMode = "dashboard" | "check-in" | "check-out" | "history";
type VisitorMode = "dashboard" | "sign-in" | "sign-out" | "history";

type ParkingSession = {
  id: number;
  bayNumber: number;
  personName: string;
  carRegistration: string;
  notes: string;
  timeIn: string;
  timeOut: string | null;
  status: ParkingStatus;
  createdBy: string;
  checkedOutBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type VisitorSession = {
  id: number;
  visitorName: string;
  companyName: string;
  visiting: string;
  carRegistration: string;
  doorPassNumber: string;
  bayNumber: number | null;
  notes: string;
  timeIn: string;
  timeOut: string | null;
  status: VisitorStatus;
  createdBy: string;
  signedOutBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type StaffProfile = {
  personName: string;
  carRegistration: string;
};

type RegisterData = {
  nextParkingId: number;
  nextVisitorId: number;
  sessions: ParkingSession[];
  visitors: VisitorSession[];
  staffProfiles: StaffProfile[];
};

type BayOccupancy =
  | { kind: "staff"; bayNumber: number; session: ParkingSession }
  | { kind: "visitor"; bayNumber: number; session: VisitorSession };

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

const BAY_COUNT = 10;
const FUTURE_GRACE_MS = 2 * 60 * 1000;
const STORAGE_KEY = "parking-register-android-v1";
const ACTOR = "Android tablet";

const initialData: RegisterData = {
  nextParkingId: 1,
  nextVisitorId: 1,
  sessions: [],
  visitors: [],
  staffProfiles: [],
};

function loadData(): RegisterData {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return initialData;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RegisterData>;
    return {
      nextParkingId: parsed.nextParkingId ?? 1,
      nextVisitorId: parsed.nextVisitorId ?? 1,
      sessions: parsed.sessions ?? [],
      visitors: parsed.visitors ?? [],
      staffProfiles: parsed.staffProfiles ?? [],
    };
  } catch {
    return initialData;
  }
}

function saveData(data: RegisterData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function toDateTimeInputValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function dateTimeInputToIso(value: string) {
  return new Date(value).toISOString();
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(timeIn: string, timeOut?: string | null) {
  const start = new Date(timeIn);
  const end = timeOut ? new Date(timeOut) : new Date();
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return hours === 0 ? `${remainingMinutes} min` : `${hours} hr ${remainingMinutes} min`;
}

function isValidBay(value: unknown): value is number {
  return Number.isInteger(value) && value >= 1 && value <= BAY_COUNT;
}

function csvEscape(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers: string[], rows: Array<Array<string | number | null>>) {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

async function shareCsv(filename: string, csv: string) {
  const capacitor = (window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;

  if (capacitor?.isNativePlatform?.()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);

    await Filesystem.writeFile({
      path: filename,
      data: csv,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    const file = await Filesystem.getUri({
      path: filename,
      directory: Directory.Cache,
    });

    await Share.share({
      title: filename,
      text: "Parking register history export",
      files: [file.uri],
      dialogTitle: "Export history",
    });
    return;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function sortedByNewest<T extends { timeIn: string; id: number }>(records: T[]) {
  return [...records].sort((first, second) => {
    const byTime = new Date(second.timeIn).getTime() - new Date(first.timeIn).getTime();
    return byTime || second.id - first.id;
  });
}

export function App() {
  const [data, setData] = useState<RegisterData>(() => loadData());
  const [activeTab, setActiveTab] = useState<AppTab>("staff");
  const [staffMode, setStaffMode] = useState<StaffMode>("dashboard");
  const [visitorMode, setVisitorMode] = useState<VisitorMode>("dashboard");
  const [selectedBay, setSelectedBay] = useState<number | null>(null);
  const [selectedStaffSession, setSelectedStaffSession] = useState<ParkingSession | null>(null);
  const [selectedVisitorSession, setSelectedVisitorSession] = useState<VisitorSession | null>(null);
  const [showStaffDetails, setShowStaffDetails] = useState(false);
  const [staffDetailsName, setStaffDetailsName] = useState("");
  const [staffDetailsCarRegistration, setStaffDetailsCarRegistration] = useState("");
  const [personName, setPersonName] = useState("");
  const [carRegistration, setCarRegistration] = useState("");
  const [timeIn, setTimeIn] = useState(toDateTimeInputValue());
  const [notes, setNotes] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [visiting, setVisiting] = useState("");
  const [visitorCarRegistration, setVisitorCarRegistration] = useState("");
  const [doorPassNumber, setDoorPassNumber] = useState("");
  const [visitorBayNumber, setVisitorBayNumber] = useState("");
  const [visitorTimeIn, setVisitorTimeIn] = useState(toDateTimeInputValue());
  const [visitorNotes, setVisitorNotes] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState<"All" | ParkingStatus>("All");
  const [visitorHistorySearch, setVisitorHistorySearch] = useState("");
  const [visitorHistoryStatus, setVisitorHistoryStatus] = useState<"All" | VisitorStatus>("All");
  const [keepAwake, setKeepAwake] = useState(true);
  const [wakeLockSupported, setWakeLockSupported] = useState(true);
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState("-");

  useEffect(() => {
    saveData(data);
    setLastUpdated(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
  }, [data]);

  useEffect(() => {
    let lock: WakeLockSentinelLike | null = null;
    const nav = navigator as WakeLockNavigator;
    setWakeLockSupported(Boolean(nav.wakeLock));

    async function requestWakeLock() {
      if (!nav.wakeLock || !keepAwake) {
        return;
      }

      try {
        lock = await nav.wakeLock.request("screen");
        lock.addEventListener("release", () => {
          lock = null;
        });
      } catch {
        setWakeLockSupported(false);
        setKeepAwake(false);
      }
    }

    requestWakeLock();
    return () => {
      lock?.release().catch(() => undefined);
    };
  }, [keepAwake]);

  const occupancyByBay = useMemo(() => {
    const occupancy = new Map<number, BayOccupancy>();

    data.sessions
      .filter((session) => session.status === "Occupied")
      .forEach((session) => {
        occupancy.set(session.bayNumber, { kind: "staff", bayNumber: session.bayNumber, session });
      });

    data.visitors
      .filter((visitor) => visitor.status === "Signed In" && visitor.bayNumber !== null)
      .forEach((visitor) => {
        occupancy.set(visitor.bayNumber as number, {
          kind: "visitor",
          bayNumber: visitor.bayNumber as number,
          session: visitor,
        });
      });

    return occupancy;
  }, [data.sessions, data.visitors]);

  const bayModels = Array.from({ length: BAY_COUNT }, (_, index) => {
    const bayNumber = index + 1;
    return { bayNumber, occupancy: occupancyByBay.get(bayNumber) ?? null };
  });
  const signedInVisitors = data.visitors.filter((visitor) => visitor.status === "Signed In");
  const occupiedCount = occupancyByBay.size;
  const freeCount = BAY_COUNT - occupiedCount;

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return sortedByNewest(data.sessions).filter((session) => {
      const statusMatches = historyStatus === "All" || session.status === historyStatus;
      const searchMatches =
        !query ||
        session.personName.toLowerCase().includes(query) ||
        session.carRegistration.toLowerCase().includes(query);
      return statusMatches && searchMatches;
    });
  }, [data.sessions, historySearch, historyStatus]);

  const filteredVisitorHistory = useMemo(() => {
    const query = visitorHistorySearch.trim().toLowerCase();
    return sortedByNewest(data.visitors).filter((visitor) => {
      const statusMatches = visitorHistoryStatus === "All" || visitor.status === visitorHistoryStatus;
      const searchMatches =
        !query ||
        visitor.visitorName.toLowerCase().includes(query) ||
        visitor.companyName.toLowerCase().includes(query) ||
        visitor.visiting.toLowerCase().includes(query) ||
        visitor.carRegistration.toLowerCase().includes(query);
      return statusMatches && searchMatches;
    });
  }, [data.visitors, visitorHistorySearch, visitorHistoryStatus]);

  function switchTab(tab: AppTab) {
    setActiveTab(tab);
    setStaffMode("dashboard");
    setVisitorMode("dashboard");
    setMessage("");
  }

  function openStaffBay(bayNumber: number) {
    const occupancy = occupancyByBay.get(bayNumber);
    setSelectedBay(bayNumber);
    setMessage("");

    if (occupancy?.kind === "staff") {
      setSelectedStaffSession(occupancy.session);
      setStaffMode("check-out");
      return;
    }

    if (occupancy?.kind === "visitor") {
      setMessage(`Bay ${bayNumber} is in use by visitor ${occupancy.session.visitorName}.`);
      return;
    }

    setSelectedStaffSession(null);
    setPersonName("");
    setCarRegistration("");
    setTimeIn(toDateTimeInputValue());
    setNotes("");
    setStaffMode("check-in");
  }

  function saveStaffProfiles(staffProfiles: StaffProfile[]) {
    setData((current) => ({ ...current, staffProfiles }));
  }

  function handleSaveStaffDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextDetails = {
      personName: staffDetailsName.trim(),
      carRegistration: staffDetailsCarRegistration.trim().toUpperCase(),
    };

    if (!nextDetails.personName || !nextDetails.carRegistration) {
      setMessage("Enter a name and car registration before saving a staff member.");
      return;
    }

    const existingIndex = data.staffProfiles.findIndex(
      (profile) => profile.personName.toLowerCase() === nextDetails.personName.toLowerCase()
    );
    const nextProfiles =
      existingIndex === -1
        ? [...data.staffProfiles, nextDetails].sort((first, second) => first.personName.localeCompare(second.personName))
        : data.staffProfiles.map((profile, index) => (index === existingIndex ? nextDetails : profile));

    saveStaffProfiles(nextProfiles);
    setStaffDetailsName("");
    setStaffDetailsCarRegistration("");
    setMessage(`${nextDetails.personName} saved on this tablet.`);
  }

  function handleStaffProfileSelection(selectedPersonName: string) {
    const selectedProfile = data.staffProfiles.find((profile) => profile.personName === selectedPersonName);
    setPersonName(selectedProfile?.personName ?? "");
    setCarRegistration(selectedProfile?.carRegistration ?? "");
  }

  function handleCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedTimeIn = new Date(timeIn);
    const bayNumber = selectedBay;
    const nextName = personName.trim();
    const nextRegistration = carRegistration.trim().toUpperCase();

    if (!isValidBay(bayNumber)) {
      setMessage("Choose a valid bay from 1 to 10.");
      return;
    }

    if (!nextName || !nextRegistration) {
      setMessage("Name and car registration are required.");
      return;
    }

    if (Number.isNaN(selectedTimeIn.getTime()) || selectedTimeIn.getTime() > Date.now() + FUTURE_GRACE_MS) {
      setMessage("Choose a valid start time that is not in the future.");
      return;
    }

    if (occupancyByBay.has(bayNumber)) {
      setMessage(`Bay ${bayNumber} is already occupied.`);
      return;
    }

    const now = new Date().toISOString();
    const session: ParkingSession = {
      id: data.nextParkingId,
      bayNumber,
      personName: nextName,
      carRegistration: nextRegistration,
      notes: notes.trim(),
      timeIn: dateTimeInputToIso(timeIn),
      timeOut: null,
      status: "Occupied",
      createdBy: ACTOR,
      checkedOutBy: null,
      createdAt: now,
      updatedAt: now,
    };

    setData((current) => ({
      ...current,
      nextParkingId: current.nextParkingId + 1,
      sessions: [session, ...current.sessions],
    }));
    setStaffMode("dashboard");
    setMessage(`Bay ${bayNumber} checked in.`);
  }

  function handleCheckOut() {
    if (!selectedStaffSession) {
      return;
    }

    const now = new Date().toISOString();
    setData((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === selectedStaffSession.id && session.status === "Occupied"
          ? { ...session, timeOut: now, status: "Completed", checkedOutBy: ACTOR, updatedAt: now }
          : session
      ),
    }));
    setStaffMode("dashboard");
    setMessage(`Bay ${selectedStaffSession.bayNumber} checked out.`);
  }

  function openVisitorSignIn() {
    setVisitorName("");
    setCompanyName("");
    setVisiting("");
    setVisitorCarRegistration("");
    setDoorPassNumber("");
    setVisitorBayNumber("");
    setVisitorTimeIn(toDateTimeInputValue());
    setVisitorNotes("");
    setVisitorMode("sign-in");
    setMessage("");
  }

  function handleVisitorSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedTimeIn = new Date(visitorTimeIn);
    const bayNumber = visitorBayNumber ? Number(visitorBayNumber) : null;
    const nextVisitorName = visitorName.trim();
    const nextCompanyName = companyName.trim();
    const nextVisiting = visiting.trim();

    if (!nextVisitorName || !nextCompanyName || !nextVisiting) {
      setMessage("Visitor name, company name, and who they are visiting are required.");
      return;
    }

    if (bayNumber !== null && !isValidBay(bayNumber)) {
      setMessage("Choose a valid bay from 1 to 10.");
      return;
    }

    if (bayNumber !== null && occupancyByBay.has(bayNumber)) {
      setMessage(`Bay ${bayNumber} is already occupied.`);
      return;
    }

    if (Number.isNaN(selectedTimeIn.getTime()) || selectedTimeIn.getTime() > Date.now() + FUTURE_GRACE_MS) {
      setMessage("Choose a valid time in that is not in the future.");
      return;
    }

    const now = new Date().toISOString();
    const visitor: VisitorSession = {
      id: data.nextVisitorId,
      visitorName: nextVisitorName,
      companyName: nextCompanyName,
      visiting: nextVisiting,
      carRegistration: visitorCarRegistration.trim().toUpperCase(),
      doorPassNumber: doorPassNumber.trim(),
      bayNumber,
      notes: visitorNotes.trim(),
      timeIn: dateTimeInputToIso(visitorTimeIn),
      timeOut: null,
      status: "Signed In",
      createdBy: ACTOR,
      signedOutBy: null,
      createdAt: now,
      updatedAt: now,
    };

    setData((current) => ({
      ...current,
      nextVisitorId: current.nextVisitorId + 1,
      visitors: [visitor, ...current.visitors],
    }));
    setVisitorMode("dashboard");
    setMessage(`${visitor.visitorName} signed in.`);
  }

  function handleVisitorSignOut() {
    if (!selectedVisitorSession) {
      return;
    }

    const now = new Date().toISOString();
    setData((current) => ({
      ...current,
      visitors: current.visitors.map((visitor) =>
        visitor.id === selectedVisitorSession.id && visitor.status === "Signed In"
          ? { ...visitor, timeOut: now, status: "Signed Out", signedOutBy: ACTOR, updatedAt: now }
          : visitor
      ),
    }));
    setVisitorMode("dashboard");
    setMessage(`${selectedVisitorSession.visitorName} signed out.`);
  }

  async function exportStaffHistory() {
    const csv = toCsv(
      ["ID", "Bay", "Name", "Registration", "Time In", "Time Out", "Status", "Duration", "Notes"],
      sortedByNewest(data.sessions).map((session) => [
        session.id,
        session.bayNumber,
        session.personName,
        session.carRegistration,
        session.timeIn,
        session.timeOut,
        session.status,
        formatDuration(session.timeIn, session.timeOut),
        session.notes,
      ])
    );

    await shareCsv(`parking-history-${todayStamp()}.csv`, csv);
  }

  async function exportVisitorHistory() {
    const csv = toCsv(
      ["ID", "Visitor", "Company", "Visiting", "Registration", "Door Pass", "Bay", "Time In", "Time Out", "Status", "Duration", "Notes"],
      sortedByNewest(data.visitors).map((visitor) => [
        visitor.id,
        visitor.visitorName,
        visitor.companyName,
        visitor.visiting,
        visitor.carRegistration,
        visitor.doorPassNumber,
        visitor.bayNumber,
        visitor.timeIn,
        visitor.timeOut,
        visitor.status,
        formatDuration(visitor.timeIn, visitor.timeOut),
        visitor.notes,
      ])
    );

    await shareCsv(`visitor-history-${todayStamp()}.csv`, csv);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img alt="C365Cloud" className="brand-logo" height={56} src="/c365cloud-logomark-rgb.png" width={56} />
          <div>
            <p className="eyebrow">C365Cloud</p>
            <h1>Parking Bay Register</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" onClick={() => setLastUpdated(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date()))} title="Refresh display" type="button">
            R
          </button>
          <label className="wake-toggle">
            <input checked={keepAwake} disabled={!wakeLockSupported} onChange={(event) => setKeepAwake(event.target.checked)} type="checkbox" />
            Keep screen awake
          </label>
        </div>
      </header>

      <nav aria-label="Register sections" className="tab-bar">
        <button className={activeTab === "staff" ? "active" : ""} onClick={() => switchTab("staff")} type="button">
          Staff Parking
        </button>
        <button className={activeTab === "visitors" ? "active" : ""} onClick={() => switchTab("visitors")} type="button">
          Visitors
        </button>
      </nav>

      {message ? <div className="message">{message}</div> : null}

      <section aria-label="Parking bays" className="bay-grid priority-bays">
        {bayModels.map((bay) => (
          <button className={`bay-tile ${bay.occupancy ? "occupied" : "free"}`} key={bay.bayNumber} onClick={() => openStaffBay(bay.bayNumber)} type="button">
            <span>
              <strong className="bay-number">Bay {bay.bayNumber}</strong>
              <strong className="bay-status">{bay.occupancy ? "Occupied" : "Free"}</strong>
            </span>
            <span className="bay-meta">
              {bay.occupancy?.kind === "staff" ? (
                <>
                  <strong>{bay.occupancy.session.personName}</strong>
                  <span>{bay.occupancy.session.carRegistration}</span>
                  <span>Staff parking</span>
                  <span>In: {formatDateTime(bay.occupancy.session.timeIn)}</span>
                </>
              ) : bay.occupancy?.kind === "visitor" ? (
                <>
                  <strong>{bay.occupancy.session.visitorName}</strong>
                  <span>{bay.occupancy.session.companyName}</span>
                  <span>Visitor</span>
                  <span>In: {formatDateTime(bay.occupancy.session.timeIn)}</span>
                </>
              ) : (
                <>
                  <strong>Available</strong>
                  <span>Tap for staff car</span>
                </>
              )}
            </span>
          </button>
        ))}
      </section>

      <section aria-label="Parking summary" className="summary-strip">
        <div><span>{freeCount}</span><small>Free bays</small></div>
        <div><span>{occupiedCount}</span><small>Bays in use</small></div>
        <div><span>{signedInVisitors.length}</span><small>Visitors signed in</small></div>
        <div><span>{lastUpdated}</span><small>Last updated</small></div>
      </section>

      {activeTab === "staff" ? (
        <>
          {staffMode === "dashboard" ? (
            <>
              <div className="section-actions">
                <h2>Staff Parking</h2>
                <div className="topbar-actions">
                  <button className="secondary-button" onClick={() => setShowStaffDetails((shown) => !shown)} type="button">Staff details</button>
                  <button className="secondary-button" onClick={() => setStaffMode("history")} type="button">Staff history</button>
                </div>
              </div>
              {showStaffDetails ? (
                <section className="panel staff-details-panel">
                  <header className="panel-header">
                    <div>
                      <p className="eyebrow">This tablet only</p>
                      <h2>Saved Staff Members</h2>
                    </div>
                  </header>
                  <form className="entry-form compact-form" onSubmit={handleSaveStaffDetails}>
                    <label>Name<input autoComplete="name" onChange={(event) => setStaffDetailsName(event.target.value)} required value={staffDetailsName} /></label>
                    <label>Car registration<input autoComplete="off" onChange={(event) => setStaffDetailsCarRegistration(event.target.value)} required value={staffDetailsCarRegistration} /></label>
                    <footer>
                      <button className="primary-button" type="submit">Add staff member</button>
                      <button className="secondary-button" onClick={() => saveStaffProfiles([])} type="button">Clear saved list</button>
                    </footer>
                  </form>
                  <div className="staff-profile-list">
                    {data.staffProfiles.length === 0 ? <p className="empty-state">No staff members saved on this tablet.</p> : data.staffProfiles.map((profile) => (
                      <article className="staff-profile-row" key={`${profile.personName}-${profile.carRegistration}`}>
                        <span><strong>{profile.personName}</strong><span>{profile.carRegistration}</span></span>
                        <button className="secondary-button" onClick={() => saveStaffProfiles(data.staffProfiles.filter((item) => item !== profile))} type="button">Remove</button>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          {staffMode === "check-in" ? (
            <section className="panel">
              <header className="panel-header">
                <div><p className="eyebrow">Staff check in</p><h2>Bay {selectedBay}</h2></div>
                <button className="secondary-button" onClick={() => setStaffMode("dashboard")} type="button">Cancel</button>
              </header>
              <form className="entry-form" onSubmit={handleCheckIn}>
                {data.staffProfiles.length > 0 ? (
                  <label>Pick saved staff member<select onChange={(event) => handleStaffProfileSelection(event.target.value)} value={data.staffProfiles.some((profile) => profile.personName === personName) ? personName : ""}>
                    <option value="">Type details manually</option>
                    {data.staffProfiles.map((profile) => <option key={`${profile.personName}-${profile.carRegistration}`} value={profile.personName}>{profile.personName} - {profile.carRegistration}</option>)}
                  </select></label>
                ) : null}
                <label>Name<input autoComplete="name" onChange={(event) => setPersonName(event.target.value)} required value={personName} /></label>
                <label>Car registration<input autoComplete="off" onChange={(event) => setCarRegistration(event.target.value)} required value={carRegistration} /></label>
                <label>Start time<input max={toDateTimeInputValue()} onChange={(event) => setTimeIn(event.target.value)} required type="datetime-local" value={timeIn} /></label>
                <label>Notes<textarea onChange={(event) => setNotes(event.target.value)} rows={3} value={notes} /></label>
                <footer><button className="primary-button" type="submit">Check in</button></footer>
              </form>
            </section>
          ) : null}

          {staffMode === "check-out" && selectedStaffSession ? (
            <section className="panel">
              <header className="panel-header">
                <div><p className="eyebrow">Staff check out</p><h2>Bay {selectedStaffSession.bayNumber}</h2></div>
                <button className="secondary-button" onClick={() => setStaffMode("dashboard")} type="button">Cancel</button>
              </header>
              <dl className="details-list">
                <div><dt>Name</dt><dd>{selectedStaffSession.personName}</dd></div>
                <div><dt>Car registration</dt><dd>{selectedStaffSession.carRegistration}</dd></div>
                <div><dt>Time in</dt><dd>{formatDateTime(selectedStaffSession.timeIn)}</dd></div>
                <div><dt>Duration</dt><dd>{formatDuration(selectedStaffSession.timeIn)}</dd></div>
              </dl>
              <footer><button className="danger-button" onClick={handleCheckOut} type="button">Check out</button></footer>
            </section>
          ) : null}

          {staffMode === "history" ? (
            <section className="panel history-panel">
              <header className="panel-header">
                <div><p className="eyebrow">Staff records</p><h2>Staff Parking History</h2></div>
                <button className="primary-button" onClick={() => setStaffMode("dashboard")} type="button">Done</button>
              </header>
              <div className="history-tools">
                <input onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search name or reg" type="search" value={historySearch} />
                <select aria-label="Filter by status" onChange={(event) => setHistoryStatus(event.target.value as "All" | ParkingStatus)} value={historyStatus}>
                  <option value="All">All</option><option value="Occupied">Occupied</option><option value="Completed">Completed</option>
                </select>
                <button className="secondary-button" onClick={() => exportStaffHistory().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not export staff history."))} type="button">Export CSV</button>
              </div>
              <div className="history-list">
                {filteredHistory.length === 0 ? <p className="empty-state">No staff parking records found.</p> : filteredHistory.map((session) => (
                  <article className="history-row" key={session.id}>
                    <div><strong>Bay {session.bayNumber} - {session.carRegistration}</strong><span>{session.personName} | In: {formatDateTime(session.timeIn)} | {session.timeOut ? `Out: ${formatDateTime(session.timeOut)}` : "Currently parked"}</span></div>
                    <span className={`status-pill ${session.status === "Completed" ? "completed" : ""}`}>{session.status}</span>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {activeTab === "visitors" ? (
        <>
          {visitorMode === "dashboard" ? (
            <section className="panel visitor-dashboard">
              <header className="panel-header">
                <div><p className="eyebrow">Visitor register</p><h2>Visitors in the office</h2></div>
                <div className="topbar-actions">
                  <button className="primary-button" onClick={openVisitorSignIn} type="button">Sign in visitor</button>
                  <button className="secondary-button" onClick={() => setVisitorMode("history")} type="button">Visitor history</button>
                </div>
              </header>
              <div className="history-list">
                {signedInVisitors.length === 0 ? <p className="empty-state">No visitors currently signed in.</p> : signedInVisitors.map((visitor) => (
                  <button className="visitor-row" key={visitor.id} onClick={() => { setSelectedVisitorSession(visitor); setVisitorMode("sign-out"); }} type="button">
                    <span><strong>{visitor.visitorName}</strong><span>{visitor.companyName} | Visiting {visitor.visiting}</span><span>In: {formatDateTime(visitor.timeIn)} | Bay: {visitor.bayNumber ?? "None"} | Reg: {visitor.carRegistration || "N/A"} | Pass: {visitor.doorPassNumber || "N/A"}</span></span>
                    <span className="status-pill">{visitor.status}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {visitorMode === "sign-in" ? (
            <section className="panel">
              <header className="panel-header">
                <div><p className="eyebrow">Visitor sign in</p><h2>New visitor</h2></div>
                <button className="secondary-button" onClick={() => setVisitorMode("dashboard")} type="button">Cancel</button>
              </header>
              <form className="entry-form" onSubmit={handleVisitorSignIn}>
                <label>Name<input autoComplete="name" onChange={(event) => setVisitorName(event.target.value)} required value={visitorName} /></label>
                <label>Company name<input onChange={(event) => setCompanyName(event.target.value)} required value={companyName} /></label>
                <label>Who visiting<input onChange={(event) => setVisiting(event.target.value)} required value={visiting} /></label>
                <label>Car registration, if applicable<input autoComplete="off" onChange={(event) => setVisitorCarRegistration(event.target.value)} value={visitorCarRegistration} /></label>
                <label>Door pass number, if applicable<input onChange={(event) => setDoorPassNumber(event.target.value)} value={doorPassNumber} /></label>
                <label>Car park bay number<select onChange={(event) => setVisitorBayNumber(event.target.value)} value={visitorBayNumber}>
                  <option value="">No bay / not applicable</option>
                  {bayModels.map((bay) => <option disabled={Boolean(bay.occupancy)} key={bay.bayNumber} value={bay.bayNumber}>Bay {bay.bayNumber}{bay.occupancy ? " - occupied" : ""}</option>)}
                </select></label>
                <label>Time in<input max={toDateTimeInputValue()} onChange={(event) => setVisitorTimeIn(event.target.value)} required type="datetime-local" value={visitorTimeIn} /></label>
                <label>Notes<textarea onChange={(event) => setVisitorNotes(event.target.value)} rows={3} value={visitorNotes} /></label>
                <footer><button className="primary-button" type="submit">Sign in visitor</button></footer>
              </form>
            </section>
          ) : null}

          {visitorMode === "sign-out" && selectedVisitorSession ? (
            <section className="panel">
              <header className="panel-header">
                <div><p className="eyebrow">Visitor sign out</p><h2>{selectedVisitorSession.visitorName}</h2></div>
                <button className="secondary-button" onClick={() => setVisitorMode("dashboard")} type="button">Cancel</button>
              </header>
              <dl className="details-list">
                <div><dt>Company</dt><dd>{selectedVisitorSession.companyName}</dd></div>
                <div><dt>Visiting</dt><dd>{selectedVisitorSession.visiting}</dd></div>
                <div><dt>Car registration</dt><dd>{selectedVisitorSession.carRegistration || "N/A"}</dd></div>
                <div><dt>Door pass</dt><dd>{selectedVisitorSession.doorPassNumber || "N/A"}</dd></div>
                <div><dt>Bay</dt><dd>{selectedVisitorSession.bayNumber ?? "None"}</dd></div>
                <div><dt>Time in</dt><dd>{formatDateTime(selectedVisitorSession.timeIn)}</dd></div>
                <div><dt>Duration</dt><dd>{formatDuration(selectedVisitorSession.timeIn)}</dd></div>
              </dl>
              <footer><button className="danger-button" onClick={handleVisitorSignOut} type="button">Sign out visitor</button></footer>
            </section>
          ) : null}

          {visitorMode === "history" ? (
            <section className="panel history-panel">
              <header className="panel-header">
                <div><p className="eyebrow">Visitor records</p><h2>Visitor History</h2></div>
                <button className="primary-button" onClick={() => setVisitorMode("dashboard")} type="button">Done</button>
              </header>
              <div className="history-tools">
                <input onChange={(event) => setVisitorHistorySearch(event.target.value)} placeholder="Search visitor, company, host or reg" type="search" value={visitorHistorySearch} />
                <select aria-label="Filter by status" onChange={(event) => setVisitorHistoryStatus(event.target.value as "All" | VisitorStatus)} value={visitorHistoryStatus}>
                  <option value="All">All</option><option value="Signed In">Signed In</option><option value="Signed Out">Signed Out</option>
                </select>
                <button className="secondary-button" onClick={() => exportVisitorHistory().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not export visitor history."))} type="button">Export CSV</button>
              </div>
              <div className="history-list">
                {filteredVisitorHistory.length === 0 ? <p className="empty-state">No visitor records found.</p> : filteredVisitorHistory.map((visitor) => (
                  <article className="history-row" key={visitor.id}>
                    <div><strong>{visitor.visitorName} - {visitor.companyName}</strong><span>Visiting {visitor.visiting} | In: {formatDateTime(visitor.timeIn)} | {visitor.timeOut ? `Out: ${formatDateTime(visitor.timeOut)}` : "Currently signed in"} | Bay: {visitor.bayNumber ?? "None"}</span></div>
                    <span className={`status-pill ${visitor.status === "Signed Out" ? "completed" : ""}`}>{visitor.status}</span>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
