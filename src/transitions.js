function diagonalMask(fraction) {
  const edge = (1 - fraction) * 200;
  if (edge >= 100) return `polygon(100% ${edge - 100}%, 100% 100%, ${edge - 100}% 100%)`;
  return `polygon(${edge}% 0, 100% 0, 100% 100%, 0 100%, 0 ${edge}%)`;
}

export function placeSlide(slide, offset = 0, direction = 'vertical', mask = 'none') {
  const x = direction === 'horizontal' ? offset * 100 : 0;
  const y = direction === 'vertical' ? offset * 100 : 0;
  const parallax = Math.abs(offset);
  const photoX = direction === 'vertical' ? 0 : offset * -9;
  const photoY = direction === 'horizontal' ? 0 : offset * -12;
  slide.style.transform = x || y ? `translate3d(${x}%, ${y}%, 0)` : 'none';
  slide.style.clipPath = mask;
  slide.style.setProperty('--photo-x', `${photoX}%`);
  slide.style.setProperty('--photo-y', `${photoY}%`);
  slide.style.setProperty('--photo-scale', String(1.09 + parallax * .25));
  slide.style.setProperty('--copy-x', `${direction === 'vertical' ? 0 : offset * 5}%`);
  slide.style.setProperty('--copy-y', `${direction === 'horizontal' ? 0 : offset * 8}%`);
  slide.style.setProperty('--copy-opacity', String(1 - parallax * .32));
}

export function transitionSlides(from, to, progress) {
  const direction = from.transition ?? 'vertical';
  placeSlide(from.element, -progress, direction);
  placeSlide(to.element, 1 - progress, direction, direction === 'diagonal' ? diagonalMask(progress) : 'none');
}
