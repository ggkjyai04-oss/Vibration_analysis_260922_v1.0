import {
  CsvAnalysisSummary,
  CsvVibrationPoint,
  AnomalyEvent,
  SensorConfig,
} from "../types";
import {
  calculateFFT,
  calculateKurtosis,
  evaluateIsoSeverity,
  DynamicVibrationExtractor,
} from "./vibrationAnalysis";

export interface ParseCsvOptions {
  removeGravity?: boolean;
  unitMultiplier?: number; // 1 for m/s², 9.80665 for g
  customSampleRate?: number; // Hz if time column is missing or irregular
  warningThreshold?: number;
  criticalThreshold?: number;
}

export function parseVibrationCsv(
  csvText: string,
  fileName: string = "vibration_data.csv",
  fileSizeFormatted?: string,
  options: ParseCsvOptions = {}
): CsvAnalysisSummary {
  const {
    removeGravity = true,
    unitMultiplier = 1,
    customSampleRate = 50,
    warningThreshold = 2.8,
    criticalThreshold = 5.5,
  } = options;

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length < 2) {
    throw new Error("CSV 파일에 분석할 데이터 행이 충분하지 않습니다. (최소 2행 필요)");
  }

  // Detect delimiter
  const firstLine = lines[0];
  let delimiter = ",";
  if (firstLine.includes("\t")) {
    delimiter = "\t";
  } else if (firstLine.includes(";") && !firstLine.includes(",")) {
    delimiter = ";";
  }

  const parseLine = (line: string) => {
    return line.split(delimiter).map((col) => col.trim().replace(/^["']|["']$/g, ""));
  };

  const headerTokens = parseLine(lines[0]).map((h) => h.toLowerCase());

  // Check if first line is a header or data
  const isHeader = headerTokens.some((token) => isNaN(Number(token)));
  const startIndex = isHeader ? 1 : 0;

  // Identify column indices
  let timeCol = -1;
  let xCol = -1;
  let yCol = -1;
  let zCol = -1;
  let magCol = -1;

  if (isHeader) {
    headerTokens.forEach((header, idx) => {
      if (
        header.includes("time") ||
        header.includes("timestamp") ||
        header === "t" ||
        header.includes("sec") ||
        header.includes("ms")
      ) {
        timeCol = idx;
      } else if (
        header === "x" ||
        header.includes("acc_x") ||
        header.includes("accel_x") ||
        header.includes("ax") ||
        header.includes("linear_x") ||
        header.includes("gx") ||
        header.includes("x-axis")
      ) {
        xCol = idx;
      } else if (
        header === "y" ||
        header.includes("acc_y") ||
        header.includes("accel_y") ||
        header.includes("ay") ||
        header.includes("linear_y") ||
        header.includes("gy") ||
        header.includes("y-axis")
      ) {
        yCol = idx;
      } else if (
        header === "z" ||
        header.includes("acc_z") ||
        header.includes("accel_z") ||
        header.includes("az") ||
        header.includes("linear_z") ||
        header.includes("gz") ||
        header.includes("z-axis")
      ) {
        zCol = idx;
      } else if (
        header.includes("mag") ||
        header.includes("acc") ||
        header.includes("vibr") ||
        header.includes("rms") ||
        header.includes("norm")
      ) {
        magCol = idx;
      }
    });
  }

  // Fallbacks if columns could not be identified by header
  if (xCol === -1 && yCol === -1 && zCol === -1 && magCol === -1) {
    const sampleCols = parseLine(lines[startIndex]);
    if (sampleCols.length >= 4) {
      // Common order: Time, X, Y, Z
      timeCol = 0;
      xCol = 1;
      yCol = 2;
      zCol = 3;
    } else if (sampleCols.length === 3) {
      // X, Y, Z or Time, Mag, RMS
      xCol = 0;
      yCol = 1;
      zCol = 2;
    } else if (sampleCols.length === 2) {
      // Time, Magnitude
      timeCol = 0;
      magCol = 1;
    } else if (sampleCols.length === 1) {
      magCol = 0;
    }
  }

  const rawRows: {
    rawTime: number | null;
    x: number;
    y: number;
    z: number;
    mag: number;
  }[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const tokens = parseLine(lines[i]);
    if (tokens.length === 0 || tokens.every((t) => t === "")) continue;

    let rawTime: number | null = null;
    if (timeCol !== -1 && tokens[timeCol] !== undefined) {
      const parsedTime = parseFloat(tokens[timeCol]);
      if (!isNaN(parsedTime)) rawTime = parsedTime;
    }

    let x = 0;
    let y = 0;
    let z = 0;
    let mag = 0;

    if (xCol !== -1 && tokens[xCol] !== undefined) {
      const val = parseFloat(tokens[xCol]);
      if (!isNaN(val)) x = val * unitMultiplier;
    }
    if (yCol !== -1 && tokens[yCol] !== undefined) {
      const val = parseFloat(tokens[yCol]);
      if (!isNaN(val)) y = val * unitMultiplier;
    }
    if (zCol !== -1 && tokens[zCol] !== undefined) {
      const val = parseFloat(tokens[zCol]);
      if (!isNaN(val)) z = val * unitMultiplier;
    }

    if (magCol !== -1 && tokens[magCol] !== undefined) {
      const val = parseFloat(tokens[magCol]);
      if (!isNaN(val)) mag = val * unitMultiplier;
    } else {
      mag = Math.sqrt(x * x + y * y + z * z);
    }

    rawRows.push({ rawTime, x, y, z, mag });
  }

  if (rawRows.length === 0) {
    throw new Error("유효한 숫자 진동 데이터 행을 파싱할 수 없습니다.");
  }

  // Determine timebase & sampling rate
  let sampleRateHz = customSampleRate;
  let durationSeconds = 0;

  const hasTimestamps =
    rawRows.length >= 2 &&
    rawRows[0].rawTime !== null &&
    rawRows[1].rawTime !== null;

  if (hasTimestamps) {
    const firstT = rawRows[0].rawTime!;
    const lastT = rawRows[rawRows.length - 1].rawTime!;
    let diff = lastT - firstT;

    // Check if time is in milliseconds (e.g., > 10000 or typical epoch)
    if (diff > 500 && firstT > 100000) {
      diff = diff / 1000;
    }

    if (diff > 0.001) {
      durationSeconds = diff;
      sampleRateHz = Math.round(rawRows.length / durationSeconds);
      if (sampleRateHz < 1 || isNaN(sampleRateHz)) sampleRateHz = customSampleRate;
    } else {
      durationSeconds = rawRows.length / sampleRateHz;
    }
  } else {
    durationSeconds = rawRows.length / sampleRateHz;
  }

  // Filter gravity and compute dynamic vibration points
  const gravityExtractor = new DynamicVibrationExtractor();
  const points: CsvVibrationPoint[] = [];

  // Moving RMS buffer (window size ~ 0.5s or 25 samples)
  const rmsWindowSize = Math.max(8, Math.min(64, Math.floor(sampleRateHz * 0.5)));
  const rollingWindow: number[] = [];

  let xMin = Infinity, xMax = -Infinity, xSumSq = 0, xPeak = 0;
  let yMin = Infinity, yMax = -Infinity, ySumSq = 0, yPeak = 0;
  let zMin = Infinity, zMax = -Infinity, zSumSq = 0, zPeak = 0;
  let overallPeak = 0;

  const detectedAnomalies: AnomalyEvent[] = [];
  const baseTimestamp = Date.now();

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    let time = 0;
    if (hasTimestamps && row.rawTime !== null) {
      let tOffset = row.rawTime - rawRows[0].rawTime!;
      if (rawRows[rawRows.length - 1].rawTime! - rawRows[0].rawTime! > 500 && rawRows[0].rawTime! > 100000) {
        tOffset /= 1000;
      }
      time = tOffset;
    } else {
      time = i / sampleRateHz;
    }

    let filteredMag = row.mag;
    let procX = row.x;
    let procY = row.y;
    let procZ = row.z;

    if (removeGravity && (xCol !== -1 || yCol !== -1 || zCol !== -1)) {
      const dyn = gravityExtractor.process(row.x, row.y, row.z);
      procX = dyn.dynamicX;
      procY = dyn.dynamicY;
      procZ = dyn.dynamicZ;
      filteredMag = dyn.dynamicMag;
    } else if (removeGravity && magCol !== -1) {
      // If single magnitude, remove nominal gravity ~9.81 if present
      if (row.mag > 7 && row.mag < 12) {
        filteredMag = Math.abs(row.mag - 9.80665);
      }
    }

    // Rolling RMS calculation
    rollingWindow.push(filteredMag);
    if (rollingWindow.length > rmsWindowSize) rollingWindow.shift();
    const sumSquares = rollingWindow.reduce((acc, v) => acc + v * v, 0);
    const rms = Math.sqrt(sumSquares / rollingWindow.length);

    // Track axis min/max/peak
    xMin = Math.min(xMin, procX);
    xMax = Math.max(xMax, procX);
    xSumSq += procX * procX;
    xPeak = Math.max(xPeak, Math.abs(procX));

    yMin = Math.min(yMin, procY);
    yMax = Math.max(yMax, procY);
    ySumSq += procY * procY;
    yPeak = Math.max(yPeak, Math.abs(procY));

    zMin = Math.min(zMin, procZ);
    zMax = Math.max(zMax, procZ);
    zSumSq += procZ * procZ;
    zPeak = Math.max(zPeak, Math.abs(procZ));

    overallPeak = Math.max(overallPeak, filteredMag);

    const pt: CsvVibrationPoint = {
      index: i,
      time: parseFloat(time.toFixed(3)),
      timestamp: baseTimestamp + Math.round(time * 1000),
      x: parseFloat(procX.toFixed(3)),
      y: parseFloat(procY.toFixed(3)),
      z: parseFloat(procZ.toFixed(3)),
      magnitude: parseFloat(row.mag.toFixed(3)),
      filteredMagnitude: parseFloat(filteredMag.toFixed(3)),
      rms: parseFloat(rms.toFixed(3)),
    };
    points.push(pt);

    // Detect threshold anomalies with debouncing (minimum 0.3s apart)
    const lastAnomalyTime = detectedAnomalies.length > 0 ? (detectedAnomalies[0].timestamp - baseTimestamp) / 1000 : -10;
    if (time - lastAnomalyTime > 0.3) {
      if (filteredMag >= criticalThreshold * 2 || rms >= criticalThreshold) {
        detectedAnomalies.unshift({
          id: `csv-anom-${i}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: baseTimestamp + Math.round(time * 1000),
          deviceId: `CSV: ${fileName} (${time.toFixed(2)}s)`,
          type: filteredMag >= criticalThreshold * 2 ? "IMPACT_SHOCK" : "SUSTAINED_HIGH_RMS",
          severity: "CRITICAL",
          magnitude: parseFloat(filteredMag.toFixed(2)),
          rms: parseFloat(rms.toFixed(2)),
          dominantFreq: 0,
          description: `위험 초과 진동 (t=${time.toFixed(2)}s, Peak: ${filteredMag.toFixed(2)} m/s², RMS: ${rms.toFixed(2)} m/s²)`,
        });
      } else if (filteredMag >= warningThreshold * 1.5 || rms >= warningThreshold) {
        detectedAnomalies.unshift({
          id: `csv-anom-${i}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: baseTimestamp + Math.round(time * 1000),
          deviceId: `CSV: ${fileName} (${time.toFixed(2)}s)`,
          type: "SPIKE",
          severity: "WARNING",
          magnitude: parseFloat(filteredMag.toFixed(2)),
          rms: parseFloat(rms.toFixed(2)),
          dominantFreq: 0,
          description: `주의 수준 진동 감지 (t=${time.toFixed(2)}s, Peak: ${filteredMag.toFixed(2)} m/s²)`,
        });
      }
    }
  }

  // Statistical aggregation
  const filteredMags = points.map((p) => p.filteredMagnitude);
  const totalPoints = points.length;
  const overallRms = Math.sqrt(filteredMags.reduce((sum, v) => sum + v * v, 0) / totalPoints);
  const kurtosis = calculateKurtosis(filteredMags);
  const minMag = Math.min(...filteredMags);
  const peakToPeak = overallPeak - minMag;
  const crestFactor = overallRms > 0 ? overallPeak / overallRms : 0;

  // FFT Spectral analysis on the filtered dynamic signal
  const fftResult = calculateFFT(filteredMags, sampleRateHz);
  let dominantFrequency = 0;
  let topFrequencies: { freq: number; mag: number }[] = [];

  if (fftResult.frequencies.length > 0) {
    const paired = fftResult.frequencies.map((freq, idx) => ({
      freq: parseFloat(freq.toFixed(1)),
      mag: parseFloat(fftResult.magnitudes[idx].toFixed(3)),
    }));
    paired.sort((a, b) => b.mag - a.mag);
    dominantFrequency = paired[0]?.freq || 0;
    topFrequencies = paired.slice(0, 5);

    // Update dominant frequency on detected anomalies
    detectedAnomalies.forEach((a) => {
      a.dominantFreq = dominantFrequency;
    });
  }

  const isoSeverity = evaluateIsoSeverity(overallRms);

  return {
    fileName,
    fileSizeFormatted,
    totalPoints,
    durationSeconds: parseFloat(durationSeconds.toFixed(2)),
    sampleRateHz,
    overallRms: parseFloat(overallRms.toFixed(2)),
    peakMagnitude: parseFloat(overallPeak.toFixed(2)),
    peakToPeak: parseFloat(peakToPeak.toFixed(2)),
    kurtosis: parseFloat(kurtosis.toFixed(2)),
    crestFactor: parseFloat(crestFactor.toFixed(2)),
    dominantFrequency,
    topFrequencies,
    isoSeverity,
    axisStats: {
      x: {
        min: parseFloat(xMin.toFixed(2)),
        max: parseFloat(xMax.toFixed(2)),
        rms: parseFloat(Math.sqrt(xSumSq / totalPoints).toFixed(2)),
        peak: parseFloat(xPeak.toFixed(2)),
      },
      y: {
        min: parseFloat(yMin.toFixed(2)),
        max: parseFloat(yMax.toFixed(2)),
        rms: parseFloat(Math.sqrt(ySumSq / totalPoints).toFixed(2)),
        peak: parseFloat(yPeak.toFixed(2)),
      },
      z: {
        min: parseFloat(zMin.toFixed(2)),
        max: parseFloat(zMax.toFixed(2)),
        rms: parseFloat(Math.sqrt(zSumSq / totalPoints).toFixed(2)),
        peak: parseFloat(zPeak.toFixed(2)),
      },
    },
    detectedAnomalies: detectedAnomalies.slice(0, 30),
    points,
  };
}

// Generate realistic preset CSV datasets for 1-click testing
export function generateSampleCsv(scenario: "normal" | "bearing" | "unbalance"): {
  fileName: string;
  csvContent: string;
} {
  const sampleRate = 60;
  const duration = 5; // 5 seconds
  const total = sampleRate * duration;
  const rows: string[] = ["timestamp_s,acc_x_ms2,acc_y_ms2,acc_z_ms2,magnitude_ms2"];

  if (scenario === "normal") {
    // Normal steady motor running at 30 Hz (1800 RPM), low baseline vibration RMS ~ 0.8
    for (let i = 0; i < total; i++) {
      const t = i / sampleRate;
      const noiseX = (Math.random() - 0.5) * 0.4;
      const noiseY = (Math.random() - 0.5) * 0.4;
      const noiseZ = (Math.random() - 0.5) * 0.4;

      const x = Math.sin(2 * Math.PI * 30 * t) * 0.6 + noiseX;
      const y = Math.cos(2 * Math.PI * 30 * t) * 0.5 + noiseY;
      const z = 9.81 + Math.sin(2 * Math.PI * 60 * t) * 0.3 + noiseZ;
      const mag = Math.sqrt(x * x + y * y + z * z);
      rows.push(`${t.toFixed(3)},${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)},${mag.toFixed(3)}`);
    }
    return {
      fileName: "sample_normal_motor_1800rpm.csv",
      csvContent: rows.join("\n"),
    };
  } else if (scenario === "bearing") {
    // Bearing Fault: Impulsive sharp shock peaks with high kurtosis (> 5.5) every 0.8s
    for (let i = 0; i < total; i++) {
      const t = i / sampleRate;
      let shock = 0;
      // Impulses at t=1.2s, 2.5s, 3.8s
      if (Math.abs(t - 1.2) < 0.04) shock = 16.5;
      else if (Math.abs(t - 2.5) < 0.04) shock = 21.0;
      else if (Math.abs(t - 3.8) < 0.04) shock = 18.2;

      const noiseX = (Math.random() - 0.5) * 0.6;
      const noiseY = (Math.random() - 0.5) * 0.6;
      const noiseZ = (Math.random() - 0.5) * 0.6;

      const x = Math.sin(2 * Math.PI * 30 * t) * 1.2 + shock * 0.7 + noiseX;
      const y = Math.cos(2 * Math.PI * 30 * t) * 1.0 + shock * 0.5 + noiseY;
      const z = 9.81 + Math.sin(2 * Math.PI * 120 * t) * 0.8 + shock * 0.9 + noiseZ;
      const mag = Math.sqrt(x * x + y * y + z * z);
      rows.push(`${t.toFixed(3)},${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)},${mag.toFixed(3)}`);
    }
    return {
      fileName: "sample_bearing_impact_defect.csv",
      csvContent: rows.join("\n"),
    };
  } else {
    // Severe Unbalance: High continuous sinusoidal amplitude, RMS > 6.8 m/s² (Zone D)
    for (let i = 0; i < total; i++) {
      const t = i / sampleRate;
      const noiseX = (Math.random() - 0.5) * 0.8;
      const noiseY = (Math.random() - 0.5) * 0.8;
      const noiseZ = (Math.random() - 0.5) * 0.8;

      const x = Math.sin(2 * Math.PI * 25 * t) * 8.5 + noiseX;
      const y = Math.cos(2 * Math.PI * 25 * t) * 7.8 + noiseY;
      const z = 9.81 + Math.sin(2 * Math.PI * 50 * t) * 3.2 + noiseZ;
      const mag = Math.sqrt(x * x + y * y + z * z);
      rows.push(`${t.toFixed(3)},${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)},${mag.toFixed(3)}`);
    }
    return {
      fileName: "sample_severe_unbalance_zone_d.csv",
      csvContent: rows.join("\n"),
    };
  }
}
