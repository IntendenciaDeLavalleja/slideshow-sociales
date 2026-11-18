import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

// The standalone file can run in a browser that blocks localStorage.
const local = {
  getItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Keep the current session working. */ }
  },
  removeItem(key) {
    try { localStorage.removeItem(key); } catch { /* Storage is unavailable. */ }
  },
};

const legacyMotion = local.getItem('lavalleja-movimiento-reducido');

export const presentationStore = createStore(persist((set, get) => ({
  slideId: null,
  motionPreference: legacyMotion === 'true' ? true : legacyMotion === 'false' ? false : null,
  selectSlide(slideId) {
    if (get().slideId !== slideId) set({ slideId });
  },
  setMotionPreference(motionPreference) {
    set({ motionPreference });
  },
}), {
  name: 'lavalleja-presentacion',
  storage: createJSONStorage(() => local),
  partialize: ({ slideId, motionPreference }) => ({ slideId, motionPreference }),
}));
