
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";

import {
    getDatabase,
    ref,
    set,
    onValue
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";


// =====================================
// 1. FIREBASE CONFIGURATION
// =====================================

const firebaseConfig = {
    apiKey: "AIzaSyAYaziIQavCWjWtqWGEH3vq18MnJ5inRGQ",
    authDomain: "smartwatertank-9fd62.firebaseapp.com",
    projectId: "smartwatertank-9fd62",
    storageBucket: "smartwatertank-9fd62.firebasestorage.app",
    messagingSenderId: "1092337393410",
    appId: "1:1092337393410:web:d6952b2f8de954f2282c1b",
    measurementId: "G-0TLZCH7Y1V",
    databaseURL: "https://smartwatertank-9fd62-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

console.log("Firebase initialized.");


// =====================================
// 2. INITIAL VALUES
// =====================================

let tankA = 19;
let tankB = 15;

let autoFillA = false;
let autoFillB = false;

let fillingA = false;
let fillingB = false;

const TANK_CAPACITY_LITERS = 1000;
const TARGET_LEVEL = 95;

// Actual measured time: 0% to 95%
const TANK_A_FULL_FILL_SECONDS = 37;
const TANK_B_FULL_FILL_SECONDS = 16;
// Baseline rate in percentage points per second
const TANK_A_BASE_RATE = 95 / 37;
const TANK_B_BASE_RATE = 95 / 16;


// 1% fill = 0.5 minutes.
// Change this to match your actual pump's fill rate.
// Separate measured fill rate for each tank.
// Rate unit: percentage points per second.
const tankFillData = {
    A: {
        lastLevel: null,
        lastTime: null,
        rate: null
    },
    B: {
        lastLevel: null,
        lastTime: null,
        rate: null
    }
};


// =====================================
// 3. HTML ELEMENTS
// =====================================

const tankATime = document.getElementById("tankATime");
const tankBTime = document.getElementById("tankBTime");
const systemStatus = document.getElementById("systemStatus");

const tankAWater = document.getElementById("tankA");
const tankBWater = document.getElementById("tankB");

const tankAPercent = document.getElementById("tankAPercent");
const tankBPercent = document.getElementById("tankBPercent");

const tankALiters = document.getElementById("tankALiters");
const tankBLiters = document.getElementById("tankBLiters");

const tankAStatus = document.getElementById("tankAStatus");
const tankBStatus = document.getElementById("tankBStatus");

const statusA = document.getElementById("statusA");
const statusB = document.getElementById("statusB");

const autoStatusA = document.getElementById("autoStatusA");
const autoStatusB = document.getElementById("autoStatusB");

const tankABar = document.getElementById("tankABar");
const tankBBar = document.getElementById("tankBBar");

const tankACompare = document.getElementById("tankACompare");
const tankBCompare = document.getElementById("tankBCompare");

const currentLevelA = document.getElementById("currentLevelA");
const remainingA = document.getElementById("remainingA");
const estimatedTimeA = document.getElementById("timeA");
const fullTimeA = document.getElementById("fullTimeA");

const currentLevelB = document.getElementById("currentLevelB");
const remainingB = document.getElementById("remainingB");
const estimatedTimeB = document.getElementById("timeB");
const fullTimeB = document.getElementById("fullTimeB");

const autoAInput = document.getElementById("autoA");
const autoBInput = document.getElementById("autoB");


// =====================================
// 4. SAFE DOM UPDATE
// =====================================

function setText(element, value) {
    if (element) {
        element.textContent = value;
    }
}


// =====================================
// 5. TANK STATUS
// =====================================

function updateTankStatus(level, badge, overview) {
    if (!badge || !overview) return;

    if (level < 20) {
        badge.textContent = "🔴 Low Level";
        badge.className = "status low";
        overview.textContent = "🔴 Low";
    } else if (level >= TARGET_LEVEL) {
        badge.textContent = "🟢 Full";
        badge.className = "status full";
        overview.textContent = "🟢 Full";
    } else {
        badge.textContent = "🟢 Normal";
        badge.className = "status normal";
        overview.textContent = "🟢 Normal";
    }
}


// =====================================
// 6. AUTO-FILL STATUS DISPLAY
// =====================================

function updateAutoStatus() {
    setText(autoStatusA, autoFillA ? "ON" : "OFF");
    setText(autoStatusB, autoFillB ? "ON" : "OFF");

    if (autoStatusA) {
        autoStatusA.style.color =
            autoFillA ? "#22c55e" : "#ef4444";
    }

    if (autoStatusB) {
        autoStatusB.style.color =
            autoFillB ? "#22c55e" : "#ef4444";
    }

    if (autoAInput) autoAInput.checked = autoFillA;
    if (autoBInput) autoBInput.checked = autoFillB;
}


// =====================================
// 7. UPDATE TANK VISUALS
// =====================================


function updateTankVisuals() {
    // Tank capacity = 1000 L at 100%
    const litersA = Math.round(
        (tankA / 100) * TANK_CAPACITY_LITERS
    );

    const litersB = Math.round(
        (tankB / 100) * TANK_CAPACITY_LITERS
    );

    // Tank water visual height
    if (tankAWater) {
        tankAWater.style.height = `${tankA}%`;
    }

    if (tankBWater) {
        tankBWater.style.height = `${tankB}%`;
    }

    // Percentage display
    setText(tankAPercent, `${Math.round(tankA)}%`);
    setText(tankBPercent, `${Math.round(tankB)}%`);

    // Actual water quantity
    setText(tankALiters, `Current Water: ${litersA} L`);
    setText(tankBLiters, `Current Water: ${litersB} L`);

    // Comparison bars
    if (tankABar) {
        tankABar.style.width = `${tankA}%`;
    }

    if (tankBBar) {
        tankBBar.style.width = `${tankB}%`;
    }

    setText(tankACompare, `${Math.round(tankA)}%`);
    setText(tankBCompare, `${Math.round(tankB)}%`);

    // Status updates
    updateTankStatus(tankA, tankAStatus, statusA);
    updateTankStatus(tankB, tankBStatus, statusB);
}



// =====================================
// 8. FILL-TIME PREDICTION
// =====================================

function trackFillRate(tank, level, pumpOn) {
    const data = tankFillData[tank];
    const now = Date.now();

    if (!pumpOn || !Number.isFinite(level)) {
        data.lastLevel = null;
        data.lastTime = null;
        return;
    }

    if (data.lastLevel === null || data.lastTime === null) {
        data.lastLevel = level;
        data.lastTime = now;
        return;
    }

    const elapsedSeconds = (now - data.lastTime) / 1000;
    const increase = level - data.lastLevel;

    if (elapsedSeconds > 300) {
        data.lastLevel = level;
        data.lastTime = now;
        return;
    }

    if (elapsedSeconds >= 5) {
        if (increase >= 1) {
            const measuredRate = increase / elapsedSeconds;

            data.rate = data.rate === null
                ? measuredRate
                : data.rate * 0.7 + measuredRate * 0.3;
        }

        data.lastLevel = level;
        data.lastTime = now;
    }
}


function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return "Calculating...";
    }

    const totalSeconds = Math.ceil(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    if (minutes > 0) {
        return `${minutes} min ${remainingSeconds} sec`;
    }

    return `${remainingSeconds} sec`;
}




function calculatePrediction(
    tank,
    level,
    pumpOn,
    current,
    remaining,
    estimate,
    timeElement,
    fullTime
) {
    const safeLevel = Math.max(
        0,
        Math.min(TARGET_LEVEL, Number(level) || 0)
    );

    const remainingLevel = Math.max(
        0,
        TARGET_LEVEL - safeLevel
    );

    const data = tankFillData[tank];

    const baselineRate =
        tank === "A"
            ? TANK_A_BASE_RATE
            : TANK_B_BASE_RATE;

    const measuredRate =
        data.rate !== null &&
        Number.isFinite(data.rate) &&
        data.rate > 0
            ? data.rate
            : null;

    // Live measured rate when available; otherwise use actual test baseline.
    const rate = pumpOn && measuredRate !== null
        ? measuredRate
        : baselineRate;

    setText(current, `${safeLevel.toFixed(1)}%`);
    setText(remaining, `${remainingLevel.toFixed(1)}%`);

    const rateElement = document.getElementById(
        tank === "A" ? "rateA" : "rateB"
    );

    const ratePerMinute = rate * 60;

   setText(
    rateElement,
    `${ratePerMinute.toFixed(1)}% / Min`
);

    if (remainingLevel <= 0) {
        setText(estimate, "95% target reached");
        setText(timeElement, "Completed");
        setText(fullTime, "Target reached");
        return;
    }

    const secondsRemaining = remainingLevel / rate;
    const duration = formatDuration(secondsRemaining);

    setText(estimate, duration);

    setText(timeElement, duration);

    const completionTime = new Date(
        Date.now() + secondsRemaining * 1000
    );

    setText(
        fullTime,
        completionTime.toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        })
    );
}


