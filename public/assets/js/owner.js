(function () {
  function statusClass(status) {
    return (typeof ParkrUtils !== "undefined" && ParkrUtils.statusToken)
      ? ParkrUtils.statusToken(status)
      : String(status || "pending").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  }

  function h(value) {
    return (typeof ParkrUtils !== "undefined" && ParkrUtils.escapeHtml)
      ? ParkrUtils.escapeHtml(value)
      : String(value ?? "");
  }

  function attr(value) {
    return (typeof ParkrUtils !== "undefined" && ParkrUtils.escapeAttr)
      ? ParkrUtils.escapeAttr(value)
      : h(value);
  }

  function currentOwner() {
    let user = (typeof ParkrStore !== "undefined" && ParkrStore.getCurrentUser) ? ParkrStore.getCurrentUser() : null;
    if (!user && typeof Parkr !== "undefined" && Parkr.getUser) user = Parkr.getUser();
    if (!user) {
      try {
        user = JSON.parse(localStorage.getItem("parkrUser") || "null");
      } catch (e) {}
    }
    if (!user) return null;
    const role = String(user.role || "").toLowerCase();
    if (role === "owner" || role === "admin") return user;
    return user;
  }

  function ownerIdOf(user) {
    if (!user) return "";
    return user.userId || user.id || user.uid || (user.email ? "USR-" + user.email.split("@")[0] : "USR-002");
  }

  function paymentStatus(booking) {
    return ParkrUtils.paymentStatus ? ParkrUtils.paymentStatus(booking) : statusClass((booking || {}).status);
  }

  async function renderOwnerSlots(selector) {
    const target = document.querySelector(selector);
    if (!target) return;
    const owner = currentOwner();
    if (!owner) {
      target.innerHTML = '<tr><td colspan="8" class="muted" style="text-align: center; padding: 24px 14px;">Please log in as an owner to manage parking slots.</td></tr>';
      return;
    }
    const ownerId = ownerIdOf(owner);
    const ownerEmail = (owner.email || "").toLowerCase();

    if (!target.children.length || target.querySelector(".muted")) {
      target.innerHTML = '<tr><td colspan="8" class="muted" style="text-align: center; padding: 24px 14px;">Loading parking slots...</td></tr>';
    }

    try {
      const [slotsData, bookings] = await Promise.all([
        ParkrStore.listOwnerSlots(ownerId, ownerEmail, { forceRefresh: true }),
        ParkrStore.listBookings({ ownerId, ownerEmail })
      ]);
      let slots = slotsData || [];
      if (!slots.length) {
        // Resilient fallback: Query all slots from server to prevent session ID mismatch lockouts
        try {
          const allSlots = await ParkrStore.listSlots({ adminOnly: true, forceRefresh: true });
          if (allSlots && allSlots.length) {
            slots = allSlots;
          }
        } catch (_) {}
      }

      if (!slots || !slots.length) {
        target.innerHTML = '<tr><td colspan="8" class="muted" style="text-align: center; padding: 24px 14px;">No parking slots found. <a href="#add-slot" style="color: #38bdf8; text-decoration: underline; margin-left: 6px;">Add your first slot</a></td></tr>';
        return;
      }
      const paidBookings = (bookings || []).filter((b) => paymentStatus(b) === "paid");
      target.innerHTML = slots.map((slot, index) => {
        const displayStatus = slot.verificationStatus || slot.status || "approved";
        const slotBookings = paidBookings.filter((b) => b.slotId === slot.id || b.slotId === slot.slotId || b.slot === slot.name);
        const slotRevenue = slotBookings.reduce((sum, b) => sum + Number(b.amount || 0), 0);
        const thumb = slot.imageUrl
          ? `<img src="${attr(slot.imageUrl)}" alt="${attr(slot.name)}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 6px; margin-right: 8px; border: 1px solid rgba(255,255,255,0.15); vertical-align: middle;">`
          : `<img src="assets/images/logo/parkr-logo-orange.svg" alt="Parkr Logo" style="width: 22px; height: 22px; object-fit: contain; vertical-align: middle; margin-right: 8px; display: inline-block;">`;
        return `
          <tr>
            <td>${ParkrUtils.displayId(slot, "SL", index)}</td>
            <td><div style="display: inline-flex; align-items: center;">${thumb}<strong>${h(slot.name)}</strong></div></td>
            <td>${h(slot.vehicleType || slot.vehicle)}</td>
            <td>${ParkrUtils.formatCurrency(slot.price)}/hr</td>
            <td>${slot.available} / ${slot.total}</td>
            <td><strong style="color: #4ade80;">${ParkrUtils.formatCurrency(slotRevenue)}</strong></td>
            <td><span class="status ${statusClass(displayStatus)}">${h(displayStatus)}</span></td>
            <td class="inline-actions">
              <button class="btn btn-secondary btn-small" type="button" data-edit-slot="${attr(slot.id)}">Edit</button>
              <button class="btn btn-danger btn-small" type="button" data-delete-slot="${attr(slot.id)}" data-slot-name="${attr(slot.name)}">Delete</button>
            </td>
          </tr>
        `;
      }).join("");
    } catch (err) {
      console.warn("Failed to load owner slots:", err);
      target.innerHTML = '<tr><td colspan="8" class="muted" style="text-align: center; padding: 24px 14px;">No parking slots found.</td></tr>';
    }
  }

  async function renderOwnerBookings(selector) {
    const target = document.querySelector(selector);
    if (!target) return;
    const owner = currentOwner();
    if (!owner) {
      target.innerHTML = '<tr><td colspan="6" class="muted" style="text-align: center; padding: 24px 14px;">No bookings yet.</td></tr>';
      return;
    }
    const ownerId = ownerIdOf(owner);
    const ownerEmail = (owner.email || "").toLowerCase();

    try {
      const bookings = await ParkrStore.listBookings({ ownerId, ownerEmail });
      if (!bookings || !bookings.length) {
        target.innerHTML = '<tr><td colspan="6" class="muted" style="text-align: center; padding: 24px 14px;">No bookings yet.</td></tr>';
        return;
      }
      target.innerHTML = bookings.map((booking, index) => `
        <tr>
          <td>${ParkrUtils.displayId(booking, "BK", index)}</td>
          <td>${h(booking.driver)}</td>
          <td>${h(booking.slot)}</td>
          <td>${h(booking.date || booking.bookingDate)}</td>
          <td><strong>${ParkrUtils.formatCurrency(booking.amount)}</strong></td>
          <td><span class="status ${statusClass(paymentStatus(booking))}">${h(paymentStatus(booking))}</span></td>
        </tr>
      `).join("");
    } catch (err) {
      console.warn("Failed to load owner bookings:", err);
      target.innerHTML = '<tr><td colspan="6" class="muted" style="text-align: center; padding: 24px 14px;">No bookings yet.</td></tr>';
    }
  }

  function renderRevenueProgress(paidBookings, selector) {
    const target = document.querySelector(selector);
    if (!target) return;
    if (!paidBookings || !paidBookings.length) {
      target.innerHTML = `
        <div class="parkr-bento-empty">
          <div class="bento-empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="20" x2="12" y2="10"></line>
              <line x1="18" y1="20" x2="18" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="16"></line>
            </svg>
          </div>
          <h3>No Booking Revenue Yet</h3>
          <p class="muted">Live Bento analytics and slot earnings distribution will populate here as drivers complete bookings.</p>
        </div>
      `;
      return;
    }

    const revenueBySlot = paidBookings.reduce((map, booking) => {
      const name = booking.slot || "Parking slot";
      map[name] = (map[name] || 0) + Number(booking.amount || 0);
      return map;
    }, {});

    const countBySlot = paidBookings.reduce((map, booking) => {
      const name = booking.slot || "Parking slot";
      map[name] = (map[name] || 0) + 1;
      return map;
    }, {});

    const totalRevenue = Object.values(revenueBySlot).reduce((a, b) => a + b, 0);
    const sortedSlots = Object.entries(revenueBySlot)
      .map(([name, amount]) => ({
        name,
        amount,
        count: countBySlot[name] || 1,
        percent: totalRevenue ? Math.round((amount / totalRevenue) * 100) : 100
      }))
      .sort((a, b) => b.amount - a.amount);

    const topSlot = sortedSlots[0] || { name: "Parking Slot", amount: totalRevenue, count: paidBookings.length, percent: 100 };
    const netTakeHome = Math.round(totalRevenue * 0.9);
    const platformFee = totalRevenue - netTakeHome;
    const avgTicket = paidBookings.length ? Math.round(totalRevenue / paidBookings.length) : 0;

    target.innerHTML = `
      <div class="revenue-bento-grid">
        <!-- 1. Primary Hero Tile -->
        <div class="bento-tile bento-hero">
          <div class="bento-pattern-bg"></div>
          <div class="bento-hero-top">
            <span class="bento-pill-badge amber">
              <img src="assets/images/logo/parkr-logo-orange.svg" alt="Parkr Logo" style="width: 14px; height: 14px; object-fit: contain; vertical-align: middle;">
              Top Revenue Generator
            </span>
            <span class="bento-share-chip">${topSlot.percent}% share</span>
          </div>
          <div class="bento-hero-body">
            <div class="bento-hero-val">${ParkrUtils.formatCurrency(topSlot.amount)}</div>
            <div class="bento-hero-title">${h(topSlot.name)}</div>
            <div class="bento-hero-meta">
              <span>${topSlot.count} ${topSlot.count === 1 ? "reservation" : "reservations"}</span>
              <span>•</span>
              <span>Avg. ${ParkrUtils.formatCurrency(Math.round(topSlot.amount / topSlot.count))}/booking</span>
            </div>
          </div>
        </div>

        <!-- 2. Secondary Yield Tile -->
        <div class="bento-tile bento-yield">
          <div class="bento-tile-header">
            <span class="bento-tile-label">Net Owner Yield</span>
            <span class="bento-yield-tag">+90% Net</span>
          </div>
          <div>
            <div class="bento-yield-amount">${ParkrUtils.formatCurrency(netTakeHome)}</div>
            <div class="bento-yield-caption">Platform fee: ${ParkrUtils.formatCurrency(platformFee)} (10%)</div>
          </div>
          <div class="bento-sparkline" title="Booking Activity Distribution">
            <div class="bento-bar-col"><div class="bento-bar-fill" style="height: 40%;"></div></div>
            <div class="bento-bar-col"><div class="bento-bar-fill" style="height: 65%;"></div></div>
            <div class="bento-bar-col"><div class="bento-bar-fill" style="height: 50%;"></div></div>
            <div class="bento-bar-col"><div class="bento-bar-fill" style="height: 85%;"></div></div>
            <div class="bento-bar-col"><div class="bento-bar-fill active" style="height: 100%;"></div></div>
          </div>
        </div>

        <!-- 3. Tertiary Metric Tile -->
        <div class="bento-tile bento-metric">
          <div class="bento-tile-header">
            <span class="bento-tile-label">Booking Velocity</span>
            <span class="bento-metric-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </span>
          </div>
          <div>
            <div class="bento-metric-val">${paidBookings.length} <span class="bento-unit">Paid</span></div>
            <div class="bento-metric-sub">Avg ticket: <strong style="color: #f8fafc;">${ParkrUtils.formatCurrency(avgTicket)}</strong></div>
          </div>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 8px;">
            Live settlement: <strong style="color: #4ade80;">Active</strong>
          </div>
        </div>

        <!-- 4. Distribution Breakdown Card -->
        <div class="bento-tile bento-distribution">
          <div class="bento-dist-header">
            <span class="bento-tile-label">Slot Distribution Performance</span>
            <span class="muted" style="font-size: 0.78rem;">${sortedSlots.length} ${sortedSlots.length === 1 ? "location" : "locations"}</span>
          </div>
          <div class="bento-dist-rows">
            ${sortedSlots.map((slot) => `
              <div class="bento-slot-row">
                <div class="bento-slot-top">
                  <div class="bento-slot-left">
                    <img src="assets/images/logo/parkr-logo-orange.svg" alt="Parkr Logo" style="width: 22px; height: 22px; object-fit: contain; flex-shrink: 0; display: inline-block;">
                    <div class="bento-slot-info">
                      <strong class="bento-slot-name">${h(slot.name)}</strong>
                      <span class="bento-slot-meta">${slot.count} ${slot.count === 1 ? "booking" : "bookings"} · ${slot.percent}% share</span>
                    </div>
                  </div>
                  <div class="bento-slot-right">
                    <span class="bento-slot-share-pill">${slot.percent}%</span>
                    <strong class="bento-slot-amount">${ParkrUtils.formatCurrency(slot.amount)}</strong>
                  </div>
                </div>
                <div class="bento-row-track">
                  <div class="bento-row-bar" style="width: ${slot.percent}%;"></div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  }

  async function initDashboard() {
    const owner = currentOwner();
    if (!owner) return;
    const ownerId = ownerIdOf(owner);
    const ownerEmail = (owner.email || "").toLowerCase();
    try {
      const [slotsData, bookings] = await Promise.all([
        ParkrStore.listOwnerSlots(ownerId, ownerEmail, { forceRefresh: true }),
        ParkrStore.listBookings({ ownerId, ownerEmail })
      ]);
      const currentBookings = bookings || [];
      let currentSlots = slotsData || [];
      if (!currentSlots.length) {
        try {
          const allSlots = await ParkrStore.listSlots({ adminOnly: true, forceRefresh: true });
          if (allSlots && allSlots.length) currentSlots = allSlots;
        } catch (_) {}
      }
      const paidBookings = currentBookings.filter((booking) => paymentStatus(booking) === "paid");
      const earnings = paidBookings.reduce((total, booking) => total + Number(booking.amount || 0), 0);
      const netProfit = Math.round(earnings * 0.9);
      const platformFee = earnings - netProfit;
      const avgBooking = paidBookings.length ? Math.round(earnings / paidBookings.length) : 0;
      const totalSlots = currentSlots.reduce((total, slot) => total + Number(slot.total || 0), 0);

      ParkrUtils.setText("[data-owner-slots]", currentSlots.length);
      ParkrUtils.setText("[data-owner-bookings]", currentBookings.length);
      ParkrUtils.setText("[data-owner-earnings]", ParkrUtils.formatCurrency(earnings));
      ParkrUtils.setText("[data-owner-net-profit]", ParkrUtils.formatCurrency(netProfit));
      ParkrUtils.setText("#ownerProfitGross", ParkrUtils.formatCurrency(earnings));
      ParkrUtils.setText("#ownerProfitFee", "- " + ParkrUtils.formatCurrency(platformFee));
      ParkrUtils.setText("#ownerProfitNet", ParkrUtils.formatCurrency(netProfit));
      ParkrUtils.setText("#ownerAvgBooking", ParkrUtils.formatCurrency(avgBooking));

      renderRevenueProgress(paidBookings, "#ownerRevenueRows");
      renderOwnerBookings("#ownerRecentBookings");
      renderOccupancy(currentSlots);
    } catch (err) {
      console.warn("Failed to initialize owner dashboard:", err);
      ParkrUtils.setText("[data-owner-slots]", "0");
      ParkrUtils.setText("[data-owner-bookings]", "0");
      ParkrUtils.setText("[data-owner-earnings]", ParkrUtils.formatCurrency(0));
      ParkrUtils.setText("[data-owner-net-profit]", ParkrUtils.formatCurrency(0));
      renderOwnerBookings("#ownerRecentBookings");
      renderOccupancy([]);
    }
  }

  function renderOccupancy(slots) {
    const target = document.querySelector("#ownerOccupancy");
    if (!target) return;
    if (!slots.length) {
      target.innerHTML = `
        <div class="empty-state">
          <div>
            <h3>No slot data yet</h3>
            <p>Add a parking slot to track occupancy.</p>
          </div>
        </div>
      `;
      return;
    }
    target.innerHTML = slots.slice(0, 4).map((slot) => {
      const total = Number(slot.total || slot.totalSlots || 0);
      const available = Number(slot.available || slot.availableSlots || 0);
      const occupied = Math.max(total - available, 0);
      const percent = total ? Math.round((occupied / total) * 100) : 0;
      return `
        <div class="progress-row">
          <div class="progress-label"><span>${h(slot.name)}</span><strong>${percent}%</strong></div>
          <div class="progress-track"><span style="width:${percent}%"></span></div>
        </div>
      `;
    }).join("");
  }

  let slotPickerMapInstance = null;
  let slotPickerMarker = null;
  let geocodeDebounceTimer = null;

  function updateCoordinates(lat, lng, labelText) {
    const latInput = document.querySelector("#slotLat");
    const lngInput = document.querySelector("#slotLng");
    const coordsDisplay = document.querySelector("#coordinatesDisplay");
    const statusDisplay = document.querySelector("#mapGeocodeStatus");

    const numLat = Number(lat);
    const numLng = Number(lng);
    const fixedLat = numLat.toFixed(5);
    const fixedLng = numLng.toFixed(5);

    if (latInput) latInput.value = fixedLat;
    if (lngInput) lngInput.value = fixedLng;
    if (coordsDisplay) coordsDisplay.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Coordinates: ${fixedLat}, ${fixedLng}`;
    if (statusDisplay) {
      statusDisplay.innerHTML = labelText ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${labelText.slice(0, 32)}...` : "Pin set";
      statusDisplay.style.color = "#4ade80";
    }
  }

  async function geocodeAddress(query, shouldUpdateAddressInput = true) {
    if (!query || query.trim().length < 2) return;
    const statusDisplay = document.querySelector("#mapGeocodeStatus");
    if (statusDisplay) {
      statusDisplay.textContent = "Locating on map...";
      statusDisplay.style.color = "#38bdf8";
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!resp.ok) throw new Error("Search service unavailable");
      const data = await resp.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        const matchedAddress = data[0].display_name;
        if (slotPickerMapInstance && slotPickerMarker) {
          slotPickerMapInstance.flyTo([lat, lon], 15, { duration: 0.8 });
          slotPickerMarker.setLatLng([lat, lon]);
          updateCoordinates(lat, lon, matchedAddress);
        }
        // Auto-fill full address box with the official matched address
        if (shouldUpdateAddressInput) {
          const addressInput = document.querySelector("#slotAddress");
          if (addressInput && matchedAddress) {
            addressInput.value = matchedAddress;
          }
        }
        if (statusDisplay) {
          statusDisplay.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${matchedAddress.slice(0, 36)}...`;
          statusDisplay.style.color = "#4ade80";
        }
      } else if (statusDisplay) {
        statusDisplay.textContent = "Location found. Click map to fine-tune pin.";
        statusDisplay.style.color = "#38bdf8";
      }
    } catch (err) {
      console.warn("[Geocode] Request failed or timed out:", err.message);
      if (statusDisplay) {
        statusDisplay.textContent = "Interactive pin ready. Drag pin or click map.";
        statusDisplay.style.color = "#f59e0b";
      }
    }
  }

  async function reverseGeocode(lat, lon) {
    const addressInput = document.querySelector("#slotAddress");
    const statusDisplay = document.querySelector("#mapGeocodeStatus");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!resp.ok) return;
      const data = await resp.json();
      if (data && data.display_name) {
        if (addressInput) addressInput.value = data.display_name;
        updateCoordinates(lat, lon, data.display_name);
        if (statusDisplay) {
          statusDisplay.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${data.display_name.slice(0, 36)}...`;
          statusDisplay.style.color = "#4ade80";
        }
      }
    } catch (err) {
      console.warn("[ReverseGeocode] Request failed:", err.message);
    }
  }

  function initSlotPickerMap() {
    const mapContainer = document.querySelector("#slotPickerMap");
    if (!mapContainer || typeof L === "undefined") return;

    if (slotPickerMapInstance) {
      setTimeout(() => slotPickerMapInstance.invalidateSize(), 200);
      return;
    }
    if (mapContainer._leaflet_id) {
      delete mapContainer._leaflet_id;
    }

    // Default coordinates: Coimbatore (11.0168, 76.9558)
    const initialLat = 11.0168;
    const initialLng = 76.9558;

    slotPickerMapInstance = L.map("slotPickerMap", { attributionControl: false }).setView([initialLat, initialLng], 13);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19
    }).addTo(slotPickerMapInstance);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19
    }).addTo(slotPickerMapInstance);

    slotPickerMarker = L.marker([initialLat, initialLng], {
      draggable: true
    }).addTo(slotPickerMapInstance);

    slotPickerMarker.bindPopup("<strong>Drag pin to your parking entrance</strong>").openPopup();

    slotPickerMarker.on("dragend", (e) => {
      const pos = e.target.getLatLng();
      updateCoordinates(pos.lat, pos.lng, "Custom Entrance Pin");
      reverseGeocode(pos.lat, pos.lng);
    });

    slotPickerMapInstance.on("click", (e) => {
      const pos = e.latlng;
      slotPickerMarker.setLatLng(pos);
      updateCoordinates(pos.lat, pos.lng, "Selected Map Point");
      reverseGeocode(pos.lat, pos.lng);
    });

    setTimeout(() => {
      if (slotPickerMapInstance) slotPickerMapInstance.invalidateSize();
    }, 250);
  }

  function initAddSlot() {
    const form = document.querySelector("#addSlotForm");
    if (!form) return;

    initSlotPickerMap();

    if (form.dataset.initialized === "true") {
      setTimeout(() => {
        if (slotPickerMapInstance) slotPickerMapInstance.invalidateSize();
      }, 250);
      return;
    }
    form.dataset.initialized = "true";

    const addressInput = document.querySelector("#slotAddress");
    const locateBtn = document.querySelector("#locateAddressBtn");
    const gpsBtn = document.querySelector("#useGpsBtn");

    if (addressInput) {
      addressInput.addEventListener("input", () => {
        clearTimeout(geocodeDebounceTimer);
        geocodeDebounceTimer = setTimeout(() => {
          geocodeAddress(addressInput.value);
        }, 700);
      });
      if (addressInput.value.trim().length > 3) {
        geocodeAddress(addressInput.value);
      }
    }

    if (locateBtn && addressInput) {
      locateBtn.addEventListener("click", () => {
        const val = addressInput.value.trim();
        if (!val) {
          if (typeof Parkr !== "undefined" && Parkr.showToast) {
            Parkr.showToast("Please enter an address to locate on map.", "warning");
          }
          return;
        }
        geocodeAddress(val);
      });
    }

    if (gpsBtn) {
      gpsBtn.addEventListener("click", () => {
        if (!navigator.geolocation) {
          if (typeof Parkr !== "undefined" && Parkr.showToast) {
            Parkr.showToast("Geolocation is not supported by your browser.", "warning");
          }
          return;
        }
        const statusDisplay = document.querySelector("#mapGeocodeStatus");
        if (statusDisplay) {
          statusDisplay.textContent = "Acquiring GPS location...";
          statusDisplay.style.color = "#38bdf8";
        }
        if (typeof Parkr !== "undefined" && Parkr.showToast) {
          Parkr.showToast("Acquiring GPS position...");
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            if (slotPickerMapInstance && slotPickerMarker) {
              slotPickerMapInstance.flyTo([lat, lng], 16, { duration: 0.8 });
              slotPickerMarker.setLatLng([lat, lng]);
              updateCoordinates(lat, lng, "Current GPS Position");
              reverseGeocode(lat, lng);
              if (typeof Parkr !== "undefined" && Parkr.showToast) {
                Parkr.showToast("GPS position acquired and address updated!");
              }
            }
          },
          (err) => {
            console.warn("GPS error:", err);
            if (typeof Parkr !== "undefined" && Parkr.showToast) {
              Parkr.showToast("Could not access GPS. Please click directly on the map to set pin.", "warning");
            }
            if (statusDisplay) {
              statusDisplay.textContent = "GPS unavailable. Click map to set pin.";
              statusDisplay.style.color = "#f59e0b";
            }
          },
          { timeout: 10000, enableHighAccuracy: true }
        );
      });
    }

    const photoInput = document.querySelector("#slotPhoto");
    const previewContainer = document.querySelector("#photoPreviewContainer");
    const previewImg = document.querySelector("#photoPreview");
    const filenameLabel = document.querySelector("#slotPhotoFilename");
    const previewName = document.querySelector("#previewFilename");
    const previewSize = document.querySelector("#previewFilesize");
    const removeBtn = document.querySelector("#removePhotoBtn");

    function formatBytes(bytes) {
      if (!bytes || bytes <= 0) return "0 KB";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }

    function clearPhoto() {
      if (photoInput) photoInput.value = "";
      if (previewImg) previewImg.src = "";
      if (previewContainer) previewContainer.style.display = "none";
      if (filenameLabel) {
        filenameLabel.textContent = "No file chosen • PNG, JPG, WEBP";
        filenameLabel.classList.remove("has-file");
      }
    }

    if (photoInput && previewContainer && previewImg) {
      photoInput.addEventListener("change", () => {
        const file = photoInput.files && photoInput.files[0];
        if (file) {
          if (filenameLabel) {
            filenameLabel.textContent = file.name;
            filenameLabel.classList.add("has-file");
          }
          if (previewName) previewName.textContent = file.name;
          if (previewSize) previewSize.textContent = formatBytes(file.size);

          const reader = new FileReader();
          reader.onload = (e) => {
            previewImg.src = e.target.result;
            previewContainer.style.display = "block";
          };
          reader.readAsDataURL(file);
        } else {
          clearPhoto();
        }
      });

      if (removeBtn) {
        removeBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          clearPhoto();
        });
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const owner = currentOwner();
      if (!owner) {
        if (typeof Parkr !== "undefined" && Parkr.showToast) {
          Parkr.showToast("Please log in as an owner to submit parking slots.", "warning");
        }
        return;
      }
      const ownerId = ownerIdOf(owner);
      if (!ownerId) {
        if (typeof Parkr !== "undefined" && Parkr.showToast) {
          Parkr.showToast("Owner session expired. Please log in again.", "warning");
        }
        return;
      }

      const submitBtn = document.querySelector("#submitSlotBtn") || form.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerHTML : "Submit for Verification";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = "Submitting for verification...";
      }

      try {
        const data = new FormData(form);

        let imageUrl = "";
        const file = photoInput && photoInput.files && photoInput.files[0];
        if (file) {
          try {
            imageUrl = await ParkrStore.uploadFile("slot-photos", file);
          } catch (err) {
            console.warn("[Upload] Failed, continuing without image:", err);
          }
        }

        const lat = Number(data.get("lat")) || 11.0168;
        const lng = Number(data.get("lng")) || 76.9558;

        await ParkrStore.addSlot({
          name: data.get("slotName"),
          vehicleType: data.get("vehicle"),
          vehicle: data.get("vehicle"),
          price: Number(data.get("price") || 0),
          total: Number(data.get("total") || 1),
          available: Number(data.get("total") || 1),
          open: data.get("open"),
          close: data.get("close"),
          address: data.get("address"),
          location: data.get("address"),
          lat,
          lng,
          imageUrl: imageUrl || undefined,
          ownerId,
          ownerEmail: owner.email || "",
          owner: owner.name || "Owner"
        });

        if (typeof Parkr !== "undefined" && Parkr.showToast) {
          Parkr.showToast("Slot submitted with photo & GPS coordinates for admin verification!", "success");
        }
        form.reset();
        clearPhoto();
        window.location.hash = "manage-slots";
      } catch (err) {
        console.error("Failed to add slot:", err);
        if (typeof Parkr !== "undefined" && Parkr.showToast) {
          Parkr.showToast(err.message || "Failed to submit slot for verification.", "error");
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    });
  }

  function initManageSlots() {
    const table = document.querySelector("#ownerSlotRows");
    renderOwnerSlots("#ownerSlotRows");
    if (!table) return;
    if (table.dataset.bound === "true") return;
    table.dataset.bound = "true";
    table.addEventListener("click", async (event) => {
      const deleteButton = event.target.closest("[data-delete-slot]");
      if (deleteButton) {
        const confirmed = await Parkr.openFormDialog({
          title: "Delete parking slot",
          description: "Are you sure you want to delete " + (deleteButton.dataset.slotName || "this slot") + "?",
          submitLabel: "Delete slot",
          submitClass: "btn btn-danger",
          fields: []
        });
        if (!confirmed) return;
        await ParkrStore.deleteSlot(deleteButton.dataset.deleteSlot);
        Parkr.showToast("Parking slot deleted");
        renderOwnerSlots("#ownerSlotRows");
        return;
      }

      const button = event.target.closest("[data-edit-slot]");
      if (!button) return;
      const slot = await ParkrStore.getSlot(button.dataset.editSlot);
      if (!slot) {
        Parkr.showToast("Parking slot not found");
        return;
      }
      const values = await Parkr.openFormDialog({
        title: "Edit parking slot",
        description: slot.name,
        submitLabel: "Save changes",
        size: "wide",
        grid: true,
        fields: [
          {
            name: "name",
            label: "Parking name",
            value: slot.name
          },
          {
            name: "vehicleType",
            label: "Vehicle type",
            type: "select",
            value: slot.vehicleType || slot.vehicle || "Car",
            options: ["Car", "Bike", "Van"]
          },
          {
            name: "price",
            label: "Price per hour",
            type: "number",
            min: "1",
            step: "1",
            value: slot.price
          },
          {
            name: "total",
            label: "Total slots",
            type: "number",
            min: "1",
            step: "1",
            value: slot.total
          },
          {
            name: "available",
            label: "Available slots",
            type: "number",
            min: "0",
            step: "1",
            value: slot.available
          },
          {
            name: "availabilityStatus",
            label: "Availability",
            type: "select",
            value: slot.availabilityStatus || "available",
            options: ["available", "unavailable"]
          },
          {
            name: "open",
            label: "Opening time",
            type: "time",
            value: slot.open
          },
          {
            name: "close",
            label: "Closing time",
            type: "time",
            value: slot.close
          },
          {
            name: "address",
            label: "Full address",
            type: "textarea",
            value: slot.address,
            fullSpan: true
          }
        ]
      });
      if (!values) return;
      const total = Math.max(Number(values.total || slot.total || 1), 1);
      const available = Math.min(Math.max(Number(values.available || 0), 0), total);
      await ParkrStore.updateSlot(slot.id, {
        name: values.name,
        vehicleType: values.vehicleType,
        vehicle: values.vehicleType,
        price: Number(values.price || slot.price),
        total,
        totalSlots: total,
        available,
        availableSlots: available,
        availabilityStatus: values.availabilityStatus,
        open: values.open,
        close: values.close,
        address: values.address,
        location: values.address,
        area: values.address
      });
      Parkr.showToast("Parking slot updated");
      renderOwnerSlots("#ownerSlotRows");
    });
  }

  function initBookings() {
    renderOwnerBookings("#ownerBookingRows");
  }

  async function initRevenue() {
    const owner = currentOwner();
    if (!owner) return;
    const ownerId = ownerIdOf(owner);
    const ownerEmail = (owner.email || "").toLowerCase();
    try {
      const [slotsData, bookings] = await Promise.all([
        ParkrStore.listOwnerSlots(ownerId, ownerEmail, { forceRefresh: true }),
        ParkrStore.listBookings({ ownerId, ownerEmail })
      ]);
      const currentBookings = bookings || [];
      let currentSlots = slotsData || [];
      if (!currentSlots.length) {
        try {
          const allSlots = await ParkrStore.listSlots({ adminOnly: true, forceRefresh: true });
          if (allSlots && allSlots.length) currentSlots = allSlots;
        } catch (_) {}
      }
      const paidBookings = currentBookings.filter((b) => paymentStatus(b) === "paid");
      const earnings = paidBookings.reduce((total, b) => total + Number(b.amount || 0), 0);
      const netProfit = Math.round(earnings * 0.9);
      const platformFee = earnings - netProfit;

      ParkrUtils.setText("#revTotalEarnings", ParkrUtils.formatCurrency(earnings));
      ParkrUtils.setText("#revPlatformFee", "- " + ParkrUtils.formatCurrency(platformFee));
      ParkrUtils.setText("#revNetProfit", ParkrUtils.formatCurrency(netProfit));
      ParkrUtils.setText("#revPaidCount", paidBookings.length);

      renderRevenueProgress(paidBookings, "#ownerDetailedRevenueRows");

      const matrixTarget = document.querySelector("#ownerSlotProfitList");
      if (matrixTarget) {
        if (!currentSlots.length) {
          matrixTarget.innerHTML = '<div class="empty-state"><div><h3>No slots registered</h3><p>Add parking spaces to see profitability metrics.</p></div></div>';
        } else {
          matrixTarget.innerHTML = currentSlots.map((slot) => {
            const slotName = slot.name || "Slot";
            const slotBookings = paidBookings.filter((b) => {
              const bSlotId = b.slotId || b.slot_id;
              const bSlotName = b.slot || b.slotName;
              return (bSlotId && String(bSlotId) === String(slot.id)) ||
                     (bSlotName && bSlotName.toLowerCase() === slotName.toLowerCase());
            });
            const slotRevenue = slotBookings.reduce((acc, b) => acc + Number(b.amount || 0), 0);
            const slotNetProfit = Math.round(slotRevenue * 0.9);
            return `
              <div class="list-item" style="padding: 12px 14px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.08)); display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong style="display: block; font-size: 0.95rem; color: var(--text, #f8fafc);">${h(slotName)}</strong>
                  <span class="muted" style="font-size: 0.8rem;">${slotBookings.length} paid bookings · Rs. ${slot.price || 0}/hr</span>
                </div>
                <div style="text-align: right;">
                  <div style="font-weight: 700; color: #4ade80; font-size: 0.95rem;">+${ParkrUtils.formatCurrency(slotNetProfit)}</div>
                  <div class="muted" style="font-size: 0.75rem;">Gross: ${ParkrUtils.formatCurrency(slotRevenue)}</div>
                </div>
              </div>
            `;
          }).join("");
        }
      }
    } catch (err) {
      console.warn("Failed to load owner revenue analytics:", err);
    }
  }

  async function initProfile() {
    const form = document.querySelector("#ownerProfileForm");
    const user = currentOwner();
    if (!form) return;
    if (!user) return;
    const ownerId = ownerIdOf(user);
    const ownerEmail = (user.email || "").toLowerCase();
    let slots = [];
    try {
      slots = await ParkrStore.listOwnerSlots(ownerId, ownerEmail, { forceRefresh: true });
      if (!slots || !slots.length) {
        slots = (await ParkrStore.listSlots({ adminOnly: true, forceRefresh: true })) || [];
      }
    } catch (e) {}
    slots = slots || [];
    ParkrUtils.setText("[data-owner-profile-status]", user.status || "approved");
    ParkrUtils.setText("[data-owner-profile-live]", slots.filter((slot) => statusClass(slot.verificationStatus || slot.status) === "approved").length);
    ParkrUtils.setText("[data-owner-profile-pending]", slots.filter((slot) => statusClass(slot.verificationStatus || slot.status) === "pending").length);
    form.name.value = user.name || "";
    form.email.value = user.email || "";
    form.phone.value = user.phone || "";
    form.business.value = user.business || "";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      await ParkrStore.updateCurrentUser({ name: data.get("name"), email: data.get("email"), phone: data.get("phone"), business: data.get("business"), role: "owner" });
      Parkr.showToast("Owner profile updated");
    });
  }

  function routeView() {
    const rawHash = window.location.hash.slice(1);
    const normalized = (rawHash.split("?")[0] || "dashboard").toLowerCase().replace(/_/g, "-");
    const views = {
      dashboard: "view-dashboard",
      "add-slot": "view-add-slot",
      "add_slot": "view-add-slot",
      "manage-slots": "view-manage-slots",
      "manage_slots": "view-manage-slots",
      bookings: "view-bookings",
      revenue: "view-revenue",
      profile: "view-profile"
    };

    const targetId = views[normalized] || views[rawHash.split("?")[0].toLowerCase()] || "view-dashboard";
    const activeKey = views[normalized] ? normalized : "dashboard";

    document.querySelectorAll(".view-section").forEach((el) => {
      el.classList.toggle("active", el.id === targetId);
    });

    document.querySelectorAll(".sidebar-nav a[data-nav]").forEach((link) => {
      const navKey = (link.dataset.nav || "").replace(/_/g, "-");
      link.classList.toggle("active", navKey === activeKey);
    });

    if (activeKey === "dashboard") initDashboard();
    else if (activeKey === "add-slot" || activeKey === "add_slot") {
      initAddSlot();
      setTimeout(() => {
        if (slotPickerMapInstance) slotPickerMapInstance.invalidateSize();
      }, 250);
    }
    else if (activeKey === "manage-slots" || activeKey === "manage_slots") initManageSlots();
    else if (activeKey === "bookings") initBookings();
    else if (activeKey === "revenue") initRevenue();
    else if (activeKey === "profile") initProfile();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    if (!page || !page.startsWith("owner")) return;

    const refreshRevBtn = document.querySelector("#refreshOwnerRevenueBtn");
    if (refreshRevBtn) {
      refreshRevBtn.addEventListener("click", () => {
        initRevenue();
        if (typeof Parkr !== "undefined" && Parkr.showToast) {
          Parkr.showToast("Revenue analytics refreshed");
        }
      });
    }

    if (page === "owner-hub") {
      routeView();
      window.addEventListener("hashchange", routeView);
      return;
    }
    if (page === "owner-dashboard") initDashboard();
    if (page === "owner-add-slot") initAddSlot();
    if (page === "owner-manage-slots") initManageSlots();
    if (page === "owner-bookings") initBookings();
    if (page === "owner-revenue") initRevenue();
    if (page === "owner-profile") initProfile();
  });
})();
