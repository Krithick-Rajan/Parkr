export const firebaseConfig = {
  apiKey: "AIzaSyD4wlHNKRg_BOq_tU8girbl-NHpo0iM1b8",
  authDomain: "parkr-bcecd.firebaseapp.com",
  projectId: "parkr-bcecd",
  storageBucket: "parkr-bcecd.firebasestorage.app",
  messagingSenderId: "482596404052",
  appId: "1:482596404052:web:58124c859cf854d22ee6c1"
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every((value) => {
  const text = String(value || "");
  return text && !text.includes("PASTE_") && !text.includes("YOUR_");
});
