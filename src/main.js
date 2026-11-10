const THREE = window.THREE;
if (!THREE) throw new Error('Three.js did not load. Check your internet connection and CDN access.');

const container = document.querySelector('#game');
const menu = document.querySelector('#menu');
const pause = document.querySelector('#pause');
const hud = document.querySelector('#hud');
const startBtn = document.querySelector('#start');
const resumeBtn = document.querySelector('#resume');
const restartBtn = document.querySelector('#restart');
const bootMessage = document.querySelector('#boot-message');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8c9a9b);
scene.fog = new THREE.Fog(0x8c9a9b, 32, 105);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 180);
camera.position.set(0, 1.7, 12);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdce4e5, 0x615344, 1.7));
const sun = new THREE.DirectionalLight(0xffe2b5, 2.0);
sun.position.set(-20, 35, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const mat = (color, roughness = 1, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const wallMat = mat(0xb7a17e);
const darkWall = mat(0x88765e);
const groundMat = mat(0x777568);
const crateMat = mat(0x72583b);
const metalMat = mat(0x343638, 0.68, 0.55);
const darkMetal = mat(0x202426, 0.52, 0.62);
const woodMat = mat(0x60452d, 0.92);
const rubberMat = mat(0x171a1b, 0.95);
const gloveMat = mat(0x343a32, 0.96);
const gloveDark = mat(0x242a25, 0.98);
const sleeveMat = mat(0x66614a, 1);
const seamMat = mat(0x8a8062, 1);
const colliders = [];

function box(x, y, z, sx, sy, sz, material, collide = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  if (collide) colliders.push({ x, z, hx: sx / 2, hz: sz / 2, top: y + sy / 2 });
  return m;
}

const floor = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), groundMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

// Original compact arena layout; no proprietary map geometry is used.
box(0, 2, -27, 70, 4, 1.2, wallMat);
box(0, 2, 27, 70, 4, 1.2, wallMat);
box(-35, 2, 0, 1.2, 4, 54, wallMat);
box(35, 2, 0, 1.2, 4, 54, wallMat);
box(-12, 1.8, -7, 1, 3.6, 19, darkWall);
box(12, 1.8, 8, 1, 3.6, 18, darkWall);
box(0, 1.5, -15, 13, 3, 1, darkWall);
box(0, 1.5, 15, 13, 3, 1, darkWall);
box(-22, 1.3, 0, 8, 2.6, 1, wallMat);
box(22, 1.3, 1, 8, 2.6, 1, wallMat);
for (const [x, z] of [[-23, -17], [-18, -17], [20, -16], [25, -16], [-25, 17], [-19, 17], [18, 17], [24, 17], [0, -4], [3, -4], [0, 5], [3, 5]]) {
  box(x, 1, z, 2.2, 2, 2.2, crateMat);
}
for (const [x, z] of [[-29, -22], [29, -22], [-29, 22], [29, 22]]) {
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 12), metalMat);
  barrel.position.set(x, 0.7, z);
  barrel.castShadow = true;
  scene.add(barrel);
  colliders.push({ x, z, hx: 0.55, hz: 0.55, top: 1.4 });
}
for (let x = -30; x <= 30; x += 10) {
  box(x, 4.15, -26.2, 1, 0.3, 0.5, darkWall, false);
  box(x, 4.15, 26.2, 1, 0.3, 0.5, darkWall, false);
}

const weapons = [
  { name: 'AK-47', damage: 34, rate: 105, mag: 30, reserve: 90, spread: 0.012, reload: 1750, type: 'ak' },
  { name: 'M4A1', damage: 27, rate: 90, mag: 30, reserve: 90, spread: 0.009, reload: 1600, type: 'm4' },
  { name: 'AWP', damage: 100, rate: 900, mag: 10, reserve: 30, spread: 0.002, reload: 2300, type: 'awp' },
  { name: 'GLOCK-18', damage: 20, rate: 180, mag: 20, reserve: 100, spread: 0.02, reload: 1300, type: 'glock' }
];
let weaponIndex = 0;
let ammo = [];
let reserve = [];
let health = 100;
let armor = 100;
let money = 800;
let kills = 0;
function resetAmmo() {
  ammo = weapons.map(w => w.mag);
  reserve = weapons.map(w => w.reserve);
}
resetAmmo();

