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
.map-moderation{border:1px solid var(--line);border-radius:12px;padding:12px;margin:10px 0;background:var(--paper)}
.map-moderation-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.map-moderation img,.map-impression-photo{max-width:100%;max-height:220px;border-radius:10px;object-fit:cover}
.map-track-note{font-size:12px;color:var(--muted);grid-column:1/-1}
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
const tileLayers={
 standard:{url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png",attr:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'},
 satellite:{url:"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",attr:'Tiles © <a href="https://www.esri.com/">Esri</a>'},
 terrain:{url:"https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",attr:'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, style © <a href="https://opentopomap.org/">OpenTopoMap</a>'}
};
function api(path,options={}){const initData=window.Telegram?.WebApp?.initData;const headers={...(options.headers||{})};if(initData)headers["X-Telegram-Init-Data"]=initData;else if(window.yugornoLocalDemo)headers["X-Local-Demo-User"]="local-tester";return fetch(path,{...options,headers}).then(async r=>{const data=await r.json();if(!r.ok||!data.ok){const matches=data.matches?.map(item=>item.title).filter(Boolean).join(", ");throw new Error((data.error||"Ошибка запроса")+(matches?" Возможные совпадения: "+matches:""))}return data})}
function safe(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function showToast(message){if(typeof window.toast==="function")window.toast(message);else console.info(message)}
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error("Не удалось загрузить библиотеку карты"));document.head.append(s)})}
async function ensureLeaflet(){if(window.L)return;if(!document.querySelector('link[data-leaflet]')){const l=document.createElement("link");l.rel="stylesheet";l.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";l.dataset.leaflet="1";document.head.append(l)}await loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");}
function initMap(){if(map||!window.L)return;map=L.map("yugorno-map",{zoomControl:true,preferCanvas:true}).setView([56.5,47.5],5);map.attributionControl.setPrefix(false);map.addLayer(L.tileLayer(tileLayers.standard.url,{attribution:tileLayers.standard.attr,maxZoom:19,crossOrigin:true}));markers=L.markerClusterGroup({showCoverageOnHover:false,spiderfyOnMaxZoom:true,maxClusterRadius:48}).addTo(map);map.on("moveend",()=>{if(activeMode==="map")loadPlaces()});}
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
  host.innerHTML='<form class="map-form" id="new-route-form"><label class="wide">Название маршрута<input name="title" maxlength="120" required></label><label>Передвижение<select name="transport"><option value="mixed">Смешанное</option><option value="walking">Пешком</option><option value="cycling">Велосипед</option><option value="driving">Автомобиль</option><option value="water">Вода</option></select></label><label class="wide">Описание<textarea name="description" maxlength="3000"></textarea></label><label class="wide">GPS-трек GPX (необязательно)<input name="gpx" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml"></label><div class="map-track-note" id="gpx-status">Можно добавить GPS-трек. Без него маршрут будет состоять из списка остановок.</div><div class="wide map-muted">Отметь остановки в нужном порядке. Загруженный GPX-трек сохранит реальную геометрию маршрута.</div>'+places.map(p=>'<label><span><input type="checkbox" name="stopIds" value="'+safe(p.id)+'"> '+safe(p.title)+'</span></label>').join("")+'<button class="btn" type="submit">Отправить на проверку</button><button class="btn outline" type="button" id="route-cancel">Отмена</button></form>';
  let trackPoints=[];
  document.getElementById("route-cancel").onclick=()=>host.replaceChildren();
  document.querySelector('#new-route-form input[name="gpx"]').onchange=async e=>{
   const file=e.target.files?.[0];if(!file){trackPoints=[];return}
   try{trackPoints=await parseGPX(file);document.getElementById("gpx-status").textContent='GPX загружен: '+trackPoints.length+' точек'}
   catch(error){trackPoints=[];e.target.value="";document.getElementById("gpx-status").textContent=error.message;showToast(error.message)}
  };
  document.getElementById("new-route-form").onsubmit=async e=>{
   e.preventDefault();const f=new FormData(e.currentTarget);
   try{
    await api("/api/routes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title:f.get("title"),transport:f.get("transport"),description:f.get("description"),stopIds:f.getAll("stopIds"),trackPoints})});
    host.replaceChildren();showToast("Маршрут отправлен на проверку");loadRoutes()
   }catch(err){showToast(err.message)}
  };
 }catch(e){showToast(e.message)}
}
function setMode(mode){activeMode=mode;document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));document.getElementById("map-main").hidden=mode!=="map";if(mode==="map"){document.querySelector(".map-layout").style.gridTemplateColumns="minmax(0,1fr) 300px";setTimeout(()=>map?.invalidateSize(),80);loadPlaces()}else{document.querySelector(".map-layout").style.gridTemplateColumns="1fr";if(mode==="list")loadPlaces();else loadRoutes()}document.getElementById("map-side-title").textContent=mode==="routes"?"Опубликованные маршруты":mode==="list"?"Список мест":"Места на карте"}
function formMarkup(){return '<form class="map-form" id="new-place-form"><label>Название места<input name="title" maxlength="120" required placeholder="Например, озеро или смотровая площадка"></label><label>Категория<select name="category">'+categories.map(c=>'<option>'+safe(c)+'</option>').join("")+'</select></label><label>Широта<input name="lat" type="number" step="any" min="-90" max="90" required placeholder="56.1234"></label><label>Долгота<input name="lng" type="number" step="any" min="-180" max="180" required placeholder="47.1234"></label><label>Регион<input name="region" maxlength="120" placeholder="Республика Марий Эл"></label><label>Точность координат<select name="coordinateAccuracy"><option value="exact">Точные</option><option value="approximate">Приблизительные</option></select></label><label class="wide">Описание<textarea name="description" maxlength="3000" placeholder="Что здесь интересного?"></textarea></label><div class="wide map-muted">Публикация появится на общей карте после проверки. Для уязвимых природных объектов выбирай приблизительные координаты.</div><button class="btn" type="submit">Отправить на проверку</button><button class="btn outline" type="button" id="map-form-cancel">Отмена</button></form>'}
function bindAdd(){document.getElementById("map-add-btn").addEventListener("click",()=>{if(!window.Telegram?.WebApp?.initData&&!window.yugornoLocalDemo){showToast("Добавление мест доступно после входа в Telegram");return}const host=document.getElementById("map-form-host");host.innerHTML=formMarkup();document.getElementById("map-form-cancel").onclick=()=>host.replaceChildren();document.getElementById("new-place-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),payload=Object.fromEntries(f.entries());payload.lat=Number(payload.lat);payload.lng=Number(payload.lng);try{await api("/api/places",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});host.replaceChildren();showToast("Место отправлено на модерацию");loadMyPlaces()}catch(err){showToast(err.message)}}})}
async function loadMyPlaces(){try{const data=await api("/api/my/places");const pending=data.items.filter(p=>p.status!=="published");if(pending.length){document.getElementById("map-side-title").textContent="Мои места · на проверке";document.getElementById("map-side-content").insertAdjacentHTML("afterbegin",pending.map(p=>'<div class="map-place"><strong>'+safe(p.title)+'</strong><div class="map-muted">Статус: '+safe(p.status)+'</div></div>').join(""))}}catch{}}
async function openPlace(id){
 try{
  const data=await api("/api/places/"+encodeURIComponent(id)),p=data.item;currentPlace=p;
  const impressions=data.impressions||[];
  const impressionHtml=impressions.map(i=>'<div class="map-place">'+(i.text?'<p>'+safe(i.text)+'</p>':'')+(i.photoUrls||[]).map(url=>'<a href="'+safe(url)+'" target="_blank" rel="noopener"><img class="map-impression-photo" src="'+safe(url)+'" alt="Фотография впечатления" loading="lazy"></a>').join("")+'</div>').join("");
  const actions='<button type="button" class="btn outline" id="save-place">Сохранить</button><button type="button" class="btn outline" id="copy-coords">Координаты</button><button type="button" class="btn outline" id="open-nav">Навигатор</button>';
  document.getElementById("map-side-title").textContent=p.title;
  document.getElementById("map-side-content").innerHTML='<div class="map-chip">'+iconFor(p.category)+' '+safe(p.category)+'</div><p>'+safe(p.description||"Описание пока не добавлено")+'</p><div class="map-muted">'+safe(p.region||"")+' · '+safe(p.author||"Автор")+'</div><div class="map-toolbar">'+actions+'</div><h4>Впечатления</h4>'+(impressionHtml||'<div class="map-muted">Пока нет опубликованных впечатлений</div>');
  document.getElementById("save-place").onclick=async()=>{try{await api("/api/my/places/"+encodeURIComponent(id)+"/save",{method:"POST"});showToast("Место сохранено")}catch(e){showToast(e.message)}};
  document.getElementById("copy-coords").onclick=()=>navigator.clipboard?.writeText(p.lat+", "+p.lng).then(()=>showToast("Координаты скопированы"));
  document.getElementById("open-nav").onclick=()=>window.open("https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(p.lat+","+p.lng),"_blank","noopener");
  const form=document.createElement("form");form.className="map-form";
  form.innerHTML='<label class="wide">Добавить впечатление<textarea name="text" maxlength="3000" placeholder="Совет, наблюдение или история"></textarea></label><label class="wide">Фотография (JPEG, PNG или WebP, до 5 МБ)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="wide map-track-note">Фотография будет уменьшена и очищена от EXIF перед загрузкой.</div><button class="btn" type="submit">Отправить на проверку</button>';
  form.onsubmit=async e=>{
   e.preventDefault();const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
   try{
    const f=new FormData(form),textValue=String(f.get("text")||"").trim(),photo=f.get("photo");
    if(!textValue&&!photo?.size)throw new Error("Добавьте текст или фотографию");
    const photoUrl=photo?.size?await uploadImage(photo):null;
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
  const entries=[...p.items.map(item=>({...item,kind:"places",kindLabel:"Место"})),...i.items.map(item=>({...item,kind:"impressions",kindLabel:"Впечатление"})),...r.items.map(item=>({...item,kind:"routes",kindLabel:"Маршрут"}))];
  document.getElementById("map-side-title").textContent="Очередь модерации";
  const host=document.getElementById("map-side-content");
  host.querySelectorAll('img[data-private-image]').forEach(img=>{if(img.dataset.objectUrl)URL.revokeObjectURL(img.dataset.objectUrl)});
  host.innerHTML=entries.length?entries.map(item=>'<div class="map-moderation"><div class="map-muted">'+item.kindLabel+'</div><strong>'+safe(item.title||item.text||"Без названия")+'</strong><p>'+safe(item.description||item.text||"")+'</p>'+(item.stops?.length?'<p>Остановки: '+safe(item.stops.map(stop=>stop.title).join(" → "))+'</p>':'')+(Number.isFinite(Number(item.lat))&&Number.isFinite(Number(item.lng))?'<p><a href="https://www.openstreetmap.org/?mlat='+encodeURIComponent(item.lat)+'&mlon='+encodeURIComponent(item.lng)+'#map=16/'+encodeURIComponent(item.lat)+'/'+encodeURIComponent(item.lng)+'" target="_blank" rel="noopener">Проверить точку на карте</a></p>':'')+(item.photoUrls||[]).map(url=>'<img data-private-image="'+safe(url)+'" alt="Фото на проверке" loading="lazy">').join("")+'<div class="map-muted">'+safe(item.region||"")+'</div><div class="map-moderation-actions"><button type="button" data-mod-kind="'+item.kind+'" data-mod-id="'+safe(item.id)+'" data-mod-status="published">Опубликовать</button><button type="button" data-mod-kind="'+item.kind+'" data-mod-id="'+safe(item.id)+'" data-mod-status="rejected">Отклонить</button></div></div>').join(""):'<div class="map-empty">Очередь пуста. Новых материалов на проверке нет.</div>';
  for(const img of host.querySelectorAll("img[data-private-image]")){
   try{const headers={};if(window.Telegram?.WebApp?.initData)headers["X-Telegram-Init-Data"]=window.Telegram.WebApp.initData;const response=await fetch(img.dataset.privateImage,{headers});if(response.ok){const objectUrl=URL.createObjectURL(await response.blob());img.src=objectUrl;img.dataset.objectUrl=objectUrl}}catch{}
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