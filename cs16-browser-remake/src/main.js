import * as THREE from 'three';

const container = document.querySelector('#game');
const menu = document.querySelector('#menu');
const pause = document.querySelector('#pause');
const hud = document.querySelector('#hud');
const startBtn = document.querySelector('#start');
const resumeBtn = document.querySelector('#resume');
const restartBtn = document.querySelector('#restart');

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
sun.position.set(-20, 35, 15); sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048); scene.add(sun);

const mat = (color, roughness=1) => new THREE.MeshStandardMaterial({color, roughness});
const wallMat = mat(0xb7a17e), darkWall = mat(0x88765e), groundMat = mat(0x777568), crateMat = mat(0x72583b), metalMat = mat(0x343638,.75);
const colliders = [];
function box(x,y,z,sx,sy,sz,material,collide=true){
  const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);
  m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; scene.add(m);
  if(collide) colliders.push({x,z,hx:sx/2,hz:sz/2,top:y+sy/2});
  return m;
}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(150,150),groundMat); floor.rotation.x=-Math.PI/2; floor.position.y=0; floor.receiveShadow=true; scene.add(floor);

// Original compact arena with a dusty, old-school layout (not a copied map).
box(0,2,-27,70,4,1.2,wallMat); box(0,2,27,70,4,1.2,wallMat);
box(-35,2,0,1.2,4,54,wallMat); box(35,2,0,1.2,4,54,wallMat);
// Mid lane dividers and cover.
box(-12,1.8,-7,1,3.6,19,darkWall); box(12,1.8,8,1,3.6,18,darkWall);
box(0,1.5,-15,13,3,1,darkWall); box(0,1.5,15,13,3,1,darkWall);
box(-22,1.3,0,8,2.6,1,wallMat); box(22,1.3,1,8,2.6,1,wallMat);
for(const [x,z] of [[-23,-17],[-18,-17],[20,-16],[25,-16],[-25,17],[-19,17],[18,17],[24,17],[0,-4],[3,-4],[0,5],[3,5]]){
  box(x,1,z,2.2,2,2.2,crateMat);
}
for(const [x,z] of [[-29,-22],[29,-22],[-29,22],[29,22]]) {
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,1.4,12),metalMat);barrel.position.set(x,.7,z);barrel.castShadow=true;scene.add(barrel);
  colliders.push({x,z,hx:.55,hz:.55,top:1.4});
}
// Architectural accents.
for(let x=-30;x<=30;x+=10){box(x,4.15,-26.2,1,0.3,.5,darkWall,false);box(x,4.15,26.2,1,.3,.5,darkWall,false)}

const weapons = [
  {name:'AK-47',damage:34,rate:105,mag:30,reserve:90,spread:.012,reload:1750,color:0x574b3d},
  {name:'M4A1',damage:27,rate:90,mag:30,reserve:90,spread:.009,reload:1600,color:0x33383a},
  {name:'AWP',damage:100,rate:900,mag:10,reserve:30,spread:.002,reload:2300,color:0x4b5550},
  {name:'GLOCK-18',damage:20,rate:180,mag:20,reserve:100,spread:.02,reload:1300,color:0x24282b}
];
let weaponIndex=0, ammo=[], reserve=[], health=100, armor=100, money=800, kills=0;
function resetAmmo(){ammo=weapons.map(w=>w.mag);reserve=weapons.map(w=>w.reserve)}
resetAmmo();

const gun = new THREE.Group(); camera.add(gun); scene.add(camera);
const gunMaterial = mat(0x333638,.65), woodMaterial=mat(0x57432e);
function buildGun(){
  while(gun.children.length) gun.remove(gun.children[0]);
  const w=weapons[weaponIndex];
  const body=new THREE.Mesh(new THREE.BoxGeometry(.22,.19,.68),new THREE.MeshStandardMaterial({color:w.color,roughness:.6}));
  body.position.set(.34,-.28,-.62); gun.add(body);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.035,.04,.62,10),metalMat); barrel.rotation.x=Math.PI/2; barrel.position.set(.34,-.24,-1.08);gun.add(barrel);
  const grip=new THREE.Mesh(new THREE.BoxGeometry(.12,.27,.16),woodMaterial);grip.position.set(.34,-.47,-.48);grip.rotation.x=-.2;gun.add(grip);
  if(weaponIndex<2){const mag=new THREE.Mesh(new THREE.BoxGeometry(.13,.3,.2),woodMaterial);mag.position.set(.34,-.48,-.72);mag.rotation.x=-.18;gun.add(mag)}
  if(weaponIndex===2){const scope=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.36,12),metalMat);scope.rotation.x=Math.PI/2;scope.position.set(.34,-.13,-.66);gun.add(scope)}
  gun.position.set(0,0,0);
}
buildGun();

