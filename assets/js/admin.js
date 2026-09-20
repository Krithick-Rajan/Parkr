(function () {
  function statusClass(status) {
    return ParkrUtils.statusToken ? ParkrUtils.statusToken(status) : String(status || "pending").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  }

  function recordId(row) {
    return row.id || row.userId || row.slotId || row.bookingId || row.paymentId || row.email;
  }

  function h(value) {
    return ParkrUtils.escapeHtml ? ParkrUtils.escapeHtml(value) : String(value ?? "");
  }

  function attr(value) {
    return ParkrUtils.escapeAttr ? ParkrUtils.escapeAttr(value) : h(value);
  }

  function paymentStatus(booking) {
    return ParkrUtils.paymentStatus ? ParkrUtils.paymentStatus(booking) : statusClass((booking || {}).status);
  }

  function setTableLoading(target, colspan, message) {
    target.innerHTML = `<tr><td colspan="${colspan}" class="muted" style="text-align: center; padding: 24px 14px;">${h(message || "Loading...")}</td></tr>`;
  }

  async function renderUsers() {
    const target = document.querySelector("#adminUserRows");
    if (!target) return;
    try {
      const users = await ParkrStore.listUsers();
      if (!users || !users.length) {
        target.innerHTML = '<tr><td colspan="6" class="muted" style="text-align: center; padding: 24px 14px;">No users registered yet.</td></tr>';
        return;
      }
      const current = ParkrStore.getCurrentUser();
      const currentId = current && recordId(current);
      target.innerHTML = users.map((user, index) => {
        const userId = recordId(user);
        const status = statusClass(user.status);
        const isSelf = userId === currentId;
        const blockAction = status === "blocked" ? "approved" : "blocked";
        const blockLabel = status === "blocked" ? "Unblock" : "Block";
        const approveLabel = status === "approved" ? "Approved" : "Approve";
        const userStatus = user.status || "pending";
        return `
          <tr>
            <td>${ParkrUtils.displayId(user, "USR", index)}</td>
            <td>${h(user.name)}</td>
            <td>${h(user.email)}</td>
            <td>${h(user.role)}</td>
            <td><span class="status ${status}">${h(userStatus)}</span></td>
            <td class="inline-actions">
              <button class="btn btn-secondary btn-small" type="button" data-user-action="approved" data-user-id="${attr(userId)}"${status === "approved" ? " disabled" : ""}>${approveLabel}</button>
              <button class="btn btn-secondary btn-small" type="button" data-user-action="${attr(blockAction)}" data-user-id="${attr(userId)}"${isSelf ? " disabled" : ""}>${h(blockLabel)}</button>
              <button class="btn btn-danger btn-small" type="button" data-delete-user="${attr(userId)}" data-user-name="${attr(user.name)}"${isSelf ? " disabled" : ""}>Delete</button>
            </td>
          </tr>
        `;
      }).join("");
    } catch (err) {
      console.warn("Failed to render users:", err);
      target.innerHTML = '<tr><td colspan="6" class="muted" style="text-align: center; padding: 24px 14px;">No users registered yet.</td></tr>';
    }
  }

  async function renderVerifySlots(selector, options) {
    const target = document.querySelector(selector || "#verifySlotRows");
    if (!target) return;
    const settings = options || {};
    try {
      let slots = await ParkrStore.listSlots({ adminOnly: true });
      if (settings.pendingOnly) slots = (slots || []).filter((slot) => statusClass(slot.verificationStatus || slot.status) === "pending");
      if (!slots || !slots.length) {
        target.innerHTML = `<tr><td colspan="6" class="muted" style="text-align: center; padding: 24px 14px;">${settings.pendingOnly ? "No pending slots waiting for approval." : "No owner slots submitted yet."}</td></tr>`;
        return;
      }
      target.innerHTML = slots.map((slot, index) => {
        const displayStatus = slot.verificationStatus || slot.status;
        const status = statusClass(displayStatus);
        const approveDisabled = status === "approved";
        const rejectDisabled = status === "rejected";
        return `
          <tr>
            <td>${ParkrUtils.displayId(slot, "SL", index)}</td>
            <td>${h(slot.name)}</td>
            <td>${h(slot.vehicleType || slot.vehicle)}</td>
            <td>${ParkrUtils.formatCurrency(slot.price)}</td>
            <td><span class="status ${status}">${h(displayStatus)}</span></td>
            <td class="inline-actions">
              <button class="btn btn-primary btn-small" type="button" data-slot-action="approved" data-slot-id="${attr(slot.id)}"${approveDisabled ? " disabled" : ""}>${approveDisabled ? "Approved" : "Approve"}</button>
              <button class="btn btn-danger btn-small" type="button" data-slot-action="rejected" data-slot-id="${attr(slot.id)}"${rejectDisabled ? " disabled" : ""}>${rejectDisabled ? "Reject" : "Reject"}</button>
            </td>
          </tr>
        `;
      }).join("");
    } catch (err) {
      console.warn("Failed to render verify slots:", err);
      target.innerHTML = `<tr><td colspan="6" class="muted" style="text-align: center; padding: 24px 14px;">${settings.pendingOnly ? "No pending slots waiting for approval." : "No owner slots submitted yet."}</td></tr>`;
    }
  }

  async function renderBookings() {
    const target = document.querySelector("#adminBookingRows");
    if (!target) return;
    try {
      const bookings = await ParkrStore.listBookings();
      if (!bookings || !bookings.length) {
        target.innerHTML = '<tr><td colspan="7" class="muted" style="text-align: center; padding: 24px 14px;">No bookings yet.</td></tr>';
        return;
      }
      target.innerHTML = bookings.map((booking, index) => {
        const isCancelled = booking.status === "cancelled";
        return `
          <tr>
            <td>${ParkrUtils.displayId(booking, "BK", index)}</td>
            <td>${h(booking.driver)}</td>
            <td>${h(booking.slot)}</td>
            <td>${h(booking.date || booking.bookingDate)}</td>
            <td>${ParkrUtils.formatCurrency(booking.amount)}</td>
            <td><span class="status ${paymentStatus(booking)}">${paymentStatus(booking)}</span></td>
            <td>
              <button class="btn btn-secondary btn-small" type="button" data-cancel-booking="${attr(booking.id)}"${isCancelled ? " disabled" : ""}>${isCancelled ? "Cancelled" : "Cancel"}</button>
            </td>
          </tr>
        `;
      }).join("");
    } catch (err) {
      console.warn("Failed to render admin bookings:", err);
      target.innerHTML = '<tr><td colspan="7" class="muted" style="text-align: center; padding: 24px 14px;">No bookings yet.</td></tr>';
    }
  }

  function renderActionCenter(reports, slots, bookings) {
    const target = document.querySelector("#adminActionCenter");
    const pendingSlots = slots.filter((slot) => statusClass(slot.verificationStatus || slot.status) === "pending");
    const paidBookings = bookings.filter((booking) => paymentStatus(booking) === "paid");
    const pendingPayments = bookings.filter((booking) => paymentStatus(booking) === "pending");
    ParkrUtils.setText("[data-admin-pending-slots]", pendingSlots.length);
    ParkrUtils.setText("[data-admin-paid-bookings]", paidBookings.length);
    ParkrUtils.setText("[data-admin-pending-payments]", pendingPayments.length);
    const isHub = document.body && document.body.dataset.page === "admin-hub";
    const actions = [
      { title: "Verify owner slots", detail: pendingSlots.length + " waiting for approval", href: isHub ? "#verify-slots" : "verify-slots.html", label: "Verify" },
      { title: "Review paid bookings", detail: paidBookings.length + " paid reservations recorded", href: isHub ? "#manage-bookings" : "manage-bookings.html", label: "Open" },
      { title: "Manage platform users", detail: reports.users + " accounts across driver, owner, and admin", href: isHub ? "#manage-users" : "manage-users.html", label: "Manage" }
    ];
    target.innerHTML = actions.map((item) => `
      <div class="list-row">
        <div>
          <strong>${h(item.title)}</strong>
          <p class="muted">${h(item.detail)}</p>
        </div>
        <a class="btn btn-secondary btn-small" href="${attr(item.href)}">${h(item.label)}</a>
      </div>
    `).join("");
  }

  async function initDashboard() {
    try {
      const [reports, slots, bookings] = await Promise.all([
        ParkrStore.getReports(),
        ParkrStore.listSlots({ adminOnly: true }),
        ParkrStore.listBookings()
      ]);
      const currentReports = reports || { users: 0, slots: 0, bookings: 0, revenue: 0 };
      const currentSlots = slots || [];
      const currentBookings = bookings || [];
      ParkrUtils.setText("[data-admin-users]", currentReports.users || 0);
      ParkrUtils.setText("[data-admin-slots]", currentReports.slots || 0);
      ParkrUtils.setText("[data-admin-bookings]", currentReports.bookings || 0);
      ParkrUtils.setText("[data-admin-revenue]", ParkrUtils.formatCurrency(currentReports.revenue || 0));
      renderActionCenter(currentReports, currentSlots, currentBookings);
      renderVerifySlots("#adminPendingSlotRows", { pendingOnly: true });
    } catch (err) {
      console.warn("Failed to init admin dashboard:", err);
      ParkrUtils.setText("[data-admin-users]", "0");
      ParkrUtils.setText("[data-admin-slots]", "0");
      ParkrUtils.setText("[data-admin-bookings]", "0");
      ParkrUtils.setText("[data-admin-revenue]", ParkrUtils.formatCurrency(0));
      renderVerifySlots("#adminPendingSlotRows", { pendingOnly: true });
    }
  }

  async function renderReportsPage() {
    try {
      const [reports, slots, bookings] = await Promise.all([
        ParkrStore.getReports(),
        ParkrStore.listSlots({ adminOnly: true }),
        ParkrStore.listBookings()
      ]);
      const currentReports = reports || { users: 0, slots: 0, bookings: 0, revenue: 0 };
      const currentSlots = slots || [];
      const currentBookings = bookings || [];
      ParkrUtils.setText("[data-report-users]", currentReports.users || 0);
      ParkrUtils.setText("[data-report-slots]", currentReports.slots || 0);
      ParkrUtils.setText("[data-report-bookings]", currentReports.bookings || 0);
      ParkrUtils.setText("[data-report-revenue]", ParkrUtils.formatCurrency(currentReports.revenue || 0));
      ParkrUtils.setText("[data-report-pending]", currentSlots.filter((slot) => statusClass(slot.verificationStatus || slot.status) === "pending").length);
      ParkrUtils.setText("[data-report-approved]", currentSlots.filter((slot) => statusClass(slot.verificationStatus || slot.status) === "approved").length);

      const target = document.querySelector("#adminRevenueRows");
      if (!target) return;
      if (!currentBookings.length) {
        target.innerHTML = `
          <div class="empty-state">
            <div>
              <h3>No booking revenue yet</h3>
              <p>Revenue appears after drivers book approved owner slots.</p>
            </div>
          </div>
        `;
        return;
      }
      const paidBookings = currentBookings.filter((booking) => paymentStatus(booking) === "paid");
      if (!paidBookings.length) {
        target.innerHTML = `
          <div class="empty-state">
            <div>
              <h3>No paid booking revenue yet</h3>
              <p>Paid driver bookings will appear here.</p>
            </div>
          </div>
        `;
        return;
      }
      const revenueBySlot = paidBookings.reduce((map, booking) => {
        const name = booking.slot || "Parking slot";
        map[name] = (map[name] || 0) + Number(booking.amount || 0);
        return map;
      }, {});
      const max = Math.max(...Object.values(revenueBySlot), 1);
      target.innerHTML = Object.entries(revenueBySlot).map(([name, amount]) => {
        const percent = Math.max(Math.round((amount / max) * 100), 4);
        return `
          <div class="progress-row">
            <div class="progress-label"><span>${h(name)}</span><strong>${ParkrUtils.formatCurrency(amount)}</strong></div>
            <div class="progress-track"><span style="width:${percent}%"></span></div>
          </div>
        `;
      }).join("");
    } catch (err) {
      console.warn("Failed to render reports page:", err);
    }
  }

  function routeView() {
    const rawHash = window.location.hash.slice(1);
    const view = (rawHash.split("?")[0] || "dashboard").toLowerCase();
    const views = {
      dashboard: "view-dashboard",
      "manage-users": "view-manage-users",
      "verify-slots": "view-verify-slots",
      "manage-bookings": "view-manage-bookings",
      reports: "view-reports"
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
    else if (activeKey === "manage-users") renderUsers();
    else if (activeKey === "verify-slots") renderVerifySlots();
    else if (activeKey === "manage-bookings") renderBookings();
    else if (activeKey === "reports") renderReportsPage();
  }

  function bindAdminActions() {
    function refreshPage() {
      const page = document.body.dataset.page;
      if (page === "admin-hub") {
        routeView();
        return;
      }
      if (page === "admin-dashboard") initDashboard();
      if (page === "admin-users") renderUsers();
      if (page === "admin-verify-slots") renderVerifySlots();
      if (page === "admin-bookings") renderBookings();
      if (page === "admin-reports") renderReportsPage();
    }

    document.addEventListener("click", async (event) => {
      const userActionButton = event.target.closest("[data-user-action]");
      if (userActionButton) {
        if (userActionButton.disabled) return;
        await ParkrStore.updateUserStatus(userActionButton.dataset.userId, userActionButton.dataset.userAction);
        Parkr.showToast("User " + userActionButton.dataset.userAction);
        refreshPage();
        return;
      }

      const deleteUserButton = event.target.closest("[data-delete-user]");
      if (deleteUserButton) {
        const result = await Parkr.openFormDialog({
          title: "Delete user",
          description: "Delete " + (deleteUserButton.dataset.userName || "this user") + " from Parkr?",
          submitLabel: "Delete user",
          submitClass: "btn btn-danger",
          fields: []
        });
        if (!result) return;
        await ParkrStore.deleteUser(deleteUserButton.dataset.deleteUser);
        Parkr.showToast("User deleted");
        refreshPage();
        return;
      }

      const slotButton = event.target.closest("[data-slot-action]");
      if (slotButton) {
        if (slotButton.disabled) return;
        await ParkrStore.updateSlotStatus(slotButton.dataset.slotId, slotButton.dataset.slotAction);
        Parkr.showToast("Slot " + slotButton.dataset.slotAction);
        refreshPage();
        return;
      }

      const cancelBookingButton = event.target.closest("[data-cancel-booking]");
      if (cancelBookingButton && !cancelBookingButton.disabled) {
        const confirmed = await Parkr.openFormDialog({
          title: "Cancel booking",
          description: "Cancel this booking on the platform?",
          submitLabel: "Cancel booking",
          submitClass: "btn btn-danger",
          fields: []
        });
        if (!confirmed) return;
        await ParkrStore.updateBookingStatus(cancelBookingButton.dataset.cancelBooking, "cancelled");
        const allBookings = await ParkrStore.listBookings();
        const targetBooking = allBookings.find((b) => b.id === cancelBookingButton.dataset.cancelBooking || b.bookingId === cancelBookingButton.dataset.cancelBooking);
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
        refreshPage();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    if (!page || !page.startsWith("admin")) return;
    bindAdminActions();
    if (page === "admin-hub") {
      routeView();
      window.addEventListener("hashchange", routeView);
      return;
    }
    if (page === "admin-dashboard") initDashboard();
    if (page === "admin-users") renderUsers();
    if (page === "admin-verify-slots") renderVerifySlots();
    if (page === "admin-bookings") renderBookings();
    if (page === "admin-reports") renderReportsPage();
  });
})();
