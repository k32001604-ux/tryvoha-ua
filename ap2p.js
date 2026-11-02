const API="https://neptun.in.ua/api/v1/alerts";
const RAIONS_GEO="https://neptun.in.ua/raions.geojson";
const OBLASTS_GEO="https://neptun.in.ua/oblasts.geojson";
const $=id=>document.getElementById(id);
const map=L.map("map",{zoomControl:true,scrollWheelZoom:true,minZoom:5,maxZoom:11,maxBounds:[[43,20],[53.5,42.5]],maxBoundsViscosity:.85}).setView([48.7,31.2],5.8);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
let raionFeatures=[],oblastFeatures=[],alerts={oblasts:[],raions:[]},raionLayer=null,oblastLayer=null,geoLoaded=false,apiLoaded=false;
const keyOf=f=>String(f?.properties?.key||f?.properties?.KEY||"");
const nameOf=f=>f?.properties?.name||f?.properties?.NAME_1||f?.properties?.NAME||f?.properties?.name_uk||keyOf(f)||"Район";
function statusOf(f){const k=keyOf(f);if(!k||!apiLoaded)return"unknown";if((alerts.oblasts||[]).some(x=>x.key===k||(k.includes(":")&&x.key===k.split(":")[0])))return"alert";if((alerts.raions||[]).some(x=>x.key===k))return"alert";return"clear"}
function label(s){return s==="alert"?"ПОВІТРЯНА ТРИВОГА":s==="clear"?"ТРИВОГИ НЕМАЄ":"НЕМАЄ ДАНИХ"}
function color(s){return s==="alert"?"#ed414d":s==="clear"?"#239b70":"#778397"}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderList(){
 const rows=raionFeatures.map(f=>({name:nameOf(f),status:statusOf(f),key:keyOf(f)})).sort((a,b)=>a.name.localeCompare(b.name,"uk"));
 $("regions").innerHTML=rows.map(r=>`<button class="region-row" type="button" data-key="${esc(r.key)}"><span class="region-name">${esc(r.name)}</span><span class="status ${r.status}">${r.status==="alert"?"ТРИВОГА":r.status==="clear"?"СПОКІЙ":"НЕМАЄ ДАНИХ"}</span></button>`).join("");
 document.querySelectorAll(".region-row").forEach(btn=>btn.addEventListener("click",()=>{const f=raionFeatures.find(x=>keyOf(x)===btn.dataset.key);if(!f||!raionLayer)return;const item=raionLayer.getLayers().find(x=>x.feature===f);if(item){map.fitBounds(item.getBounds(),{maxZoom:9,padding:[18,18]});item.openTooltip()}$("selected-region").textContent=`${nameOf(f)} — ${label(statusOf(f))}`}));
 const active=rows.filter(x=>x.status==="alert").length;
 $("overall").textContent=!apiLoaded?"Статус не підтверджено":active?`Тривога у районах: ${active}`:"Активних тривог не знайдено";
 $("count").textContent=`${rows.length} районів`;
}
function renderMap(){
 if(!geoLoaded)return;
 if(raionLayer)map.removeLayer(raionLayer);if(oblastLayer)map.removeLayer(oblastLayer);
 raionLayer=L.geoJSON({type:"FeatureCollection",features:raionFeatures},{style:f=>({color:"#dce7f5",weight:.75,opacity:.9,fillColor:color(statusOf(f)),fillOpacity:.78}),onEachFeature:(f,l)=>{l.bindTooltip(`<b>${esc(nameOf(f))}</b><br>${label(statusOf(f))}`);l.on("click",()=>{$("selected-region").textContent=`${nameOf(f)} — ${label(statusOf(f))}`})}}).addTo(map);
 if(oblastFeatures.length)oblastLayer=L.geoJSON({type:"FeatureCollection",features:oblastFeatures},{interactive:false,style:{color:"#17283c",weight:2.2,opacity:1,fillOpacity:0}}).addTo(map);
 const b=raionLayer.getBounds();if(b.isValid()){map.fitBounds(b,{padding:[8,8]});map.setMaxBounds(b.pad(.08))}
 renderList();
}
async function json(url,title){const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw Error(`${title}: HTTP ${r.status}`);return r.json()}
async function loadGeo(){const [r,o]=await Promise.all([json(RAIONS_GEO,"Межі районів"),json(OBLASTS_GEO,"Межі областей")]);if(!Array.isArray(r.features)||!r.features.length)throw Error("У файлі районів немає полігонів");raionFeatures=r.features;oblastFeatures=Array.isArray(o.features)?o.features:[];geoLoaded=true;renderMap()}
async function refresh(){const btn=$("refresh");btn.disabled=true;try{if(!geoLoaded)await loadGeo();const d=await json(API,"Джерело тривог");if(!Array.isArray(d.oblasts)||!Array.isArray(d.raions))throw Error("Невідомий формат відповіді");alerts=d;apiLoaded=true;$("updated").textContent=`Оновлено: ${new Date().toLocaleTimeString("uk-UA")}`;$("connection").textContent="Дані отримано";$("connection").className="connection ok";$("map-error").classList.add("hidden");renderMap()}catch(e){$("connection").textContent="Немає підтверджених даних";$("connection").className="connection bad";$("map-error").textContent=`Не вдалося отримати ${e.message}. Карта може відображатися без актуальних статусів.`;$("map-error").classList.remove("hidden");$("overall").textContent="Статус не підтверджено";if(geoLoaded)renderMap()}finally{btn.disabled=false}}
$("refresh").addEventListener("click",refresh);refresh();setInterval(refresh,15000);
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
