/* ===========================================================
   Raya Science Studio — Modular Simulation Router
   Add new sims by:
   1) HTML: paste into <div id="sim-<id>"> ... in index.html
   2) CSS: add theme class + any custom styles
   3) JS: create a module object and add to SIM_REGISTRY
   =========================================================== */

/* -----------------------------
   Helpers
----------------------------- */
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }

/* -----------------------------
   Core DOM
----------------------------- */
const hubScreen = document.getElementById("hubScreen");
const simScreen = document.getElementById("simScreen");

const simTitle = document.getElementById("simTitle");
const simSubtitle = document.getElementById("simSubtitle");
const simThemeLabel = document.getElementById("simThemeLabel");

const backToHubBtn = document.getElementById("backToHub");
const simRows = document.querySelectorAll(".sim-row[data-sim]");

/* Info popover */
const infoPopover = document.getElementById("infoPopover");
const infoText = document.getElementById("infoText");
const infoClose = document.getElementById("infoClose");

/* Active sim id */
let currentSimId = null;

/* -----------------------------
   Info Popover
----------------------------- */
function openInfoPopover(target, text) {
  infoText.textContent = text;
  infoPopover.hidden = false;
  const rect = target.getBoundingClientRect();
  let x = rect.left + 10;
  let y = rect.bottom + 8;
  const maxX = window.innerWidth - 360;
  if (x > maxX) x = maxX;
  infoPopover.style.left = `${x}px`;
  infoPopover.style.top = `${y}px`;
}

function closeInfoPopover() { infoPopover.hidden = true; }

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".info-badge");
  if (btn && btn.dataset.info) {
    e.stopPropagation();
    openInfoPopover(btn, btn.dataset.info);
    return;
  }
  if (!e.target.closest("#infoPopover")) closeInfoPopover();
});
infoClose.addEventListener("click", closeInfoPopover);

/* ===========================================================
   SIM MODULES
   Each module provides:
   - id
   - title, subtitle, themeClass, themeLabel
   - containerId (the sim-layout div id)
   - init() once
   - resize() on window resize
   - tick(dt) update
   - render() draw/update visuals
   - optional: onShow(), onHide()
   =========================================================== */

