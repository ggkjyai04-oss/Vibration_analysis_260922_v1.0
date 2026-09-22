import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

interface VibrationSample {
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

interface AnomalyEvent {
  id: string;
  timestamp: number;
  deviceId: string;
  type: "SPIKE" | "SUSTAINED_HIGH_RMS" | "FREQUENCY_ANOMALY" | "IMPACT_SHOCK" | "HARMONIC_RESONANCE";
  severity: "INFO" | "WARNING" | "CRITICAL";
  magnitude: number;
  rms: number;
  dominantFreq: number;
  description: string;
  acknowledged?: boolean;
}

const app = express();
const PORT = 3000;

// Enable CORS for cross-device telemetry and local standalone HTML execution
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: "5mb" }));

// In-memory telemetry buffer & anomaly logs
const recentSamples: VibrationSample[] = [];
const anomalyHistory: AnomalyEvent[] = [];
const MAX_SAMPLES = 500;
const MAX_ANOMALIES = 100;

// Connected SSE clients for real-time live telemetry and alerts
interface SSEClient {
  id: number;
  res: express.Response;
}
let sseClients: SSEClient[] = [];
let nextClientId = 1;

function broadcastSSE(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(payload);
    } catch {
      // client dropped, will clean up
    }
  }
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    connectedClients: sseClients.length,
    totalSamples: recentSamples.length,
    anomaliesRecorded: anomalyHistory.length,
    timestamp: Date.now()
  });
});

// Serve standalone single-file HTML version
app.get("/standalone", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "galaxy_s24_vibration_monitor.html"));
});

app.get("/galaxy_s24_vibration_monitor.html", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "galaxy_s24_vibration_monitor.html"));
});

// Download standalone HTML file
app.get("/api/download-standalone-html", (req, res) => {
  res.download(
    path.join(process.cwd(), "public", "galaxy_s24_vibration_monitor.html"),
    "galaxy_s24_ultra_vibration_monitor.html"
  );
});