// Viewmodel helpers. All geometry below is original procedural work.
const viewmodel = new THREE.Group();
camera.add(viewmodel);
scene.add(camera);
let weaponRoot = null;
let magazineRig = null;
let boltRig = null;
let weaponBaseY = -0.015;
let reloadStart = 0;
let reloadEnd = 0;
let reloading = false;
let fireKick = 0;
let switchKick = 0;
let muzzleLight = null;

function addMesh(parent, geometry, material, position, rotation = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position);
  m.rotation.set(...rotation);
  m.castShadow = false;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

function addBox(parent, position, size, material, rotation = [0, 0, 0]) {
  return addMesh(parent, new THREE.BoxGeometry(...size), material, position, rotation);
}

function addCylinder(parent, position, radiusTop, radiusBottom, length, material, rotation = [Math.PI / 2, 0, 0], segments = 12) {
  return addMesh(parent, new THREE.CylinderGeometry(radiusTop, radiusBottom, length, segments), material, position, rotation);
}

function addCapsuleBetween(parent, start, end, radius, material) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();
  const geometry = new THREE.CapsuleGeometry(radius, Math.max(0.02, length - radius * 1.7), 4, 8);
  const limb = new THREE.Mesh(geometry, material);
  limb.position.copy(a).add(b).multiplyScalar(0.5);
  limb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  limb.castShadow = false;
  parent.add(limb);
  return limb;
}

function addGlovedHand(parent, center, scale = 1) {
  const hand = new THREE.Group();
  hand.position.set(...center);
  hand.scale.setScalar(scale);
  parent.add(hand);
  addBox(hand, [0, 0, 0], [0.19, 0.115, 0.23], gloveMat, [-0.18, 0, 0]);
  addBox(hand, [0, 0.057, -0.015], [0.16, 0.035, 0.16], gloveDark, [-0.12, 0, 0]);
  // Four individually modeled fingers and small knuckle pads.
  for (let i = 0; i < 4; i++) {
    const x = -0.068 + i * 0.045;
    addCapsuleBetween(hand, [x, -0.012, -0.07], [x + 0.006, -0.018, -0.18], 0.021, gloveMat);
    addBox(hand, [x, 0.012, -0.112], [0.032, 0.018, 0.035], seamMat, [0.1, 0, 0]);
  }
  // Thumb angled inward across the grip.
  addCapsuleBetween(hand, [0.085, -0.005, -0.005], [0.12, -0.035, -0.105], 0.026, gloveMat);
  addBox(hand, [-0.005, -0.061, 0.075], [0.13, 0.045, 0.1], gloveDark, [0.08, 0, 0]);
  return hand;
}

function buildArms(parent) {
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  parent.add(leftArm, rightArm);

  addCapsuleBetween(rightArm, [0.62, -0.59, -0.12], [0.43, -0.39, -0.61], 0.105, sleeveMat);
  addCapsuleBetween(rightArm, [0.62, -0.59, -0.12], [0.60, -0.56, -0.20], 0.113, seamMat);
  addGlovedHand(rightArm, [0.39, -0.385, -0.62], 0.93);

  addCapsuleBetween(leftArm, [-0.48, -0.60, -0.20], [-0.015, -0.405, -0.86], 0.105, sleeveMat);
  addCapsuleBetween(leftArm, [-0.48, -0.60, -0.20], [-0.43, -0.58, -0.27], 0.113, seamMat);
  const supportHand = addGlovedHand(leftArm, [-0.005, -0.39, -0.88], 0.92);
  supportHand.rotation.y = -0.22;
  return { leftArm, rightArm };
}

function addMagazine(parent, position, size, material, rotation = [0, 0, 0]) {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.set(...rotation);
  parent.add(group);
  addBox(group, [0, 0, 0], size, material, [0.08, 0, 0]);
  addBox(group, [0, -size[1] * 0.5, 0], [size[0] * 0.84, 0.025, size[2] * 0.9], darkMetal);
  magazineRig = { group, baseY: group.position.y, baseRotX: group.rotation.x };
  return group;
}

