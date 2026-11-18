const number = (value) => String(value).padStart(2, '0');

export function createDeckControls(views, { navigate, move, toggleMotion, toggleFullscreen }) {
  const steps = document.querySelector('.deck-steps');
  const previous = document.querySelector('.previous');
  const next = document.querySelector('.next');
  const count = document.querySelector('.deck-count');
  const status = document.getElementById('deck-status');
  const motionButton = document.querySelector('.motion-toggle');
  const fullscreenButton = document.querySelector('.fullscreen-toggle');
  const buttons = views.map(({ label }, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'deck-step';
    button.setAttribute('aria-label', `Diapositiva ${index + 1}. ${label}`);
    button.title = `${number(index + 1)} · ${label}`;
    button.append(document.createElement('span'));
    button.addEventListener('click', () => navigate(index));
    return button;
  });

  steps.append(...buttons);
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  motionButton.addEventListener('click', toggleMotion);
  fullscreenButton.addEventListener('click', toggleFullscreen);

  let current = -1;
  return {
    select(index) {
      if (current >= 0) buttons[current].removeAttribute('aria-current');
      current = index;
      buttons[index].setAttribute('aria-current', 'step');
      count.textContent = `${number(index + 1)} / ${number(views.length)}`;
      previous.setAttribute('aria-disabled', String(index === 0));
      next.setAttribute('aria-disabled', String(index === views.length - 1));
      status.textContent = `Diapositiva ${index + 1} de ${views.length}. ${views[index].label}.`;
    },
    setMotion(reduced) {
      motionButton.setAttribute('aria-pressed', String(reduced));
      motionButton.title = reduced ? 'Activar movimiento' : 'Reducir movimiento';
    },
    setFullscreen(fullscreen) {
      fullscreenButton.setAttribute('aria-pressed', String(fullscreen));
      fullscreenButton.title = fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa';
    },
    announce(message) {
      status.textContent = message;
    },
  };
}
