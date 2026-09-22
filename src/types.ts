export interface VibrationSample {
  timestamp: number;
  x: number;
  y: number;
  z: number;
  magnitude: number;
  filteredMagnitude: number;
  rms: number;
  peakToPeak: number;
  frequency: number;
  kurtosis?: number;
}

export type AnomalyType =
  | "SPIKE"
  | "SUSTAINED_HIGH_RMS"
  | "FREQUENCY_ANOMALY"
  | "IMPACT_SHOCK"
  | "HARMONIC_RESONANCE";

export type AnomalySeverity = "INFO" | "WARNING" | "CRITICAL";

export interface AnomalyEvent {
  id: string;
  timestamp: number;
  deviceId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  magnitude: number;
  rms: number;
  dominantFreq: number;
  description: string;
  acknowledged?: boolean;
}

export interface SensorConfig {
  sampleRate: number; // Hz (e.g. 60)
  removeGravity: boolean; // High-pass or gravity vector cancellation
  rmsWarningThreshold: number; // m/s²
  rmsCriticalThreshold: number; // m/s²
  peakWarningThreshold: number; // m/s²
  peakCriticalThreshold: number; // m/s²
  kurtosisThreshold: number;
  audioAlarmEnabled: boolean;
  hapticEnabled: boolean;
  browserNotifyEnabled: boolean;
  autoAiDiagnosis: boolean;
}

export interface DiagnosisResult {
  faultType: string;
  isoSeverity: string;
  confidenceScore: number;
  summary: string;
  technicalDetails: string;
  recommendations: string[];
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export type OperationMode = "SENSOR" | "SIMULATOR" | "DASHBOARD";

export type ThemeMode = "day" | "night";

export type SimulationScenario =
  | "NORMAL_STABLE"
  | "BEARING_FAULT"
  | "MOTOR_IMBALANCE"
  | "SEISMIC_TREMOR"
  | "IMPACT_SHOCK"
  | "RESONANCE_SWEEP";
