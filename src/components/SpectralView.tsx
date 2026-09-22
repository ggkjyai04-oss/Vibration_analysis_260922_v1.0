import React, { useMemo } from "react";
import { VibrationSample } from "../types";
import { calculateFFT } from "../utils/vibrationAnalysis";
import { BarChart3, Radio } from "lucide-react";

interface Props {
  samples: VibrationSample[];
  sampleRate?: number;
}

export const SpectralView: React.FC<Props> = ({ samples, sampleRate = 60 }) => {
  const fftData = useMemo(() => {
    if (samples.length < 16) {
      return { frequencies: [], magnitudes: [], peakFreq: 0, peakMag: 0 };
    }
    const magValues = samples.slice(-128).map((s) => s.filteredMagnitude);
    const result = calculateFFT(magValues, sampleRate);

    let maxMag = 0;
    let maxFreq = 0;
    for (let i = 0; i < result.magnitudes.length; i++) {
      if (result.magnitudes[i] > maxMag) {
        maxMag = result.magnitudes[i];
        maxFreq = result.frequencies[i];
      }
    }

    return {
      frequencies: result.frequencies,
      magnitudes: result.magnitudes,
      peakFreq: maxFreq,
      peakMag: maxMag,
    };
  }, [samples, sampleRate]);

  // Max magnitude for scaling bars
  const maxDisplayMag = Math.max(2.0, fftData.peakMag * 1.25);

  return (
    <div id="spectral-view-panel" className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs p-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
            주파수 스펙트럼 (FFT Spectrum)
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="flex items-center space-x-1 px-2.5 py-1 bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 rounded-md text-xs font-mono text-cyan-800 dark:text-cyan-300 font-medium">
            <Radio className="w-3 h-3 animate-pulse text-cyan-600 dark:text-cyan-400 mr-1" />
            주 진동수:{" "}
            <span className="font-bold text-slate-900 dark:text-slate-100 ml-1">
              {fftData.peakFreq.toFixed(1)} Hz
            </span>
          </span>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 hidden sm:inline">
            진폭: {fftData.peakMag.toFixed(2)} m/s²
          </span>
        </div>
      </div>

      {/* Spectrum Bars */}
      <div className="h-44 w-full flex items-end justify-between gap-1 pt-4 pb-2 px-1 relative bg-slate-50/50 dark:bg-slate-950/60 rounded-lg">
        {/* Background guideline */}
        <div className="absolute inset-x-0 top-6 border-b border-dashed border-slate-200 dark:border-slate-800 pointer-events-none" />
        <div className="absolute inset-x-0 top-20 border-b border-dashed border-slate-200 dark:border-slate-800 pointer-events-none" />

        {fftData.frequencies.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-xs font-mono text-slate-400 dark:text-slate-500">
            충분한 샘플 취득 후 주파수 성분을 연산합니다...
          </div>
        ) : (
          fftData.frequencies.slice(0, 32).map((freq, idx) => {
            const mag = fftData.magnitudes[idx] || 0;
            const heightPct = Math.min(100, Math.max(4, (mag / maxDisplayMag) * 100));
            const isPeak = Math.abs(freq - fftData.peakFreq) < 0.5 && mag > 0.4;

            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center group relative h-full justify-end"
              >
                {/* Tooltip on hover */}
                <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-800 dark:bg-slate-700 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow-md whitespace-nowrap z-10">
                  {freq.toFixed(1)}Hz : {mag.toFixed(2)}m/s²
                </div>

                {/* Bar */}
                <div
                  className={`w-full rounded-t transition-all duration-100 ${
                    isPeak
                      ? "bg-gradient-to-t from-cyan-600 via-cyan-500 to-amber-500 dark:from-cyan-500 dark:via-cyan-400 dark:to-amber-400 shadow-xs"
                      : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700"
                  }`}
                  style={{ height: `${heightPct}%` }}
                />

                {/* X-axis tick label (sampled) */}
                {idx % 4 === 0 && (
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1 select-none">
                    {freq.toFixed(0)}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 mt-2">
        <span>0 Hz (DC)</span>
        <span className="text-slate-600 dark:text-slate-300 font-medium">가속도 FFT 주파수 (Hz)</span>
        <span>~{(sampleRate / 2).toFixed(0)} Hz (Nyquist)</span>
      </div>
    </div>
  );
};