/* -----------------------------
   Photocatalysis Module
----------------------------- */
const PhotocatalysisSim = (() => {
  const containerId = "sim-photocatalysis";

  // Canvas
  const canvas = document.getElementById("photoCanvas");
  const ctx = canvas.getContext("2d");

  // Controls
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

  const MAT = { tio2: {Eg:3.2}, zno:{Eg:3.3}, fe2o3:{Eg:2.2} };
  const HC = 1240;
  const MAX_NARROW = 0.20;

  const geom = { w:0,h:0, bandTop:140, bandBot:280, surfaceY:370, left:70, right:930 };
  const state = {
    running: true,
    smoothRate: 0,
    excitationsFrame: 0,
    radicalsTotal: 0,
    pollutant: 1.0,
    objs: { photons: [], electrons: [], holes: [], radicals: [] }
  };

  function wavelengthToRGB(lambda) {
    let r=0,g=0,b=0;
    if (lambda>=380 && lambda<440) { r=-(lambda-440)/(440-380); b=1; }
    else if (lambda<490) { g=(lambda-440)/(490-440); b=1; }
    else if (lambda<510) { g=1; b=-(lambda-510)/(510-490); }
    else if (lambda<580) { r=(lambda-510)/(580-510); g=1; }
    else if (lambda<645) { r=1; g=-(lambda-645)/(645-580); }
    else if (lambda<=780) { r=1; }
    const gamma=0.8, imax=255;
    r=Math.round(imax*Math.pow(r,gamma));
    g=Math.round(imax*Math.pow(g,gamma));
    b=Math.round(imax*Math.pow(b,gamma));
    return `rgb(${r},${g},${b})`;
  }

  function currentEg() {
    const base = MAT[photoMaterial.value].Eg;
    const d = parseInt(photoDoping.value,10)/100;
    return +(base*(1 - MAX_NARROW*d)).toFixed(2);
  }

  function photonEnergy() {
    const lam = parseFloat(photoWavelength.value);
    return +(HC/lam).toFixed(2);
  }

  function speedFactor() { return parseFloat(photoSpeed.value) || 1; }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || 900;
    const cssH = rect.height || 460;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW*dpr;
    canvas.height = cssH*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);

    geom.w = cssW; geom.h = cssH;
    geom.left = 70; geom.right = cssW - 70;
    geom.surfaceY = Math.min(cssH - 70, 370);
  }

  function spawnPhoton() {
    if (!photoShowPhotons.checked) return;
    if (state.objs.photons.length >= 34) return;
    const lam = parseFloat(photoWavelength.value);
    state.objs.photons.push({
      x: rand(geom.left, geom.right),
      y: 16,
      color: wavelengthToRGB(lam),
      speed: 90 + 40*Math.random()
    });
  }

  function spawnElectron(x) {
    if (state.objs.electrons.length >= 18) return;
    state.objs.electrons.push({ x, y: geom.bandBot - 5, vy: -(85 + rand(10,20)) });
  }
  function spawnHole(x) {
    if (state.objs.holes.length >= 18) return;
    state.objs.holes.push({ x, y: geom.bandBot + 5, vy: (80 + rand(10,20)) });
  }
  function spawnRadical(type, x) {
    state.objs.radicals.push({ x, y: geom.surfaceY, type, age:0, ttl: 2.2 + Math.random()*0.8 });
    state.radicalsTotal += 1;
    const k = type === "oh" ? 0.0026 : 0.0016;
    state.pollutant = clamp(state.pollutant - k, 0, 1);
  }

  function tick(dt) {
    const sdt = dt * speedFactor();
    state.excitationsFrame = 0;

    const Eg = currentEg();
    const Eph = photonEnergy();
    const canExcite = Eph >= Eg;

    // UI
    photoEgValue.textContent = `${Eg.toFixed(2)} eV`;
    photoEphValue.textContent = `${Eph.toFixed(2)} eV`;
    photoDopingValue.textContent = `${photoDoping.value}%`;
    photoLambdaValue.textContent = `${photoWavelength.value} nm`;
    photoIntensityValue.textContent = (+photoIntensity.value).toFixed(2);

    if (canExcite) {
      photoStatusBadge.textContent = "Excitation Occurring (E ≥ Eg)";
      photoStatusBadge.classList.add("on");
      photoStatusBadge.classList.remove("off");
    } else {
      photoStatusBadge.textContent = "No Excitation (E < Eg)";
      photoStatusBadge.classList.add("off");
      photoStatusBadge.classList.remove("on");
    }

    // color preview glow
    const col = wavelengthToRGB(parseFloat(photoWavelength.value));
    photoColorPreview.style.boxShadow = `0 0 0 1px rgba(15,23,42,0.10) inset, 0 0 12px ${col}`;

    // spawn photons based on intensity
    const I = parseFloat(photoIntensity.value);
    const photonRate = 6 + 22*I;
    const expected = photonRate*sdt;
    for (let i=0;i<expected;i++){
      if (Math.random() < expected - i) spawnPhoton();
    }

    const absorptionY = (geom.bandTop + geom.bandBot)/2;

    // photons
    for (let i=state.objs.photons.length-1;i>=0;i--){
      const p = state.objs.photons[i];
      p.y += p.speed*sdt;
      if (p.y > absorptionY) {
        if (canExcite) {
          spawnElectron(p.x + rand(-8,8));
          spawnHole(p.x + rand(-8,8));
          state.excitationsFrame++;
        }
        state.objs.photons.splice(i,1);
      } else if (p.y > geom.h + 20) {
        state.objs.photons.splice(i,1);
      }
    }

    // electrons
    for (let i=state.objs.electrons.length-1;i>=0;i--){
      const e = state.objs.electrons[i];
      e.y += e.vy*sdt;
      if (e.y < geom.bandTop + 4) e.vy = Math.abs(e.vy)*0.5;
      if (e.y >= geom.surfaceY) {
        if (photoHasO2.checked) spawnRadical("o2m", e.x);
        state.objs.electrons.splice(i,1);
      }
    }

    // holes
    for (let i=state.objs.holes.length-1;i>=0;i--){
      const h = state.objs.holes[i];
      h.y += h.vy*sdt;
      if (h.y >= geom.surfaceY) {
        if (photoHasH2O.checked) spawnRadical("oh", h.x);
        state.objs.holes.splice(i,1);
      }
    }

    // radicals
    for (let i=state.objs.radicals.length-1;i>=0;i--){
      const r = state.objs.radicals[i];
      r.age += sdt;
      if (r.age >= r.ttl) state.objs.radicals.splice(i,1);
    }

    // passive pollutant decay when exciting
    if (canExcite && state.pollutant > 0) {
      state.pollutant = clamp(state.pollutant - 0.0048*sdt*(I+0.3), 0, 1);
    }

    state.smoothRate = 0.9*state.smoothRate + 0.1*(state.excitationsFrame/Math.max(dt,1e-3));
    photoRateValue.textContent = String(Math.round(state.smoothRate));
    photoRadValue.textContent = String(state.radicalsTotal);

    const pct = Math.round(state.pollutant*100);
    photoPollFill.style.width = `${pct}%`;
    photoPollText.textContent = `${pct}%`;
  }

  function render() {
    const w = geom.w, h = geom.h;
    ctx.clearRect(0,0,w,h);

    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(0,0,w,h);

    // Bands
    ctx.strokeStyle = "rgba(15,23,42,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(geom.left, geom.bandTop);
    ctx.lineTo(geom.right, geom.bandTop);
    ctx.moveTo(geom.left, geom.bandBot);
    ctx.lineTo(geom.right, geom.bandBot);
    ctx.stroke();

    ctx.fillStyle = "rgba(148,163,184,0.20)";
    ctx.fillRect(geom.left, geom.bandTop, geom.right-geom.left, geom.bandBot-geom.bandTop);

    ctx.fillStyle = "#111827";
    ctx.font = "12px Poppins";
    ctx.fillText("Conduction Band (CB)", geom.left, geom.bandTop - 6);
    ctx.fillText("Valence Band (VB)", geom.left, geom.bandBot + 16);

    // Surface
    ctx.strokeStyle = "rgba(15,23,42,0.5)";
    ctx.beginPath();
    ctx.moveTo(geom.left, geom.surfaceY);
    ctx.lineTo(geom.right, geom.surfaceY);
    ctx.stroke();
    ctx.fillText("Surface", geom.left, geom.surfaceY + 16);

    // photons
    for (const p of state.objs.photons) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 6);
      ctx.lineTo(p.x, p.y + 6);
      ctx.stroke();
    }

    // electrons
    for (const e of state.objs.electrons) {
      ctx.fillStyle = "#1e88e5";
      ctx.beginPath(); ctx.arc(e.x, e.y, 4, 0, Math.PI*2); ctx.fill();
      if (photoShowTrails.checked) {
        ctx.fillStyle = "rgba(30,136,229,0.3)";
        ctx.beginPath(); ctx.arc(e.x, e.y + 12, 3, 0, Math.PI*2); ctx.fill();
      }
    }

    // holes
    for (const hObj of state.objs.holes) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath(); ctx.arc(hObj.x, hObj.y, 4, 0, Math.PI*2); ctx.fill();
      if (photoShowTrails.checked) {
        ctx.fillStyle = "rgba(239,68,68,0.3)";
        ctx.beginPath(); ctx.arc(hObj.x, hObj.y - 10, 3, 0, Math.PI*2); ctx.fill();
      }
    }

    // radicals
    for (const r of state.objs.radicals) {
      const alpha = clamp(1 - r.age/r.ttl, 0, 1);
      const rad = 5 + 2*alpha;
      const col = r.type === "oh" ? [0,188,212] : [34,197,94];
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, Math.PI*2); ctx.fill();
    }
  }

  function initOnce() {
    // input bindings
    ["input","change"].forEach(evt => {
      photoMaterial.addEventListener(evt, ()=>{});
      photoDoping.addEventListener(evt, ()=>{});
      photoWavelength.addEventListener(evt, ()=>{});
      photoIntensity.addEventListener(evt, ()=>{});
    });

    photoPlay.addEventListener("click", ()=>{ state.running = true; });
    photoPause.addEventListener("click", ()=>{ state.running = false; });
    photoReset.addEventListener("click", ()=>{
      state.objs.photons.length=0;
      state.objs.electrons.length=0;
      state.objs.holes.length=0;
      state.objs.radicals.length=0;
      state.radicalsTotal=0;
      state.smoothRate=0;
      state.pollutant=1.0;
      photoRateValue.textContent="0";
      photoRadValue.textContent="0";
      photoPollFill.style.width="100%";
      photoPollText.textContent="100%";
    });
  }

  return {
    id: "photocatalysis",
    title: "Photocatalysis: Bands → Charges → Radicals",
    subtitle: "Light excites electrons across a bandgap; charges form radicals that remove pollutants at the surface.",
    themeClass: "theme-photo",
    themeLabel: "Theme: Teal Blue",
    containerId,
    initOnce,
    resize,
    tick(dt){ if (state.running) tick(dt); },
    render,
    onShow(){ resize(); }
  };
})();

