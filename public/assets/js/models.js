(function (global) {
  const idCollections = {
    USR: { key: "parkrUsers", fields: ["displayId", "userId", "id"] },
    SL: { key: "parkrSlots", fields: ["displayId", "slotId", "id"] },
    BK: { key: "parkrBookings", fields: ["displayId", "bookingId", "id"] },
    PAY: { key: "parkrPayments", fields: ["displayId", "paymentId", "id"] }
  };

  function padId(value) {
    return String(value).padStart(3, "0");
  }

  function readableIdNumber(value, prefix) {
    const match = String(value || "").match(new RegExp("^" + prefix + "-(\\d{3})$", "i"));
    return match ? Number(match[1]) : 0;
  }

  function readRows(key) {
    try {
      const rows = JSON.parse(global.localStorage.getItem(key) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      return [];
    }
  }

  function makeId(prefix) {
    const settings = idCollections[prefix] || { key: "", fields: [] };
    const sequenceKey = "parkrNext" + prefix + "Id";
    const rows = settings.key ? readRows(settings.key) : [];
    const maxStored = rows.reduce((max, row) => {
      const numbers = settings.fields.map((field) => readableIdNumber(row[field], prefix));
      return Math.max(max, ...numbers);
    }, 0);
    let current = 0;
    try {
      current = Number(global.localStorage.getItem(sequenceKey) || 0);
    } catch (error) {
      current = 0;
    }
    const next = Math.max(current, maxStored) + 1;
    try {
      global.localStorage.setItem(sequenceKey, String(next));
    } catch (error) {
      // Ignore unavailable localStorage and still return a readable fallback.
    }
    return prefix + "-" + padId(next);
  }

  class User {
    constructor(data) {
      const source = data || {};
      this.userId = source.userId || source.id || makeId("USR");
      this.id = this.userId;
      this.displayId = source.displayId || source.publicId || (readableIdNumber(this.userId, "USR") ? this.userId : "");
      this.name = source.name || "Parkr User";
      this.email = source.email || "";
      this.phone = source.phone || "";
      this.role = source.role || "driver";
      this.status = source.status || "pending";
      this.vehicle = source.vehicle || source.defaultVehicle || "";
      this.business = source.business || source.businessName || "";
    }

    toRecord() {
      return {
        id: this.userId,
        userId: this.userId,
        displayId: this.displayId,
        name: this.name,
        email: this.email,
        phone: this.phone,
        role: this.role,
        status: this.status,
        vehicle: this.vehicle,
        business: this.business
      };
    }

    register(password) {
      return global.ParkrStore.registerUser(this.toRecord(), password);
    }

    login(password) {
      return global.ParkrStore.loginUser(this.email, password, this.role);
    }

    logout() {
      return global.ParkrStore.logoutUser();
    }
  }

  class Driver extends User {
    constructor(data) {
      super({ ...(data || {}), role: "driver" });
    }

    searchSlot(filters) {
      return global.ParkrStore.searchSlots(filters || {});
    }

    bookSlot(slotId, bookingDetails) {
      return global.ParkrStore.saveBooking({ ...(bookingDetails || {}), slotId });
    }

    viewBookings() {
      return global.ParkrStore.listBookings({ driverId: this.userId });
    }

    makePayment(bookingId, paymentDetails) {
      return global.ParkrStore.savePayment({ ...(paymentDetails || {}), bookingId });
    }
  }

  class ParkingOwner extends User {
    constructor(data) {
      super({ ...(data || {}), role: "owner" });
    }

    addSlot(slot) {
      return global.ParkrStore.addSlot({ ...(slot || {}), ownerId: this.userId });
    }

    editSlot(slotId, changes) {
      return global.ParkrStore.updateSlot(slotId, changes || {});
    }

    deleteSlot(slotId) {
      return global.ParkrStore.deleteSlot(slotId);
    }

    viewBookings() {
      return global.ParkrStore.listBookings({ ownerId: this.userId });
    }
  }

  class Admin extends User {
    constructor(data) {
      super({ ...(data || {}), role: "admin" });
    }

    verifySlot(slotId, status) {
      return global.ParkrStore.updateSlotStatus(slotId, status);
    }

    manageUsers() {
      return global.ParkrStore.listUsers();
    }

    manageBookings() {
      return global.ParkrStore.listBookings();
    }

    viewReports() {
      return global.ParkrStore.getReports();
    }
  }

  class ParkingSlot {
    constructor(data) {
      const source = data || {};
      this.slotId = source.slotId || source.id || makeId("SL");
      this.id = this.slotId;
      this.displayId = source.displayId || source.publicId || (readableIdNumber(this.slotId, "SL") ? this.slotId : "");
      this.name = source.name || source.slotName || "Parking Slot";
      this.location = source.location || source.area || "";
      this.address = source.address || source.location || "";
      this.price = Number(source.price || source.pricePerHour || 0);
      this.vehicleType = source.vehicleType || source.vehicle || "Car";
      this.vehicle = this.vehicleType;
      this.status = source.status || "pending";
      this.availabilityStatus = source.availabilityStatus || (["approved", "available"].includes(this.status) ? "available" : "unavailable");
      this.verificationStatus = source.verificationStatus || (["approved", "pending", "rejected"].includes(this.status) ? this.status : "approved");
      this.ownerId = source.ownerId || "";
      this.ownerEmail = source.ownerEmail || "";
      this.owner = source.owner || "";
      this.total = Number(source.total ?? source.totalSlots ?? source.availableSlots ?? source.available ?? 1);
      this.available = Number(source.available ?? source.availableSlots ?? this.total);
      this.rating = (source.rating !== undefined && source.rating !== null && !isNaN(Number(source.rating))) ? Number(source.rating) : 5.0;
      this.reviewsCount = Number(source.reviewsCount || 0);
      this.imageClass = source.imageClass || "";
      this.imageUrl = source.imageUrl || source.photo || "";
      this.lat = source.lat !== undefined && source.lat !== null && !isNaN(Number(source.lat)) ? Number(source.lat) : undefined;
      this.lng = source.lng !== undefined && source.lng !== null && !isNaN(Number(source.lng)) ? Number(source.lng) : undefined;
      this.features = Array.isArray(source.features) ? source.features : [];
      this.open = source.open || "";
      this.close = source.close || "";
    }

    toRecord() {
      return {
        id: this.slotId,
        slotId: this.slotId,
        displayId: this.displayId,
        name: this.name,
        location: this.location,
        area: this.location,
        address: this.address,
        lat: this.lat,
        lng: this.lng,
        price: this.price,
        pricePerHour: this.price,
        vehicle: this.vehicleType,
        vehicleType: this.vehicleType,
        status: this.status,
        availabilityStatus: this.availabilityStatus,
        verificationStatus: this.verificationStatus,
        ownerId: this.ownerId,
        ownerEmail: this.ownerEmail,
        owner: this.owner,
        imageUrl: this.imageUrl,
        total: this.total,
        totalSlots: this.total,
        available: this.available,
        availableSlots: this.available,
        rating: this.rating,
        reviewsCount: this.reviewsCount,
        imageClass: this.imageClass,
        features: this.features,
        open: this.open,
        close: this.close
      };
    }

    updateAvailability(status) {
      this.availabilityStatus = status;
      return global.ParkrStore.updateSlot(this.slotId, { availabilityStatus: status });
    }
  }

  class Booking {
    constructor(data) {
      const source = data || {};
      this.bookingId = source.bookingId || source.id || makeId("BK");
      this.id = this.bookingId;
      this.displayId = source.displayId || source.publicId || (readableIdNumber(this.bookingId, "BK") ? this.bookingId : "");
      this.slotId = source.slotId || "";
      this.slot = source.slot || source.slotName || "";
      this.driverId = source.driverId || "";
      this.driver = source.driver || "";
      this.bookingDate = source.bookingDate || source.date || "";
      this.date = this.bookingDate;
      this.startTime = source.startTime || source.time || "";
      this.time = this.startTime;
      this.endTime = source.endTime || "";
      this.amount = Number(source.amount || 0);
      this.status = source.status || "pending";
      this.paymentId = source.paymentId || "";
      this.paymentMode = source.paymentMode || "";
      this.paidBy = source.paidBy || "";
      this.paidByName = source.paidByName || "";
      this.paidAt = source.paidAt || "";
      this.vehicleNumber = source.vehicleNumber || "";
      this.vehicleType = source.vehicleType || source.vehicle || "";
      this.ownerId = source.ownerId || "";
    }

    toRecord() {
      return {
        id: this.bookingId,
        bookingId: this.bookingId,
        displayId: this.displayId,
        slotId: this.slotId,
        slot: this.slot,
        driverId: this.driverId,
        driver: this.driver,
        bookingDate: this.bookingDate,
        date: this.date,
        startTime: this.startTime,
        time: this.time,
        endTime: this.endTime,
        amount: this.amount,
        status: this.status,
        paymentId: this.paymentId,
        paymentMode: this.paymentMode,
        paidBy: this.paidBy,
        paidByName: this.paidByName,
        paidAt: this.paidAt,
        vehicleNumber: this.vehicleNumber,
        vehicleType: this.vehicleType,
        ownerId: this.ownerId
      };
    }

    confirmBooking() {
      this.status = "paid";
      return global.ParkrStore.updateBookingStatus(this.bookingId, "paid");
    }

    cancelBooking() {
      this.status = "cancelled";
      return global.ParkrStore.updateBookingStatus(this.bookingId, "cancelled");
    }
  }

  class Payment {
    constructor(data) {
      const source = data || {};
      this.paymentId = source.paymentId || source.id || makeId("PAY");
      this.id = this.paymentId;
      this.displayId = source.displayId || source.publicId || (readableIdNumber(this.paymentId, "PAY") ? this.paymentId : "");
      this.bookingId = source.bookingId || "";
      this.amount = Number(source.amount || 0);
      this.paymentStatus = source.paymentStatus || source.status || "pending";
      this.status = this.paymentStatus;
      this.paymentDate = source.paymentDate || new Date().toISOString();
      this.paymentMode = source.paymentMode || "UPI";
      this.paidBy = source.paidBy || "";
      this.paidByName = source.paidByName || "";
      this.payerRole = source.payerRole || "driver";
      this.paidAt = source.paidAt || this.paymentDate;
    }

    toRecord() {
      return {
        id: this.paymentId,
        paymentId: this.paymentId,
        displayId: this.displayId,
        bookingId: this.bookingId,
        amount: this.amount,
        paymentStatus: this.paymentStatus,
        status: this.status,
        paymentDate: this.paymentDate,
        paymentMode: this.paymentMode,
        paidBy: this.paidBy,
        paidByName: this.paidByName,
        payerRole: this.payerRole,
        paidAt: this.paidAt
      };
    }

    processPayment() {
      this.paymentStatus = "paid";
      this.status = this.paymentStatus;
      return global.ParkrStore.savePayment(this.toRecord());
    }
  }

  global.ParkrModels = {
    User,
    Driver,
    ParkingOwner,
    Admin,
    ParkingSlot,
    Booking,
    Payment,
    makeId
  };
})(window);
