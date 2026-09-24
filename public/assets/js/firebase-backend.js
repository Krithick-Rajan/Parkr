import { firebaseConfig, isFirebaseConfigured } from "../../firebase/firebase-config.js";

(function (global) {
  function finish(backend) {
    global.ParkrBackend = backend;
    global.dispatchEvent(new CustomEvent("parkr-backend-ready", { detail: backend }));
    return backend;
  }

  function idOf(row) {
    return row.id || row.userId || row.slotId || row.bookingId || row.paymentId || row.email;
  }

  async function loadRuntime() {
    const [appSdk, authSdk, firestoreSdk] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
    ]);
    const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(firebaseConfig);
    return {
      app,
      auth: authSdk.getAuth(app),
      db: firestoreSdk.getFirestore(app),
      authSdk,
      firestoreSdk
    };
  }

  async function createBackend() {
    if (!isFirebaseConfigured) return finish({ isConfigured: false });

    const {
      app,
      auth,
      db,
      authSdk,
      firestoreSdk
    } = await loadRuntime();

    let storage = null;
    let storageSdk = null;

    function withTimeout(promise, ms = 2500) {
      let timer;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Firestore operation timed out")), ms);
      });
      return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
    }

    async function listCollection(collectionName, options) {
      try {
        const settings = options || {};
        const constraints = [];
        if (collectionName === "bookings" && settings.driverId) {
          constraints.push(firestoreSdk.where("driverId", "==", String(settings.driverId)));
        }
        if (collectionName === "bookings" && settings.ownerId) {
          constraints.push(firestoreSdk.where("ownerId", "==", String(settings.ownerId)));
        }
        if (collectionName === "parkingSlots" && settings.ownerId) {
          constraints.push(firestoreSdk.where("ownerId", "==", String(settings.ownerId)));
        }
        const collectionRef = firestoreSdk.collection(db, collectionName);
        const queryRef = constraints.length ? firestoreSdk.query(collectionRef, ...constraints) : collectionRef;
        const snapshot = await withTimeout(firestoreSdk.getDocs(queryRef), 2500);
        return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      } catch (err) {
        console.warn(`[Firestore] Query on '${collectionName}' failed or timed out (${err.message}). Using local store.`);
        return [];
      }
    }

    async function saveRecord(collectionName, row) {
      const recordId = String(idOf(row));
      try {
        await withTimeout(
          firestoreSdk.setDoc(
            firestoreSdk.doc(db, collectionName, recordId),
            { ...row, id: recordId, updatedAt: new Date().toISOString() },
            { merge: true }
          ),
          2500
        );
      } catch (err) {
        console.warn(`[Firestore] Cloud write to '${collectionName}' failed (${err.message}). Using persistent local fallback:`, err);
        // Do not block app if Cloud Firestore security rules are locked
      }
      return { ...row, id: recordId };
    }

    async function updateRecord(collectionName, id, changes) {
      try {
        await withTimeout(
          firestoreSdk.updateDoc(
            firestoreSdk.doc(db, collectionName, id),
            { ...(changes || {}), updatedAt: new Date().toISOString() }
          ),
          2500
        );
        const snapshot = await withTimeout(firestoreSdk.getDoc(firestoreSdk.doc(db, collectionName, id)), 1200);
        return snapshot && snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
      } catch (err) {
        console.warn(`[Firestore] Cloud update to '${collectionName}' failed (${err.message}):`, err);
        return { id, ...(changes || {}) };
      }
    }

    async function deleteRecord(collectionName, id) {
      if (!id) return true;
      try {
        await firestoreSdk.deleteDoc(firestoreSdk.doc(db, collectionName, id));
      } catch (err) {}

      // For users collection, also ensure documents with matching email or userId are deleted
      if (collectionName === "users") {
        try {
          const colRef = firestoreSdk.collection(db, "users");
          if (String(id).includes("@")) {
            const qEmail = firestoreSdk.query(colRef, firestoreSdk.where("email", "==", String(id).trim().toLowerCase()));
            const snap = await firestoreSdk.getDocs(qEmail);
            for (const d of snap.docs) {
              await firestoreSdk.deleteDoc(d.ref);
            }
          }
          if (String(id).startsWith("USR-")) {
            const qUid = firestoreSdk.query(colRef, firestoreSdk.where("userId", "==", id));
            const snapUid = await firestoreSdk.getDocs(qUid);
            for (const d of snapUid.docs) {
              await firestoreSdk.deleteDoc(d.ref);
            }
          }
        } catch (err) {
          console.warn(`[Firestore] Deep delete query failed:`, err);
        }
      }
      return true;
    }

    function cleanAuthError(err) {
      if (!err) return "Authentication failed. Please check your credentials.";
      const code = err.code || "";
      const msg = err.message || "";
      if (code === "auth/invalid-credential" || code === "auth/user-not-found") {
        return "Incorrect email or password. Please verify your credentials or create an account.";
      }
      if (code === "auth/wrong-password") {
        return "Incorrect password. Please try again.";
      }
      if (code === "auth/email-already-in-use") {
        return "This email is already registered. Please login with your existing password.";
      }
      if (code === "auth/weak-password") {
        return "Password must be at least 6 characters long.";
      }
      if (code === "auth/invalid-email") {
        return "Please enter a valid email address.";
      }
      if (code === "auth/too-many-requests") {
        return "Too many failed attempts. Please wait a moment and try again.";
      }
      if (code === "auth/network-request-failed") {
        return "Network connection issue. Falling back to local offline mode...";
      }
      if (code === "permission-denied" || msg.includes("insufficient permissions") || msg.includes("Missing or insufficient")) {
        return "Firestore Security Rules are locked. Please set Firestore rules to allow read, write in Firebase Console.";
      }
      return msg.replace(/^Firebase:\s*(Error\s*)?(\(auth\/[^)]+\)\.?\s*)?/i, "").trim() || "Authentication failed.";
    }

    async function registerUser(user, password) {
      let credential = null;
      try {
        credential = await authSdk.createUserWithEmailAndPassword(auth, user.email, password);
        authSdk.updateProfile(credential.user, { displayName: user.name }).catch(() => {});
      } catch (authErr) {
        if (authErr.code === "auth/email-already-in-use") {
          try {
            credential = await authSdk.signInWithEmailAndPassword(auth, user.email, password);
          } catch (signErr) {
            throw new Error("This email is already registered. Please login or use another email.");
          }
        } else {
          throw new Error(cleanAuthError(authErr));
        }
      }

      const record = {
        ...user,
        id: credential.user.uid,
        userId: credential.user.uid,
        email: credential.user.email,
        status: user.status || "approved"
      };
      // Write user document asynchronously to eliminate blocking delay
      saveRecord("users", record).catch((saveErr) => {
        console.warn("[Register] Firestore background doc write:", saveErr.message);
      });
      return record;
    }

    function knownRoleForEmail() {
      return "";
    }

    function knownNameForEmail() {
      return "";
    }

    async function loginUser(email, password, role) {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const knownRole = knownRoleForEmail(normalizedEmail);
      const targetRole = knownRole || role || "driver";

      try {
        const credential = await authSdk.signInWithEmailAndPassword(auth, email, password);
        try {
          const snapshot = await withTimeout(firestoreSdk.getDoc(firestoreSdk.doc(db, "users", credential.user.uid)), 1200);
          if (snapshot && snapshot.exists()) {
            const record = { id: snapshot.id, ...snapshot.data() };
            if (knownRole && record.role !== knownRole) {
              record.role = knownRole;
              updateRecord("users", record.id, { role: knownRole }).catch(() => {});
            } else if (!knownRole && role && record.role && record.role !== role) {
              throw new Error("This email is registered as " + record.role + ". Please login as " + record.role + ".");
            }
            return record;
          }
        } catch (docErr) {
          if (docErr.message && docErr.message.includes("registered as")) throw docErr;
        }

        // Fast fallback record if Firestore doc doesn't exist yet or was slow
        const displayName = knownNameForEmail(normalizedEmail) || email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        const newRecord = {
          id: credential.user.uid,
          userId: credential.user.uid,
          email: credential.user.email,
          name: displayName || "Parkr User",
          role: targetRole,
          status: "approved",
          createdAt: new Date().toISOString()
        };
        saveRecord("users", newRecord).catch(() => {});
        return newRecord;
      } catch (authError) {
        const code = authError.code || "";
        const msg = authError.message || "";

        // If user does not exist in Firebase, auto-provision user so login is seamless
        if (code === "auth/invalid-credential" || code === "auth/user-not-found" || msg.includes("invalid-credential")) {
          try {
            const newCred = await authSdk.createUserWithEmailAndPassword(auth, email, password);
            const displayName = knownNameForEmail(normalizedEmail) || email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
            const userRecord = {
              id: newCred.user.uid,
              userId: newCred.user.uid,
              email: newCred.user.email,
              name: displayName || "Parkr User",
              role: targetRole,
              status: "approved",
              createdAt: new Date().toISOString()
            };
            saveRecord("users", userRecord).catch(() => {});
            return userRecord;
          } catch (createErr) {
            if (createErr.code === "auth/email-already-in-use") {
              throw new Error("Incorrect password for " + email + ". Please check your password and try again.");
            }
            if (createErr.code === "auth/weak-password") {
              throw new Error("Password must be at least 6 characters long.");
            }
            if (createErr.code === "auth/invalid-email") {
              throw new Error("Please enter a valid email address.");
            }
            throw new Error(cleanAuthError(authError));
          }
        }
        throw new Error(cleanAuthError(authError));
      }
    }

    async function logoutUser() {
      await authSdk.signOut(auth);
    }

    async function getSlot(slotId) {
      try {
        const snapshot = await withTimeout(firestoreSdk.getDoc(firestoreSdk.doc(db, "parkingSlots", slotId)), 1500);
        return snapshot && snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
      } catch (err) {
        console.warn("[Firestore] getSlot fallback:", err.message);
        return null;
      }
    }

    async function updateSlotStatus(slotId, status) {
      const verificationStatus = String(status || "pending").toLowerCase();
      return updateRecord("parkingSlots", slotId, {
        status: verificationStatus,
        verificationStatus,
        availabilityStatus: verificationStatus === "approved" ? "available" : "unavailable"
      });
    }

    async function uploadFile(folder, file) {
      if (!storageSdk) {
        try {
          storageSdk = await withTimeout(import("https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js"), 2000);
          storage = storageSdk ? storageSdk.getStorage(app) : null;
        } catch (e) {
          storage = null;
          storageSdk = null;
        }
      }
      if (storage && storageSdk) {
        try {
          const fileRef = storageSdk.ref(storage, `${folder}/${Date.now()}_${file.name}`);
          const uploadPromise = storageSdk.uploadBytes(fileRef, file).then((snapshot) => storageSdk.getDownloadURL(snapshot.ref));
          const downloadUrl = await withTimeout(uploadPromise, 3000);
          if (downloadUrl) return downloadUrl;
        } catch (err) {
          console.warn("[Firebase Storage] Upload fallback to DataURL:", err.message);
        }
      }
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    async function findUserByEmail(email) {
      if (!email) return null;
      const normalized = String(email).trim().toLowerCase();
      try {
        const collectionRef = firestoreSdk.collection(db, "users");
        const q = firestoreSdk.query(collectionRef, firestoreSdk.where("email", "==", normalized));
        const snapshot = await withTimeout(firestoreSdk.getDocs(q), 1200);
        if (snapshot && !snapshot.empty) {
          const doc = snapshot.docs[0];
          return { id: doc.id, ...doc.data() };
        }
      } catch (e) {}
      return null;
    }

    return finish({
      isConfigured: true,
      registerUser,
      loginUser,
      logoutUser,
      findUserByEmail,
      listUsers: () => listCollection("users"),
      updateUser: (userId, changes) => updateRecord("users", userId, changes),
      updateUserStatus: (userId, status) => updateRecord("users", userId, { status }),
      deleteUser: (userId) => deleteRecord("users", userId),
      listSlots: (settings) => listCollection("parkingSlots", settings),
      getSlot,
      addSlot: (slot) => saveRecord("parkingSlots", slot),
      updateSlot: (slotId, changes) => updateRecord("parkingSlots", slotId, changes),
      updateSlotStatus,
      deleteSlot: (slotId) => deleteRecord("parkingSlots", slotId),
      listBookings: (settings) => listCollection("bookings", settings),
      saveBooking: (booking) => saveRecord("bookings", booking),
      updateBookingStatus: (bookingId, status) => updateRecord("bookings", bookingId, { status }),
      deleteBooking: (bookingId) => deleteRecord("bookings", bookingId),
      listPayments: () => listCollection("payments"),
      savePayment: (payment) => saveRecord("payments", payment),
      uploadFile
    });
  }

  global.ParkrBackendReady = createBackend().catch((error) => {
    console.warn("Firebase backend unavailable; using local storage.", error);
    return finish({ isConfigured: false, error });
  });
})(window);
