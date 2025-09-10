import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";

/* ===== Renderer / Scene / Camera ===== */
const container = document.getElementById("app");
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  innerWidth / innerHeight,
  0.1,
  2000
);
camera.position.set(0, 2.2, 8);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxDistance = 30;
controls.minDistance = 3;

/* ===== Lights ===== */
const hemi = new THREE.HemisphereLight(0xaecbff, 0x0a1120, 0.6);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(5, 7, 3);
scene.add(dir);

/* ===== Nebula Skydome (ShaderMaterial) ===== */
const nebulaMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color("#101b36") },
    uColorB: { value: new THREE.Color("#060a16") },
    uSpark: { value: new THREE.Color("#60a5fa") },
  },
  vertexShader: `varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    precision highp float; varying vec3 vPos; uniform float uTime; uniform vec3 uColorA,uColorB,uSpark;
    float hash(vec3 p){ p=fract(p*0.3183099+vec3(0.1,0.2,0.3)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float noise(vec3 p){ vec3 i=floor(p), f=fract(p); float n=0.0;
      for(int x=0;x<2;x++)for(int y=0;y<2;y++)for(int z=0;z<2;z++){ vec3 g=vec3(x,y,z); float h=hash(i+g); n+=mix(0.0,1.0,h)*(1.0-length(f-g)); }
      return n;
    }
    void main(){
      vec3 p=normalize(vPos);
      float n=noise(p*3.0 + uTime*0.03);
      float m=smoothstep(0.2,0.9,n);
      vec3 col=mix(uColorB,uColorA,m);
      float sp=step(0.997, hash(p*50.0 + uTime));
      col += uSpark * sp * 0.8;
      gl_FragColor=vec4(col,1.0);
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 64, 64), nebulaMat);
scene.add(sky);

/* ===== Portal (custom shader plane) ===== */
const portalUniforms = {
  uTime: { value: 0 },
  uPulse: { value: 0 },
  uMouse: { value: new THREE.Vector2(0, 0) },
};
const portal = new THREE.Mesh(
  new THREE.PlaneGeometry(6, 6, 1, 1),
  new THREE.ShaderMaterial({
    uniforms: portalUniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      precision highp float; varying vec2 vUv; uniform float uTime,uPulse; uniform vec2 uMouse;
      vec2 swirl(vec2 p, float s){ float r=length(p); float a=atan(p.y,p.x)+s*(1.0/(r+0.4)); return vec2(cos(a),sin(a))*r; }
      float circle(vec2 p,float r,float b){ return smoothstep(r, r-b, length(p)); }
      void main(){
        vec2 uv=vUv*2.0-1.0;
        uv.x *= 1.0 + 0.1*sin(uTime*0.8);
        uv.y *= 1.0 + 0.1*cos(uTime*0.7);
        vec2 m=(uMouse-0.5)*2.0;
        vec2 f=swirl(uv + m*0.08, 2.2 + 0.7*sin(uTime*0.6));
        float core=circle(f, 0.12 + 0.03*sin(uTime*2.0) + uPulse*0.04, 0.06);
        float ring1=circle(f, 0.36 + 0.02*sin(uTime), 0.06);
        float ring2=circle(f, 0.66 + 0.02*cos(uTime*0.8), 0.08);
        vec3 c=vec3(0.0);
        c+=vec3(0.38,0.73,0.98)*core*1.4;
        c+=vec3(0.42,0.92,0.71)*ring1*0.9;
        c+=vec3(0.65,0.53,0.96)*ring2*0.6;
        float fog=smoothstep(1.2,0.1,length(uv));
        c*=fog;
        gl_FragColor=vec4(c,fog);
      }`,
  })
);
portal.position.set(0, 1.2, 0);
scene.add(portal);
/* ===== Starfield (points) ===== */
const STAR_COUNT = 12000;
const starGeo = new THREE.BufferGeometry();
const posArr = new Float32Array(STAR_COUNT * 3);

for (let i = 0; i < STAR_COUNT; i++) {
  const r = THREE.MathUtils.randFloat(20, 480);
  const phi = Math.random() * Math.PI * 2;

  // [-1, 1] 범위의 cos(theta)
  const cost = THREE.MathUtils.randFloatSpread(2); // ✅ 여기서 -1 하지 않음
  const sintSq = Math.max(0, 1 - cost * cost); // 부동소수점 보호
  const sint = Math.sqrt(sintSq);

  posArr[i * 3 + 0] = r * Math.cos(phi) * sint;
  posArr[i * 3 + 1] = r * cost * 0.6; // 살짝 납작하게
  posArr[i * 3 + 2] = r * Math.sin(phi) * sint;
}

