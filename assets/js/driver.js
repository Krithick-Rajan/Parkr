(function () {
  function currentDriver() {
    const user = ParkrStore.getCurrentUser();
    return user && user.role === "driver" ? user : null;
  }

  function rowStatus(status) {
    return ParkrUtils.statusToken ? ParkrUtils.statusToken(status) : String(status || "pending").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  }

  function h(value) {
    return ParkrUtils.escapeHtml ? ParkrUtils.escapeHtml(value) : String(value ?? "");
  }

  function attr(value) {
    return ParkrUtils.escapeAttr ? ParkrUtils.escapeAttr(value) : h(value);
  }

  function driverIdOf(user) {
    return user && (user.userId || user.id);
  }

  function paymentStatus(booking) {
    return ParkrUtils.paymentStatus ? ParkrUtils.paymentStatus(booking) : rowStatus((booking || {}).status);
  }

  function formatTimeRange(booking) {
    return booking.endTime ? booking.startTime + " - " + booking.endTime : booking.time || booking.startTime || "";
  }

  function addHours(timeValue, hours) {
    if (!timeValue) return "";
    const parts = timeValue.split(":").map(Number);
    if (parts.length < 2 || Number.isNaN(parts[0])) return "";
    const date = new Date();
    date.setHours(parts[0], parts[1] || 0, 0, 0);
    date.setHours(date.getHours() + Number(hours || 1));
    return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  }

  let searchMapInstance = null;
  let detailMapInstance = null;

  function renderSearchMap(slots) {
    const container = document.querySelector("#searchMap");
    if (!container || typeof L === "undefined") return;

    if (searchMapInstance) {
      searchMapInstance.remove();
      searchMapInstance = null;
    }

    const validSlots = (slots || []).map((s, idx) => ({
      ...s,
      lat: Number(s.lat) || 12.9716 + ((idx % 4) * 0.015) - 0.02,
      lng: Number(s.lng) || 77.5946 + ((idx % 3) * 0.02) - 0.01
    }));

    const center = validSlots.length ? [validSlots[0].lat, validSlots[0].lng] : [12.9716, 77.5946];
    searchMapInstance = L.map("searchMap").setView(center, 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(searchMapInstance);

    validSlots.forEach((slot) => {
      const marker = L.marker([slot.lat, slot.lng]).addTo(searchMapInstance);
      const popupHtml = `
        <div class="map-popup-card">
          <h4>${h(slot.name)}</h4>
          <p>${h(slot.location || slot.address)}</p>
          <p><strong>${ParkrUtils.formatCurrency(slot.price)}/hr</strong> · ${slot.available} available</p>
          <a class="btn btn-primary" href="#details?slot=${attr(slot.id)}">Details</a>
        </div>
      `;
      marker.bindPopup(popupHtml);
    });

    setTimeout(() => {
      if (searchMapInstance) searchMapInstance.invalidateSize();
    }, 250);
  }

  function renderDetailMap(slot) {
    const container = document.querySelector("#slotDetailMap");
    if (!container || typeof L === "undefined" || !slot) return;

    if (detailMapInstance) {
      detailMapInstance.remove();
      detailMapInstance = null;
    }

    const lat = Number(slot.lat) || 12.9716;
    const lng = Number(slot.lng) || 77.5946;

    detailMapInstance = L.map("slotDetailMap").setView([lat, lng], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(detailMapInstance);

    const marker = L.marker([lat, lng]).addTo(detailMapInstance);
    marker.bindPopup(`<strong>${h(slot.name)}</strong><br>${h(slot.address)}`).openPopup();

    setTimeout(() => {
      if (detailMapInstance) detailMapInstance.invalidateSize();
    }, 250);
  }

  async function initDashboard() {
    const user = currentDriver();
    if (!user) return;
    const driverId = driverIdOf(user);
    const driverEmail = (user.email || "").toLowerCase();
    try {
      const bookings = await ParkrStore.listBookings({ driverId, driverEmail });
      const currentBookings = bookings || [];
      const active = currentBookings.filter((booking) => ["paid", "pending"].includes(paymentStatus(booking)));
      const spend = currentBookings.filter((booking) => paymentStatus(booking) === "paid").reduce((total, booking) => total + Number(booking.amount || 0), 0);
      ParkrUtils.setText("[data-driver-active]", active.length);
      ParkrUtils.setText("[data-driver-spend]", ParkrUtils.formatCurrency(spend));
      ParkrUtils.setText("[data-driver-saved]", Math.max(currentBookings.length * 2.5, 0).toFixed(1) + " hrs");
      ParkrUtils.setText("[data-driver-favorites]", "0");
      renderHistoryRows("#driverUpcoming", active.slice(0, 3));
      renderQuickPicks();
    } catch (err) {
      console.warn("Failed to init driver dashboard:", err);
      ParkrUtils.setText("[data-driver-active]", "0");
      ParkrUtils.setText("[data-driver-spend]", ParkrUtils.formatCurrency(0));
      ParkrUtils.setText("[data-driver-saved]", "0.0 hrs");
      renderHistoryRows("#driverUpcoming", []);
      renderQuickPicks();
    }
  }

  async function renderQuickPicks() {
    const target = document.querySelector("#driverQuickPicks");
    if (!target) return;
    const slots = await ParkrStore.listSlots({ publicOnly: true });
    target.innerHTML = slots.length ? slots.slice(0, 3).map((slot) => `
      <div class="list-row">
        <div>
          <strong>${h(slot.name)}</strong>
          <p class="muted">${Number(slot.available || slot.availableSlots || 0)} slots left</p>
        </div>
        <a class="btn btn-secondary btn-small" href="#booking?slot=${attr(slot.id)}">Book</a>
      </div>
    `).join("") : `
      <div class="empty-state">
        <div>
          <h3>No verified slots</h3>
          <p>Approved owner slots will appear here.</p>
        </div>
      </div>
    `;
  }

  function initSearch() {
    const form = document.querySelector("#driverSearchForm");
    const list = document.querySelector("#slotResults");
    if (!form || !list) return;

    const params = new URLSearchParams(window.location.search);
    const incomingLocation = params.get("location");
    if (incomingLocation) form.location.value = incomingLocation;

    async function render() {
      const data = new FormData(form);
      try {
        const filtered = await ParkrStore.searchSlots({
          location: data.get("location"),
          vehicle: data.get("vehicle"),
          maxPrice: Number(data.get("price") || 9999)
        });
        list.innerHTML = (filtered && filtered.length)
          ? filtered.map((slot) => ParkrUtils.renderSlotCard(slot)).join("")
          : "<div class=\"empty-state\"><div><h3>No matching slots</h3><p>Try another location, vehicle type, or price limit.</p></div></div>";
        renderSearchMap(filtered || []);
      } catch (err) {
        list.innerHTML = "<div class=\"empty-state\"><div><h3>No matching slots</h3><p>Try another location, vehicle type, or price limit.</p></div></div>";
        renderSearchMap([]);
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      render();
    });
    render();
  }

  async function initDetails() {
    const slot = await ParkrStore.getSlot(ParkrUtils.getQueryParam("slot"));
    if (!slot) {
      document.querySelectorAll("[data-slot-name]").forEach((item) => { item.textContent = "Parking slot unavailable"; });
      document.querySelectorAll("[data-slot-address]").forEach((item) => { item.textContent = "This slot is not available for booking."; });
      document.querySelectorAll("[data-booking-link]").forEach((link) => {
        link.classList.add("disabled");
        link.setAttribute("aria-disabled", "true");
        link.href = "#search";
      });
      return;
    }
    document.querySelectorAll("[data-slot-name]").forEach((item) => { item.textContent = slot.name; });
    document.querySelectorAll("[data-slot-address]").forEach((item) => { item.textContent = slot.address; });
    document.querySelectorAll("[data-slot-price]").forEach((item) => { item.textContent = ParkrUtils.formatCurrency(slot.price) + " / hour"; });
    document.querySelectorAll("[data-slot-rating]").forEach((item) => { item.textContent = slot.rating + " rating"; });
    document.querySelectorAll("[data-slot-available]").forEach((item) => { item.textContent = slot.available + " slots available"; });
    const featureList = document.querySelector("#slotFeatures");
    if (featureList) featureList.innerHTML = (slot.features || []).map((feature) => `<span class="pill">${h(feature)}</span>`).join("");
    document.querySelectorAll("[data-booking-link]").forEach((link) => { link.href = "#booking?slot=" + encodeURIComponent(slot.id); });
    
    const hero = document.querySelector(".detail-hero");
    if (hero) {
      if (slot.imageUrl) {
        hero.style.backgroundImage = `linear-gradient(rgba(15, 23, 42, 0.65), rgba(15, 23, 42, 0.85)), url('${slot.imageUrl}')`;
        hero.style.backgroundSize = "cover";
        hero.style.backgroundPosition = "center";
      } else {
        hero.style.backgroundImage = "";
      }
    }

    renderDetailMap(slot);
  }

  async function initBooking() {
    const slot = await ParkrStore.getSlot(ParkrUtils.getQueryParam("slot"));
    const form = document.querySelector("#bookingForm");
    const verification = rowStatus(slot && (slot.verificationStatus || slot.status));
    const availability = rowStatus(slot && slot.availabilityStatus);
    const available = Number(slot && (slot.available ?? slot.availableSlots ?? 0));
    if (!slot || verification !== "approved" || availability === "unavailable" || available <= 0) {
      ParkrUtils.setText("[data-booking-slot]", "Parking slot unavailable");
      ParkrUtils.setText("[data-booking-address]", "Go back to search and choose an approved slot.");
      ParkrUtils.setText("[data-booking-rate]", "Rs. 0 / hour");
      ParkrUtils.setText("[data-booking-total]", "Rs. 0");
      if (form) form.querySelectorAll("input, select, button").forEach((item) => { item.disabled = true; });
      return;
    }
    ParkrUtils.setText("[data-booking-slot]", slot.name);
    ParkrUtils.setText("[data-booking-rate]", ParkrUtils.formatCurrency(slot.price) + " / hour");
    ParkrUtils.setText("[data-booking-address]", slot.address);
    updateBookingTotal(slot.price);

    const hours = document.querySelector("#bookingHours");
    if (hours) hours.addEventListener("input", () => updateBookingTotal(slot.price));

    const paymentModeSelect = document.querySelector("#paymentMode");
    const paymentDetailText = document.querySelector("#paymentDetailText");
    const updatePaymentInfo = () => {
      if (!paymentDetailText || !paymentModeSelect) return;
      const mode = paymentModeSelect.value;
      if (mode === "UPI") {
        paymentDetailText.innerHTML = "📱 <strong>UPI ID:</strong> parkr.test@upi · Instant QR verification (100% Free)";
      } else if (mode === "Card") {
        paymentDetailText.innerHTML = "💳 <strong>Test Card:</strong> 4111 1111 1111 1111 · Exp: 12/28 · CVV: 123 (Zero Fee)";
      } else if (mode === "Cash") {
        paymentDetailText.innerHTML = "💵 <strong>Cash on Arrival:</strong> Pay at the slot counter. Immediate spot reservation.";
      } else {
        paymentDetailText.innerHTML = "🏦 <strong>Bank Transfer:</strong> Instant IMPS/NEFT reference generated.";
      }
    };
    if (paymentModeSelect) {
      paymentModeSelect.addEventListener("change", updatePaymentInfo);
      updatePaymentInfo();
    }

    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const user = currentDriver();
      if (!user) return;
      const driverId = driverIdOf(user);
      if (!driverId) {
        Parkr.showToast("Please login again before booking.");
        return;
      }
      const latestSlot = await ParkrStore.getSlot(slot.id);
      const latestAvailable = Number(latestSlot && (latestSlot.available ?? latestSlot.availableSlots ?? 0));
      if (!latestSlot || latestAvailable <= 0 || rowStatus(latestSlot.verificationStatus || latestSlot.status) !== "approved") {
        Parkr.showToast("This parking slot is fully booked.");
        return;
      }
      const data = new FormData(form);
      const hoursBooked = Number(data.get("hours") || 1);
      const amount = slot.price * hoursBooked;
      const paymentMode = data.get("paymentMode") || "UPI";
      const paidAt = new Date().toISOString();
      const paidBy = driverId;

      const booking = await ParkrStore.saveBooking({
        slotId: slot.id,
        slot: slot.name,
        driverId: paidBy,
        driver: user.name,
        bookingDate: data.get("date"),
        date: data.get("date"),
        startTime: data.get("time"),
        time: data.get("time"),
        endTime: addHours(data.get("time"), hoursBooked),
        amount,
        status: "paid",
        paymentMode,
        paidBy,
        paidByName: user.name,
        paidAt,
        vehicleNumber: data.get("vehicleNumber"),
        vehicleType: data.get("vehicleType"),
        ownerId: slot.ownerId
      });

      const payment = await ParkrStore.savePayment({
        bookingId: booking.bookingId || booking.id,
        amount,
        paymentMode,
        paymentStatus: "paid",
        status: "paid",
        paymentDate: paidAt,
        paidBy,
        paidByName: user.name,
        payerRole: "driver",
        paidAt
      });

      await ParkrStore.saveBooking({
        ...booking,
        paymentId: payment.paymentId || payment.id,
        status: "paid",
        paymentMode,
        paidBy,
        paidByName: user.name,
        paidAt
      });

      // Synchronize with Express backend (persists in backend db & triggers Nodemailer email alert)
      try {
        await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slotId: slot.id,
            slot: slot.name,
            driverId: paidBy,
            driver: user.name,
            date: data.get("date"),
            time: data.get("time"),
            endTime: addHours(data.get("time"), hoursBooked),
            amount,
            status: "paid",
            paymentMode,
            vehicleNumber: data.get("vehicleNumber"),
            vehicleType: data.get("vehicleType"),
            ownerId: slot.ownerId
          })
        });
        await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: booking.bookingId || booking.id,
            amount,
            paymentMode,
            paidBy,
            paidByName: user.name,
            payerRole: "driver"
          })
        });
      } catch (backendErr) {
        console.warn("[Backend API] Offline/Fallback mode active:", backendErr.message);
      }

      const nextAvailable = Math.max(latestAvailable - 1, 0);
      await ParkrStore.updateSlot(slot.id, {
        available: nextAvailable,
        availableSlots: nextAvailable,
        availabilityStatus: nextAvailable > 0 ? "available" : "unavailable"
      });

      Parkr.showToast("Payment verified! Booking confirmed for " + slot.name);
      setTimeout(() => {
        if (document.body.dataset.page === "driver-hub") {
          window.location.hash = "#history";
        } else {
          window.location.href = "booking-history.html";
        }
      }, 700);
    });
  }

  function updateBookingTotal(rate) {
    const hours = Number((document.querySelector("#bookingHours") || {}).value || 1);
    ParkrUtils.setText("[data-booking-total]", ParkrUtils.formatCurrency(rate * hours));
  }

  function renderHistoryRows(selector, rows) {
    const target = document.querySelector(selector);
    if (!target) return;
    const isHistoryTable = selector === "#bookingHistoryRows";
    const colspan = isHistoryTable ? 7 : 6;
    if (!rows || !rows.length) {
      target.innerHTML = `<tr><td colspan="${colspan}" class="muted" style="text-align: center; padding: 24px 14px;">No bookings yet.</td></tr>`;
      return;
    }
    target.innerHTML = rows.map((booking, index) => {
      const isCancelled = booking.status === "cancelled";
      const actionCell = isHistoryTable
        ? `<td><button class="btn btn-secondary btn-small" type="button" data-cancel-booking="${attr(booking.id)}"${isCancelled ? " disabled" : ""}>${isCancelled ? "Cancelled" : "Cancel"}</button></td>`
        : "";
      return `
        <tr>
          <td>${ParkrUtils.displayId(booking, "BK", index)}</td>
          <td>${h(booking.slot)}</td>
          <td>${h(booking.date || booking.bookingDate)}</td>
          <td>${h(formatTimeRange(booking))}</td>
          <td>${ParkrUtils.formatCurrency(booking.amount)}</td>
          <td><span class="status ${rowStatus(paymentStatus(booking))}">${h(paymentStatus(booking))}</span></td>
          ${actionCell}
        </tr>
      `;
    }).join("");
  }

  async function initHistory() {
    const user = currentDriver();
    const target = document.querySelector("#bookingHistoryRows");
    if (!user) {
      if (target) target.innerHTML = `<tr><td colspan="7" class="muted" style="text-align: center; padding: 24px 14px;">No bookings yet.</td></tr>`;
      return;
    }
    const driverId = driverIdOf(user);
    const driverEmail = (user.email || "").toLowerCase();
    try {
      const rows = await ParkrStore.listBookings({ driverId, driverEmail });
      renderHistoryRows("#bookingHistoryRows", rows || []);
    } catch (err) {
      console.warn("Failed to load driver booking history:", err);
      renderHistoryRows("#bookingHistoryRows", []);
    }

    const table = document.querySelector("#bookingHistoryRows");
    if (!table || table.dataset.boundCancel) return;
    table.dataset.boundCancel = "true";
    table.addEventListener("click", async (event) => {
      const cancelButton = event.target.closest("[data-cancel-booking]");
      if (!cancelButton || cancelButton.disabled) return;
      const confirmed = await Parkr.openFormDialog({
        title: "Cancel booking",
        description: "Are you sure you want to cancel this booking?",
        submitLabel: "Cancel booking",
        submitClass: "btn btn-danger",
        fields: []
      });
      if (!confirmed) return;
      await ParkrStore.updateBookingStatus(cancelButton.dataset.cancelBooking, "cancelled");
      const allBookings = await ParkrStore.listBookings();
      const targetBooking = allBookings.find((b) => b.id === cancelButton.dataset.cancelBooking || b.bookingId === cancelButton.dataset.cancelBooking);
      if (targetBooking && targetBooking.slotId) {
        const slot = await ParkrStore.getSlot(targetBooking.slotId);
        if (slot) {
          const nextAvail = Math.min((Number(slot.available || 0) + 1), Number(slot.total || 1));
          await ParkrStore.updateSlot(slot.id, {
            available: nextAvail,
            availableSlots: nextAvail,
            availabilityStatus: "available"
          });
        }
      }
      Parkr.showToast("Booking cancelled");
      initHistory();
    });
  }

  async function initProfile() {
    const form = document.querySelector("#driverProfileForm");
    const user = currentDriver();
    if (!user) return;
    const driverId = driverIdOf(user);
    if (!driverId) return;
    const bookings = await ParkrStore.listBookings({ driverId });
    ParkrUtils.setText("[data-driver-profile-status]", user.status || "approved");
    ParkrUtils.setText("[data-driver-profile-bookings]", bookings.length);
    if (form) {
      form.name.value = user.name || "";
      form.email.value = user.email || "";
      form.phone.value = user.phone || "";
      form.vehicle.value = user.vehicle || "";
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        await ParkrStore.updateCurrentUser({
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
          vehicle: data.get("vehicle"),
          role: "driver"
        });
        Parkr.showToast("Driver profile updated");
      });
    }
  }

  function routeView() {
    const rawHash = window.location.hash.slice(1);
    let view = (rawHash.split("?")[0] || "").toLowerCase();

    if (!view) {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.has("location") || searchParams.has("vehicle") || searchParams.has("date")) {
        view = "search";
      } else if (searchParams.has("slot")) {
        view = "details";
      } else {
        view = "dashboard";
      }
    }

    const views = {
      dashboard: "view-dashboard",
      search: "view-search",
      details: "view-details",
      booking: "view-booking",
      history: "view-history",
      profile: "view-profile"
    };

    const targetId = views[view] || "view-dashboard";
    const activeKey = views[view] ? view : "dashboard";

    document.querySelectorAll(".view-section").forEach((el) => {
      el.classList.toggle("active", el.id === targetId);
    });

    document.querySelectorAll(".sidebar-nav a[data-nav]").forEach((link) => {
      link.classList.toggle("active", link.dataset.nav === activeKey);
    });

    if (activeKey === "dashboard") initDashboard();
    else if (activeKey === "search") initSearch();
    else if (activeKey === "details") initDetails();
    else if (activeKey === "booking") initBooking();
    else if (activeKey === "history") initHistory();
    else if (activeKey === "profile") initProfile();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    if (!page || !page.startsWith("driver")) return;
    if (page === "driver-hub") {
      routeView();
      window.addEventListener("hashchange", routeView);
      return;
    }
    if (page === "driver-dashboard") initDashboard();
    if (page === "driver-search") initSearch();
    if (page === "driver-details") initDetails();
    if (page === "driver-booking") initBooking();
    if (page === "driver-history") initHistory();
    if (page === "driver-profile") initProfile();
  });
})();