/* -----------------------------
   Distillation Module
----------------------------- */
const DistillationSim = (() => {
  const containerId = "sim-distillation";
  const canvas = document.getElementById("distilCanvas");
  const ctx = canvas.getContext("2d");

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

  const geom = { w:0,h:0, colTop:80, colBottom:380, colLeft:160, colRight:680 };
  const state = { running:true, bubbles:[], drops:[], trayProfiles:[] };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || 900;
    const cssH = rect.height || 460;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW*dpr;
    canvas.height = cssH*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);

    geom.w = cssW; geom.h = cssH;
    geom.colLeft = 160;
    geom.colRight = cssW - 240;
    geom.colBottom = Math.min(cssH - 80, 380);
  }

  function computeProfiles() {
    let alpha = parseFloat(distilAlpha.value);
    const zF = parseFloat(distilFeed.value);
    const N = parseInt(distilTrays.value,10);
    const R = parseFloat(distilReflux.value);

    if (distilMixture.value === "hex_hep") alpha = 1.7;
    if (distilMixture.value === "tol_eth") alpha = 1.5;

    distilAlpha.value = alpha.toFixed(2);
    distilAlphaValue.textContent = alpha.toFixed(2);

    const sepFactor = Math.log(1 + (alpha - 1) * N * (0.5 + 0.5 * (R / (R + 1)))) * 0.42;

    let xD = zF + (1 - zF) * (1 - Math.exp(-sepFactor));
    let xB = zF * Math.exp(-sepFactor);

    xD = clamp(xD, zF, 0.995);
    xB = clamp(xB, 0.005, zF);

    const trayArr = [];
    for (let i=0;i<N;i++){
      const t = i / Math.max(1, N-1);
      trayArr.push(xB + (xD - xB) * (1 - t));
    }
    state.trayProfiles = trayArr;

    distilTopValue.textContent = (xD*100).toFixed(1) + "%";
    distilBottomValue.textContent = (xB*100).toFixed(1) + "%";

    distilTopMetric.textContent = xD.toFixed(3);
    distilBottomMetric.textContent = xB.toFixed(3);
    distilSepMetric.textContent = (xD - xB).toFixed(3);
    distilTrayMetric.textContent = String(N);

    distilTopFill.style.width = (xD*100).toFixed(0) + "%";
    distilBottomFill.style.width = (xB*100).toFixed(0) + "%";
  }

  function spawnBubble() {
    if (state.bubbles.length >= 36) return;
    state.bubbles.push({
      x: rand(geom.colLeft+10, geom.colRight-10),
      y: geom.colBottom - rand(0,20),
      vy: -rand(30,60) * parseFloat(distilHeat.value),
      r: rand(4,7)
    });
  }

  function spawnDrop() {
    if (state.drops.length >= 36) return;
    state.drops.push({
      x: rand(geom.colLeft+10, geom.colRight-10),
      y: geom.colTop + rand(0,20),
      vy: rand(30,55) * parseFloat(distilHeat.value),
      r: rand(3,5)
    });
  }

  function tick(dt) {
    const heat = parseFloat(distilHeat.value);
    const bubbleRate = 10 * heat;
    const dropRate = 8 * heat;

    for (let i=0;i<bubbleRate*dt;i++) if (Math.random() < bubbleRate*dt - i) spawnBubble();
    for (let i=0;i<dropRate*dt;i++) if (Math.random() < dropRate*dt - i) spawnDrop();

    for (let i=state.bubbles.length-1;i>=0;i--){
      const b = state.bubbles[i];
      b.y += b.vy*dt;
      if (b.y < geom.colTop + 5) state.bubbles.splice(i,1);
    }
    for (let i=state.drops.length-1;i>=0;i--){
      const d = state.drops[i];
      d.y += d.vy*dt;
      if (d.y > geom.colBottom - 5) state.drops.splice(i,1);
    }
  }

  function render() {
    const w=geom.w, h=geom.h;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="#e5e7eb";
    ctx.fillRect(0,0,w,h);

    const L=geom.colLeft, R=geom.colRight, T=geom.colTop, B=geom.colBottom;

    const grad = ctx.createLinearGradient(0,T,0,B);
    grad.addColorStop(0,"rgba(14,165,233,0.25)");
    grad.addColorStop(1,"rgba(248,113,113,0.25)");

    ctx.fillStyle=grad;
    ctx.strokeStyle="rgba(15,23,42,0.6)";
    ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.roundRect(L,T,R-L,B-T,12);
    ctx.fill(); ctx.stroke();

    const N = parseInt(distilTrays.value,10);
    const trays = state.trayProfiles;
    const spacing = (B - T - 30)/Math.max(1,N);

    for (let i=0;i<N;i++){
      const y = B - 15 - i*spacing;
      const xLight = trays[i] ?? parseFloat(distilFeed.value);

      ctx.strokeStyle="rgba(15,23,42,0.5)";
      ctx.beginPath();
      ctx.moveTo(L+10,y); ctx.lineTo(R-10,y); ctx.stroke();

      const W=(R-L)-30;
      const barX=L+15;
      const barY=y-3;
      const LW=W*xLight;

      ctx.fillStyle="#0ea5e9";
      ctx.fillRect(barX,barY,LW,6);

      ctx.fillStyle="#f97316";
      ctx.fillRect(barX+LW,barY,W-LW,6);
    }

    for (const b of state.bubbles){
      ctx.fillStyle="rgba(59,130,246,0.85)";
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
    }
    for (const d of state.drops){
      ctx.fillStyle="rgba(220,38,38,0.9)";
      ctx.beginPath(); ctx.ellipse(d.x,d.y,d.r,d.r+1.5,0,0,Math.PI*2); ctx.fill();
    }

    const zF = parseFloat(distilFeed.value);
    const feedY = T + (B - T)*0.45;
    ctx.strokeStyle="rgba(15,23,42,0.7)";
    ctx.beginPath(); ctx.moveTo(L-50,feedY); ctx.lineTo(L,feedY); ctx.stroke();
    ctx.fillStyle="#111827";
    ctx.font="11px Poppins";
    ctx.fillText(`Feed (zF = ${zF.toFixed(2)})`, L-120, feedY-6);
  }

  function initOnce() {
    ["input","change"].forEach(evt => {
      distilMixture.addEventListener(evt, computeProfiles);
      distilAlpha.addEventListener(evt, () => { distilAlphaValue.textContent = parseFloat(distilAlpha.value).toFixed(2); computeProfiles(); });
      distilFeed.addEventListener(evt, () => { distilFeedValue.textContent = parseFloat(distilFeed.value).toFixed(2); computeProfiles(); });
      distilTrays.addEventListener(evt, () => { distilTraysValue.textContent = distilTrays.value; computeProfiles(); });
      distilReflux.addEventListener(evt, () => { distilRefluxValue.textContent = parseFloat(distilReflux.value).toFixed(2); computeProfiles(); });
      distilHeat.addEventListener(evt, () => { distilHeatValue.textContent = parseFloat(distilHeat.value).toFixed(2); });
    });

    distilPlay.addEventListener("click", ()=>{ state.running=true; });
    distilPause.addEventListener("click", ()=>{ state.running=false; });
    distilReset.addEventListener("click", ()=>{
      state.bubbles.length=0; state.drops.length=0;
      computeProfiles();
    });
  }

  return {
    id: "distillation",
    title: "Fractional Distillation Tower",
    subtitle: "Repeated vapour–liquid contact across trays enriches the top in the more volatile component.",
    themeClass: "theme-distil",
    themeLabel: "Theme: Crimson Red",
    containerId,
    initOnce,
    resize,
    tick(dt){ if (state.running) tick(dt); },
    render,
    onShow(){ resize(); computeProfiles(); }
  };
})();

