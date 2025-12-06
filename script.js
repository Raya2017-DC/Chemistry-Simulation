/* ===========================================================
   RAYA SCIENCE STUDIO
   Hub + Photocatalysis + Fractional Distillation
   =========================================================== */

/* ---------- DOM ELEMENTS ---------- */

const hubScreen = document.getElementById("hubScreen");
const simScreen = document.getElementById("simScreen");

const simPhotocatalysis = document.getElementById("simPhotocatalysis");
const simDistillation = document.getElementById("simDistillation");

const simTitle = document.getElementById("simTitle");
const simSubtitle = document.getElementById("simSubtitle");
const simThemeLabel = document.getElementById("simThemeLabel");

const simRows = document.querySelectorAll(".sim-row[data-sim]");
const backToHubBtn = document.getElementById("backToHub");

/* Info popover */
const infoPopover = document.getElementById("infoPopover");
const infoText = document.getElementById("infoText");
const infoClose = document.getElementById("infoClose");

let currentSim = null;

/* Utility */
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function rand(a, b) {
  return a + Math.random() * (b - a);
}

/* ===========================================================
   NAVIGATION / LAYOUT
   =========================================================== */

function showHub() {
  currentSim = null;

  // Hide sim layouts + sim screen
  simPhotocatalysis.hidden = true;
  simDistillation.hidden = true;
  simScreen.hidden = true;
  simScreen.classList.remove("active");

  // Show hub
  hubScreen.classList.add("active");
  document.body.className = "theme-hub";
}

function openSimulation(simId) {
  // Hide hub
  hubScreen.classList.remove("active");

  // Show sim screen
  simScreen.hidden = false;
  simScreen.classList.add("active");

  // Hide both sim layouts first
  simPhotocatalysis.hidden = true;
  simDistillation.hidden = true;

  if (simId === "photocatalysis") {
    currentSim = "photocatalysis";
    document.body.className = "theme-photo";

    simPhotocatalysis.hidden = false;

    simTitle.textContent = "Photocatalysis: Bands → Charges → Radicals";
    simSubtitle.textContent =
      "Use light to excite electrons across a band gap, create radicals, and remove pollutants at the surface.";
    simThemeLabel.textContent = "Theme: Teal Blue";

    resizePhotoCanvas();

  } else if (simId === "distillation") {
    currentSim = "distillation";
    document.body.className = "theme-distil";

    simDistillation.hidden = false;

    simTitle.textContent = "Fractional Distillation Tower";
    simSubtitle.textContent =
      "Rising vapour and falling liquid repeatedly contact across trays, enriching the top in light component.";
    simThemeLabel.textContent = "Theme: Crimson Red";

    resizeDistilCanvas();
    computeDistillationProfiles();
  }
}

/* Hook up hub rows */

simRows.forEach(row => {
  const sim = row.dataset.sim;
  const btn = row.querySelector(".sim-row-btn");

  if (sim === "photocatalysis" || sim === "distillation") {
    row.addEventListener("click", () => openSimulation(sim));
    if (btn) {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        openSimulation(sim);
      });
    }
  }
});

backToHubBtn.addEventListener("click", showHub);

/* ===========================================================
   INFO POPOVER
   =========================================================== */

function openInfoPopover(target, text) {
  infoText.textContent = text;
  infoPopover.hidden = false;

  const rect = target.getBoundingClientRect();
  let x = rect.left + 10;
  let y = rect.bottom + 8;
  const maxX = window.innerWidth - 340;

  if (x > maxX) x = maxX;
  infoPopover.style.left = x + "px";
  infoPopover.style.top = y + "px";
}

function closeInfoPopover() {
  infoPopover.hidden = true;
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".info-badge");
  if (btn && btn.dataset.info) {
    e.stopPropagation();
    openInfoPopover(btn, btn.dataset.info);
  } else if (!e.target.closest("#infoPopover")) {
    closeInfoPopover();
  }
});

infoClose.addEventListener("click", () => {
  closeInfoPopover();
});

/* ===========================================================
   PHOTOCATALYSIS SIMULATION
   =========================================================== */

const photoCanvas = document.getElementById("photoCanvas");
const photoCtx = photoCanvas.getContext("2d");