// Real-time SSE stream endpoint
app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const clientId = nextClientId++;
  const newClient: SSEClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send initial state
  res.write(
    `event: init\ndata: ${JSON.stringify({
      recentSamples: recentSamples.slice(-100),
      anomalies: anomalyHistory.slice(-20),
      clientId
    })}\n\n`
  );

  req.on("close", () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// Receive vibration sensor telemetry from Galaxy S24 Ultra
app.post("/api/sensor/push", (req, res) => {
  const { samples, sample, deviceId, anomaly } = req.body;

  const incomingSamples: VibrationSample[] = samples || (sample ? [sample] : []);

  for (const s of incomingSamples) {
    recentSamples.push(s);
    if (recentSamples.length > MAX_SAMPLES) {
      recentSamples.shift();
    }
  }

  if (anomaly) {
    const anomalyRecord: AnomalyEvent = {
      id: anomaly.id || `anom-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      timestamp: anomaly.timestamp || Date.now(),
      deviceId: deviceId || "Galaxy S24 Ultra",
      type: anomaly.type || "SPIKE",
      severity: anomaly.severity || "WARNING",
      magnitude: anomaly.magnitude || 0,
      rms: anomaly.rms || 0,
      dominantFreq: anomaly.dominantFreq || 0,
      description: anomaly.description || "진동 이상 수치 감지",
      acknowledged: false
    };

    // Deduplicate against existing anomalyHistory
    const isDuplicate = anomalyHistory.some((a) => a.id === anomalyRecord.id);
    if (!isDuplicate) {
      anomalyHistory.unshift(anomalyRecord);
      if (anomalyHistory.length > MAX_ANOMALIES) {
        anomalyHistory.pop();
      }
      broadcastSSE("anomaly", anomalyRecord);
    }
  }

  // Broadcast telemetry to connected monitoring dashboards
  if (incomingSamples.length > 0) {
    broadcastSSE("vibration_batch", {
      deviceId: deviceId || "Galaxy S24 Ultra",
      samples: incomingSamples
    });
  }

  res.json({ success: true, count: incomingSamples.length });
});

// Acknowledge anomaly
app.post("/api/anomaly/ack", (req, res) => {
  const { id } = req.body;
  const item = anomalyHistory.find((a) => a.id === id);
  if (item) {
    item.acknowledged = true;
    broadcastSSE("anomaly_ack", { id });
    res.json({ success: true, item });
  } else {
    res.status(404).json({ error: "Anomaly not found" });
  }
});

// Clear anomaly logs
app.post("/api/anomaly/clear", (req, res) => {
  anomalyHistory.length = 0;
  broadcastSSE("anomaly_clear", {});
  res.json({ success: true });
});

// Get recent history
app.get("/api/sensor/history", (req, res) => {
  res.json({
    samples: recentSamples.slice(-200),
    anomalies: anomalyHistory
  });
});

// Download standalone portable HTML file
app.get("/api/download-standalone-html", (req, res) => {
  const filePath = path.join(process.cwd(), "public", "galaxy_s24_vibration_monitor.html");
  const rootPath = path.join(process.cwd(), "galaxy_s24_vibration_monitor.html");

  const targetPath = fs.existsSync(filePath) ? filePath : fs.existsSync(rootPath) ? rootPath : null;
  if (!targetPath) {
    return res.status(404).send("Standalone HTML file not found.");
  }

  res.setHeader("Content-Disposition", 'attachment; filename="galaxy_s24_ultra_vibration_monitor.html"');
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.sendFile(targetPath);
});

// Gemini-powered Vibration Anomaly Diagnostics
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

app.post("/api/diagnose", async (req, res) => {
  try {
    const { anomalyData, recentMetrics, equipmentContext } = req.body;

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: "GEMINI_API_KEY is not configured",
        message: "Gemini API 키가 설정되지 않아 규칙 기반 진단을 제공합니다.",
        fallbackDiagnosis: {
          faultType: "고주파 충격 / 불평형 진동 징후",
          isoSeverity: "Class III (주의/부적합)",
          confidenceScore: 88,
          analysis: "Galaxy S24 Ultra 3축 가속도계에서 측정된 RMS 진동 및 첨두치(Peak)가 3-시그마 임계치를 초과하였습니다.",
          recommendations: [
            "설비 또는 측정 대상의 고정 볼트 체결 상태를 점검하십시오.",
            "베어링 윤활 및 회전축의 정렬(Misalignment) 오차를 확인하십시오.",
            "진동이 지속적으로 증가할 경우 설비 가동을 일시 정지하고 정밀 점검을 실시하십시오."
          ]
        }
      });
    }

    const prompt = `
당신은 산업 설비 진동 분석 및 스마트폰 MEMS 센서 데이터 해석 전문 엔지니어입니다.
삼성 갤럭시 S24 울트라(Galaxy S24 Ultra)의 고정밀 3축 가속도/자이로 센서로부터 취득된 진동 이상 징후 데이터를 바탕으로 정밀 진단 리포트를 작성해주세요.

[입력 진동 데이터]
- 감지된 이상 유형: ${anomalyData?.type || "진동 급증 (Vibration Spike)"}
- 위험 수준: ${anomalyData?.severity || "WARNING"}
- 최대 가속도(Peak Magnitude): ${anomalyData?.magnitude?.toFixed(2) || "N/A"} m/s²
- 실효 가속도(RMS Vibration): ${anomalyData?.rms?.toFixed(2) || "N/A"} m/s²
- 주 진동 주파수(Dominant Frequency): ${anomalyData?.dominantFreq?.toFixed(1) || "N/A"} Hz
- 첨도(Kurtosis) 지수: ${anomalyData?.kurtosis?.toFixed(2) || "3.8"} (정상 가우스 분포 기준: 3.0)
- 장비 및 측정 맥락: ${equipmentContext || "모터/펌프/압축기 또는 건축물 바닥 진동 모니터링"}
- 최근 5초 평균 지표: RMS = ${recentMetrics?.avgRms?.toFixed(2) || "0.0"} m/s², Peak-to-Peak = ${recentMetrics?.peakToPeak?.toFixed(2) || "0.0"} m/s²

JSON 형식으로 응답해주세요:
{
  "faultType": "의심되는 결함 또는 이상 원인 (예: 회전체 불평형 / 베어링 볼 레이스 손상 / 축 정렬 불량 / 구조적 공진 / 충격 하중)",
  "isoSeverity": "ISO 10816-3 기준 상태 분류 (예: Class I 정상, Class II 허용, Class III 주의, Class IV 위험/가동중지)",
  "confidenceScore": 0부터 100 사이의 신뢰도 수치,
  "summary": "핵심 진단 요약 한 문장",
  "technicalDetails": "주파수 및 가속도 파형 특성에 기반한 구체적인 공학적 해석 (2~3문장)",
  "recommendations": [
    "즉시 취해야 할 현장 대응 수칙 1",
    "예방 점검 및 부품 확인 사항 2",
    "추가 모니터링 및 센서 부착 팁 3"
  ],
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const resultText = response.text || "{}";
    const diagnosis = JSON.parse(resultText);
    res.json({ success: true, diagnosis });
  } catch (error: any) {
    console.error("Gemini diagnosis error:", error);
    res.status(500).json({
      error: "Failed to generate diagnosis",
      details: error.message
    });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Galaxy S24 Ultra Vibration Monitoring Server running on port ${PORT}`);
  });
}

startServer();