/* -----------------------------
   Ion Exchange Module (NEW)
   Concept model:
   - Resin bed has capacity sites, initially filled with "resin ion"
   - Incoming target ion binds preferentially (selectivity) and advances an exchange front downward
   - Effluent concentration stays low until front reaches outlet (breakthrough)
----------------------------- */
const IonExchangeSim = (() => {
  const containerId = "sim-ionExchange";

  const canvas = document.getElementById("ionCanvas");
  const ctx = canvas.getContext("2d");

  const ionResinType = document.getElementById("ionResinType");
  const ionSystem = document.getElementById("ionSystem");
  const ionFlow = document.getElementById("ionFlow");
  const ionFlowValue = document.getElementById("ionFlowValue");
  const ionCapacity = document.getElementById("ionCapacity");
  const ionCapacityValue = document.getElementById("ionCapacityValue");
  const ionSelectivity = document.getElementById("ionSelectivity");
  const ionSelValue = document.getElementById("ionSelValue");
  const ionInfluent = document.getElementById("ionInfluent");
  const ionInflValue = document.getElementById("ionInflValue");

  const ionEffFill = document.getElementById("ionEffFill");
  const ionEffText = document.getElementById("ionEffText");
  const ionCapFill = document.getElementById("ionCapFill");
  const ionCapText = document.getElementById("ionCapText");

  const ionFrontMetric = document.getElementById("ionFrontMetric");
  const ionOutMetric = document.getElementById("ionOutMetric");
  const ionCapMetric = document.getElementById("ionCapMetric");
  const ionStateMetric = document.getElementById("ionStateMetric");

  const ionPlay = document.getElementById("ionPlay");
  const ionPause = document.getElementById("ionPause");
  const ionReset = document.getElementById("ionReset");
  const ionRegen = document.getElementById("ionRegen");

  const geom = { w:0,h:0, colX:140, colY:60, colW:420, colH:360 };

  const state = {
    running: true,
    // bed model
    front: 0.0,       // 0 top, 1 bottom
    frontWidth: 0.16, // thickness of mass transfer zone
    capUsed: 0.0,     // 0..1
    effluent: 0.0,    // 0..1
    // particles
    incoming: [],
    outgoing: []
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || 900;
    const cssH = rect.height || 460;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW*dpr;
    canvas.height = cssH*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);

    geom.w = cssW; geom.h = cssH;
    geom.colX = 120;
    geom.colY = 70;
    geom.colW = Math.min(520, cssW - 260);
    geom.colH = Math.min(380, cssH - 120);
  }

  function scenarioLabels() {
    const resinType = ionResinType.value; // cation/anion
    const sys = ionSystem.value;
    if (sys === "softening") {
      return resinType === "anion"
        ? { target:"NO₃⁻", resin:"Cl⁻", out:"Cl⁻" }  // force sensible pairing even if user toggles
        : { target:"Ca²⁺", resin:"Na⁺", out:"Na⁺" };
    }
    // nitrate
    return resinType === "cation"
      ? { target:"Ca²⁺", resin:"Na⁺", out:"Na⁺" }
      : { target:"NO₃⁻", resin:"Cl⁻", out:"Cl⁻" };
  }

  function updateUI() {
    ionFlowValue.textContent = `${(+ionFlow.value).toFixed(2)}×`;
    ionCapacityValue.textContent = `${(+ionCapacity.value).toFixed(2)}×`;
    ionSelValue.textContent = `${(+ionSelectivity.value).toFixed(2)}×`;
    ionInflValue.textContent = `${(+ionInfluent.value).toFixed(2)}×`;

    const effPct = Math.round(state.effluent*100);
    ionEffFill.style.width = `${effPct}%`;
    ionEffText.textContent = `${effPct}%`;

    const capPct = Math.round(state.capUsed*100);
    ionCapFill.style.width = `${capPct}%`;
    ionCapText.textContent = `${capPct}%`;

    ionFrontMetric.textContent = `${Math.round(state.front*100)}%`;
    ionOutMetric.textContent = `${effPct}%`;
    ionCapMetric.textContent = `${capPct}%`;

    if (capPct >= 98) ionStateMetric.textContent = "Exhausted";
    else if (effPct >= 50) ionStateMetric.textContent = "Breakthrough";
    else ionStateMetric.textContent = "Filtering";
  }

  function spawnParticles(dt) {
    // simple visuals: green target ions entering at top; pink leaving at bottom when breakthrough grows
    const flow = parseFloat(ionFlow.value);
    const infl = parseFloat(ionInfluent.value);

    const inRate = 18 * infl; // particles/sec
    const expectedIn = inRate * dt;
    for (let i=0;i<expectedIn;i++){
      if (Math.random() < expectedIn - i && state.incoming.length < 55) {
        state.incoming.push({
          x: rand(geom.colX + 18, geom.colX + geom.colW - 18),
          y: geom.colY - 12,
          vy: 60 * flow * (0.7 + 0.6*Math.random()),
          r: 4
        });
      }
    }

    const outRate = 16 * flow * state.effluent; // more breakthrough -> more leaving ions
    const expectedOut = outRate * dt;
    for (let i=0;i<expectedOut;i++){
      if (Math.random() < expectedOut - i && state.outgoing.length < 55) {
        state.outgoing.push({
          x: rand(geom.colX + 18, geom.colX + geom.colW - 18),
          y: geom.colY + geom.colH + 10,
          vy: -50 * (0.7 + 0.6*Math.random()),
          r: 4
        });
      }
    }
  }

  function tick(dt) {
    const flow = parseFloat(ionFlow.value);
    const cap = parseFloat(ionCapacity.value);
    const sel = parseFloat(ionSelectivity.value);
    const infl = parseFloat(ionInfluent.value);

    // Front speed: increases with influent + flow; decreases with capacity; increases with selectivity (sharper front)
    const baseSpeed = 0.030; // per second at nominal settings
    const speed = baseSpeed * infl * flow * (0.75 + 0.55*sel) / cap;

    // Front width: higher selectivity -> narrower zone; higher flow -> broader (less contact time)
    const width = clamp(0.22 - 0.08*sel + 0.06*flow, 0.08, 0.28);
    state.frontWidth = width;

    // Move front down until it hits bottom
    if (state.capUsed < 1.0) {
      state.front = clamp(state.front + speed*dt, 0, 1);
      // capacity used grows as front advances + some additional loading in zone
      state.capUsed = clamp(state.front + 0.35*state.frontWidth, 0, 1);
    }

    // Effluent: near-zero before front reaches bottom; rises as front passes outlet
    // Smooth "S-curve" around breakthrough point
    const breakthroughPoint = 1.0 - 0.40*state.frontWidth; // earlier with wider zone
    const k = 18; // steepness
    const x = (state.front - breakthroughPoint);
    const sig = 1/(1 + Math.exp(-k*x));
    state.effluent = clamp(sig, 0, 1);

    // Particles
    spawnParticles(dt);

    for (let i=state.incoming.length-1;i>=0;i--){
      const p = state.incoming[i];
      p.y += p.vy*dt;
      if (p.y > geom.colY + geom.colH + 18) state.incoming.splice(i,1);
    }
    for (let i=state.outgoing.length-1;i>=0;i--){
      const p = state.outgoing[i];
      p.y += p.vy*dt;
      if (p.y < geom.colY - 28) state.outgoing.splice(i,1);
    }

    updateUI();
  }

  function drawColumn(labels) {
    // Column body
    const x=geom.colX, y=geom.colY, w=geom.colW, h=geom.colH;

    const g = ctx.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0,"rgba(109,40,217,0.10)");
    g.addColorStop(1,"rgba(109,40,217,0.22)");

    ctx.fillStyle = g;
    ctx.strokeStyle = "rgba(15,23,42,0.65)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x,y,w,h,14);
    ctx.fill();
    ctx.stroke();

    // Resin bead grid (conceptual)
    const cols = 8;
    const rows = 10;
    const dx = w/(cols+1);
    const dy = h/(rows+1);

    for (let r=1;r<=rows;r++){
      for (let c=1;c<=cols;c++){
        const bx = x + c*dx + rand(-1.2,1.2);
        const by = y + r*dy + rand(-1.2,1.2);

        // Determine bead state by position relative to exchange front
        const pos = (by - y)/h; // 0..1
        const inTargetRegion = pos <= state.front - state.frontWidth*0.5;
        const inZone = Math.abs(pos - state.front) < state.frontWidth*0.5;

        let fill;
        if (inTargetRegion) fill = "rgba(34,197,94,0.85)";     // bound target (green)
        else if (inZone) fill = "rgba(250,204,21,0.85)";       // transition zone (yellow)
        else fill = "rgba(96,165,250,0.85)";                   // original resin ion (blue)

        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(bx, by, 7, 0, Math.PI*2);
        ctx.fill();

        ctx.strokeStyle = "rgba(15,23,42,0.20)";
        ctx.stroke();
      }
    }

    // Exchange front line (glow)
    const frontY = y + state.front*h;
    ctx.strokeStyle = "rgba(34,197,94,0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x+10, frontY);
    ctx.lineTo(x+w-10, frontY);
    ctx.stroke();

    ctx.strokeStyle = "rgba(34,197,94,0.25)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(x+10, frontY);
    ctx.lineTo(x+w-10, frontY);
    ctx.stroke();

    // Labels: inlet/outlet + ion names
    ctx.fillStyle = "#111827";
    ctx.font = "12px Poppins";

    ctx.fillText(`Inlet: target ion = ${labels.target}`, x, y - 18);
    ctx.fillText(`Resin starts with: ${labels.resin}`, x, y - 2);
    ctx.fillText(`Outlet: target ion % rises at breakthrough`, x, y + h + 22);

    // Arrow showing flow direction
    ctx.strokeStyle = "rgba(15,23,42,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w + 35, y + 8);
    ctx.lineTo(x + w + 35, y + h - 8);
    ctx.stroke();

    // arrowhead
    ctx.beginPath();
    ctx.moveTo(x + w + 35, y + h - 8);
    ctx.lineTo(x + w + 28, y + h - 18);
    ctx.lineTo(x + w + 42, y + h - 18);
    ctx.closePath();
    ctx.fillStyle = "rgba(15,23,42,0.55)";
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.fillText("Flow", x + w + 18, y + h + 12);

    // Side “what’s happening” text
    const sideX = x + w + 70;
    ctx.font = "11px Poppins";
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.fillText("Green beads:", sideX, y + 30);
    ctx.fillText("sites now holding", sideX, y + 44);
    ctx.fillText(`${labels.target}`, sideX, y + 58);

    ctx.fillStyle = "rgba(15,23,42,0.65)";
    ctx.fillText("Yellow zone:", sideX, y + 90);
    ctx.fillText("exchange front", sideX, y + 104);

    ctx.fillStyle = "rgba(15,23,42,0.65)";
    ctx.fillText("Blue beads:", sideX, y + 136);
    ctx.fillText("still holding", sideX, y + 150);
    ctx.fillText(`${labels.resin}`, sideX, y + 164);
  }

  function render() {
    const w=geom.w, h=geom.h;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="#e5e7eb";
    ctx.fillRect(0,0,w,h);

    const labels = scenarioLabels();
    drawColumn(labels);

    // incoming (green)
    for (const p of state.incoming) {
      ctx.fillStyle = "rgba(34,197,94,0.95)";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    }

    // outgoing (pink)
    for (const p of state.outgoing) {
      ctx.fillStyle = "rgba(251,113,133,0.95)";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    }
  }

  function resetState() {
    state.front = 0.0;
    state.capUsed = 0.0;
    state.effluent = 0.0;
    state.incoming.length = 0;
    state.outgoing.length = 0;
    updateUI();
  }

  function regenerate() {
    // regeneration restores resin to initial state (front returns upward, capacity clears)
    state.front = 0.0;
    state.capUsed = 0.0;
    state.effluent = 0.0;
    state.incoming.length = 0;
    state.outgoing.length = 0;
    updateUI();
  }

  function initOnce() {
    ["input","change"].forEach(evt => {
      ionResinType.addEventListener(evt, ()=>{});
      ionSystem.addEventListener(evt, ()=>{});
      ionFlow.addEventListener(evt, ()=>{});
      ionCapacity.addEventListener(evt, ()=>{});
      ionSelectivity.addEventListener(evt, ()=>{});
      ionInfluent.addEventListener(evt, ()=>{});
    });

    ionPlay.addEventListener("click", ()=>{ state.running=true; });
    ionPause.addEventListener("click", ()=>{ state.running=false; });
    ionReset.addEventListener("click", resetState);
    ionRegen.addEventListener("click", regenerate);

    updateUI();
  }

  return {
    id: "ionExchange",
    title: "Ion Exchange Column",
    subtitle: "Ions swap onto resin beads, forming an exchange front. Breakthrough occurs when the resin exhausts.",
    themeClass: "theme-ionx",
    themeLabel: "Theme: Indigo/Violet",
    containerId,
    initOnce,
    resize,
    tick(dt){ if (state.running) tick(dt); },
    render,
    onShow(){ resize(); updateUI(); }
  };
})();

