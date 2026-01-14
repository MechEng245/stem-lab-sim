// Simple helper for toasts + local saves
function toast(msg){
  const el = document.getElementById("toast");
  if(!el) return;
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=> el.style.opacity = "0.55", 1800);
}

function getSavedScenes(){
  try{
    return JSON.parse(localStorage.getItem("savedScenes") || "[]");
  }catch(e){
    return [];
  }
}
function setSavedScenes(list){
  localStorage.setItem("savedScenes", JSON.stringify(list));
}

// Editor-only: Three.js scene
async function initEditor(){
  const canvas = document.getElementById("viewport");
  if(!canvas) return;

  // Load Three.js from CDN (no install needed)
  const THREE = await import("https://unpkg.com/three@0.160.0/build/three.module.js");
  const { OrbitControls } = await import("https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f14);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(3.2, 2.2, 4.2);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.9);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(5, 6, 3);
  scene.add(dir);

  // Grid
  const grid = new THREE.GridHelper(20, 20, 0x1e2b3b, 0x142030);
  scene.add(grid);

  // Objects list
  const objects = [];
  let selectedIndex = -1;

  function addMesh(type){
    let geom;
    if(type === "cube") geom = new THREE.BoxGeometry(1,1,1);
    if(type === "sphere") geom = new THREE.SphereGeometry(0.6, 32, 24);
    if(type === "cylinder") geom = new THREE.CylinderGeometry(0.5,0.5,1.2, 28);

    const color = document.getElementById("color")?.value || "#4da3ff";
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), metalness:0.35, roughness:0.28 });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set((Math.random()-0.5)*1.5, 0.6, (Math.random()-0.5)*1.5);
    mesh.castShadow = false;

    scene.add(mesh);
    objects.push(mesh);
    selectedIndex = objects.length - 1;
    refreshObjectList();
    toast(`Added ${type}`);
  }

  function refreshObjectList(){
    const list = document.getElementById("objectList");
    if(!list) return;
    list.innerHTML = "";

    objects.forEach((m, i)=>{
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.style.justifyContent = "space-between";
      btn.textContent = `Object ${i+1}`;
      if(i === selectedIndex){
        btn.style.borderColor = "rgba(77,163,255,.7)";
        btn.style.background = "rgba(77,163,255,.15)";
      }
      btn.onclick = ()=>{
        selectedIndex = i;
        refreshObjectList();
        syncInspector();
        toast(`Selected Object ${i+1}`);
      };
      list.appendChild(btn);
    });

    syncInspector();
  }

  function syncInspector(){
    const x = document.getElementById("posX");
    const y = document.getElementById("posY");
    const z = document.getElementById("posZ");
    const scale = document.getElementById("scale");
    const color = document.getElementById("color");

    const has = selectedIndex >= 0 && objects[selectedIndex];
    [x,y,z,scale,color].forEach(el => { if(el) el.disabled = !has; });

    if(!has) return;

    const m = objects[selectedIndex];
    if(x) x.value = m.position.x.toFixed(2);
    if(y) y.value = m.position.y.toFixed(2);
    if(z) z.value = m.position.z.toFixed(2);
    if(scale) scale.value = m.scale.x.toFixed(2);
    if(color){
      // approximate
      color.value = "#" + m.material.color.getHexString();
    }
  }

  function applyInspector(){
    const has = selectedIndex >= 0 && objects[selectedIndex];
    if(!has) return;
    const m = objects[selectedIndex];

    const x = parseFloat(document.getElementById("posX").value);
    const y = parseFloat(document.getElementById("posY").value);
    const z = parseFloat(document.getElementById("posZ").value);
    const s = parseFloat(document.getElementById("scale").value);
    const c = document.getElementById("color").value;

    m.position.set(x,y,z);
    m.scale.set(s,s,s);
    m.material.color.set(c);
  }

  // Save/load scene (simple JSON)
  function serialize(){
    return objects.map(m => ({
      type: m.geometry.type,
      position: { x:m.position.x, y:m.position.y, z:m.position.z },
      scale: m.scale.x,
      color: "#" + m.material.color.getHexString()
    }));
  }

  function clearScene(){
    objects.forEach(m => scene.remove(m));
    objects.length = 0;
    selectedIndex = -1;
    refreshObjectList();
  }

  function loadFrom(data){
    clearScene();
    data.forEach(item=>{
      let type = "cube";
      if(item.type === "SphereGeometry") type = "sphere";
      if(item.type === "CylinderGeometry") type = "cylinder";
      if(item.type === "BoxGeometry") type = "cube";
      addMesh(type);
      const m = objects[objects.length - 1];
      m.position.set(item.position.x, item.position.y, item.position.z);
      m.scale.set(item.scale, item.scale, item.scale);
      m.material.color.set(item.color);
    });
    toast("Loaded scene");
  }

  // Hook up UI
  document.getElementById("addCube").onclick = ()=> addMesh("cube");
  document.getElementById("addSphere").onclick = ()=> addMesh("sphere");
  document.getElementById("addCylinder").onclick = ()=> addMesh("cylinder");

  ["posX","posY","posZ","scale","color"].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener("input", ()=> { applyInspector(); });
  });

  document.getElementById("deleteSelected").onclick = ()=>{
    if(selectedIndex < 0) return toast("No object selected");
    scene.remove(objects[selectedIndex]);
    objects.splice(selectedIndex, 1);
    selectedIndex = Math.min(selectedIndex, objects.length - 1);
    refreshObjectList();
    toast("Deleted object");
  };

  document.getElementById("saveScene").onclick = ()=>{
    const name = (document.getElementById("sceneName").value || "").trim();
    if(!name) return toast("Name your design first");

    const scenes = getSavedScenes();
    scenes.unshift({ name, savedAt: Date.now(), data: serialize() });
    setSavedScenes(scenes.slice(0, 50));
    toast("Saved ✔");
  };

  document.getElementById("loadLatest").onclick = ()=>{
    const scenes = getSavedScenes();
    if(!scenes.length) return toast("No saved designs yet");
    loadFrom(scenes[0].data);
  };

  // Resize
  function resize(){
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // Starter object
  addMesh("cube");
  refreshObjectList();

  function animate(){
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}

// Library page render
function initLibrary(){
  const wrap = document.getElementById("libraryList");
  if(!wrap) return;

  const scenes = getSavedScenes();
  if(!scenes.length){
    wrap.innerHTML = `<div class="card"><h3>No saved designs yet</h3><p>Go to the Editor and hit <b>Save</b>. Designs will appear here on this device.</p></div>`;
    return;
  }

  wrap.innerHTML = scenes.map(s => `
    <div class="card">
      <div class="pill">Saved</div>
      <h3 style="margin:10px 0 6px">${escapeHtml(s.name)}</h3>
      <p>Saved: ${new Date(s.savedAt).toLocaleString()}</p>
      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap">
        <a class="btn" href="editor.html" onclick="localStorage.setItem('loadSceneIndex','${String(scenes.indexOf(s))}')">Open in Editor</a>
      </div>
      <p class="small" style="margin-top:10px">For now, saves are local (no account needed). Cloud saves come later.</p>
    </div>
  `).join("");

  toast("Library loaded");
}

function escapeHtml(str){
  return str.replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

// If library clicks “Open”, load correct scene index in editor
function maybeAutoLoadInEditor(){
  const idx = localStorage.getItem("loadSceneIndex");
  if(idx == null) return;
  localStorage.removeItem("loadSceneIndex");
  toast("Tip: click “Load Latest” (we’ll improve this soon)");
}

// Boot
window.addEventListener("DOMContentLoaded", ()=>{
  initEditor();
  initLibrary();
  maybeAutoLoadInEditor();
});