function updatePrediction() {
    calculatePrediction(
        "A",
        tankA,
        fillingA,
        currentLevelA,
        remainingA,
        estimatedTimeA,
        tankATime,
        fullTimeA
    );

    calculatePrediction(
        "B",
        tankB,
        fillingB,
        currentLevelB,
        remainingB,
        estimatedTimeB,
        tankBTime,
        fullTimeB
    );

    if (systemStatus) {
        if (fillingA || fillingB) {
            systemStatus.textContent = "🟢 Running";
        } else if (!autoFillA && !autoFillB) {
            systemStatus.textContent = "⚪ Idle";
        } else {
            systemStatus.textContent = "🟡 Monitoring";
        }
    }
}



// =====================================
// 9. AUTO-FILL SETTINGS
// Stored separately from ESP32 sensor data
// =====================================

async function toggleAutoFillA() {
    if (!auth.currentUser) {
        console.error("Please log in before changing settings.");
        return;
    }

    const previousValue = autoFillA;
    autoFillA = Boolean(autoAInput?.checked);

    updateAutoStatus();
    updatePrediction();

    try {
        await set(
            ref(db, "controls/tankA/autoFill"),
            autoFillA
        );

        console.log("Tank A auto-fill setting saved:", autoFillA);
    } catch (error) {
        autoFillA = previousValue;
        updateAutoStatus();
        console.error("Tank A setting save failed:", error.code, error.message);
    }
}

