// savegame.js - a tiny localStorage save: cash, story progress and stats.
// Continue from the title screen restores where Ria left off.

const SAVE_KEY = 'neon-harbor-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch { return null; }
}

export function writeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.round(state.cash), missionIndex: state.missionIndex,
      missionsDone: state.missionsDone, savedAt: Date.now(),
    }));
  } catch { /* storage unavailable: the run simply is not saved */ }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function hasSave() { return loadSave() !== null; }
