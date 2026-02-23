/* ===========================================================
   Raya Science Studio — Modular Simulation Router
   (Drop-in script.js replacement)
   - Fixes Ion Exchange (Sim 3)
   - Adds Double Slit (Sim 4) with same UI style (injected into Slot 4)
   =========================================================== */

/* -----------------------------
   Helpers
----------------------------- */
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }

/* -----------------------------
   Canvas roundRect polyfill
   (prevents bugs on browsers that lack ctx.roundRect)
----------------------------- */
(function ensureRoundRect() {
  const proto = CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (!proto) return;
  if (typeof proto.roundRect === "function") return;

  proto.roundRect = function (x, y, w, h, r) {
    let radius = r;
    if (typeof r === "number") radius = { tl: r, tr: r, br: r, bl: r };
    else radius = Object.assign({ tl: 0, tr: 0, br: 0, bl: 0 }, r || {});
    const { tl, tr, br, bl } = radius;

    this.beginPath();
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + tr);
    this.lineTo(x + w, y + h - br);
    this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    this.lineTo(x + bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - bl);
    this.lineTo(x, y + tl);
    this.quadraticCurveTo(x, y, x + tl, y);
    this.closePath();
    return this;
  };
})();

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
infoClose?.addEventListener("click", closeInfoPopover);

/* ===========================================================
   SIM MODULES
=========================================================== */

