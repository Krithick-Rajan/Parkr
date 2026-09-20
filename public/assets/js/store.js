(function (global) {
  const STORAGE = {
    users: "parkrUsers",
    slots: "parkrSlots",
    bookings: "parkrBookings",
    payments: "parkrPayments",
    dataVersion: "parkrDataVersion"
  };
  const DATA_VERSION = "parkr-v4-cloud-sync";
  const DEMO_EMAIL_SUFFIX = "@parkr.test";
  const DEMO_USER_IDS = new Set(["USR-01", "USR-02", "USR-03", "USR-04", "USR-05"]);
  const DEMO_SLOT_IDS = new Set([
    "city-mall",
    "airport-gate",
    "station-east",
    "bus-stand",
    "hospital-parking",
    "market-parking",
    "tech-park"
  ]);
  const LEGACY_SLOT_TERMS = [
    "city mall",
    "airport parking",
    "railway station",
    "bus stand parking",
    "hospital parking",
    "market parking",
    "tech park"
  ];

  let backendResolved = false;
  let backendCache = null;
  let backendPromise = null;

  // In-memory high-speed cache to eliminate navigation latency
  const memoryCache = {
    users: null,
    slots: null,
    bookings: null,
    payments: null
  };

  function invalidateCache(key) {
    if (key && Object.prototype.hasOwnProperty.call(memoryCache, key)) {
      memoryCache[key] = null;
    } else {
      memoryCache.users = null;
      memoryCache.slots = null;
      memoryCache.bookings = null;
      memoryCache.payments = null;
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || []));
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function waitForBackendReady() {
    if (global.ParkrBackend && global.ParkrBackend.isConfigured) {
      return Promise.resolve(global.ParkrBackend);
    }
    if (global.ParkrBackendReady) {
      return Promise.race([global.ParkrBackendReady, wait(350).then(() => global.ParkrBackend || null)]);
    }
    return new Promise((resolve) => {
      const done = (backend) => {
        global.removeEventListener("parkr-backend-ready", listener);
        resolve(backend || global.ParkrBackend || null);
      };
      const listener = (event) => done(event.detail);
      global.addEventListener("parkr-backend-ready", listener, { once: true });
      wait(300).then(() => done(global.ParkrBackend || null));
    });
  }

  async function getBackend() {
    if (global.ParkrBackend && global.ParkrBackend.isConfigured) {
      backendCache = global.ParkrBackend;
      backendResolved = true;
      return backendCache;
    }
    if (backendCache) return backendCache;
    if (backendResolved) return backendCache;
    if (backendPromise) return backendPromise;

    backendPromise = (async () => {
      if (global.ParkrBackend && global.ParkrBackend.isConfigured) {
        backendCache = global.ParkrBackend;
        backendResolved = true;
        return backendCache;
      }
      try {
        const backend = await waitForBackendReady();
        backendCache = backend && backend.isConfigured ? backend : (global.ParkrBackend || null);
      } catch (error) {
        backendCache = global.ParkrBackend || null;
      }
      backendResolved = Boolean(backendCache);
      return backendCache;
    })();

    return backendPromise;
  }

  function readStored(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeStored(key, rows) {
    localStorage.setItem(key, JSON.stringify(rows || []));
  }

  function idOf(row) {
    return row.id || row.userId || row.slotId || row.bookingId || row.paymentId || row.email;
  }

  function isDemoUser(row) {
    if (!row) return false;
    const email = normalizeText(row.email);
    const userId = String(row.userId || row.id || "");
    return email.endsWith(DEMO_EMAIL_SUFFIX) || DEMO_USER_IDS.has(userId);
  }

  function isDemoSlot(row) {
    if (!row) return false;
    const slotId = String(row.slotId || row.id || "");
    const ownerId = String(row.ownerId || "");
    const name = normalizeText(row.name || row.slot);
    return DEMO_SLOT_IDS.has(slotId) || DEMO_USER_IDS.has(ownerId) || LEGACY_SLOT_TERMS.some((term) => name.includes(term));
  }

  function isDemoBooking(row) {
    if (!row) return false;
    const slotId = String(row.slotId || "");
    const driverId = String(row.driverId || "");
    const ownerId = String(row.ownerId || "");
    const slotName = normalizeText(row.slot || row.slotName);
    return DEMO_SLOT_IDS.has(slotId)
      || DEMO_USER_IDS.has(driverId)
      || DEMO_USER_IDS.has(ownerId)
      || LEGACY_SLOT_TERMS.some((term) => slotName.includes(term));
  }

  function isDemoPayment(row, demoBookingIds) {
    if (!row) return false;
    return demoBookingIds.has(String(row.bookingId || "")) || String(row.paymentId || row.id || "").startsWith("PAY-102");
  }

  function mergeRows(seedRows, storedRows) {
    const map = new Map();
    seedRows.forEach((row) => map.set(idOf(row), row));
    storedRows.forEach((row) => map.set(idOf(row), row));
    return Array.from(map.values());
  }

  function getCollection(key, seedRows) {
    const seed = clone(seedRows);
    const stored = readStored(key);
    const rows = mergeRows(seed, stored);
    writeStored(key, rows);
    return rows;
  }

  function setCollection(key, rows) {
    writeStored(key, rows);
    return rows;
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeStatus(value) {
    return normalizeText(value).replace(/\s+/g, "-");
  }

  function isPaidRecord(row) {
    const status = normalizeStatus((row || {}).paymentStatus || (row || {}).status);
    return ["paid", "success", "confirmed", "completed"].includes(status);
  }

  function normalizeSlotRecord(slot) {
    const verification = normalizeStatus(slot.verificationStatus || slot.status);
    if (verification && verification !== "approved") {
      return { ...slot, availabilityStatus: "unavailable" };
    }
    return slot;
  }

  function normalizeBookingRecord(booking) {
    return isPaidRecord(booking) ? { ...booking, status: "paid" } : booking;
  }

  function normalizePaymentRecord(payment) {
    return isPaidRecord(payment) ? { ...payment, status: "paid", paymentStatus: "paid" } : payment;
  }

  function readableIdNumber(value, prefix) {
    const match = String(value || "").match(new RegExp("^" + prefix + "-(\\d{3})$", "i"));
    return match ? Number(match[1]) : 0;
  }

  function readableIdFrom(row, prefix) {
    const source = row || {};
    const values = [
      source.displayId,
      source.publicId,
      source.userId,
      source.slotId,
      source.bookingId,
      source.paymentId,
      source.id
    ];
    return values.find((value) => readableIdNumber(value, prefix)) || "";
  }

  function nextReadableId(prefix, rows) {
    const max = (rows || []).reduce((highest, row) => {
      const source = row || {};
      return Math.max(
        highest,
        readableIdNumber(source.displayId, prefix),
        readableIdNumber(source.userId, prefix),
        readableIdNumber(source.slotId, prefix),
        readableIdNumber(source.bookingId, prefix),
        readableIdNumber(source.paymentId, prefix),
        readableIdNumber(source.id, prefix)
      );
    }, 0);
    return prefix + "-" + String(max + 1).padStart(3, "0");
  }

  function withDisplayIds(rows, prefix) {
    const used = new Set();
    return (rows || []).map((row, index) => {
      const existing = readableIdFrom(row, prefix);
      if (existing) {
        const displayId = String(existing).toUpperCase();
        used.add(displayId);
        return { ...row, displayId };
      }
      let next = index + 1;
      let displayId = prefix + "-" + String(next).padStart(3, "0");
      while (used.has(displayId)) {
        next += 1;
        displayId = prefix + "-" + String(next).padStart(3, "0");
      }
      used.add(displayId);
      return { ...row, displayId };
    });
  }

  function knownRoleForEmail() {
    return "";
  }

  function migrateStoredData() {
    if (localStorage.getItem(STORAGE.dataVersion) === DATA_VERSION) return;
    try {
      const LEGACY_TEST_EMAILS = new Set([
        "arjun@parkr.com",
        "harish@parkr.com",
        "krithick@parkr.com",
        "driver@parkr.com",
        "owner@parkr.com",
        "admin@parkr.com",
        "sri@parkr.com"
      ]);
      const LEGACY_IDS = new Set([
        "USR-001", "USR-002", "USR-003", "USR-004", "USR-005", "USR-006", "USR-007", "USR-010"
      ]);

      const users = readStored(STORAGE.users).filter((user) => {
        if (!user) return false;
        const email = normalizeText(user.email);
        const id = String(user.id || user.userId || "");
        if (LEGACY_TEST_EMAILS.has(email) || LEGACY_IDS.has(id)) return false;
        return !isDemoUser(user);
      });

      const slots = readStored(STORAGE.slots).filter((slot) => !isDemoSlot(slot)).map(normalizeSlotRecord);
      const bookings = readStored(STORAGE.bookings).filter((b) => {
        const id = String(b.bookingId || b.id || "");
        return !id.startsWith("BK-00") && !isDemoBooking(b);
      }).map(normalizeBookingRecord);
      const payments = readStored(STORAGE.payments).filter((p) => {
        const id = String(p.paymentId || p.id || "");
        return !id.startsWith("PAY-00") && !isDemoPayment(p, new Set());
      }).map(normalizePaymentRecord);

      writeStored(STORAGE.users, users);
      writeStored(STORAGE.slots, slots);
      writeStored(STORAGE.bookings, bookings);
      writeStored(STORAGE.payments, payments);

      const currentUser = JSON.parse(localStorage.getItem("parkrUser") || "null");
      if (currentUser) {
        const curEmail = normalizeText(currentUser.email);
        if (LEGACY_TEST_EMAILS.has(curEmail) || isDemoUser(currentUser)) {
          localStorage.removeItem("parkrUser");
        }
      }

      localStorage.setItem(STORAGE.dataVersion, DATA_VERSION);
    } catch (error) {
      localStorage.setItem(STORAGE.dataVersion, DATA_VERSION);
    }
  }

  function makeUser(data) {
    const knownRole = knownRoleForEmail((data || {}).email);
    const role = knownRole || normalizeText((data || {}).role) || "driver";
    const cleanData = { ...data, role };
    if (role === "owner") return new global.ParkrModels.ParkingOwner(cleanData).toRecord();
    if (role === "admin") return new global.ParkrModels.Admin(cleanData).toRecord();
    return new global.ParkrModels.Driver(cleanData).toRecord();
  }

  function makeSlot(data) {
    return new global.ParkrModels.ParkingSlot(data).toRecord();
  }

  function makeBooking(data) {
    return new global.ParkrModels.Booking(data).toRecord();
  }

  function makePayment(data) {
    return new global.ParkrModels.Payment(data).toRecord();
  }

  function seedUsers() {
    return [];
  }

  function seedSlots() {
    return [];
  }

  function seedBookings() {
    return [];
  }

  function seedPayments() {
    return [];
  }

  function listLocalUsers() {
    return getCollection(STORAGE.users, seedUsers());
  }

  function listLocalSlots() {
    return getCollection(STORAGE.slots, seedSlots()).map(makeSlot);
  }

  function listLocalBookings() {
    return getCollection(STORAGE.bookings, seedBookings()).map(makeBooking);
  }

  function listLocalPayments() {
    return getCollection(STORAGE.payments, seedPayments()).map(makePayment);
  }

  function currentUserFromStorage() {
    try {
      const user = JSON.parse(localStorage.getItem("parkrUser") || "null");
      if (!user) return null;
      if (isDemoUser(user)) {
        localStorage.removeItem("parkrUser");
        return null;
      }
      if (normalizeStatus(user.status) === "blocked") {
        localStorage.removeItem("parkrUser");
        return null;
      }
      const stored = listLocalUsers().find((item) => item.email && item.email === user.email);
      return makeUser({ ...user, ...(stored || {}), userId: (stored || {}).userId || (stored || {}).id || user.userId || user.id });
    } catch (error) {
      return null;
    }
  }

  function setCurrentUser(user) {
    const record = makeUser(user);
    localStorage.setItem("parkrUser", JSON.stringify(record));
    return record;
  }

  async function updateCurrentUser(changes) {
    const current = currentUserFromStorage();
    if (!current) return null;
    const userId = idOf(current);
    const record = makeUser({ ...current, ...(changes || {}), id: userId, userId, role: current.role });
    invalidateCache("users");
    const backend = await getBackend();
    if (backend && backend.updateUser) {
      try {
        await backend.updateUser(userId, record);
      } catch (err) {}
    }
    const rows = listLocalUsers();
    const index = rows.findIndex((user) => idOf(user) === userId);
    if (index >= 0) rows[index] = { ...rows[index], ...record };
    else rows.unshift(record);
    setCollection(STORAGE.users, rows);
    return setCurrentUser(record);
  }

  function upsertLocal(key, seedRows, row) {
    const rows = getCollection(key, seedRows);
    const recordId = idOf(row);
    const index = rows.findIndex((item) => idOf(item) === recordId);
    if (index >= 0) rows[index] = { ...rows[index], ...row };
    else rows.unshift(row);
    setCollection(key, rows);
    return row;
  }

  async function registerUser(user, password) {
    let record = makeUser({ ...user, status: user.status || "approved" });
    invalidateCache("users");

    // 1. Instant check against local store
    const localUsers = listLocalUsers();
    const existing = localUsers.find((item) => normalizeText(item.email) === normalizeText(record.email));
    if (existing) {
      throw new Error("This email is already registered as " + existing.role + ". Login as " + existing.role + " or use another email.");
    }

    // 2. Generate display ID instantly without blocking on remote scan
    const displayId = readableIdFrom(record, "USR") || nextReadableId("USR", localUsers);
    record = { ...record, id: displayId, userId: displayId, displayId, localPassword: String(password || "") };

    // 3. Save locally and set current session immediately (0ms latency!)
    upsertLocal(STORAGE.users, seedUsers(), record);
    setCurrentUser(record);

    // 4. Sync with Express DB in parallel
    fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    }).catch(() => {});

    // 5. Sync with Firebase in background without blocking navigation
    const syncFirebase = async () => {
      try {
        const backend = global.ParkrBackend || (await Promise.race([getBackend(), wait(500)]));
        if (backend && backend.registerUser) {
          const saved = await backend.registerUser(record, password);
          if (saved && saved.id) {
            upsertLocal(STORAGE.users, seedUsers(), { ...saved, localPassword: String(password || "") });
          }
        }
      } catch (err) {
        console.warn("[Register] Background Firebase sync:", err.message);
      }
    };
    syncFirebase();

    return record;
  }

  async function loginLocalUser(email, password, role) {
    const knownRole = knownRoleForEmail(email);
    const targetRole = knownRole || role || "driver";
    const users = listLocalUsers();
    let existing = users.find((user) => normalizeText(user.email) === normalizeText(email));
    if (!existing) {
      const displayId = nextReadableId("USR", users);
      const name = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

      existing = makeUser({
        id: displayId,
        userId: displayId,
        displayId,
        name: name || "Parkr User",
        email,
        role: targetRole,
        status: "approved",
        localPassword: String(password || "")
      });
      upsertLocal(STORAGE.users, seedUsers(), existing);
      setCurrentUser(existing);
      return existing;
    }

    if (knownRole && existing.role !== knownRole) {
      existing.role = knownRole;
      upsertLocal(STORAGE.users, seedUsers(), existing);
    }

    if (normalizeStatus(existing.status) === "blocked") throw new Error("This account is blocked. Contact the administrator.");
    if (!knownRole && normalizeText(existing.role) !== normalizeText(role || existing.role)) {
      throw new Error("This email is registered as " + existing.role + ". Please login as " + existing.role + ".");
    }
    if (existing.localPassword && String(password || "") !== String(existing.localPassword)) {
      throw new Error("Incorrect password. Please try again.");
    }
    const user = makeUser(existing);
    setCurrentUser(user);
    return user;
  }

  async function loginUser(email, password, role) {
    const normalizedEmail = normalizeText(email);
    const knownRole = knownRoleForEmail(normalizedEmail);
    const targetRole = knownRole || role || "driver";

    // 1. Instant local authentication path (< 1ms)
    const localUsers = listLocalUsers();
    const existing = localUsers.find((u) => normalizeText(u.email) === normalizedEmail);
    if (existing) {
      const authenticated = await loginLocalUser(email, password, targetRole);
      // Background sync with cloud auth
      const syncCloud = async () => {
        try {
          const backend = global.ParkrBackend || (await Promise.race([getBackend(), wait(500)]));
          if (backend && backend.loginUser) await backend.loginUser(email, password, targetRole);
        } catch (e) {}
      };
      syncCloud();
      return authenticated;
    }

    // 2. Check local Express API (< 2ms)
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password, role: targetRole })
      });
      if (resp.ok) {
        const dbUser = await resp.json();
        if (dbUser && dbUser.email) {
          const user = makeUser({ ...dbUser, localPassword: String(password || "") });
          upsertLocal(STORAGE.users, seedUsers(), user);
          setCurrentUser(user);
          return user;
        }
      }
    } catch (e) {}

    // 3. Fallback to Firebase or local creation
    try {
      const backend = await Promise.race([getBackend(), wait(1200)]);
      if (backend && backend.loginUser) {
        const user = makeUser(await backend.loginUser(email, password, role));
        if (normalizeStatus(user.status) === "blocked") throw new Error("This account is blocked. Contact the administrator.");
        setCurrentUser(user);
        return user;
      }
    } catch (backendError) {
      if (backendError.message && (
        backendError.message.includes("blocked") ||
        backendError.message.includes("registered as") ||
        backendError.message.includes("Incorrect password") ||
        backendError.message.includes("at least 6 characters")
      )) {
        throw backendError;
      }
    }

    return loginLocalUser(email, password, targetRole);
  }

  async function logoutUser() {
    const backend = await getBackend();
    if (backend && backend.logoutUser) await backend.logoutUser();
    localStorage.removeItem("parkrUser");
    invalidateCache();
  }

  async function listUsers(forceRefresh = false) {
    if (!forceRefresh && memoryCache.users && memoryCache.users.length) return memoryCache.users;

    // 1. If Cloud Backend (Firebase) is connected, it is the single authoritative source of truth
    try {
      const backend = await Promise.race([getBackend(), wait(1200)]);
      if (backend && backend.isConfigured && backend.listUsers) {
        const cloudUsers = await backend.listUsers();
        if (Array.isArray(cloudUsers)) {
          // Keep local storage strictly matching Cloud Firestore (never merge stale mock users)
          setCollection(STORAGE.users, cloudUsers);
          const result = withDisplayIds(cloudUsers.map(makeUser), "USR");
          memoryCache.users = result;
          return result;
        }
      }
    } catch (err) {
      console.warn("[Store] Cloud listUsers failed, trying server API:", err);
    }

    // 2. If Express server API is available
    try {
      const resp = await fetch("/api/auth/users");
      if (resp.ok) {
        const apiUsers = await resp.json();
        if (Array.isArray(apiUsers)) {
          setCollection(STORAGE.users, apiUsers);
          const result = withDisplayIds(apiUsers.map(makeUser), "USR");
          memoryCache.users = result;
          return result;
        }
      }
    } catch (err) {}

    // 3. Fallback to clean local storage
    const local = listLocalUsers();
    const result = withDisplayIds(local.map(makeUser), "USR");
    memoryCache.users = result;
    return result;
  }

  async function updateUserStatus(userId, status) {
    const normalized = normalizeStatus(status);
    invalidateCache("users");
    const backend = await getBackend();
    if (backend && backend.updateUserStatus) {
      try {
        await backend.updateUserStatus(userId, normalized);
      } catch (err) {}
    }
    const rows = listLocalUsers().map((user) => (idOf(user) === userId ? { ...user, status: normalized } : user));
    setCollection(STORAGE.users, rows);
    return rows.find((user) => idOf(user) === userId);
  }

  async function deleteUser(userId) {
    invalidateCache("users");
    const backend = await getBackend();
    if (backend && backend.deleteUser) {
      try {
        await backend.deleteUser(userId);
      } catch (err) {
        console.warn("[Store] Cloud deleteUser failed:", err);
      }
    }
    // Also delete from Express API
    fetch(`/api/auth/users/${encodeURIComponent(userId)}`, { method: "DELETE" }).catch(() => {});

    const rows = listLocalUsers().filter((user) => {
      const id = idOf(user);
      return id !== userId && user.userId !== userId && user.id !== userId && user.email !== userId;
    });
    setCollection(STORAGE.users, rows);
    const current = currentUserFromStorage();
    if (current && (idOf(current) === userId || current.userId === userId || current.email === userId)) {
      localStorage.removeItem("parkrUser");
    }
    return true;
  }

  async function purgeTestUsers() {
    invalidateCache("users");
    const TEST_EMAILS = new Set([
      "arjun@parkr.com",
      "harish@parkr.com",
      "krithick@parkr.com",
      "driver@parkr.com",
      "owner@parkr.com",
      "admin@parkr.com",
      "sri@parkr.com"
    ]);

    const isTestEmail = (email) => {
      const e = normalizeText(email);
      return TEST_EMAILS.has(e) || e.endsWith("@parkr.com") || e.includes("test@") || e.includes("demo@");
    };

    const backend = await getBackend();
    if (backend && backend.isConfigured && backend.deleteUser) {
      if (backend.listUsers) {
        try {
          const cloudUsers = await backend.listUsers();
          if (Array.isArray(cloudUsers)) {
            for (const u of cloudUsers) {
              if (isTestEmail(u.email) || isDemoUser(u) || String(u.id || "").startsWith("USR-")) {
                if (u.id) {
                  try { await backend.deleteUser(u.id); } catch (_) {}
                }
                if (u.email && u.email !== u.id) {
                  try { await backend.deleteUser(u.email); } catch (_) {}
                }
              }
            }
          }
        } catch (e) {
          console.warn("[Store] Cloud purge list failed:", e);
        }
      }
      for (const email of TEST_EMAILS) {
        try {
          await backend.deleteUser(email);
        } catch (e) {}
      }
    }

    for (const email of TEST_EMAILS) {
      fetch(`/api/auth/users/${encodeURIComponent(email)}`, { method: "DELETE" }).catch(() => {});
    }

    const remaining = readStored(STORAGE.users).filter((u) => {
      if (!u) return false;
      const email = normalizeText(u.email);
      const id = String(u.id || u.userId || "");
      return !isTestEmail(email) && !id.startsWith("USR-0") && !isDemoUser(u);
    });
    setCollection(STORAGE.users, remaining);
    return true;
  }

  async function listSlots(options) {
    const settings = options || {};
    let allSlots = memoryCache.slots;
    if (!allSlots || settings.forceRefresh) {
      const local = listLocalSlots();
      if (!settings.forceRefresh && local.length > 0) {
        allSlots = withDisplayIds(local.map(makeSlot), "SL");
        memoryCache.slots = allSlots;
        // Background sync
        getBackend().then((backend) => {
          if (backend && backend.listSlots) {
            backend.listSlots({ adminOnly: true }).then((rows) => {
              if (rows && rows.length) {
                const cloudIds = new Set(rows.map((r) => String(r.id || r.slotId || "")));
                local.forEach((l) => {
                  if (!cloudIds.has(String(l.id || l.slotId || ""))) rows.push(l);
                });
                memoryCache.slots = withDisplayIds(rows.map(makeSlot), "SL");
              }
            }).catch(() => {});
          }
        }).catch(() => {});
      } else {
        let rows = [];
        try {
          const backend = await Promise.race([getBackend(), wait(350)]);
          rows = backend && backend.listSlots ? await backend.listSlots({ adminOnly: true }) : [];
        } catch (err) {
          rows = [];
        }
        if (!rows || rows.length === 0) {
          rows = local;
        } else {
          const cloudIds = new Set(rows.map((r) => String(r.id || r.slotId || "")));
          local.forEach((l) => {
            if (!cloudIds.has(String(l.id || l.slotId || ""))) rows.push(l);
          });
        }
        allSlots = withDisplayIds(rows.map(makeSlot), "SL");
        memoryCache.slots = allSlots;
      }
    }

    return (allSlots || []).filter((slot) => {
      if (settings.ownerId) {
        const matchId = String(slot.ownerId || "") === String(settings.ownerId);
        const matchEmail = settings.ownerEmail && slot.ownerEmail && String(slot.ownerEmail).toLowerCase() === String(settings.ownerEmail).toLowerCase();
        if (!matchId && !matchEmail) return false;
      }
      if (settings.adminOnly) return true;
      if (settings.publicOnly) {
        const verification = normalizeStatus(slot.verificationStatus || slot.status);
        const availability = normalizeStatus(slot.availabilityStatus || slot.status);
        const available = Number(slot.available ?? slot.availableSlots ?? 0);
        return ["approved", "available"].includes(verification) && availability !== "unavailable" && available > 0;
      }
      return true;
    });
  }

  async function searchSlots(filters) {
    const settings = filters || {};
    try {
      const rows = await listSlots({ publicOnly: true });
      const location = normalizeText(settings.location);
      const vehicle = normalizeText(settings.vehicle);
      const maxPrice = Number(settings.maxPrice || settings.price || 999999);
      return (rows || []).filter((slot) => {
        const haystack = normalizeText((slot.name || "") + " " + (slot.address || "") + " " + (slot.location || "") + " " + (slot.area || ""));
        const matchesLocation = !location || haystack.includes(location);
        const matchesVehicle = !vehicle || normalizeText(slot.vehicleType || slot.vehicle) === vehicle;
        return matchesLocation && matchesVehicle && Number(slot.price || 0) <= maxPrice;
      });
    } catch (err) {
      console.warn("[Store] searchSlots error:", err);
      return [];
    }
  }

  async function getSlot(slotId) {
    if (!slotId) return null;
    try {
      const all = await listSlots({ adminOnly: true });
      return (all || []).find((slot) => slot.id === slotId || slot.slotId === slotId) || null;
    } catch (err) {
      console.warn("[Store] getSlot error:", err);
      return null;
    }
  }

  async function listOwnerSlots(ownerId, ownerEmail) {
    try {
      const slots = await listSlots({ ownerId, ownerEmail, adminOnly: true });
      return slots || [];
    } catch (err) {
      console.warn("[Store] listOwnerSlots error:", err);
      return [];
    }
  }

  async function addSlot(slot) {
    const user = currentUserFromStorage();
    if (!user || user.role !== "owner") throw new Error("Login as an owner before adding a parking slot.");
    invalidateCache("slots");
    const backend = await getBackend();
    const existingSlots = listLocalSlots();
    const slotId = readableIdFrom(slot, "SL") || nextReadableId("SL", existingSlots);
    const record = makeSlot({
      ...slot,
      id: slotId,
      slotId,
      displayId: slotId,
      ownerId: user.userId || user.id,
      ownerEmail: user.email,
      owner: user.name,
      status: "pending",
      verificationStatus: "pending",
      availabilityStatus: "unavailable"
    });
    if (backend && backend.addSlot) {
      try {
        await backend.addSlot(record);
      } catch (err) {
        console.warn("[Store] Cloud addSlot write failed, saving locally:", err.message);
      }
    }
    return upsertLocal(STORAGE.slots, seedSlots(), record);
  }

  async function updateSlot(slotId, changes) {
    invalidateCache("slots");
    const backend = await getBackend();
    if (backend && backend.updateSlot) {
      try {
        await backend.updateSlot(slotId, changes || {});
      } catch (err) {
        console.warn("[Store] Cloud updateSlot failed:", err.message);
      }
    }
    const rows = listLocalSlots().map((slot) => {
      if (slot.id !== slotId && slot.slotId !== slotId) return slot;
      return makeSlot({ ...slot, ...(changes || {}) });
    });
    setCollection(STORAGE.slots, rows);
    return rows.find((slot) => slot.id === slotId || slot.slotId === slotId);
  }

  async function updateSlotStatus(slotId, status) {
    const normalized = normalizeStatus(status);
    const changes = {
      status: normalized,
      verificationStatus: normalized,
      availabilityStatus: normalized === "approved" ? "available" : "unavailable"
    };
    return updateSlot(slotId, changes);
  }

  async function deleteSlot(slotId) {
    invalidateCache("slots");
    const backend = await getBackend();
    if (backend && backend.deleteSlot) {
      try {
        await backend.deleteSlot(slotId);
      } catch (err) {
        console.warn("[Store] Cloud deleteSlot failed:", err.message);
      }
    }
    const rows = listLocalSlots().filter((slot) => slot.id !== slotId && slot.slotId !== slotId);
    setCollection(STORAGE.slots, rows);
    return true;
  }

  async function listBookings(options) {
    const settings = options || {};
    let allBookings = memoryCache.bookings;
    if (!allBookings || settings.forceRefresh) {
      const local = listLocalBookings();
      if (!settings.forceRefresh && local.length > 0) {
        allBookings = withDisplayIds(local.map(makeBooking), "BK");
        memoryCache.bookings = allBookings;
        // Background sync
        getBackend().then((backend) => {
          if (backend && backend.listBookings) {
            backend.listBookings().then((rows) => {
              if (rows && rows.length) {
                const cloudIds = new Set(rows.map((r) => String(r.id || r.bookingId || "")));
                local.forEach((l) => {
                  if (!cloudIds.has(String(l.id || l.bookingId || ""))) rows.push(l);
                });
                memoryCache.bookings = withDisplayIds(rows.map(makeBooking), "BK");
              }
            }).catch(() => {});
          }
        }).catch(() => {});
      } else {
        let rows = [];
        try {
          const backend = await Promise.race([getBackend(), wait(350)]);
          rows = backend && backend.listBookings ? await backend.listBookings() : [];
        } catch (err) {
          rows = [];
        }
        if (!rows || rows.length === 0) {
          rows = local;
        } else {
          const cloudIds = new Set(rows.map((r) => String(r.id || r.bookingId || "")));
          local.forEach((l) => {
            if (!cloudIds.has(String(l.id || l.bookingId || ""))) rows.push(l);
          });
        }
        allBookings = withDisplayIds(rows.map(makeBooking), "BK");
        memoryCache.bookings = allBookings;
      }
    }
    let rows = allBookings || [];
    if (settings.driverId) {
      rows = rows.filter((booking) => {
        const matchId = String(booking.driverId || "") === String(settings.driverId);
        const matchEmail = settings.driverEmail && booking.driverEmail && String(booking.driverEmail).toLowerCase() === String(settings.driverEmail).toLowerCase();
        return matchId || matchEmail;
      });
    }
    if (settings.ownerId) {
      rows = rows.filter((booking) => {
        const matchId = String(booking.ownerId || "") === String(settings.ownerId);
        const matchEmail = settings.ownerEmail && booking.ownerEmail && String(booking.ownerEmail).toLowerCase() === String(settings.ownerEmail).toLowerCase();
        return matchId || matchEmail;
      });
    }
    return rows;
  }

  async function saveBooking(booking) {
    invalidateCache("bookings");
    const backend = await getBackend();
    const rows = listLocalBookings();
    const bookingId = readableIdFrom(booking, "BK") || nextReadableId("BK", rows);
    const record = makeBooking({ ...booking, id: bookingId, bookingId, displayId: bookingId });
    if (backend && backend.saveBooking) {
      try {
        await backend.saveBooking(record);
      } catch (err) {
        console.warn("[Store] Cloud saveBooking failed, saving locally:", err.message);
      }
    }
    return upsertLocal(STORAGE.bookings, seedBookings(), record);
  }

  async function updateBookingStatus(bookingId, status) {
    invalidateCache("bookings");
    const normalized = normalizeStatus(status);
    const backend = await getBackend();
    if (backend && backend.updateBookingStatus) {
      try {
        await backend.updateBookingStatus(bookingId, normalized);
      } catch (err) {
        console.warn("[Store] Cloud updateBookingStatus failed:", err.message);
      }
    }
    const rows = listLocalBookings().map((booking) => (booking.id === bookingId || booking.bookingId === bookingId ? { ...booking, status: normalized } : booking));
    setCollection(STORAGE.bookings, rows);
    return rows.find((booking) => booking.id === bookingId || booking.bookingId === bookingId);
  }

  async function listPayments(forceRefresh = false) {
    if (!forceRefresh && memoryCache.payments && memoryCache.payments.length) return memoryCache.payments;
    const local = listLocalPayments();
    if (!forceRefresh && local.length > 0) {
      memoryCache.payments = withDisplayIds(local.map(makePayment), "PAY");
      getBackend().then((backend) => {
        if (backend && backend.listPayments) {
          backend.listPayments().then((rows) => {
            if (rows && rows.length) {
              const cloudIds = new Set(rows.map((p) => String(p.id || p.paymentId || "")));
              local.forEach((l) => {
                if (!cloudIds.has(String(l.id || l.paymentId || ""))) rows.push(l);
              });
              memoryCache.payments = withDisplayIds(rows.map(makePayment), "PAY");
            }
          }).catch(() => {});
        }
      }).catch(() => {});
      return memoryCache.payments;
    }
    let rows = [];
    try {
      const backend = await Promise.race([getBackend(), wait(350)]);
      rows = backend && backend.listPayments ? await backend.listPayments() : [];
    } catch (err) {
      rows = [];
    }
    if (!rows || rows.length === 0) {
      rows = local;
    } else {
      const cloudIds = new Set(rows.map((p) => String(p.id || p.paymentId || "")));
      local.forEach((l) => {
        if (!cloudIds.has(String(l.id || l.paymentId || ""))) rows.push(l);
      });
    }
    const result = withDisplayIds(rows.map(makePayment), "PAY");
    memoryCache.payments = result;
    return result;
  }

  // Internal simulated payment conforming to UML Payment specifications
  async function savePayment(payment) {
    invalidateCache("payments");
    invalidateCache("bookings");
    const backend = await getBackend();
    const rows = backend && backend.listPayments ? await backend.listPayments() : listLocalPayments();
    const paymentId = readableIdFrom(payment, "PAY") || nextReadableId("PAY", rows);
    const paymentDate = payment.paymentDate || payment.paidAt || new Date().toISOString();
    const record = makePayment({
      ...payment,
      id: paymentId,
      paymentId,
      displayId: paymentId,
      paymentStatus: "paid",
      status: "paid",
      paymentDate,
      paidAt: paymentDate
    });
    if (backend && backend.savePayment) return backend.savePayment(record);
    return upsertLocal(STORAGE.payments, seedPayments(), record);
  }

  async function getReports() {
    const [users, slots, bookings, payments] = await Promise.all([
      listUsers(),
      listSlots({ adminOnly: true }),
      listBookings(),
      listPayments()
    ]);
    const paidPayments = payments.filter(isPaidRecord);
    const paidBookings = bookings.filter(isPaidRecord);
    const revenue = paidPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0)
      || paidBookings.reduce((total, booking) => total + Number(booking.amount || 0), 0);
    return {
      users: users.length,
      slots: slots.length,
      bookings: bookings.length,
      revenue
    };
  }

  async function uploadFile(folder, file) {
    const backend = await getBackend();
    if (backend && backend.uploadFile) {
      return backend.uploadFile(folder, file);
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function findUserRoleByEmail(email) {
    if (!email) return "";
    const normalized = normalizeText(email);

    // 1. Check known roles (0ms instant)
    const known = knownRoleForEmail(normalized);
    if (known) return known;

    // 2. Check local storage / seeded users first (sub-millisecond instant)
    const localUsers = listLocalUsers();
    const localFound = localUsers.find((u) => normalizeText(u.email) === normalized);
    if (localFound && localFound.role) {
      return normalizeText(localFound.role);
    }

    // 3. Check Backend Express API (sub-millisecond HTTP)
    try {
      const resp = await fetch(`/api/auth/lookup?email=${encodeURIComponent(normalized)}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.found && data.role) return normalizeText(data.role);
      }
    } catch (e) {}

    // 4. Check Firebase if already connected without long blocking
    if (global.ParkrBackend && global.ParkrBackend.findUserByEmail) {
      try {
        const fbUser = await global.ParkrBackend.findUserByEmail(normalized);
        if (fbUser && fbUser.role) return normalizeText(fbUser.role);
      } catch (e) {}
    }

    return "";
  }

  global.ParkrStore = {
    getCurrentUser: currentUserFromStorage,
    setCurrentUser,
    updateCurrentUser,
    registerUser,
    loginUser,
    logoutUser,
    findUserRoleByEmail,
    listUsers,
    updateUserStatus,
    deleteUser,
    purgeTestUsers,
    listSlots,
    searchSlots,
    getSlot,
    listOwnerSlots,
    addSlot,
    updateSlot,
    updateSlotStatus,
    deleteSlot,
    listBookings,
    saveBooking,
    updateBookingStatus,
    listPayments,
    savePayment,
    uploadFile,
    getReports,
    invalidateCache
  };

  migrateStoredData();
})(window);
