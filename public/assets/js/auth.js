(function () {
  function redirectForRole(role) {
    const params = new URLSearchParams(window.location.search);
    const requested = Parkr.safeReturnPath(params.get("returnTo") || localStorage.getItem("parkrReturnTo"));
    const requestedRole = requested ? Parkr.roleFromPath(requested) : "";
    const path = requested && (!requestedRole || requestedRole === role)
      ? requested
      : Parkr.rolePaths[role] || Parkr.rolePaths.driver;
    localStorage.removeItem("parkrReturnTo");
    window.location.href = Parkr.getBasePath() + path;
  }

  function handleAuth(form, mode) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const data = new FormData(form);
      const role = data.get("role") || "driver";
      const email = data.get("email");
      const name = data.get("name") || email.toString().split("@")[0] || "Parkr User";
      const user = {
        name: name.toString(),
        email: email.toString(),
        phone: (data.get("phone") || "").toString(),
        role: role.toString()
      };

      const message = document.querySelector("[data-auth-message]");
      try {
        const savedUser = mode === "register"
          ? await ParkrStore.registerUser(user, data.get("password"))
          : await ParkrStore.loginUser(email.toString(), data.get("password"), role.toString());
        Parkr.setUser(savedUser);
        if (message) message.textContent = mode === "register" ? "Account created. Opening dashboard..." : "Login successful. Opening dashboard...";
        Parkr.showToast(message ? message.textContent : "Opening dashboard...");
        setTimeout(() => redirectForRole(savedUser.role || role), 60);
      } catch (error) {
        let text = (error && error.message) || "Authentication failed. Check your details and try again.";
        if (text.includes("auth/invalid-credential") || text.includes("user-not-found")) {
          text = "Incorrect email or password. Please verify your credentials or create an account.";
        } else if (text.includes("auth/wrong-password")) {
          text = "Incorrect password. Please try again.";
        } else if (text.includes("auth/email-already-in-use")) {
          text = "This email is already registered. Please login with your existing password.";
        } else if (text.includes("auth/weak-password")) {
          text = "Password must be at least 6 characters long.";
        } else {
          text = text.replace(/^Firebase:\s*(Error\s*)?(\(auth\/[^)]+\)\.?\s*)?/i, "").trim() || text;
        }
        if (message) message.textContent = text;
        Parkr.showToast(text);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.querySelector("#loginForm");
    const registerForm = document.querySelector("#registerForm");
    if (loginForm) {
      handleAuth(loginForm, "login");
      const emailInput = loginForm.querySelector("#loginEmail");
      if (emailInput) {
        let debounceTimer = null;
        let latestEmail = "";
        const syncRole = async () => {
          const val = (emailInput.value || "").trim().toLowerCase();
          if (!val || !val.includes("@") || val.length < 5) return;
          latestEmail = val;

          try {
            const detectedRole = await ParkrStore.findUserRoleByEmail(val);
            if (detectedRole && latestEmail === val) {
              const radio = loginForm.querySelector(`input[name="role"][value="${detectedRole}"]`);
              if (radio) radio.checked = true;
            }
          } catch (err) {
            console.warn("[Auth] Dynamic role lookup error:", err);
          }
        };

        emailInput.addEventListener("input", () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(syncRole, 250);
        });
        emailInput.addEventListener("blur", syncRole);
        emailInput.addEventListener("change", syncRole);
      }
    }
    if (registerForm) handleAuth(registerForm, "register");
  });
})();
