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

  if (typeof window !== "undefined") {
    window.parkrDriverLocation = window.parkrDriverLocation || { lat: 11.0168, lng: 76.9558 };
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          window.parkrDriverLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        },
        () => {},
        { timeout: 3000 }
      );
    }
  }

  let searchMapInstance = null;
  let detailMapInstance = null;
  let searchRouteLayer = null;
  let searchDriverMarker = null;

  window.parkrDrawSearchRoute = async function(destLat, destLng, destName) {
    if (!searchMapInstance || typeof L === "undefined") return;

    if (typeof Parkr !== "undefined" && Parkr.showToast) {
      Parkr.showToast("Calculating route via OSRM...");
    }

    const getUserCoords = () => new Promise((resolve) => {
      const saved = localStorage.getItem("parkr_driver_origin_coords");
      let defaultCoords = [11.0289, 77.0267]; // CIT Coimbatore
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.lat && parsed.lng) defaultCoords = [parsed.lat, parsed.lng];
        } catch (_) {}
      }
      if (!navigator.geolocation) return resolve(defaultCoords);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
        () => resolve(defaultCoords),
        { enableHighAccuracy: true, timeout: 6000 }
      );
    });

    const [userLat, userLng] = await getUserCoords();
    const routeData = await ParkrUtils.getOsrmRoute(userLng, userLat, destLng, destLat);

    if (searchRouteLayer) {
      try { searchMapInstance.removeLayer(searchRouteLayer); } catch (_) {}
      searchRouteLayer = null;
    }
    if (searchDriverMarker) {
      try { searchMapInstance.removeLayer(searchDriverMarker); } catch (_) {}
      searchDriverMarker = null;
    }

    if (routeData && routeData.geometry) {
      searchRouteLayer = L.geoJSON(routeData.geometry, {
        style: { color: "#f59e0b", weight: 5, opacity: 0.88, lineJoin: "round" }
      }).addTo(searchMapInstance);

      searchDriverMarker = L.marker([userLat, userLng]).addTo(searchMapInstance)
        .bindPopup("<strong>Your Location</strong>");

      try {
        searchMapInstance.fitBounds(searchRouteLayer.getBounds().pad(0.18));
      } catch (_) {}
    }

    if (typeof Parkr !== "undefined" && Parkr.showToast) {
      if (routeData && routeData.summary) {
        Parkr.showToast(`Route to ${destName}: ${routeData.distanceKm} km · ~${routeData.durationMins} mins`);
      } else {
        Parkr.showToast(`Route line drawn to ${destName}`);
      }
    }
  };

  function renderSearchMap(slots) {
    const container = document.querySelector("#searchMap");
    if (!container || typeof L === "undefined") return;

    if (searchMapInstance) {
      try { searchMapInstance.remove(); } catch (_) {}
      searchMapInstance = null;
    }
    if (container._leaflet_id) {
      delete container._leaflet_id;
    }

    const validSlots = (slots || []).map((s, idx) => ({
      ...s,
      lat: (s.lat !== undefined && s.lat !== null && !isNaN(Number(s.lat))) ? Number(s.lat) : (11.0168 + ((idx % 4) * 0.015) - 0.02),
      lng: (s.lng !== undefined && s.lng !== null && !isNaN(Number(s.lng))) ? Number(s.lng) : (76.9558 + ((idx % 3) * 0.02) - 0.01)
    }));

    const center = validSlots.length ? [validSlots[0].lat, validSlots[0].lng] : [11.0168, 76.9558];
    searchMapInstance = L.map("searchMap", { attributionControl: false }).setView(center, 12);

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19
    }).addTo(searchMapInstance);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19
    }).addTo(searchMapInstance);

    const userLat = (window.parkrDriverLocation && window.parkrDriverLocation.lat) || 11.0168;
    const userLng = (window.parkrDriverLocation && window.parkrDriverLocation.lng) || 76.9558;

    const markers = [];
    validSlots.forEach((slot) => {
      const marker = L.marker([slot.lat, slot.lng]).addTo(searchMapInstance);
      const dLat = (slot.lat - userLat) * Math.PI / 180;
      const dLon = (slot.lng - userLng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(userLat * Math.PI / 180) * Math.cos(slot.lat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = (6371 * c).toFixed(1);
      const approxMins = Math.max(3, Math.round(dist * 2.2));

      const popupHtml = `
        <div class="map-popup-card">
          <h4>${h(slot.name)}</h4>
          <p>${h(slot.location || slot.address)}</p>
          <p><strong>${ParkrUtils.formatCurrency(slot.price)}/hr</strong> · ${slot.available} available</p>
          <p style="color: #38bdf8; font-size: 0.85rem; margin-top: 4px; font-weight: 600; display: flex; align-items: center; gap: 4px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>${dist} km away · ~${approxMins}m drive</p>
          <div style="display: flex; gap: 6px; margin-top: 8px;">
            <a class="btn btn-primary btn-small" href="#details?slot=${attr(slot.id)}">Details</a>
            <button type="button" class="btn btn-secondary btn-small" onclick="window.parkrDrawSearchRoute(${slot.lat}, ${slot.lng}, '${attr(slot.name)}')">View Route</button>
          </div>
        </div>
      `;
      marker.bindPopup(popupHtml);
      markers.push(marker);
    });

    if (markers.length > 1) {
      try {
        const group = L.featureGroup(markers);
        searchMapInstance.fitBounds(group.getBounds().pad(0.12));
      } catch (e) {}
    } else if (markers.length === 1) {
      searchMapInstance.setView([validSlots[0].lat, validSlots[0].lng], 13);
    }

    setTimeout(() => {
      if (searchMapInstance) searchMapInstance.invalidateSize();
    }, 250);
  }

  function renderDetailMap(slot) {
    const container = document.querySelector("#slotDetailMap");
    if (!container || typeof L === "undefined" || !slot) return;

    if (detailMapInstance) {
      try { detailMapInstance.remove(); } catch (_) {}
      detailMapInstance = null;
    }
    if (container._leaflet_id) {
      delete container._leaflet_id;
    }

    const lat = (slot.lat !== undefined && slot.lat !== null && !isNaN(Number(slot.lat))) ? Number(slot.lat) : 12.9716;
    const lng = (slot.lng !== undefined && slot.lng !== null && !isNaN(Number(slot.lng))) ? Number(slot.lng) : 77.5946;

    detailMapInstance = L.map("slotDetailMap", { attributionControl: false }).setView([lat, lng], 15);

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19
    }).addTo(detailMapInstance);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
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

    const todayIso = new Date().toISOString().split("T")[0];
    if (form.date) {
      form.date.min = todayIso;
    }

    const params = new URLSearchParams(window.location.search);
    const incomingLocation = params.get("location");
    if (incomingLocation && form.location) form.location.value = incomingLocation;
    const incomingVehicle = params.get("vehicle");
    if (incomingVehicle && form.vehicle) form.vehicle.value = incomingVehicle;
    const incomingDate = params.get("date");
    if (incomingDate && form.date) form.date.value = incomingDate;

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

        if ((!filtered || !filtered.length) && data.get("location") && searchMapInstance) {
          const locQuery = data.get("location").trim();
          if (locQuery.length > 2) {
            try {
              const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(locQuery)}`);
              if (resp.ok) {
                const geoData = await resp.json();
                if (geoData && geoData.length > 0) {
                  const gLat = parseFloat(geoData[0].lat);
                  const gLng = parseFloat(geoData[0].lon);
                  searchMapInstance.flyTo([gLat, gLng], 13, { duration: 0.8 });
                  L.popup().setLatLng([gLat, gLng])
                    .setContent(`<strong>${h(geoData[0].display_name.slice(0, 42))}</strong><br><span style="color:#f59e0b">No verified slots in this area yet.</span>`)
                    .openOn(searchMapInstance);
                }
              }
            } catch (_) {}
          }
        }
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
    const slotRatingNum = (slot.rating !== undefined && slot.rating !== null && !isNaN(Number(slot.rating))) ? Number(slot.rating) : 5.0;
    document.querySelectorAll("[data-slot-name]").forEach((item) => { item.textContent = slot.name; });
    document.querySelectorAll("[data-slot-address]").forEach((item) => { item.textContent = slot.address; });
    document.querySelectorAll("[data-slot-price]").forEach((item) => { item.textContent = ParkrUtils.formatCurrency(slot.price) + "/hr"; });
    document.querySelectorAll("[data-slot-rating]").forEach((item) => { item.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" stroke-width="1" style="vertical-align: -1px; margin-right: 3px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>${slotRatingNum.toFixed(1)}`; });
    document.querySelectorAll("[data-slot-available]").forEach((item) => { item.textContent = slot.available + " available"; });
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

    // Interactive Route Planning (FROM -> TO)
    const routeBtn = document.querySelector("#getSlotRouteBtn");
    const routeInfo = document.querySelector("#routeInfoDisplay");
    const originInput = document.querySelector("#routeOriginInput");
    const gpsBtn = document.querySelector("#useGpsOriginBtn");
    const destDisplay = document.querySelector("#routeDestDisplay");
    let detailRouteLayer = null;
    let detailDriverMarker = null;

    // Real Coimbatore default base (CIT Coimbatore)
    const DEFAULT_ORIGIN = {
      lat: 11.0289,
      lng: 77.0267,
      name: "Coimbatore Institute of Technology"
    };

    if (destDisplay) {
      destDisplay.textContent = slot.name || "Selected Parking Slot";
    }

    // Set initial origin value from localStorage or CIT default
    if (originInput) {
      const savedName = localStorage.getItem("parkr_driver_origin_name");
      originInput.value = savedName || DEFAULT_ORIGIN.name;
    }

    async function calculateDrivingRoute(forcedCoords = null) {
      const slotLat = (slot.lat !== undefined && slot.lat !== null && !isNaN(Number(slot.lat))) ? Number(slot.lat) : 11.03403;
      const slotLng = (slot.lng !== undefined && slot.lng !== null && !isNaN(Number(slot.lng))) ? Number(slot.lng) : 77.02842;

      if (routeBtn) {
        routeBtn.disabled = true;
        routeBtn.textContent = "Calculating route...";
      }
      if (routeInfo) {
        routeInfo.style.display = "block";
        routeInfo.innerHTML = `<span style="display:inline-flex; align-items:center; gap:6px; color:#38bdf8;">Finding driving path...</span>`;
      }

      let userLat = DEFAULT_ORIGIN.lat;
      let userLng = DEFAULT_ORIGIN.lng;
      let originLabel = DEFAULT_ORIGIN.name;

      if (forcedCoords && forcedCoords.lat && forcedCoords.lng) {
        userLat = Number(forcedCoords.lat);
        userLng = Number(forcedCoords.lng);
        originLabel = forcedCoords.name || `${userLat.toFixed(4)}, ${userLng.toFixed(4)}`;
      } else {
        const query = originInput ? originInput.value.trim() : "";
        const isCurrentLoc = !query || query.toLowerCase() === "current location" || query.toLowerCase() === "my location";

        if (isCurrentLoc) {
          try {
            const pos = await new Promise((resolve, reject) => {
              if (!navigator.geolocation) return reject(new Error("No geolocation"));
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 7000,
                maximumAge: 60000
              });
            });
            userLat = pos.coords.latitude;
            userLng = pos.coords.longitude;
            const place = await ParkrUtils.reverseGeocodeWithNominatim(userLat, userLng);
            originLabel = place ? place.split(",").slice(0, 2).join(",") : "My GPS Location";
            if (originInput) originInput.value = originLabel;
            localStorage.setItem("parkr_driver_origin_name", originLabel);
            localStorage.setItem("parkr_driver_origin_coords", JSON.stringify({ lat: userLat, lng: userLng, name: originLabel }));
          } catch (_) {
            const saved = localStorage.getItem("parkr_driver_origin_coords");
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.lat && parsed.lng) {
                  userLat = parsed.lat;
                  userLng = parsed.lng;
                  originLabel = parsed.name || DEFAULT_ORIGIN.name;
                }
              } catch (_) {}
            }
            if (originInput && (!originInput.value || originInput.value.toLowerCase().includes("location"))) {
              originInput.value = originLabel;
            }
          }
        } else {
          // Geocode custom query (e.g. "coimbatore institute of technology", "airport", "gandhipuram")
          const geoResult = await ParkrUtils.geocodeWithNominatim(query);
          if (geoResult && geoResult.lat && geoResult.lng) {
            userLat = geoResult.lat;
            userLng = geoResult.lng;
            originLabel = geoResult.displayName.split(",")[0] || query;
            localStorage.setItem("parkr_driver_origin_name", query);
            localStorage.setItem("parkr_driver_origin_coords", JSON.stringify({ lat: userLat, lng: userLng, name: originLabel }));
          } else {
            const saved = localStorage.getItem("parkr_driver_origin_coords");
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                userLat = parsed.lat;
                userLng = parsed.lng;
              } catch (_) {}
            }
            originLabel = query;
          }
        }
      }

      const routeData = await ParkrUtils.getOsrmRoute(userLng, userLat, slotLng, slotLat);

      if (detailMapInstance && routeData && routeData.geometry) {
        if (detailRouteLayer) {
          try { detailMapInstance.removeLayer(detailRouteLayer); } catch (_) {}
          detailRouteLayer = null;
        }
        if (detailDriverMarker) {
          try { detailMapInstance.removeLayer(detailDriverMarker); } catch (_) {}
          detailDriverMarker = null;
        }

        detailRouteLayer = L.geoJSON(routeData.geometry, {
          style: { color: "#f59e0b", weight: 5, opacity: 0.9, lineJoin: "round" }
        }).addTo(detailMapInstance);

        detailDriverMarker = L.marker([userLat, userLng], { draggable: true }).addTo(detailMapInstance)
          .bindPopup(`<strong>FROM: ${h(originLabel)}</strong><br><span style="font-size:0.75rem; color:#94a3b8;">Drag pin or click map to change start</span>`).openPopup();

        // Allow dragging the starting pin anywhere on the map!
        detailDriverMarker.on("dragend", async (e) => {
          const newPos = e.target.getLatLng();
          const place = await ParkrUtils.reverseGeocodeWithNominatim(newPos.lat, newPos.lng);
          const name = place ? place.split(",").slice(0, 2).join(",") : `${newPos.lat.toFixed(4)}, ${newPos.lng.toFixed(4)}`;
          if (originInput) originInput.value = name;
          localStorage.setItem("parkr_driver_origin_name", name);
          localStorage.setItem("parkr_driver_origin_coords", JSON.stringify({ lat: newPos.lat, lng: newPos.lng, name }));
          calculateDrivingRoute({ lat: newPos.lat, lng: newPos.lng, name });
        });

        try {
          detailMapInstance.fitBounds(detailRouteLayer.getBounds().pad(0.18));
        } catch (_) {}
      }

      if (routeInfo) {
        if (routeData && routeData.distanceKm !== null) {
          routeInfo.innerHTML = `<span style="display:inline-flex; align-items:center; gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg><strong>Route:</strong> ${routeData.distanceKm} km · ~${routeData.durationMins} mins</span>`;
        } else {
          routeInfo.innerHTML = `<span style="display:inline-flex; align-items:center; gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Route line drawn from ${h(originLabel)} to slot</span>`;
        }
      }

      if (routeBtn) {
        routeBtn.disabled = false;
        routeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>Refresh Route`;
      }
    }

    // Clicking anywhere on map also moves origin and recalculates route
    if (detailMapInstance) {
      detailMapInstance.on("click", async (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        const place = await ParkrUtils.reverseGeocodeWithNominatim(lat, lng);
        const name = place ? place.split(",").slice(0, 2).join(",") : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        if (originInput) originInput.value = name;
        localStorage.setItem("parkr_driver_origin_name", name);
        localStorage.setItem("parkr_driver_origin_coords", JSON.stringify({ lat, lng, name }));
        calculateDrivingRoute({ lat, lng, name });
      });
    }

    if (routeBtn) {
      routeBtn.onclick = () => calculateDrivingRoute();
    }

    if (gpsBtn) {
      gpsBtn.onclick = async () => {
        gpsBtn.disabled = true;
        gpsBtn.textContent = "Locating...";
        if (routeInfo) {
          routeInfo.style.display = "block";
          routeInfo.innerHTML = `<span style="color:#38bdf8;">Acquiring live GPS position...</span>`;
        }
        try {
          const pos = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) return reject(new Error("No geolocation available"));
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 30000
            });
          });
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const place = await ParkrUtils.reverseGeocodeWithNominatim(lat, lng);
          const name = place ? place.split(",").slice(0, 2).join(",") : "My GPS Location";
          if (originInput) originInput.value = name;
          localStorage.setItem("parkr_driver_origin_name", name);
          localStorage.setItem("parkr_driver_origin_coords", JSON.stringify({ lat, lng, name }));
          if (typeof Parkr !== "undefined" && Parkr.showToast) {
            Parkr.showToast(`GPS location: ${name}`);
          }
          await calculateDrivingRoute({ lat, lng, name });
        } catch (err) {
          console.warn("GPS error:", err.message);
          if (typeof Parkr !== "undefined" && Parkr.showToast) {
            Parkr.showToast("Could not access live GPS. Using Coimbatore campus location.", "warning");
          }
          if (originInput) originInput.value = DEFAULT_ORIGIN.name;
          await calculateDrivingRoute(DEFAULT_ORIGIN);
        } finally {
          gpsBtn.disabled = false;
          gpsBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>GPS`;
        }
      };
    }

    if (originInput) {
      originInput.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          calculateDrivingRoute();
        }
      };
    }

    // Automatically calculate initial driving route upon opening details
    setTimeout(() => {
      calculateDrivingRoute();
    }, 350);

    // Reviews list and review submission
    const reviewsList = document.querySelector("#slotReviewsList");
    const toggleBtn = document.querySelector("#toggleReviewBtn");
    const writeForm = document.querySelector("#writeReviewForm");
    const cancelBtn = document.querySelector("#cancelReviewBtn");
    const driverNameInput = document.querySelector("#reviewDriverName");

    const driverUser = currentDriver();
    if (driverUser && driverNameInput && !driverNameInput.value) {
      driverNameInput.value = driverUser.name || driverUser.fullName || driverUser.email || "";
    }

    // Interactive Star Rating Widget
    const starContainer = document.querySelector("#interactiveStars");
    const ratingInput = document.querySelector("#reviewRating");
    const starLabel = document.querySelector("#starRatingLabel");
    const ratingLabels = {
      1: "1 Star · Terrible",
      2: "2 Stars · Poor",
      3: "3 Stars · Average",
      4: "4 Stars · Good",
      5: "5 Stars · Excellent"
    };

    if (starContainer && !starContainer.dataset.bound) {
      starContainer.dataset.bound = "true";
      const stars = starContainer.querySelectorAll(".star-item");

      const updateStars = (val) => {
        stars.forEach((s) => {
          const sVal = Number(s.dataset.value);
          s.classList.toggle("is-active", sVal <= val);
        });
      };

      stars.forEach((star) => {
        star.addEventListener("mouseenter", () => {
          const val = Number(star.dataset.value);
          stars.forEach((s) => {
            const sVal = Number(s.dataset.value);
            s.classList.toggle("is-hovered", sVal <= val);
          });
          if (starLabel) starLabel.textContent = ratingLabels[val] || `${val} Stars`;
        });

        star.addEventListener("mouseleave", () => {
          stars.forEach((s) => s.classList.remove("is-hovered"));
          const currentVal = Number(ratingInput ? ratingInput.value : 5);
          if (starLabel) starLabel.textContent = ratingLabels[currentVal] || `${currentVal} Stars`;
        });

        star.addEventListener("click", () => {
          const val = Number(star.dataset.value);
          if (ratingInput) ratingInput.value = val;
          updateStars(val);
          if (starLabel) starLabel.textContent = ratingLabels[val] || `${val} Stars`;
        });
      });
    }

    if (toggleBtn && !toggleBtn.dataset.bound) {
      toggleBtn.dataset.bound = "true";
      toggleBtn.addEventListener("click", () => {
        if (!writeForm) return;
        const isHidden = writeForm.style.display === "none";
        writeForm.style.display = isHidden ? "flex" : "none";
        writeForm.style.flexDirection = "column";
        toggleBtn.textContent = isHidden ? "Close Form" : "Write a Review";
        if (isHidden) {
          const nameInput = writeForm.querySelector("#reviewDriverName");
          const curDriver = currentDriver();
          if (nameInput && !nameInput.value && curDriver && curDriver.name) {
            nameInput.value = curDriver.name;
          }
        }
      });
    }

    if (cancelBtn && !cancelBtn.dataset.bound) {
      cancelBtn.dataset.bound = "true";
      cancelBtn.addEventListener("click", () => {
        if (writeForm) writeForm.style.display = "none";
        if (toggleBtn) toggleBtn.textContent = "Write a Review";
      });
    }

    if (writeForm && !writeForm.dataset.bound) {
      writeForm.dataset.bound = "true";
      writeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = writeForm.querySelector("#submitReviewBtn");
        if (submitBtn) submitBtn.disabled = true;
        try {
          const commentInput = writeForm.querySelector("#reviewComment");
          const nameInput = writeForm.querySelector("#reviewDriverName");
          const curDriver = currentDriver();
          const reviewData = {
            slotId: slot.id,
            slotName: slot.name,
            driverId: driverIdOf(curDriver),
            driverName: nameInput ? nameInput.value.trim() : (curDriver ? curDriver.name : "Driver"),
            rating: Number(ratingInput ? ratingInput.value : 5),
            comment: commentInput ? commentInput.value.trim() : ""
          };
          await ParkrStore.saveReview(reviewData);
          if (commentInput) commentInput.value = "";
          writeForm.style.display = "none";
          if (toggleBtn) toggleBtn.textContent = "Write a Review";
          await initDetails();
        } catch (err) {
          console.error("Failed to submit review:", err);
          alert("Failed to submit review. Please try again.");
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    if (reviewsList) {
      try {
        const reviews = await ParkrStore.listReviews(slot.id);
        if (!reviews || !reviews.length) {
          reviewsList.innerHTML = `<p class="muted" style="text-align: center; padding: 16px 0;">No reviews yet for this slot. Be the first to share your experience!</p>`;
        } else {
          const avgRating = reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviews.length;
          document.querySelectorAll("[data-slot-rating]").forEach((item) => {
            item.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" stroke-width="1" style="vertical-align: -1px; margin-right: 3px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>${avgRating.toFixed(1)} (${reviews.length} ${reviews.length === 1 ? "review" : "reviews"})`;
          });

          reviewsList.innerHTML = reviews.map((r) => {
            const count = Math.max(1, Math.min(5, Number(r.rating) || 5));
            const starsSvg = Array.from({ length: 5 }, (_, i) => {
              const filled = i < count;
              return `<svg width="13" height="13" viewBox="0 0 24 24" fill="${filled ? '#fbbf24' : 'none'}" stroke="${filled ? '#fbbf24' : '#64748b'}" stroke-width="1.5" style="display:inline-block; vertical-align:-1px; margin-right:1px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            }).join("");
            const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "Recent";
            return `
              <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 12px 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <div>
                    <strong style="color: #f8fafc; font-size: 0.92rem;">${h(r.driverName || "Driver")}</strong>
                    <span style="margin-left: 8px; display: inline-flex; align-items: center;">${starsSvg}</span>
                  </div>
                  <span class="muted" style="font-size: 0.78rem;">${dateStr}</span>
                </div>
                <p style="margin: 0; font-size: 0.88rem; color: #cbd5e1; line-height: 1.45;">${h(r.comment || "")}</p>
              </div>
            `;
          }).join("");
        }
      } catch (err) {
        reviewsList.innerHTML = `<p class="muted">Could not load reviews.</p>`;
      }
    }
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

    const bookingDateInput = document.querySelector("#bookingDate");
    const todayIso = new Date().toISOString().split("T")[0];
    if (bookingDateInput) {
      bookingDateInput.min = todayIso;
      if (!bookingDateInput.value) bookingDateInput.value = todayIso;
    }

    const paymentModeSelect = document.querySelector("#paymentMode");
    const paymentDetailText = document.querySelector("#paymentDetailText");
    const paymentChannelIcon = document.querySelector("#paymentChannelIcon");
    const paymentChannelTitle = document.querySelector("#paymentChannelTitle");
    const paymentChannelBadge = document.querySelector("#paymentChannelBadge");
    const paymentMetaPill = document.querySelector("#paymentMetaPill");

    const updatePaymentInfo = () => {
      if (!paymentModeSelect) return;
      const mode = paymentModeSelect.value;

      if (mode === "UPI") {
        if (paymentChannelIcon) paymentChannelIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`;
        if (paymentChannelTitle) paymentChannelTitle.textContent = "UPI Instant Payment";
        if (paymentChannelBadge) paymentChannelBadge.textContent = "Instant Verification";
        if (paymentDetailText) paymentDetailText.textContent = "Zero-fee digital payment. Instant automated verification upon booking confirmation.";
        if (paymentMetaPill) paymentMetaPill.textContent = "VPA: parkr.pay@upi · 0% Convenience Fee";
      } else if (mode === "Card") {
        if (paymentChannelIcon) paymentChannelIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;
        if (paymentChannelTitle) paymentChannelTitle.textContent = "Credit / Debit Card";
        if (paymentChannelBadge) paymentChannelBadge.textContent = "Sandbox Verified";
        if (paymentDetailText) paymentDetailText.textContent = "Secure instant card processing with automated 3D-Secure transaction simulation.";
        if (paymentMetaPill) paymentMetaPill.textContent = "Card: 4111 •••• •••• 1111 · Exp: 12/28";
      } else if (mode === "Cash") {
        if (paymentChannelIcon) paymentChannelIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>`;
        if (paymentChannelTitle) paymentChannelTitle.textContent = "Cash on Arrival";
        if (paymentChannelBadge) paymentChannelBadge.textContent = "Pay at Counter";
        if (paymentDetailText) paymentDetailText.textContent = "Spot is reserved immediately. Present your booking ID and complete payment at the slot entry counter.";
        if (paymentMetaPill) paymentMetaPill.textContent = "Instant Spot Hold · Gate Verification";
      } else {
        if (paymentChannelIcon) paymentChannelIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="5 6 12 3 19 6"/><line x1="4" y1="10" x2="4" y2="21"/><line x1="20" y1="10" x2="20" y2="21"/><line x1="8" y1="14" x2="8" y2="17"/><line x1="12" y1="14" x2="12" y2="17"/><line x1="16" y1="14" x2="16" y2="17"/></svg>`;
        if (paymentChannelTitle) paymentChannelTitle.textContent = "Direct Bank Transfer";
        if (paymentChannelBadge) paymentChannelBadge.textContent = "IMPS / NEFT";
        if (paymentDetailText) paymentDetailText.textContent = "Direct institutional transfer with automated reference reconciliation and immediate spot reservation.";
        if (paymentMetaPill) paymentMetaPill.textContent = "Ref: PARKR-INSTANT · Auto Reconciled";
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
      const chosenDate = data.get("date");
      const currentToday = new Date().toISOString().split("T")[0];
      if (chosenDate && chosenDate < currentToday) {
        Parkr.showToast("Cannot book parking for past dates.");
        return;
      }
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
      const isPaid = paymentStatus(booking) === "paid";
      const targetSlotId = booking.slotId || booking.id;
      const actionCell = isHistoryTable
        ? `<td>${isCancelled
            ? `<button class="btn btn-danger btn-small" type="button" data-delete-booking="${attr(booking.id || booking.bookingId)}" data-booking-code="${ParkrUtils.displayId(booking, "BK", index)}">Delete</button>`
            : `<div class="inline-actions" style="gap: 6px;"><button class="btn btn-secondary btn-small" type="button" data-cancel-booking="${attr(booking.id || booking.bookingId)}">Cancel</button>${isPaid && targetSlotId ? `<a class="btn btn-primary btn-small" href="#details?slot=${encodeURIComponent(targetSlotId)}">Review</a>` : ""}</div>`}</td>`
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
      const deleteButton = event.target.closest("[data-delete-booking]");
      if (deleteButton) {
        const bookingCode = deleteButton.dataset.bookingCode || "this booking";
        const confirmed = await Parkr.openFormDialog({
          title: "Delete cancelled booking",
          description: `Delete ${bookingCode} from your booking history?`,
          submitLabel: "Delete from history",
          submitClass: "btn btn-danger",
          fields: []
        });
        if (!confirmed) return;
        await ParkrStore.deleteBooking(deleteButton.dataset.deleteBooking);
        Parkr.showToast("Booking removed from history");
        initHistory();
        return;
      }

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
