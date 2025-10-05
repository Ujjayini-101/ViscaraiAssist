// --------------------- login.js -----------------------


import {
  signUpWithEmailPassword,
  signInWithEmailPassword,
  signInWithGoogle,
  createUserDocIfNotExists
} from "./auth.js";

const $ = (sel, ctx = document) => ctx.querySelector(sel);
function getRedirectPath() {
  return localStorage.getItem("redirectAfterLogin") || "/dashboard.html";
}

// ------------------------- mode toggles ------------------------
function setMode(targetEl, mode) {
  const isSheet = (targetEl && targetEl.id === "sheet");
  const prefix = isSheet ? "sheet" : "auth";

  const titleEl = document.getElementById(isSheet ? "sheetTitle" : "authTitle");
  const rowNames = document.getElementById(prefix + "RowNames");
  const helper = document.getElementById(isSheet ? "sheetHelper" : "helperText");
  const toggle = document.getElementById(isSheet ? "sheetToggle" : "toggleMode");
  const submit = document.getElementById(isSheet ? "sheetSubmit" : "submitBtn");

  if (mode === "signin") {
    if (titleEl) titleEl.textContent = "Sign In to ViscaraiAssist";
    if (rowNames) rowNames.style.display = "none";
    if (helper) helper.textContent = "Welcome back! Use your email and password to sign in.";
    if (toggle) toggle.textContent = "New here? Create account";
    if (submit) { submit.textContent = "Sign In"; submit.setAttribute("data-mode", "signin"); }
  } else {
    if (titleEl) titleEl.textContent = "Login to ViscaraiAssist";
    if (rowNames) rowNames.style.display = "grid";
    if (helper) helper.textContent = "Creating an account means you agree to our Terms & Privacy Policy.";
    if (toggle) toggle.textContent = "Have an account? Sign in";
    if (submit) { submit.textContent = "Login / Sign Up"; submit.setAttribute("data-mode", "signup"); }
  }
}

// ----------------------- initialize ----------------------
setMode(document.getElementById("authPanel"), "signup");

// ----------------------- UI elements --------------------
const btnLeftSignIn = document.getElementById("btnLeftSignIn");
const btnGoogle = document.getElementById("btnGoogle");
const btnOpenSheet = document.getElementById("btnOpenSheet");
const sheet = document.getElementById("sheet");

// ----------------------- sheet open/close -----------------------
function openSheet(mode = "signup") {
  sheet.classList.remove("translate-y-full");
  sheet.classList.add("translate-y-0");
  sheet.setAttribute("aria-hidden", "false");
  setMode(sheet, mode);
}
function closeSheet() {
  sheet.classList.remove("translate-y-0");
  sheet.classList.add("translate-y-full");
  sheet.setAttribute("aria-hidden", "true");
}

// ------------------ left sign in Desktop  -------------------
if (btnLeftSignIn) {
  btnLeftSignIn.addEventListener("click", () => {
    setMode(document.getElementById("authPanel"), "signin");
    if (window.matchMedia("(max-width: 860px)").matches) openSheet("signin");
  });
}

// ------------------- Google sign-in ------------------
if (btnGoogle) {
  btnGoogle.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const user = await signInWithGoogle();
      // success -> redirect back to previous page
      const redirectPath = getRedirectPath();
      localStorage.removeItem("redirectAfterLogin");
      window.location.href = redirectPath;
    } catch (err) {
      console.error("Google sign-in error:", err);
      alert("Google login failed. Check console and Firebase configuration.");
    }
  });
}

//------------------- open mobile sheet CTA --------------------
if (btnOpenSheet) btnOpenSheet.addEventListener("click", () => openSheet("signup"));

// ----------------- toggle links  ----------------
const toggleMode = document.getElementById("toggleMode");
if (toggleMode) toggleMode.addEventListener("click", (e) => {
  e.preventDefault();
  const btn = document.getElementById("submitBtn");
  const next = btn.getAttribute("data-mode") === "signin" ? "signup" : "signin";
  setMode(document.getElementById("authPanel"), next);
});
const sheetToggle = document.getElementById("sheetToggle");
if (sheetToggle) sheetToggle.addEventListener("click", (e) => {
  e.preventDefault();
  const btn = document.getElementById("sheetSubmit");
  const next = btn.getAttribute("data-mode") === "signin" ? "signup" : "signin";
  setMode(sheet, next);
});

// --------------- password toggles ------------------
function attachPasswordToggle(inputId, toggleId) {
  const input = document.getElementById(inputId);
  const toggle = document.getElementById(toggleId);
  if (!input || !toggle) return;
  toggle.addEventListener("mousedown", () => {
    input.type = "text";
    toggle.classList.replace("fa-eye", "fa-eye-slash");
  });
  toggle.addEventListener("mouseup", () => {
    input.type = "password";
    toggle.classList.replace("fa-eye-slash", "fa-eye");
  });
  toggle.addEventListener("mouseleave", () => {
    input.type = "password";
    toggle.classList.replace("fa-eye-slash", "fa-eye");
  });
}
attachPasswordToggle("password", "togglePassword");
attachPasswordToggle("s-password", "toggleSheetPassword");

/* show alert helper */
function showAlert(msg) {
  alert(msg);
}

// ---------------------- use Firebase helpers -------------------------
const authForm = document.getElementById("authForm");
if (authForm) {
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const mode = document.getElementById("submitBtn").getAttribute("data-mode");
    const name = document.getElementById("name")?.value || "";
    const email = document.getElementById("email")?.value;
    const password = document.getElementById("password")?.value;

    try {
      if (mode === "signin") {
        await signInWithEmailPassword(email, password);
      } else {
        await signUpWithEmailPassword(name, email, password);
      }
      const redirectPath = getRedirectPath();
      localStorage.removeItem("redirectAfterLogin");
      window.location.href = redirectPath;
    } catch (err) {
      console.error("Auth error:", err);
      showAlert(err.message || "Authentication failed.");
    }
  });
}

// ---------------------- Mobile sheet submit ----------------
const sheetForm = document.getElementById("sheetForm");
if (sheetForm) {
  sheetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const mode = document.getElementById("sheetSubmit").getAttribute("data-mode");
    const name = document.getElementById("s-name")?.value || "";
    const email = document.getElementById("s-email")?.value;
    const password = document.getElementById("s-password")?.value;

    try {
      if (mode === "signin") {
        await signInWithEmailPassword(email, password);
      } else {
        await signUpWithEmailPassword(name, email, password);
      }
      const redirectPath = getRedirectPath();
      localStorage.removeItem("redirectAfterLogin");
      window.location.href = redirectPath;
    } catch (err) {
      console.error("Auth error:", err);
      showAlert(err.message || "Authentication failed.");
    } finally {
      closeSheet();
    }
  });
}

// ------------------- close sheet helpers: ESC and swipe ---------------
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
let startY = null;
if (sheet) {
  sheet.addEventListener("touchstart", (e) => { startY = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener("touchmove", (e) => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 90) { closeSheet(); startY = null; }
  }, { passive: true });
  sheet.addEventListener("touchend", () => { startY = null; });
}

// ---------- close sheet on resize to desktop ----------
window.addEventListener("resize", () => {
  if (!window.matchMedia("(max-width: 860px)").matches) closeSheet();
});
