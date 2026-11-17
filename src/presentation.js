import { connectNetwork } from './network.js';

const root = document.documentElement;
const stage = document.querySelector('.stage');
const slides = [...stage.querySelectorAll('.slide')];
const track = document.querySelector('.scroll-track');
const steps = document.querySelector('.deck-steps');
const previous = document.querySelector('.previous');
const next = document.querySelector('.next');
const count = document.querySelector('.deck-count');
const status = document.getElementById('deck-status');
const motionButton = document.querySelector('.motion-toggle');
const fullscreenButton = document.querySelector('.fullscreen-toggle');
const sources = document.querySelector('.sources');
const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
const motionKey = 'lavalleja-movimiento-reducido';
const directions = ['diagonal', 'vertical', 'horizontal', 'horizontal', 'diagonal', 'vertical', 'diagonal'];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const number = (value) => String(value).padStart(2, '0');

let preference;
let current = -1;
let distance = 1;
let frame = 0;
let visible = new Set();
let gesture;

try {
  const stored = localStorage.getItem(motionKey);
  if (stored === 'true' || stored === 'false') preference = stored === 'true';
} catch {
  // In some browsers the offline file cannot write to local storage.
}

const reduced = () => preference ?? systemMotion.matches;
const network = connectNetwork(document.querySelector('.network'), () => !reduced());
const navigation = slides.map((slide, index) => {
  const stop = document.createElement('div');
  stop.className = 'scroll-stop';
  track.append(stop);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'deck-step';
  button.setAttribute('aria-label', `Diapositiva ${index + 1}. ${slide.dataset.label}`);
  button.title = `${number(index + 1)} · ${slide.dataset.label}`;
  button.append(document.createElement('span'));
  button.addEventListener('click', () => navigate(index));
  steps.append(button);
  return button;
});

function diagonalMask(fraction) {
  const edge = (1 - fraction) * 200;
  if (edge >= 100) return `polygon(100% ${edge - 100}%, 100% 100%, ${edge - 100}% 100%)`;
  return `polygon(${edge}% 0, 100% 0, 100% 100%, 0 100%, 0 ${edge}%)`;
}

function place(slide, x, y, offset, direction, mask = 'none') {
  const inMotion = offset !== 0;
  const parallax = Math.abs(offset);
  const photoX = direction === 'vertical' ? 0 : offset * -9;
  const photoY = direction === 'horizontal' ? 0 : offset * -12;
  slide.style.transform = inMotion && (x || y) ? `translate3d(${x}%, ${y}%, 0)` : 'none';
  slide.style.clipPath = mask;
  slide.style.setProperty('--photo-x', `${photoX}%`);
  slide.style.setProperty('--photo-y', `${photoY}%`);
  slide.style.setProperty('--photo-scale', String(1.09 + parallax * .25));
  slide.style.setProperty('--copy-x', `${direction === 'vertical' ? 0 : offset * 5}%`);
  slide.style.setProperty('--copy-y', `${direction === 'horizontal' ? 0 : offset * 8}%`);
  slide.style.setProperty('--copy-opacity', String(1 - parallax * .32));
}

function show(indices) {
  const displayed = new Set(indices);
  for (const i of visible) {
    if (!displayed.has(i)) slides[i].classList.remove('is-visible');
  }
  for (const i of displayed) slides[i].classList.add('is-visible');
  visible = displayed;
}

function select(index) {
  if (current === index) return;
  const focusWasOnSlide = current >= 0 && slides[current].contains(document.activeElement);
  current = index;
  slides.forEach((slide, i) => {
    const active = i === current;
    slide.classList.toggle('is-current', active);
    slide.inert = !active;
    if (active) navigation[i].setAttribute('aria-current', 'step');
    else navigation[i].removeAttribute('aria-current');
  });
  count.textContent = `${number(index + 1)} / ${number(slides.length)}`;
  previous.setAttribute('aria-disabled', String(index === 0));
  next.setAttribute('aria-disabled', String(index === slides.length - 1));
  status.textContent = `Diapositiva ${index + 1} de ${slides.length}. ${slides[index].dataset.label}.`;
  network.setVisible(slides[index].id === 'mapa');
  if (focusWasOnSlide) slides[index].querySelector('h1, h2').focus({ preventScroll: true });
}