const photoMaterial = document.getElementById("photoMaterial");
const photoDoping = document.getElementById("photoDoping");
const photoDopingValue = document.getElementById("photoDopingValue");
const photoWavelength = document.getElementById("photoWavelength");
const photoLambdaValue = document.getElementById("photoLambdaValue");
const photoIntensity = document.getElementById("photoIntensity");
const photoIntensityValue = document.getElementById("photoIntensityValue");
const photoHasO2 = document.getElementById("photoHasO2");
const photoHasH2O = document.getElementById("photoHasH2O");
const photoShowPhotons = document.getElementById("photoShowPhotons");
const photoShowTrails = document.getElementById("photoShowTrails");
const photoSpeed = document.getElementById("photoSpeed");

const photoEgValue = document.getElementById("photoEgValue");
const photoEphValue = document.getElementById("photoEphValue");
const photoRateValue = document.getElementById("photoRateValue");
const photoRadValue = document.getElementById("photoRadValue");
const photoStatusBadge = document.getElementById("photoStatusBadge");
const photoPollFill = document.getElementById("photoPollFill");
const photoPollText = document.getElementById("photoPollText");
const photoColorPreview = document.getElementById("photoColorPreview");

const photoPlay = document.getElementById("photoPlay");
const photoPause = document.getElementById("photoPause");
const photoReset = document.getElementById("photoReset");

const PHOTO_MATERIALS = {
  tio2: { Eg: 3.2 },
  zno: { Eg: 3.3 },
  fe2o3: { Eg: 2.2 }
};

const HC = 1240; // eV·nm
const PHOTO_MAX_NARROWING = 0.20;

const photoGeom = {
  w: 0,
  h: 0,
  bandTop: 140,
  bandBot: 280,
  surfaceY: 360,
  left: 80,
  right: 820
};

const photoState = {
  running: true,
  lastTime: 0,
  smoothRate: 0,
  excitationsFrame: 0,
  radicalsTotal: 0,
  pollutant: 1.0,
  objs: {
    photons: [],
    electrons: [],
    holes: [],
    radicals: []
  }
};

function resizePhotoCanvas() {
  const rect = photoCanvas.getBoundingClientRect();
  const cssW = rect.width || 800;
  const cssH = rect.height || 440;
  const dpr = window.devicePixelRatio || 1;

  photoCanvas.width = cssW * dpr;
  photoCanvas.height = cssH * dpr;
  photoCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  photoGeom.w = cssW;
  photoGeom.h = cssH;
  photoGeom.left = 70;
  photoGeom.right = cssW - 70;
}

/* Conversion: λ → RGB (for preview) */
function wavelengthToRGB(lambda) {
  let r = 0, g = 0, b = 0;
  if (lambda >= 380 && lambda < 440) {
    r = -(lambda - 440) / (440 - 380);
    b = 1;
  } else if (lambda < 490) {
    g = (lambda - 440) / (490 - 440);
    b = 1;
  } else if (lambda < 510) {
    g = 1;
    b = -(lambda - 510) / (510 - 490);
  } else if (lambda < 580) {
    r = (lambda - 510) / (580 - 510);
    g = 1;
  } else if (lambda < 645) {
    r = 1;
    g = -(lambda - 645) / (645 - 580);
  } else if (lambda <= 780) {
    r = 1;
  }
  const gamma = 0.8;
  const imax = 255;
  r = Math.round(imax * Math.pow(r, gamma));
  g = Math.round(imax * Math.pow(g, gamma));
  b = Math.round(imax * Math.pow(b, gamma));
  return `rgb(${r},${g},${b})`;
}

function photoCurrentEg() {
  const base = PHOTO_MATERIALS[photoMaterial.value].Eg;
  const d = parseInt(photoDoping.value, 10) / 100;
  const narrowing = PHOTO_MAX_NARROWING * d;
  return +(base * (1 - narrowing)).toFixed(2);
}

function photoPhotonEnergy() {
  const lambda = parseFloat(photoWavelength.value);
  return +(HC / lambda).toFixed(2);
}

function photoSpeedFactor() {
  return parseFloat(photoSpeed.value) || 1;
}

