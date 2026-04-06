import "./loadEnv.js";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import "./models/Patient.js";
import {
  patientsRouter,
  sendPatientFacets,
  sendPatientsDbInfo,
} from "./routes/patients.js";

const PORT = process.env.PORT || 5000;
const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/pts_checkup";

if (!process.env.MONGODB_URI) {
  console.warn(
    "[MongoDB] 환경 변수 MONGODB_URI가 없어 기본 로컬 주소를 씁니다. .env를 확인하세요."
  );
} else {
  const atlas = MONGODB_URI.startsWith("mongodb+srv");
  console.log(
    `[MongoDB] MONGODB_URI 사용 → ${atlas ? "mongodb+srv (Atlas 연결 문자열)" : "mongodb:// (로컬 등)"}`
  );
}

const app = express();
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

app.use("/api", (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  res.status(503).json({
    message:
      "MongoDB에 연결되어 있지 않습니다. MongoDB를 실행한 뒤 서버를 다시 시작하세요.",
  });
});

app.get("/api/patients/facets", sendPatientFacets);
app.get("/api/patients/db-info", sendPatientsDbInfo);
app.use("/api/patients", patientsRouter);

app.get("/", (_req, res) => {
  res.send("PTS checkup backend");
});

app.use((_req, res) => {
  res.status(404).json({ message: "경로를 찾을 수 없습니다." });
});

app.use((err, _req, res, _next) => {
  if (res.headersSent) return;
  console.error(err);
  const status = Number(err.statusCode || err.status) || 500;
  res.status(status).json({
    message: err.message || "서버 오류가 발생했습니다.",
  });
});

async function main() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 30_000 });
  const dbName = mongoose.connection.db?.databaseName ?? "(알 수 없음)";
  const host = mongoose.connection.host ?? "";
  const onAtlas = host.includes("mongodb.net");
  console.log("연결 성공");
  console.log(
    `[MongoDB] 실제 연결 호스트: ${host} → ${onAtlas ? "Atlas 클러스터로 연결됨" : "로컬/직접 호스트(Atlas 아님)"}`
  );
  console.log(
    `[MongoDB] 데이터는 DB "${dbName}" · 컬렉션 "patients"에 저장됩니다.`
  );
  console.log(
    `[MongoDB] 저장 위치 확인: http://localhost:${PORT}/api/patients/db-info`
  );

  app.listen(PORT, () => {
    console.log(`서버 실행: http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