/* ===========================================================
   ADD NEW SIM MODULES HERE (Slots 4–12)
   Paste your future sim module objects here, then add to SIM_REGISTRY.
   Example skeleton:
   const Sim4 = { id:"sim4", title:"...", subtitle:"...", themeClass:"theme-...", themeLabel:"...", containerId:"sim-sim4",
                  initOnce(){}, resize(){}, tick(dt){}, render(){}, onShow(){} };
   =========================================================== */

/* -----------------------------
   SIM REGISTRY
----------------------------- */
const SIM_REGISTRY = {
  photocatalysis: PhotocatalysisSim,
  distillation: DistillationSim,
  ionExchange: IonExchangeSim,

  // Slots 4–12 reserved:
  // sim4: Sim4,
  // sim5: Sim5,
  // ...
};

/* Track init so we only wire listeners once */
const initDone = new Set();

/* ===========================================================
   ROUTER / NAVIGATION
=========================================================== */
function hideAllSimContainers() {
  for (const sim of Object.values(SIM_REGISTRY)) {
    const el = document.getElementById(sim.containerId);
    if (el) el.hidden = true;
  }
  // also hide placeholder containers for slots not yet registered
  for (let i=4;i<=12;i++){
    const el = document.getElementById(`sim-sim${i}`);
    if (el) el.hidden = true;
  }
}

