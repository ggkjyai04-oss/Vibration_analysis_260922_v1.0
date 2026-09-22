import React from "react";
import { SimulationScenario } from "../types";
import { Sliders, AlertTriangle, Play, Sparkles } from "lucide-react";

interface Props {
  currentScenario: SimulationScenario;
  onSelectScenario: (scenario: SimulationScenario) => void;
  onInjectSpike: () => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
}

const SCENARIOS: {
  id: SimulationScenario;
  name: string;
  desc: string;
  badge: string;
  badgeColor: string;
}[] = [
  {
    id: "NORMAL_STABLE",
    name: "정상 상태 (Normal)",
    desc: "바닥 또는 거치대 미세 잔류 진동 (RMS < 0.8 m/s²)",
    badge: "정상",
    badgeColor: "text-emerald-700 bg-emerald-50 border-emerald-200 font-semibold",
  },
  {
    id: "MOTOR_IMBALANCE",
    name: "회전체 불평형 (Unbalance)",
    desc: "1X 회전주파수(30Hz) 지속 조화 진동 (RMS ~ 4.5 m/s²)",
    badge: "주의",
    badgeColor: "text-amber-800 bg-amber-50 border-amber-200 font-semibold",
  },
  {
    id: "BEARING_FAULT",
    name: "베어링 결함 (Bearing Fault)",
    desc: "간헐적 고주파 충격파 및 높은 첨도(Kurtosis > 5.5)",
    badge: "위험",
    badgeColor: "text-rose-700 bg-rose-50 border-rose-200 font-semibold",
  },
  {
    id: "SEISMIC_TREMOR",
    name: "지진/구조물 요동 (Seismic)",
    desc: "2~3Hz 저주파 대변위 전단 진동 (P/S-wave)",
    badge: "경보",
    badgeColor: "text-orange-800 bg-orange-50 border-orange-200 font-semibold",
  },
  {
    id: "IMPACT_SHOCK",
    name: "순간 충격/낙하 (Shock/Drop)",
    desc: "순간 가속도 25m/s² 이상의 극한 충격 이벤트",
    badge: "위험",
    badgeColor: "text-rose-800 bg-rose-100 border-rose-300 font-bold",
  },
];

export const SimulationController: React.FC<Props> = ({
  currentScenario,
  onSelectScenario,
  onInjectSpike,
  isSimulating,
  onToggleSimulation,
}) => {
  return (
    <div id="simulation-controller" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
            S24 Ultra 진동 시뮬레이터 및 결함 주입기
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleSimulation}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all shadow-2xs ${
              isSimulating
                ? "bg-cyan-50 text-cyan-800 border border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-700 font-semibold"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700"
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isSimulating ? "text-cyan-600 dark:text-cyan-400 animate-pulse" : ""}`} />
            <span>{isSimulating ? "시뮬레이션 동작 중" : "시뮬레이션 정지됨"}</span>
          </button>
        </div>
      </div>

      {/* Scenario buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {SCENARIOS.map((sc) => {
          const isSelected = currentScenario === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => onSelectScenario(sc.id)}
              className={`text-left p-3 rounded-xl border transition-all ${
                isSelected
                  ? "bg-cyan-50/70 dark:bg-cyan-950/40 border-cyan-500 dark:border-cyan-500 shadow-xs ring-1 ring-cyan-400"
                  : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/70 dark:hover:bg-slate-800"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">{sc.name}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${sc.badgeColor} dark:bg-opacity-20`}>
                  {sc.badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                {sc.desc}
              </p>
            </button>
          );
        })}

        {/* Immediate Fault Shock Injection */}
        <button
          onClick={onInjectSpike}
          className="text-left p-3 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-900/50 transition-all group flex flex-col justify-between shadow-2xs"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-xs text-rose-800 dark:text-rose-300 flex items-center space-x-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>이상 진동 긴급 주입</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-200 dark:bg-rose-900/70 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 font-bold">
              Trigger
            </span>
          </div>
          <p className="text-[11px] text-rose-700 dark:text-rose-300/90 leading-relaxed">
            클릭 즉시 28m/s² 충격 스파이크를 발생시켜 실시간 경보와 햅틱 피드백을 테스트합니다.
          </p>
        </button>
      </div>
    </div>
  );
};
