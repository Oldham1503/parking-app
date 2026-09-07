"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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
const AUTO_REFRESH_MS = 15000;
const STAFF_DETAILS_STORAGE_KEY = "parkingRegister.staffDetails";

type StaffProfile = {
  personName: string;
  carRegistration: string;
};

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

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

export function ParkingRegister() {
  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [visitors, setVisitors] = useState<VisitorSession[]>([]);
  const [activeTab, setActiveTab] = useState<AppTab>("staff");
  const [staffMode, setStaffMode] = useState<StaffMode>("dashboard");
  const [visitorMode, setVisitorMode] = useState<VisitorMode>("dashboard");
  const [selectedBay, setSelectedBay] = useState<number | null>(null);
  const [selectedStaffSession, setSelectedStaffSession] = useState<ParkingSession | null>(null);
  const [selectedVisitorSession, setSelectedVisitorSession] = useState<VisitorSession | null>(null);
  const [showStaffDetails, setShowStaffDetails] = useState(false);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
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
  const [isBusy, setIsBusy] = useState(false);
  const [keepAwake, setKeepAwake] = useState(true);
  const [wakeLockSupported, setWakeLockSupported] = useState(true);
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState("-");
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  const occupancyByBay = useMemo(() => {
    const occupancy = new Map<number, BayOccupancy>();

    sessions
      .filter((session) => session.status === "Occupied")
      .forEach((session) => {
        occupancy.set(session.bayNumber, {
          kind: "staff",
          bayNumber: session.bayNumber,
          session,
        });
      });

    visitors
      .filter((visitor) => visitor.status === "Signed In" && visitor.bayNumber !== null)
      .forEach((visitor) => {
        occupancy.set(visitor.bayNumber as number, {
          kind: "visitor",
          bayNumber: visitor.bayNumber as number,
          session: visitor,
        });
      });

    return occupancy;
  }, [sessions, visitors]);

  const bayModels = useMemo(() => {
    return Array.from({ length: BAY_COUNT }, (_, index) => {
      const bayNumber = index + 1;
      return {
        bayNumber,
        occupancy: occupancyByBay.get(bayNumber) ?? null,
      };
    });
  }, [occupancyByBay]);

  const signedInVisitors = visitors.filter((visitor) => visitor.status === "Signed In");
  const occupiedCount = occupancyByBay.size;
  const freeCount = BAY_COUNT - occupiedCount;

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();

    return sessions.filter((session) => {
      const statusMatches = historyStatus === "All" || session.status === historyStatus;
      const searchMatches =
        query.length === 0 ||
        session.personName.toLowerCase().includes(query) ||
        session.carRegistration.toLowerCase().includes(query);

      return statusMatches && searchMatches;
    });
  }, [historySearch, historyStatus, sessions]);

  const filteredVisitorHistory = useMemo(() => {
    const query = visitorHistorySearch.trim().toLowerCase();

    return visitors.filter((visitor) => {
      const statusMatches = visitorHistoryStatus === "All" || visitor.status === visitorHistoryStatus;
      const searchMatches =
        query.length === 0 ||
        visitor.visitorName.toLowerCase().includes(query) ||
        visitor.companyName.toLowerCase().includes(query) ||
        visitor.visiting.toLowerCase().includes(query) ||
        visitor.carRegistration.toLowerCase().includes(query);

      return statusMatches && searchMatches;
    });
  }, [visitorHistorySearch, visitorHistoryStatus, visitors]);

  async function refresh(showSuccess = false) {
    const response = await fetch("/api/parking", { cache: "no-store" });
    const data = (await response.json()) as {
      sessions?: ParkingSession[];
      visitors?: VisitorSession[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error ?? "Could not load register records.");
    }

    setSessions(data.sessions ?? []);
    setVisitors(data.visitors ?? []);
    setLastUpdated(
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date())
    );

    if (showSuccess) {
      setMessage("Register refreshed.");
    }
  }

  useEffect(() => {
    refresh().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Could not load register records.");
    });
  }, []);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(STAFF_DETAILS_STORAGE_KEY);

      if (!storedValue) {
        return;
      }

      const parsedValue = JSON.parse(storedValue) as Partial<StaffProfile> | Partial<StaffProfile>[];
      const parsedProfiles = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
      const nextProfiles = parsedProfiles
        .map((profile) => ({
          personName: profile.personName?.trim() ?? "",
          carRegistration: profile.carRegistration?.trim().toUpperCase() ?? "",
        }))
        .filter((profile) => profile.personName);

      if (nextProfiles.length === 0) {
        return;
      }

      setStaffProfiles(nextProfiles);
    } catch {
      window.localStorage.removeItem(STAFF_DETAILS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const nav = navigator as WakeLockNavigator;
    setWakeLockSupported(Boolean(nav.wakeLock));
  }, []);

  useEffect(() => {
    async function requestWakeLock() {
      const nav = navigator as WakeLockNavigator;

      if (!nav.wakeLock) {
        setWakeLockSupported(false);
        setKeepAwake(false);
        setMessage("This browser cannot keep the screen awake. Set iPad Auto-Lock to Never while using the register.");
        return;
      }

      try {
        wakeLockRef.current = await nav.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      } catch {
        setKeepAwake(false);
        setMessage("The iPad did not allow screen wake. Set Auto-Lock to Never in iPad Settings.");
      }
    }

    async function releaseWakeLock() {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    }

    if (keepAwake) {
      requestWakeLock();
    } else {
      releaseWakeLock().catch(() => undefined);
    }

    return () => {
      releaseWakeLock().catch(() => undefined);
    };
  }, [keepAwake]);

  useEffect(() => {
    function restoreWakeLock() {
      if (document.visibilityState === "visible" && keepAwake && !wakeLockRef.current) {
        const nav = navigator as WakeLockNavigator;
        nav.wakeLock?.request("screen").then((lock) => {
          wakeLockRef.current = lock;
        }).catch(() => undefined);
      }
    }

    document.addEventListener("visibilitychange", restoreWakeLock);
    return () => document.removeEventListener("visibilitychange", restoreWakeLock);
  }, [keepAwake]);

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

  function saveStaffProfiles(nextProfiles: StaffProfile[]) {
    setStaffProfiles(nextProfiles);

    if (nextProfiles.length === 0) {
      window.localStorage.removeItem(STAFF_DETAILS_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STAFF_DETAILS_STORAGE_KEY, JSON.stringify(nextProfiles));
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

    const existingIndex = staffProfiles.findIndex(
      (profile) => profile.personName.toLowerCase() === nextDetails.personName.toLowerCase()
    );
    const nextProfiles =
      existingIndex === -1
        ? [...staffProfiles, nextDetails].sort((first, second) => first.personName.localeCompare(second.personName))
        : staffProfiles.map((profile, index) => (index === existingIndex ? nextDetails : profile));

    saveStaffProfiles(nextProfiles);
    setStaffDetailsName("");
    setStaffDetailsCarRegistration("");
    setMessage(`${nextDetails.personName || nextDetails.carRegistration} saved on this tablet.`);
  }

  function handleClearStaffDetails() {
    saveStaffProfiles([]);
    setStaffDetailsName("");
    setStaffDetailsCarRegistration("");
    setMessage("Saved staff list cleared.");
  }

  function handleDeleteStaffProfile(profileToDelete: StaffProfile) {
    const nextProfiles = staffProfiles.filter(
      (profile) =>
        profile.personName !== profileToDelete.personName ||
        profile.carRegistration !== profileToDelete.carRegistration
    );

    saveStaffProfiles(nextProfiles);
    setMessage(`${profileToDelete.personName || profileToDelete.carRegistration} removed.`);
  }

  function handleStaffProfileSelection(selectedPersonName: string) {
    const selectedProfile = staffProfiles.find((profile) => profile.personName === selectedPersonName);

    if (!selectedProfile) {
      setPersonName("");
      setCarRegistration("");
      return;
    }

    setPersonName(selectedProfile.personName);
    setCarRegistration(selectedProfile.carRegistration);
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

  async function handleCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/parking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bayNumber: selectedBay,
          personName,
          carRegistration,
          timeIn: dateTimeInputToIso(timeIn),
          notes,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not check in this bay.");
      }

      await refresh();
      setStaffMode("dashboard");
      setMessage(`Bay ${selectedBay} checked in.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not check in this bay.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCheckOut() {
    if (!selectedStaffSession) {
      return;
    }

    setIsBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/parking/${selectedStaffSession.id}/checkout`, {
        method: "POST",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not check out this bay.");
      }

      await refresh();
      setStaffMode("dashboard");
      setMessage(`Bay ${selectedStaffSession.bayNumber} checked out.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not check out this bay.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleVisitorSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorName,
          companyName,
          visiting,
          carRegistration: visitorCarRegistration,
          doorPassNumber,
          bayNumber: visitorBayNumber ? Number(visitorBayNumber) : null,
          timeIn: dateTimeInputToIso(visitorTimeIn),
          notes: visitorNotes,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not sign in this visitor.");
      }

      await refresh();
      setVisitorMode("dashboard");
      setMessage(`${visitorName} signed in.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign in this visitor.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleVisitorSignOut() {
    if (!selectedVisitorSession) {
      return;
    }

    setIsBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/visitors/${selectedVisitorSession.id}/checkout`, {
        method: "POST",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not sign out this visitor.");
      }

      await refresh();
      setVisitorMode("dashboard");
      setMessage(`${selectedVisitorSession.visitorName} signed out.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign out this visitor.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img
            alt="C365Cloud"
            className="brand-logo"
            height={56}
            src="/c365cloud-logomark-rgb.png"
            width={56}
          />
          <div>
            <p className="eyebrow">C365Cloud</p>
            <h1>Parking Bay Register</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            aria-label="Refresh register"
            className="icon-button"
            onClick={() => refresh(true).catch((error: unknown) => {
              setMessage(error instanceof Error ? error.message : "Could not refresh.");
            })}
            title="Refresh register"
            type="button"
          >
            R
          </button>
          <label className="wake-toggle">
            <input
              checked={keepAwake}
              disabled={!wakeLockSupported}
              onChange={(event) => setKeepAwake(event.target.checked)}
              type="checkbox"
            />
            Keep screen awake
          </label>
        </div>
      </header>

      <nav aria-label="Register sections" className="tab-bar">
        <button
          className={activeTab === "staff" ? "active" : ""}
          onClick={() => switchTab("staff")}
          type="button"
        >
          Staff Parking
        </button>
        <button
          className={activeTab === "visitors" ? "active" : ""}
          onClick={() => switchTab("visitors")}
          type="button"
        >
          Visitors
        </button>
      </nav>

      {message ? <div className="notice">{message}</div> : null}

      {activeTab === "staff" && staffMode === "dashboard" ? (
        <section aria-label="Parking bays" className="bay-grid priority-bays">
          {bayModels.map((bay) => (
            <button
              className={`bay-tile ${bay.occupancy ? "occupied" : "free"}`}
              key={bay.bayNumber}
              onClick={() => openStaffBay(bay.bayNumber)}
              type="button"
            >
              <span>
                <strong className="bay-number">Bay {bay.bayNumber}</strong>
                <strong className="bay-status">
                  {bay.occupancy ? "Occupied" : "Free"}
                </strong>
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
      ) : null}

      <section aria-label="Parking summary" className="summary-strip">
        <div>
          <span>{freeCount}</span>
          <small>Free bays</small>
        </div>
        <div>
          <span>{occupiedCount}</span>
          <small>Bays in use</small>
        </div>
        <div>
          <span>{signedInVisitors.length}</span>
          <small>Visitors signed in</small>
        </div>
        <div>
          <span>{lastUpdated}</span>
          <small>Last updated, auto-refresh 15 sec</small>
        </div>
      </section>

      {activeTab === "staff" ? (
        <>
          {staffMode === "dashboard" ? (
            <>
              <div className="section-actions">
                <h2>Staff Parking</h2>
                <div className="topbar-actions">
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setShowStaffDetails((isShown) => !isShown);
                      setMessage("");
                    }}
                    type="button"
                  >
                    Staff details
                  </button>
                  <button className="secondary-button" onClick={() => setStaffMode("history")} type="button">
                    Staff history
                  </button>
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
                    <label>
                      Name
                      <input
                        autoComplete="name"
                        onChange={(event) => setStaffDetailsName(event.target.value)}
                        required
                        value={staffDetailsName}
                      />
                    </label>
                    <label>
                      Car registration
                      <input
                        autoComplete="off"
                        onChange={(event) => setStaffDetailsCarRegistration(event.target.value)}
                        required
                        value={staffDetailsCarRegistration}
                      />
                    </label>
                    <footer>
                      <button className="primary-button" type="submit">
                        Add staff member
                      </button>
                      <button className="secondary-button" onClick={handleClearStaffDetails} type="button">
                        Clear saved list
                      </button>
                    </footer>
                  </form>
                  <div className="staff-profile-list">
                    {staffProfiles.length === 0 ? (
                      <p className="empty-state">No staff members saved on this tablet.</p>
                    ) : (
                      staffProfiles.map((profile) => (
                        <article className="staff-profile-row" key={`${profile.personName}-${profile.carRegistration}`}>
                          <span>
                            <strong>{profile.personName || "Unnamed staff member"}</strong>
                            <span>{profile.carRegistration}</span>
                          </span>
                          <button
                            className="secondary-button"
                            onClick={() => handleDeleteStaffProfile(profile)}
                            type="button"
                          >
                            Remove
                          </button>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          {staffMode === "check-in" ? (
            <section className="panel">
              <header className="panel-header">
                <div>
                  <p className="eyebrow">Staff check in</p>
                  <h2>Bay {selectedBay}</h2>
                </div>
                <button className="secondary-button" onClick={() => setStaffMode("dashboard")} type="button">
                  Cancel
                </button>
              </header>
              <form className="entry-form" onSubmit={handleCheckIn}>
                {staffProfiles.length > 0 ? (
                  <label>
                    Pick saved staff member
                    <select
                      onChange={(event) => handleStaffProfileSelection(event.target.value)}
                      value={staffProfiles.some((profile) => profile.personName === personName) ? personName : ""}
                    >
                      <option value="">Type details manually</option>
                      {staffProfiles.map((profile) => (
                        <option key={`${profile.personName}-${profile.carRegistration}`} value={profile.personName}>
                          {profile.personName} - {profile.carRegistration}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label>
                  Name
                  <input autoComplete="name" onChange={(event) => setPersonName(event.target.value)} required value={personName} />
                </label>
                <label>
                  Car registration
                  <input autoComplete="off" onChange={(event) => setCarRegistration(event.target.value)} required value={carRegistration} />
                </label>
                <label>
                  Start time
                  <input max={toDateTimeInputValue()} onChange={(event) => setTimeIn(event.target.value)} required type="datetime-local" value={timeIn} />
                </label>
                <label>
                  Notes
                  <textarea onChange={(event) => setNotes(event.target.value)} rows={3} value={notes} />
                </label>
                <footer>
                  <button className="primary-button" disabled={isBusy} type="submit">
                    {isBusy ? "Saving..." : "Check in"}
                  </button>
                </footer>
              </form>
            </section>
          ) : null}

          {staffMode === "check-out" && selectedStaffSession ? (
            <section className="panel">
              <header className="panel-header">
                <div>
                  <p className="eyebrow">Staff check out</p>
                  <h2>Bay {selectedStaffSession.bayNumber}</h2>
                </div>
                <button className="secondary-button" onClick={() => setStaffMode("dashboard")} type="button">
                  Cancel
                </button>
              </header>
              <dl className="details-list">
                <div><dt>Name</dt><dd>{selectedStaffSession.personName}</dd></div>
                <div><dt>Car registration</dt><dd>{selectedStaffSession.carRegistration}</dd></div>
                <div><dt>Time in</dt><dd>{formatDateTime(selectedStaffSession.timeIn)}</dd></div>
                <div><dt>Duration</dt><dd>{formatDuration(selectedStaffSession.timeIn)}</dd></div>
              </dl>
              <footer>
                <button className="danger-button" disabled={isBusy} onClick={handleCheckOut} type="button">
                  {isBusy ? "Saving..." : "Check out"}
                </button>
              </footer>
            </section>
          ) : null}

          {staffMode === "history" ? (
            <section className="panel history-panel">
              <header className="panel-header">
                <div>
                  <p className="eyebrow">Staff records</p>
                  <h2>Staff Parking History</h2>
                </div>
                <button className="primary-button" onClick={() => setStaffMode("dashboard")} type="button">Done</button>
              </header>
              <div className="history-tools">
                <input onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search name or reg" type="search" value={historySearch} />
                <select aria-label="Filter by status" onChange={(event) => setHistoryStatus(event.target.value as "All" | ParkingStatus)} value={historyStatus}>
                  <option value="All">All</option>
                  <option value="Occupied">Occupied</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className="history-list">
                {filteredHistory.length === 0 ? <p className="empty-state">No staff parking records found.</p> : filteredHistory.map((session) => (
                  <article className="history-row" key={session.id}>
                    <div>
                      <strong>Bay {session.bayNumber} - {session.carRegistration}</strong>
                      <span>{session.personName} | In: {formatDateTime(session.timeIn)} | {session.timeOut ? `Out: ${formatDateTime(session.timeOut)}` : "Currently parked"}</span>
                    </div>
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
                <div>
                  <p className="eyebrow">Visitor register</p>
                  <h2>Visitors in the office</h2>
                </div>
                <div className="topbar-actions">
                  <button className="primary-button" onClick={openVisitorSignIn} type="button">Sign in visitor</button>
                  <button className="secondary-button" onClick={() => setVisitorMode("history")} type="button">Visitor history</button>
                </div>
              </header>
              <div className="history-list">
                {signedInVisitors.length === 0 ? <p className="empty-state">No visitors currently signed in.</p> : signedInVisitors.map((visitor) => (
                  <button
                    className="visitor-row"
                    key={visitor.id}
                    onClick={() => {
                      setSelectedVisitorSession(visitor);
                      setVisitorMode("sign-out");
                    }}
                    type="button"
                  >
                    <span>
                      <strong>{visitor.visitorName}</strong>
                      <span>{visitor.companyName} | Visiting {visitor.visiting}</span>
                      <span>In: {formatDateTime(visitor.timeIn)} | Bay: {visitor.bayNumber ?? "None"} | Reg: {visitor.carRegistration || "N/A"} | Pass: {visitor.doorPassNumber || "N/A"}</span>
                    </span>
                    <span className="status-pill">{visitor.status}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {visitorMode === "sign-in" ? (
            <section className="panel">
              <header className="panel-header">
                <div>
                  <p className="eyebrow">Visitor sign in</p>
                  <h2>New visitor</h2>
                </div>
                <button className="secondary-button" onClick={() => setVisitorMode("dashboard")} type="button">Cancel</button>
              </header>
              <form className="entry-form" onSubmit={handleVisitorSignIn}>
                <label>
                  Name
                  <input autoComplete="name" onChange={(event) => setVisitorName(event.target.value)} required value={visitorName} />
                </label>
                <label>
                  Company name
                  <input onChange={(event) => setCompanyName(event.target.value)} required value={companyName} />
                </label>
                <label>
                  Who visiting
                  <input onChange={(event) => setVisiting(event.target.value)} required value={visiting} />
                </label>
                <label>
                  Car registration, if applicable
                  <input autoComplete="off" onChange={(event) => setVisitorCarRegistration(event.target.value)} value={visitorCarRegistration} />
                </label>
                <label>
                  Door pass number, if applicable
                  <input onChange={(event) => setDoorPassNumber(event.target.value)} value={doorPassNumber} />
                </label>
                <label>
                  Car park bay number
                  <select onChange={(event) => setVisitorBayNumber(event.target.value)} value={visitorBayNumber}>
                    <option value="">No bay / not applicable</option>
                    {bayModels.map((bay) => (
                      <option disabled={Boolean(bay.occupancy)} key={bay.bayNumber} value={bay.bayNumber}>
                        Bay {bay.bayNumber}{bay.occupancy ? " - occupied" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Time in
                  <input max={toDateTimeInputValue()} onChange={(event) => setVisitorTimeIn(event.target.value)} required type="datetime-local" value={visitorTimeIn} />
                </label>
                <label>
                  Notes
                  <textarea onChange={(event) => setVisitorNotes(event.target.value)} rows={3} value={visitorNotes} />
                </label>
                <footer>
                  <button className="primary-button" disabled={isBusy} type="submit">
                    {isBusy ? "Saving..." : "Sign in visitor"}
                  </button>
                </footer>
              </form>
            </section>
          ) : null}

          {visitorMode === "sign-out" && selectedVisitorSession ? (
            <section className="panel">
              <header className="panel-header">
                <div>
                  <p className="eyebrow">Visitor sign out</p>
                  <h2>{selectedVisitorSession.visitorName}</h2>
                </div>
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
              <footer>
                <button className="danger-button" disabled={isBusy} onClick={handleVisitorSignOut} type="button">
                  {isBusy ? "Saving..." : "Sign out visitor"}
                </button>
              </footer>
            </section>
          ) : null}

          {visitorMode === "history" ? (
            <section className="panel history-panel">
              <header className="panel-header">
                <div>
                  <p className="eyebrow">Visitor records</p>
                  <h2>Visitor History</h2>
                </div>
                <button className="primary-button" onClick={() => setVisitorMode("dashboard")} type="button">Done</button>
              </header>
              <div className="history-tools">
                <input onChange={(event) => setVisitorHistorySearch(event.target.value)} placeholder="Search visitor, company, host or reg" type="search" value={visitorHistorySearch} />
                <select aria-label="Filter by status" onChange={(event) => setVisitorHistoryStatus(event.target.value as "All" | VisitorStatus)} value={visitorHistoryStatus}>
                  <option value="All">All</option>
                  <option value="Signed In">Signed In</option>
                  <option value="Signed Out">Signed Out</option>
                </select>
              </div>
              <div className="history-list">
                {filteredVisitorHistory.length === 0 ? <p className="empty-state">No visitor records found.</p> : filteredVisitorHistory.map((visitor) => (
                  <article className="history-row" key={visitor.id}>
                    <div>
                      <strong>{visitor.visitorName} - {visitor.companyName}</strong>
                      <span>Visiting {visitor.visiting} | In: {formatDateTime(visitor.timeIn)} | {visitor.timeOut ? `Out: ${formatDateTime(visitor.timeOut)}` : "Currently signed in"} | Bay: {visitor.bayNumber ?? "None"}</span>
                    </div>
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
