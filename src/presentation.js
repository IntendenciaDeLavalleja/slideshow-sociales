import { createDeckControls } from './components/deck-controls.js';
import { createSlideViewport } from './components/slide-viewport.js';
import { presentationStore } from './store/presentation-store.js';
import { placeSlide, transitionSlides } from './transitions.js';
import { connectNetwork } from './views/mapa/network.js';

const root = document.documentElement;
const stage = document.querySelector('.stage');
const track = document.querySelector('.scroll-track');
const sources = document.querySelector('.sources');
const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
const container = stage.querySelector('.slide-viewport');
const templates = document.getElementById('slide-templates');
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const reduced = () => presentationStore.getState().motionPreference ?? systemMotion.matches;

const viewport = createSlideViewport(container, templates?.content ?? container, ({ element }) => {
  const network = element.querySelector('.network');
  if (network) return connectNetwork(network, () => !reduced());
});
const { views } = viewport;
const controls = createDeckControls(views, { navigate, move, toggleMotion, toggleFullscreen });

let current = -1;
let distance = 1;
let frame = 0;
let gesture;
let finishPrint;

track.append(...views.map(() => {
  const stop = document.createElement('div');
  stop.className = 'scroll-stop';
  return stop;
}));

function render() {
  frame = 0;
  if (finishPrint) return;
  const position = clamp(window.scrollY / distance, 0, views.length - 1);
  const nearest = Math.round(position);
  const low = Math.floor(position);
  const progress = position - low;
  if (reduced() || progress < .0015 || progress > .9985 || low === views.length - 1) {
    viewport.show([nearest], nearest);
    placeSlide(views[nearest].element);
  } else {
    const high = low + 1;
    viewport.show([low, high], nearest);
    transitionSlides(views[low], views[high], progress);
  }

  if (current !== nearest) {
    current = nearest;
    presentationStore.getState().selectSlide(views[current].id);
    controls.select(current);
  }
}

function scheduleRender() {
  if (!frame) frame = requestAnimationFrame(render);
}

function renderNow() {
  cancelAnimationFrame(frame);
  render();
}

function indexOf(id) {
  return views.findIndex((view) => view.id === id);
}

function savePosition() {
  if (current < 0 || finishPrint) return;
  const hash = current === 0 ? '' : '#' + views[current].id;
  if (location.hash === hash) return;
  try {
    history.replaceState(history.state, '', hash || location.pathname + location.search);
  } catch {
    // A standalone file can still navigate if its browser restricts history updates.
  }
}

function navigate(index, { instant = false } = {}) {
  const target = clamp(index, 0, views.length - 1);
  const sameOrFar = Math.abs(target - current) !== 1;
  const behavior = instant || reduced() || sameOrFar ? 'instant' : 'smooth';
  window.scrollTo({ top: target * distance, behavior });
  if (behavior === 'instant') {
    renderNow();
    savePosition();
  }
}

function move(delta) {
  navigate(current + delta);
}

function resize() {
  if (finishPrint) return;
  const nextDistance = track.firstElementChild.getBoundingClientRect().height;
  if (!nextDistance || Math.abs(distance - nextDistance) < .1) return;
  distance = nextDistance;
  navigate(current, { instant: true });
}

function setMotion() {
  const disabled = reduced();
  root.classList.toggle('motion-off', disabled);
  root.classList.toggle('motion-on', !disabled);
  controls.setMotion(disabled);
  scheduleRender();
  viewport.refresh();
}

function toggleMotion() {
  presentationStore.getState().setMotionPreference(!reduced());
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await root.requestFullscreen();
  } catch {
    controls.announce('Usá la opción de pantalla completa del navegador.');
  }
}

function handleKey(event) {
  if (sources.open || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable]')) return;
  const space = event.key === ' ';
  if (space && event.target instanceof Element && event.target.closest('button, a, summary')) return;
  const advance = ['ArrowRight', 'ArrowDown', 'PageDown'].includes(event.key) || (space && !event.shiftKey);
  const retreat = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key) || (space && event.shiftKey);
  if (space || ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(event.key)) {
    const { content } = views[current];
    const overflow = content.scrollHeight - content.clientHeight;
    if (overflow > 4 && (advance ? content.scrollTop < overflow - 2 : content.scrollTop > 2)) {
      event.preventDefault();
      content.scrollBy({ top: (advance ? 1 : -1) * (space ? content.clientHeight * .8 : 110), behavior: reduced() ? 'instant' : 'smooth' });
      return;
    }
  }
  if (advance || retreat || event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    if (event.repeat) return;
    if (event.key === 'Home') navigate(0);
    else if (event.key === 'End') navigate(views.length - 1);
    else move(advance ? 1 : -1);
  } else if (event.key.toLowerCase() === 'f' && !event.repeat) {
    toggleFullscreen();
  }
}

document.addEventListener('keydown', handleKey);
document.addEventListener('fullscreenchange', () => {
  controls.setFullscreen(Boolean(document.fullscreenElement));
  resize();
});
stage.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('[data-open-sources]')) sources.showModal();
});
systemMotion.addEventListener('change', setMotion);
presentationStore.subscribe((state, previous) => {
  if (state.motionPreference !== previous.motionPreference) setMotion();
});
window.addEventListener('scroll', scheduleRender, { passive: true });
window.addEventListener('scrollend', () => {
  if (frame) renderNow();
  savePosition();
}, { passive: true });
window.addEventListener('resize', resize, { passive: true });
window.addEventListener('hashchange', () => navigate(indexOf(location.hash.slice(1)), { instant: true }));
window.addEventListener('beforeprint', () => {
  finishPrint ??= viewport.includeAllForPrint();
});
window.addEventListener('afterprint', () => {
  finishPrint?.();
  finishPrint = undefined;
  resize();
  scheduleRender();
});

stage.addEventListener('pointerdown', (event) => {
  const isControl = event.target instanceof Element && event.target.closest('button,a');
  if (!isControl && event.pointerType === 'touch' && event.isPrimary) {
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }
}, { passive: true });
stage.addEventListener('pointerup', (event) => {
  if (!gesture || gesture.id !== event.pointerId) return;
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  if (Math.abs(dx) >= 44 && Math.abs(dx) > Math.abs(dy) * 1.35) move(dx < 0 ? 1 : -1);
  gesture = undefined;
}, { passive: true });
stage.addEventListener('pointercancel', () => { gesture = undefined; }, { passive: true });

const linked = indexOf(location.hash.slice(1));
const restored = indexOf(presentationStore.getState().slideId);
history.scrollRestoration = 'manual';
root.classList.add('deck-ready');
track.hidden = false;
document.querySelectorAll('[data-controls]').forEach((control) => { control.hidden = false; });
distance = track.firstElementChild.getBoundingClientRect().height || 1;
setMotion();
navigate(linked >= 0 ? linked : restored, { instant: true });
