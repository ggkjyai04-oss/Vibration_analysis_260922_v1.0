import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Smartphone,
  X,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Wifi,
  AlertTriangle,
  Send,
  Globe,
  Radio,
} from "lucide-react";
import { CLOUD_APP_URL, isLocalFileMode } from "../utils/apiConfig";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSensorMode: () => void;
}

type TabType = "cloud" | "standalone" | "custom_ip";

export const DeviceConnectorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSwitchToSensorMode,
}) => {
  const isFileProtocol = typeof window !== "undefined" && window.location.protocol === "file:";
  const [activeTab, setActiveTab] = useState<TabType>(isFileProtocol ? "cloud" : "cloud");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [customIp, setCustomIp] = useState<string>("http://192.168.0.10:3000");

  // Determine active sensor target URL based on active tab
  let targetUrl = `${CLOUD_APP_URL}?mode=sensor`;

  if (!isFileProtocol && typeof window !== "undefined") {
    const origin = window.location.origin;
    if (activeTab === "cloud") {
      targetUrl = `${origin}?mode=sensor`;
    } else if (activeTab === "custom_ip") {
      targetUrl = customIp.includes("?mode=sensor") ? customIp : `${customIp}?mode=sensor`;
    }
  } else {
    if (activeTab === "cloud") {
      targetUrl = `${CLOUD_APP_URL}?mode=sensor`;
    } else if (activeTab === "custom_ip") {
      targetUrl = customIp.includes("?mode=sensor") ? customIp : `${customIp}?mode=sensor`;
    }
  }

  useEffect(() => {
    if (isOpen && targetUrl && activeTab !== "standalone") {
      QRCode.toDataURL(targetUrl, {
        width: 260,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#f8fafc",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error(err));
    }
  }, [isOpen, targetUrl, activeTab]);

  const handleCopy = (textToCopy: string) => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl transition-colors max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                갤럭시 S24 울트라 무선 센서 연동
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                실물 기기의 가속도 센서를 IoT 진동 프로브로 연결합니다
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

        {/* Notice for local file:/// executions */}
        {isFileProtocol && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start space-x-2.5 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="font-semibold block text-amber-900 dark:text-amber-100 mb-0.5">
                로컬 파일(file://) 실행 감지 안내
              </strong>
              스마트폰 카메라는 PC 내부 저장소(<code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 rounded">C:\...</code>) 경로를 직접 열 수 없습니다. 아래 <strong>[클라우드 무선 연동]</strong> QR을 스캔하시거나 <strong>[폰에서 단독 실행]</strong>을 이용해 주세요.
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-6 pt-3 flex space-x-2 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("cloud")}
            className={`pb-2.5 px-2 text-xs font-semibold flex items-center space-x-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === "cloud"
                ? "border-cyan-600 text-cyan-600 dark:text-cyan-400 dark:border-cyan-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>무선 클라우드 연동 (QR)</span>
          </button>

          <button
            onClick={() => setActiveTab("standalone")}
            className={`pb-2.5 px-2 text-xs font-semibold flex items-center space-x-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === "standalone"
                ? "border-cyan-600 text-cyan-600 dark:text-cyan-400 dark:border-cyan-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>폰에서 단독 실행 (오프라인)</span>
          </button>

          <button
            onClick={() => setActiveTab("custom_ip")}
            className={`pb-2.5 px-2 text-xs font-semibold flex items-center space-x-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === "custom_ip"
                ? "border-cyan-600 text-cyan-600 dark:text-cyan-400 dark:border-cyan-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>로컬 IP 입력</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeTab === "cloud" && (
            <>
              {/* QR Code section */}
              <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                {qrDataUrl ? (
                  <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200">
                    <img src={qrDataUrl} alt="Galaxy S24 Ultra Sensor QR Code" className="w-44 h-44" />
                  </div>
                ) : (
                  <div className="w-44 h-44 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl" />
                )}
                <div className="mt-3 flex items-center space-x-2 text-xs font-mono text-cyan-700 dark:text-cyan-300 font-semibold">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>갤럭시 카메라로 QR 코드를 스캔하세요</span>
                </div>
              </div>

              {/* Direct URL with Copy */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-600 dark:text-slate-400 font-medium">
                  공용 모바일 센서 송신 주소
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={targetUrl}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 select-all focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={() => handleCopy(targetUrl)}
                    className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors shadow-2xs cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>복사됨</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>복사</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Steps */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700 text-xs space-y-2 text-slate-600 dark:text-slate-300">
                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                  <Wifi className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>실시간 무선 연동 가이드</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                  <li>갤럭시 S24 기본 카메라로 위 QR 코드를 스캔하여 브라우저로 엽니다.</li>
                  <li>스마트폰 화면에서 <strong>'센서 스트리밍 시작'</strong> 버튼을 누릅니다.</li>
                  <li>갤럭시 폰을 진동 측정 대상(설비, 모터, 책상 등)에 거치합니다.</li>
                  <li>스마트폰에서 감지된 가속도 진동 데이터가 현재 PC 대시보드로 실시간 스트리밍됩니다!</li>
                </ol>
              </div>

              {/* 404 Page Not Found Solution Guide */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs space-y-1.5 text-amber-900 dark:text-amber-200">
                <div className="font-semibold flex items-center space-x-1.5 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>스마트폰 화면에 'Error: Page not found'가 표시되나요?</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                  클라우드 공유 주소는 AI Studio 웹 화면 우측 상단의 <strong>[Share (공유)]</strong> 버튼을 한 번 눌러야 외부 접속이 정식 활성화됩니다.
                </p>
                <div className="pt-1">
                  <button
                    onClick={() => setActiveTab("standalone")}
                    className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 underline hover:text-cyan-800 flex items-center space-x-1 cursor-pointer"
                  >
                    <span>👉 설정 없이 즉시 측정: [폰에서 단독 실행] 탭 안내 보기</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === "standalone" && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
                <div className="font-semibold text-emerald-900 dark:text-emerald-100 text-sm flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>인터넷/서버 필요 없는 100% 완전 단독 측정기</span>
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1 leading-relaxed">
                  다운로드받으신 단일 HTML 파일은 그 자체로 완전한 계측 프로그램입니다. 파일을 스마트폰에 넣고 열면 스마트폰 자체가 전문 진동 계측기(오실로스코프 + FFT + 경보)로 동작합니다!
                </p>
              </div>

              <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <span className="font-bold text-cyan-700 dark:text-cyan-400">1단계: HTML 파일을 갤럭시 폰으로 전송</span>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    PC의 <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-[11px]">galaxy_s24_ultra_vibration_monitor.html</code> 파일을 <strong>카카오톡 '나에게 보내기'</strong>, <strong>Quick Share(퀵셰어)</strong>, <strong>구글 드라이브</strong> 또는 <strong>USB</strong>로 폰에 전송하여 다운로드합니다.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <span className="font-bold text-cyan-700 dark:text-cyan-400">2단계: 폰의 크롬(Chrome) 또는 삼성 인터넷으로 열기</span>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    갤럭시의 <strong>'내 파일' ➔ 다운로드 폴더</strong>에서 해당 파일을 터치하고 <strong>Chrome</strong> 또는 <strong>삼성 인터넷</strong>으로 엽니다.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <span className="font-bold text-cyan-700 dark:text-cyan-400">3단계: [센서 송신 모드] 누르고 즉시 측정 시작</span>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    화면 상단의 <strong>[센서 송신 모드]</strong> 버튼을 누르면 갤럭시 S24 울트라 내장 6축 센서가 즉시 활성화되어 60FPS 실시간 그래프와 위험 경보가 폰 자체에서 구동됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "custom_ip" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-600 dark:text-slate-400 font-medium">
                  PC 로컬 Wi-Fi IP 주소 및 포트
                </label>
                <input
                  type="text"
                  value={customIp}
                  onChange={(e) => setCustomIp(e.target.value)}
                  placeholder="예: http://192.168.0.15:3000"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  PC 명령 프롬프트(cmd)에서 <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">ipconfig</code>를 입력하여 확인한 무선 LAN IPv4 주소를 입력하시면, 해당 IP로 QR 코드가 자동 생성됩니다. (PC와 폰이 같은 Wi-Fi에 연결되어 있어야 합니다.)
                </p>
              </div>

              {/* QR Preview for Custom IP */}
              <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                {qrDataUrl ? (
                  <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200">
                    <img src={qrDataUrl} alt="Custom IP Sensor QR" className="w-40 h-40" />
                  </div>
                ) : (
                  <div className="w-40 h-40 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl" />
                )}
                <span className="mt-2 text-xs font-mono text-slate-600 dark:text-slate-400">
                  {targetUrl}
                </span>
              </div>
            </div>
          )}

          {/* Mode switch option for this device */}
          <div className="pt-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-slate-500 dark:text-slate-400">현재 브라우저에서 바로 센서 모드로 전환하시겠습니까?</span>
            <button
              onClick={() => {
                onSwitchToSensorMode();
                onClose();
              }}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg flex items-center space-x-1 transition-colors shadow-2xs cursor-pointer"
            >
              <span>이 기기를 센서 노드로 사용</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