const bots=[];
const botMat=mat(0x555c58), botHeadMat=mat(0xc29b78), botPants=mat(0x343b3c);
function spawnBot(x,z){
  const group=new THREE.Group();
  const torso=new THREE.Mesh(new THREE.BoxGeometry(.65,.85,.35),botMat);torso.position.y=1.15;torso.castShadow=true;group.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.23,12,10),botHeadMat);head.position.y=1.72;head.castShadow=true;group.add(head);
  const legs=new THREE.Mesh(new THREE.BoxGeometry(.52,.65,.32),botPants);legs.position.y=.42;legs.castShadow=true;group.add(legs);
  group.position.set(x,0,z);scene.add(group);
  bots.push({group,hp:100,attack:0,walk:Math.random()*6,alive:true});
}
function spawnWave(){
  for(const b of bots) scene.remove(b.group); bots.length=0;
  [[-27,-19],[27,-19],[-27,19],[27,19]].forEach(p=>spawnBot(...p));
  updateBots();
}
spawnWave();

const keys={}; let locked=false, firing=false, lastShot=0, reloading=false, reloadEnd=0, recoil=0, toastTimer=0;
const raycaster=new THREE.Raycaster();
const clock=new THREE.Clock();
const el=id=>document.getElementById(id);
function updateBots(){el('bots').textContent=bots.filter(b=>b.alive).length}
function showToast(s){el('toast').textContent=s;toastTimer=1.8}
function updateHud(){
  el('health').textContent=Math.max(0,Math.round(health));
  el('armor').textContent=Math.max(0,Math.round(armor));
  el('money').textContent='$'+money;
  el('weapon-name').textContent=weapons[weaponIndex].name;
  el('ammo').textContent=ammo[weaponIndex];
  el('reserve').textContent=reserve[weaponIndex];
  el('status').textContent=reloading?'RELOADING':(health<=0?'ROUND OVER':'ELIMINATE THE BOTS');
}
function startGame(){
  menu.classList.add('hidden'); pause.classList.add('hidden'); hud.style.display='block';
  renderer.domElement.requestPointerLock();
}
startBtn.onclick=startGame;
resumeBtn.onclick=startGame;
restartBtn.onclick=()=>{health=100;armor=100;money=800;kills=0;resetAmmo();camera.position.set(0,1.7,12);camera.rotation.set(0,0,0);spawnWave();updateHud();startGame()};
document.addEventListener('pointerlockchange',()=>{
  locked=document.pointerLockElement===renderer.domElement;
  if(!locked && menu.classList.contains('hidden') && health>0){pause.classList.remove('hidden')}
});
document.addEventListener('mousemove',e=>{
  if(!locked)return;
  camera.rotation.order='YXZ';
  camera.rotation.y-=e.movementX*.0022;
  camera.rotation.x-=e.movementY*.0022;
  camera.rotation.x=Math.max(-1.48,Math.min(1.48,camera.rotation.x));
});
document.addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.repeat)return;
  if(e.code==='KeyR') reload();
  if(e.code==='Digit1') switchWeapon(0);
  if(e.code==='Digit2') switchWeapon(1);
  if(e.code==='Digit3') switchWeapon(2);
  if(e.code==='Digit4') switchWeapon(3);
});
document.addEventListener('keyup',e=>keys[e.code]=false);
document.addEventListener('mousedown',e=>{if(e.button===0 && locked){firing=true;shoot()}});
document.addEventListener('mouseup',e=>{if(e.button===0)firing=false});
function switchWeapon(i){if(i<0||i>=weapons.length)return;weaponIndex=i;reloading=false;buildGun();updateHud()}
function reload(){
  if(reloading||reserve[weaponIndex]<=0||ammo[weaponIndex]===weapons[weaponIndex].mag)return;
  reloading=true;reloadEnd=performance.now()+weapons[weaponIndex].reload;updateHud();
}
function shoot(){
  const now=performance.now(),w=weapons[weaponIndex];
  if(!locked||reloading||now-lastShot<w.rate||health<=0)return;
  lastShot=now;
  if(ammo[weaponIndex]<=0){showToast('OUT OF AMMO — PRESS R');return}
  ammo[weaponIndex]--;
  recoil=Math.min(recoil+.035,.12);
  gun.position.z=.08;setTimeout(()=>gun.position.z=0,55);
  const spread=w.spread;
  raycaster.setFromCamera(new THREE.Vector2((Math.random()-.5)*spread,(Math.random()-.5)*spread),camera);
  const targets=[];
  bots.filter(b=>b.alive).forEach(b=>b.group.traverse(o=>{if(o.isMesh)targets.push({mesh:o,bot:b})}));
  const hits=raycaster.intersectObjects(targets.map(t=>t.mesh),false);
  if(hits.length){
    const target=targets.find(t=>t.mesh===hits[0].object);
    if(target){
      target.bot.hp-=w.damage;
      el('hitmarker').style.opacity='1';setTimeout(()=>el('hitmarker').style.opacity='0',90);
      if(target.bot.hp<=0){target.bot.alive=false;scene.remove(target.bot.group);kills++;money+=300;showToast('BOT ELIMINATED  +$300');updateBots()}
    }
  }
  updateHud();
}
function hurtBotPlayer(){
  if(health<=0)return;
  const reduction=Math.min(armor,8);armor-=reduction;
  health-=Math.max(1,9-reduction*.55);
  if(health<=0){health=0;document.exitPointerLock();showToast('YOU WERE ELIMINATED')}
  updateHud();
}
function collides(x,z){
  const r=.42;
  if(Math.abs(x)>33.8||Math.abs(z)>25.8)return true;
  return colliders.some(c=>Math.abs(x-c.x)<c.hx+r && Math.abs(z-c.z)<c.hz+r);
}
function movePlayer(dt){
  if(!locked||health<=0)return;
  const forward=new THREE.Vector3(-Math.sin(camera.rotation.y),0,-Math.cos(camera.rotation.y));
  const right=new THREE.Vector3(Math.cos(camera.rotation.y),0,-Math.sin(camera.rotation.y));
  const dir=new THREE.Vector3();
  if(keys.KeyW)dir.add(forward);if(keys.KeyS)dir.sub(forward);if(keys.KeyD)dir.add(right);if(keys.KeyA)dir.sub(right);
  if(dir.lengthSq()>0)dir.normalize();
  const speed=keys.ShiftLeft?7.2:5.2;
  const nx=camera.position.x+dir.x*speed*dt,nz=camera.position.z+dir.z*speed*dt;
  if(!collides(nx,camera.position.z))camera.position.x=nx;
  if(!collides(camera.position.x,nz))camera.position.z=nz;
  camera.position.y=1.7+(keys.Space?0:0);
}
function updateBotAI(dt){
  if(!locked||health<=0)return;
  for(const b of bots){
    if(!b.alive)continue;
    const dx=camera.position.x-b.group.position.x,dz=camera.position.z-b.group.position.z;
    const dist=Math.hypot(dx,dz);
    b.group.rotation.y=Math.atan2(dx,dz);
    b.walk+=dt;
    if(dist>7){
      const step=Math.min(dt*1.25,dist-6);
      const nx=b.group.position.x+dx/dist*step,nz=b.group.position.z+dz/dist*step;
      if(!collides(nx,nz)){b.group.position.x=nx;b.group.position.z=nz}
    }else{
      b.attack-=dt;
      if(b.attack<=0){b.attack=1.15+Math.random()*.7;hurtBotPlayer()}
    }
  }
}
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.04);
  movePlayer(dt);updateBotAI(dt);
  if(reloading&&performance.now()>=reloadEnd){
    const need=weapons[weaponIndex].mag-ammo[weaponIndex],take=Math.min(need,reserve[weaponIndex]);
    ammo[weaponIndex]+=take;reserve[weaponIndex]-=take;reloading=false;updateHud();
  }
  if(firing&&locked&&performance.now()-lastShot>weapons[weaponIndex].rate)shoot();
  if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)el('toast').textContent=''}
  recoil=Math.max(0,recoil-dt*.18);
  gun.position.y=Math.sin(performance.now()*.004)*.004;
  renderer.render(scene,camera);
}
animate();
window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
});
updateHud();