function render() {
  frame = 0;
  const position = clamp(window.scrollY / distance, 0, slides.length - 1);
  const nearest = Math.round(position);
  const low = Math.floor(position);
  const progress = position - low;
  if (reduced() || progress < .0015 || progress > .9985 || low === slides.length - 1) {
    show([nearest]);
    place(slides[nearest], 0, 0, 0, 'vertical');
  } else {
    const high = low + 1;
    const direction = directions[low];
    show([low, high]);
    if (direction === 'horizontal') {
      place(slides[low], -progress * 100, 0, -progress, direction);
      place(slides[high], (1 - progress) * 100, 0, 1 - progress, direction);
    } else if (direction === 'vertical') {
      place(slides[low], 0, -progress * 100, -progress, direction);
      place(slides[high], 0, (1 - progress) * 100, 1 - progress, direction);
    } else {
      place(slides[low], 0, 0, -progress, direction);
      place(slides[high], 0, 0, 1 - progress, direction, diagonalMask(progress));
    }
  }
  select(nearest);
}

function scheduleRender() {
  if (!frame) frame = requestAnimationFrame(render);
}

function readHash() {
  const hash = location.hash.slice(1);
  const match = slides.findIndex((slide) => slide.id === hash);
  return match >= 0 ? match : 0;
}

function savePosition() {
  if (current < 0) return;
  const hash = current === 0 ? '' : `#${slides[current].id}`;
  if (location.hash !== hash) {
    history.replaceState(null, '', hash || location.pathname + location.search);
  }
}

function navigate(index, { instant = false } = {}) {
  const target = clamp(index, 0, slides.length - 1);
  const sameOrFar = Math.abs(target - current) !== 1;
  const behavior = instant || reduced() || sameOrFar ? 'instant' : 'smooth';
  window.scrollTo({ top: target * distance, behavior });
  if (behavior === 'instant') {
    render();
    savePosition();
  }
}

function resize() {
  const active = current < 0 ? readHash() : current;
  const nextDistance = track.firstElementChild.getBoundingClientRect().height;
  if (!nextDistance || Math.abs(distance - nextDistance) < .1) return;
  distance = nextDistance;
  navigate(active, { instant: true });
}

function setMotion() {
  root.classList.toggle('motion-off', reduced());
  root.classList.toggle('motion-on', !reduced());
  motionButton.setAttribute('aria-pressed', String(reduced()));
  motionButton.title = reduced() ? 'Activar movimiento' : 'Reducir movimiento';
  scheduleRender();
  network.refresh();
}

function toggleMotion() {
  preference = !reduced();
  try { localStorage.setItem(motionKey, String(preference)); } catch { /* Preference is kept for this session. */ }
  setMotion();
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await root.requestFullscreen();
  } catch {
    status.textContent = 'Usá la opción de pantalla completa del navegador.';
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
    const content = slides[current].querySelector('.slide-content');
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
    else if (event.key === 'End') navigate(slides.length - 1);
    else navigate(current + (advance ? 1 : -1));
  } else if (event.key.toLowerCase() === 'f' && !event.repeat) {
    toggleFullscreen();
  }
}

previous.addEventListener('click', () => navigate(current - 1));
next.addEventListener('click', () => navigate(current + 1));
motionButton.addEventListener('click', toggleMotion);
fullscreenButton.addEventListener('click', toggleFullscreen);
document.addEventListener('keydown', handleKey);
document.addEventListener('fullscreenchange', () => {
  const fullscreen = Boolean(document.fullscreenElement);
  fullscreenButton.setAttribute('aria-pressed', String(fullscreen));
  fullscreenButton.title = fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa';
  resize();
});
document.querySelector('[data-open-sources]').addEventListener('click', () => sources.showModal());
systemMotion.addEventListener('change', setMotion);
window.addEventListener('scroll', scheduleRender, { passive: true });
window.addEventListener('scrollend', savePosition, { passive: true });
window.addEventListener('resize', resize, { passive: true });
window.addEventListener('hashchange', () => navigate(readHash(), { instant: true }));

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
  if (Math.abs(dx) >= 44 && Math.abs(dx) > Math.abs(dy) * 1.35) navigate(current + (dx < 0 ? 1 : -1));
  gesture = undefined;
}, { passive: true });
stage.addEventListener('pointercancel', () => { gesture = undefined; }, { passive: true });

root.classList.add('deck-ready');
track.hidden = false;
document.querySelectorAll('[data-controls]').forEach((control) => { control.hidden = false; });
distance = track.firstElementChild.getBoundingClientRect().height || 1;
setMotion();
navigate(readHash(), { instant: true });
