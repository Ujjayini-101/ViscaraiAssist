// ---------------------------- header.js ------------------------------
import { onAuthChange, signOutUser } from "./auth.js";

const $ = (sel, ctx = document) => ctx.querySelector(sel);

/* This helper helps us to save current location of user for redirect */
function attachLoginButtons() {
  document.querySelectorAll(".btn-login").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      // store the page user came from
      localStorage.setItem("redirectAfterLogin", window.location.pathname + window.location.search);
      window.location.href = "./login.html";
    });
  });
}

// -------- This drawer setup is for both hamburger and navMenuBtn --------
function setupDrawerTriggers() {
  const drawer = document.getElementById('drawer');
  const hamburger = document.getElementById('hamburger');
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');
  const navMenuBtn = document.getElementById('navMenuBtn'); 

hamburger?.addEventListener('click', () => {
  drawer?.classList.remove('hidden');
  drawer?.classList.add('open');
});

navMenuBtn?.addEventListener('click', () => {
  drawer?.classList.remove('hidden');
  drawer?.classList.add('open');
});

drawerCloseBtn?.addEventListener('click', () => {
  drawer?.classList.remove('open');
  drawer?.classList.add('hidden');
});

  // -------- This drawer links helps closing drawer when clicking any link -------- 
  document.querySelectorAll('#drawer a').forEach(link => {
    link.addEventListener('click', () => drawer?.classList.remove('open'));
  });
}

// --------It builds navbar placeholders if not present -------- 
function renderNotSignedIn(container) {
  container.innerHTML = `
    <button class="btn-login inline-flex btn-login items-center gap-1 rounded-full px-2 py-2 text-xs 
                 md:px-4 md:py-2 md:text-sm font-semibold
                 bg-[#bc7e6a] hover:bg-[#d3ab9e] text-white shadow-glow transition">Login / Sign up</button>
    <button id="navMenuBtn" class="ml-3 md:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg border border-[#ebd8d0] bg-white/70">☰</button>
  `;
  attachLoginButtons();
  setupDrawerTriggers(); 
}

function renderSignedIn(container, user, userDoc) {
  const photo = user.photoURL ? user.photoURL : "/assets/avatar-placeholder.png";
  const display = user.displayName || (user.email ? user.email.split("@")[0] : "User");
  // -------- drop-down markup --------
  container.innerHTML = `
    <div class="relative inline-block" id="navUserWrap">
      <button id="navUserBtn" class="flex items-center gap-2 rounded-full px-2 py-1 backdrop-blur supports-[backdrop-filter]:bg-white/30 bg-white/10">
        <img src="${photo}" alt="avatar" class="h-10 w-10 rounded-full object-cover border border-[#f3e8e3]" />
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div id="navDropdown" class="hidden absolute right-0 mt-2 w-56 rounded-xl backdrop-blur bg-white border border-[#f3e8e3] shadow-lg p-3 z-50 animate-slide-down">
        <div class="font-semibold text-sm">${display}</div>
        <div class="text-xs text-[#6b5b55] mb-2">${user.email || ""}</div>
        <a href="./dashboard.html" class="block px-3 py-2 rounded hover:bg-[#f7f0ec]">Your Dashboard</a>
        <button id="btnLogout" class="w-full text-left mt-2 px-3 py-2 rounded bg-[#eac9c1] hover:bg-[#d49382]">Log out</button>
      </div>
    </div>
    <button id="navMenuBtn" class="ml-3 md:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg border border-[#ebd8d0] bg-white/70">☰</button>
  `;

  // -------- toggle dropdown --------
  const navBtn = container.querySelector("#navUserBtn");
  const dropdown = container.querySelector("#navDropdown");
  const logoutBtn = container.querySelector("#btnLogout");
  if (navBtn) {
    navBtn.addEventListener("click", (e) => {
      dropdown.classList.toggle("hidden");
    });
    // this closes when clicks outside
    document.addEventListener("click", (e) => {
      if (!container.contains(e.target)) dropdown.classList.add("hidden");
    });
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await signOutUser();
      // after the user sign out they will be redirected to the homepage
      window.location.reload();
    });
  }
  setupDrawerTriggers();
}

// -------- wiring up --------
export function initNavAuth(selector = "#navAuthContainer") {
  const container = document.querySelector(selector);
  if (!container) return console.warn("navAuthContainer not found:", selector);

  attachLoginButtons();

  onAuthChange((user, userDoc) => {
    if (!user) {
      renderNotSignedIn(container);
    } else {
      renderSignedIn(container, user, userDoc);
    }
  });
}

// -------- small animation utility --------
const style = document.createElement("style");
style.innerHTML = `
@keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
.animate-slide-down { animation: slideDown .18s ease both; }
`;
document.head.appendChild(style);

// --------  Including this header.js will call initNavAuth() after the DOM is loaded --------
document.addEventListener("DOMContentLoaded", () => {
  // auto-initialize if container present
  if (document.querySelector("#navAuthContainer")) initNavAuth("#navAuthContainer");
  setupDrawerTriggers(); 
});
