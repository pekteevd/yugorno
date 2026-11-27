(() => {
"use strict";
const root=document.getElementById("map");
if(!root)return;
const css=`
#map .section-head{align-items:center;gap:12px;flex-wrap:wrap}
.map-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.map-toolbar button,.map-toolbar select,.map-toolbar input{border:1px solid var(--line);border-radius:10px;padding:9px 12px;background:var(--paper);color:var(--ink)}
.map-toolbar button.active{background:var(--forest);color:#fff;border-color:var(--forest)}
.map-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px}
#yugorno-map{height:clamp(390px,62vh,680px);min-height:360px;border-radius:16px;overflow:hidden;background:#e4e9df;border:1px solid var(--line);z-index:1}
.map-side{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:14px;min-width:0;max-height:680px;overflow:auto}
.map-side h4{margin:0 0 10px}.map-place{padding:10px 0;border-top:1px solid var(--line)}.map-place:first-of-type{border-top:0}
.map-place button{border:0;background:none;color:var(--forest);font-weight:750;text-align:left;padding:0}
.map-muted{color:var(--muted);font-size:12px}.map-chip{display:inline-flex;align-items:center;gap:6px;border-radius:20px;padding:5px 9px;background:#edf0e8;font-size:12px}
.map-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:12px 0;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--paper)}
.map-form label{display:grid;gap:5px;font-size:12px;color:var(--muted)}.map-form input,.map-form select,.map-form textarea{width:100%;min-width:0;border:1px solid var(--line);border-radius:9px;padding:9px;background:#fff;color:var(--ink)}.map-form textarea{min-height:68px}.map-form .wide{grid-column:1/-1}
.map-empty{padding:20px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:12px}
.map-legend{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0}
.map-moderation{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;border:1px solid var(--line);border-radius:18px;padding:16px;margin:14px 0;background:var(--paper);box-shadow:0 5px 18px rgba(30,45,30,.06)}
.map-moderation-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.map-moderation-kind{display:inline-flex;align-items:center;border-radius:20px;padding:5px 10px;background:#e9eee5;color:var(--forest);font-size:12px;font-weight:700}
.map-moderation-title{display:block;font-size:19px;line-height:1.25;color:var(--ink);margin:2px 0}
.map-moderation-description{font-size:14px;line-height:1.6;color:var(--ink);white-space:pre-wrap;margin:0}
.map-moderation-meta{display:flex;flex-wrap:wrap;gap:7px;color:var(--muted);font-size:12px}
.map-moderation-meta span{padding:5px 8px;border-radius:8px;background:#f0f2ed}
.map-moderation-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:9px}
.map-moderation-gallery a{display:block;overflow:hidden;border-radius:12px;background:#e9ece6;aspect-ratio:4/3}
.map-moderation-gallery img{display:block;width:100%;height:100%;max-width:none;max-height:none;object-fit:cover}
.map-moderation-map{display:grid;gap:7px;min-width:0}
.map-moderation-map-title{font-size:13px;font-weight:700;color:var(--ink)}
.map-moderation-map iframe{display:block;width:100%;height:220px;border:1px solid var(--line);border-radius:12px;background:#e9ece6}
.map-moderation-note{padding:11px 12px;border-radius:12px;background:#f2f4ef;color:var(--ink);font-size:13px;line-height:1.5}
.map-moderation-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:4px}
.map-moderation-actions button{border:0;border-radius:10px;padding:10px 15px;font-weight:700;cursor:pointer}
.map-moderation-actions button[data-mod-status="published"]{background:var(--forest);color:#fff}
.map-moderation-actions button[data-mod-status="rejected"]{background:#f5e9e6;color:#8b352b}
.map-moderation-actions button:disabled{opacity:.55;cursor:wait}
.map-moderation-item{display:grid;gap:8px;padding:12px;border:1px solid var(--line);border-radius:13px}
.map-moderation-item h5{margin:0;font-size:14px}
.map-moderation img,.map-impression-photo{max-width:100%;max-height:220px;border-radius:10px;object-fit:cover}
@media(min-width:700px){.map-moderation{padding:19px}.map-moderation-gallery{grid-template-columns:repeat(auto-fill,minmax(190px,1fr))}}

.map-track-note{font-size:12px;color:var(--muted);grid-column:1/-1}
.map-location-result{display:block;width:100%;text-align:left;padding:9px 10px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink);margin:5px 0;cursor:pointer}.map-location-result:hover{border-color:var(--forest)}#place-location-query{flex:1;min-width:180px}#place-location-map{background:#e4e9df}
@media(max-width:850px){.map-layout{grid-template-columns:1fr}#yugorno-map{height:54vh;min-height:360px}.map-side{max-height:360px}}
@media(max-width:560px){.map-form{grid-template-columns:1fr}.map-form .wide{grid-column:auto}#map .section-head span{display:none}}
`;
const style=document.createElement("style");style.textContent=css;document.head.append(style);
root.innerHTML=`
<div class="section-head"><h3>Карта открытий Югорно</h3><span>Места, впечатления и маршруты</span></div>
<div class="map-toolbar" id="map-modes">
<button type="button" data-mode="map" class="active">Карта</button><button type="button" data-mode="list">Список</button><button type="button" data-mode="routes">Маршруты</button>
</div>
<div class="map-toolbar" id="map-layers" aria-label="Подложка карты">
<button type="button" data-layer="standard" class="active">Обычная карта</button><button type="button" data-layer="satellite">Спутник</button><button type="button" data-layer="terrain">Рельеф</button>
</div>
<div class="map-toolbar">
<input id="map-search" type="search" placeholder="Название, регион или место" aria-label="Поиск по карте">
<select id="map-category" aria-label="Категория"><option value="">Все категории</option><option>Природа</option><option>Красивые места</option><option>Деревни и города</option><option>История и культура</option><option>Люди и ремёсла</option><option>Еда</option><option>Ночлег</option><option>Активный отдых</option><option>Другое</option></select>
<button type="button" id="map-search-btn">Найти</button><button type="button" id="map-add-btn">＋ Добавить место</button>
</div>
<div id="map-form-host"></div>
<div class="map-layout"><div id="map-main"><div id="yugorno-map" role="application" aria-label="Интерактивная карта Югорно"></div><div class="map-muted" style="margin-top:7px">Подложки предоставляются внешними картографическими сервисами. Авторство карты указано в её углу.</div></div>
<aside class="map-side"><h4 id="map-side-title">Места поблизости</h4><div id="map-side-content"><div class="map-empty">Загружаем места…</div></div></aside></div>
<div class="map-muted" style="margin-top:12px">Новые места и впечатления сначала проходят модерацию. В первой версии карта работает онлайн.</div>
`;
const categories=["Природа","Красивые места","Деревни и города","История и культура","Люди и ремёсла","Еда","Ночлег","Активный отдых","Другое"];
let map=null,layerControl=null,markers=null,routeLine=null,places=[],routes=[],activeMode="map",activeLayer="standard",currentPlace=null,leafletReady=false;
let placePickerMap=null,placePickerMarker=null,placePickerClickHandler=null,selectedPlaceLocation=null,geocoderLastRequest=0;
const geocoderCache=new Map();
const tileLayers={
 standard:{url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png",attr:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'},
 satellite:{url:"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",attr:'Tiles © <a href="https://www.esri.com/">Esri</a>'},
 terrain:{url:"https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",attr:'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, style © <a href="https://opentopomap.org/">OpenTopoMap</a>'}
};
function api(path,options={}){const initData=window.Telegram?.WebApp?.initData;const headers={...(options.headers||{})};if(initData)headers["X-Telegram-Init-Data"]=initData;else if(window.yugornoLocalDemo)headers["X-Local-Demo-User"]="local-tester";return fetch(path,{...options,headers}).then(async r=>{const data=await r.json();if(!r.ok||!data.ok){const matches=data.matches?.map(item=>item.title).filter(Boolean).join(", ");throw new Error((data.error||"Ошибка запроса")+(matches?" Возможные совпадения: "+matches:""))}return data})}
function safe(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function showToast(message){if(typeof window.toast==="function")window.toast(message);else console.info(message)}
async function askUserConfirmation(message){if(typeof window.askConfirm==="function")return window.askConfirm(message);return window.confirm(message)}
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error("Не удалось загрузить библиотеку карты"));document.head.append(s)})}
async function ensureLeaflet(){if(window.L)return;if(!document.querySelector('link[data-leaflet]')){const l=document.createElement("link");l.rel="stylesheet";l.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";l.dataset.leaflet="1";document.head.append(l)}await loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");}
function initMap(){if(map||!window.L)return;map=L.map("yugorno-map",{zoomControl:true,scrollWheelZoom:true,preferCanvas:true}).setView([56.5,47.5],5);map.attributionControl.setPrefix(false);map.addLayer(L.tileLayer(tileLayers.standard.url,{attribution:tileLayers.standard.attr,maxZoom:19,crossOrigin:true}));markers=L.markerClusterGroup({showCoverageOnHover:false,spiderfyOnMaxZoom:true,maxClusterRadius:48}).addTo(map);map.on("moveend",()=>{if(activeMode==="map")loadPlaces()});}
function setLayer(name){if(!map||!tileLayers[name])return;activeLayer=name;map.eachLayer(l=>{if(l instanceof L.TileLayer)map.removeLayer(l)});const conf=tileLayers[name];L.tileLayer(conf.url,{attribution:conf.attr,maxZoom:name==="terrain"?17:19,crossOrigin:true}).addTo(map);document.querySelectorAll("[data-layer]").forEach(b=>b.classList.toggle("active",b.dataset.layer===name));}
function iconFor(category){const icons={"Природа":"🌿","Красивые места":"⛰️","Деревни и города":"🏡","История и культура":"🏛️","Люди и ремёсла":"🧶","Еда":"🍲","Ночлег":"🛏️","Активный отдых":"🥾","Другое":"📍"};return icons[category]||"📍"}
function markerIcon(category){return L.divIcon({className:"",html:'<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#315548;border:2px solid #fff;box-shadow:0 2px 8px #0004;display:grid;place-items:center"><span style="transform:rotate(45deg);font-size:16px">'+iconFor(category)+'</span></div>',iconSize:[34,34],iconAnchor:[17,34]})}
function renderPlaces(){if(!markers)return;markers.clearLayers();places.forEach(p=>{if(!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lng)))return;const marker=L.marker([p.lat,p.lng],{icon:markerIcon(p.category)}).bindPopup('<b>'+safe(p.title)+'</b><br>'+safe(p.category)+'<br><button type="button" data-open-place="'+safe(p.id)+'">Подробнее</button>');marker.on("popupopen",()=>{const el=document.querySelector('[data-open-place="'+CSS.escape(p.id)+'"]');el?.addEventListener("click",()=>openPlace(p.id),{once:true})});marker.addTo(markers)});renderSide()}
function renderSide(){
 const host=document.getElementById("map-side-content");
 if(activeMode==="routes"){
  document.getElementById("map-side-title").textContent="Опубликованные маршруты";
  host.innerHTML=routes.length?routes.map(r=>'<div class="map-place"><button type="button" data-route="'+safe(r.id)+'">'+safe(r.title)+'</button><div class="map-muted">'+safe(r.transport)+' · '+(r.stopIds?.length||0)+' остановок'+(r.trackPoints?.length?' · GPS-трек':'')+'</div><p>'+safe((r.stops||[]).map(s=>s.title).join(" → "))+'</p><p>'+safe(r.description)+'</p><div class="map-toolbar"><button type="button" data-export-gpx="'+safe(r.id)+'">Экспорт GPX</button></div></div>').join(""):'<div class="map-empty">Пока нет опубликованных маршрутов. Создать маршрут можно после добавления мест.</div>';
  host.querySelectorAll("[data-route]").forEach(b=>b.onclick=()=>{const route=routes.find(r=>r.id===b.dataset.route);if(route)renderRouteOnMap(route)});
  host.querySelectorAll("[data-export-gpx]").forEach(b=>b.onclick=()=>{const route=routes.find(r=>r.id===b.dataset.exportGpx);if(route)downloadGPX(route)});
  return;
 }
 document.getElementById("map-side-title").textContent=activeMode==="list"?"Список мест":"Места на карте";
 host.innerHTML=places.length?places.map(p=>'<div class="map-place"><button type="button" data-place="'+safe(p.id)+'">'+safe(p.title)+'</button><div class="map-muted">'+iconFor(p.category)+' '+safe(p.category)+(p.region?' · '+safe(p.region):'')+'</div><p>'+safe(p.description||"Описание пока не добавлено")+'</p></div>').join(""):'<div class="map-empty">Пока нет опубликованных мест. Добавь первое открытие Югорно.</div>';
 host.querySelectorAll("[data-place]").forEach(b=>b.addEventListener("click",()=>openPlace(b.dataset.place)));
}
async function loadPlaces(){try{const params=new URLSearchParams();const q=document.getElementById("map-search").value.trim(),cat=document.getElementById("map-category").value;if(q)params.set("q",q);if(cat)params.set("category",cat);if(map&&activeMode==="map"){const b=map.getBounds();params.set("west",b.getWest());params.set("east",b.getEast());params.set("south",b.getSouth());params.set("north",b.getNorth())}const data=await api("/api/places?"+params);places=data.items;renderPlaces()}catch(e){document.getElementById("map-side-content").innerHTML='<div class="map-empty">Не удалось загрузить места. '+safe(e.message)+'</div>'}}
async function loadRoutes(){try{routes=(await api("/api/routes")).items;renderSide();if(window.Telegram?.WebApp?.initData||window.yugornoLocalDemo){const b=document.createElement("button");b.className="btn";b.textContent="＋ Создать маршрут";b.onclick=showRouteForm;document.getElementById("map-side-content").prepend(b)}}catch(e){showToast("Маршруты пока недоступны: "+e.message)}}
async function showRouteForm(){
 try{
  places=(await api("/api/places")).items;
  if(places.length<2){showToast("Для маршрута сначала добавь два опубликованных места");return}
  const host=document.getElementById("map-form-host");
  host.innerHTML='<form class="map-form" id="new-route-form"><label class="wide">Название маршрута<input name="title" maxlength="120" required></label><label>Передвижение<select name="transport"><option value="mixed">Смешанное</option><option value="walking">Пешком</option><option value="cycling">Велосипед</option><option value="driving">Автомобиль</option><option value="water">Вода</option></select></label><label class="wide">Описание<textarea name="description" maxlength="3000"></textarea></label><label class="wide">GPS-трек GPX (необязательно)<input name="gpx" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml"></label><div class="map-track-note" id="gpx-status">Можно добавить GPS-трек. Без него маршрут будет состоять из списка остановок.</div><div class="wide map-muted">Отметь остановки в нужном порядке. Загруженный GPX-трек сохранит реальную геометрию маршрута.</div>'+places.map(p=>'<label><span><input type="checkbox" name="stopIds" value="'+safe(p.id)+'"> '+safe(p.title)+'</span></label>').join("")+'<div class="wide map-legend" id="route-stop-order">Порядок остановок появится здесь после выбора.</div><button class="btn" type="submit">Отправить на проверку</button><button class="btn outline" type="button" id="route-cancel">Отмена</button></form>';
  let trackPoints=[],selectedStopIds=[];
  const orderHost=document.getElementById("route-stop-order");
  const renderStopOrder=()=>{orderHost.replaceChildren();if(!selectedStopIds.length){orderHost.textContent="Порядок остановок появится здесь после выбора.";return}selectedStopIds.forEach((id,index)=>{const chip=document.createElement("span");chip.className="map-chip";chip.textContent=(index+1)+". "+(places.find(place=>place.id===id)?.title||"Место");orderHost.append(chip)})};
  document.querySelectorAll('#new-route-form input[name="stopIds"]').forEach(input=>input.addEventListener("change",()=>{if(input.checked){if(!selectedStopIds.includes(input.value))selectedStopIds.push(input.value)}else selectedStopIds=selectedStopIds.filter(id=>id!==input.value);renderStopOrder()}));
  document.getElementById("route-cancel").onclick=()=>host.replaceChildren();
  document.querySelector('#new-route-form input[name="gpx"]').onchange=async e=>{
   const file=e.target.files?.[0];if(!file){trackPoints=[];return}
   try{trackPoints=await parseGPX(file);document.getElementById("gpx-status").textContent='GPX загружен: '+trackPoints.length+' точек'}
   catch(error){trackPoints=[];e.target.value="";document.getElementById("gpx-status").textContent=error.message;showToast(error.message)}
  };
  document.getElementById("new-route-form").onsubmit=async e=>{
   e.preventDefault();const f=new FormData(e.currentTarget);
   try{
    if(selectedStopIds.length<2)throw new Error("Выбери минимум два места и отметь их в нужной последовательности");
    await api("/api/routes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title:f.get("title"),transport:f.get("transport"),description:f.get("description"),stopIds:selectedStopIds,trackPoints})});
    host.replaceChildren();showToast("Маршрут отправлен на проверку");loadRoutes()
   }catch(err){showToast(err.message)}
  };
 }catch(e){showToast(e.message)}
}
function setMode(mode){activeMode=mode;document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));document.getElementById("map-main").hidden=mode!=="map";if(mode==="map"){document.querySelector(".map-layout").style.gridTemplateColumns="minmax(0,1fr) 300px";setTimeout(()=>map?.invalidateSize(),80);loadPlaces()}else{document.querySelector(".map-layout").style.gridTemplateColumns="1fr";if(mode==="list")loadPlaces();else loadRoutes()}document.getElementById("map-side-title").textContent=mode==="routes"?"Опубликованные маршруты":mode==="list"?"Список мест":"Места на карте"}
function destroyPlacePicker(){if(placePickerMap){const container=placePickerMap.getContainer();if(placePickerClickHandler)container.removeEventListener("click",placePickerClickHandler);placePickerMap.remove();placePickerMap=null}placePickerClickHandler=null;placePickerMarker=null;selectedPlaceLocation=null}
function selectPlaceLocation(lat,lng,label){
 lat=Number(lat);lng=Number(lng);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat< -90||lat>90||lng< -180||lng>180)throw new Error("Не удалось определить корректную точку");
 selectedPlaceLocation={lat,lng,label:String(label||"Выбранная точка")};
 const form=document.getElementById("new-place-form");
 if(form){form.elements.lat.value=String(lat);form.elements.lng.value=String(lng)}
 const status=document.getElementById("place-location-status");
 if(status)status.textContent="✓ "+selectedPlaceLocation.label;
 if(placePickerMap){
  const point=[lat,lng];
  if(placePickerMarker)placePickerMarker.setLatLng(point);
  else placePickerMarker=L.marker(point,{draggable:true}).addTo(placePickerMap);
  placePickerMarker.off("dragend").on("dragend",()=>{const p=placePickerMarker.getLatLng();selectPlaceLocation(p.lat,p.lng,"Точка на карте")});
  placePickerMap.setView(point,Math.max(placePickerMap.getZoom(),14));
 }
}
function initPlacePickerMap(){
 const container=document.getElementById("place-location-map");
 if(!container||!window.L)return;
 if(placePickerMap){setTimeout(()=>placePickerMap?.invalidateSize(),80);return}
 placePickerMap=L.map(container,{zoomControl:true,scrollWheelZoom:true}).setView(map?.getCenter()||[56.5,47.5],map?.getZoom()||6);
 placePickerMap.attributionControl.setPrefix(false);
 const conf=tileLayers[activeLayer]||tileLayers.standard;
 L.tileLayer(conf.url,{attribution:conf.attr,maxZoom:activeLayer==="terrain"?17:19,crossOrigin:true}).addTo(placePickerMap);
 const clickContainer=placePickerMap.getContainer();
 placePickerClickHandler=event=>{
  if(event.target?.closest?.(".leaflet-control,.leaflet-marker-icon,.leaflet-interactive"))return;
  const point=placePickerMap?.mouseEventToLatLng(event);
  if(point)selectPlaceLocation(point.lat,point.lng,"Точка на карте");
 };
 clickContainer.addEventListener("click",placePickerClickHandler);
 if(selectedPlaceLocation)selectPlaceLocation(selectedPlaceLocation.lat,selectedPlaceLocation.lng,selectedPlaceLocation.label);
 setTimeout(()=>placePickerMap?.invalidateSize(),100);
}
function photonLabel(properties){
 return [properties.name,properties.street,properties.housenumber,properties.city||properties.locality,properties.district,properties.state,properties.country].filter(Boolean).filter((value,index,array)=>array.indexOf(value)===index).join(", ");
}
function nominatimLabel(item){
 const a=item.address||{};
 return [item.name,a.amenity,a.tourism,a.village,a.town,a.city,a.municipality,a.county,a.state,a.country].filter(Boolean).filter((value,index,array)=>array.indexOf(value)===index).join(", ")||item.display_name||"Найденное место";
}
async function fetchPlaceGeocoding(query){
 const normalizedQuery=String(query||"").toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/\s+/g," ").trim();
 const searchQuery=["у илем","уилем"].includes(normalizedQuery)?"Уилем, Моркинский район, Республика Марий Эл":query;
 const photonUrl="https://photon.komoot.io/api/?q="+encodeURIComponent(searchQuery)+"&limit=6&lang=ru";
 let photonError=null;
 try{
  const response=await fetch(photonUrl,{headers:{Accept:"application/geo+json"}});
  if(!response.ok)throw new Error("Photon HTTP "+response.status);
  const data=await response.json();
  if(Array.isArray(data.features)&&data.features.length)return data.features.map(feature=>({coords:feature?.geometry?.coordinates,label:photonLabel(feature?.properties||{})})).filter(item=>Array.isArray(item.coords)&&item.coords.length>=2&&item.label);
 }catch(error){photonError=error}
 const nominatimUrl="https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q="+encodeURIComponent(searchQuery);
 try{
  const response=await fetch(nominatimUrl,{headers:{Accept:"application/json","Accept-Language":"ru"}});
  if(!response.ok)throw new Error("Nominatim HTTP "+response.status);
  const data=await response.json();
  return Array.isArray(data)?data.map(item=>({coords:[Number(item.lon),Number(item.lat)],label:nominatimLabel(item)})).filter(item=>item.coords.every(Number.isFinite)&&item.label):[];
 }catch(error){throw new Error("Не удалось подключиться к сервисам поиска. Можно выбрать точку вручную на карте или через GPS. "+(photonError?"Оба сервиса недоступны.":""))}
}
async function searchPlaceLocation(){
 const input=document.getElementById("place-location-query"),host=document.getElementById("place-location-results"),button=document.getElementById("place-location-search");
 if(!input||!host||!button){
  console.error("[Югорно] Геопоиск вызван без открытой формы добавления места");
  showToast("Форма поиска не открыта. Закрой и снова нажми «Добавить место».");
  return;
 }
 const query=input.value.trim();
 if(!query){showToast("Введи название места или адрес");input.focus();return}
 button.disabled=true;host.replaceChildren();
 const loading=document.createElement("div");loading.className="map-muted";loading.textContent="Ищем место…";host.append(loading);
 try{
  const cacheKey=query.toLocaleLowerCase("ru");
  let results=geocoderCache.get(cacheKey);
  if(!results){
   const wait=Math.max(0,1100-(Date.now()-geocoderLastRequest));
   if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
   geocoderLastRequest=Date.now();
   results=await fetchPlaceGeocoding(query);
   geocoderCache.set(cacheKey,results);
  }
  host.replaceChildren();
  if(!results.length){const empty=document.createElement("div");empty.className="map-muted";empty.textContent="Ничего не найдено. Попробуй другое название или укажи точку на карте.";host.append(empty);return}
  results.forEach(result=>{
   const [lng,lat]=result.coords,label=result.label;
   const item=document.createElement("button");item.type="button";item.className="map-place map-location-result";item.textContent=label;
   item.addEventListener("click",()=>{selectPlaceLocation(lat,lng,label);host.replaceChildren();if(input)input.value=label});
   host.append(item);
  });
 }catch(error){host.replaceChildren();const message=document.createElement("div");message.className="map-muted";message.textContent=error.message||"Ошибка поиска";host.append(message)}
 finally{button.disabled=false}
}
function useDeviceLocation(){
 if(!navigator.geolocation){showToast("Геолокация не поддерживается этим браузером");return}
 const button=document.getElementById("place-location-gps");button.disabled=true;
 navigator.geolocation.getCurrentPosition(position=>{
  try{selectPlaceLocation(position.coords.latitude,position.coords.longitude,"Моё местоположение");if(position.coords.accuracy>100)showToast("Точность GPS около "+Math.round(position.coords.accuracy)+" м. При необходимости уточни точку на карте")}
  catch(error){showToast(error.message)}
  finally{button.disabled=false}
 },error=>{button.disabled=false;showToast(error.code===1?"Разреши доступ к местоположению в браузере":error.code===2?"Не удалось определить местоположение":"Истекло время ожидания GPS")},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
}
function formMarkup(){return '<form class="map-form" id="new-place-form"><label>Название места<input name="title" maxlength="120" required placeholder="Например, озеро или смотровая площадка"></label><label>Категория<select name="category">'+categories.map(c=>'<option>'+safe(c)+'</option>').join("")+'</select></label><div class="wide"><strong>Где находится место?</strong><div class="map-muted">Найди его по названию или адресу, отметь точку на карте либо используй GPS.</div></div><div class="wide map-muted">Поиск через Photon с резервным OpenStreetMap Nominatim. Данные OpenStreetMap: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>.</div><div class="wide map-toolbar"><input id="place-location-query" type="search" placeholder="Название места, деревни или адрес" aria-label="Поиск места или адреса"><button class="btn outline" type="button" id="place-location-search">Найти</button><button class="btn outline" type="button" id="place-location-gps">Моё местоположение</button></div><div class="wide" id="place-location-results" aria-live="polite"></div><div class="wide" id="place-location-map" role="application" aria-label="Выбор точки на карте" style="height:260px;border:1px solid var(--line);border-radius:12px;overflow:hidden"></div><div class="wide map-track-note" id="place-location-status" aria-live="polite">Точка ещё не выбрана. Нажми на карту или выбери результат поиска.</div><input type="hidden" name="lat"><input type="hidden" name="lng"><label>Регион<input name="region" maxlength="120" placeholder="Республика Марий Эл"></label><label>Точность координат<select name="coordinateAccuracy"><option value="exact">Точные</option><option value="approximate">Приблизительные</option></select></label><label class="wide">Описание<textarea name="description" maxlength="3000" placeholder="Что здесь интересного?"></textarea></label><label class="wide">Фотографии места (до 8 файлов, JPEG, PNG или WebP, каждый до 5 МБ)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><div class="wide map-track-note" id="new-place-photo-gps">GPS из фотографии проверяется только на этом устройстве. Координаты будут предложены отдельно.</div><button class="btn outline wide" type="button" id="new-place-use-gps" hidden>Выбрать точку из фотографии</button><div class="wide map-muted">Публикация появится на общей карте после проверки. Для уязвимых природных объектов выбирай приблизительные координаты. EXIF будет удалён до загрузки фотографии.</div><button class="btn" type="submit">Отправить на проверку</button><button class="btn outline" type="button" id="map-form-cancel">Отмена</button></form>'}
function bindAdd(){
 document.getElementById("map-add-btn").addEventListener("click",()=>{
  if(!window.Telegram?.WebApp?.initData&&!window.yugornoLocalDemo){showToast("Добавление мест доступно после входа в Telegram");return}
  const host=document.getElementById("map-form-host");destroyPlacePicker();host.innerHTML=formMarkup();
  const form=document.getElementById("new-place-form"),photoInput=form.querySelector('input[name="photo"]'),gpsStatus=document.getElementById("new-place-photo-gps"),useGps=document.getElementById("new-place-use-gps");
  const locationSearch=document.getElementById("place-location-search"),locationQuery=document.getElementById("place-location-query");
  locationSearch.onclick=event=>{event.preventDefault();searchPlaceLocation()};
  locationQuery.onkeydown=event=>{if(event.key==="Enter"){event.preventDefault();searchPlaceLocation()}};
  let photoGps=null;
  document.getElementById("map-form-cancel").onclick=()=>{destroyPlacePicker();host.replaceChildren()};
  document.getElementById("place-location-gps").onclick=useDeviceLocation;
  initPlacePickerMap();
  photoInput.onchange=async()=>{
   photoGps=null;useGps.hidden=true;const files=[...(photoInput.files||[])];
   if(!files.length){gpsStatus.textContent="Фотографии не выбраны.";return}
   if(files.length>8){photoInput.value="";gpsStatus.textContent="Можно приложить не более 8 фотографий.";showToast("Можно приложить не более 8 фотографий");return}
   gpsStatus.textContent="Проверяем GPS-метаданные фотографий на устройстве…";
   for(const file of files){photoGps=await window.YugornoExifGps?.readPhotoGps(file)||null;if(photoGps)break}
   if(photoGps){gpsStatus.textContent="В одной из фотографий найдены GPS-координаты. Их можно использовать как точку места.";useGps.hidden=false}
   else if(selectedPlaceLocation){gpsStatus.textContent="В фотографиях нет GPS. Будет использована уже выбранная точка места."}
   else{
    gpsStatus.textContent="В фотографиях не найдены GPS-координаты. Нужно указать, где находится место: поиском, на карте или через GPS устройства.";
    if(await askUserConfirmation("В выбранных фотографиях не найдены GPS-координаты. Хотите указать местоположение места сейчас?")){
     document.getElementById("place-location-query")?.focus();
     document.getElementById("place-location-map")?.scrollIntoView({behavior:"smooth",block:"center"});
    }
   }
  };
  useGps.onclick=()=>{if(!photoGps)return;try{selectPlaceLocation(photoGps.lat,photoGps.lng,"GPS из фотографии");form.elements.coordinateAccuracy.value="exact";gpsStatus.textContent="Точка из фотографии выбрана. Проверь её на карте."}catch(error){showToast(error.message)}};
  form.onsubmit=async event=>{
   event.preventDefault();const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
   const f=new FormData(form),photoFiles=f.getAll("photo").filter(file=>file&&file.size);
   try{
    if(photoFiles.length>8)throw new Error("Можно приложить не более 8 фотографий");
    if(!selectedPlaceLocation)throw new Error("Сначала укажи, где находится место: выбери результат поиска, точку на карте или GPS устройства");
    const payload={title:f.get("title"),category:f.get("category"),lat:Number(f.get("lat")),lng:Number(f.get("lng")),region:f.get("region"),coordinateAccuracy:f.get("coordinateAccuracy"),description:f.get("description")};
    if(photoFiles.length&&photoGps){const distance=distanceMeters(payload.lat,payload.lng,photoGps.lat,photoGps.lng);if(distance>250&&!(await askUserConfirmation("GPS одной из фотографий отличается от выбранной точки примерно на "+Math.round(distance)+" м. Продолжить?")))return}
    payload.photoUrls=[];
    for(const file of photoFiles)payload.photoUrls.push(await uploadImage(file));
    await api("/api/places",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    showToast(photoFiles.length?"Место и "+photoFiles.length+" фото отправлены одной заявкой на модерацию":"Место отправлено на модерацию");
    destroyPlacePicker();host.replaceChildren();loadMyPlaces();
   }catch(error){showToast(error.message)}
   finally{submit.disabled=false}
  };
 });
}
async function loadMyPlaces(){try{const data=await api("/api/my/places");const pending=data.items.filter(p=>p.status!=="published");if(pending.length){document.getElementById("map-side-title").textContent="Мои места · на проверке";document.getElementById("map-side-content").insertAdjacentHTML("afterbegin",pending.map(p=>'<div class="map-place"><strong>'+safe(p.title)+'</strong><div class="map-muted">Статус: '+safe(p.status)+'</div></div>').join(""))}}catch{}}
async function openPlace(id){
 try{
  const data=await api("/api/places/"+encodeURIComponent(id)),p=data.item;currentPlace=p;
  const impressions=data.impressions||[];
  const placePhotoHtml=(p.photoUrls||[]).map(url=>'<a href="'+safe(url)+'" target="_blank" rel="noopener"><img class="map-impression-photo" src="'+safe(url)+'" alt="Фотография места" loading="lazy"></a>').join("");
  const impressionHtml=impressions.map(i=>'<div class="map-place">'+(i.text?'<p>'+safe(i.text)+'</p>':'')+(i.photoUrls||[]).map(url=>'<a href="'+safe(url)+'" target="_blank" rel="noopener"><img class="map-impression-photo" src="'+safe(url)+'" alt="Фотография впечатления" loading="lazy"></a>').join("")+'</div>').join("");
  const actions='<button type="button" class="btn outline" id="save-place">Сохранить</button><button type="button" class="btn outline" id="copy-coords">Координаты</button><button type="button" class="btn outline" id="open-nav">Навигатор</button>';
  document.getElementById("map-side-title").textContent=p.title;
  document.getElementById("map-side-content").innerHTML='<div class="map-chip">'+iconFor(p.category)+' '+safe(p.category)+'</div><p>'+safe(p.description||"Описание пока не добавлено")+'</p><div class="map-muted">'+safe(p.region||"")+' · '+safe(p.author||"Автор")+'</div><div class="map-toolbar">'+actions+'</div><h4>Фотографии места</h4>'+(placePhotoHtml?'<div class="map-moderation-gallery">'+placePhotoHtml+'</div>':'<div class="map-muted">Фотографии места не добавлены</div>')+'<h4>Впечатления</h4>'+(impressionHtml||'<div class="map-muted">Пока нет опубликованных впечатлений</div>');
  document.getElementById("save-place").onclick=async()=>{try{await api("/api/my/places/"+encodeURIComponent(id)+"/save",{method:"POST"});showToast("Место сохранено")}catch(e){showToast(e.message)}};
  document.getElementById("copy-coords").onclick=()=>navigator.clipboard?.writeText(p.lat+", "+p.lng).then(()=>showToast("Координаты скопированы"));
  document.getElementById("open-nav").onclick=()=>window.open("https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(p.lat+","+p.lng),"_blank","noopener");
  const form=document.createElement("form");form.className="map-form";
  form.innerHTML='<label class="wide">Добавить впечатление<textarea name="text" maxlength="3000" placeholder="Совет, наблюдение или история"></textarea></label><label class="wide">Фотография (JPEG, PNG или WebP, до 5 МБ)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="wide map-track-note" id="impression-photo-gps">EXIF проверяется на устройстве; перед загрузкой GPS-метаданные удаляются.</div><button class="btn" type="submit">Отправить на проверку</button>';
  form.onsubmit=async e=>{
   e.preventDefault();const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
   try{
    const f=new FormData(form),textValue=String(f.get("text")||"").trim(),photo=f.get("photo");
    if(!textValue&&!photo?.size)throw new Error("Добавьте текст или фотографию");
    let photoUrl=null;if(photo?.size){const gps=await window.YugornoExifGps?.readPhotoGps(photo)||null;if(gps){if(currentPlace.coordinateAccuracy==="approximate"){document.getElementById("impression-photo-gps").textContent="В фотографии есть GPS. У места указаны приблизительные координаты, поэтому точное расстояние не проверяется. Координаты места не изменятся."}else{const distance=distanceMeters(currentPlace.lat,currentPlace.lng,gps.lat,gps.lng);document.getElementById("impression-photo-gps").textContent="GPS фотографии: "+gps.lat.toFixed(6)+", "+gps.lng.toFixed(6)+". Расстояние до места: "+Math.round(distance)+" м.";if(distance>250&&!(await askUserConfirmation("GPS фотографии находится примерно в "+Math.round(distance)+" м от выбранного места. Всё равно прикрепить фото к этому месту?")))return}}photoUrl=await uploadImage(photo)}
    await api("/api/places/"+encodeURIComponent(id)+"/impressions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text:textValue,photoUrls:photoUrl?[photoUrl]:[]})});
    form.reset();showToast("Впечатление отправлено на проверку")
   }catch(err){showToast(err.message)}finally{submit.disabled=false}
  };
  document.getElementById("map-side-content").append(form)
 }catch(e){showToast("Не удалось открыть место: "+e.message)}
}
async function uploadImage(file){
 if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error("Поддерживаются JPEG, PNG и WebP");
 if(file.size>5*1024*1024)throw new Error("Файл больше 5 МБ");
 if(typeof createImageBitmap!=="function")throw new Error("Браузер не поддерживает безопасную обработку изображения");
 const bitmap=await createImageBitmap(file);
 if(bitmap.width*bitmap.height>25000000){bitmap.close?.();throw new Error("Слишком большое разрешение изображения. Уменьшите фото перед загрузкой");}
 const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
 const dataUrl=canvas.toDataURL("image/jpeg",0.82);
 const result=await api("/api/uploads/image",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({dataUrl,private:true})});
 return result.imageUrl;
}
function distanceMeters(lat1,lng1,lat2,lng2){const rad=value=>value*Math.PI/180,dLat=rad(lat2-lat1),dLng=rad(lng2-lng1),h=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLng/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))}
async function parseGPX(file){
 if(file.size>10*1024*1024)throw new Error("GPX-файл больше 10 МБ");
 const xml=await file.text(),doc=new DOMParser().parseFromString(xml,"application/xml");
 if(doc.querySelector("parsererror")||doc.documentElement.localName!=="gpx")throw new Error("Файл не является корректным GPX");
 const nodes=[...doc.getElementsByTagName("*")].filter(node=>node.localName==="trkpt"||node.localName==="rtept");
 const points=nodes.map(node=>({lat:Number(node.getAttribute("lat")),lng:Number(node.getAttribute("lon"))}));
 if(points.length<2)throw new Error("В GPX не найден трек минимум из двух точек");
 if(points.length>5000)throw new Error("В GPX больше 5000 точек. Упростите трек перед загрузкой");
 if(points.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||p.lat< -90||p.lat>90||p.lng< -180||p.lng>180))throw new Error("В GPX обнаружены некорректные координаты");
 return points;
}
function downloadGPX(route){
 const hasTrack=Array.isArray(route.trackPoints)&&route.trackPoints.length>=2;
 const points=hasTrack?route.trackPoints:(route.stops||[]).map(p=>({lat:p.lat,lng:p.lng})).filter(p=>Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng)));
 if(points.length<2){showToast("Для экспорта недостаточно координат");return}
 const esc=value=>String(value||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
 const pointXml=points.map(p=>'<'+(hasTrack?'trkpt':'rtept')+' lat="'+Number(p.lat)+'" lon="'+Number(p.lng)+'"></'+(hasTrack?'trkpt':'rtept')+'>').join("");
 const segment=hasTrack?'<trk><name>'+esc(route.title)+'</name><trkseg>'+pointXml+'</trkseg></trk>':'<rte><name>'+esc(route.title)+'</name>'+pointXml+'</rte>';
 const xml='<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Yugorno" xmlns="http://www.topografix.com/GPX/1/1">'+segment+'</gpx>';
 const url=URL.createObjectURL(new Blob([xml],{type:"application/gpx+xml"})),a=document.createElement("a");a.href=url;a.download=(route.title||"yugorno-route").replace(/[^\p{L}\p{N}-]+/gu,"-")+".gpx";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function renderRouteOnMap(route){
 if(activeMode!=="map")setMode("map");
 setTimeout(()=>{
  if(!map)return;
  if(routeLine)map.removeLayer(routeLine);
  if(Array.isArray(route.trackPoints)&&route.trackPoints.length>=2){
   const latlngs=route.trackPoints.filter(p=>Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))).map(p=>[Number(p.lat),Number(p.lng)]);
   if(latlngs.length>=2){
    routeLine=L.polyline(latlngs,{color:"#d16a36",weight:5,opacity:.85}).addTo(map);
    map.fitBounds(routeLine.getBounds(),{padding:[24,24]});
    showToast("На карте показан GPS-трек: "+route.title);return;
   }
  }
  const stops=(route.stops||[]).filter(p=>Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))).map(p=>[Number(p.lat),Number(p.lng)]);
  if(stops.length)map.fitBounds(L.latLngBounds(stops),{padding:[24,24]});
  showToast("У маршрута нет GPS-трека. Показаны остановки без соединительной линии.");
 },120);
}
async function checkModerator(){
 try{
  await api("/api/moderation/places");
  const button=document.createElement("button");button.type="button";button.textContent="Модерация";
  button.onclick=loadModeration;document.getElementById("map-add-btn").after(button);
 }catch{}
}
async function loadModeration(){
 try{
  const [p,i,r]=await Promise.all([api("/api/moderation/places"),api("/api/moderation/impressions"),api("/api/moderation/routes")]);
  const pendingPlaces=p.items||[],pendingImpressions=i.items||[],pendingRoutes=r.items||[];
  const placeById=new Map(pendingPlaces.map(place=>[place.id,place]));
  const parentDetails=new Map();
  await Promise.all([...new Set(pendingImpressions.map(item=>item.placeId).filter(Boolean))].filter(id=>!placeById.has(id)).map(async id=>{try{const data=await api("/api/places/"+encodeURIComponent(id));if(data.item)parentDetails.set(id,data.item)}catch{}}));
  const host=document.getElementById("map-side-content");
  host.querySelectorAll('img[data-private-image]').forEach(img=>{if(img.dataset.objectUrl)URL.revokeObjectURL(img.dataset.objectUrl)});
  const imageMarkup=(urls)=>{const unique=[...new Set((urls||[]).filter(Boolean))];return unique.length?'<div class="map-moderation-gallery">'+unique.map(url=>'<a href="'+safe(url)+'" target="_blank" rel="noopener"><img data-private-image="'+safe(url)+'" alt="Фотография на модерации" loading="lazy"></a>').join("")+'</div>':'<div class="map-moderation-note">Фотографии не приложены.</div>'};
  const actionMarkup=(kind,id)=>'<div class="map-moderation-actions"><button type="button" data-mod-kind="'+kind+'" data-mod-id="'+safe(id)+'" data-mod-status="published">Опубликовать</button><button type="button" data-mod-kind="'+kind+'" data-mod-id="'+safe(id)+'" data-mod-status="rejected">Отклонить</button></div>';
  const placeCards=pendingPlaces.map(place=>{
   const attached=place.pendingImpressions||[];
   const photos=[...(place.photoUrls||[]),...attached.flatMap(item=>item.photoUrls||[])];
   const extras=attached.map(item=>'<div class="map-moderation-item"><h5>Дополнение к заявке на место</h5>'+(item.text?'<p class="map-moderation-description">'+safe(item.text)+'</p>':'<div class="map-moderation-note">Фотография включена в общую заявку на место.</div>')+'</div>').join("");
   const lat=Number(place.lat),lng=Number(place.lng);
   const hasCoordinates=place.lat!==null&&place.lat!==undefined&&place.lat!==""&&place.lng!==null&&place.lng!==undefined&&place.lng!==""&&Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;
   const coords=hasCoordinates?'<a href="https://www.openstreetmap.org/?mlat='+encodeURIComponent(lat)+'&mlon='+encodeURIComponent(lng)+'#map=16/'+encodeURIComponent(lat)+'/'+encodeURIComponent(lng)+'" target="_blank" rel="noopener">Открыть точку на карте ↗</a>':"";
   const mapPreview=hasCoordinates?(()=>{const padLat=0.004,padLng=Math.max(0.004,0.008/Math.max(0.2,Math.cos(lat*Math.PI/180)));const bbox=[lng-padLng,lat-padLat,lng+padLng,lat+padLat].map(value=>value.toFixed(6)).join(",");const src="https://www.openstreetmap.org/export/embed.html?bbox="+bbox+"&layer=mapnik&marker="+lat.toFixed(6)+","+lng.toFixed(6);return '<div class="map-moderation-map"><div class="map-moderation-map-title">Точка на карте</div><iframe src="'+safe(src)+'" title="Расположение места на карте" loading="lazy" referrerpolicy="no-referrer"></iframe></div>'})():'<div class="map-moderation-note">Координаты места не указаны. Проверить расположение пока нельзя.</div>';
   return '<article class="map-moderation"><div class="map-moderation-head"><span class="map-moderation-kind">Место · ожидает решения</span><span class="map-muted">'+safe(place.author||"Автор не указан")+'</span></div><strong class="map-moderation-title">'+safe(place.title||"Без названия")+'</strong><div class="map-moderation-meta">'+(place.category?'<span>'+safe(place.category)+'</span>':'')+(place.region?'<span>'+safe(place.region)+'</span>':'')+'</div><p class="map-moderation-description">'+safe(place.description||"Автор не добавил описание.")+'</p>'+mapPreview+imageMarkup(photos)+'<div class="map-moderation-meta">'+(coords?'<span>'+coords+'</span>':'')+'<span>Фотографий: '+photos.length+'</span></div>'+actionMarkup("places",place.id)+(extras?'<h4>Дополнения к заявке</h4>'+extras:'')+'</article>';
  });
  const looseImpressions=pendingImpressions.filter(item=>!placeById.has(item.placeId)).map(item=>{
   const parent=parentDetails.get(item.placeId),parentTitle=parent?.title||"Место из каталога";
   return '<article class="map-moderation"><div class="map-moderation-head"><span class="map-moderation-kind">Впечатление · ожидает решения</span><span class="map-muted">'+safe(item.author||"Автор не указан")+'</span></div><strong class="map-moderation-title">'+safe(parentTitle)+'</strong><p class="map-moderation-description">'+safe(item.text||"Автор добавил фотографию без текста.")+'</p>'+imageMarkup(item.photoUrls)+'<div class="map-moderation-meta">'+(parent?.region?'<span>'+safe(parent.region)+'</span>':'')+'</div>'+actionMarkup("impressions",item.id)+'</article>';
  });
  const routeCards=pendingRoutes.map(item=>'<article class="map-moderation"><div class="map-moderation-head"><span class="map-moderation-kind">Маршрут · ожидает решения</span></div><strong class="map-moderation-title">'+safe(item.title||"Без названия")+'</strong><p class="map-moderation-description">'+safe(item.description||"Автор не добавил описание.")+'</p>'+(item.stops?.length?'<div class="map-moderation-note">Остановки: '+safe(item.stops.map(stop=>stop.title).join(" → "))+'</div>':'')+actionMarkup("routes",item.id)+'</article>');
  const cards=[...placeCards,...looseImpressions,...routeCards];
  document.getElementById("map-side-title").textContent="Очередь модерации · "+cards.length;
  host.innerHTML=cards.length?cards.join(""):'<div class="map-empty">Очередь пуста. Новых материалов на проверке нет.</div>';
  for(const img of host.querySelectorAll("img[data-private-image]")){
   try{const headers={};if(window.Telegram?.WebApp?.initData)headers["X-Telegram-Init-Data"]=window.Telegram.WebApp.initData;else if(window.yugornoLocalDemo)headers["X-Local-Demo-User"]="local-tester";const response=await fetch(img.dataset.privateImage,{headers});if(response.ok){const objectUrl=URL.createObjectURL(await response.blob());img.src=objectUrl;img.dataset.objectUrl=objectUrl}else{img.closest("a")?.insertAdjacentHTML("afterend",'<span class="map-muted">Фото недоступно для просмотра</span>');img.closest("a")?.remove()}}catch{img.closest("a")?.insertAdjacentHTML("afterend",'<span class="map-muted">Не удалось загрузить фото</span>');img.closest("a")?.remove()}
  }
  host.querySelectorAll("[data-mod-status]").forEach(button=>button.onclick=async()=>{
   button.disabled=true;
   try{await api("/api/moderation/"+button.dataset.modKind+"/"+encodeURIComponent(button.dataset.modId),{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status:button.dataset.modStatus})});showToast(button.dataset.modStatus==="published"?"Материал опубликован":"Материал отклонён");loadModeration()}
   catch(error){button.disabled=false;showToast(error.message)}
  });
 }catch(error){showToast("Не удалось открыть очередь модерации: "+error.message)}
}
function bindControls(){const saved=document.createElement("button");saved.type="button";saved.textContent="Сохранённое";saved.onclick=async()=>{try{const data=await api("/api/my/saved-places");document.getElementById("map-side-title").textContent="Сохранённые места";document.getElementById("map-side-content").innerHTML=data.items.length?data.items.map(p=>'<div class="map-place"><button type="button" data-place="'+safe(p.id)+'">'+safe(p.title)+'</button><div class="map-muted">'+safe(p.category)+'</div></div>').join(""):'<div class="map-empty">Пока ничего не сохранено</div>';document.getElementById("map-side-content").querySelectorAll("[data-place]").forEach(b=>b.onclick=()=>openPlace(b.dataset.place))}catch(e){showToast(e.message)}};document.getElementById("map-add-btn").after(saved);document.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));document.querySelectorAll("[data-layer]").forEach(b=>b.addEventListener("click",()=>setLayer(b.dataset.layer)));document.getElementById("map-search-btn").onclick=loadPlaces;document.getElementById("map-search").addEventListener("keydown",e=>{if(e.key==="Enter")loadPlaces()});document.getElementById("map-category").onchange=loadPlaces}
async function boot(){try{await ensureLeaflet();if(!window.L.markerClusterGroup){for(const [key,url] of [["mc","https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"],["mcd","https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"]]){const link=document.createElement("link");link.rel="stylesheet";link.href=url;link.dataset[key]="1";document.head.append(link)}await loadScript("https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js")}initMap();bindControls();bindAdd();checkModerator();setLayer("standard");await loadPlaces();document.querySelector('[data-mode="map"]').classList.add("active");document.querySelectorAll('.nav button[data-view="map"]').forEach(b=>b.addEventListener("click",()=>setTimeout(()=>{map?.invalidateSize();loadPlaces()},100)));}catch(e){document.getElementById("yugorno-map").innerHTML='<div class="map-empty">Не удалось загрузить карту. Проверь подключение к интернету.</div>';console.error(e)}}
boot();
})();