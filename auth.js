import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";


import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyAYaziIQavCWjWtqWGEH3vq18MnJ5inRGQ",
  authDomain: "smartwatertank-9fd62.firebaseapp.com",
  databaseURL: "https://smartwatertank-9fd62-default-rtdb.firebaseio.com",
  projectId: "smartwatertank-9fd62",
  storageBucket: "smartwatertank-9fd62.firebasestorage.app",
  messagingSenderId: "1092337393410",
  appId: "1:1092337393410:web:d6952b2f8de954f2282c1b",
  measurementId: "G-0TLZCH7Y1V"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const form = document.getElementById("authForm");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submitBtn");
const message = document.getElementById("message");
const subtitle = document.getElementById("subtitle");
const switchLabel = document.getElementById("switchLabel");
const switchMode = document.getElementById("switchMode");

let isSignup = false;

// Already logged in? Open dashboard.
onAuthStateChanged(auth, (user) => {
    if (user && window.location.pathname.endsWith("login.html")) {
        window.location.replace("./index.html");
    }
});

// Switch between Login and Sign Up.
switchMode.addEventListener("click", (event) => {
    event.preventDefault();

    isSignup = !isSignup;

    nameInput.hidden = !isSignup;
    nameInput.required = isSignup;

    subtitle.textContent = isSignup
        ? "Create your account"
        : "Login to your account";

    submitBtn.textContent = isSignup
        ? "Create Account"
        : "Login";

    switchLabel.textContent = isSignup
        ? "Already have an account?"
        : "Don't have an account?";

    switchMode.textContent = isSignup
        ? "Login"
        : "Sign Up";

    passwordInput.autocomplete = isSignup
        ? "new-password"
        : "current-password";

    message.textContent = "";
});

// Login / Sign Up.
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    submitBtn.disabled = true;
    message.style.color = "#38bdf8";
    message.textContent = "Please wait...";

    try {
        await setPersistence(auth, browserLocalPersistence);
        if (isSignup) {
            if (!nameInput.value.trim()) {
                throw new Error("Please enter your name.");
            }

            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            message.style.color = "#22c55e";
            message.textContent = "Account created successfully!";

        } else {
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            message.style.color = "#22c55e";
            message.textContent = "Login successful!";
        }

        window.location.replace("index.html");

    } 
catch (error) {
    console.error("Firebase login error:", error.code, error.message);

    message.style.color = "#f87171";
    message.textContent =
        `${error.code || "Error"}: ${error.message || "Login failed"}`;
} finally {
    submitBtn.disabled = false;
}

});