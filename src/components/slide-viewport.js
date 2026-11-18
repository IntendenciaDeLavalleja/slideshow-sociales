export function createSlideViewport(container, source, mountView) {
  const views = [...source.querySelectorAll('.slide')].map((element) => ({
    id: element.id,
    label: element.dataset.label,
    transition: element.dataset.transition,
    element,
    content: element.querySelector('.slide-content'),
    scrollTop: 0,
  }));
  container.replaceChildren();

  const mounted = new Map();
  const requestedPhotos = new Set();
  let current = -1;

  function mount(index) {
    const view = views[index];
    // The later slide must stay above the earlier one in a diagonal transition.
    const next = mounted.get(index + 1)?.element ?? null;
    view.element.classList.add('is-visible');
    view.element.inert = true;
    for (const control of view.element.querySelectorAll('[data-controls]')) control.hidden = false;
    container.insertBefore(view.element, next);
    view.lifecycle = mountView(view);
    view.content.scrollTop = view.scrollTop;
    mounted.set(index, view);
  }

  function unmount(index, view) {
    view.scrollTop = view.content.scrollTop;
    view.lifecycle?.destroy();
    view.lifecycle = undefined;
    view.element.classList.remove('is-visible', 'is-current');
    view.element.remove();
    mounted.delete(index);
  }

  function preload(index) {
    for (const image of views[index]?.element.querySelectorAll('img') ?? []) {
      const src = image.getAttribute('src');
      if (!src || src.startsWith('data:')) continue;
      const key = `${image.srcset}|${image.sizes}|${src}`;
      if (requestedPhotos.has(key)) continue;
      requestedPhotos.add(key);
      const photo = new Image();
      photo.fetchPriority = 'low';
      photo.sizes = image.sizes;
      photo.srcset = image.srcset;
      photo.src = src;
    }
  }

  return {
    views,
    show(indices, activeIndex) {
      const prior = mounted.get(current);
      const moveFocus = activeIndex !== current && prior?.element.contains(document.activeElement);
      for (const [index, view] of mounted) {
        if (!indices.includes(index)) unmount(index, view);
      }
      for (const index of indices) {
        if (!mounted.has(index)) mount(index);
        const { element, lifecycle } = mounted.get(index);
        const active = index === activeIndex;
        if (element.inert === !active) continue;
        element.classList.toggle('is-current', active);
        element.inert = !active;
        lifecycle?.setVisible(active);
      }
      if (activeIndex !== current) {
        current = activeIndex;
        preload(current - 1);
        preload(current + 1);
      }
      if (moveFocus) views[current].element.querySelector('h1, h2')?.focus({ preventScroll: true });
    },
    refresh() {
      mounted.get(current)?.lifecycle?.refresh();
    },
    includeAllForPrint() {
      // Print uses the same views, including those currently outside the viewport.
      const added = [];
      let next = null;
      for (let index = views.length - 1; index >= 0; index -= 1) {
        const { element } = views[index];
        if (!mounted.has(index)) {
          container.insertBefore(element, next);
          added.push(element);
        }
        next = element;
      }
      return () => {
        for (const element of added) element.remove();
      };
    },
  };
}