/* -----------------------------
   Photocatalysis Module (UNCHANGED from your original)
----------------------------- */
const PhotocatalysisSim = (() => {
  const containerId = "sim-photocatalysis";

  const canvas = document.getElementById("photoCanvas");
  const ctx = canvas.getContext("2d");

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

    for (const p of state.objs.photons) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 6);
      ctx.lineTo(p.x, p.y + 6);
      ctx.stroke();
    }

    for (const e of state.objs.electrons) {
      ctx.fillStyle = "#1e88e5";
      ctx.beginPath(); ctx.arc(e.x, e.y, 4, 0, Math.PI*2); ctx.fill();
      if (photoShowTrails.checked) {
        ctx.fillStyle = "rgba(30,136,229,0.3)";
        ctx.beginPath(); ctx.arc(e.x, e.y + 12, 3, 0, Math.PI*2); ctx.fill();
      }
    }

    for (const hObj of state.objs.holes) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath(); ctx.arc(hObj.x, hObj.y, 4, 0, Math.PI*2); ctx.fill();
      if (photoShowTrails.checked) {
        ctx.fillStyle = "rgba(239,68,68,0.3)";
        ctx.beginPath(); ctx.arc(hObj.x, hObj.y - 10, 3, 0, Math.PI*2); ctx.fill();
      }
    }

    for (const r of state.objs.radicals) {
      const alpha = clamp(1 - r.age/r.ttl, 0, 1);
      const rad = 5 + 2*alpha;
      const col = r.type === "oh" ? [0,188,212] : [34,197,94];
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, Math.PI*2); ctx.fill();
    }
  }

  function initOnce() {
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
   Distillation Module (UNCHANGED from your original)
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
   Ion Exchange Module (FIXED)
   Fixes:
   - Capacity now accumulates over time (no weird jumps)
   - Breakthrough (effluent) depends on BOTH front reaching outlet and exhaustion
   - UI stays stable; reset/regenerate are clean
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
    front: 0.0,        // 0..1
    frontWidth: 0.16,  // 0.08..0.28
    capUsed: 0.0,      // 0..1 (integrated)
    effluent: 0.0,     // 0..1
    incoming: [],
    outgoing: [],
    // for smoothing:
    effSmooth: 0.0
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
    const resinType = ionResinType.value;
    const sys = ionSystem.value;
    if (sys === "softening") {
      return resinType === "anion"
        ? { target:"NO₃⁻", resin:"Cl⁻", out:"Cl⁻" }
        : { target:"Ca²⁺", resin:"Na⁺", out:"Na⁺" };
    }
    return resinType === "cation"
      ? { target:"Ca²⁺", resin:"Na⁺", out:"Na⁺" }
      : { target:"NO₃⁻", resin:"Cl⁻", out:"Cl⁻" };
  }

  function setUI() {
    if (ionFlowValue) ionFlowValue.textContent = `${(+ionFlow.value).toFixed(2)}×`;
    if (ionCapacityValue) ionCapacityValue.textContent = `${(+ionCapacity.value).toFixed(2)}×`;
    if (ionSelValue) ionSelValue.textContent = `${(+ionSelectivity.value).toFixed(2)}×`;
    if (ionInflValue) ionInflValue.textContent = `${(+ionInfluent.value).toFixed(2)}×`;

    const effPct = Math.round(state.effSmooth*100);
    const capPct = Math.round(state.capUsed*100);

    ionEffFill.style.width = `${effPct}%`;
    ionEffText.textContent = `${effPct}%`;

    ionCapFill.style.width = `${capPct}%`;
    ionCapText.textContent = `${capPct}%`;

    ionFrontMetric.textContent = `${Math.round(state.front*100)}%`;
    ionOutMetric.textContent = `${effPct}%`;
    ionCapMetric.textContent = `${capPct}%`;

    if (capPct >= 99) ionStateMetric.textContent = "Exhausted";
    else if (effPct >= 5) ionStateMetric.textContent = "Breakthrough";
    else ionStateMetric.textContent = "Filtering";
  }

  function spawnParticles(dt) {
    const flow = +ionFlow.value;
    const infl = +ionInfluent.value;

    // incoming target ions (green) entering at top
    const inRate = 16 * infl;
    const expIn = inRate * dt;
    for (let i=0;i<expIn;i++){
      if (Math.random() < expIn - i && state.incoming.length < 60) {
        state.incoming.push({
          x: rand(geom.colX + 18, geom.colX + geom.colW - 18),
          y: geom.colY - 14,
          vy: 55 * flow * (0.75 + 0.5*Math.random()),
          r: 4
        });
      }
    }

    // outgoing (pink) leaving from bottom ONLY when effluent rises
    const outRate = 14 * flow * state.effSmooth;
    const expOut = outRate * dt;
    for (let i=0;i<expOut;i++){
      if (Math.random() < expOut - i && state.outgoing.length < 60) {
        state.outgoing.push({
          x: rand(geom.colX + 18, geom.colX + geom.colW - 18),
          y: geom.colY + geom.colH + 14,
          vy: 40 * (0.75 + 0.5*Math.random()), // downward motion (matches flow)
          r: 4
        });
      }
    }
  }

  function tick(dt) {
    const flow = +ionFlow.value;
    const capMult = +ionCapacity.value;
    const sel = +ionSelectivity.value;
    const infl = +ionInfluent.value;

    // front width: selectivity narrows, flow broadens
    state.frontWidth = clamp(0.22 - 0.08*sel + 0.06*flow, 0.08, 0.28);

    // Capacity usage integrates with time
    // More influent + more flow => faster loading; more capacity => slower loading
    const loadRate = (0.090 * infl * flow) / capMult; // per second, tuned to feel nice
    state.capUsed = clamp(state.capUsed + loadRate*dt, 0, 1);

    // Exchange front moves with loading, and selectivity makes it “advance more cleanly”
    const frontRate = loadRate * (0.75 + 0.55*sel);
    state.front = clamp(state.front + frontRate*dt, 0, 1);

    // Breakthrough needs BOTH:
    //  (A) front close to outlet
    //  (B) resin nearing exhaustion
    const outletGate = clamp((state.front - (1.0 - 0.55*state.frontWidth)) / (0.55*state.frontWidth + 1e-6), 0, 1);
    const exhaustGate = clamp((state.capUsed - 0.78) / 0.22, 0, 1); // starts after ~78% used
    const targetEff = clamp(outletGate * exhaustGate, 0, 1);

    // Smooth for UI stability
    state.effluent = targetEff;
    state.effSmooth = 0.88*state.effSmooth + 0.12*state.effluent;

    // particles
    spawnParticles(dt);

    for (let i=state.incoming.length-1;i>=0;i--){
      const p = state.incoming[i];
      p.y += p.vy*dt;
      if (p.y > geom.colY + geom.colH + 24) state.incoming.splice(i,1);
    }
    for (let i=state.outgoing.length-1;i>=0;i--){
      const p = state.outgoing[i];
      p.y += p.vy*dt;
      if (p.y > geom.h + 40) state.outgoing.splice(i,1);
    }

    setUI();
  }

  function drawColumn(labels) {
    const x=geom.colX, y=geom.colY, w=geom.colW, h=geom.colH;

    const g = ctx.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0,"rgba(109,40,217,0.10)");
    g.addColorStop(1,"rgba(109,40,217,0.22)");

    ctx.fillStyle = g;
    ctx.strokeStyle = "rgba(15,23,42,0.65)";
    ctx.lineWidth = 1.5;
    ctx.roundRect(x,y,w,h,14);
    ctx.fill();
    ctx.stroke();

    // resin beads
    const cols = 8;
    const rows = 10;
    const dx = w/(cols+1);
    const dy = h/(rows+1);

    for (let r=1;r<=rows;r++){
      for (let c=1;c<=cols;c++){
        const bx = x + c*dx + rand(-1.2,1.2);
        const by = y + r*dy + rand(-1.2,1.2);

        const pos = (by - y)/h;
        const inTargetRegion = pos <= state.front - state.frontWidth*0.5;
        const inZone = Math.abs(pos - state.front) < state.frontWidth*0.5;

        let fill;
        if (inTargetRegion) fill = "rgba(34,197,94,0.85)";
        else if (inZone) fill = "rgba(250,204,21,0.85)";
        else fill = "rgba(96,165,250,0.85)";

        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(bx, by, 7, 0, Math.PI*2);
        ctx.fill();

        ctx.strokeStyle = "rgba(15,23,42,0.20)";
        ctx.stroke();
      }
    }

    // exchange front glow line
    const frontY = y + state.front*h;

    ctx.strokeStyle = "rgba(34,197,94,0.25)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(x+10, frontY);
    ctx.lineTo(x+w-10, frontY);
    ctx.stroke();

    ctx.strokeStyle = "rgba(34,197,94,0.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x+10, frontY);
    ctx.lineTo(x+w-10, frontY);
    ctx.stroke();

    ctx.fillStyle = "#111827";
    ctx.font = "12px Poppins";
    ctx.fillText(`Inlet: target ion = ${labels.target}`, x, y - 18);
    ctx.fillText(`Resin starts with: ${labels.resin}`, x, y - 2);
    ctx.fillText(`Outlet: target ion rises at breakthrough`, x, y + h + 22);

    // flow arrow
    ctx.strokeStyle = "rgba(15,23,42,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w + 35, y + 8);
    ctx.lineTo(x + w + 35, y + h - 8);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w + 35, y + h - 8);
    ctx.lineTo(x + w + 28, y + h - 18);
    ctx.lineTo(x + w + 42, y + h - 18);
    ctx.closePath();
    ctx.fillStyle = "rgba(15,23,42,0.55)";
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.font = "11px Poppins";
    ctx.fillText("Flow", x + w + 18, y + h + 12);
  }

  function render() {
    const w=geom.w, h=geom.h;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="#e5e7eb";
    ctx.fillRect(0,0,w,h);

    const labels = scenarioLabels();
    drawColumn(labels);

    for (const p of state.incoming) {
      ctx.fillStyle = "rgba(34,197,94,0.95)";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    }

    for (const p of state.outgoing) {
      ctx.fillStyle = "rgba(251,113,133,0.95)";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    }
  }

  function resetState() {
    state.front = 0.0;
    state.capUsed = 0.0;
    state.effluent = 0.0;
    state.effSmooth = 0.0;
    state.incoming.length = 0;
    state.outgoing.length = 0;
    setUI();
  }

  function initOnce() {
    ionPlay.addEventListener("click", ()=>{ state.running=true; });
    ionPause.addEventListener("click", ()=>{ state.running=false; });
    ionReset.addEventListener("click", resetState);
    ionRegen.addEventListener("click", resetState);

    // keep UI pills correct from first frame
    ["input","change"].forEach(evt => {
      ionFlow.addEventListener(evt, setUI);
      ionCapacity.addEventListener(evt, setUI);
      ionSelectivity.addEventListener(evt, setUI);
      ionInfluent.addEventListener(evt, setUI);
      ionResinType.addEventListener(evt, setUI);
      ionSystem.addEventListener(evt, setUI);
    });

    setUI();
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
    onShow(){ resize(); setUI(); }
  };
})();

