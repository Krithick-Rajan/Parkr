(function (global) {
  const STORAGE = {
    users: "parkrUsers",
    slots: "parkrSlots",
    bookings: "parkrBookings",
    payments: "parkrPayments",
    reviews: "parkrReviews",
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

  async function apiJson(url, options) {
    const response = await fetch(url, {
      ...(options || {}),
      headers: {
        "Content-Type": "application/json",
        ...((options && options.headers) || {})
      }
    });
    if (!response.ok) {
      throw new Error(`API ${response.status} for ${url}`);
    }
    return response.json();
  }

  function mergeById(...groups) {
    const rows = [];
    const seen = new Set();
    groups.flat().forEach((row) => {
      if (!row) return;
      const key = String(idOf(row) || "");
      if (!key || seen.has(key)) return;
      seen.add(key);
      rows.push(row);
    });
    return rows;
  }

  async function listApiRows(url) {
    try {
      const rows = await apiJson(url);
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      return [];
    }
  }

  function waitForBackendReady() {
    if (global.ParkrBackend && global.ParkrBackend.isConfigured) {
      return Promise.resolve(global.ParkrBackend);
    }
    if (global.ParkrBackendReady) {
      return Promise.race([global.ParkrBackendReady, wait(1500).then(() => global.ParkrBackend || null)]);
    }
    return new Promise((resolve) => {
      const done = (backend) => {
        global.removeEventListener("parkr-backend-ready", listener);
        resolve(backend || global.ParkrBackend || null);
      };
      const listener = (event) => done(event.detail);
      global.addEventListener("parkr-backend-ready", listener, { once: true });
      wait(1500).then(() => done(global.ParkrBackend || null));
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

  const TEST_USER_EMAILS = new Set([]);

  function isTestUser(row) {
    if (!row) return false;
    const email = normalizeText(row.email);
    const userId = String(row.userId || row.id || row.displayId || "");
    return email.endsWith(DEMO_EMAIL_SUFFIX) || DEMO_USER_IDS.has(userId);
  }

  // Immediate purge on script load
  try {
    const rawStored = JSON.parse(localStorage.getItem(STORAGE.users) || "[]");
    if (Array.isArray(rawStored)) {
      const cleanStored = rawStored.filter((u) => !isTestUser(u));
      localStorage.setItem(STORAGE.users, JSON.stringify(cleanStored));
    }
    const current = JSON.parse(localStorage.getItem("parkrUser") || "null");
    if (current && isTestUser(current)) {
      localStorage.removeItem("parkrUser");
    }
  } catch (_) {}

  function knownRoleForEmail(email) {
    const text = normalizeText(email);
    if (!text) return "";
    if (text.includes("admin")) return "admin";
    if (text.includes("owner") || text === "sri@parkr.com") return "owner";
    if (text.includes("driver") || text === "reshmi@parkr.com") return "driver";
    return "";
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

  function normalizeSlotRecord(data) {
    return makeSlot(data);
  }

  function normalizeBookingRecord(data) {
    return makeBooking(data);
  }

  function normalizePaymentRecord(data) {
    return makePayment(data);
  }

  function migrateStoredData() {
    try {
      const users = readStored(STORAGE.users).filter((user) => !isTestUser(user));
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
      if (currentUser && isTestUser(currentUser)) {
        localStorage.removeItem("parkrUser");
      }

      localStorage.setItem(STORAGE.dataVersion, DATA_VERSION);
    } catch (error) {
      localStorage.setItem(STORAGE.dataVersion, DATA_VERSION);
    }
  }

  function seedUsers() {
    return [
      {
        id: "USR-001",
        userId: "USR-001",
        displayId: "USR-001",
        name: "Platform Admin",
        email: "admin@parkr.com",
        phone: "+91 98765 00001",
        role: "admin",
        status: "approved"
      },
      {
        id: "USR-002",
        userId: "USR-002",
        displayId: "USR-002",
        name: "Sri",
        email: "sri@parkr.com",
        phone: "+91 98765 00002",
        role: "owner",
        status: "approved",
        business: "Sri Parking Hub"
      },
      {
        id: "USR-003",
        userId: "USR-003",
        displayId: "USR-003",
        name: "Reshmi",
        email: "reshmi@parkr.com",
        phone: "+91 98765 00003",
        role: "driver",
        status: "approved",
        vehicle: "KA 01 AB 1234"
      }
    ];
  }

  function seedSlots() {
    return [
      {
        id: "SL-001",
        slotId: "SL-001",
        displayId: "SL-001",
        name: "MG Road Metro Parking",
        location: "MG Road, Bengaluru",
        address: "12/4 MG Road, near Metro Station, Bengaluru",
        lat: 12.9756,
        lng: 77.6067,
        price: 50,
        pricePerHour: 50,
        vehicle: "Car",
        vehicleType: "Car",
        total: 25,
        totalSlots: 25,
        available: 25,
        availableSlots: 25,
        status: "approved",
        verificationStatus: "approved",
        availabilityStatus: "available",
        rating: 4.8,
        open: "06:00",
        close: "23:00",
        ownerId: "USR-002",
        owner: "Sri",
        ownerEmail: "sri@parkr.com",
        features: ["CCTV", "Covered", "Security Guard", "EV Charging"]
      },
      {
        id: "SL-002",
        slotId: "SL-002",
        displayId: "SL-002",
        name: "Indiranagar 100ft Space",
        location: "100 Feet Rd, Indiranagar, Bengaluru",
        address: "454 100 Feet Rd, Indiranagar, Bengaluru",
        lat: 12.9784,
        lng: 77.6408,
        price: 35,
        pricePerHour: 35,
        vehicle: "Bike",
        vehicleType: "Bike",
        total: 40,
        totalSlots: 40,
        available: 40,
        availableSlots: 40,
        status: "approved",
        verificationStatus: "approved",
        availabilityStatus: "available",
        rating: 4.6,
        open: "07:00",
        close: "22:00",
        ownerId: "USR-002",
        owner: "Sri",
        ownerEmail: "sri@parkr.com",
        features: ["CCTV", "Well Lit", "Easy Exit"]
      },
      {
        id: "SL-003",
        slotId: "SL-003",
        displayId: "SL-003",
        name: "Koramangala 5th Block Hub",
        location: "5th Block, Koramangala, Bengaluru",
        address: "18 80 Feet Road, 5th Block Koramangala, Bengaluru",
        lat: 12.9352,
        lng: 77.6245,
        price: 60,
        pricePerHour: 60,
        vehicle: "Car",
        vehicleType: "Car",
        total: 20,
        totalSlots: 20,
        available: 20,
        availableSlots: 20,
        status: "approved",
        verificationStatus: "approved",
        availabilityStatus: "available",
        rating: 4.9,
        open: "08:00",
        close: "23:59",
        ownerId: "USR-002",
        owner: "Sri",
        ownerEmail: "sri@parkr.com",
        features: ["Valet Assistance", "Covered", "CCTV", "24/7 Access"]
      },
      {
        id: "SL-005",
        slotId: "SL-005",
        displayId: "SL-005",
        name: "Sridevi Parking",
        location: "Sridevi Nagar, Coimbatore.",
        address: "Sridevi Nagar, Coimbatore.",
        lat: 11.0168,
        lng: 76.9558,
        price: 50,
        pricePerHour: 50,
        vehicle: "Any Vehicle",
        vehicleType: "Any Vehicle",
        total: 30,
        totalSlots: 30,
        available: 30,
        availableSlots: 30,
        status: "approved",
        verificationStatus: "approved",
        availabilityStatus: "available",
        rating: 4.5,
        open: "06:00",
        close: "00:00",
        ownerId: "USR-002",
        owner: "Sri",
        ownerEmail: "sri@parkr.com",
        features: ["CCTV", "24/7 Security"]
      },
      {
        id: "SL-006",
        slotId: "SL-006",
        displayId: "SL-006",
        name: "Codissia Parking",
        location: "Coddissia Ground, Coimbatore.",
        address: "Coddissia Ground, Coimbatore.",
        lat: 11.0378,
        lng: 77.0326,
        price: 50,
        pricePerHour: 50,
        vehicle: "Any Vehicle",
        vehicleType: "Any Vehicle",
        total: 80,
        totalSlots: 80,
        available: 79,
        availableSlots: 79,
        status: "approved",
        verificationStatus: "approved",
        availabilityStatus: "available",
        rating: 4.5,
        open: "06:00",
        close: "00:00",
        ownerId: "USR-002",
        owner: "Sri",
        ownerEmail: "sri@parkr.com",
        features: ["CCTV", "Well Lit", "Gated Security"]
      }
    ];
  }

  function seedBookings() {
    return [];
  }

  function seedPayments() {
    return [];
  }

  function seedReviews() {
    return [
      {
        id: "REV-001",
        reviewId: "REV-001",
        slotId: "SL-006",
        slotName: "Codissia Parking",
        driverId: "USR-003",
        driverName: "Reshmi",
        rating: 5,
        comment: "Spacious and very secure parking. Gate staff guided promptly.",
        createdAt: "2026-09-23T08:30:00.000Z"
      },
      {
        id: "REV-002",
        reviewId: "REV-002",
        slotId: "SL-001",
        slotName: "MG Road Metro Parking",
        driverId: "USR-004",
        driverName: "Giri",
        rating: 4,
        comment: "Convenient spot near the metro station. Easy access during peak hours.",
        createdAt: "2026-09-23T09:15:00.000Z"
      },
      {
        id: "REV-003",
        reviewId: "REV-003",
        slotId: "SL-002",
        slotName: "Indiranagar 100ft Space",
        driverId: "USR-003",
        driverName: "Reshmi",
        rating: 5,
        comment: "Wide entrance and shaded parking. Very satisfied with the service!",
        createdAt: "2026-09-23T09:45:00.000Z"
      }
    ];
  }

  function listLocalUsers() {
    return readStored(STORAGE.users).filter((u) => !isTestUser(u)).map(makeUser);
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

  function listLocalReviews() {
    return getCollection(STORAGE.reviews, seedReviews());
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
      const updated = makeUser({ ...existing, ...record, localPassword: String(password || "") });
      upsertLocal(STORAGE.users, seedUsers(), updated);
      setCurrentUser(updated);
      fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updated, password })
      }).catch(() => {});
      return updated;
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
      body: JSON.stringify({ ...record, password })
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
    const users = listLocalUsers();
    let existing = users.find((user) => normalizeText(user.email) === normalizeText(email));
    const targetRole = existing && existing.role ? existing.role : (knownRole || role || "driver");

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

    if (existing.localPassword && password && String(password || "") !== String(existing.localPassword)) {
      throw new Error("Incorrect password. Please try again.");
    }
    if (!existing.localPassword && password) {
      existing.localPassword = String(password);
      upsertLocal(STORAGE.users, seedUsers(), existing);
    }
    const user = makeUser({ ...existing, role: existing.role || targetRole });
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
      const authenticated = await loginLocalUser(email, password, existing.role || targetRole);
      // Background sync with cloud auth
      const syncCloud = async () => {
        try {
          const backend = global.ParkrBackend || (await Promise.race([getBackend(), wait(500)]));
          if (backend && backend.loginUser) await backend.loginUser(email, password, existing.role || targetRole);
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
      } else if (resp.status === 401) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Incorrect password. Please try again.");
      }
    } catch (e) {
      if (e.message && e.message.includes("Incorrect password")) throw e;
    }

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

    const local = listLocalUsers().filter((u) => !isTestUser(u));
    const [cloudRows, apiRows] = await Promise.all([
      (async () => {
        try {
          const backend = await Promise.race([getBackend(), wait(1200)]);
          return backend && backend.isConfigured && backend.listUsers ? await backend.listUsers() : [];
        } catch (err) {
          return [];
        }
      })(),
      listApiRows("/api/auth/users")
    ]);

    const cleanCloud = (cloudRows || []).filter((u) => !isTestUser(u));
    const cleanApi = (apiRows || []).filter((u) => !isTestUser(u));

    const rows = mergeById(cleanCloud, cleanApi, local);
    const result = withDisplayIds(rows.map(makeUser), "USR");
    memoryCache.users = result;

    if (cleanApi.length || cleanCloud.length) {
      setCollection(STORAGE.users, rows.map(makeUser));
    }
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
    if (!userId) return true;
    const target = String(userId).trim().toLowerCase();

    // 1. Delete from Cloud Firestore
    const backend = await getBackend();
    if (backend && backend.deleteUser) {
      try {
        await backend.deleteUser(userId);
      } catch (err) {
        console.warn("[Store] Cloud deleteUser failed:", err);
      }
    }

    // 2. Also delete from Express API
    fetch(`/api/auth/users/${encodeURIComponent(userId)}`, { method: "DELETE" }).catch(() => {});

    // 3. Delete from LocalStorage
    const rows = readStored(STORAGE.users).filter((user) => {
      if (!user) return false;
      const uEmail = normalizeText(user.email);
      const uId = normalizeText(user.id);
      const uUserId = normalizeText(user.userId);
      const uDisplayId = normalizeText(user.displayId);
      return uEmail !== target && uId !== target && uUserId !== target && uDisplayId !== target;
    });
    setCollection(STORAGE.users, rows);

    // 4. Clear current session if self
    const current = currentUserFromStorage();
    if (current) {
      const cEmail = normalizeText(current.email);
      const cId = normalizeText(current.id || current.userId);
      if (cEmail === target || cId === target) {
        localStorage.removeItem("parkrUser");
      }
    }
    return true;
  }

  async function purgeTestUsers() {
    invalidateCache("users");

    const backend = await getBackend();
    if (backend && backend.isConfigured && backend.deleteUser) {
      if (backend.listUsers) {
        try {
          const cloudUsers = await backend.listUsers();
          if (Array.isArray(cloudUsers)) {
            for (const u of cloudUsers) {
              if (isTestUser(u)) {
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
      for (const email of TEST_USER_EMAILS) {
        try {
          await backend.deleteUser(email);
        } catch (e) {}
      }
    }

    for (const email of TEST_USER_EMAILS) {
      fetch(`/api/auth/users/${encodeURIComponent(email)}`, { method: "DELETE" }).catch(() => {});
    }

    const remaining = readStored(STORAGE.users).filter((u) => !isTestUser(u));
    setCollection(STORAGE.users, remaining);
    return true;
  }

  async function listSlots(options) {
    const settings = options || {};
    let allSlots = memoryCache.slots;
    if (!allSlots || settings.forceRefresh) {
      const local = listLocalSlots();
      const [cloudRows, apiRows] = await Promise.all([
        (async () => {
          try {
            const backend = await Promise.race([getBackend(), wait(1200)]);
            return backend && backend.listSlots ? await backend.listSlots({ adminOnly: true }) : [];
          } catch (err) {
            return [];
          }
        })(),
        listApiRows("/api/slots?adminOnly=true")
      ]);

      const rows = mergeById(cloudRows, apiRows, local);
      allSlots = withDisplayIds(rows.map(makeSlot), "SL");
      memoryCache.slots = allSlots;

      if (apiRows.length) {
        setCollection(STORAGE.slots, rows.map(makeSlot));
      }
    }

    return (allSlots || []).filter((slot) => {
      if (settings.ownerId || settings.ownerEmail || settings.ownerName) {
        const normOwnerId = normalizeText(settings.ownerId);
        const normOwnerEmail = normalizeText(settings.ownerEmail);
        const normOwnerName = normalizeText(settings.ownerName);
        const slotOwnerId = normalizeText(slot.ownerId);
        const slotOwnerEmail = normalizeText(slot.ownerEmail);
        const slotOwnerName = normalizeText(slot.owner);

        const matchId = normOwnerId && (slotOwnerId === normOwnerId || slotOwnerId.includes(normOwnerId) || normOwnerId.includes(slotOwnerId));
        const matchEmail = normOwnerEmail && (slotOwnerEmail === normOwnerEmail);
        const matchName = normOwnerName && (slotOwnerName === normOwnerName);
        const isUnassigned = !slotOwnerId || slotOwnerId === "public" || slotOwnerId === "usr-owner" || slotOwnerName === "public parking authority";
        const isDefaultPlatformOwner = (slotOwnerId === "usr-002" || slotOwnerEmail === "sri@parkr.com");

        if (!matchId && !matchEmail && !matchName && !isUnassigned && !isDefaultPlatformOwner) return false;
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
      const isAnyVehicle = !vehicle || vehicle === "any" || vehicle === "any vehicle" || vehicle === "all";
      const isAnyPrice = !settings.maxPrice || isNaN(Number(settings.maxPrice)) || Number(settings.maxPrice) >= 9999;
      const effectiveMaxPrice = isAnyPrice ? Infinity : Number(settings.maxPrice);

      return (rows || []).filter((slot) => {
        const haystack = normalizeText((slot.name || "") + " " + (slot.address || "") + " " + (slot.location || "") + " " + (slot.area || ""));
        const matchesLocation = !location || haystack.includes(location);
        const slotVehicle = normalizeText(slot.vehicleType || slot.vehicle);
        const isSlotUniversal = !slotVehicle || slotVehicle === "any vehicle" || slotVehicle === "any" || slotVehicle === "all" || slotVehicle.includes("any") || slotVehicle.includes("both");
        const matchesVehicle = isAnyVehicle || isSlotUniversal || slotVehicle === vehicle;
        const matchesPrice = Number(slot.price || 0) <= effectiveMaxPrice;
        return matchesLocation && matchesVehicle && matchesPrice;
      });
    } catch (err) {
      console.warn("[Store] searchSlots error:", err);
      return [];
    }
  }

  async function getSlot(slotId) {
    if (!slotId) return null;
    const norm = String(slotId).trim().toLowerCase();
    try {
      const all = await listSlots({ adminOnly: true });
      return (all || []).find((slot) => {
        const sId = String(slot.id || "").toLowerCase();
        const sSlotId = String(slot.slotId || "").toLowerCase();
        const sDisplayId = String(slot.displayId || "").toLowerCase();
        return sId === norm || sSlotId === norm || sDisplayId === norm;
      }) || null;
    } catch (err) {
      console.warn("[Store] getSlot error:", err);
      return null;
    }
  }

  async function listOwnerSlots(ownerId, ownerEmail, options = {}) {
    try {
      const user = currentUserFromStorage() || (global.Parkr && global.Parkr.getUser ? global.Parkr.getUser() : null);
      const ownerName = (user && user.name) || "";
      const forceRefresh = options.forceRefresh !== false;

      let slots = await listSlots({
        ownerId,
        ownerEmail,
        ownerName,
        adminOnly: true,
        forceRefresh
      });

      if (!slots || !slots.length) {
        // Fallback: If filtered by specific ownerId/email and got 0 slots, fetch all admin slots with fresh data
        const all = await listSlots({ adminOnly: true, forceRefresh: true });
        const normId = normalizeText(ownerId);
        const normEmail = normalizeText(ownerEmail);
        const filtered = (all || []).filter((s) => {
          const sId = normalizeText(s.ownerId);
          const sEmail = normalizeText(s.ownerEmail);
          const sOwner = normalizeText(s.owner);
          return (
            (normId && (sId === normId || sId.includes(normId) || normId.includes(sId))) ||
            (normEmail && sEmail === normEmail) ||
            sId === "usr-002" ||
            sEmail === "sri@parkr.com" ||
            sOwner === "sri" ||
            !sId ||
            sId === "public"
          );
        });
        slots = filtered.length ? filtered : all;
      }

      return slots || [];
    } catch (err) {
      console.warn("[Store] listOwnerSlots error:", err);
      return [];
    }
  }

  async function addSlot(slot) {
    let user = currentUserFromStorage();
    if (!user && global.Parkr && global.Parkr.getUser) user = global.Parkr.getUser();
    if (!user) {
      try { user = JSON.parse(localStorage.getItem("parkrUser") || "null"); } catch (e) {}
    }
    if (!user) throw new Error("Please login as an owner before adding a parking slot.");
    const role = normalizeText(user.role);
    if (role !== "owner" && role !== "admin") {
      throw new Error("Your account (" + role + ") is not authorized to create parking slots. Please login as an owner.");
    }

    invalidateCache("slots");
    const backend = await getBackend();
    const existingSlots = listLocalSlots();
    const slotId = readableIdFrom(slot, "SL") || nextReadableId("SL", existingSlots);
    const ownerId = slot.ownerId || user.userId || user.id || user.uid || (user.email ? "USR-" + user.email.split("@")[0] : "USR-002");
    const ownerEmail = slot.ownerEmail || user.email || "sri@parkr.com";
    const ownerName = slot.owner || user.name || "Owner";

    const lat = (slot.lat !== undefined && slot.lat !== null && !isNaN(Number(slot.lat)))
      ? Number(slot.lat)
      : 12.9716;
    const lng = (slot.lng !== undefined && slot.lng !== null && !isNaN(Number(slot.lng)))
      ? Number(slot.lng)
      : 77.5946;

    const record = makeSlot({
      ...slot,
      id: slotId,
      slotId,
      displayId: slotId,
      lat,
      lng,
      ownerId,
      ownerEmail,
      owner: ownerName,
      imageUrl: slot.imageUrl || "",
      status: "pending",
      verificationStatus: "pending",
      availabilityStatus: "unavailable"
    });

    let saved = record;
    if (backend && backend.addSlot) {
      try {
        saved = await Promise.race([backend.addSlot(record), wait(2500)]) || saved;
      } catch (err) {
        console.warn("[Store] Cloud addSlot write failed, saving locally:", err.message);
      }
    }
    try {
      const apiResp = await apiJson("/api/slots", {
        method: "POST",
        body: JSON.stringify(saved)
      });
      if (apiResp && (apiResp.id || apiResp.slotId)) {
        saved = makeSlot(apiResp);
      }
    } catch (err) {
      console.warn("[Store] API POST /api/slots error:", err.message);
    }
    return upsertLocal(STORAGE.slots, seedSlots(), makeSlot(saved));
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
    try {
      await apiJson(`/api/slots/${encodeURIComponent(slotId)}`, {
        method: "PUT",
        body: JSON.stringify(changes || {})
      });
    } catch (err) {}
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
    invalidateCache("slots");
    const backend = await getBackend();
    if (backend && backend.updateSlotStatus) {
      try {
        await backend.updateSlotStatus(slotId, normalized);
      } catch (err) {
        console.warn("[Store] Cloud updateSlotStatus failed:", err.message);
      }
    }
    try {
      await apiJson(`/api/slots/${encodeURIComponent(slotId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: normalized })
      });
    } catch (err) {}
    const rows = listLocalSlots().map((slot) => {
      if (slot.id !== slotId && slot.slotId !== slotId) return slot;
      return makeSlot({ ...slot, ...changes });
    });
    setCollection(STORAGE.slots, rows);
    return rows.find((slot) => slot.id === slotId || slot.slotId === slotId);
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
    try {
      await apiJson(`/api/slots/${encodeURIComponent(slotId)}`, { method: "DELETE" });
    } catch (err) {}
    const rows = listLocalSlots().filter((slot) => slot.id !== slotId && slot.slotId !== slotId);
    setCollection(STORAGE.slots, rows);
    return true;
  }

  async function listBookings(options) {
    const settings = options || {};
    let allBookings = memoryCache.bookings;
    if (!allBookings || settings.forceRefresh) {
      const local = listLocalBookings();
      const [cloudRows, apiRows] = await Promise.all([
        (async () => {
          try {
            const backend = await Promise.race([getBackend(), wait(1200)]);
            return backend && backend.listBookings ? await backend.listBookings() : [];
          } catch (err) {
            return [];
          }
        })(),
        listApiRows("/api/bookings")
      ]);
      const rows = mergeById(cloudRows, apiRows, local);
      allBookings = withDisplayIds(rows.map(makeBooking), "BK");
      memoryCache.bookings = allBookings;
      if (apiRows.length) {
        setCollection(STORAGE.bookings, rows.map(makeBooking));
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
    if (settings.ownerId || settings.ownerEmail) {
      rows = rows.filter((booking) => {
        const matchId = settings.ownerId && String(booking.ownerId || "") === String(settings.ownerId);
        const matchEmail = settings.ownerEmail && booking.ownerEmail && String(booking.ownerEmail).toLowerCase() === String(settings.ownerEmail).toLowerCase();
        const isUnassigned = !booking.ownerId;
        return matchId || matchEmail || isUnassigned;
      });
    }
    return rows;
  }

  async function saveBooking(booking) {
    invalidateCache("bookings");
    const backend = await getBackend();
    const rows = listLocalBookings();
    const existingId = booking.id || booking.bookingId || "";
    const existing = existingId ? rows.find((row) => row.id === existingId || row.bookingId === existingId) : null;
    const bookingId = readableIdFrom(booking, "BK") || nextReadableId("BK", rows);
    let record = makeBooking({ ...booking, id: existingId || bookingId, bookingId: existingId || bookingId, displayId: existingId || bookingId });
    if (backend && backend.saveBooking) {
      try {
        await backend.saveBooking(record);
      } catch (err) {
        console.warn("[Store] Cloud saveBooking failed, saving locally:", err.message);
      }
    }
    if (!existing) {
      try {
        record = makeBooking(await apiJson("/api/bookings", {
          method: "POST",
          body: JSON.stringify(record)
        }));
      } catch (err) {}
    }
    return upsertLocal(STORAGE.bookings, seedBookings(), record);
  }

  async function updateBookingStatus(bookingId, status) {
    invalidateCache("bookings");
    invalidateCache("payments");
    const normalized = normalizeStatus(status);
    const backend = await getBackend();
    if (backend && backend.updateBookingStatus) {
      try {
        await backend.updateBookingStatus(bookingId, normalized);
      } catch (err) {
        console.warn("[Store] Cloud updateBookingStatus failed:", err.message);
      }
    }
    try {
      await apiJson(`/api/bookings/${encodeURIComponent(bookingId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: normalized })
      });
    } catch (err) {}
    const rows = listLocalBookings().map((booking) => (booking.id === bookingId || booking.bookingId === bookingId ? { ...booking, status: normalized } : booking));
    setCollection(STORAGE.bookings, rows);

    if (normalized === "cancelled") {
      const payments = listLocalPayments().map((p) => {
        if (p.bookingId === bookingId) {
          return { ...p, status: "refunded", paymentStatus: "refunded" };
        }
        return p;
      });
      setCollection(STORAGE.payments, payments);
    }

    return rows.find((booking) => booking.id === bookingId || booking.bookingId === bookingId);
  }

  async function deleteBooking(bookingId) {
    invalidateCache("bookings");
    invalidateCache("payments");
    const backend = await getBackend();
    if (backend && backend.deleteBooking) {
      try {
        await backend.deleteBooking(bookingId);
      } catch (err) {
        console.warn("[Store] Cloud deleteBooking failed:", err.message);
      }
    }
    try {
      await apiJson(`/api/bookings/${encodeURIComponent(bookingId)}`, { method: "DELETE" });
    } catch (err) {}
    const rows = listLocalBookings().filter((booking) => booking.id !== bookingId && booking.bookingId !== bookingId && booking.displayId !== bookingId);
    setCollection(STORAGE.bookings, rows);
    const payments = listLocalPayments().filter((p) => p.bookingId !== bookingId);
    setCollection(STORAGE.payments, payments);
    return true;
  }

  async function clearCancelledBookings() {
    invalidateCache("bookings");
    const backend = await getBackend();
    const rows = listLocalBookings();
    const cancelled = rows.filter((booking) => booking.status === "cancelled");
    for (const booking of cancelled) {
      const id = booking.id || booking.bookingId;
      if (backend && backend.deleteBooking) {
        try { await backend.deleteBooking(id); } catch (e) {}
      }
      try {
        await apiJson(`/api/bookings/${encodeURIComponent(id)}`, { method: "DELETE" });
      } catch (e) {}
    }
    try {
      await apiJson("/api/bookings/clear/cancelled", { method: "DELETE" });
    } catch (e) {}
    const remaining = rows.filter((booking) => booking.status !== "cancelled");
    setCollection(STORAGE.bookings, remaining);
    return true;
  }

  async function listPayments(forceRefresh = false) {
    if (!forceRefresh && memoryCache.payments && memoryCache.payments.length) return memoryCache.payments;
    const local = listLocalPayments();
    const [cloudRows, apiRows] = await Promise.all([
      (async () => {
        try {
          const backend = await Promise.race([getBackend(), wait(1200)]);
          return backend && backend.listPayments ? await backend.listPayments() : [];
        } catch (err) {
          return [];
        }
      })(),
      listApiRows("/api/payments")
    ]);
    const rows = mergeById(cloudRows, apiRows, local);
    const result = withDisplayIds(rows.map(makePayment), "PAY");
    memoryCache.payments = result;
    if (apiRows.length) {
      setCollection(STORAGE.payments, rows.map(makePayment));
    }
    return result;
  }

  // Internal simulated payment conforming to UML Payment specifications
  async function savePayment(payment) {
    invalidateCache("payments");
    invalidateCache("bookings");
    const backend = await getBackend();
    const rows = listLocalPayments();
    const paymentId = readableIdFrom(payment, "PAY") || nextReadableId("PAY", rows);
    const paymentDate = payment.paymentDate || payment.paidAt || new Date().toISOString();
    let record = makePayment({
      ...payment,
      id: paymentId,
      paymentId,
      displayId: paymentId,
      paymentStatus: "paid",
      status: "paid",
      paymentDate,
      paidAt: paymentDate
    });
    if (backend && backend.savePayment) {
      try {
        await backend.savePayment(record);
      } catch (err) {
        console.warn("[Store] Cloud savePayment failed, saving locally:", err.message);
      }
    }
    try {
      const result = await apiJson("/api/payments/verify", {
        method: "POST",
        body: JSON.stringify(record)
      });
      if (result && result.payment) record = makePayment(result.payment);
    } catch (err) {}
    return upsertLocal(STORAGE.payments, seedPayments(), record);
  }

  async function listReviews(slotId) {
    let apiReviews = [];
    try {
      if (slotId) {
        apiReviews = await listApiRows(`/api/slots/${encodeURIComponent(slotId)}/reviews`);
      }
    } catch (e) {}
    const local = listLocalReviews();
    const rows = mergeById(apiReviews, local);
    if (slotId) {
      return rows.filter((r) => r.slotId === slotId);
    }
    return rows;
  }

  async function saveReview(review) {
    const local = listLocalReviews();
    const reviewId = readableIdFrom(review, "REV") || nextReadableId("REV", local);
    const record = {
      ...review,
      id: reviewId,
      reviewId,
      rating: Number(review.rating) || 5,
      createdAt: review.createdAt || new Date().toISOString()
    };
    try {
      const resp = await apiJson(`/api/slots/${encodeURIComponent(record.slotId)}/reviews`, {
        method: "POST",
        body: JSON.stringify(record)
      });
      if (resp && resp.review) {
        Object.assign(record, resp.review);
      }
    } catch (e) {
      console.warn("[Store] API saveReview failed, saving locally:", e.message);
    }
    upsertLocal(STORAGE.reviews, seedReviews(), record);
    
    // Recalculate local slot rating if slot exists locally
    const slotReviews = listLocalReviews().filter((r) => r.slotId === record.slotId);
    if (slotReviews.length) {
      const sum = slotReviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
      const avg = Number((sum / slotReviews.length).toFixed(1));
      const slots = listLocalSlots();
      const targetSlot = slots.find((s) => s.id === record.slotId || s.slotId === record.slotId);
      if (targetSlot) {
        targetSlot.rating = avg;
        targetSlot.reviewsCount = slotReviews.length;
        setCollection(STORAGE.slots, slots);
      }
    }
    invalidateCache("slots");
    return record;
  }

  async function getReports() {
    const [users, slots, bookings] = await Promise.all([
      listUsers(),
      listSlots({ adminOnly: true }),
      listBookings()
    ]);
    const paidBookings = bookings.filter((b) => {
      const s = normalizeStatus((b || {}).status || (b || {}).paymentStatus);
      return ["paid", "confirmed", "completed"].includes(s);
    });
    const revenue = paidBookings.reduce((total, booking) => total + Number(booking.amount || 0), 0);
    return {
      users: users.length,
      slots: slots.length,
      bookings: paidBookings.length,
      totalBookings: bookings.length,
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
    deleteBooking,
    clearCancelledBookings,
    listPayments,
    savePayment,
    listReviews,
    saveReview,
    uploadFile,
    getReports,
    invalidateCache
  };

  migrateStoredData();
})(window);
