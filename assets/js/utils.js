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
    const available = Number(slot.available || slot.availableSlots || 0);
    const rating = Number(slot.rating || 4.5).toFixed(1).replace(".0", "");
    const safeSlotId = escapeAttr(slot.id || slot.slotId || "");
    const isDriverPage = typeof window !== "undefined" && window.location.pathname.includes("driver.html");
    const targetBase = isDriverPage ? "" : "driver.html";
    const detailsUrl = `${targetBase}#details?slot=${safeSlotId}`;
    const bookingUrl = `${targetBase}#booking?slot=${safeSlotId}`;

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
            <span>${escapeHtml(vehicle)}</span>
            <span>${available} slots left</span>
            <span>${rating} rating</span>
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
    setText
  };
})(window);