/* -----------------------------
   Double Slit Module (SIM 4)
   - Injects full UI into Slot 4 so you don't edit index.html
   - Same “canvas card + controls card” style
   - Shows intensity pattern + photon hits
----------------------------- */
const DoubleSlitSim = (() => {
  const containerId = "sim-sim4";
  const container = document.getElementById(containerId);

  let canvas, ctx;
  let running = true;

  // controls (created at runtime)
  let elLambda, elSep, elSlitW, elScreenDist, elRate, elWhich, elMode;
  let elMetricVis, elMetricFringe, elMetricContrast, elMetricState;
  let elReset, elPlay, elPause;

  // sim state
  const state = {
    // screen intensity accumulator + photon hits
    hits: [],
    intensity: [],
    t: 0,
    maxKeep: 2500,
    // smoothing
    smoothContrast: 0,
  };

  function injectUI() {
    if (!container) return;
    // Only inject once
    if (container.dataset.built === "1") return;
    container.dataset.built = "1";

    container.innerHTML = `
      <section class="sim-canvas-card">
        <canvas id="slitCanvas" aria-label="Double Slit Experiment"></canvas>

        <div class="legend-bar legend-right">
          <div class="legend-title">Key</div>
          <div class="legend-item"><span class="bubble-dot"></span> Photon hit</div>
          <div class="legend-item"><span class="tray-color tray-top"></span> Bright fringe</div>
          <div class="legend-item"><span class="tray-color tray-bottom"></span> Dark fringe</div>
        </div>

        <div class="ix-panels">
          <div class="ix-panel">
            <div class="ix-panel-head">
              <span>Screen Pattern</span>
              <button class="info-badge" data-info="Without which-path detection, waves from both slits interfere and produce bright/dark fringes. With which-path detection, interference disappears and the pattern becomes a smooth sum of two single-slit blobs.">?</button>
            </div>
            <div class="poll-bar"><div id="slitVisFill" class="poll-fill ix-eff" style="width:0%"></div></div>
            <div class="poll-text"><span id="slitVisText">0%</span> Interference Visibility</div>
          </div>

          <div class="ix-panel">
            <div class="ix-panel-head">
              <span>Photon Count</span>
              <button class="info-badge" data-info="The pattern builds up one detection at a time. More photons makes the fringes clearer (if interference is present).">?</button>
            </div>
            <div class="poll-bar"><div id="slitCountFill" class="poll-fill ix-cap" style="width:0%"></div></div>
            <div class="poll-text"><span id="slitCountText">0</span> Hits (recent window)</div>
          </div>
        </div>

        <p class="sim-footnote">Try toggling “Which-path detector.” Notice how the pattern changes even though photons still hit the screen.</p>
      </section>

      <aside class="sim-controls-card">
        <h3>Double Slit Controls</h3>

        <div class="control-group">
          <label for="slitMode">Source</label>
          <select id="slitMode">
            <option value="photon">Photon-by-photon</option>
            <option value="continuous">Continuous intensity</option>
          </select>
        </div>

        <div class="control-group">
          <label for="slitLambda">Wavelength λ (nm)
            <button class="info-badge" data-info="Shorter wavelength → fringes get tighter (closer together).">?</button>
          </label>
          <div class="row">
            <input id="slitLambda" type="range" min="380" max="720" value="550" />
            <span id="slitLambdaValue" class="value-pill">550 nm</span>
          </div>
        </div>

        <div class="control-group">
          <label for="slitSep">Slit Separation d
            <button class="info-badge" data-info="Greater separation → fringes get tighter (more oscillations across the screen).">?</button>
          </label>
          <div class="row">
            <input id="slitSep" type="range" min="40" max="180" value="110" />
            <span id="slitSepValue" class="value-pill">110</span>
          </div>
        </div>

        <div class="control-group">
          <label for="slitW">Slit Width a
            <button class="info-badge" data-info="Wider slits reduce diffraction spread; narrower slits spread out more. This controls the envelope around the interference fringes.">?</button>
          </label>
          <div class="row">
            <input id="slitW" type="range" min="8" max="60" value="22" />
            <span id="slitWValue" class="value-pill">22</span>
          </div>
        </div>

        <div class="control-group">
          <label for="slitL">Screen Distance L
            <button class="info-badge" data-info="Farther screen distance makes fringes spread out (in simple far-field approximation).">?</button>
          </label>
          <div class="row">
            <input id="slitL" type="range" min="140" max="520" value="320" />
            <span id="slitLValue" class="value-pill">320</span>
          </div>
        </div>

        <div class="control-group">
          <label for="slitRate">Emission Rate
            <button class="info-badge" data-info="Controls how fast hits accumulate in photon-by-photon mode.">?</button>
          </label>
          <div class="row">
            <input id="slitRate" type="range" min="0" max="1" step="0.01" value="0.35" />
            <span id="slitRateValue" class="value-pill">0.35</span>
          </div>
        </div>

        <div class="control-group">
          <label class="toggle">
            <input id="slitWhich" type="checkbox" />
            Which-path detector (no interference)
          </label>
        </div>

        <div class="control-group metrics">
          <div class="metric"><div class="metric-label">Visibility</div><div class="metric-value" id="slitMVis">–</div></div>
          <div class="metric"><div class="metric-label">Fringe Spacing</div><div class="metric-value" id="slitMFringe">–</div></div>
          <div class="metric"><div class="metric-label">Contrast</div><div class="metric-value" id="slitMCon">–</div></div>
          <div class="metric"><div class="metric-label">State</div><div class="metric-value" id="slitMState">Running</div></div>
        </div>

        <div class="control-buttons">
          <button id="slitPlay" class="primary">Play</button>
          <button id="slitPause">Pause</button>
          <button id="slitReset">Reset</button>
        </div>
      </aside>
    `;
  }

  function grabEls() {
    canvas = document.getElementById("slitCanvas");
    ctx = canvas.getContext("2d");

    elMode = document.getElementById("slitMode");
    elLambda = document.getElementById("slitLambda");
    elSep = document.getElementById("slitSep");
    elSlitW = document.getElementById("slitW");
    elScreenDist = document.getElementById("slitL");
    elRate = document.getElementById("slitRate");
    elWhich = document.getElementById("slitWhich");

    elMetricVis = document.getElementById("slitMVis");
    elMetricFringe = document.getElementById("slitMFringe");
    elMetricContrast = document.getElementById("slitMCon");
    elMetricState = document.getElementById("slitMState");

    elPlay = document.getElementById("slitPlay");
    elPause = document.getElementById("slitPause");
    elReset = document.getElementById("slitReset");

    // value pills
    const vLam = document.getElementById("slitLambdaValue");
    const vSep = document.getElementById("slitSepValue");
    const vW = document.getElementById("slitWValue");
    const vL = document.getElementById("slitLValue");
    const vRate = document.getElementById("slitRateValue");

    const visFill = document.getElementById("slitVisFill");
    const visText = document.getElementById("slitVisText");
    const countFill = document.getElementById("slitCountFill");
    const countText = document.getElementById("slitCountText");

    function syncLabels() {
      vLam.textContent = `${elLambda.value} nm`;
      vSep.textContent = `${elSep.value}`;
      vW.textContent = `${elSlitW.value}`;
      vL.textContent = `${elScreenDist.value}`;
      vRate.textContent = `${(+elRate.value).toFixed(2)}`;

      const vis = computeVisibility();
      const visPct = Math.round(vis * 100);
      visFill.style.width = `${visPct}%`;
      visText.textContent = `${visPct}%`;

      const count = state.hits.length;
      countText.textContent = `${count}`;
      countFill.style.width = `${Math.round((count / state.maxKeep) * 100)}%`;

      elMetricVis.textContent = `${visPct}%`;
      elMetricFringe.textContent = `${computeFringeSpacing().toFixed(1)} px`;
      elMetricContrast.textContent = `${Math.round(state.smoothContrast * 100)}%`;
      elMetricState.textContent = running ? "Running" : "Paused";
    }

    // bindings
    ["input", "change"].forEach(evt => {
      elLambda.addEventListener(evt, syncLabels);
      elSep.addEventListener(evt, syncLabels);
      elSlitW.addEventListener(evt, syncLabels);
      elScreenDist.addEventListener(evt, syncLabels);
      elRate.addEventListener(evt, syncLabels);
      elWhich.addEventListener(evt, () => {
        // if which-path toggled, clear intensity so the change is obvious
        resetState();
        syncLabels();
      });
      elMode.addEventListener(evt, () => {
        resetState();
        syncLabels();
      });
    });

    elPlay.addEventListener("click", () => { running = true; syncLabels(); });
    elPause.addEventListener("click", () => { running = false; syncLabels(); });
    elReset.addEventListener("click", () => { resetState(); syncLabels(); });

    // initial
    syncLabels();
  }

  function resize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width || 900;
    const cssH = rect.height || 460;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    state.intensity = new Array(Math.floor(cssW)).fill(0);
  }

  // Simple far-field-ish model:
  // Intensity(x) = envelope(a) * [ 1 + cos(k d x / L) ] / 2   (with which-path => remove cosine term)
  // envelope approximated as exp(-(x/spread)^2)
  function intensityAt(x, w, params) {
    const { lambda, d, a, L, whichPath } = params;
    const cx = w * 0.5;
    const dx = x - cx;

    // envelope width controlled by slit width a: smaller a => wider spread
    const spread = 0.25 * w * (28 / Math.max(8, a)); // tuned for visuals
    const env = Math.exp(- (dx*dx) / (2 * spread * spread));

    if (whichPath) {
      // smooth sum of two broad lobes (no interference)
      // model as two gaussians centered on the two slits projected to screen (simple)
      const sepPx = 0.24 * (d / 120) * w * (L / 320) * 0.22; // tuned
      const g1 = Math.exp(-((dx - sepPx)**2) / (2*spread*spread));
      const g2 = Math.exp(-((dx + sepPx)**2) / (2*spread*spread));
      return clamp(env * 0.55 * (g1 + g2), 0, 1);
    }

    const k = (2 * Math.PI) / Math.max(1, lambda);
    // phase proportional to path difference ~ d * x / L
    const phase = k * (d * dx) / Math.max(40, L);
    const fringes = 0.5 + 0.5 * Math.cos(phase);

    return clamp(env * fringes, 0, 1);
  }

  function computeVisibility() {
    // visibility ~ 1 when interference on, ~0 when which-path
    return elWhich && elWhich.checked ? 0.02 : 0.98;
  }

  function computeFringeSpacing() {
    // qualitative spacing on canvas in pixels ~ proportional to (lambda*L/d)
    if (!canvas) return 0;
    const w = canvas.getBoundingClientRect().width || 900;
    const lambda = +elLambda.value;
    const L = +elScreenDist.value;
    const d = +elSep.value;
    const spacing = (lambda * L / Math.max(1, d)) * (w / 900) * 0.06; // tuned
    return clamp(spacing, 6, 180);
  }

  function resetState() {
    state.hits.length = 0;
    state.t = 0;
    // reset intensity buffer to zero
    const w = canvas ? (canvas.getBoundingClientRect().width || 900) : 900;
    state.intensity = new Array(Math.floor(w)).fill(0);
    state.smoothContrast = 0;
  }

  function spawnHit(dt) {
    const w = state.intensity.length;
    if (w <= 0) return;

    const params = {
      lambda: +elLambda.value,
      d: +elSep.value,
      a: +elSlitW.value,
      L: +elScreenDist.value,
      whichPath: elWhich.checked
    };

    // sample x from the intensity distribution using rejection sampling
    // (fast enough for this size)
    for (let tries = 0; tries < 24; tries++) {
      const x = Math.floor(Math.random() * w);
      const y = Math.random();
      const I = intensityAt(x, w, params);
      if (y < I) {
        state.hits.push({ x, age: 0 });
        if (state.hits.length > state.maxKeep) state.hits.shift();
        break;
      }
    }
  }

  function tick(dt) {
    if (!canvas) return;
    state.t += dt;

    const w = state.intensity.length;
    const params = {
      lambda: +elLambda.value,
      d: +elSep.value,
      a: +elSlitW.value,
      L: +elScreenDist.value,
      whichPath: elWhich.checked
    };

    const mode = elMode.value;

    if (mode === "continuous") {
      // accumulate intensity smoothly (builds a histogram-like bar)
      const rate = 0.7 + 3.0 * (+elRate.value);
      const steps = Math.max(1, Math.floor(rate));
      for (let s=0; s<steps; s++){
        for (let x=0; x<w; x+=2) {
          state.intensity[x] += intensityAt(x, w, params) * 0.9;
        }
      }
    } else {
      // photon-by-photon: spawn hits
      const rate = 8 + 60 * (+elRate.value);
      const expected = rate * dt;
      for (let i=0;i<expected;i++){
        if (Math.random() < expected - i) spawnHit(dt);
      }

      // add hits to intensity buffer
      for (const h of state.hits) {
        state.intensity[h.x] += 1.0;
      }
    }

    // contrast estimate from intensity buffer (rough)
    let maxV = 0, minV = Infinity;
    for (let i=0;i<w;i+=3){
      const v = state.intensity[i];
      if (v > maxV) maxV = v;
      if (v < minV) minV = v;
    }
    const contrast = maxV > 0 ? clamp((maxV - minV) / (maxV + minV + 1e-6), 0, 1) : 0;
    state.smoothContrast = 0.90*state.smoothContrast + 0.10*contrast;

    // age hits
    for (let i=state.hits.length-1;i>=0;i--){
      state.hits[i].age += dt;
      if (state.hits[i].age > 2.4) state.hits.splice(i,1);
    }
  }

  function render() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.floor(rect.width || 900);
    const h = Math.floor(rect.height || 460);

    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(0,0,w,h);

    // draw barrier + slits (left side)
    const wallX = 180;
    const wallW = 26;
    const slitSep = +elSep.value * 0.55;
    const slitW = +elSlitW.value * 0.45;

    ctx.fillStyle = "rgba(15,23,42,0.30)";
    ctx.fillRect(wallX, 0, wallW, h);

    // cut two slits
    const cy = h * 0.45;
    const s1 = cy - slitSep * 0.5;
    const s2 = cy + slitSep * 0.5;

    ctx.clearRect(wallX, s1 - slitW*0.5, wallW, slitW);
    ctx.clearRect(wallX, s2 - slitW*0.5, wallW, slitW);

    // screen line (right)
    const screenX = w - 120;
    ctx.strokeStyle = "rgba(15,23,42,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenX, 20);
    ctx.lineTo(screenX, h - 20);
    ctx.stroke();

    ctx.fillStyle = "rgba(15,23,42,0.75)";
    ctx.font = "12px Poppins";
    ctx.fillText("Screen", screenX - 18, 16);

    // intensity histogram on screen
    const buf = state.intensity;
    let maxV = 1;
    for (let i=0;i<buf.length;i+=4) maxV = Math.max(maxV, buf[i]);

    ctx.strokeStyle = "rgba(14,165,233,0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    for (let y=0; y<h; y++){
      // map y->x on buffer (vertical screen)
      const t = y / Math.max(1, h-1);
      const bx = Math.floor(t * (buf.length - 1));
      const val = buf[bx] / maxV;
      const xOff = val * 90; // how far left bars extend from screen line
      const px = screenX - xOff;
      if (y === 0) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();

    // photon hits (dots) on screen
    ctx.fillStyle = "rgba(59,130,246,0.85)";
    for (const hit of state.hits) {
      // map hit.x (buffer x) -> screen y
      const t = hit.x / Math.max(1, buf.length - 1);
      const y = 20 + t * (h - 40);
      const a = clamp(1 - hit.age/2.4, 0, 1);
      ctx.fillStyle = `rgba(59,130,246,${0.25 + 0.60*a})`;
      ctx.beginPath();
      ctx.arc(screenX + 8, y, 3.2, 0, Math.PI*2);
      ctx.fill();
    }

    // draw rays hint
    ctx.strokeStyle = "rgba(15,23,42,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, cy);
    ctx.lineTo(wallX, s1);
    ctx.moveTo(60, cy);
    ctx.lineTo(wallX, s2);
    ctx.stroke();

    // label which-path status
    ctx.fillStyle = "rgba(15,23,42,0.75)";
    ctx.font = "12px Poppins";
    ctx.fillText(elWhich.checked ? "Which-path ON (no interference)" : "Which-path OFF (interference)", 20, h - 20);
  }

  function initOnce() {
    injectUI();
    grabEls();
    resize();
    resetState();
  }

  return {
    id: "sim4",
    title: "Double Slit Experiment",
    subtitle: "Interference builds up on the screen; measuring which path removes the fringe pattern.",
    // Use hub theme to avoid CSS edits; it still matches your system
    themeClass: "theme-hub",
    themeLabel: "Theme: Quantum (Hub Blue)",
    containerId,
    initOnce,
    resize,
    tick(dt){ if (running) tick(dt); },
    render,
    onShow(){ resize(); }
  };
})();

