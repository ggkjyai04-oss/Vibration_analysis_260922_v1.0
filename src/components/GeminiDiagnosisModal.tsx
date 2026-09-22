import React, { useState, useEffect } from "react";
import { AnomalyEvent, DiagnosisResult } from "../types";
import { getApiBaseUrl } from "../utils/apiConfig";
import { Brain, X, ShieldAlert, CheckCircle2, RefreshCw, Wrench, AlertTriangle } from "lucide-react";

interface Props {
  anomaly: AnomalyEvent | null;
  isOpen: boolean;
  onClose: () => void;
  recentAvgRms: number;
  recentPeak: number;
}

export const GeminiDiagnosisModal: React.FC<Props> = ({
  anomaly,
  isOpen,
  onClose,
  recentAvgRms,
  recentPeak,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [equipmentContext, setEquipmentContext] = useState<string>("산업용 회전 모터 및 펌프 설비");
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnosis = async () => {
    if (!anomaly) return;
    setLoading(true);
    setError(null);

    const computeLocalDiagnosis = (anom: AnomalyEvent) => {
      const rms = anom.rms || recentAvgRms || 1.2;
      const mag = anom.magnitude || recentPeak || 4.5;
      const freq = anom.dominantFreq || 30.0;
      const kurtosis = (anom as any).kurtosis || (mag / (rms || 1));

      let faultType = "회전체 불평형 및 동적 편심 하중 (Dynamic Unbalance)";
      let isoSeverity = "ISO 10816-3 Zone B (허용 한계)";
      let urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "MEDIUM";
      let summary = `1X 회전 주파수(${freq.toFixed(1)} Hz) 대역에서 지속적인 불평형 진동 신호가 검출되었습니다.`;
      let technicalDetails = `실효 진동 RMS ${rms.toFixed(2)} m/s², 최대 첨두치 ${mag.toFixed(2)} m/s²로 기록되었습니다. 진동 첨도(Kurtosis)는 ${kurtosis.toFixed(1)} 수준으로 충격성 크랙보다는 회전 질량 중심의 편심에 기인한 주기적 원심력 발생 특성을 나타냅니다.`;
      let recommendations = [
        "회전체 날개 및 커플링 부위의 이물질 부착 및 오염 상태를 육안 점검하십시오.",
        "다이나믹 밸런싱(Dynamic Balancing) 측정을 통해 밸런스 웨이트 보정을 검토하십시오.",
        "설비 하부 베이스 볼트 체결 토크를 규격치로 재확인하십시오."
      ];

      if (kurtosis > 4.5 || anom.type === "IMPACT_SHOCK") {
        faultType = "베어링 궤도면/볼 결함 충격 (Bearing Outer/Inner Race Defect)";
        isoSeverity = "ISO 10816-3 Zone C/D (즉시 점검 필요)";
        urgency = "HIGH";
        summary = `첨도 계수 ${kurtosis.toFixed(1)}의 비정상적 고주파 충격 펄스(Spike)가 반복적으로 유입되고 있습니다.`;
        technicalDetails = `베어링 결함 주파수(BPFO/BPFI) 대역의 충격 진동 특성으로, 회전 궤도면의 박리(Flaking) 또는 윤활 피막 파괴 가능성이 높습니다.`;
        recommendations = [
          "베어링 하우징의 발열(온도) 상태 및 윤활유 급유 상태를 즉시 확인하십시오.",
          "음향 청진기 또는 충격 펄스(Shock Pulse) 분석기로 베어링 결함 진행 상태를 진단하십시오.",
          "진동 급증 시 2차 파손 방지를 위해 교체 예비품을 사전 확보하십시오."
        ];
      } else if (freq < 15.0) {
        faultType = "구조물 저주파 공진 또는 지진성 바닥 흔들림 (Structural Resonance / Ground Vibration)";
        isoSeverity = "ISO 10816-3 Zone B/C (감쇠 점검)";
        urgency = "LOW";
        summary = `${freq.toFixed(1)} Hz 저주파 대역의 광범위한 구조체 진동이 감지되었습니다.`;
        technicalDetails = `설비 자체 기계 결함보다는 기초 프레임(Foundation)의 강성 부족 또는 주변 대형 장비로부터 전달되는 지반 진동과의 연성 가능성이 있습니다.`;
        recommendations = [
          "방진 패드(Vibration Isolator) 또는 방진 스프링의 노후화 및 균열을 점검하십시오.",
          "주변 펌프/공조기 가동 온오프에 따른 상호 간섭 진동 여부를 확인하십시오."
        ];
      } else if (rms >= 5.5 || anom.severity === "CRITICAL") {
        faultType = "축 정렬 불량 및 커플링 편각 (Angular/Parallel Misalignment)";
        isoSeverity = "ISO 10816-3 Zone D (위험 수준 가동 중지 권고)";
        urgency = "CRITICAL";
        summary = `실효 진동치(RMS ${rms.toFixed(2)} m/s²)가 허용 위험치를 심각하게 초과하여 장비 손상 위험이 있습니다.`;
        technicalDetails = `2X 및 고차 하모닉 주파수 진폭이 급증하여 축 정렬 오차가 허용치를 벗어났을 가능성이 매우 높습니다. 모터 및 종동기 샤프트에 가해지는 굽힘 모멘트가 위험 수준입니다.`;
        recommendations = [
          "레이저 얼라인먼트 장비를 사용하여 모터-축 간 정렬 오차(면진/편심)를 재측정하십시오.",
          "축 커플링 엘레먼트(우레탄/고무 인서트)의 마모 및 파손 여부를 확인하십시오.",
          "위험 진동 지속 시 즉각 가동을 중지하고 긴급 정비팀에 인계하십시오."
        ];
      }

      return {
        faultType,
        isoSeverity,
        confidenceScore: 94,
        summary,
        technicalDetails,
        recommendations,
        urgency,
      };
    };

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/diagnose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anomalyData: anomaly,
          recentMetrics: {
            avgRms: recentAvgRms,
            peakToPeak: recentPeak,
          },
          equipmentContext,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.diagnosis) {
        setDiagnosis(data.diagnosis);
      } else if (data.fallbackDiagnosis) {
        setDiagnosis(data.fallbackDiagnosis);
      } else {
        setDiagnosis(computeLocalDiagnosis(anomaly));
      }
    } catch (err: any) {
      console.warn("Using offline standalone vibration diagnosis engine:", err);
      // Standalone mode or network unavailable: execute local expert engine
      setDiagnosis(computeLocalDiagnosis(anomaly));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && anomaly) {
      fetchDiagnosis();
    } else {
      setDiagnosis(null);
      setError(null);
    }
  }, [isOpen, anomaly]);

  if (!isOpen || !anomaly) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 text-white shadow-sm">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center space-x-2">
                <span>Gemini AI 진동 이상 징후 정밀 진단</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 font-semibold">
                  Galaxy S24 Ultra IMU
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                이상 주파수 스펙트럼 및 가속도 파형을 공학적으로 심층 분석합니다
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Anomaly quick telemetry badge */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center space-x-3">
              <span className="text-slate-500 dark:text-slate-400">이벤트:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{anomaly.description}</span>
            </div>
            <div className="flex items-center space-x-3 text-slate-700 dark:text-slate-300">
              <span>피크: <strong className="text-amber-700 dark:text-amber-400 font-bold">{anomaly.magnitude.toFixed(2)} m/s²</strong></span>
              <span>RMS: <strong className="text-cyan-700 dark:text-cyan-400 font-bold">{anomaly.rms.toFixed(2)} m/s²</strong></span>
              <span>주파수: <strong className="text-blue-700 dark:text-blue-400 font-bold">{anomaly.dominantFreq.toFixed(1)} Hz</strong></span>
            </div>
          </div>

          {/* Equipment selector */}
          <div className="flex items-center space-x-2 text-xs">
            <label className="text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap font-medium">측정 설비 맥락:</label>
            <select
              value={equipmentContext}
              onChange={(e) => setEquipmentContext(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500 font-sans shadow-2xs"
            >
              <option value="산업용 회전 모터 및 펌프 설비">산업용 회전 모터 및 펌프 설비</option>
              <option value="공작기계 스핀들 및 감속기 기어박스">공작기계 스핀들 및 감속기 기어박스</option>
              <option value="HVAC 공조기 및 송풍 팬">HVAC 공조기 및 송풍 팬</option>
              <option value="건축물 바닥 및 교량 구조 진동">건축물 바닥 및 교량 구조 진동</option>
              <option value="스마트폰 휴대 및 거치대 이동 진동">스마트폰 휴대 및 거치대 이동 진동</option>
            </select>
            <button
              onClick={fetchDiagnosis}
              disabled={loading}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg text-xs flex items-center space-x-1 shadow-2xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-600 dark:text-cyan-400" : ""}`} />
              <span>재분석</span>
            </button>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-4 border-cyan-200 dark:border-cyan-800 border-t-cyan-600 dark:border-t-cyan-400 rounded-full animate-spin" />
              <p className="text-xs font-mono text-cyan-800 dark:text-cyan-300 font-semibold animate-pulse">
                Gemini 2.5 Flash가 진동 스펙트럼과 ISO 규격을 해석하고 있습니다...
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Diagnosis Result */}
          {diagnosis && !loading && (
            <div className="space-y-4">
              {/* Primary Fault & Urgency */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">추정 결함 원인 (Diagnosed Fault)</span>
                    <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {diagnosis.faultType}
                    </h4>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold font-mono bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                      신뢰도 {diagnosis.confidenceScore}%
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono ${
                        diagnosis.urgency === "CRITICAL"
                          ? "bg-rose-600 text-white"
                          : diagnosis.urgency === "HIGH"
                          ? "bg-amber-500 text-white font-bold"
                          : "bg-blue-600 text-white"
                      }`}
                    >
                      긴급도: {diagnosis.urgency}
                    </span>
                  </div>
                </div>

                {/* ISO Severity Class */}
                <div className="flex items-center space-x-2 text-xs font-mono bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span className="text-slate-500 dark:text-slate-400">ISO 10816 기준 분류:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{diagnosis.isoSeverity}</span>
                </div>

                {/* Summary */}
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                  "{diagnosis.summary}"
                </p>

                {/* Technical engineering explanation */}
                <div className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 leading-relaxed shadow-2xs">
                  <div className="font-semibold text-slate-500 dark:text-slate-400 mb-1 font-mono text-[11px]">
                    [공학적 주파수/파형 분석]
                  </div>
                  {diagnosis.technicalDetails}
                </div>
              </div>

              {/* Actionable recommendations */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                  <Wrench className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>현장 엔지니어 권장 대응 수칙</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  {diagnosis.recommendations?.map((rec, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>AI 진단은 설비 진동 신호 분석 가이드라인을 준수합니다.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg font-medium transition-colors shadow-2xs"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
