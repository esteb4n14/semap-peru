(() => {
  const status = document.getElementById('status');
  try {
    const data = window.mapaDatos;
    const map = L.map('map', { zoomControl: true, doubleClickZoom: false, minZoom: 4, maxZoom: 14, zoomSnap: .25 });
    const colors = ['#4f46f5', '#ef3e42', '#ff741a', '#ffc516', '#20be63', '#8f25e8', '#64748b'];
    let color = colors[0], level = 'distrito', shapes, onlyColored = false;
    const selectedLevels = new Set(['departamento', 'provincia', 'distrito']);
    const selectedDepartments = new Set(), selectedProvinces = new Set();
    let scoped = data;
    let painted = {};
    try { painted = JSON.parse(localStorage.getItem('mapa-peru-colores-v1') || '{}') || {}; } catch (_) { }
    const save = () => { try { localStorage.setItem('mapa-peru-colores-v1', JSON.stringify(painted)); } catch (_) { status.textContent = 'No se pudo guardar en este navegador'; } };
    const normalize = s => (s || '').toLowerCase().replace(/(^|\s)\S/g, x => x.toUpperCase());
    const label = p => [p.nombre, p.nombre_provincia, p.nombre_departamento].filter(Boolean).map(normalize).join(' · ');
    const districtStyle = f => ({ color: '#000000', weight: .8, opacity: selectedLevels.has('distrito') && (!onlyColored || painted[f.properties.ubigeo]) ? .9 : 0, fillColor: painted[f.properties.ubigeo] || '#ffffff', fillOpacity: 1 });
    // Una base blanca continua cubre las pequeñas transparencias entre distritos.
    // Se dibuja detrás de los rellenos y límites sin intervenir en la selección.
    map.createPane('baseTerritorial');
    map.getPane('baseTerritorial').style.zIndex = 390;
    map.getPane('baseTerritorial').style.pointerEvents = 'none';
    const baseRenderer = L.canvas({ pane: 'baseTerritorial', padding: .2 });
    const baseTerritorial = L.geoJSON(data.distrito, { pane: 'baseTerritorial', renderer: baseRenderer, interactive: false, style: { color: '#ffffff', weight: 2, opacity: 1, fillColor: '#ffffff', fillOpacity: 1 } }).addTo(map);
    // Las capas cartográficas se dibujan en lienzos compartidos; la capa de
    // interacción sigue usando SVG para conservar la selección precisa.
    const districtRenderer = L.canvas({ padding: .2 });
    const districts = L.geoJSON(data.distrito, { renderer: districtRenderer, style: districtStyle, interactive: false }).addTo(map);
    // Las líneas superiores no capturan clics: solo refuerzan la jerarquía territorial.
    map.createPane('limites');
    map.getPane('limites').style.zIndex = 410;
    map.getPane('limites').style.pointerEvents = 'none';
    const boundaryRenderer = L.canvas({ pane: 'limites', padding: .2 });
    const provinces = L.geoJSON(data.provincia, { renderer: boundaryRenderer, pane: 'limites', interactive: false, style: { color: '#10A46B', weight: 1.35, opacity: .95, fill: false } }).addTo(map);
    const departments = L.geoJSON(data.departamento, { renderer: boundaryRenderer, pane: 'limites', interactive: false, style: { color: '#1769D2', weight: 2.2, opacity: 1, fill: false } }).addTo(map);
    // Recortar las líneas provinciales y departamentales al área coloreada,
    // sin modificar las geometrías ni la capa que recibe los clics.
    const drawBoundaries = boundaryRenderer._draw;
    boundaryRenderer._draw = function () {
      if (!onlyColored) return drawBoundaries.call(this);
      const ctx = this._ctx;
      ctx.save(); ctx.beginPath();
      districts.eachLayer(layer => {
        if (!painted[layer.feature.properties.ubigeo]) return;
        for (const ring of layer._parts || []) {
          ring.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
          ctx.closePath();
        }
      });
      ctx.clip('evenodd');
      try { drawBoundaries.call(this); } finally { ctx.restore(); }
    };
    function refreshColoredVisibility() {
      districts.setStyle(districtStyle);
      boundaryRenderer._redrawBounds = null;
      boundaryRenderer._redraw();
      scheduleNames();
    }
    map.createPane('nombres');
    map.getPane('nombres').style.zIndex = 450;
    map.getPane('nombres').style.pointerEvents = 'none';
    const names = L.layerGroup().addTo(map);
    // El centro de cada polígono no cambia al navegar; calcularlo una sola vez
    // evita recorrer repetidamente todos sus vértices al mover el mapa.
    const nameCenters = new WeakMap();
    let pendingNames;
    function updateNames() {
      names.clearLayers();
      if (!shapes) return;
      const zoom = map.getZoom();
      const nameLevel = level === 'departamento' || zoom < 7 ? 'departamento' : level === 'provincia' || zoom < 9 ? 'provincia' : 'distrito';
      const source = { departamento: departments, provincia: provinces, distrito: districts }[nameLevel];
      const occupied = [];
      const bounds = map.getBounds();
      const coloredIds = onlyColored ? Object.keys(painted) : [];
      source.eachLayer(layer => {
        if (onlyColored && !coloredIds.some(id => id.startsWith(layer.feature.properties.ubigeo))) return;
        if (!bounds.intersects(layer.getBounds())) return;
        let center = nameCenters.get(layer);
        if (!center) {
          center = layer.getCenter();
          nameCenters.set(layer, center);
        }
        if (!bounds.contains(center)) return;
        const name = normalize(layer.feature.properties.nombre);
        const point = map.latLngToContainerPoint(center);
        const width = Math.min(190, Math.max(42, name.length * ({ departamento: 8, provincia: 7.5, distrito: 7.5 }[nameLevel])));
        const box = { left: point.x - width / 2 - 4, right: point.x + width / 2 + 4, top: point.y - 9, bottom: point.y + 9 };
        if (occupied.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) return;
        occupied.push(box);
        const node = document.createElement('span');
        node.className = 'place-name ' + nameLevel;
        node.textContent = name;
        L.marker(center, { pane: 'nombres', interactive: false, keyboard: false, icon: L.divIcon({ className: 'name-marker', html: node, iconSize: [width, 20], iconAnchor: [width / 2, 10] }) }).addTo(names);
      });
    }
    function scheduleNames() {
      cancelAnimationFrame(pendingNames);
      pendingNames = requestAnimationFrame(updateNames);
    }
    function showLevel() {
      if (shapes) map.removeLayer(shapes);
      shapes = L.geoJSON(scoped[level], {
        style: { color: '#0046a1', weight: 0, opacity: 0, fillColor: '#5488bc', fillOpacity: 0 },
        onEachFeature(feature, layer) {
          layer.on('mouseover', () => { status.textContent = label(feature.properties); layer.setStyle({ color: '#0046a1', weight: 2.5, opacity: 1, fillColor: '#5488bc', fillOpacity: .22 }); });
          layer.on('mouseout', () => { status.textContent = 'Acerca el mapa y selecciona un territorio'; shapes.resetStyle(layer); });
          function applyColor(remove) {
            const id = feature.properties.ubigeo;
            districts.eachLayer(d => { const p = d.feature.properties; if ((level === 'distrito' && p.ubigeo === id) || (level === 'provincia' && p.ubigeo_provincia === id) || (level === 'departamento' && p.ubigeo_departamento === id)) { if (remove) delete painted[p.ubigeo]; else painted[p.ubigeo] = color; d.setStyle(districtStyle(d.feature)); } });
            if (onlyColored) refreshColoredVisibility();
            save(); status.textContent = label(feature.properties) + (remove ? ' · color quitado' : ' · coloreado');
          }
          layer.on('click', e => { if (!e.originalEvent || e.originalEvent.detail < 2) applyColor(color === null); });
          layer.on('dblclick', e => { L.DomEvent.stopPropagation(e); applyColor(true); });
        }
      }).addTo(map);
      scheduleNames();
    }
    map.fitBounds(departments.getBounds(), { padding: [35, 35] }); showLevel();
    // Leaflet emite moveend también después de zoomend: actualizar una vez.
    map.on('moveend', scheduleNames);
    const levelButtons = document.querySelectorAll('[data-level]');
    const departmentOptions = document.getElementById('department-options');
    const provinceOptions = document.getElementById('province-options');
    const sortByName = (a, b) => a.properties.nombre.localeCompare(b.properties.nombre, 'es');
    function makeOption(container, feature, selected, onChange, description) {
      const row = document.createElement('label');
      row.className = 'filter-option';
      const input = document.createElement('input');
      input.type = 'checkbox'; input.checked = selected.has(feature.properties.ubigeo);
      input.addEventListener('change', () => onChange(feature.properties.ubigeo, input.checked));
      const text = document.createElement('span');
      text.textContent = normalize(feature.properties.nombre) + (description ? ' · ' + normalize(description) : '');
      row.append(input, text); container.appendChild(row);
    }
    function renderFilters() {
      departmentOptions.replaceChildren();
      [...data.departamento.features].sort(sortByName).forEach(f => makeOption(departmentOptions, f, selectedDepartments, (id, checked) => {
        if (checked) selectedDepartments.add(id); else {
          selectedDepartments.delete(id);
          for (const provinceId of selectedProvinces) if (provinceId.startsWith(id)) selectedProvinces.delete(provinceId);
        }
        applyFilters();
      }));
      provinceOptions.replaceChildren();
      const available = data.provincia.features.filter(f => selectedDepartments.has(f.properties.ubigeo_departamento)).sort(sortByName);
      available.forEach(f => makeOption(provinceOptions, f, selectedProvinces, (id, checked) => {
        if (checked) selectedProvinces.add(id); else selectedProvinces.delete(id);
        applyFilters();
      }, selectedDepartments.size > 1 ? f.properties.nombre_departamento : ''));
      if (!available.length) provinceOptions.textContent = 'Selecciona un departamento para ver sus provincias.';
      document.getElementById('department-count').textContent = selectedDepartments.size ? selectedDepartments.size + ' seleccionados' : 'Todos';
      document.getElementById('province-count').textContent = selectedProvinces.size ? selectedProvinces.size + ' seleccionadas' : 'Todas';
      document.getElementById('partial-boundary-note').hidden = selectedProvinces.size === 0;
    }
    function applyFilters() {
      const hasDepartment = id => !selectedDepartments.size || selectedDepartments.has(id);
      const hasProvince = (departmentId, provinceId) => {
        if (!hasDepartment(departmentId)) return false;
        const restrictDepartment = [...selectedProvinces].some(id => id.startsWith(departmentId));
        return !restrictDepartment || selectedProvinces.has(provinceId);
      };
      const selectedDistrictFeatures = data.distrito.features.filter(f => hasProvince(f.properties.ubigeo_departamento, f.properties.ubigeo_provincia));
      const selectedProvinceFeatures = data.provincia.features.filter(f => hasProvince(f.properties.ubigeo_departamento, f.properties.ubigeo));
      const selectedDepartmentFeatures = data.departamento.features.filter(f => hasDepartment(f.properties.ubigeo));
      // En una selección parcial, la geometría de interacción se limita a las provincias visibles.
      const interactionDepartments = selectedDepartmentFeatures.map(f => {
        const parts = selectedProvinceFeatures.filter(p => p.properties.ubigeo_departamento === f.properties.ubigeo);
        if (![...selectedProvinces].some(id => id.startsWith(f.properties.ubigeo))) return f;
        return { type: 'Feature', properties: f.properties, geometry: { type: 'GeometryCollection', geometries: parts.map(p => p.geometry) } };
      });
      scoped = { distrito: { type: 'FeatureCollection', features: selectedDistrictFeatures }, provincia: { type: 'FeatureCollection', features: selectedProvinceFeatures }, departamento: { type: 'FeatureCollection', features: interactionDepartments } };
      baseTerritorial.clearLayers().addData(scoped.distrito);
      districts.clearLayers().addData(scoped.distrito);
      provinces.clearLayers().addData(scoped.provincia);
      // Sin recortar la geometría, un departamento parcial mostraría líneas fuera de la zona.
      departments.clearLayers().addData({ type: 'FeatureCollection', features: selectedDepartmentFeatures.filter(f => ![...selectedProvinces].some(id => id.startsWith(f.properties.ubigeo))) });
      renderFilters();
      updateLevels();
      const bounds = districts.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 10 });
    }
    function updateLevels() {
      level = ['distrito', 'provincia', 'departamento'].find(name => selectedLevels.has(name));
      levelButtons.forEach(button => {
        const active = selectedLevels.has(button.dataset.level);
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      districts.setStyle(districtStyle);
      provinces.setStyle({ opacity: selectedLevels.has('provincia') ? .95 : 0 });
      departments.setStyle({ opacity: selectedLevels.has('departamento') ? 1 : 0 });
      document.getElementById('level-label').textContent = { distrito: 'DISTRITOS', provincia: 'PROVINCIAS', departamento: 'DEPARTAMENTOS' }[level];
      document.getElementById('paint-level').textContent = 'Al colorear: ' + level + (selectedLevels.size > 1 ? ' (nivel más detallado)' : '');
      showLevel();
    }
    levelButtons.forEach(button => button.addEventListener('click', () => {
      const name = button.dataset.level;
      if (selectedLevels.has(name)) {
        if (selectedLevels.size === 1) return;
        selectedLevels.delete(name);
      } else selectedLevels.add(name);
      updateLevels();
    }));
    updateLevels();
    renderFilters();
    document.getElementById('clear-filter').addEventListener('click', () => { selectedDepartments.clear(); selectedProvinces.clear(); applyFilters(); });
    function selectColor(value) { color = value; document.querySelectorAll('.swatch').forEach(b => { const active = b.dataset.color === (value || 'sin-color'); b.classList.toggle('selected', active); b.setAttribute('aria-pressed', String(active)); }); }
    const noColor = document.createElement('button');
    noColor.type = 'button'; noColor.className = 'swatch no-color'; noColor.dataset.color = 'sin-color'; noColor.setAttribute('aria-label', 'Sin relleno: quitar color con un clic'); noColor.setAttribute('aria-pressed', 'false'); noColor.addEventListener('click', () => selectColor(null)); document.getElementById('palette').appendChild(noColor);
    colors.forEach((value, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'swatch' + (i === 0 ? ' selected' : ''); b.style.background = value; b.dataset.color = value; b.setAttribute('aria-label', 'Elegir color ' + value); b.setAttribute('aria-pressed', String(i === 0)); b.addEventListener('click', () => selectColor(value)); document.getElementById('palette').appendChild(b); });
    document.getElementById('custom').addEventListener('input', e => selectColor(e.target.value));
    document.getElementById('reset').addEventListener('click', () => { if (!confirm('¿Borrar todos los colores del mapa?')) return; painted = {}; districts.eachLayer(d => d.setStyle(districtStyle(d.feature))); if (onlyColored) refreshColoredVisibility(); save(); });
    document.getElementById('only-colored').addEventListener('change', event => { onlyColored = event.target.checked; refreshColoredVisibility(); });

    // Componer la vista con los dos lienzos de Leaflet y las etiquetas visibles.
    async function captureMap() {
      updateNames();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const mapElement = map.getContainer();
      const rect = mapElement.getBoundingClientRect();
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(rect.width * scale); canvas.height = Math.round(rect.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = getComputedStyle(mapElement).backgroundColor;
      ctx.fillRect(0, 0, rect.width, rect.height);
      for (const pane of ['baseTerritorial', 'overlayPane', 'limites']) {
        for (const layerCanvas of map.getPane(pane).querySelectorAll('canvas')) {
          const bounds = layerCanvas.getBoundingClientRect();
          ctx.drawImage(layerCanvas, bounds.left - rect.left, bounds.top - rect.top, bounds.width, bounds.height);
        }
      }
      for (const node of mapElement.querySelectorAll('.place-name')) {
        const bounds = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        const content = style.textTransform === 'uppercase' ? node.textContent.toLocaleUpperCase('es') : node.textContent;
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.fillStyle = style.color;
        const x = bounds.left - rect.left + bounds.width / 2, y = bounds.top - rect.top + bounds.height / 2;
        ctx.strokeText(content, x, y); ctx.fillText(content, x, y);
      }
      return canvas;
    }
    function blobFromCanvas(canvas, type, quality) {
      return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen')), type, quality));
    }
    function download(blob, filename) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    async function createPdf(canvas) {
      const jpeg = new Uint8Array(await (await blobFromCanvas(canvas, 'image/jpeg', .95)).arrayBuffer());
      const width = canvas.width * .375, height = canvas.height * .375;
      const encoder = new TextEncoder(), chunks = [], offsets = [0];
      let length = 0;
      function append(data) { const bytes = typeof data === 'string' ? encoder.encode(data) : data; chunks.push(bytes); length += bytes.length; }
      function object(number, body) { offsets[number] = length; append(`${number} 0 obj\n${body}\nendobj\n`); }
      append('%PDF-1.4\n');
      object(1, '<< /Type /Catalog /Pages 2 0 R >>');
      object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
      object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
      offsets[4] = length;
      append(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      append(jpeg); append('\nendstream\nendobj\n');
      const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
      object(5, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
      const start = length;
      append('xref\n0 6\n0000000000 65535 f \n');
      for (let i = 1; i <= 5; i++) append(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
      append(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`);
      return new Blob(chunks, { type: 'application/pdf' });
    }
    const dialog = document.getElementById('export-dialog');
    const stage = document.getElementById('preview-stage');
    const cropBox = document.getElementById('crop-box');
    const cropFields = Object.fromEntries(['x', 'y', 'w', 'h'].map(key => [key, document.getElementById('crop-' + key)]));
    const exportMessage = document.getElementById('export-message');
    let snapshot, exportFormat, crop = { x: 0, y: 0, w: 1, h: 1 }, drag;
    function displayCrop() {
      for (const [key, property] of Object.entries({ x: 'left', y: 'top', w: 'width', h: 'height' })) {
        cropBox.style[property] = (crop[key] * 100) + '%';
        cropFields[key].value = Math.round(crop[key] * 100);
      }
    }
    function bounded(value, low, high) { return Math.min(high, Math.max(low, value)); }
    for (const [key, input] of Object.entries(cropFields)) input.addEventListener('change', () => {
      let value = Number(input.value) / 100;
      if (!Number.isFinite(value)) value = crop[key];
      if (key === 'x') crop.x = bounded(value, 0, 1 - crop.w);
      if (key === 'y') crop.y = bounded(value, 0, 1 - crop.h);
      if (key === 'w') crop.w = bounded(value, .05, 1 - crop.x);
      if (key === 'h') crop.h = bounded(value, .05, 1 - crop.y);
      displayCrop();
    });
    cropBox.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      drag = { x: event.clientX, y: event.clientY, start: { ...crop }, corner: event.target.dataset.corner || '' };
      cropBox.setPointerCapture(event.pointerId);
    });
    cropBox.addEventListener('pointermove', event => {
      if (!drag) return;
      const rect = stage.getBoundingClientRect();
      const dx = (event.clientX - drag.x) / rect.width, dy = (event.clientY - drag.y) / rect.height;
      const s = drag.start;
      if (!drag.corner) { crop.x = bounded(s.x + dx, 0, 1 - s.w); crop.y = bounded(s.y + dy, 0, 1 - s.h); }
      else {
        const left = drag.corner.includes('w') ? bounded(s.x + dx, 0, s.x + s.w - .05) : s.x;
        const right = drag.corner.includes('e') ? bounded(s.x + s.w + dx, s.x + .05, 1) : s.x + s.w;
        const top = drag.corner.includes('n') ? bounded(s.y + dy, 0, s.y + s.h - .05) : s.y;
        const bottom = drag.corner.includes('s') ? bounded(s.y + s.h + dy, s.y + .05, 1) : s.y + s.h;
        crop = { x: left, y: top, w: right - left, h: bottom - top };
      }
      displayCrop();
    });
    cropBox.addEventListener('pointerup', () => { drag = null; });
    cropBox.addEventListener('pointercancel', () => { drag = null; });
    async function openExport(format) {
      const buttons = document.querySelectorAll('.header-actions button');
      buttons.forEach(button => button.disabled = true);
      try {
        status.textContent = 'Preparando la vista previa…';
        snapshot = await captureMap();
        exportFormat = format; crop = { x: 0, y: 0, w: 1, h: 1 };
        document.getElementById('preview-image').src = snapshot.toDataURL('image/png');
        document.getElementById('export-confirm').textContent = format === 'png' ? 'Descargar imagen' : 'Descargar PDF';
        exportMessage.textContent = ''; displayCrop(); dialog.showModal();
        status.textContent = 'Vista previa preparada';
      } catch (error) {
        console.error(error); status.textContent = 'No se pudo exportar el mapa. Inténtalo nuevamente.';
      } finally { buttons.forEach(button => button.disabled = false); }
    }
    document.getElementById('export-confirm').addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try {
        const output = document.createElement('canvas');
        output.width = Math.max(1, Math.round(snapshot.width * crop.w)); output.height = Math.max(1, Math.round(snapshot.height * crop.h));
        const ctx = output.getContext('2d');
        ctx.drawImage(snapshot, snapshot.width * crop.x, snapshot.height * crop.y, snapshot.width * crop.w, snapshot.height * crop.h, 0, 0, output.width, output.height);
        const attribution = 'Fuente: Peru-maps / INEI · Límites referenciales';
        const fontSize = Math.min(22, Math.max(10, output.width / 35));
        ctx.font = `${fontSize}px Arial, sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        const textWidth = Math.min(output.width - 8, ctx.measureText(attribution).width);
        ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(output.width - textWidth - 12, output.height - fontSize - 10, textWidth + 12, fontSize + 10);
        ctx.fillStyle = '#34495e'; ctx.fillText(attribution, output.width - 6, output.height - 5, Math.max(1, output.width - 12));
        const blob = exportFormat === 'png' ? await blobFromCanvas(output, 'image/png') : await createPdf(output);
        download(blob, `mapa-peru.${exportFormat}`); dialog.close(); status.textContent = 'Descarga preparada';
      } catch (error) { console.error(error); exportMessage.textContent = 'No se pudo generar el archivo. Inténtalo nuevamente.'; }
      finally { event.currentTarget.disabled = false; }
    });
    document.getElementById('export-close').addEventListener('click', () => dialog.close());
    document.getElementById('export-cancel').addEventListener('click', () => dialog.close());
    document.getElementById('export-image').addEventListener('click', () => openExport('png'));
    document.getElementById('export-pdf').addEventListener('click', () => openExport('pdf'));
  } catch (e) { console.error(e); document.getElementById('error').hidden = false; }
})();