async function toggleAutoFillB() {
    if (!auth.currentUser) {
        console.error("Please log in before changing settings.");
        return;
    }

    const previousValue = autoFillB;
    autoFillB = Boolean(autoBInput?.checked);

    updateAutoStatus();
    updatePrediction();

    try {
        await set(
            ref(db, "controls/tankB/autoFill"),
            autoFillB
        );

        console.log("Tank B auto-fill setting saved:", autoFillB);
    } catch (error) {
        autoFillB = previousValue;
        updateAutoStatus();
        console.error("Tank B setting save failed:", error.code, error.message);
    }
}

// Required if HTML uses onclick="toggleAutoFillA()"
window.toggleAutoFillA = toggleAutoFillA;
window.toggleAutoFillB = toggleAutoFillB;


// =====================================
// 10. FIREBASE REALTIME LISTENERS
// Start ONLY after authentication
// =====================================

let listenersStarted = false;

onAuthStateChanged(
    auth,
    (user) => {
        if (!user) {
            console.warn("User not logged in. Opening login page.");
            window.location.replace("login.html");
            return;
        }

        console.log("Authenticated user:", user.uid);

        if (listenersStarted) return;
        listenersStarted = true;

        console.log("Listening for tank data...");

        // Tank A sensor readings
        onValue(
            ref(db, "tanks/tankA"),
            (snapshot) => {
                const data = snapshot.val();

                console.log("TANK A DATA:", data);
                console.log(
    "Tank A update:",
    new Date().toISOString(),
    "Level:",
    data?.level,
    "Pump:",
    data?.pumpOn
);

                if (!data || data.level === undefined) {
                    console.warn("Tank A level is missing.");
                    return;
                }

                const level = Number(data.level);

                if (!Number.isFinite(level)) {
                    console.error("Invalid Tank A level:", data.level);
                    return;
                }

                tankA = Math.max(0, Math.min(95, level));
                fillingA = data.pumpOn === true;

                trackFillRate("A", tankA, fillingA);

                updateTankVisuals();
                updatePrediction();

                console.log("Tank A displayed level:", tankA);
            },
            (error) => {
                console.error(
                    "TANK A READ ERROR:",
                    error.code,
                    error.message
                );
            }
        );

        // Tank B sensor readings
        onValue(
            ref(db, "tanks/tankB"),
            (snapshot) => {
                const data = snapshot.val();

                console.log("TANK B DATA:", data);
                console.log(
    "Tank B update:",
    new Date().toISOString(),
    "Level:",
    data?.level,
    "Pump:",
    data?.pumpOn
);

                if (!data || data.level === undefined) {
                    console.warn("Tank B level is missing.");
                    return;
                }

                const level = Number(data.level);

                if (!Number.isFinite(level)) {
                    console.error("Invalid Tank B level:", data.level);
                    return;
                }

                tankB = Math.max(0, Math.min(95, level));
                fillingB = data.pumpOn === true;

                trackFillRate("B", tankB, fillingB);

                updateTankVisuals();
                updatePrediction();

                console.log("Tank B displayed level:", tankB);
            },
            (error) => {
                console.error(
                    "TANK B READ ERROR:",
                    error.code,
                    error.message
                );
            }
        );

        // Tank A auto-fill setting
        onValue(
            ref(db, "controls/tankA/autoFill"),
            (snapshot) => {
                autoFillA = snapshot.val() === true;
                updateAutoStatus();
                updatePrediction();

                console.log("Tank A auto-fill:", autoFillA);
            },
            (error) => {
                console.error("Tank A control read error:", error.message);
            }
        );

        // Tank B auto-fill setting
        onValue(
            ref(db, "controls/tankB/autoFill"),
            (snapshot) => {
                autoFillB = snapshot.val() === true;
                updateAutoStatus();
                updatePrediction();

                console.log("Tank B auto-fill:", autoFillB);
            },
            (error) => {
                console.error("Tank B control read error:", error.message);
            }
        );
    },
    (error) => {
        console.error("Firebase Authentication error:", error.message);
    }
);


// =====================================
// 11. INITIAL UI
// =====================================

updateTankVisuals();
updatePrediction();
updateAutoStatus();
setInterval(() => {
    updatePrediction();
}, 1000);