function buildAK(parent) {
  const wood = woodMat;
  addBox(parent, [0.31, -0.285, -0.72], [0.25, 0.17, 0.54], metalMat);
  addBox(parent, [0.31, -0.215, -0.72], [0.23, 0.035, 0.48], darkMetal);
  addBox(parent, [0.31, -0.29, -1.02], [0.22, 0.13, 0.34], wood);
  addBox(parent, [0.31, -0.29, -0.37], [0.18, 0.15, 0.34], wood, [0, -0.04, 0]);
  addBox(parent, [0.31, -0.29, -0.19], [0.21, 0.17, 0.08], rubberMat);
  addBox(parent, [0.31, -0.46, -0.57], [0.13, 0.27, 0.15], wood, [-0.16, 0, 0]);
  addCylinder(parent, [0.31, -0.255, -1.34], 0.034, 0.04, 0.66, darkMetal);
  addCylinder(parent, [0.31, -0.255, -1.69], 0.052, 0.052, 0.1, metalMat);
  addCylinder(parent, [0.31, -0.205, -1.05], 0.025, 0.025, 0.3, darkMetal, [Math.PI / 2, 0, 0]);
  addBox(parent, [0.31, -0.18, -1.53], [0.08, 0.13, 0.07], darkMetal);
  addBox(parent, [0.31, -0.18, -0.48], [0.08, 0.08, 0.08], darkMetal);
  addBox(parent, [0.31, -0.37, -0.98], [0.25, 0.04, 0.37], wood);
  addMagazine(parent, [0.31, -0.48, -0.77], [0.16, 0.34, 0.19], wood, [-0.13, 0, 0]);
  addBox(parent, [0.31, -0.385, -0.66], [0.06, 0.09, 0.12], darkMetal);
  // Receiver pins and rear sight add a more readable silhouette.
  for (const z of [-0.88, -0.58]) addCylinder(parent, [0.438, -0.28, z], 0.018, 0.018, 0.012, darkMetal, [0, 0, Math.PI / 2], 8);
  addBox(parent, [0.31, -0.145, -0.49], [0.09, 0.08, 0.11], metalMat);
}

function buildM4(parent) {
  addBox(parent, [0.31, -0.285, -0.74], [0.25, 0.17, 0.55], darkMetal);
  addBox(parent, [0.31, -0.22, -0.75], [0.24, 0.04, 0.52], metalMat);
  addBox(parent, [0.31, -0.29, -1.04], [0.22, 0.15, 0.43], metalMat);
  addBox(parent, [0.31, -0.29, -0.34], [0.17, 0.15, 0.34], rubberMat);
  addBox(parent, [0.31, -0.29, -0.19], [0.2, 0.17, 0.07], rubberMat);
  addBox(parent, [0.31, -0.46, -0.58], [0.13, 0.27, 0.15], rubberMat, [-0.18, 0, 0]);
  addCylinder(parent, [0.31, -0.255, -1.43], 0.027, 0.032, 0.82, darkMetal);
  addCylinder(parent, [0.31, -0.255, -1.86], 0.052, 0.052, 0.1, metalMat);
  // Quad-rail handguard ribs.
  for (let i = 0; i < 7; i++) {
    const z = -0.91 - i * 0.043;
    addBox(parent, [0.31, -0.195, z], [0.28, 0.025, 0.018], darkMetal);
    addBox(parent, [0.31, -0.385, z], [0.28, 0.022, 0.018], darkMetal);
  }
  addBox(parent, [0.31, -0.13, -1.35], [0.08, 0.16, 0.08], darkMetal);
  addBox(parent, [0.31, -0.13, -0.56], [0.09, 0.1, 0.1], metalMat);
  addMagazine(parent, [0.31, -0.48, -0.78], [0.15, 0.32, 0.17], darkMetal, [-0.05, 0, 0]);
  addBox(parent, [0.31, -0.37, -0.99], [0.24, 0.035, 0.22], metalMat);
}

