import {
  BufferGeometry, CanvasTexture, Group, Line, LineBasicMaterial, OrthographicCamera,
  Scene, Sprite, SpriteMaterial, Vector3, WebGLRenderer,
} from 'three';

const mobile = matchMedia('(max-width: 680px) and (orientation: portrait)');
const tau = Math.PI * 2;

function boxAt(network, element) {
  const base = network.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  return { x: rect.left - base.left, y: rect.top - base.top, width: rect.width, height: rect.height };
}

function edge(box, side) {
  const horizontal = side === 'left' || side === 'right';
  return horizontal
    ? { x: box.x + (side === 'right' ? box.width : 0), y: box.y + box.height / 2 }
    : { x: box.x + box.width / 2, y: box.y + (side === 'bottom' ? box.height : 0) };
}

function bezier(start, end, vertical) {
  const midpointX = (end.x + start.x) * .5;
  const midpointY = (end.y + start.y) * .5;
  const a = vertical ? { x: start.x, y: midpointY } : { x: midpointX, y: start.y };
  const b = vertical ? { x: end.x, y: midpointY } : { x: midpointX, y: end.y };

  return Array.from({ length: 75 }, (_, i) => {
    const t = i / 74;
    const k = 1 - t;
    return {
      x: k ** 3 * start.x + 3 * k ** 2 * t * a.x + 3 * k * t ** 2 * b.x + t ** 3 * end.x,
      y: k ** 3 * start.y + 3 * k ** 2 * t * a.y + 3 * k * t ** 2 * b.y + t ** 3 * end.y,
      z: 5 + Math.sin(t * Math.PI) * 12,
    };
  });
}

function layouts(network, center, nodes, leaves) {
  const vertical = mobile.matches;
  const startSide = vertical ? 'bottom' : 'right';
  const endSide = vertical ? 'top' : 'left';
  const root = boxAt(network, center);
  const start = edge(root, startSide);
  const paths = nodes.map((node, branch) => ({
    branch,
    color: getComputedStyle(node).getPropertyValue('--branch-color').trim(),
    points: bezier(start, edge(boxAt(network, node), endSide), vertical),
  }));
  leaves.forEach((group, branch) => {
    if (group.hidden) return;
    const origin = edge(boxAt(network, nodes[branch]), startSide);
    for (const leaf of group.querySelectorAll('.leaf')) {
      paths.push({ branch, color: paths[branch].color, points: bezier(origin, edge(boxAt(network, leaf), endSide), vertical) });
    }
  });

  const centerX = root.x + root.width * .5;
  const centerY = root.y + root.height * .5;
  const ripples = Array.from({ length: 12 }, (_, ring) => {
    const radius = root.width * (.50 + ring * .13);
    return Array.from({ length: 101 }, (_, i) => {
      const angle = i / 100 * tau;
      const perturbed = radius * (1 + .075 * Math.sin(angle * 3 + ring * .28));
      return {
        x: Math.cos(angle) * perturbed,
        y: Math.sin(angle) * perturbed * .73 - Math.cos(angle) * perturbed * .17,
        z: Math.sin(angle * 2 + ring * .28) * 18 - 35,
      };
    });
  });
  return { width: network.clientWidth, height: network.clientHeight, centerX, centerY, paths, ripples };
}

function pointOn(points, time, index) {
  const place = ((time / 2100 + index * .192) % 1) * (points.length - 1);
  const lower = Math.floor(place);
  const upper = Math.min(points.length - 1, lower + 1);
  const a = points[lower];
  const b = points[upper];
  const t = place - lower;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function lightTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const light = context.createRadialGradient(32, 32, 1, 32, 32, 32);
  light.addColorStop(0, '#fff');
  light.addColorStop(.16, '#fffd');
  light.addColorStop(.28, '#fff8');
  light.addColorStop(1, '#fff0');
  context.fillStyle = light;
  context.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}

function make3D(canvas) {
  const options = { alpha: true, antialias: true, powerPreference: 'low-power' };
  const context = canvas.getContext('webgl2', options);
  if (!context) return undefined;

  const renderer = new WebGLRenderer({ canvas, context, ...options });
  renderer.setClearColor(0, 0);
  const scene = new Scene();
  const camera = new OrthographicCamera(0, 1, 0, -1, 1, 400);
  camera.position.z = 140;
  const ripples = new Group();
  const routes = new Group();
  const orbs = new Group();
  scene.add(ripples, routes, orbs);
  const texture = lightTexture();
  let lines = [];
  let lights = [];
  let bridge;

  function trace(group, points, color, opacity) {
    const line = new Line(
      new BufferGeometry().setFromPoints(points.map(({ x, y, z }) => new Vector3(x, -y, z))),
      new LineBasicMaterial({ color, opacity, transparent: true, depthWrite: false }),
    );
    group.add(line);
    return line;
  }

  function clear(group) {
    for (const item of [...group.children]) {
      if (item.isLine) item.geometry.dispose();
      item.material.dispose();
      group.remove(item);
    }
  }

  return {
    resize(layout) {
      bridge = layout;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
      renderer.setSize(layout.width, layout.height, false);
      camera.right = layout.width;
      camera.bottom = -layout.height;
      camera.updateProjectionMatrix();
      clear(ripples);
      clear(routes);
      clear(orbs);
      ripples.position.set(layout.centerX, -layout.centerY, 0);
      layout.ripples.forEach((points, i) => trace(ripples, points, '#aebcff', .24 - i * .015));
      lines = layout.paths.map(({ points, color }) => trace(routes, points, color, .67));
      lights = layout.paths.map(({ color }) => {
        const sprite = new Sprite(new SpriteMaterial({ map: texture, color, depthTest: false }));
        orbs.add(sprite);
        return sprite;
      });
    },
    draw(active, time, animated) {
      if (!bridge) return;
      ripples.rotation.x = animated ? Math.sin(time / 5100) * .17 : 0;
      ripples.rotation.z = animated ? Math.sin(time / 4200) * .072 : 0;
      bridge.paths.forEach(({ branch, points }, i) => {
        const selected = branch === active;
        lines[i].material.opacity = active === -1 ? .68 : selected ? .98 : .34;
        const sprite = lights[i];
        sprite.visible = animated;
        if (!animated) return;
        const particle = pointOn(points, time, i);
        sprite.position.set(particle.x, -particle.y, 30);
        sprite.scale.setScalar(selected ? 33 : 22);
        sprite.material.opacity = active === -1 || selected ? 1 : .42;
      });
      renderer.render(scene, camera);
    },
    dispose() {
      clear(ripples);
      clear(routes);
      clear(orbs);
      texture.dispose();
      renderer.dispose();
      if (!context.isContextLost()) renderer.forceContextLoss();
    },
  };
}