/* ===========================================================
   SIM REGISTRY
=========================================================== */
const SIM_REGISTRY = {
  photocatalysis: PhotocatalysisSim,
  distillation: DistillationSim,
  ionExchange: IonExchangeSim,
  sim4: DoubleSlitSim,
};

/* Track init so we only wire listeners once */
const initDone = new Set();

/* ===========================================================
   ROUTER / NAVIGATION
=========================================================== */
function hideAllSimContainers() {
  // registered sims
  for (const sim of Object.values(SIM_REGISTRY)) {
    const el = document.getElementById(sim.containerId);
    if (el) el.hidden = true;
  }
  // unregistered placeholders (still hide them)
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
  if (!sim) return;

  hubScreen.classList.remove("active");
  simScreen.hidden = false;
  simScreen.classList.add("active");

  hideAllSimContainers();
  const container = document.getElementById(sim.containerId);
  if (container) container.hidden = false;

  simTitle.textContent = sim.title;
  simSubtitle.textContent = sim.subtitle;
  simThemeLabel.textContent = sim.themeLabel;

  document.body.className = sim.themeClass;

  if (!initDone.has(simId)) {
    sim.initOnce?.();
    initDone.add(simId);
  }

  sim.onShow?.();
  currentSimId = simId;
}

backToHubBtn?.addEventListener("click", showHub);

