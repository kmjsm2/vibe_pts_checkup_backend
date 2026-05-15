import "../loadEnv.js";
import mongoose from "mongoose";
import { Patient } from "../models/Patient.js";

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/pts_checkup";

/** 테스트 환자 원본 (doctor·age·status는 스키마 필드로 변환됨) */
const SEED_ROWS = [
  {
    chartNumber: "ICU-001",
    name: "김민준",
    department: "심장내과",
    doctor: "박성호",
    lastCheckupDate: "2026-05-10",
    diagnosis: "급성 심근경색 (NSTEMI)",
    bloodType: "A+",
    gender: "남",
    age: 58,
    status: "위험",
  },
  {
    chartNumber: "ICU-002",
    name: "이서연",
    department: "신경과",
    doctor: "최지영",
    lastCheckupDate: "2026-05-11",
    diagnosis: "뇌경색 (좌측 중대뇌동맥)",
    bloodType: "O-",
    gender: "여",
    age: 72,
    status: "위험",
  },
  {
    chartNumber: "3W-001",
    name: "박준혁",
    department: "호흡기내과",
    doctor: "김태훈",
    lastCheckupDate: "2026-05-09",
    diagnosis: "폐렴, COPD 악화",
    bloodType: "B+",
    gender: "남",
    age: 65,
    status: "중등",
  },
  {
    chartNumber: "3W-002",
    name: "최수아",
    department: "정형외과",
    doctor: "이민호",
    lastCheckupDate: "2026-05-08",
    diagnosis: "고관절 골절 (수술 후 2일)",
    bloodType: "AB+",
    gender: "여",
    age: 81,
    status: "중등",
  },
  {
    chartNumber: "3W-003",
    name: "정다은",
    department: "내분비내과",
    doctor: "박지수",
    lastCheckupDate: "2026-05-10",
    diagnosis: "당뇨병성 케톤산증 (DKA)",
    bloodType: "A-",
    gender: "여",
    age: 34,
    status: "중등",
  },
  {
    chartNumber: "2E-001",
    name: "강현우",
    department: "외과",
    doctor: "손재원",
    lastCheckupDate: "2026-05-11",
    diagnosis: "충수염 (복강경 수술 후 1일)",
    bloodType: "O+",
    gender: "남",
    age: 28,
    status: "양호",
  },
  {
    chartNumber: "2E-002",
    name: "윤지호",
    department: "소아과",
    doctor: "김은정",
    lastCheckupDate: "2026-05-10",
    diagnosis: "폐렴 (입원 치료 중)",
    bloodType: "B-",
    gender: "남",
    age: 7,
    status: "양호",
  },
  {
    chartNumber: "2E-003",
    name: "임나연",
    department: "산부인과",
    doctor: "정혜진",
    lastCheckupDate: "2026-05-09",
    diagnosis: "제왕절개 (수술 후 3일)",
    bloodType: "A+",
    gender: "여",
    age: 31,
    status: "양호",
  },
];

function mapGender(g) {
  const s = String(g).trim();
  if (s === "남" || s === "male") return "male";
  if (s === "여" || s === "female") return "female";
  return "unspecified";
}

/** 최근검진일 연도 기준으로 age에서 생년월일(대략 중간 월일) 산출 */
function birthDateFromAge(age, lastCheckupDateStr) {
  const ref = lastCheckupDateStr ? new Date(lastCheckupDateStr) : new Date();
  const year = ref.getFullYear() - Number(age);
  return new Date(year, 5, 15);
}

function rowToPatientDoc(row, index) {
  return {
    chartNumber: row.chartNumber,
    name: row.name,
    department: row.department,
    attendingPhysician: row.doctor,
    lastCheckupDate: new Date(row.lastCheckupDate),
    diagnosis: row.diagnosis,
    bloodType: row.bloodType,
    gender: mapGender(row.gender),
    birthDate: birthDateFromAge(row.age, row.lastCheckupDate),
    phone: `0102000${String(index + 1).padStart(4, "0")}`,
    notes: `입원/관찰 상태: ${row.status} (시드 데이터)`,
  };
}

async function main() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 30_000 });
  console.log(`[seed] 연결됨 → ${mongoose.connection.name}`);

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < SEED_ROWS.length; i++) {
    const doc = rowToPatientDoc(SEED_ROWS[i], i);
    try {
      await Patient.create(doc);
      inserted += 1;
      console.log(`[seed] 추가: ${doc.chartNumber} ${doc.name}`);
    } catch (err) {
      if (err.code === 11000) {
        skipped += 1;
        console.log(`[seed] 건너뜀(이미 존재): ${doc.chartNumber}`);
      } else {
        throw err;
      }
    }
  }

  console.log(`[seed] 완료 — 신규 ${inserted}건, 중복 건너뜀 ${skipped}건 (기존 데이터는 삭제하지 않음)`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