function buildAWP(parent) {
  addBox(parent, [0.31, -0.30, -0.70], [0.27, 0.20, 0.72], mat(0x59645d, 0.9));
  addBox(parent, [0.31, -0.32, -0.30], [0.2, 0.18, 0.45], rubberMat, [0, 0.03, 0]);
  addBox(parent, [0.31, -0.28, -1.10], [0.23, 0.14, 0.48], mat(0x59645d, 0.9));
  addCylinder(parent, [0.31, -0.25, -1.57], 0.031, 0.038, 0.83, darkMetal);
  addCylinder(parent, [0.31, -0.25, -2.0], 0.052, 0.052, 0.12, metalMat);
  addBox(parent, [0.31, -0.48, -0.76], [0.15, 0.24, 0.18], darkMetal);
  // Scope body, objective bell, ocular bell, and mount rings.
  addCylinder(parent, [0.31, -0.105, -0.91], 0.07, 0.07, 0.55, darkMetal);
  addCylinder(parent, [0.31, -0.105, -1.2], 0.105, 0.105, 0.12, metalMat);
  addCylinder(parent, [0.31, -0.105, -0.62], 0.082, 0.082, 0.1, metalMat);
  addBox(parent, [0.31, -0.19, -0.91], [0.18, 0.045, 0.26], darkMetal);
  addBox(parent, [0.31, -0.38, -0.55], [0.06, 0.08, 0.08], metalMat);
  magazineRig = null;
  const mag = new THREE.Group();
  mag.position.set(0.31, -0.46, -0.77);
  parent.add(mag);
  addBox(mag, [0, 0, 0], [0.14, 0.18, 0.16], darkMetal);
  magazineRig = { group: mag, baseY: mag.position.y, baseRotX: 0 };
  boltRig = addBox(parent, [0.445, -0.27, -0.62], [0.035, 0.045, 0.23], metalMat);
}

function buildGlock(parent) {
  addBox(parent, [0.31, -0.30, -0.66], [0.22, 0.16, 0.48], rubberMat);
  addBox(parent, [0.31, -0.225, -0.71], [0.23, 0.075, 0.45], darkMetal);
  addBox(parent, [0.31, -0.19, -0.72], [0.19, 0.025, 0.4], metalMat);
  addCylinder(parent, [0.31, -0.275, -0.99], 0.022, 0.022, 0.38, darkMetal);
  addBox(parent, [0.31, -0.44, -0.52], [0.16, 0.28, 0.19], rubberMat, [-0.12, 0, 0]);
  addBox(parent, [0.31, -0.45, -0.54], [0.17, 0.035, 0.2], darkMetal, [-0.12, 0, 0]);
  // Trigger guard and trigger.
  addCylinder(parent, [0.31, -0.39, -0.73], 0.009, 0.009, 0.2, metalMat, [0, 0, Math.PI / 2], 8);
  addBox(parent, [0.31, -0.385, -0.72], [0.12, 0.018, 0.18], metalMat);
  addMagazine(parent, [0.31, -0.51, -0.68], [0.13, 0.29, 0.15], darkMetal, [0.04, 0, 0]);
  addBox(parent, [0.31, -0.15, -0.55], [0.045, 0.055, 0.07], darkMetal);
  addBox(parent, [0.31, -0.15, -0.9], [0.045, 0.055, 0.07], darkMetal);
}

function buildWeapon() {
  if (weaponRoot) viewmodel.remove(weaponRoot);
  weaponRoot = new THREE.Group();
  viewmodel.add(weaponRoot);
  magazineRig = null;
  boltRig = null;
  const w = weapons[weaponIndex];
  if (w.type === 'ak') buildAK(weaponRoot);
  if (w.type === 'm4') buildM4(weaponRoot);
  if (w.type === 'awp') buildAWP(weaponRoot);
  if (w.type === 'glock') buildGlock(weaponRoot);
  buildArms(weaponRoot);
  if (muzzleLight) weaponRoot.remove(muzzleLight);
  muzzleLight = new THREE.PointLight(0xffb35b, 0, 2.5, 2);
  muzzleLight.position.set(0.31, -0.25, w.type === 'awp' ? -2.04 : (w.type === 'glock' ? -1.18 : -1.74));
  weaponRoot.add(muzzleLight);
  weaponBaseY = -0.015;
}
buildWeapon();

