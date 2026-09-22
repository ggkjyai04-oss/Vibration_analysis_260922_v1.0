import React, { useEffect, useState, useRef } from "react";
import { VibrationSample, AnomalyEvent } from "../types";
import { DynamicVibrationExtractor, calculateKurtosis, evaluateIsoSeverity } from "../utils/vibrationAnalysis";
import { alertManager } from "../utils/alerts";
import { getApiBaseUrl } from "../utils/apiConfig";
import { Smartphone, Radio, ArrowLeft, AlertOctagon, CheckCircle2, Zap, Shield } from "lucide-react";

interface Props {
  onBackToDashboard: () => void;
  warningThreshold: number;
  criticalThreshold: number;
}

export const SensorNodeMobileView: React.FC<Props> = ({
  onBackToDashboard,
  warningThreshold,
  criticalThreshold,
}) => {
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [hasSensorAccess, setHasSensorAccess] = useState<boolean | null>(null);
  const [currentSample, setCurrentSample] = useState<VibrationSample | null>(null);
  const [lastAnomaly, setLastAnomaly] = useState<AnomalyEvent | null>(null);
  const [sentCount, setSentCount] = useState<number>(0);

  const extractorRef = useRef(new DynamicVibrationExtractor());
  const sampleBufferRef = useRef<number[]>([]);
  const pendingBatchRef = useRef<VibrationSample[]>([]);
  const lastSendTimeRef = useRef<number>(0);
  const lastAlertTimeRef = useRef<number>(0);

  // Request Permission (primarily for iOS/certain browsers, on Galaxy S24 Ultra Android it works right away)
  const startSensorStream = async () => {
    try {
      if (typeof (DeviceMotionEvent as any)?.requestPermission === "function") {
        const response = await (DeviceMotionEvent as any).requestPermission();
        if (response !== "granted") {
          setHasSensorAccess(false);
          return;
        }
      }
      setHasSensorAccess(true);
      setIsStreaming(true);
    } catch (e) {
      console.warn("DeviceMotion permission error:", e);
      // Fallback: try attaching listener directly
      setHasSensorAccess(true);
      setIsStreaming(true);
    }
  };

  const stopSensorStream = () => {
    setIsStreaming(false);
  };

  useEffect(() => {
    if (!isStreaming) return;

    const handleMotion = (event: DeviceMotionEvent) => {
      // Prioritize acceleration (gravity removed by device if supported) or accelerationIncludingGravity
      const acc = event.acceleration || event.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

      const rawX = acc.x || 0;
      const rawY = acc.y || 0;
      const rawZ = acc.z || 0;

      // Extract dynamic AC vibration removing DC static tilt/gravity
      const { dynamicX, dynamicY, dynamicZ, dynamicMag } = extractorRef.current.process(rawX, rawY, rawZ);

      // Keep recent magnitude values in buffer for RMS & Kurtosis
      sampleBufferRef.current.push(dynamicMag);
      if (sampleBufferRef.current.length > 50) {
        sampleBufferRef.current.shift();
      }

      // Compute RMS
      let sumSq = 0;
      for (const val of sampleBufferRef.current) {
        sumSq += val * val;
      }
      const rms = Math.sqrt(sumSq / sampleBufferRef.current.length);
      const kurtosis = calculateKurtosis(sampleBufferRef.current);

      const sample: VibrationSample = {
        timestamp: Date.now(),
        x: dynamicX,
        y: dynamicY,
        z: dynamicZ,
        magnitude: Math.sqrt(rawX * rawX + rawY * rawY + rawZ * rawZ),
        filteredMagnitude: dynamicMag,
        rms,
        peakToPeak: dynamicMag * 2,
        frequency: 15.0, // estimated
        kurtosis,
      };

      setCurrentSample(sample);
      pendingBatchRef.current.push(sample);

      // Check anomaly threshold
      const now = Date.now();
      let anomalyDetected: AnomalyEvent | null = null;

      if (dynamicMag >= criticalThreshold || rms >= criticalThreshold * 0.7) {
        if (now - lastAlertTimeRef.current > 1500) {
          lastAlertTimeRef.current = now;
          anomalyDetected = {
            id: `anom-${now}-${Math.random().toString(36).substring(2, 8)}`,
            timestamp: now,
            deviceId: "Galaxy S24 Ultra (Native IMU)",
            type: dynamicMag > criticalThreshold * 1.5 ? "IMPACT_SHOCK" : "SUSTAINED_HIGH_RMS",
            severity: "CRITICAL",
            magnitude: dynamicMag,
            rms,
            dominantFreq: 24.5,
            description: `극한 진동 이상 감지: ${dynamicMag.toFixed(2)} m/s²`,
          };
          setLastAnomaly(anomalyDetected);
          alertManager.triggerCriticalAlert();
          alertManager.triggerHaptic("CRITICAL");
        }
      } else if (dynamicMag >= warningThreshold || rms >= warningThreshold * 0.7) {
        if (now - lastAlertTimeRef.current > 2000) {
          lastAlertTimeRef.current = now;
          anomalyDetected = {
            id: `anom-${now}-${Math.random().toString(36).substring(2, 8)}`,
            timestamp: now,
            deviceId: "Galaxy S24 Ultra (Native IMU)",
            type: "SPIKE",
            severity: "WARNING",
            magnitude: dynamicMag,
            rms,
            dominantFreq: 24.5,
            description: `진동 주의 수치 감지: ${dynamicMag.toFixed(2)} m/s²`,
          };
          setLastAnomaly(anomalyDetected);
          alertManager.playWarningTone();
          alertManager.triggerHaptic("WARNING");
        }
      }

      // Batch push to server every 100ms
      if (now - lastSendTimeRef.current >= 100 && pendingBatchRef.current.length > 0) {
        const batch = [...pendingBatchRef.current];
        pendingBatchRef.current = [];
        lastSendTimeRef.current = now;

        fetch(`${getApiBaseUrl()}/api/sensor/push`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: "Galaxy S24 Ultra",
            samples: batch,
            anomaly: anomalyDetected,
          }),
        })
          .then(() => setSentCount((c) => c + batch.length))
          .catch((err) => console.warn("Failed to push telemetry:", err));
      }
    };

    window.addEventListener("devicemotion", handleMotion, true);

    return () => {
      window.removeEventListener("devicemotion", handleMotion, true);
    };
  }, [isStreaming, warningThreshold, criticalThreshold]);

  const iso = currentSample ? evaluateIsoSeverity(currentSample.rms) : null;

  return (
    <div id="sensor-node-mobile-view" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col p-4 max-w-md mx-auto transition-colors">
      {/* Top Header */}
      <div className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={onBackToDashboard}
          className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>대시보드로 복귀</span>
        </button>
        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
          S24 Ultra Sensor Node
        </span>
      </div>

      {/* Main Status Hero */}
      <div className="flex-1 flex flex-col items-center justify-center py-6 text-center space-y-6">
        <div className="relative">
          {/* Pulsing ring when streaming */}
          {isStreaming && (
            <div className="absolute inset-0 -m-3 rounded-full bg-cyan-500/20 animate-ping pointer-events-none" />
          )}
          <div
            className={`w-28 h-28 rounded-full flex flex-col items-center justify-center border-4 transition-all ${
              isStreaming
                ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 shadow-md shadow-cyan-100 dark:shadow-cyan-950"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400"
            }`}
          >
            <Smartphone className={`w-10 h-10 ${isStreaming ? "text-cyan-600 dark:text-cyan-400" : "text-slate-400"}`} />
            <span className="text-[11px] font-mono mt-1 text-slate-600 dark:text-slate-400 font-medium">
              {isStreaming ? "송신 중" : "대기 중"}
            </span>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Galaxy S24 Ultra</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            내장 6축 고정밀 MEMS 가속도계 진동 스트리밍
          </p>
        </div>

        {/* Live Gauges */}
        {currentSample && (
          <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <div>
              <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">실시간 진동 가속도 (동적 벡터합)</div>
              <div className="text-4xl font-bold font-mono text-cyan-700 dark:text-cyan-400">
                {currentSample.filteredMagnitude.toFixed(2)}{" "}
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">m/s²</span>
              </div>
            </div>

            {/* ISO status */}
            {iso && (
              <div
                className="py-1.5 px-3 rounded-xl border font-mono text-xs flex items-center justify-between"
                style={{
                  backgroundColor: `${iso.color}15`,
                  borderColor: `${iso.color}40`,
                  color: iso.color,
                }}
              >
                <span>{iso.class}</span>
                <span className="font-bold">{iso.status}</span>
              </div>
            )}

            {/* 3-Axis mini readout */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-mono">
              <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-rose-600 dark:text-rose-400 block font-bold">X</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold">{currentSample.x.toFixed(2)}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-emerald-600 dark:text-emerald-400 block font-bold">Y</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold">{currentSample.y.toFixed(2)}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-blue-600 dark:text-blue-400 block font-bold">Z</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold">{currentSample.z.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Anomaly Notification on Phone */}
        {lastAnomaly && (
          <div className="w-full p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-left flex items-start space-x-3">
            <AlertOctagon className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5 animate-bounce" />
            <div>
              <div className="text-xs font-bold text-rose-800 dark:text-rose-300 font-mono">
                이상 진동 감지 (햅틱 경보 발생)
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300/90 mt-0.5">
                {lastAnomaly.description}
              </p>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="w-full space-y-3">
          {!isStreaming ? (
            <button
              onClick={startSensorStream}
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center space-x-2 text-base transition-all"
            >
              <Radio className="w-5 h-5 animate-pulse" />
              <span>센서 스트리밍 시작</span>
            </button>
          ) : (
            <button
              onClick={stopSensorStream}
              className="w-full py-3.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 font-semibold rounded-xl border border-rose-200 dark:border-rose-900/60 flex items-center justify-center space-x-2 text-sm transition-all shadow-2xs"
            >
              <span>센서 송신 일시 정지</span>
            </button>
          )}

          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            송신된 샘플 수: {sentCount.toLocaleString()} 개
          </div>
        </div>
      </div>
    </div>
  );
};
