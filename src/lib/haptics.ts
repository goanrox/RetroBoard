class HapticsManager {
  private enabled: boolean = true;

  private lastVibrateTime: number = 0;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  vibrate() {
    if (!this.enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
    
    const now = Date.now();
    if (now - this.lastVibrateTime < 50) return;
    this.lastVibrateTime = now;

    navigator.vibrate(10); // Short, subtle vibration
  }
}

export const hapticsManager = new HapticsManager();
