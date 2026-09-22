import React, { useMemo } from "react";
import { AnomalyEvent } from "../types";
import {
  AlertOctagon,
  Volume2,
  VolumeX,
  Trash2,
  Download,
  Brain,
  CheckCircle,
  Bell,
  Clock,
  Radio,
} from "lucide-react";

interface Props {
  anomalies: AnomalyEvent[];
  isMuted: boolean;
  onToggleMute: () => void;
  onClearLogs: () => void;
  onAcknowledge: (id: string) => void;
  onRequestDiagnosis: (anomaly: AnomalyEvent) => void;
  activeAlert: AnomalyEvent | null;
}

export const AnomalyAlertPanel: React.FC<Props> = ({
  anomalies,
  isMuted,
  onToggleMute,
  onClearLogs,
  onAcknowledge,
  onRequestDiagnosis,
  activeAlert,
}) => {
  // Deduplicate anomalies by unique ID to prevent any duplicate React keys
  const uniqueAnomalies = useMemo(() => {
    const seen = new Set<string>();
    const result: AnomalyEvent[] = [];
    for (const item of anomalies) {
      if (!item.id || seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(item);
    }
    return result;
  }, [anomalies]);

  const handleExport = () => {
    if (uniqueAnomalies.length === 0) return;
    const csvHeader = "ID,Timestamp,Severity,Type,Magnitude(m/s2),RMS(m/s2),DominantFreq(Hz),Description\n";
    const csvRows = uniqueAnomalies.map((a) =>
      `"${a.id}","${new Date(a.timestamp).toISOString()}","${a.severity}","${a.type}","${a.magnitude.toFixed(2)}","${a.rms.toFixed(2)}","${a.dominantFreq.toFixed(1)}","${a.description}"`
    );
    const blob = new Blob([csvHeader + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `galaxy-s24u-vibration-anomalies-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="anomaly-alert-panel" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs flex flex-col transition-colors">
      {/* Active High-Priority Alert Banner if triggered */}
      {activeAlert && (
        <div className="p-3 bg-gradient-to-r from-rose-50 via-rose-100/70 to-white dark:from-rose-950/60 dark:via-rose-900/40 dark:to-slate-900 border-b border-rose-200 dark:border-rose-900/50 flex flex-wrap items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-rose-600 text-white shadow-sm animate-bounce">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-rose-600 text-white">
                  긴급 이상 진동 감지
                </span>
                <span className="text-xs font-mono text-rose-700 dark:text-rose-400 font-medium">
                  {new Date(activeAlert.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm font-semibold text-rose-950 dark:text-rose-200 mt-0.5">
                {activeAlert.description} — 피크 {activeAlert.magnitude.toFixed(2)} m/s² (RMS: {activeAlert.rms.toFixed(2)} m/s²)
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onRequestDiagnosis(activeAlert)}
              className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <Brain className="w-4 h-4" />
              <span>AI 원인 분석</span>
            </button>
            <button
              onClick={() => onAcknowledge(activeAlert.id)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs font-medium rounded-lg border border-rose-300 dark:border-rose-800 transition-colors shadow-2xs"
            >
              경보 해제
            </button>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/80 gap-2">
        <div className="flex items-center space-x-2">
          <Bell className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
            실시간 이상 진동 이벤트 기록
          </span>
          <span className="px-2 py-0.5 text-xs font-mono rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
            총 {uniqueAnomalies.length}건
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          {/* Audio Mute toggle */}
          <button
            onClick={onToggleMute}
            className={`p-1.5 rounded-lg border transition-colors ${
              isMuted
                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700"
                : "bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800"
            }`}
            title={isMuted ? "알람 음소거 해제" : "알람 음소거"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExport}
            disabled={uniqueAnomalies.length === 0}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 rounded-lg flex items-center space-x-1 transition-colors border border-slate-200 dark:border-slate-700 shadow-2xs"
            title="CSV 파일로 다운로드"
          >
            <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline font-medium">CSV 내보내기</span>
          </button>

          {/* Clear Logs */}
          <button
            onClick={onClearLogs}
            disabled={uniqueAnomalies.length === 0}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-700 dark:hover:text-rose-400 disabled:opacity-40 text-slate-600 dark:text-slate-400 rounded-lg flex items-center space-x-1 transition-colors border border-slate-200 dark:border-slate-700 shadow-2xs"
            title="기록 지우기"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-medium">비우기</span>
          </button>
        </div>
      </div>

      {/* Anomaly list */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-72 overflow-y-auto">
        {uniqueAnomalies.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs font-mono space-y-2">
            <CheckCircle className="w-8 h-8 text-emerald-500 dark:text-emerald-400" />
            <span className="text-slate-600 dark:text-slate-400">현재 감지된 이상 진동이 없습니다. 시스템 정상 작동 중.</span>
          </div>
        ) : (
          uniqueAnomalies.map((anom, idx) => {
            const isCrit = anom.severity === "CRITICAL";
            return (
              <div
                key={`${anom.id || "anom"}-${idx}`}
                className={`p-3 sm:px-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                  anom.acknowledged
                    ? "bg-slate-50/50 dark:bg-slate-900/40 opacity-60"
                    : isCrit
                    ? "bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                    : "bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                }`}
              >
                {/* Left: icon & details */}
                <div className="flex items-start space-x-3">
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${
                      isCrit
                        ? "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                        : "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                    }`}
                  >
                    <AlertOctagon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${
                          isCrit
                            ? "bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-700"
                            : "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700"
                        }`}
                      >
                        {anom.severity}
                      </span>
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 font-sans">
                        {anom.description}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(anom.timestamp).toLocaleTimeString()}</span>
                      </span>
                    </div>

                    {/* Numeric stats */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs font-mono text-slate-500 dark:text-slate-400">
                      <span>
                        피크:{" "}
                        <strong className="text-slate-800 dark:text-slate-200 font-semibold">
                          {anom.magnitude.toFixed(2)} m/s²
                        </strong>
                      </span>
                      <span>
                        RMS:{" "}
                        <strong className="text-slate-800 dark:text-slate-200 font-semibold">
                          {anom.rms.toFixed(2)} m/s²
                        </strong>
                      </span>
                      <span>
                        주파수:{" "}
                        <strong className="text-cyan-700 dark:text-cyan-400 font-semibold">
                          {anom.dominantFreq.toFixed(1)} Hz
                        </strong>
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">기기: {anom.deviceId}</span>
                    </div>
                  </div>
                </div>

                {/* Right actions */}
                <div className="flex items-center space-x-2 self-end sm:self-center">
                  <button
                    onClick={() => onRequestDiagnosis(anom)}
                    className="px-2.5 py-1 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 rounded-lg text-xs font-medium flex items-center space-x-1 transition-all shadow-2xs"
                  >
                    <Brain className="w-3.5 h-3.5 text-cyan-700 dark:text-cyan-400" />
                    <span>AI 진단 리포트</span>
                  </button>
                  {!anom.acknowledged && (
                    <button
                      onClick={() => onAcknowledge(anom.id)}
                      className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono transition-colors shadow-2xs"
                    >
                      확인
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