function photoSpawnPhoton() {
  if (photoState.objs.photons.length >= 40) return;
  const lambda = parseFloat(photoWavelength.value);
  const color = wavelengthToRGB(lambda);
  const x = rand(photoGeom.left, photoGeom.right);
  const y = 16;
  const speed = 90 + 40 * Math.random();
  photoState.objs.photons.push({ x, y, lambda, color, speed });
}

function photoSpawnElectron(x) {
  if (photoState.objs.electrons.length >= 24) return;
  const y = photoGeom.bandBot - 5;
  const vy = -(80 + rand(10, 20));
  photoState.objs.electrons.push({ x, y, vy });
}

function photoSpawnHole(x) {
  if (photoState.objs.holes.length >= 24) return;
  const y = photoGeom.bandBot + 5;
  const vy = (75 + rand(10, 20));
  photoState.objs.holes.push({ x, y, vy });
}

function photoSpawnRadical(type, x) {
  const y = photoGeom.surfaceY;
  const ttl = 2.2 + Math.random() * 0.8;
  photoState.objs.radicals.push({ x, y, type, age: 0, ttl });
  photoState.radicalsTotal += 1;

  const k = type === "oh" ? 0.0025 : 0.0015;
  photoState.pollutant = clamp(photoState.pollutant - k, 0, 1);
}

function updatePhotocatalysis(dt) {
  const s = photoSpeedFactor();
  const sdt = dt * s;

  photoState.excitationsFrame = 0;

  const Eg = photoCurrentEg();
  const Eph = photoPhotonEnergy();
  const canExcite = Eph >= Eg;

  // UI update
  photoEgValue.textContent = Eg.toFixed(2) + " eV";
  photoEphValue.textContent = Eph.toFixed(2) + " eV";
  photoDopingValue.textContent = photoDoping.value + "%";
  photoLambdaValue.textContent = photoWavelength.value + " nm";
  photoIntensityValue.textContent = (+photoIntensity.value).toFixed(2);

  const lam = parseFloat(photoWavelength.value);
  const col = wavelengthToRGB(lam);
  photoColorPreview.style.boxShadow =
    `0 0 0 1px rgba(15,23,42,0.10) inset, 0 0 10px ${col}`;

  if (canExcite) {
    photoStatusBadge.textContent = "Excitation Occurring (E ≥ Eg)";
    photoStatusBadge.classList.remove("off");
    photoStatusBadge.classList.add("on");
  } else {
    photoStatusBadge.textContent = "No Excitation (E < Eg)";
    photoStatusBadge.classList.remove("on");
    photoStatusBadge.classList.add("off");
  }

  // Spawn photons based on intensity
  const I = parseFloat(photoIntensity.value);
  let photonRate = 6 + 24 * I;
  let expected = photonRate * sdt;
  const room = Math.max(0, 40 - photoState.objs.photons.length);
  expected = Math.min(expected, room);
  for (let i = 0; i < expected; i++) {
    if (Math.random() < expected - i) photoSpawnPhoton();
  }

  const absorptionY = (photoGeom.bandTop + photoGeom.bandBot) / 2;

  // Photons
  for (let i = photoState.objs.photons.length - 1; i >= 0; i--) {
    const p = photoState.objs.photons[i];
    p.y += p.speed * sdt;
    if (p.y > absorptionY) {
      if (canExcite) {
        photoSpawnElectron(p.x + rand(-8, 8));
        photoSpawnHole(p.x + rand(-8, 8));
        photoState.excitationsFrame++;
      }
      photoState.objs.photons.splice(i, 1);
    } else if (p.y > photoGeom.h + 20 || !photoShowPhotons.checked) {
      photoState.objs.photons.splice(i, 1);
    }
  }

  // Electrons
  for (let i = photoState.objs.electrons.length - 1; i >= 0; i--) {
    const e = photoState.objs.electrons[i];
    e.y += e.vy * sdt;
    if (e.y < photoGeom.bandTop + 4) {
      e.vy = Math.abs(e.vy) * 0.5;
    }
    if (e.y >= photoGeom.surfaceY) {
      if (photoHasO2.checked) photoSpawnRadical("o2m", e.x);
      photoState.objs.electrons.splice(i, 1);
    }
  }

  // Holes
  for (let i = photoState.objs.holes.length - 1; i >= 0; i--) {
    const h = photoState.objs.holes[i];
    h.y += h.vy * sdt;
    if (h.y >= photoGeom.surfaceY) {
      if (photoHasH2O.checked) photoSpawnRadical("oh", h.x);
      photoState.objs.holes.splice(i, 1);
    }
  }

  // Radicals
  for (let i = photoState.objs.radicals.length - 1; i >= 0; i--) {
    const r = photoState.objs.radicals[i];
    r.age += sdt;
    if (r.age >= r.ttl) {
      photoState.objs.radicals.splice(i, 1);
    }
  }

  // Passive pollutant decay
  if (canExcite && photoState.pollutant > 0) {
    photoState.pollutant = clamp(
      photoState.pollutant - 0.005 * sdt * (I + 0.3),
      0,
      1
    );
  }

  // Metrics
  photoState.smoothRate =
    0.9 * photoState.smoothRate +
    0.1 * (photoState.excitationsFrame / Math.max(dt, 1e-3));

  photoRateValue.textContent = Math.round(photoState.smoothRate).toString();
  photoRadValue.textContent = photoState.radicalsTotal.toString();

  const pct = Math.round(photoState.pollutant * 100);
  photoPollFill.style.width = pct + "%";
  photoPollText.textContent = pct + "%";
}

