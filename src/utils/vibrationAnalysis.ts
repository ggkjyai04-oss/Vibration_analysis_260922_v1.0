// Vibration Signal Processing & Anomaly Detection Utilities

// Simple Radix-2 FFT for Real Input
export function calculateFFT(samples: number[], sampleRate: number): { frequencies: number[]; magnitudes: number[] } {
  // Find power of 2 size <= samples.length
  let n = 1;
  while (n * 2 <= samples.length && n * 2 <= 128) {
    n *= 2;
  }
  if (n < 16) {
    return { frequencies: [], magnitudes: [] };
  }

  // Slice to power of 2 and apply Hanning Window to minimize spectral leakage
  const windowed = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const val = samples[samples.length - n + i];
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    windowed[i] = val * window;
  }

  const real = new Float64Array(windowed);
  const imag = new Float64Array(n);

  // Bit reversal
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempR = real[i];
      const tempI = imag[i];
      real[i] = real[j];
      imag[i] = imag[j];
      real[j] = tempR;
      imag[j] = tempI;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Cooley-Tukey Radix-2 FFT
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);
    const halfLen = len >> 1;

    for (let i = 0; i < n; i += len) {
      let wR = 1;
      let wI = 0;
      for (let k = 0; k < halfLen; k++) {
        const uR = real[i + k];
        const uI = imag[i + k];
        const pos = i + k + halfLen;
        const vR = real[pos] * wR - imag[pos] * wI;
        const vI = real[pos] * wI + imag[pos] * wR;

        real[i + k] = uR + vR;
        imag[i + k] = uI + vI;
        real[pos] = uR - vR;
        imag[pos] = uI - vI;

        const nextWR = wR * wStepR - wI * wStepI;
        const nextWI = wR * wStepI + wI * wStepR;
        wR = nextWR;
        wI = nextWI;
      }
    }
  }

  const half = n / 2;
  const frequencies: number[] = [];
  const magnitudes: number[] = [];
  const freqResolution = sampleRate / n;

  for (let i = 1; i < half; i++) {
    frequencies.push(i * freqResolution);
    const mag = (2 * Math.sqrt(real[i] * real[i] + imag[i] * imag[i])) / n;
    magnitudes.push(mag);
  }

  return { frequencies, magnitudes };
}

// Calculate Kurtosis (Peakedness) for impulsive shock/bearing crack detection
export function calculateKurtosis(values: number[]): number {
  if (values.length < 4) return 3.0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  const mean = sum / values.length;

  let varianceSum = 0;
  let fourthMomentSum = 0;
  for (let i = 0; i < values.length; i++) {
    const diff = values[i] - mean;
    const diffSq = diff * diff;
    varianceSum += diffSq;
    fourthMomentSum += diffSq * diffSq;
  }

  const variance = varianceSum / values.length;
  if (variance < 1e-6) return 3.0;
  const kurtosis = (fourthMomentSum / values.length) / (variance * variance);
  return kurtosis;
}

// First order high-pass filter state
export class HighPassFilter {
  private prevRaw: number = 0;
  private prevFiltered: number = 0;
  private alpha: number;

  constructor(cutoffHz: number = 0.5, sampleRate: number = 50) {
    const rc = 1.0 / (2.0 * Math.PI * cutoffHz);
    const dt = 1.0 / sampleRate;
    this.alpha = rc / (rc + dt);
  }

  public process(value: number): number {
    const filtered = this.alpha * (this.prevFiltered + value - this.prevRaw);
    this.prevRaw = value;
    this.prevFiltered = filtered;
    return filtered;
  }

  public reset() {
    this.prevRaw = 0;
    this.prevFiltered = 0;
  }
}

// 3D Vector Gravity Removal (estimates gravity orientation using low-pass and extracts dynamic AC vibration)
export class DynamicVibrationExtractor {
  private gravX: number = 0;
  private gravY: number = 0;
  private gravZ: number = 9.80665;
  private alpha: number = 0.95; // low-pass constant for DC gravity

  public process(x: number, y: number, z: number): { dynamicX: number; dynamicY: number; dynamicZ: number; dynamicMag: number } {
    this.gravX = this.alpha * this.gravX + (1 - this.alpha) * x;
    this.gravY = this.alpha * this.gravY + (1 - this.alpha) * y;
    this.gravZ = this.alpha * this.gravZ + (1 - this.alpha) * z;

    const dynamicX = x - this.gravX;
    const dynamicY = y - this.gravY;
    const dynamicZ = z - this.gravZ;
    const dynamicMag = Math.sqrt(dynamicX * dynamicX + dynamicY * dynamicY + dynamicZ * dynamicZ);

    return { dynamicX, dynamicY, dynamicZ, dynamicMag };
  }
}

// ISO 10816 Severity Evaluation
export function evaluateIsoSeverity(rmsValue: number): {
  class: string;
  color: string;
  status: "GOOD" | "ACCEPTABLE" | "UNSATISFACTORY" | "UNACCEPTABLE";
  description: string;
} {
  // Typical ISO 10816-3 thresholds for mid-sized industrial machines (m/s² equivalent)
  if (rmsValue < 1.1) {
    return {
      class: "Zone A (Class I)",
      color: "#10b981", // emerald
      status: "GOOD",
      description: "양호: 정상 가동 상태 (신규/정비 직후 수준)"
    };
  } else if (rmsValue < 2.8) {
    return {
      class: "Zone B (Class II)",
      color: "#06b6d4", // cyan
      status: "ACCEPTABLE",
      description: "허용: 장기 연속 운전이 가능한 안정적 상태"
    };
  } else if (rmsValue < 7.1) {
    return {
      class: "Zone C (Class III)",
      color: "#f59e0b", // amber
      status: "UNSATISFACTORY",
      description: "경고: 단기 운전만 허용, 원인 분석 및 예방 점검 필요"
    };
  } else {
    return {
      class: "Zone D (Class IV)",
      color: "#ef4444", // rose
      status: "UNACCEPTABLE",
      description: "위험: 설비 손상 위험, 즉시 긴급 정지 및 점검 조치 요망"
    };
  }
}