const bots = [];
const botMat = mat(0x555c58);
const botHeadMat = mat(0xc29b78);
const botPants = mat(0x343b3c);
function spawnBot(x, z) {
  const group = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.35), botMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), botHeadMat);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.65, 0.32), botPants);
  legs.position.y = 0.42;
  legs.castShadow = true;
  group.add(legs);
  group.position.set(x, 0, z);
  scene.add(group);
  bots.push({ group, hp: 100, attack: 0, walk: Math.random() * 6, alive: true });
}
function spawnWave() {
  for (const b of bots) scene.remove(b.group);
  bots.length = 0;
  [[-27, -19], [27, -19], [-27, 19], [27, 19]].forEach(p => spawnBot(...p));
  updateBots();
}

const keys = {};
let locked = false;
let firing = false;
let lastShot = 0;
let toastTimer = 0;
let gameStarted = false;
const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();
const el = id => document.getElementById(id);

function updateBots() {
  el('bots').textContent = bots.filter(b => b.alive).length;
}
function showToast(message) {
  el('toast').textContent = message;
  toastTimer = 1.8;
}
function updateHud() {
  el('health').textContent = Math.max(0, Math.round(health));
  el('armor').textContent = Math.max(0, Math.round(armor));
  el('money').textContent = '$' + money;
  el('weapon-name').textContent = weapons[weaponIndex].name;
  el('ammo').textContent = ammo[weaponIndex];
  el('reserve').textContent = reserve[weaponIndex];
  el('status').textContent = reloading ? 'RELOADING' : (health <= 0 ? 'ROUND OVER' : 'ELIMINATE THE BOTS');
}

function requestMouseCapture() {
  if (!renderer.domElement.requestPointerLock) {
    showToast('POINTER LOCK IS NOT SUPPORTED IN THIS BROWSER');
    return;
  }
  try {
    const result = renderer.domElement.requestPointerLock();
    if (result && typeof result.catch === 'function') {
      result.catch(() => showToast('CLICK THE GAME AREA TO CAPTURE YOUR MOUSE'));
    }
  } catch (error) {
    console.warn('Pointer lock request failed:', error);
    showToast('CLICK THE GAME AREA TO CAPTURE YOUR MOUSE');
  }
}

function startGame() {
  gameStarted = true;
  menu.classList.add('hidden');
  pause.classList.add('hidden');
  hud.style.display = 'block';
  requestMouseCapture();
}
startBtn.addEventListener('click', startGame);
resumeBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', () => {
  health = 100;
  armor = 100;
  money = 800;
  kills = 0;
  weaponIndex = 0;
  resetAmmo();
  camera.position.set(0, 1.7, 12);
  camera.rotation.set(0, 0, 0);
  reloading = false;
  fireKick = 0;
  buildWeapon();
  spawnWave();
  updateHud();
  startGame();
});