starGeo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
const starMat = new THREE.PointsMaterial({
  size: 0.02,
  color: 0xffffff,
  transparent: true,
  opacity: 0.9,
});
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

/* ===== TorusKnot prism ===== */
const knot = new THREE.Mesh(
  new THREE.TorusKnotGeometry(0.9, 0.26, 220, 28, 2, 3),
  new THREE.MeshPhysicalMaterial({
    color: "#9aa8ff",
    metalness: 0.9,
    roughness: 0.15,
    transmission: 0.02,
    thickness: 0.6,
    reflectivity: 0.9,
    ior: 1.4,
    clearcoat: 0.9,
    clearcoatRoughness: 0.2,
  })
);
knot.position.set(0, 1.2, -0.2);
scene.add(knot);

/* ===== Instanced cube wave field ===== */
const COUNT = 36,
  spacing = 0.35;
const instGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
const instMat = new THREE.MeshStandardMaterial({
  color: "#60e0c0",
  metalness: 0.6,
  roughness: 0.35,
});
const inst = new THREE.InstancedMesh(instGeo, instMat, COUNT * COUNT);
inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
inst.position.set(0, -1.2, 0);
scene.add(inst);

/* ===== Post Processing ===== */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  0.8,
  0.8,
  0.85
);
composer.addPass(bloom);
const RGBShiftShader = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 0.0018 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tDiffuse; uniform float amount;
    void main(){
      vec2 off=vec2(amount,0.0); vec4 c=texture2D(tDiffuse,vUv);
      float r=texture2D(tDiffuse,vUv+off).r; float b=texture2D(tDiffuse,vUv-off).b;
      gl_FragColor=vec4(r,c.g,b,1.0);
    }`,
};
composer.addPass(new ShaderPass(RGBShiftShader));
composer.addPass(new AfterimagePass(0.92));

/* ===== Interaction ===== */
const mouse = new THREE.Vector2(0.5, 0.5);
renderer.domElement.addEventListener("pointermove", (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = (e.clientX - rect.left) / rect.width;
  mouse.y = (e.clientY - rect.top) / rect.height;
  portalUniforms.uMouse.value.set(mouse.x, mouse.y);
});
let scrollPulse = 0;
addEventListener("scroll", () => {
  scrollPulse = Math.min(1, scrollPulse + 0.35);
});

/* ===== Resize ===== */
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
});

/* ===== Animate ===== */
const dummy = new THREE.Object3D();
let t = 0;
function animate(ms) {
  const dt = Math.min(0.033, (ms - t) / 1000 || 0.016);
  t = ms;

  nebulaMat.uniforms.uTime.value = ms * 0.001;
  portalUniforms.uTime.value = ms * 0.001;
  portalUniforms.uPulse.value = scrollPulse;
  scrollPulse *= 0.94;

  stars.rotation.y += 0.002 * dt * 60;
  knot.rotation.y += 0.25 * dt * 2.0;
  knot.rotation.x = Math.sin(ms * 0.0006) * 0.25;

  let id = 0;
  const mx = (mouse.x - 0.5) * Math.PI * 2.0;
  const my = (mouse.y - 0.5) * Math.PI * 2.0;
  for (let i = 0; i < COUNT; i++) {
    for (let j = 0; j < COUNT; j++) {
      const x = (i - COUNT / 2) * spacing;
      const z = (j - COUNT / 2) * spacing;
      const d = Math.sqrt(x * x + z * z);
      const h =
        Math.sin(d * 3.0 - ms * 0.002 + mx * 0.5) * 0.35 +
        Math.cos(z * 2.0 + ms * 0.0016 + my * 0.5) * 0.12;
      dummy.position.set(x, h, z);
      dummy.rotation.y = x * 2.5 + z * 2.5 + ms * 0.0006;
      dummy.scale.setScalar(
        THREE.MathUtils.lerp(
          0.9,
          1.25,
          (Math.sin(d * 4.0 - ms * 0.001) + 1.0) / 2.0
        )
      );
      dummy.updateMatrix();
      inst.setMatrixAt(id++, dummy.matrix);
    }
  }
  inst.instanceMatrix.needsUpdate = true;

  controls.update();
  composer.render();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
