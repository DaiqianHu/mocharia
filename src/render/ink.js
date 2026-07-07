/* ============================================================
   Ink outline post pass — the "drawn" half of the cartoon look
   (toon materials give the flat colour bands; this gives the
   cartoonist's pen). Hand-rolled instead of EffectComposer:

     pass 1  scene -> mainRT   (toon colours + depth texture)
     pass 2  scene -> normalRT (MeshNormalMaterial override)
     pass 3  fullscreen quad -> canvas: Sobel-ish edge detect on
             depth (silhouettes) + normals (creases), composited
             as dark ink over the colour buffer.

   Colliders (invisible-material raycast proxies) and anything
   flagged userData.noInk are hidden during the normal pass so
   they don't leave phantom outlines. Depth edges use view-space
   Z with a depth-scaled threshold so far geometry doesn't turn
   into solid scribble.
   ============================================================ */
import * as THREE from 'three';
import { renderer } from './three.js';

const INK = '#241408';           // warm near-black, matches the 2D HUD ink

let mainRT = null, normalRT = null;

const normalOverride = new THREE.MeshNormalMaterial();

const edgeMat = new THREE.ShaderMaterial({
  uniforms: {
    tColor:  { value: null },
    tDepth:  { value: null },
    tNormal: { value: null },
    texel:   { value: new THREE.Vector2(1/960, 1/600) },
    cameraNear: { value: 10 },
    cameraFar:  { value: 3200 },
    inkColor: { value: new THREE.Color(INK) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tColor, tDepth, tNormal;
    uniform vec2 texel;
    uniform float cameraNear, cameraFar;
    uniform vec3 inkColor;
    varying vec2 vUv;
    #include <packing>

    float viewZ(vec2 uv){
      float d = texture2D(tDepth, uv).x;
      return -perspectiveDepthToViewZ(d, cameraNear, cameraFar);
    }
    vec3 nrm(vec2 uv){ return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }

    void main(){
      vec3 col = texture2D(tColor, vUv).rgb;
      vec2 dx = vec2(texel.x, 0.0), dy = vec2(0.0, texel.y);

      // silhouettes: view-space depth Laplacian, threshold grows with
      // distance so oblique floors/walls don't ink over
      float z0 = viewZ(vUv);
      float dz = abs(viewZ(vUv+dx) + viewZ(vUv-dx) + viewZ(vUv+dy) + viewZ(vUv-dy) - 4.0*z0);
      float depthEdge = smoothstep(1.0, 2.4, dz / (1.0 + z0 * 0.012));

      // creases: normal discontinuity
      vec3 n0 = nrm(vUv);
      float nd = 0.0;
      nd = max(nd, 1.0 - dot(n0, nrm(vUv+dx)));
      nd = max(nd, 1.0 - dot(n0, nrm(vUv-dx)));
      nd = max(nd, 1.0 - dot(n0, nrm(vUv+dy)));
      nd = max(nd, 1.0 - dot(n0, nrm(vUv-dy)));
      float normalEdge = smoothstep(0.28, 0.55, nd);

      float ink = max(depthEdge, normalEdge * 0.8);
      gl_FragColor = vec4(mix(col, inkColor, ink * 0.85), 1.0);
      #include <colorspace_fragment>
    }
  `,
  depthTest: false,
  depthWrite: false,
});

const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadScene = new THREE.Scene();
quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), edgeMat));

function ensureTargets(){
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  if (mainRT && mainRT.width === size.x && mainRT.height === size.y) return;
  if (mainRT){ mainRT.dispose(); normalRT.dispose(); }
  const depthTexture = new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType);
  mainRT = new THREE.WebGLRenderTarget(size.x, size.y, {
    depthTexture, samples: 4,
  });
  normalRT = new THREE.WebGLRenderTarget(size.x, size.y);
  edgeMat.uniforms.tColor.value  = mainRT.texture;
  edgeMat.uniforms.tDepth.value  = depthTexture;
  edgeMat.uniforms.tNormal.value = normalRT.texture;
  edgeMat.uniforms.texel.value.set(1/size.x, 1/size.y);
}

/* hide raycast proxies + noInk objects for the normal pass (their
   invisible materials are bypassed by scene.overrideMaterial) */
const _hidden = [];
function hideNonInk(scene){
  scene.traverse(o => {
    if (!o.visible) return;
    if ((o.isMesh && o.material && o.material.visible === false) || o.userData.noInk){
      o.visible = false;
      _hidden.push(o);
    }
  });
}
function restoreNonInk(){
  for (const o of _hidden) o.visible = true;
  _hidden.length = 0;
}

export function renderInk(scene, camera){
  ensureTargets();
  edgeMat.uniforms.cameraNear.value = camera.near;
  edgeMat.uniforms.cameraFar.value  = camera.far;

  renderer.setRenderTarget(mainRT);
  renderer.render(scene, camera);

  hideNonInk(scene);
  scene.overrideMaterial = normalOverride;
  renderer.setRenderTarget(normalRT);
  renderer.render(scene, camera);
  scene.overrideMaterial = null;
  restoreNonInk();

  renderer.setRenderTarget(null);
  renderer.render(quadScene, quadCam);
}