renderer.domElement.addEventListener('click', () => {
  if (gameStarted && !locked && health > 0) requestMouseCapture();
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (locked) {
    menu.classList.add('hidden');
    pause.classList.add('hidden');
    hud.style.display = 'block';
    if (bootMessage) bootMessage.textContent = '';
  } else if (gameStarted) {
    pause.classList.remove('hidden');
    if (health <= 0) {
      el('pause-title').textContent = 'YOU WERE ELIMINATED';
      el('pause-help').textContent = 'Restart the round to play again.';
      resumeBtn.classList.add('hidden');
    } else {
      el('pause-title').textContent = 'PAUSED';
      el('pause-help').textContent = 'Click RESUME to capture the mouse again.';
      resumeBtn.classList.remove('hidden');
    }
  }
});
document.addEventListener('pointerlockerror', () => {
  showToast('MOUSE LOCK FAILED — CLICK THE GAME VIEW TO TRY AGAIN');
});
document.addEventListener('mousemove', event => {
  if (!locked) return;
  camera.rotation.order = 'YXZ';
  camera.rotation.y -= event.movementX * 0.0022;
  camera.rotation.x -= event.movementY * 0.0022;
  camera.rotation.x = Math.max(-1.48, Math.min(1.48, camera.rotation.x));
});
document.addEventListener('keydown', event => {
  keys[event.code] = true;
  if (event.repeat) return;
  if (event.code === 'KeyR') reload();
  if (event.code === 'Digit1') switchWeapon(0);
  if (event.code === 'Digit2') switchWeapon(1);
  if (event.code === 'Digit3') switchWeapon(2);
  if (event.code === 'Digit4') switchWeapon(3);
});
document.addEventListener('keyup', event => { keys[event.code] = false; });
document.addEventListener('mousedown', event => {
  if (event.button === 0 && locked) {
    firing = true;
    shoot();
  }
});
document.addEventListener('mouseup', event => { if (event.button === 0) firing = false; });
window.addEventListener('blur', () => { firing = false; for (const key of Object.keys(keys)) keys[key] = false; });

function switchWeapon(index) {
  if (index < 0 || index >= weapons.length || index === weaponIndex) return;
  weaponIndex = index;
  reloading = false;
  buildWeapon();
  switchKick = 1;
  updateHud();
}

function reload() {
  const weapon = weapons[weaponIndex];
  if (reloading || reserve[weaponIndex] <= 0 || ammo[weaponIndex] === weapon.mag || health <= 0) return;
  reloading = true;
  reloadStart = performance.now();
  reloadEnd = reloadStart + weapon.reload;
  updateHud();
}

