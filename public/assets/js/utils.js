(function (global) {
  function formatCurrency(value) {
    return "Rs. " + Number(value || 0).toLocaleString("en-IN");
  }

  function getQueryParam(name) {
    const hash = global.location.hash || "";
    const queryInHash = hash.includes("?") ? hash.split("?")[1] : "";
    const params = new URLSearchParams(queryInHash || global.location.search);
    return params.get(name);
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function statusToken(value) {
    return normalize(value).replace(/[^a-z0-9_-]+/g, "-") || "pending";
  }

  function displayId(row, prefix, index) {
    const record = row || {};
    const candidates = [
      record.displayId,
      record.publicId,
      record.userCode,
      record.slotCode,
      record.bookingCode,
      record.paymentCode,
      record.userId,
      record.slotId,
      record.bookingId,
      record.paymentId,
      record.id
    ];
    const pattern = new RegExp("^" + prefix + "-\\d{3}$", "i");
    const readable = candidates.find((value) => pattern.test(String(value || "")));
    if (readable) return String(readable).toUpperCase();
    if (Number.isInteger(index)) return prefix + "-" + String(index + 1).padStart(3, "0");
    const fallback = candidates.find(Boolean);
    return fallback ? String(fallback) : prefix + "-001";
  }

  function paymentStatus(record) {
    const status = normalize((record || {}).paymentStatus || (record || {}).status);
    if (["paid", "success", "confirmed", "completed"].includes(status)) return "paid";
    return status || "pending";
  }

  function isPaid(record) {
    return paymentStatus(record) === "paid";
  }

  function renderSlotCard(slot, options) {
    const opts = typeof options === "object" && options !== null ? options : { basePath: typeof options === "string" ? options : "" };
    const basePath = opts.basePath || "";
    const displayStatus = slot.availabilityStatus || (slot.status === "approved" ? "available" : slot.status);
    const vehicle = slot.vehicleType || slot.vehicle || "Vehicle";
    const numRating = (slot.rating !== undefined && slot.rating !== null && !isNaN(Number(slot.rating))) ? Number(slot.rating) : 5.0;
    const ratingDisplay = numRating > 0 ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" stroke-width="1" style="vertical-align: -1px; margin-right: 3px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>${numRating.toFixed(1)} rating` : "New slot";
    const availableCount = Number(slot.available ?? slot.availableSlots ?? slot.total ?? 0);
    const safeSlotId = escapeAttr(slot.id || slot.slotId || "");
    const isDriverPage = typeof window !== "undefined" && window.location.pathname.includes("driver.html");
    const targetBase = isDriverPage ? "" : "driver.html";
    const detailsUrl = `${targetBase}#details?slot=${safeSlotId}`;
    const bookingUrl = `${targetBase}#booking?slot=${safeSlotId}`;

    // Distance calculation
    let distanceBadge = "";
    const slotLat = Number(slot.lat || (slot.coordinates && slot.coordinates.lat));
    const slotLng = Number(slot.lng || (slot.coordinates && slot.coordinates.lng));
    if (!isNaN(slotLat) && !isNaN(slotLng) && slotLat !== 0) {
      const userLat = (typeof window !== "undefined" && window.parkrDriverLocation && window.parkrDriverLocation.lat) || 11.0168;
      const userLng = (typeof window !== "undefined" && window.parkrDriverLocation && window.parkrDriverLocation.lng) || 76.9558;
      const dLat = (slotLat - userLat) * Math.PI / 180;
      const dLon = (slotLng - userLng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(userLat * Math.PI / 180) * Math.cos(slotLat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = (6371 * c).toFixed(1);
      const approxMins = Math.max(3, Math.round(dist * 2.2));
      distanceBadge = `<span style="color: #38bdf8; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>${dist} km (~${approxMins}m)</span>`;
    }

    return `
      <article class="slot-card">
        <div class="card-media ${escapeAttr(slot.imageClass || "")}" ${slot.imageUrl ? `style="background-image: url('${escapeAttr(slot.imageUrl)}'); background-size: cover; background-position: center;"` : ""} role="img" aria-label="${escapeAttr(slot.name)} parking photo"></div>
        <div class="card-body">
          <div class="panel-header">
            <div>
              <h3>${escapeHtml(slot.name)}</h3>
              <p class="muted">${escapeHtml(slot.address)}</p>
            </div>
            <span class="status ${statusToken(displayStatus)}">${escapeHtml(displayStatus)}</span>
          </div>
          <div class="slot-meta">
            <span>${formatCurrency(slot.price)} / hour</span>
            <span>${escapeHtml(String(vehicle).replace(/\s*\(.*?\)/g, "").trim())}</span>
            <span>${availableCount} slots left</span>
            ${distanceBadge ? `<span>${distanceBadge}</span>` : ""}
            <span>${ratingDisplay}</span>
          </div>
          <div class="inline-actions">
            <a class="btn btn-primary" href="${detailsUrl}">View Details</a>
            <a class="btn btn-secondary" href="${bookingUrl}">Book</a>
          </div>
        </div>
      </article>
    `;
  }

  function setText(selector, value, root) {
    (root || document).querySelectorAll(selector).forEach((target) => {
      target.textContent = value;
    });
  }

  async function getOsrmRoute(startLng, startLat, endLng, endLat) {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("OSRM routing service unavailable");
      const data = await resp.json();
      if (!data.routes || !data.routes.length) throw new Error("No route found");
      const route = data.routes[0];
      const distanceKm = (route.distance / 1000).toFixed(1);
      const durationMins = Math.max(1, Math.round(route.duration / 60));
      return {
        distanceKm: Number(distanceKm),
        durationMins,
        geometry: route.geometry,
        summary: `${distanceKm} km · ~${durationMins} mins drive`
      };
    } catch (err) {
      console.warn("[OSRM] Route request error:", err.message);
      return {
        distanceKm: null,
        durationMins: null,
        geometry: {
          type: "LineString",
          coordinates: [[Number(startLng), Number(startLat)], [Number(endLng), Number(endLat)]]
        },
        summary: null
      };
    }
  }

  async function geocodeWithNominatim(query) {
    try {
      if (!query || !query.trim()) return null;
      const clean = query.trim();
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(clean)}`;
      const resp = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!data || !data.length) return null;
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
    } catch (err) {
      console.warn("[Nominatim] Geocode error:", err.message);
      return null;
    }
  }

  async function reverseGeocodeWithNominatim(lat, lng) {
    try {
      if (lat === undefined || lng === undefined || isNaN(Number(lat)) || isNaN(Number(lng))) return null;
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${Number(lat)}&lon=${Number(lng)}`;
      const resp = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data && data.display_name ? data.display_name : null;
    } catch (err) {
      console.warn("[Nominatim] Reverse geocode error:", err.message);
      return null;
    }
  }

  global.ParkrUtils = {
    formatCurrency,
    getQueryParam,
    normalize,
    escapeHtml,
    escapeAttr,
    statusToken,
    displayId,
    paymentStatus,
    isPaid,
    renderSlotCard,
    setText,
    getOsrmRoute,
    geocodeWithNominatim,
    reverseGeocodeWithNominatim
  };
})(window);
