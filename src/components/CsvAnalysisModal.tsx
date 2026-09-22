import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Upload,
  FileSpreadsheet,
  X,
  Play,
  Download,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Activity,
  Layers,
  BarChart3,
  Sparkles,
  Info,
  Clock,
  RotateCcw,
  Sliders,
  Filter,
} from "lucide-react";
import {
  CsvAnalysisSummary,
  SensorConfig,
  ThemeMode,
  AnomalyEvent,
  VibrationSample,
  DiagnosisResult,
} from "../types";
import {
  parseVibrationCsv,
  generateSampleCsv,
  ParseCsvOptions,
} from "../utils/csvParser";
import { getApiBaseUrl } from "../utils/apiConfig";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: SensorConfig;
  theme: ThemeMode;
  onApplyToMonitor: (samples: VibrationSample[], anomalies: AnomalyEvent[]) => void;
  onRequestAiDiagnosis: (anomaly: AnomalyEvent) => void;
}

export const CsvAnalysisModal: React.FC<Props> = ({
  isOpen,
  onClose,
  config,
  theme,
  onApplyToMonitor,
  onRequestAiDiagnosis,
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSizeFormatted, setFileSizeFormatted] = useState<string>("");
  const [analysis, setAnalysis] = useState<CsvAnalysisSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Settings
  const [removeGravity, setRemoveGravity] = useState<boolean>(true);
  const [unitMode, setUnitMode] = useState<"ms2" | "g">("ms2");
  const [channelView, setChannelView] = useState<"all" | "mag" | "xyz">("mag");
  const [visibleTimeRange, setVisibleTimeRange] = useState<[number, number]>([0, 100]); // percentage

  // AI Diagnosis state for CSV
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [csvAiDiagnosis, setCsvAiDiagnosis] = useState<DiagnosisResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);

  // Reparse when options change
  useEffect(() => {
    if (!csvContent) return;
    try {
      setError(null);
      const parsed = parseVibrationCsv(csvContent, fileName, fileSizeFormatted, {
        removeGravity,
        unitMultiplier: unitMode === "g" ? 9.80665 : 1,
        warningThreshold: config.rmsWarningThreshold,
        criticalThreshold: config.rmsCriticalThreshold,
      });
      setAnalysis(parsed);
      setCsvAiDiagnosis(null);
    } catch (err: any) {
      setError(err.message || "CSV 파싱 중 오류가 발생했습니다.");
    }
  }, [csvContent, removeGravity, unitMode, config.rmsWarningThreshold, config.rmsCriticalThreshold]);

  // Handle file reading
  const processFile = (file: File) => {
    if (!file.name.match(/\.(csv|txt|tsv|dat)$/i)) {
      setError("CSV 또는 텍스트 형식의 파일(.csv, .txt, .tsv)만 지원합니다.");
      return;
    }

    const sizeFormatted =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${(file.size / 1024).toFixed(1)} KB`;

    setFileName(file.name);
    setFileSizeFormatted(sizeFormatted);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvContent(text);
    };
    reader.onerror = () => {
      setError("파일을 읽는 도중 오류가 발생했습니다.");
    };
    reader.readAsText(file);
  };

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Load preset sample CSV
  const loadPreset = (preset: "normal" | "bearing" | "unbalance") => {
    const sample = generateSampleCsv(preset);
    setFileName(sample.fileName);
    setFileSizeFormatted("~15 KB");
    setCsvContent(sample.csvContent);
  };

  // Download current sample CSV
  const downloadSampleTemplate = () => {
    const sample = generateSampleCsv("bearing");
    const blob = new Blob([sample.csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vibration_data_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Download Analysis Report
  const downloadAnalysisReport = () => {
    if (!analysis) return;
    const reportText = `=====================================================
진동 데이터 CSV 정밀 분석 리포트 (ISO 10816 표준 준용)
=====================================================
파일명: ${analysis.fileName} (${analysis.fileSizeFormatted || ""})
분석 시각: ${new Date().toLocaleString()}
총 샘플 수: ${analysis.totalPoints} points
측정 시간: ${analysis.durationSeconds} 초
추정 샘플링 레이트: ${analysis.sampleRateHz} Hz

[주요 진동 통계 지표]
- 전체 실효 진동치 (RMS): ${analysis.overallRms} m/s²
- 최대 첨두치 (Peak Magnitude): ${analysis.peakMagnitude} m/s²
- 첨두-첨두치 (Peak-to-Peak): ${analysis.peakToPeak} m/s²
- 파고율 (Crest Factor): ${analysis.crestFactor}
- 첨도 (Kurtosis, 충격도): ${analysis.kurtosis} (정상 가우스 기준 3.0, >4.5 시 베어링 결함 의심)
- 주 진동 주파수 (Dominant Freq): ${analysis.dominantFrequency} Hz

[ISO 10816 설비 등급 평가]
- 판정 등급: ${analysis.isoSeverity.class} [${analysis.isoSeverity.status}]
- 상태 평가: ${analysis.isoSeverity.description}

[3축 성분 통계]
- X축 (RMS: ${analysis.axisStats.x.rms} m/s², Peak: ${analysis.axisStats.x.peak} m/s², Min: ${analysis.axisStats.x.min}, Max: ${analysis.axisStats.x.max})
- Y축 (RMS: ${analysis.axisStats.y.rms} m/s², Peak: ${analysis.axisStats.y.peak} m/s², Min: ${analysis.axisStats.y.min}, Max: ${analysis.axisStats.y.max})
- Z축 (RMS: ${analysis.axisStats.z.rms} m/s², Peak: ${analysis.axisStats.z.peak} m/s², Min: ${analysis.axisStats.z.min}, Max: ${analysis.axisStats.z.max})

[검출된 이상 징후 이벤트 (${analysis.detectedAnomalies.length}건)]
${analysis.detectedAnomalies
  .map(
    (a, i) =>
      `[#${i + 1}] ${a.severity} | ${a.type} | Peak: ${a.magnitude} m/s² | RMS: ${a.rms} m/s² | ${a.description}`
  )
  .join("\n")}

[상위 주요 주파수 성분]
${analysis.topFrequencies.map((f, i) => `#${i + 1}: ${f.freq} Hz (진폭: ${f.mag})`).join(", ")}
=====================================================`;

    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vibration_report_${analysis.fileName.replace(/\.[^/.]+$/, "")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Convert CSV points to VibrationSample array and push to monitor
  const handleApplyToMonitor = () => {
    if (!analysis) return;
    const convertedSamples: VibrationSample[] = analysis.points.map((p) => ({
      timestamp: p.timestamp || Date.now(),
      x: p.x,
      y: p.y,
      z: p.z,
      magnitude: p.magnitude,
      filteredMagnitude: p.filteredMagnitude,
      rms: p.rms,
      peakToPeak: analysis.peakToPeak,
      frequency: analysis.dominantFrequency,
      kurtosis: analysis.kurtosis,
    }));

    onApplyToMonitor(convertedSamples, analysis.detectedAnomalies);
    onClose();
  };

  // Request Gemini AI Diagnosis for this CSV
  const handleRequestAiDiagnosis = async () => {
    if (!analysis) return;
    setIsAiLoading(true);
    setAiError(null);

    const highestAnomaly = analysis.detectedAnomalies[0] || {
      id: `csv-highest-${Date.now()}`,
      timestamp: Date.now(),
      deviceId: `CSV: ${analysis.fileName}`,
      type: analysis.kurtosis > 4.5 ? "IMPACT_SHOCK" : "SUSTAINED_HIGH_RMS",
      severity: analysis.overallRms >= config.rmsCriticalThreshold ? "CRITICAL" : "WARNING",
      magnitude: analysis.peakMagnitude,
      rms: analysis.overallRms,
      dominantFreq: analysis.dominantFrequency,
      description: `CSV 파일 전체 종합 진동 특성 분석 (${analysis.fileName})`,
    };

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/diagnose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anomalyData: {
            ...highestAnomaly,
            kurtosis: analysis.kurtosis,
          },
          recentMetrics: {
            avgRms: analysis.overallRms,
            peakToPeak: analysis.peakToPeak,
          },
          equipmentContext: `업로드된 CSV 진동 계측 데이터 (${analysis.fileName}, 샘플 수: ${analysis.totalPoints}, 길이: ${analysis.durationSeconds}초, 샘플링: ${analysis.sampleRateHz}Hz, 첨도: ${analysis.kurtosis})`,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.diagnosis) {
        setCsvAiDiagnosis(data.diagnosis);
      } else if (data.fallbackDiagnosis) {
        setCsvAiDiagnosis({
          faultType: data.fallbackDiagnosis.faultType || "기계적 불평형 및 복합 진동",
          isoSeverity: data.fallbackDiagnosis.isoSeverity || analysis.isoSeverity.class,
          confidenceScore: data.fallbackDiagnosis.confidenceScore || 85,
          summary: data.fallbackDiagnosis.analysis || "업로드된 CSV의 진동 분석 결과입니다.",
          technicalDetails: `RMS ${analysis.overallRms} m/s², Peak ${analysis.peakMagnitude} m/s², 주 주파수 ${analysis.dominantFrequency} Hz, 첨도 ${analysis.kurtosis} 측정됨.`,
          recommendations: data.fallbackDiagnosis.recommendations || [
            "설비 체결 상태 및 베어링 마모 점검 권장",
            "동적 밸런싱 측정 실시",
          ],
          urgency: analysis.overallRms >= config.rmsCriticalThreshold ? "CRITICAL" : "MEDIUM",
        });
      }
    } catch (err: any) {
      console.warn("AI diagnosis fetch failed, applying rule-based diagnosis:", err);
      // Fallback rule-based engineering analysis
      const isBearing = analysis.kurtosis > 4.5 || analysis.peakMagnitude > 15;
      const isUnbalance = analysis.overallRms > 5.5;

      setCsvAiDiagnosis({
        faultType: isBearing
          ? "베어링 결함성 고주파 충격 펄스 (Bearing Defect / Flaking)"
          : isUnbalance
          ? "회전체 심각한 불평형 및 정렬 불량 (Severe Unbalance / Misalignment)"
          : "허용 범위 내 정상 작동 또는 경미한 진동 (Normal Operation)",
        isoSeverity: analysis.isoSeverity.class,
        confidenceScore: 92,
        summary: `${analysis.fileName} 파일의 진동 신호 분석 결과, 실효 RMS ${analysis.overallRms} m/s² 및 주파수 ${analysis.dominantFrequency} Hz가 확인되었습니다.`,
        technicalDetails: `첨도(Kurtosis)는 ${analysis.kurtosis}로 ${
          analysis.kurtosis > 4.5 ? "충격성 크랙 펄스가 지배적임" : "비충격성 정상 가우스 분포에 근접함"
        }을 보여주며 파고율은 ${analysis.crestFactor}입니다.`,
        recommendations: [
          "주요 회전축 커플링 및 베어링 하우징 발열/윤활 상태 점검",
          "설비 베이스 플레이트 및 앵커 볼트 체결 토크 확인",
          "진동 이상 발생 구간(t)의 외부 외란 또는 부하 변동 여부 대조",
        ],
        urgency: analysis.overallRms >= config.rmsCriticalThreshold ? "CRITICAL" : "LOW",
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  // Render Time-Domain Waveform Canvas
  useEffect(() => {
    if (!analysis || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const isNight = theme === "night";
    const bgFill = isNight ? "#090d16" : "#ffffff";
    const gridLine = isNight ? "#1e293b" : "#f1f5f9";
    const textCol = isNight ? "#64748b" : "#94a3b8";

    ctx.fillStyle = bgFill;
    ctx.fillRect(0, 0, width, height);

    // Filter points by visible range slider
    const totalPts = analysis.points.length;
    const startIdx = Math.floor((visibleTimeRange[0] / 100) * (totalPts - 1));
    const endIdx = Math.max(startIdx + 10, Math.floor((visibleTimeRange[1] / 100) * totalPts));
    const visiblePoints = analysis.points.slice(startIdx, endIdx);

    if (visiblePoints.length < 2) return;

    // Grid lines
    ctx.strokeStyle = gridLine;
    ctx.lineWidth = 1;
    const gridRows = 5;
    for (let i = 0; i <= gridRows; i++) {
      const y = (height / gridRows) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Determine scale
    let maxVal = Math.max(
      ...visiblePoints.map((p) => {
        if (channelView === "mag") return p.filteredMagnitude;
        if (channelView === "xyz") return Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
        return Math.max(p.filteredMagnitude, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
      }),
      config.rmsCriticalThreshold * 1.5,
      6.0
    );

    // Center Y axis if showing signed values, or bottom Y axis for magnitude
    const isSigned = channelView === "xyz" || channelView === "all";
    const midY = isSigned ? height / 2 : height - 20;
    const scaleY = isSigned ? (height / 2 - 20) / maxVal : (height - 40) / maxVal;

    // Draw Threshold reference lines (Warning & Critical)
    const drawThresholdLine = (val: number, color: string, label: string) => {
      const lineY = isSigned ? midY - val * scaleY : midY - val * scaleY;
      if (lineY > 0 && lineY < height) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(width, lineY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = color;
        ctx.font = "10px JetBrains Mono, monospace";
        ctx.fillText(`${label} (${val} m/s²)`, width - 130, lineY - 4);
      }
    };

    drawThresholdLine(config.rmsWarningThreshold, "#f59e0b", "주의 임계치");
    drawThresholdLine(config.rmsCriticalThreshold, "#ef4444", "위험 임계치");

    // Center Zero line if signed
    if (isSigned) {
      ctx.strokeStyle = isNight ? "#334155" : "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();
    }

    // Plot channels
    const plotChannel = (
      valExtractor: (p: (typeof visiblePoints)[0]) => number,
      strokeColor: string,
      lineWidth: number = 1.8
    ) => {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();

      visiblePoints.forEach((p, idx) => {
        const xPos = (idx / (visiblePoints.length - 1)) * width;
        const val = valExtractor(p);
        const yPos = midY - val * scaleY;

        if (idx === 0) ctx.moveTo(xPos, yPos);
        else ctx.lineTo(xPos, yPos);
      });
      ctx.stroke();
    };

    if (channelView === "xyz" || channelView === "all") {
      plotChannel((p) => p.x, "#10b981", 1.2); // X = Emerald
      plotChannel((p) => p.y, "#f59e0b", 1.2); // Y = Amber
      plotChannel((p) => p.z, "#a855f7", 1.2); // Z = Purple
    }

    if (channelView === "mag" || channelView === "all") {
      plotChannel((p) => p.filteredMagnitude, "#06b6d4", 2.0); // Magnitude = Cyan
    }

    // Mark anomalies on timeline
    analysis.detectedAnomalies.forEach((anom) => {
      const ptIdx = visiblePoints.findIndex((p) => Math.abs(p.filteredMagnitude - anom.magnitude) < 0.1);
      if (ptIdx !== -1) {
        const xPos = (ptIdx / (visiblePoints.length - 1)) * width;
        const yPos = midY - visiblePoints[ptIdx].filteredMagnitude * scaleY;

        ctx.fillStyle = anom.severity === "CRITICAL" ? "#ef4444" : "#f59e0b";
        ctx.beginPath();
        ctx.arc(xPos, yPos, 4, 0, Math.PI * 2);
        ctx.fill();

        // Flag stem
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xPos, yPos);
        ctx.lineTo(xPos, yPos - 14);
        ctx.stroke();
      }
    });

    // Time indicators at edges
    ctx.fillStyle = textCol;
    ctx.font = "10px JetBrains Mono, monospace";
    const startTime = visiblePoints[0]?.time.toFixed(2) || "0.00";
    const endTime = visiblePoints[visiblePoints.length - 1]?.time.toFixed(2) || "0.00";
    ctx.fillText(`t = ${startTime}s`, 8, height - 6);
    ctx.fillText(`t = ${endTime}s`, width - 70, height - 6);
  }, [analysis, visibleTimeRange, channelView, theme, config]);

  // Render Frequency Spectrum Canvas
  useEffect(() => {
    if (!analysis || !spectrumCanvasRef.current) return;
    const canvas = spectrumCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const isNight = theme === "night";
    ctx.fillStyle = isNight ? "#090d16" : "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const mags = analysis.topFrequencies;
    if (mags.length === 0) return;

    // Draw spectrum bars
    const barWidth = 32;
    const maxMag = Math.max(...mags.map((f) => f.mag), 1.0);
    const spacing = (width - 40) / Math.max(mags.length, 1);

    mags.forEach((f, idx) => {
      const x = 30 + idx * spacing;
      const barHeight = ((f.mag / maxMag) * (height - 50));
      const y = height - 25 - barHeight;

      const grad = ctx.createLinearGradient(0, y, 0, height - 25);
      grad.addColorStop(0, idx === 0 ? "#06b6d4" : "#3b82f6");
      grad.addColorStop(1, idx === 0 ? "#0891b2" : "#1d4ed8");

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Frequency label
      ctx.fillStyle = isNight ? "#94a3b8" : "#64748b";
      ctx.font = "10px JetBrains Mono, monospace";
      ctx.fillText(`${f.freq}Hz`, x, height - 8);

      // Amplitude value on top
      ctx.fillStyle = isNight ? "#f1f5f9" : "#0f172a";
      ctx.fillText(f.mag.toFixed(2), x, y - 4);
    });
  }, [analysis, theme]);

  if (!isOpen) return null;

  return (
    <div
      id="csv-analysis-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in"
    >
      <div
        className={`w-full max-w-5xl rounded-2xl border shadow-2xl overflow-hidden my-auto ${
          theme === "night"
            ? "bg-slate-900 border-slate-700 text-slate-100"
            : "bg-white border-slate-200 text-slate-800"
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            theme === "night" ? "border-slate-800 bg-slate-900/80" : "border-slate-100 bg-slate-50/80"
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-bold text-base sm:text-lg tracking-tight">
                  CSV 진동 데이터 파일 업로드 & 정밀 분석
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 font-semibold border border-cyan-200 dark:border-cyan-800">
                  ISO 10816 Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                갤럭시 스마트폰, IoT 진동 센서, 가속도계 CSV 계측 데이터를 불러와 즉시 분석합니다
              </p>
            </div>
          </div>

          <button
            id="close-csv-modal-btn"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* File Upload Drop Zone (Drag & Drop + Click) */}
          <div
            id="csv-dropzone-container"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
              dragActive
                ? "border-cyan-500 bg-cyan-500/10 scale-[1.005]"
                : theme === "night"
                ? "border-slate-700 hover:border-cyan-500/60 bg-slate-800/40 hover:bg-slate-800/80"
                : "border-slate-300 hover:border-cyan-500/60 bg-slate-50 hover:bg-cyan-50/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv,.dat"
              onChange={handleManualUpload}
              className="hidden"
            />
            <div className="max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-cyan-100 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shadow-inner">
                <Upload className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  CSV 파일을 이곳에 드래그하거나 <span className="text-cyan-600 dark:text-cyan-400 underline">클릭하여 선택</span>하세요
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  지원 형식: 시간(t/timestamp), 3축 가속도(x, y, z) 또는 진동 진폭(magnitude, m/s² 또는 g)
                </p>
              </div>

              {/* Quick Sample Presets */}
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">테스트용 예제:</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadPreset("normal");
                  }}
                  className="px-2.5 py-1 text-xs rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                >
                  🟢 정상 모터 (30Hz)
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadPreset("bearing");
                  }}
                  className="px-2.5 py-1 text-xs rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors"
                >
                  🟡 베어링 결함 충격
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadPreset("unbalance");
                  }}
                  className="px-2.5 py-1 text-xs rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-colors"
                >
                  🔴 위험 축 불평형
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadSampleTemplate();
                  }}
                  className="px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors flex items-center space-x-1"
                >
                  <Download className="w-3 h-3" />
                  <span>서식 다운로드</span>
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Analysis View when data loaded */}
          {analysis && (
            <div className="space-y-6 animate-in fade-in">
              {/* File Info & Configuration Bar */}
              <div
                className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                  theme === "night" ? "bg-slate-800/60 border-slate-700" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    📂 {analysis.fileName}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                    {analysis.totalPoints} 샘플 | {analysis.durationSeconds}s | {analysis.sampleRateHz} Hz
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Remove Gravity toggle */}
                  <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={removeGravity}
                      onChange={(e) => setRemoveGravity(e.target.checked)}
                      className="rounded text-cyan-600 focus:ring-cyan-500"
                    />
                    <span>중력(DC) 제거</span>
                  </label>

                  {/* Unit Mode */}
                  <div className="flex items-center space-x-1 rounded-lg border border-slate-300 dark:border-slate-700 p-0.5">
                    <button
                      onClick={() => setUnitMode("ms2")}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                        unitMode === "ms2"
                          ? "bg-cyan-600 text-white font-semibold"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      m/s²
                    </button>
                    <button
                      onClick={() => setUnitMode("g")}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                        unitMode === "g"
                          ? "bg-cyan-600 text-white font-semibold"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      g
                    </button>
                  </div>

                  {/* Channel View */}
                  <div className="flex items-center space-x-1 rounded-lg border border-slate-300 dark:border-slate-700 p-0.5">
                    <button
                      onClick={() => setChannelView("mag")}
                      className={`px-2 py-0.5 rounded text-[11px] ${
                        channelView === "mag"
                          ? "bg-cyan-600 text-white font-semibold"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      진폭 (Mag)
                    </button>
                    <button
                      onClick={() => setChannelView("xyz")}
                      className={`px-2 py-0.5 rounded text-[11px] ${
                        channelView === "xyz"
                          ? "bg-cyan-600 text-white font-semibold"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      3축 (X/Y/Z)
                    </button>
                    <button
                      onClick={() => setChannelView("all")}
                      className={`px-2 py-0.5 rounded text-[11px] ${
                        channelView === "all"
                          ? "bg-cyan-600 text-white font-semibold"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      전체 통합
                    </button>
                  </div>
                </div>
              </div>

              {/* Bento Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* ISO 10816 Severity */}
                <div
                  className="col-span-2 p-3.5 rounded-xl border flex flex-col justify-between"
                  style={{
                    backgroundColor: `${analysis.isoSeverity.color}15`,
                    borderColor: `${analysis.isoSeverity.color}40`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      ISO 10816 기계 상태 평가
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{
                        backgroundColor: analysis.isoSeverity.color,
                        color: "#ffffff",
                      }}
                    >
                      {analysis.isoSeverity.status}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="text-base font-bold" style={{ color: analysis.isoSeverity.color }}>
                      {analysis.isoSeverity.class}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-1">
                      {analysis.isoSeverity.description}
                    </p>
                  </div>
                </div>

                {/* Overall RMS */}
                <div
                  className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                    theme === "night" ? "bg-slate-800/80 border-slate-700" : "bg-white border-slate-200"
                  }`}
                >
                  <span className="text-xs text-slate-500 dark:text-slate-400">전체 RMS 실효치</span>
                  <div className="mt-1">
                    <span className="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400">
                      {analysis.overallRms}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-1">m/s²</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    경고기준: {config.rmsWarningThreshold} m/s²
                  </span>
                </div>

                {/* Peak Magnitude */}
                <div
                  className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                    theme === "night" ? "bg-slate-800/80 border-slate-700" : "bg-white border-slate-200"
                  }`}
                >
                  <span className="text-xs text-slate-500 dark:text-slate-400">최대 첨두치 (Peak)</span>
                  <div className="mt-1">
                    <span className="text-xl font-bold font-mono text-amber-500">
                      {analysis.peakMagnitude}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-1">m/s²</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    P-P: {analysis.peakToPeak} m/s²
                  </span>
                </div>

                {/* Kurtosis (첨도) */}
                <div
                  className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                    theme === "night" ? "bg-slate-800/80 border-slate-700" : "bg-white border-slate-200"
                  }`}
                >
                  <span className="text-xs text-slate-500 dark:text-slate-400">첨도 (Kurtosis)</span>
                  <div className="mt-1">
                    <span
                      className={`text-xl font-bold font-mono ${
                        analysis.kurtosis > 4.5 ? "text-rose-500" : "text-emerald-500"
                      }`}
                    >
                      {analysis.kurtosis}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {analysis.kurtosis > 4.5 ? "⚠️ 베어링 충격성 결함 의심" : "정상 정규분포 (~3.0)"}
                  </span>
                </div>

                {/* Dominant Frequency */}
                <div
                  className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                    theme === "night" ? "bg-slate-800/80 border-slate-700" : "bg-white border-slate-200"
                  }`}
                >
                  <span className="text-xs text-slate-500 dark:text-slate-400">주 진동 주파수</span>
                  <div className="mt-1">
                    <span className="text-xl font-bold font-mono text-blue-500">
                      {analysis.dominantFrequency}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-1">Hz</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    RPM: ~{Math.round(analysis.dominantFrequency * 60)}
                  </span>
                </div>
              </div>

              {/* Time-Domain Waveform Canvas */}
              <div
                className={`p-4 rounded-xl border space-y-3 ${
                  theme === "night" ? "bg-slate-800/60 border-slate-700" : "bg-white border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      시간축 파형 오실로스코프 (Time-Domain Waveform)
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span className="flex items-center space-x-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block"></span>
                      <span>진폭(Mag)</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                      <span>X</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                      <span>Y</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
                      <span>Z</span>
                    </span>
                  </div>
                </div>

                <div className="w-full h-56 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 relative bg-slate-950">
                  <canvas
                    ref={canvasRef}
                    width={900}
                    height={220}
                    className="w-full h-full block"
                  />
                </div>

                {/* Time Range Scrubber */}
                <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 pt-1">
                  <span className="font-mono text-[11px] shrink-0">구간 탐색:</span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, visibleTimeRange[1] - 10)}
                    value={visibleTimeRange[0]}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setVisibleTimeRange([val, Math.max(val + 10, visibleTimeRange[1])]);
                    }}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                  />
                  <button
                    onClick={() => setVisibleTimeRange([0, 100])}
                    className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 text-[11px]"
                  >
                    전체 구간
                  </button>
                </div>
              </div>

              {/* Spectral View and Anomalies Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* FFT Frequency Spectrum */}
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    theme === "night" ? "bg-slate-800/60 border-slate-700" : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-4 h-4 text-blue-500" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        FFT 주파수 스펙트럼 (상위 피크 주파수)
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      분해능: {(analysis.sampleRateHz / 128).toFixed(1)} Hz
                    </span>
                  </div>

                  <div className="w-full h-44 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 relative bg-slate-950">
                    <canvas
                      ref={spectrumCanvasRef}
                      width={440}
                      height={170}
                      className="w-full h-full block"
                    />
                  </div>
                </div>

                {/* Detected Anomalies in CSV */}
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    theme === "night" ? "bg-slate-800/60 border-slate-700" : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        CSV 내 이상 징후 감지 ({analysis.detectedAnomalies.length}건)
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      임계치 초과 지점 목록
                    </span>
                  </div>

                  <div className="h-44 overflow-y-auto space-y-2 pr-1">
                    {analysis.detectedAnomalies.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-1" />
                        <span>임계치를 초과하는 위험 이상 징후가 없습니다.</span>
                      </div>
                    ) : (
                      analysis.detectedAnomalies.map((anom, idx) => (
                        <div
                          key={anom.id || idx}
                          className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                            anom.severity === "CRITICAL"
                              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
                              : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                          }`}
                        >
                          <div>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  anom.severity === "CRITICAL"
                                    ? "bg-rose-600 text-white"
                                    : "bg-amber-500 text-white"
                                }`}
                              >
                                {anom.severity}
                              </span>
                              <span className="font-mono font-semibold">{anom.type}</span>
                            </div>
                            <p className="text-[11px] mt-1 text-slate-600 dark:text-slate-300">
                              {anom.description}
                            </p>
                          </div>

                          <div className="text-right font-mono shrink-0 ml-2">
                            <div className="font-bold text-xs">{anom.magnitude} m/s²</div>
                            <div className="text-[10px] text-slate-400">RMS: {anom.rms}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Gemini AI Diagnosis Box */}
              <div
                className={`p-4 rounded-xl border space-y-3 ${
                  theme === "night" ? "bg-slate-800/80 border-slate-700" : "bg-cyan-50/50 border-cyan-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Brain className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        Google Gemini AI 기반 CSV 진동 결함 종합 진단
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        측정된 통계치(RMS, 첨도, 파고율, 주요 주파수)를 AI 모델이 공학적으로 분석합니다
                      </p>
                    </div>
                  </div>

                  <button
                    id="request-csv-ai-diagnosis-btn"
                    onClick={handleRequestAiDiagnosis}
                    disabled={isAiLoading}
                    className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-sm disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isAiLoading ? "AI 진단 생성 중..." : "AI 정밀 진단 요청"}</span>
                  </button>
                </div>

                {csvAiDiagnosis && (
                  <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 text-xs animate-in fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-cyan-700 dark:text-cyan-300">
                          {csvAiDiagnosis.faultType}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          신뢰도: {csvAiDiagnosis.confidenceScore}%
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                        긴급도: {csvAiDiagnosis.urgency}
                      </span>
                    </div>

                    <p className="font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                      💡 {csvAiDiagnosis.summary}
                    </p>

                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950 p-2.5 rounded-md font-mono text-[11px]">
                      {csvAiDiagnosis.technicalDetails}
                    </p>

                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        권장 조치 수칙:
                      </span>
                      <ul className="space-y-1 list-disc list-inside text-slate-600 dark:text-slate-400 text-[11px]">
                        {csvAiDiagnosis.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          className={`px-5 py-4 border-t flex flex-wrap items-center justify-between gap-3 ${
            theme === "night" ? "border-slate-800 bg-slate-900/80" : "border-slate-100 bg-slate-50/80"
          }`}
        >
          <div className="flex items-center space-x-2">
            {analysis && (
              <button
                id="download-analysis-report-btn"
                onClick={downloadAnalysisReport}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium flex items-center space-x-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>분석 리포트 저장 (.txt)</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              닫기
            </button>

            {analysis && (
              <button
                id="apply-csv-to-monitor-btn"
                onClick={handleApplyToMonitor}
                className="px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-md transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>실시간 모니터에 데이터 적용</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