function drawPhotocatalysis() {
  const w = photoGeom.w;
  const h = photoGeom.h;
  const ctx = photoCtx;

  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, 0, w, h);

  // Bands
  ctx.strokeStyle = "rgba(15,23,42,0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(photoGeom.left, photoGeom.bandTop);
  ctx.lineTo(photoGeom.right, photoGeom.bandTop);
  ctx.moveTo(photoGeom.left, photoGeom.bandBot);
  ctx.lineTo(photoGeom.right, photoGeom.bandBot);
  ctx.stroke();

  ctx.fillStyle = "rgba(148,163,184,0.2)";
  ctx.fillRect(
    photoGeom.left,
    photoGeom.bandTop,
    photoGeom.right - photoGeom.left,
    photoGeom.bandBot - photoGeom.bandTop
  );

  ctx.fillStyle = "#111827";
  ctx.font = "12px Poppins";
  ctx.fillText("Conduction Band (CB)", photoGeom.left, photoGeom.bandTop - 6);
  ctx.fillText("Valence Band (VB)", photoGeom.left, photoGeom.bandBot + 16);

  // Surface
  ctx.strokeStyle = "rgba(15,23,42,0.5)";
  ctx.beginPath();
  ctx.moveTo(photoGeom.left, photoGeom.surfaceY);
  ctx.lineTo(photoGeom.right, photoGeom.surfaceY);
  ctx.stroke();
  ctx.fillText("Surface", photoGeom.left, photoGeom.surfaceY + 16);

  // Photons
  if (photoShowPhotons.checked) {
    for (const p of photoState.objs.photons) {
      ctx.strokeStyle = p.color || "#f97316";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 6);
      ctx.lineTo(p.x, p.y + 6);
      ctx.stroke();
    }
  }

  // Electrons
  for (const e of photoState.objs.electrons) {
    ctx.fillStyle = "#1e88e5";
    ctx.beginPath();
    ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
    ctx.fill();
    if (photoShowTrails.checked) {
      ctx.fillStyle = "rgba(30,136,229,0.3)";
      ctx.beginPath();
      ctx.arc(e.x, e.y + 12, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Holes
  for (const hObj of photoState.objs.holes) {
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(hObj.x, hObj.y, 4, 0, Math.PI * 2);
    ctx.fill();
    if (photoShowTrails.checked) {
      ctx.fillStyle = "rgba(239,68,68,0.3)";
      ctx.beginPath();
      ctx.arc(hObj.x, hObj.y - 10, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Radicals
  for (const r of photoState.objs.radicals) {
    const alpha = clamp(1 - r.age / r.ttl, 0, 1);
    const radius = 5 + 2 * alpha;
    const col = r.type === "oh" ? [0, 188, 212] : [34, 197, 94];
    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
    ctx.beginPath();
    ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* Photocatalysis controls */

["input", "change"].forEach(evt => {
  photoMaterial.addEventListener(evt, () => {
    photoEgValue.textContent = photoCurrentEg().toFixed(2) + " eV";
  });
  photoDoping.addEventListener(evt, () => {
    photoDopingValue.textContent = photoDoping.value + "%";
    photoEgValue.textContent = photoCurrentEg().toFixed(2) + " eV";
  });
  photoWavelength.addEventListener(evt, () => {
    photoLambdaValue.textContent = photoWavelength.value + " nm";
    photoEphValue.textContent = photoPhotonEnergy().toFixed(2) + " eV";
  });
  photoIntensity.addEventListener(evt, () => {
    photoIntensityValue.textContent = (+photoIntensity.value).toFixed(2);
  });
});

photoPlay.addEventListener("click", () => {
  photoState.running = true;
});

photoPause.addEventListener("click", () => {
  photoState.running = false;
});

photoReset.addEventListener("click", () => {
  photoState.objs.photons.length = 0;
  photoState.objs.electrons.length = 0;
  photoState.objs.holes.length = 0;
  photoState.objs.radicals.length = 0;
  photoState.radicalsTotal = 0;
  photoState.smoothRate = 0;
  photoState.pollutant = 1.0;
  photoRateValue.textContent = "0";
  photoRadValue.textContent = "0";
  photoPollFill.style.width = "100%";
  photoPollText.textContent = "100%";
});

/* ===========================================================
   FRACTIONAL DISTILLATION
   =========================================================== */

const distilCanvas = document.getElementById("distilCanvas");
const distilCtx = distilCanvas.getContext("2d");

const distilMixture = document.getElementById("distilMixture");
const distilAlpha = document.getElementById("distilAlpha");
const distilAlphaValue = document.getElementById("distilAlphaValue");
const distilFeed = document.getElementById("distilFeed");
const distilFeedValue = document.getElementById("distilFeedValue");
const distilTrays = document.getElementById("distilTrays");
const distilTraysValue = document.getElementById("distilTraysValue");
const distilReflux = document.getElementById("distilReflux");
const distilRefluxValue = document.getElementById("distilRefluxValue");
const distilHeat = document.getElementById("distilHeat");
const distilHeatValue = document.getElementById("distilHeatValue");

const distilTopFill = document.getElementById("distilTopFill");
const distilBottomFill = document.getElementById("distilBottomFill");
const distilTopValue = document.getElementById("distilTopValue");
const distilBottomValue = document.getElementById("distilBottomValue");

const distilTopMetric = document.getElementById("distilTopMetric");
const distilBottomMetric = document.getElementById("distilBottomMetric");
const distilSepMetric = document.getElementById("distilSepMetric");
const distilTrayMetric = document.getElementById("distilTrayMetric");

const distilPlay = document.getElementById("distilPlay");
const distilPause = document.getElementById("distilPause");
const distilReset = document.getElementById("distilReset");

const distilGeom = {
  w: 0,
  h: 0,
  colTop: 80,
  colBottom: 360,
  colLeft: 160,
  colRight: 360
};

const distilState = {
  running: true,
  lastTime: 0,
  bubbles: [],
  drops: [],
  trayProfiles: []
};

function resizeDistilCanvas() {
  const rect = distilCanvas.getBoundingClientRect();
  const cssW = rect.width || 800;
  const cssH = rect.height || 440;
  const dpr = window.devicePixelRatio || 1;

  distilCanvas.width = cssW * dpr;
  distilCanvas.height = cssH * dpr;
  distilCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  distilGeom.w = cssW;
  distilGeom.h = cssH;
  distilGeom.colLeft = 160;
  distilGeom.colRight = cssW - 220;
}

function computeDistillationProfiles() {
  let alpha = parseFloat(distilAlpha.value);
  const zF = parseFloat(distilFeed.value);
  const N = parseInt(distilTrays.value, 10);
  const R = parseFloat(distilReflux.value);

  if (distilMixture.value === "hex- hep") alpha = 1.7;
  if (distilMixture.value === "tol- eth") alpha = 1.5;

  distilAlpha.value = alpha.toFixed(2);
  distilAlphaValue.textContent = alpha.toFixed(2);

  const sepFactor = Math.log(1 + (alpha - 1) * N * (0.5 + 0.5 * (R / (R + 1)))) * 0.42;

  let xD = zF + (1 - zF) * (1 - Math.exp(-sepFactor));
  let xB = zF * Math.exp(-sepFactor);

  xD = clamp(xD, zF, 0.995);
  xB = clamp(xB, 0.005, zF);

  const trayArr = [];
  for (let i = 0; i < N; i++) {
    const t = i / Math.max(1, N - 1);
    trayArr.push(xB + (xD - xB) * (1 - t));
  }
  distilState.trayProfiles = trayArr;

  distilTopValue.textContent = (xD * 100).toFixed(1) + "%";
  distilBottomValue.textContent = (xB * 100).toFixed(1) + "%";

  distilTopMetric.textContent = xD.toFixed(3);
  distilBottomMetric.textContent = xB.toFixed(3);
  distilSepMetric.textContent = (xD - xB).toFixed(3);
  distilTrayMetric.textContent = N.toString();

  distilTopFill.style.width = (xD * 100).toFixed(0) + "%";
  distilBottomFill.style.width = (xB * 100).toFixed(0) + "%";
}

function spawnBubble() {
  if (distilState.bubbles.length >= 40) return;
  distilState.bubbles.push({
    x: rand(distilGeom.colLeft + 10, distilGeom.colRight - 10),
    y: distilGeom.colBottom - rand(0, 20),
    vy: -rand(30, 60) * parseFloat(distilHeat.value),
    r: rand(4, 7)
  });
}

function spawnDrop() {
  if (distilState.drops.length >= 40) return;
  distilState.drops.push({
    x: rand(distilGeom.colLeft + 10, distilGeom.colRight - 10),
    y: distilGeom.colTop + rand(0, 20),
    vy: rand(30, 55) * parseFloat(distilHeat.value),
    r: rand(3, 5)
  });
}

function updateDistillation(dt) {
  const heat = parseFloat(distilHeat.value);
  const bubbleRate = 10 * heat;
  const dropRate = 8 * heat;

  for (let i = 0; i < bubbleRate * dt; i++) {
    if (Math.random() < (bubbleRate * dt) - i) spawnBubble();
  }
  for (let i = 0; i < dropRate * dt; i++) {
    if (Math.random() < (dropRate * dt) - i) spawnDrop();
  }

  for (let i = distilState.bubbles.length - 1; i >= 0; i--) {
    const b = distilState.bubbles[i];
    b.y += b.vy * dt;
    if (b.y < distilGeom.colTop + 5) distilState.bubbles.splice(i, 1);
  }

  for (let i = distilState.drops.length - 1; i >= 0; i--) {
    const d = distilState.drops[i];
    d.y += d.vy * dt;
    if (d.y > distilGeom.colBottom - 5) distilState.drops.splice(i, 1);
  }
}

function drawDistillation() {
  const c = distilCtx;
  const w = distilGeom.w;
  const h = distilGeom.h;

  c.clearRect(0, 0, w, h);
  c.fillStyle = "#e5e7eb";
  c.fillRect(0, 0, w, h);

  const L = distilGeom.colLeft;
  const R = distilGeom.colRight;
  const T = distilGeom.colTop;
  const B = distilGeom.colBottom;

  const grad = c.createLinearGradient(0, T, 0, B);
  grad.addColorStop(0, "rgba(14,165,233,0.25)");
  grad.addColorStop(1, "rgba(248,113,113,0.25)");

  c.fillStyle = grad;
  c.strokeStyle = "rgba(15,23,42,0.6)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.roundRect(L, T, R - L, B - T, 12);
  c.fill();
  c.stroke();

  const N = parseInt(distilTrays.value, 10);
  const trays = distilState.trayProfiles;
  const spacing = (B - T - 30) / Math.max(1, N);

  for (let i = 0; i < N; i++) {
    const y = B - 15 - i * spacing;
    const xLight = trays[i] !== undefined ? trays[i] : parseFloat(distilFeed.value);

    c.strokeStyle = "rgba(15,23,42,0.5)";
    c.beginPath();
    c.moveTo(L + 10, y);
    c.lineTo(R - 10, y);
    c.stroke();

    const W = (R - L) - 30;
    const barX = L + 15;
    const barY = y - 3;
    const LW = W * xLight;

    c.fillStyle = "#0ea5e9";
    c.fillRect(barX, barY, LW, 6);

    c.fillStyle = "#f97316";
    c.fillRect(barX + LW, barY, W - LW, 6);
  }

  // Bubbles
  for (const b of distilState.bubbles) {
    c.fillStyle = "rgba(59,130,246,0.85)";
    c.beginPath();
    c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    c.fill();
  }

  // Drops
  for (const d of distilState.drops) {
    c.fillStyle = "rgba(220,38,38,0.9)";
    c.beginPath();
    c.ellipse(d.x, d.y, d.r, d.r + 1.5, 0, 0, Math.PI * 2);
    c.fill();
  }

  // Feed label
  const zF = parseFloat(distilFeed.value);
  const feedY = T + (B - T) * 0.45;
  c.strokeStyle = "rgba(15,23,42,0.7)";
  c.beginPath();
  c.moveTo(L - 50, feedY);
  c.lineTo(L, feedY);
  c.stroke();
  c.fillStyle = "#111827";
  c.font = "11px Poppins";
  c.fillText(`Feed (zF = ${zF.toFixed(2)})`, L - 120, feedY - 6);
}

/* Distillation controls */

["input", "change"].forEach(evt => {
  distilMixture.addEventListener(evt, computeDistillationProfiles);
  distilAlpha.addEventListener(evt, () => {
    distilAlphaValue.textContent = parseFloat(distilAlpha.value).toFixed(2);
    computeDistillationProfiles();
  });
  distilFeed.addEventListener(evt, () => {
    distilFeedValue.textContent = parseFloat(distilFeed.value).toFixed(2);
    computeDistillationProfiles();
  });
  distilTrays.addEventListener(evt, () => {
    distilTraysValue.textContent = distilTrays.value;
    computeDistillationProfiles();
  });
  distilReflux.addEventListener(evt, () => {
    distilRefluxValue.textContent = parseFloat(distilReflux.value).toFixed(2);
    computeDistillationProfiles();
  });
  distilHeat.addEventListener(evt, () => {
    distilHeatValue.textContent = parseFloat(distilHeat.value).toFixed(2);
  });
});

distilPlay.addEventListener("click", () => {
  distilState.running = true;
});

distilPause.addEventListener("click", () => {
  distilState.running = false;
});

distilReset.addEventListener("click", () => {
  distilState.bubbles.length = 0;
  distilState.drops.length = 0;
  computeDistillationProfiles();
});

/* ===========================================================
   MAIN LOOP
   =========================================================== */

function mainLoop(timestamp) {
  if (!photoState.lastTime) photoState.lastTime = timestamp;
  if (!distilState.lastTime) distilState.lastTime = timestamp;

  const dtPhoto = clamp((timestamp - photoState.lastTime) / 1000, 0, 0.05);
  const dtDistil = clamp((timestamp - distilState.lastTime) / 1000, 0, 0.05);

  photoState.lastTime = timestamp;
  distilState.lastTime = timestamp;

  if (currentSim === "photocatalysis") {
    if (photoState.running) updatePhotocatalysis(dtPhoto);
    drawPhotocatalysis();
  } else if (currentSim === "distillation") {
    if (distilState.running) updateDistillation(dtDistil);
    drawDistillation();
  }

  requestAnimationFrame(mainLoop);
}

/* ===========================================================
   INITIALIZATION
   =========================================================== */

window.addEventListener("resize", () => {
  if (currentSim === "photocatalysis") {
    resizePhotoCanvas();
  } else if (currentSim === "distillation") {
    resizeDistilCanvas();
    computeDistillationProfiles();
  }
});

function init() {
  showHub();
  resizePhotoCanvas();
  resizeDistilCanvas();
  computeDistillationProfiles();
  requestAnimationFrame(mainLoop);
}

init();
