// Web Audio API Synthesizer and Haptic Feedback Manager
class AlertManager {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isAlarmPlaying: boolean = false;
  private sirenOscillator: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private lfoOscillator: OscillatorNode | null = null;

  private initAudio() {
    if (!this.audioCtx && typeof window !== "undefined") {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopContinuousAlarm();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // Play a short warning tone
  public playWarningTone() {
    if (this.isMuted) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); // D6

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn("Audio warning failed:", e);
    }
  }

  // Start continuous or pulsing critical siren
  public triggerCriticalAlert() {
    if (this.isMuted) return;
    try {
      this.initAudio();
      if (!this.audioCtx || this.isAlarmPlaying) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const lfo = this.audioCtx.createOscillator();
      const lfoGain = this.audioCtx.createGain();
      const mainGain = this.audioCtx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(850, now);

      // Modulate frequency with LFO for alarm warble
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(3.5, now); // 3.5 Hz warble
      lfoGain.gain.setValueAtTime(300, now);

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      mainGain.gain.setValueAtTime(0.25, now);
      mainGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(mainGain);
      mainGain.connect(this.audioCtx.destination);

      osc.start(now);
      lfo.start(now);
      osc.stop(now + 1.2);
      lfo.stop(now + 1.2);
    } catch (e) {
      console.warn("Audio alert failed:", e);
    }
  }

  public stopContinuousAlarm() {
    if (this.sirenOscillator) {
      try {
        this.sirenOscillator.stop();
        this.sirenOscillator.disconnect();
      } catch {}
      this.sirenOscillator = null;
    }
    if (this.lfoOscillator) {
      try {
        this.lfoOscillator.stop();
        this.lfoOscillator.disconnect();
      } catch {}
      this.lfoOscillator = null;
    }
    this.isAlarmPlaying = false;
  }

  // Haptic feedback on Galaxy S24 Ultra
  public triggerHaptic(severity: "INFO" | "WARNING" | "CRITICAL") {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        if (severity === "CRITICAL") {
          navigator.vibrate([200, 80, 200, 80, 400]);
        } else if (severity === "WARNING") {
          navigator.vibrate([150, 100, 150]);
        } else {
          navigator.vibrate([80]);
        }
      } catch (e) {
        console.warn("Vibration API failed:", e);
      }
    }
  }

  // Request & send browser notification
  public async sendBrowserNotification(title: string, body: string) {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
        });
      } catch (e) {
        console.warn("Notification error:", e);
      }
    } else if (Notification.permission !== "denied") {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        new Notification(title, { body });
      }
    }
  }
}

export const alertManager = new AlertManager();
