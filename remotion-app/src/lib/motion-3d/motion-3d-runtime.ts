import gsap from "gsap";
import * as THREE from "three";
import type {
  Motion3DLayerSpec,
  Motion3DSceneSpec
} from "../types";
import type {Motion3DConfig} from "./motion-3d-config";
import {createTextTexture, loadTexture} from "./motion-3d-texture";

export type Motion3DSceneRuntime = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  timeline: gsap.core.Timeline;
  layers: Map<string, THREE.Mesh>;
  dispose: () => void;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const resolveCameraZ = ({
  height,
  fov
}: {
  height: number;
  fov: number;
}): number => {
  const fovRad = (fov * Math.PI) / 180;
  return (height / 2) / Math.tan(fovRad / 2);
};

const buildMesh = ({
  layer,
  texture
}: {
  layer: Motion3DLayerSpec;
  texture: THREE.Texture;
}): THREE.Mesh => {
  const geometry = new THREE.PlaneGeometry(layer.width, layer.height);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: layer.opacity,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(layer.x, -layer.y, layer.z);
  mesh.scale.setScalar(layer.scale);
  mesh.rotation.z = layer.rotateZ;
  mesh.renderOrder = Math.round(1000 + layer.z);
  mesh.userData.basePosition = mesh.position.clone();
  mesh.userData.baseScale = layer.scale;
  mesh.userData.baseRotationZ = layer.rotateZ;
  mesh.userData.baseOpacity = layer.opacity;
  return mesh;
};

const buildTimeline = ({
  sceneSpec,
  camera,
  layers,
  config
}: {
  sceneSpec: Motion3DSceneSpec;
  camera: THREE.PerspectiveCamera;
  layers: Map<string, THREE.Mesh>;
  config: Motion3DConfig;
}): gsap.core.Timeline => {
  const durationSec = Math.max(0.4, (sceneSpec.endMs - sceneSpec.startMs) / 1000);
  const intro = Math.min(config.timing.introSec, durationSec * 0.35);
  const hold = Math.min(config.timing.holdSec, durationSec * 0.4);
  const exit = Math.max(0.2, Math.min(config.timing.exitSec, durationSec * 0.25));
  const total = intro + hold + exit;
  const timeline = gsap.timeline({paused: true});

  const targetLayer = sceneSpec.focusLayerId ? layers.get(sceneSpec.focusLayerId) : undefined;
  const focusZ = targetLayer?.position.z ?? 0;
  const baseZ = camera.position.z;

  const pushDistance = clamp(config.camera.maxPushZ, 40, 400);
  const pullDistance = clamp(config.camera.maxPullZ, 60, 480);
  const panX = clamp(config.camera.maxPanX * 0.55, -config.camera.maxPanX, config.camera.maxPanX);
  const panY = clamp(config.camera.maxPanY * 0.4, -config.camera.maxPanY, config.camera.maxPanY);

  if (sceneSpec.cameraPreset === "subtlePullBack") {
    timeline.to(camera.position, {z: baseZ + pullDistance, duration: intro, ease: "power2.out"}, 0);
  } else if (sceneSpec.cameraPreset === "comparisonPan") {
    timeline.to(camera.position, {x: panX, duration: intro, ease: "power2.out"}, 0);
    timeline.to(camera.position, {x: -panX, duration: hold, ease: "power2.inOut"}, intro);
  } else if (sceneSpec.cameraPreset === "quoteRevealCameraEase") {
    timeline.to(camera.position, {x: panX * 0.42, y: -panY * 0.28, duration: intro, ease: "sine.out"}, 0);
    timeline.to(camera.position, {x: panX * 0.14, y: panY * 0.18, duration: hold, ease: "sine.inOut"}, intro);
  } else if (sceneSpec.cameraPreset === "cardDepthSlide") {
    timeline.to(camera.position, {x: panX * 0.26, z: baseZ - pushDistance * 0.36, duration: intro, ease: "power2.out"}, 0);
    timeline.to(camera.position, {x: -panX * 0.14, duration: hold, ease: "power2.inOut"}, intro);
  } else if (sceneSpec.cameraPreset === "parallaxHold") {
    timeline.to(camera.position, {z: baseZ - pushDistance * 0.22, duration: intro, ease: "sine.out"}, 0);
  } else if (sceneSpec.cameraPreset === "focusDriftLeft") {
    timeline.to(camera.position, {x: -panX, y: panY * 0.4, duration: intro, ease: "power2.out"}, 0);
  } else if (sceneSpec.cameraPreset === "focusDriftRight") {
    timeline.to(camera.position, {x: panX, y: -panY * 0.4, duration: intro, ease: "power2.out"}, 0);
  } else if (sceneSpec.cameraPreset === "gentleOrbit") {
    timeline.to(camera.rotation, {z: THREE.MathUtils.degToRad(config.camera.maxOrbitDeg), duration: intro, ease: "sine.out"}, 0);
    timeline.to(camera.rotation, {z: -THREE.MathUtils.degToRad(config.camera.maxOrbitDeg), duration: hold, ease: "sine.inOut"}, intro);
  } else if (sceneSpec.cameraPreset === "heroLayerPush") {
    timeline.to(camera.position, {z: baseZ - pushDistance, duration: intro, ease: "power2.out"}, 0);
  } else {
    timeline.to(camera.position, {z: baseZ - pushDistance * 0.7, duration: intro, ease: "power2.out"}, 0);
  }

  layers.forEach((layer) => {
    const startZ = layer.position.z;
    const offset = (layer.userData.parallax ?? 0) as number;
    const driftX = panX * offset;
    const driftY = panY * offset;
    timeline.fromTo(
      layer.position,
      {x: layer.position.x - driftX * 0.6, y: layer.position.y + driftY * 0.6, z: startZ},
      {x: layer.position.x + driftX * 0.4, y: layer.position.y - driftY * 0.4, z: startZ, duration: total, ease: "sine.inOut"},
      0
    );
    timeline.fromTo(
      layer.material as THREE.MeshBasicMaterial,
      {opacity: 0},
      {opacity: (layer.material as THREE.MeshBasicMaterial).opacity, duration: intro * 0.8, ease: "power2.out"},
      0
    );
  });

  if (focusZ !== 0) {
    timeline.to(camera.position, {z: baseZ - focusZ * 0.08, duration: intro, ease: "power2.out"}, 0);
  }

  timeline.to(camera.position, {z: baseZ, x: 0, y: 0, duration: exit, ease: "power2.inOut"}, total - exit);
  timeline.to(camera.rotation, {z: 0, duration: exit, ease: "sine.inOut"}, total - exit);

  return timeline;
};