function make2D(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  let bridge;

  function trace(points, color, opacity, width) {
    context.strokeStyle = color;
    context.globalAlpha = opacity;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) context.lineTo(points[i].x, points[i].y);
    context.stroke();
  }

  return {
    resize(layout) {
      bridge = layout;
      const ratio = Math.min(devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(layout.width * ratio);
      canvas.height = Math.round(layout.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    },
    draw(active, time, animated) {
      if (!bridge) return;
      context.clearRect(0, 0, bridge.width, bridge.height);
      context.save();
      context.translate(bridge.centerX, bridge.centerY);
      context.rotate(animated ? Math.sin(time / 4200) * .06 : 0);
      bridge.ripples.forEach((points, i) => trace(points, '#aebcff', .24 - i * .015, 1));
      context.restore();
      bridge.paths.forEach(({ branch, color, points }, i) => {
        const selected = branch === active;
        trace(points, color, active === -1 ? .68 : selected ? .98 : .34, selected ? 1.5 : 1);
        if (!animated) return;
        const particle = pointOn(points, time, i);
        context.fillStyle = color;
        context.globalAlpha = active === -1 || selected ? 1 : .42;
        context.shadowColor = color;
        context.shadowBlur = selected ? 13 : 8;
        context.beginPath();
        context.arc(particle.x, particle.y, selected ? 3.1 : 2.35, 0, tau);
        context.fill();
        context.shadowBlur = 0;
      });
      context.globalAlpha = 1;
    },
  };
}

export function connectNetwork(network, motionEnabled) {
  const center = network.querySelector('.network-center');
  const nodes = [...network.querySelectorAll('.map-node')];
  const leaves = nodes.map((node) => network.querySelector(`#${CSS.escape(node.getAttribute('aria-controls'))}`));
  const listeners = new AbortController();
  let canvas = network.querySelector('canvas');
  let drawing;
  let visible = false;
  let selected = nodes.findIndex((node) => node.getAttribute('aria-expanded') === 'true');
  let frame = 0;

  function refresh() {
    if (drawing && visible && !frame) frame = requestAnimationFrame(paint);
  }

  function paint(time) {
    frame = 0;
    if (!drawing || !visible) return;
    const animated = motionEnabled();
    drawing.draw(selected, animated ? time : 0, animated);
    if (animated) refresh();
  }

  function size() {
    if (!drawing || !visible || network.clientWidth === 0) return;
    drawing.resize(layouts(network, center, nodes, leaves));
    refresh();
  }

  function resetCanvas() {
    const replacement = canvas.cloneNode();
    replacement.removeAttribute('width');
    replacement.removeAttribute('height');
    canvas.replaceWith(replacement);
    canvas = replacement;
  }

  function fallback() {
    drawing?.dispose?.();
    resetCanvas();
    drawing = make2D(canvas);
    network.dataset.renderer = drawing ? 'canvas' : 'none';
    size();
  }

  function initialize() {
    try { drawing = make3D(canvas); } catch { /* Try Canvas 2D when WebGL is unavailable. */ }
    if (!drawing) {
      fallback();
      return;
    }
    network.dataset.renderer = 'three';
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      fallback();
    }, { once: true, signal: listeners.signal });
  }

  function select(index) {
    selected = index === selected ? -1 : index;
    nodes.forEach((node, i) => {
      const active = i === selected;
      node.setAttribute('aria-expanded', String(active));
      leaves[i].hidden = !active;
      leaves[i].classList.toggle('is-opening', active);
    });
    size();
  }

  network.classList.add('network-ready');
  leaves.forEach((leaf, index) => { leaf.hidden = index !== selected; });
  nodes.forEach((node, index) => node.addEventListener('click', () => select(index), { signal: listeners.signal }));
  const observer = new ResizeObserver(size);
  observer.observe(network);

  return {
    setVisible(enabled) {
      if (visible === enabled) return;
      visible = enabled;
      if (!visible) {
        cancelAnimationFrame(frame);
        frame = 0;
        return;
      }
      if (!network.dataset.renderer) initialize();
      size();
    },
    refresh,
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      listeners.abort();
      drawing?.dispose?.();
      if (drawing) resetCanvas();
      delete network.dataset.renderer;
      network.classList.remove('network-ready');
      for (const leaf of leaves) {
        leaf.hidden = false;
        leaf.classList.remove('is-opening');
      }
    },
  };
}
