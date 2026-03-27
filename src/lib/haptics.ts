class HapticsManager {
  private enabled: boolean = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  vibrate() {
    if (!this.enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
    navigator.vibrate(10); // Short, subtle vibration
  }
}

export const hapticsManager = new HapticsManager();