export const buildMotion3DSceneRuntime = async ({
  canvas,
  sceneSpec,
  config,
  size
}: {
  canvas: HTMLCanvasElement;
  sceneSpec: Motion3DSceneSpec;
  config: Motion3DConfig;
  size: {width: number; height: number};
}): Promise<Motion3DSceneRuntime> => {
  const scene = new THREE.Scene();
  const cameraZ = resolveCameraZ({height: size.height, fov: config.camera.fov});
  const camera = new THREE.PerspectiveCamera(config.camera.fov, size.width / size.height, 1, 5000);
  camera.position.set(0, 0, cameraZ);
  camera.userData.basePosition = camera.position.clone();
  camera.userData.baseRotationZ = camera.rotation.z;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    premultipliedAlpha: false
  });
  renderer.setSize(size.width, size.height, false);
  renderer.setPixelRatio(1);

  const layers = new Map<string, THREE.Mesh>();
  const texturePromises = sceneSpec.layers.map(async (layer) => {
    if (layer.text) {
      return createTextTexture({
        text: layer.text,
        width: layer.width,
        height: layer.height
      });
    }
    if (layer.src) {
      return loadTexture(layer.src.startsWith("/") ? layer.src : `/${layer.src}`);
    }
    const texture = new THREE.Texture();
    texture.needsUpdate = true;
    return texture;
  });
  const textures = await Promise.all(texturePromises);

  sceneSpec.layers.forEach((layer, index) => {
    const texture = textures[index];
    const mesh = buildMesh({layer, texture});
    mesh.userData.parallax = layer.parallax;
    layers.set(layer.id, mesh);
    scene.add(mesh);
  });

  const timeline = buildTimeline({sceneSpec, camera, layers, config});

  return {
    scene,
    camera,
    renderer,
    timeline,
    layers,
    dispose: () => {
      timeline.kill();
      layers.forEach((mesh) => {
        mesh.geometry.dispose();
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.map?.dispose();
        material.dispose();
      });
      renderer.dispose();
    }
  };
};
