const API = "https://neptun.in.ua/api/v1/alerts";
const GEOJSON = "https://neptun.in.ua/oblasts.geojson";
const $ = id => document.getElementById(id);
const map = L.map("map", { zoomControl:true, scrollWheelZoom:false }).setView([48.7,31.2],5.7);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 10,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

let features = [];
let alerts = { oblasts: [], raions: [] };
let layer = null;
let lastSuccessfulUpdate = null;

const norm = value => String(value || "").toLocaleLowerCase("uk").trim();
const featureKey = f => f?.properties?.key || "";
const featureName = f => f?.properties?.name || f?.properties?.NAME_1 || featureKey(f) || "Територія";
const raionNames = feature => (alerts.raions || []).map(x => norm(x.oblast));
function getStatus(feature) {
  const key = featureKey(feature);
  if (!key) return "unknown";
  if ((alerts.oblasts || []).some(x => x.key === key)) return "alert";
  const name = norm(featureName(feature));
  if ((alerts.raions || []).some(x => norm(x.oblast) === name)) return "partial";
  return "clear";
}
function style(feature) {
  const status = getStatus(feature);
  const fillColor = status === "alert" ? "#e83f4b" :
    status === "partial" ? "#efb544" :
    status === "clear" ? "#23966c" : "#718096";
  return { color:"#e5edf7", weight:1.15, fillColor, fillOpacity:.82 };
}
function statusText(status) {
  return status === "alert" ? "ПОВІТРЯНА ТРИВОГА" :
    status === "partial" ? "ЧАСТКОВА ТРИВОГА" :
    status === "clear" ? "ТРИВОГИ НЕМАЄ" : "НЕМАЄ ДАНИХ";
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function render() {
  if (!features.length) return;
  if (layer) map.removeLayer(layer);
  layer = L.geoJSON({type:"FeatureCollection", features}, {
    style,
    onEachFeature:(feature, item) => {
      const name = featureName(feature), status = getStatus(feature);
      item.bindTooltip(`<b>${escapeHtml(name)}</b><br>${statusText(status)}`);
      item.on("click", () => {
        $("selected-region").textContent = `${name}: ${statusText(status)}`;
      });
    }
  }).addTo(map);
  try { map.fitBounds(layer.getBounds(), {padding:[8,8]}); } catch(e) {}
  const rows = features.map(f => ({name:featureName(f), status:getStatus(f)}))
    .sort((a,b) => a.name.localeCompare(b.name,"uk"));
  $("regions").innerHTML = rows.map(r =>
    `<button class="region-row" type="button" data-region="${escapeHtml(r.name)}">
      <span class="region-name">${escapeHtml(r.name)}</span>
      <span class="status ${r.status}">${r.status==="alert"?"ТРИВОГА":r.status==="partial"?"ЧАСТКОВА":r.status==="clear"?"СПОКІЙ":"НЕМАЄ ДАНИХ"}</span>
    </button>`
  ).join("");
  document.querySelectorAll(".region-row").forEach(btn => btn.addEventListener("click", () => {
    const f = features.find(x => featureName(x) === btn.dataset.region);
    if (f && layer) {
      const target = layer.getLayers().find(x => x.feature === f);
      if (target) { map.fitBounds(target.getBounds(), {maxZoom:7}); target.openTooltip(); }
    }
    $("selected-region").textContent = `${btn.dataset.region}: ${statusText(getStatus(f))}`;
  }));
  const active = rows.filter(x => x.status === "alert").length;
  const partial = rows.filter(x => x.status === "partial").length;
  $("overall").textContent = active || partial
    ? `Тривога: ${active} · Часткова: ${partial}`
    : "Активних тривог не знайдено";
  $("count").textContent = `${rows.length} територій`;
}
async function loadGeo() {
  const response = await fetch(GEOJSON, {cache:"no-store"});
  if (!response.ok) throw new Error(`Карта: HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.features) || !data.features.length) throw new Error("Не знайдено контури областей");
  features = data.features;
}
async function refresh() {
  const button = $("refresh");
  button.disabled = true;
  try {
    if (!features.length) await loadGeo();
    const response = await fetch(API, {cache:"no-store"});
    if (!response.ok) throw new Error(`Джерело тривог: HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.oblasts) || !Array.isArray(data.raions)) {
      throw new Error("Невідомий формат відповіді джерела");
    }
    alerts = data;
    lastSuccessfulUpdate = new Date();
    $("updated").textContent = `Оновлено: ${lastSuccessfulUpdate.toLocaleTimeString("uk-UA")}`;
    $("connection").textContent = "З’єднання активне";
    $("connection").className = "connection ok";
    $("map-error").classList.add("hidden");
    render();
  } catch (error) {
    $("connection").textContent = "Немає підтверджених даних";
    $("connection").className = "connection bad";
    $("map-error").textContent = `Не вдалося оновити дані: ${error.message}. Статуси не вважаються актуальними. Спробуйте пізніше.`;
    $("map-error").classList.remove("hidden");
    $("overall").textContent = "Статус не підтверджено";
  } finally {
    button.disabled = false;
  }
}
$("refresh").addEventListener("click", refresh);
refresh();
setInterval(refresh, 10000);
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