function shoot() {
  const now = performance.now();
  const weapon = weapons[weaponIndex];
  if (!locked || reloading || now - lastShot < weapon.rate || health <= 0) return;
  lastShot = now;
  if (ammo[weaponIndex] <= 0) {
    showToast('OUT OF AMMO — PRESS R');
    return;
  }
  ammo[weaponIndex]--;
  fireKick = Math.min(fireKick + (weapon.type === 'awp' ? 1.25 : 0.82), 1.8);
  if (muzzleLight) muzzleLight.intensity = 3.2;
  const spread = weapon.spread;
  raycaster.setFromCamera(new THREE.Vector2((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread), camera);
  const targets = [];
  bots.filter(b => b.alive).forEach(bot => bot.group.traverse(object => {
    if (object.isMesh) targets.push({ mesh: object, bot });
  }));
  const hits = raycaster.intersectObjects(targets.map(t => t.mesh), false);
  if (hits.length) {
    const target = targets.find(t => t.mesh === hits[0].object);
    if (target) {
      target.bot.hp -= weapon.damage;
      el('hitmarker').style.opacity = '1';
      setTimeout(() => { el('hitmarker').style.opacity = '0'; }, 90);
      if (target.bot.hp <= 0) {
        target.bot.alive = false;
        scene.remove(target.bot.group);
        kills++;
        money += 300;
        showToast('BOT ELIMINATED  +$300');
        updateBots();
      }
    }
  }
  updateHud();
}

function hurtBotPlayer() {
  if (health <= 0) return;
  const reduction = Math.min(armor, 8);
  armor -= reduction;
  health -= Math.max(1, 9 - reduction * 0.55);
  if (health <= 0) {
    health = 0;
    firing = false;
    document.exitPointerLock?.();
    showToast('YOU WERE ELIMINATED');
  }
  updateHud();
}

function collides(x, z) {
  const radius = 0.42;
  if (Math.abs(x) > 33.8 || Math.abs(z) > 25.8) return true;
  return colliders.some(c => Math.abs(x - c.x) < c.hx + radius && Math.abs(z - c.z) < c.hz + radius);
}

function movePlayer(dt) {
  if (!locked || health <= 0) return;
  const forward = new THREE.Vector3(-Math.sin(camera.rotation.y), 0, -Math.cos(camera.rotation.y));
  const right = new THREE.Vector3(Math.cos(camera.rotation.y), 0, -Math.sin(camera.rotation.y));
  const direction = new THREE.Vector3();
  if (keys.KeyW) direction.add(forward);
  if (keys.KeyS) direction.sub(forward);
  if (keys.KeyD) direction.add(right);
  if (keys.KeyA) direction.sub(right);
  if (direction.lengthSq() > 0) direction.normalize();
  const speed = keys.ShiftLeft ? 7.2 : 5.2;
  const nx = camera.position.x + direction.x * speed * dt;
  const nz = camera.position.z + direction.z * speed * dt;
  if (!collides(nx, camera.position.z)) camera.position.x = nx;
  if (!collides(camera.position.x, nz)) camera.position.z = nz;
  camera.position.y = 1.7;
}

function updateBotAI(dt) {
  if (!locked || health <= 0) return;
  for (const bot of bots) {
    if (!bot.alive) continue;
    const dx = camera.position.x - bot.group.position.x;
    const dz = camera.position.z - bot.group.position.z;
    const distance = Math.hypot(dx, dz);
    bot.group.rotation.y = Math.atan2(dx, dz);
    bot.walk += dt;
    if (distance > 7) {
      const step = Math.min(dt * 1.25, distance - 6);
      const nx = bot.group.position.x + dx / distance * step;
      const nz = bot.group.position.z + dz / distance * step;
      if (!collides(nx, nz)) {
        bot.group.position.x = nx;
        bot.group.position.z = nz;
      }
    } else {
      bot.attack -= dt;
      if (bot.attack <= 0) {
        bot.attack = 1.15 + Math.random() * 0.7;
        hurtBotPlayer();
      }
    }
  }
}

function updateViewmodel(dt, time) {
  const moving = locked && (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD);
  const moveAmount = moving ? 1 : 0;
  const bob = Math.sin(time * 10.5) * 0.012 * moveAmount;
  const bobY = Math.abs(Math.cos(time * 10.5)) * 0.012 * moveAmount;
  fireKick = Math.max(0, fireKick - dt * 5.5);
  switchKick = Math.max(0, switchKick - dt * 2.8);
  const reloadProgress = reloading ? Math.min(1, (performance.now() - reloadStart) / weapons[weaponIndex].reload) : 0;
  const reloadDip = reloading ? Math.sin(reloadProgress * Math.PI) : 0;
  viewmodel.position.x = bob;
  viewmodel.position.y = -bobY - reloadDip * 0.16 - switchKick * 0.22;
  viewmodel.position.z = fireKick * (weapons[weaponIndex].type === 'awp' ? 0.18 : 0.115);
  viewmodel.rotation.x = fireKick * (weapons[weaponIndex].type === 'awp' ? 0.12 : 0.075) + reloadDip * 0.12 + switchKick * 0.28;
  viewmodel.rotation.z = Math.sin(time * 5.25) * 0.008 * moveAmount - switchKick * 0.12;

  if (magazineRig) {
    let drop = 0;
    if (reloading && reloadProgress > 0.22 && reloadProgress < 0.72) {
      const local = (reloadProgress - 0.22) / 0.5;
      drop = Math.sin(local * Math.PI) * 0.24;
    }
    magazineRig.group.position.y = magazineRig.baseY - drop;
    magazineRig.group.rotation.x = magazineRig.baseRotX + drop * 0.65;
  }
  if (boltRig) {
    const boltBack = reloading ? Math.sin(reloadProgress * Math.PI) * 0.09 : 0;
    boltRig.position.z = -0.62 + boltBack;
  }
  if (muzzleLight) muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 18);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);
  const time = clock.elapsedTime;
  movePlayer(dt);
  updateBotAI(dt);

  if (reloading && performance.now() >= reloadEnd) {
    const need = weapons[weaponIndex].mag - ammo[weaponIndex];
    const amount = Math.min(need, reserve[weaponIndex]);
    ammo[weaponIndex] += amount;
    reserve[weaponIndex] -= amount;
    reloading = false;
    updateHud();
  }
  if (firing && locked && performance.now() - lastShot > weapons[weaponIndex].rate) shoot();
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) el('toast').textContent = '';
  }
  updateViewmodel(dt, time);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

spawnWave();
updateHud();
animate();
