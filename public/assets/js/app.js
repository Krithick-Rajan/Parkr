(function (global) {
  const rolePaths = {
    driver: "driver.html",
    owner: "owner.html",
    admin: "admin.html"
  };
  const legacyEmailSuffix = "@parkr.test";
  const legacyIds = ["USR-01", "USR-02", "USR-03", "USR-04", "USR-05"];

  function getBasePath() {
    if (document.body && document.body.dataset.root) return document.body.dataset.root;
    return global.location.pathname.includes("/pages/") ? "../../" : "";
  }

  function getUser() {
    try {
      const user = JSON.parse(localStorage.getItem("parkrUser") || "null");
      if (isDemoUser(user)) {
        localStorage.removeItem("parkrUser");
        return null;
      }
      return user;
    } catch (error) {
      return null;
    }
  }

  function setUser(user) {
    localStorage.setItem("parkrUser", JSON.stringify(user));
  }

  function isDemoUser(user) {
    if (!user) return false;
    const email = String(user.email || "").toLowerCase();
    const id = String(user.userId || user.id || "");
    return email.endsWith(legacyEmailSuffix) || legacyIds.includes(id);
  }

  function roleFromPath(path) {
    if (path.includes("driver.html") || path.includes("pages/driver/")) return "driver";
    if (path.includes("owner.html") || path.includes("pages/owner/")) return "owner";
    if (path.includes("admin.html") || path.includes("pages/admin/")) return "admin";
    return "";
  }

  function currentReturnPath() {
    return global.location.pathname.replace(/^\/+/, "") + global.location.search;
  }

  function loginHref(returnTo) {
    const params = new URLSearchParams();
    if (returnTo) params.set("returnTo", returnTo);
    const query = params.toString();
    return getBasePath() + "login.html" + (query ? "?" + query : "");
  }

  function safeReturnPath(path) {
    const value = String(path || "");
    if (!value || value.startsWith("/") || value.includes("://") || value.includes("..")) return "";
    return value;
  }

  function requireAuthForProtectedPage() {
    const routeRole = document.body ? document.body.dataset.role : "";
    if (!routeRole) return true;
    const user = getUser();
    if (!user) {
      global.location.href = loginHref(currentReturnPath());
      return false;
    }
    if (user.role && user.role !== routeRole) {
      global.location.href = getBasePath() + (rolePaths[user.role] || rolePaths.driver);
      return false;
    }
    return true;
  }

  function redirectToLoginFor(targetPath) {
    const safeTarget = safeReturnPath(targetPath);
    localStorage.setItem("parkrReturnTo", safeTarget);
    global.location.href = loginHref(safeTarget);
  }

  function initAuthGatedNavigation() {
    if (getUser()) return;

    document.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (!roleFromPath(href)) return;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        redirectToLoginFor(href);
      });
    });

    document.querySelectorAll("form[action]").forEach((form) => {
      const action = form.getAttribute("action") || "";
      if (!roleFromPath(action)) return;
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const params = new URLSearchParams(new FormData(form));
        const target = action + (params.toString() ? "?" + params.toString() : "");
        redirectToLoginFor(target);
      });
    });
  }

  function initials(name) {
    return String(name || "Parkr User")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "PU";
  }

  function showToast(message) {
    let toast = document.querySelector("[data-toast]");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      toast.setAttribute("data-toast", "");
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function openFormDialog(settings) {
    const config = settings || {};
    const fields = Array.isArray(config.fields) ? config.fields : [];

    return new Promise((resolve) => {
      const previousFocus = document.activeElement;
      const overlay = document.createElement("div");
      overlay.className = "parkr-modal-backdrop";

      const modal = document.createElement("section");
      modal.className = "parkr-modal" + (config.size === "wide" ? " parkr-modal-wide" : "");
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");

      const titleId = "parkr-modal-title-" + Date.now();
      const title = document.createElement("h2");
      title.id = titleId;
      title.textContent = config.title || "Parkr";
      modal.setAttribute("aria-labelledby", titleId);

      const description = document.createElement("p");
      description.className = "muted";
      description.textContent = config.description || "";

      const form = document.createElement("form");
      form.className = "parkr-modal-form" + (config.grid ? " is-grid" : "");

      fields.forEach((field) => {
        const fieldWrap = document.createElement("div");
        fieldWrap.className = "field";
        const inputId = "parkr-modal-field-" + field.name + "-" + Date.now();

        const label = document.createElement("label");
        label.setAttribute("for", inputId);
        label.textContent = field.label || field.name;

        if (field.fullSpan) fieldWrap.classList.add("field-full");

        let input;
        if (field.type === "select") {
          input = document.createElement("select");
          (field.options || []).forEach((optionValue) => {
            const option = document.createElement("option");
            option.value = optionValue.value ?? optionValue;
            option.textContent = optionValue.label ?? optionValue;
            input.appendChild(option);
          });
        } else if (field.type === "textarea") {
          input = document.createElement("textarea");
        } else {
          input = document.createElement("input");
          input.type = field.type || "text";
          if (field.min !== undefined) input.min = field.min;
          if (field.max !== undefined) input.max = field.max;
          if (field.step !== undefined) input.step = field.step;
        }

        input.id = inputId;
        input.name = field.name;
        input.value = field.value ?? "";
        if (field.required !== false) input.required = true;
        if (field.placeholder) input.placeholder = field.placeholder;

        fieldWrap.appendChild(label);
        fieldWrap.appendChild(input);
        form.appendChild(fieldWrap);
      });

      const actions = document.createElement("div");
      actions.className = "parkr-modal-actions";

      const cancelButton = document.createElement("button");
      cancelButton.className = "btn btn-secondary";
      cancelButton.type = "button";
      cancelButton.textContent = config.cancelLabel || "Cancel";

      const submitButton = document.createElement("button");
      submitButton.className = config.submitClass || "btn btn-primary";
      submitButton.type = "submit";
      submitButton.textContent = config.submitLabel || "Save";

      actions.appendChild(cancelButton);
      actions.appendChild(submitButton);
      form.appendChild(actions);

      modal.appendChild(title);
      if (description.textContent) modal.appendChild(description);
      modal.appendChild(form);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      document.body.classList.add("modal-open");

      function close(result) {
        document.removeEventListener("keydown", handleKeydown);
        overlay.remove();
        document.body.classList.remove("modal-open");
        if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
        resolve(result);
      }

      function handleKeydown(event) {
        if (event.key === "Escape") close(null);
      }

      cancelButton.addEventListener("click", () => close(null));
      overlay.addEventListener("mousedown", (event) => {
        if (event.target === overlay) close(null);
      });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        const values = {};
        new FormData(form).forEach((value, key) => {
          values[key] = value;
        });
        close(values);
      });

      document.addEventListener("keydown", handleKeydown);
      requestAnimationFrame(() => {
        overlay.classList.add("show");
        const firstInput = form.querySelector("input, select, textarea, button");
        if (firstInput) firstInput.focus();
      });
    });
  }

  function setFavicon() {
    const href = getBasePath() + "assets/images/logo/parkr-logo-orange.svg";
    let icon = document.querySelector("link[rel='icon']");
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.type = "image/svg+xml";
    icon.href = href;
  }

  function finishSignOut() {
    global.location.href = getBasePath() + "login.html";
  }

  function signOut() {
    if (global.ParkrStore && typeof global.ParkrStore.logoutUser === "function") {
      global.ParkrStore.logoutUser().finally(finishSignOut);
      return;
    }
    localStorage.removeItem("parkrUser");
    finishSignOut();
  }

  function profilePathFor(user) {
    if (!user) return rolePaths.driver;
    if (user.role === "owner") return "owner.html#profile";
    if (user.role === "admin") return rolePaths.admin;
    return "driver.html#profile";
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function profileDisplay(user) {
    const role = String((user && user.role) || roleFromPath(global.location.pathname) || "driver").toLowerCase();
    const name = String((user && user.name) || "Parkr User").trim() || "Parkr User";
    return {
      name,
      role,
      email: String((user && user.email) || "").trim()
    };
  }

  function hydrateAuthNavigation() {
    const nav = document.querySelector(".navbar .nav-right");
    if (!nav) return;
    const user = getUser();
    if (!user) return;
    const basePath = getBasePath();
    const dashboardPath = rolePaths[user.role] || rolePaths.driver;
    const profilePath = profilePathFor(user);
    const profile = profileDisplay(user);
    const safeName = escapeHtml(profile.name);
    const safeRole = escapeHtml(profile.role);
    nav.innerHTML = `
      <a href="#featured">Parking</a>
      <a href="#how">How it works</a>
      <a href="${basePath + dashboardPath}">Dashboard</a>
      <div class="nav-session" aria-label="Signed in account">
        <a class="nav-profile-chip" href="${basePath + profilePath}" aria-label="Open ${safeName} profile">
          <span class="avatar">${escapeHtml(initials(profile.name))}</span>
          <span class="nav-profile-text">
            <strong class="nav-profile-name">${safeName}</strong>
            <span class="nav-profile-role">${safeRole}</span>
          </span>
        </a>
        <button class="nav-logout" type="button" data-signout>Logout</button>
      </div>
    `;
  }

  function markActiveLinks() {
    const current = global.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const page = href.split("?")[0].split("/").pop();
      if (page === current) link.classList.add("active");
    });
  }

  function initMenu() {
    const toggle = document.querySelector("[data-menu-toggle]");
    const nav = document.querySelector(".navbar");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    });
  }

  function openDatePicker(input) {
    if (typeof input.showPicker !== "function") return;
    try {
      input.showPicker();
    } catch (error) {
      // Some browsers allow showPicker only from direct user gestures.
    }
  }

  function initModernDateInputs() {
    document.querySelectorAll('input[type="date"]').forEach((input) => {
      if (input.classList.contains("native-enhanced-control")) return;
      input.addEventListener("click", () => openDatePicker(input));
      input.addEventListener("focus", () => openDatePicker(input));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") openDatePicker(input);
      });
    });
  }

  function closeCustomMenus(except) {
    document.querySelectorAll(".search-suggestions.show").forEach((menu) => {
      if (menu !== except) menu.classList.remove("show");
    });
  }

  function initCustomSelectControls() {
    document.querySelectorAll("select").forEach((select) => {
      if (select.classList.contains("native-enhanced-control")) return;

      const wrapper = document.createElement("div");
      wrapper.className = "custom-dropdown-control";
      const trigger = document.createElement("button");
      trigger.className = "custom-dropdown-trigger";
      trigger.type = "button";
      const menu = document.createElement("div");
      menu.className = "search-suggestions custom-dropdown-menu";
      menu.setAttribute("role", "listbox");

      select.parentNode.insertBefore(wrapper, select);
      wrapper.appendChild(select);
      wrapper.appendChild(trigger);
      wrapper.appendChild(menu);
      select.classList.add("native-enhanced-control");
      select.tabIndex = -1;

      function syncTrigger() {
        const option = select.options[select.selectedIndex] || select.options[0];
        trigger.textContent = option ? option.textContent : "Select";
        trigger.classList.toggle("is-placeholder", !select.value);
      }

      function renderMenu() {
        menu.innerHTML = Array.from(select.options).map((option, index) => {
          const selected = index === select.selectedIndex ? " aria-selected=\"true\"" : "";
          return `<button class="suggestion-option" type="button" role="option" data-index="${index}"${selected}>${option.textContent}</button>`;
        }).join("");
      }

      function toggleMenu() {
        const willOpen = !menu.classList.contains("show");
        closeCustomMenus(menu);
        if (willOpen) {
          renderMenu();
          menu.classList.add("show");
        }
      }

      trigger.addEventListener("click", toggleMenu);
      trigger.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleMenu();
        }
        if (event.key === "Escape") menu.classList.remove("show");
      });

      menu.addEventListener("mousedown", (event) => event.preventDefault());
      menu.addEventListener("click", (event) => {
        const optionButton = event.target.closest(".suggestion-option");
        if (!optionButton) return;
        select.selectedIndex = Number(optionButton.dataset.index);
        select.dispatchEvent(new Event("change", { bubbles: true }));
        syncTrigger();
        menu.classList.remove("show");
      });

      document.addEventListener("click", (event) => {
        if (!wrapper.contains(event.target)) menu.classList.remove("show");
      });

      syncTrigger();
    });
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function toIsoDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function formatDateLabel(value) {
    if (!value) return "dd-mm-yyyy";
    const [year, month, day] = value.split("-");
    return `${day}-${month}-${year}`;
  }

  function parseIsoDate(value) {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  function parseTimeValue(value) {
    const parts = String(value || "").split(":");
    if (parts.length < 2) return null;
    const hour = Number(parts[0]);
    const minute = Number(parts[1]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return { hour, minute };
  }

  function formatTimeValue(hour, minute) {
    return `${pad(Number(hour) || 0)}:${pad(Number(minute) || 0)}`;
  }

  function formatTimeLabel(value) {
    const parsed = parseTimeValue(value);
    return parsed ? formatTimeValue(parsed.hour, parsed.minute) : "--:--";
  }

  function initCustomTimeControls() {
    document.querySelectorAll('input[type="time"]').forEach((input) => {
      if (input.classList.contains("native-enhanced-control")) return;

      const wrapper = document.createElement("div");
      wrapper.className = "custom-time-control";
      const trigger = document.createElement("button");
      trigger.className = "custom-time-trigger";
      trigger.type = "button";
      trigger.setAttribute("aria-haspopup", "dialog");
      const menu = document.createElement("div");
      menu.className = "search-suggestions custom-time-menu";
      menu.setAttribute("role", "dialog");
      menu.setAttribute("aria-label", "Select time");

      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
      wrapper.appendChild(trigger);
      wrapper.appendChild(menu);
      input.classList.add("native-enhanced-control");
      input.tabIndex = -1;

      const now = new Date();
      const initialTime = parseTimeValue(input.value);
      let selectedHour = initialTime?.hour ?? now.getHours();
      let selectedMinute = initialTime?.minute ?? 0;
      let mode = "hour";

      function sanitizeSelection() {
        if (!Number.isInteger(selectedHour) || selectedHour < 0 || selectedHour > 23) selectedHour = now.getHours();
        if (!Number.isInteger(selectedMinute) || selectedMinute < 0 || selectedMinute > 59) selectedMinute = 0;
        selectedMinute = Math.round(selectedMinute / 5) * 5;
        if (selectedMinute === 60) selectedMinute = 0;
      }

      function syncTrigger() {
        trigger.textContent = formatTimeLabel(input.value);
        trigger.classList.toggle("is-placeholder", !input.value);
      }

      function clockNumbers() {
        const values = mode === "hour"
          ? Array.from({ length: 24 }, (_, index) => index)
          : Array.from({ length: 12 }, (_, index) => index * 5);
        return values.map((value) => {
          const hourMode = mode === "hour";
          const display = hourMode ? pad(value) : pad(value);
          const active = hourMode ? value === selectedHour : value === selectedMinute;
          const angleValue = hourMode ? value % 12 : value / 5;
          const radius = hourMode && value >= 12 ? 58 : 92;
          const angle = angleValue * 30 - 90;
          return `<button class="custom-time-number${active ? " is-selected" : ""}" type="button" data-time-value="${value}" style="--time-angle:${angle}deg;--time-radius:${radius}px">${display}</button>`;
        }).join("");
      }

      function renderClock() {
        sanitizeSelection();
        const activeValue = mode === "hour" ? selectedHour : selectedMinute / 5;
        const handRadius = mode === "hour" && selectedHour >= 12 ? 58 : 92;
        const angle = (mode === "hour" ? activeValue % 12 : activeValue) * 30 - 90;
        menu.innerHTML = `
          <div class="custom-time-title">Select time</div>
          <div class="custom-time-readout">
            <button class="custom-time-part${mode === "hour" ? " is-active" : ""}" type="button" data-time-mode="hour">${pad(selectedHour)}</button>
            <span>:</span>
            <button class="custom-time-part${mode === "minute" ? " is-active" : ""}" type="button" data-time-mode="minute">${pad(selectedMinute)}</button>
          </div>
          <div class="custom-time-clock" style="--hand-angle:${angle}deg;--hand-radius:${handRadius}px">
            <span class="custom-time-hand"></span>
            <span class="custom-time-pin"></span>
            ${clockNumbers()}
          </div>
          <div class="custom-time-actions">
            <button class="custom-time-link" type="button" data-time-cancel>Cancel</button>
            <button class="custom-time-link" type="button" data-time-ok>OK</button>
          </div>
        `;
      }

      function openMenu() {
        const parsed = parseTimeValue(input.value);
        if (parsed) {
          selectedHour = parsed.hour;
          selectedMinute = parsed.minute;
        }
        mode = "hour";
        closeCustomMenus(menu);
        renderClock();
        const triggerRect = trigger.getBoundingClientRect();
        const pickerHeight = 430;
        const spaceBelow = window.innerHeight - triggerRect.bottom;
        const canFitBelow = spaceBelow >= pickerHeight;
        const canFitAbove = triggerRect.top >= pickerHeight;
        menu.classList.toggle("drop-up", !canFitBelow && canFitAbove);
        menu.classList.toggle("floating", !canFitBelow && !canFitAbove);
        menu.classList.add("show");
        trigger.setAttribute("aria-expanded", "true");
      }

      function closeMenu() {
        menu.classList.remove("show");
        trigger.setAttribute("aria-expanded", "false");
      }

      trigger.addEventListener("click", () => {
        if (menu.classList.contains("show")) closeMenu();
        else openMenu();
      });

      trigger.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openMenu();
        }
        if (event.key === "Escape") closeMenu();
      });

      menu.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      menu.addEventListener("click", (event) => {
        event.stopPropagation();
        const modeButton = event.target.closest("[data-time-mode]");
        const valueButton = event.target.closest("[data-time-value]");
        if (modeButton) {
          mode = modeButton.dataset.timeMode;
          renderClock();
          return;
        }
        if (valueButton) {
          const value = Number(valueButton.dataset.timeValue);
          if (mode === "hour") {
            selectedHour = value;
            mode = "minute";
          } else {
            selectedMinute = value;
          }
          renderClock();
          return;
        }
        if (event.target.closest("[data-time-cancel]")) {
          closeMenu();
          return;
        }
        if (event.target.closest("[data-time-ok]")) {
          input.value = formatTimeValue(selectedHour, selectedMinute);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          syncTrigger();
          closeMenu();
        }
      });

      document.addEventListener("click", (event) => {
        if (!wrapper.contains(event.target)) closeMenu();
      });

      syncTrigger();
    });
  }

  function initCustomDateControls() {
    document.querySelectorAll('input[type="date"]').forEach((input) => {
      if (input.classList.contains("native-enhanced-control")) return;

      const wrapper = document.createElement("div");
      wrapper.className = "custom-date-control";
      const trigger = document.createElement("button");
      trigger.className = "custom-date-trigger";
      trigger.type = "button";
      const menu = document.createElement("div");
      menu.className = "search-suggestions custom-date-menu";

      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
      wrapper.appendChild(trigger);
      wrapper.appendChild(menu);
      input.classList.add("native-enhanced-control");
      input.tabIndex = -1;

      let viewDate = parseIsoDate(input.value) || new Date();

      function syncTrigger() {
        trigger.textContent = formatDateLabel(input.value);
        trigger.classList.toggle("is-placeholder", !input.value);
      }

      function renderCalendar() {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const selected = parseIsoDate(input.value);
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const previousDays = new Date(year, month, 0).getDate();
        const monthName = viewDate.toLocaleString("en", { month: "long", year: "numeric" });
        const dayButtons = [];

        for (let i = firstDay - 1; i >= 0; i -= 1) {
          dayButtons.push(`<span class="custom-date-day is-muted">${previousDays - i}</span>`);
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
          const date = new Date(year, month, day);
          const iso = toIsoDate(date);
          const isSelected = selected && iso === toIsoDate(selected) ? " is-selected" : "";
          dayButtons.push(`<button class="custom-date-day${isSelected}" type="button" data-date="${iso}">${day}</button>`);
        }

        const totalCells = Math.ceil(dayButtons.length / 7) * 7;
        for (let day = 1; day <= totalCells - dayButtons.length; day += 1) {
          dayButtons.push(`<span class="custom-date-day is-muted">${day}</span>`);
        }

        menu.innerHTML = `
          <div class="custom-date-header">
            <strong class="custom-date-title">${monthName}</strong>
            <div>
              <button class="custom-date-nav" type="button" data-month="-1" aria-label="Previous month">‹</button>
              <button class="custom-date-nav" type="button" data-month="1" aria-label="Next month">›</button>
            </div>
          </div>
          <div class="custom-date-grid">
            ${["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => `<span class="custom-date-weekday">${day}</span>`).join("")}
            ${dayButtons.join("")}
          </div>
          <div class="custom-date-actions">
            <button class="custom-date-link" type="button" data-clear-date>Clear</button>
            <button class="custom-date-link" type="button" data-today-date>Today</button>
          </div>
        `;
      }

      function toggleCalendar() {
        const willOpen = !menu.classList.contains("show");
        closeCustomMenus(menu);
        if (willOpen) {
          renderCalendar();
          menu.classList.add("show");
        }
      }

      trigger.addEventListener("click", toggleCalendar);
      trigger.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleCalendar();
        }
        if (event.key === "Escape") menu.classList.remove("show");
      });

      menu.addEventListener("mousedown", (event) => event.preventDefault());
      menu.addEventListener("click", (event) => {
        const monthButton = event.target.closest("[data-month]");
        const dayButton = event.target.closest("[data-date]");
        if (monthButton) {
          viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + Number(monthButton.dataset.month), 1);
          renderCalendar();
          return;
        }
        if (dayButton) {
          input.value = dayButton.dataset.date;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          syncTrigger();
          menu.classList.remove("show");
          return;
        }
        if (event.target.closest("[data-clear-date]")) {
          input.value = "";
          input.dispatchEvent(new Event("change", { bubbles: true }));
          syncTrigger();
          menu.classList.remove("show");
          return;
        }
        if (event.target.closest("[data-today-date]")) {
          const today = new Date();
          input.value = toIsoDate(today);
          viewDate = today;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          syncTrigger();
          menu.classList.remove("show");
        }
      });

      document.addEventListener("click", (event) => {
        if (!wrapper.contains(event.target)) menu.classList.remove("show");
      });

      syncTrigger();
    });
  }

  function initLocationSuggestions() {
    let suggestions = [];
    let suggestionsLoaded = false;

    async function loadSuggestions() {
      if (suggestionsLoaded) return suggestions;
      suggestionsLoaded = true;
      if (!global.ParkrStore || typeof global.ParkrStore.listSlots !== "function") return suggestions;
      try {
        const slots = await global.ParkrStore.listSlots({ publicOnly: true });
        suggestions = Array.from(new Set(slots.map((slot) => slot.name).filter(Boolean)));
      } catch (error) {
        suggestions = [];
      }
      return suggestions;
    }

    document.querySelectorAll('input[name="location"]').forEach((input) => {
      if (input.closest(".search-suggest-wrap")) return;

      const wrapper = document.createElement("div");
      wrapper.className = "search-suggest-wrap";
      const list = document.createElement("div");
      list.className = "search-suggestions";
      list.setAttribute("role", "listbox");

      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
      wrapper.appendChild(list);
      input.setAttribute("autocomplete", "off");
      input.setAttribute("aria-autocomplete", "list");

      function hide() {
        list.classList.remove("show");
        list.innerHTML = "";
      }

      async function render() {
        const currentSuggestions = await loadSuggestions();
        const query = input.value.trim().toLowerCase();
        const matches = currentSuggestions
          .filter((item) => !query || item.toLowerCase().includes(query))
          .slice(0, 5);

        if (!matches.length) {
          hide();
          return;
        }

        list.innerHTML = matches.map((item) => `<button class="suggestion-option" type="button" role="option">${item}</button>`).join("");
        list.classList.add("show");
      }

      input.addEventListener("input", render);
      input.addEventListener("focus", render);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Escape") hide();
      });

      list.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });

      list.addEventListener("click", (event) => {
        const option = event.target.closest(".suggestion-option");
        if (!option) return;
        input.value = option.textContent;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        hide();
      });

      document.addEventListener("click", (event) => {
        if (!wrapper.contains(event.target)) hide();
      });
    });
  }

  function hydrateUserUi() {
    const user = getUser();
    if (!user) return;
    const profile = profileDisplay(user);

    document.querySelectorAll(".user-chip").forEach((chip) => {
      chip.textContent = "";
      chip.setAttribute("aria-label", `${profile.name} profile, ${profile.role}`);

      const avatar = document.createElement("span");
      avatar.className = "avatar";
      avatar.setAttribute("data-avatar", "");
      avatar.textContent = initials(profile.name);

      const profileText = document.createElement("span");
      profileText.className = "user-chip-text";

      const profileName = document.createElement("strong");
      profileName.setAttribute("data-user-name", "");
      profileName.textContent = profile.name;

      const profileRole = document.createElement("span");
      profileRole.setAttribute("data-user-role", "");
      profileRole.textContent = profile.role;

      profileText.append(profileName, profileRole);
      chip.append(avatar, profileText);
    });

    document.querySelectorAll("[data-user-name]").forEach((item) => { item.textContent = profile.name; });
    document.querySelectorAll("[data-user-role]").forEach((item) => { item.textContent = profile.role; });
    document.querySelectorAll("[data-user-email]").forEach((item) => { item.textContent = profile.email || user.email || ""; });
    document.querySelectorAll("[data-avatar]").forEach((item) => { item.textContent = initials(profile.name); });
  }

  function initSmartPrefetch() {
    const prefetched = new Set();
    function prefetchUrl(url) {
      if (!url || prefetched.has(url) || url.startsWith("#") || url.startsWith("javascript:") || url.startsWith("mailto:")) return;
      prefetched.add(url);
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = url;
      document.head.appendChild(link);
    }

    document.querySelectorAll("a[href]").forEach((anchor) => {
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http://") || href.startsWith("https://")) return;
      anchor.addEventListener("mouseenter", () => prefetchUrl(href), { passive: true, once: true });
      anchor.addEventListener("touchstart", () => prefetchUrl(href), { passive: true, once: true });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setFavicon();
    if (!requireAuthForProtectedPage()) return;
    document.querySelectorAll("[data-year]").forEach((item) => { item.textContent = new Date().getFullYear(); });
    hydrateAuthNavigation();
    document.querySelectorAll("[data-signout]").forEach((button) => button.addEventListener("click", signOut));
    initCustomSelectControls();
    initCustomDateControls();
    initCustomTimeControls();
    initModernDateInputs();
    initLocationSuggestions();
    initAuthGatedNavigation();
    initMenu();
    markActiveLinks();
    hydrateUserUi();
    initSmartPrefetch();
  });

  global.Parkr = { rolePaths, getBasePath, getUser, setUser, showToast, openFormDialog, signOut, initials, safeReturnPath, roleFromPath };
})(window);