// Enable sim4 row UI (button + status) if it exists in hub
function enableSimRow(simId) {
  const row = document.querySelector(`.sim-row[data-sim="${simId}"]`);
  if (!row) return;
  row.classList.remove("sim-coming");
  row.style.opacity = "";
  row.style.cursor = "pointer";
  const btn = row.querySelector(".sim-row-btn");
  if (btn) {
    btn.disabled = false;
    btn.textContent = "Open";
  }
  const status = row.querySelector(".sim-status");
  if (status) {
    status.classList.remove("ghost");
    status.textContent = "Ready";
  }
  const tag = row.querySelector(".sim-tag");
  if (tag && tag.textContent.toLowerCase().includes("reserved")) {
    tag.textContent = "Physics · Waves · Quantum";
  }
}

// Wire up hub rows
simRows.forEach(row => {
  const simId = row.dataset.sim;
  const btn = row.querySelector(".sim-row-btn");

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

  // Make sim4 appear as “Ready” in the hub (no HTML edits needed)
  enableSimRow("sim4");

  // pre-resize canvases so first open is crisp
  PhotocatalysisSim.resize();
  DistillationSim.resize();
  IonExchangeSim.resize();
  // Sim4 builds canvas only when opened; but safe to build early if you want:
  // DoubleSlitSim.initOnce();

  requestAnimationFrame(loop);
}
init();