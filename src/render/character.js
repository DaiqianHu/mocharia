/* ============================================================
   Customer figures — 2D hand-drawn people composited into the 3D
   scene as flat sprite billboards. Each customer's polished 2D art
   (Customer.drawFigure) is painted every frame onto an offscreen
   canvas, uploaded as a THREE.CanvasTexture, and shown on a plane
   placed at the customer's virtual position and z (behind the front
   counter, so the counter still occludes their lower bodies).

   This deliberately replaces the old procedural SkinnedMesh rig: the
   playtester wanted customers that read as flat, cartoony humans
   rather than low-poly 3D figures.
   ============================================================ */
import * as THREE from 'three';

// Sprite canvas / plane size in virtual pixels (== world units at z≈0).
// The figure spans roughly y -78..+70 and x ±26 around its origin; the
// canvas is sized with margin and the origin parked low so the feet sit
// near the bottom.
const SPR_W = 150, SPR_H = 200, ORIGIN_Y = 128, SS = 2;

/* Create a sprite rig for one customer: an offscreen canvas + CanvasTexture
   on a camera-facing plane, wrapped in a group placed at the customer's
   position. The mesh is nudged up so the figure origin lands on the group
   origin (== the customer's x/y). */
export function makeCustomerRig(cust){
  const canvas = document.createElement('canvas');
  canvas.width = SPR_W*SS; canvas.height = SPR_H*SS;
  const cctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(SPR_W, SPR_H),
    new THREE.MeshBasicMaterial({
      map: texture, transparent: true, alphaTest: 0.02,
      depthWrite: false, toneMapped: false,
    })
  );
  // canvas origin (SPR_W/2, ORIGIN_Y) sits ORIGIN_Y-SPR_H/2 below the plane
  // centre; raise the mesh by that so the figure origin == group origin.
  mesh.position.y = ORIGIN_Y - SPR_H/2;

  const group = new THREE.Group();
  group.add(mesh);
  group.userData.custId = cust.id;
  return { group, mesh, canvas, cctx, texture };
}

/* Repaint the customer onto its sprite canvas for this frame. */
export function updateCustomerRig(rig, cust, t){
  const cx = rig.cctx;
  cx.setTransform(SS,0,0,SS,0,0);
  cx.clearRect(0,0,SPR_W,SPR_H);
  cx.translate(SPR_W/2, ORIGIN_Y);
  cust.drawFigure(cx, t);
  rig.texture.needsUpdate = true;
}
