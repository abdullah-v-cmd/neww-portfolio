import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

interface HeroCanvas3DProps {
  enabled: boolean;
  accentColor?: string;
}

const _targetMouse = new THREE.Vector2(0, 0);
const _currentMouse = new THREE.Vector2(0, 0);

export function HeroCanvas3D({ enabled, accentColor = '#dc2626' }: HeroCanvas3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!enabled || !container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // Detect software WebGL cleanly via renderer string (avoid heavy CPU PMREM shaders)
    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    if (isSoftwareGl) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07080b, 0.048);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 11.5);

    // 3-point atmospheric studio rig
    const keyLight = new THREE.DirectionalLight(0xf8fafc, 2.2);
    keyLight.position.set(5, 6, 7);
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0x94a3b8, 0x090b10, 0.8);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(new THREE.Color(accentColor), 1.8);
    rimLight.position.set(-6, -2, -4);
    scene.add(rimLight);

    // Composite architectural centerpiece group (multi-part precision rings + brushed obsidian lattice)
    const sculptureGroup = new THREE.Group();
    sculptureGroup.position.set(2.4, 0, -1.2);
    scene.add(sculptureGroup);

    const darkMetal = new THREE.MeshPhysicalMaterial({
      color: 0x161922,
      metalness: 0.92,
      roughness: 0.24,
      clearcoat: 0.4,
    });
    const accentMetal = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(accentColor),
      metalness: 0.78,
      roughness: 0.3,
      emissive: new THREE.Color(accentColor),
      emissiveIntensity: 0.15,
    });
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x334155,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });

    const outerRingGeo = new THREE.TorusGeometry(2.55, 0.035, 16, 72);
    const outerRing = new THREE.Mesh(outerRingGeo, darkMetal);
    outerRing.rotation.x = Math.PI * 0.28;
    sculptureGroup.add(outerRing);

    const innerRingGeo = new THREE.TorusGeometry(1.85, 0.022, 14, 64);
    const innerRing = new THREE.Mesh(innerRingGeo, accentMetal);
    innerRing.rotation.y = Math.PI * 0.35;
    sculptureGroup.add(innerRing);

    const coreIcoGeo = new THREE.IcosahedronGeometry(1.15, 1);
    const coreSolid = new THREE.Mesh(coreIcoGeo, darkMetal);
    const coreWire = new THREE.Mesh(coreIcoGeo, wireMat);
    coreWire.scale.setScalar(1.06);
    sculptureGroup.add(coreSolid, coreWire);

    // Instanced ambient spatial nodes
    const nodeCount = 72;
    const nodeGeo = new THREE.OctahedronGeometry(0.045, 0);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.6,
      roughness: 0.35,
    });
    const nodes = new THREE.InstancedMesh(nodeGeo, nodeMat, nodeCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < nodeCount; i++) {
      const angle = (i / nodeCount) * Math.PI * 6;
      const radius = 3.2 + (i % 7) * 0.72;
      dummy.position.set(
        Math.cos(angle) * radius - 1.5,
        ((i % 11) - 5) * 0.75,
        Math.sin(angle) * radius - 4.0
      );
      const s = 0.65 + (i % 4) * 0.22;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      nodes.setMatrixAt(i, dummy.matrix);
    }
    nodes.computeBoundingSphere();
    scene.add(nodes);

    const onPointerMove = (e: PointerEvent) => {
      _targetMouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      _targetMouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      _currentMouse.x = THREE.MathUtils.damp(_currentMouse.x, _targetMouse.x, 4, dt);
      _currentMouse.y = THREE.MathUtils.damp(_currentMouse.y, _targetMouse.y, 4, dt);

      sculptureGroup.rotation.y = elapsed * 0.14 + _currentMouse.x * 0.25;
      sculptureGroup.rotation.x = Math.sin(elapsed * 0.2) * 0.08 + _currentMouse.y * 0.14;
      outerRing.rotation.z = elapsed * 0.18;
      innerRing.rotation.x = -elapsed * 0.22;
      nodes.rotation.y = elapsed * 0.03;

      camera.position.x = THREE.MathUtils.damp(camera.position.x, _currentMouse.x * 0.45, 3, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.4 + _currentMouse.y * 0.3, 3, dt);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);

      outerRingGeo.dispose();
      innerRingGeo.dispose();
      coreIcoGeo.dispose();
      nodeGeo.dispose();
      darkMetal.dispose();
      accentMetal.dispose();
      wireMat.dispose();
      nodeMat.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [enabled, accentColor]);

  if (!enabled) return null;

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden opacity-80"
    />
  );
}