function showHub() {
  currentSimId = null;
  hideAllSimContainers();

  simScreen.hidden = true;
  simScreen.classList.remove("active");

  hubScreen.classList.add("active");
  document.body.className = "theme-hub";
}

function openSim(simId) {
  const sim = SIM_REGISTRY[simId];
  if (!sim) return; // not registered

  // Hub -> sim
  hubScreen.classList.remove("active");
  simScreen.hidden = false;
  simScreen.classList.add("active");

  // Hide all, then show one
  hideAllSimContainers();
  const container = document.getElementById(sim.containerId);
  if (container) container.hidden = false;

  // Set header + theme
  simTitle.textContent = sim.title;
  simSubtitle.textContent = sim.subtitle;
  simThemeLabel.textContent = sim.themeLabel;

  document.body.className = sim.themeClass;

  // Init once
  if (!initDone.has(simId)) {
    sim.initOnce?.();
    initDone.add(simId);
  }

  // Show hooks
  sim.onShow?.();

  currentSimId = simId;
}

backToHubBtn.addEventListener("click", showHub);

simRows.forEach(row => {
  const simId = row.dataset.sim;
  const btn = row.querySelector(".sim-row-btn");

  // Only clickable if registered and not disabled
  const isReady = Boolean(SIM_REGISTRY[simId]);
  if (!isReady) return;

  row.addEventListener("click", () => openSim(simId));
  if (btn) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openSim(simId);
    });
  }
});

/* ===========================================================
   MAIN LOOP
=========================================================== */
let lastT = null;
function loop(t) {
  if (!lastT) lastT = t;
  const dt = clamp((t - lastT)/1000, 0, 0.05);
  lastT = t;

  if (currentSimId && SIM_REGISTRY[currentSimId]) {
    const sim = SIM_REGISTRY[currentSimId];
    sim.tick?.(dt);
    sim.render?.();
  }

  requestAnimationFrame(loop);
}

window.addEventListener("resize", () => {
  if (currentSimId && SIM_REGISTRY[currentSimId]) {
    SIM_REGISTRY[currentSimId].resize?.();
  }
});

/* Init */
function init() {
  showHub();
  // pre-resize canvases so first open is crisp
  PhotocatalysisSim.resize();
  DistillationSim.resize();
  IonExchangeSim.resize();
  requestAnimationFrame(loop);
}
init();
