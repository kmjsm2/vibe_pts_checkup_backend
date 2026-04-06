import { Router } from "express";
import mongoose from "mongoose";
import { Patient } from "../models/Patient.js";

export const patientsRouter = Router();

const allowedFields = [
  "chartNumber",
  "name",
  "birthDate",
  "gender",
  "phone",
  "email",
  "address",
  "emergencyContact",
  "bloodType",
  "allergies",
  "notes",
  "department",
  "attendingPhysician",
  "lastCheckupDate",
  "diagnosis",
  "medications",
  "recordSource",
  "institutionCode",
  "externalRecordId",
];

function pickAllowedPatientFields(body) {
  const payload = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  return payload;
}

const GENDER_ENUM = ["male", "female", "other", "unspecified"];
const BLOOD_ENUM = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/** API(JSON) 페이로드를 Mongoose Patient 스키마 형식에 맞게 변환합니다. */
function normalizePatientWritePayload(picked) {
  const out = { ...picked };

  const parseDate = (v) => {
    if (v == null || v === "") return undefined;
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };

  if ("birthDate" in out) {
    const d = parseDate(out.birthDate);
    if (d) out.birthDate = d;
    else delete out.birthDate;
  }
  if ("lastCheckupDate" in out) {
    const d = parseDate(out.lastCheckupDate);
    if (d) out.lastCheckupDate = d;
    else delete out.lastCheckupDate;
  }

  if ("gender" in out) {
    const raw = String(out.gender).trim().toLowerCase();
    if (!raw) {
      delete out.gender;
    } else if (GENDER_ENUM.includes(raw)) {
      out.gender = raw;
    } else {
      const map = {
        m: "male",
        male: "male",
        man: "male",
        남: "male",
        남성: "male",
        f: "female",
        female: "female",
        woman: "female",
        여: "female",
        여성: "female",
        other: "other",
        기타: "other",
        unspecified: "unspecified",
        미기재: "unspecified",
        unknown: "unspecified",
      };
      out.gender = map[raw] ?? "unspecified";
    }
  }

  if ("bloodType" in out) {
    const s = String(out.bloodType).trim().toUpperCase().replace(/\s/g, "");
    if (!s) {
      delete out.bloodType;
    } else if (BLOOD_ENUM.includes(s)) {
      out.bloodType = s;
    } else {
      delete out.bloodType;
    }
  }

  const toStringArray = (v) => {
    if (v == null || v === "") return undefined;
    if (Array.isArray(v)) {
      const arr = v.map((x) => String(x).trim()).filter(Boolean);
      return arr.length ? arr : undefined;
    }
    const arr = String(v)
      .split(/[\n,，;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    return arr.length ? arr : undefined;
  };

  if ("allergies" in out) {
    const arr = toStringArray(out.allergies);
    if (arr) out.allergies = arr;
    else delete out.allergies;
  }
  if ("medications" in out) {
    const arr = toStringArray(out.medications);
    if (arr) out.medications = arr;
    else delete out.medications;
  }

  if ("emergencyContact" in out) {
    const v = out.emergencyContact;
    if (v == null || v === "") {
      delete out.emergencyContact;
    } else if (typeof v === "string") {
      const t = v.trim();
      if (!t) delete out.emergencyContact;
      else out.emergencyContact = { name: t };
    } else if (typeof v === "object" && !Array.isArray(v)) {
      const name = v.name != null ? String(v.name).trim() : "";
      const phone = v.phone != null ? String(v.phone).trim() : "";
      if (!name && !phone) delete out.emergencyContact;
      else {
        const o = {};
        if (name) o.name = name;
        if (phone) o.phone = phone;
        out.emergencyContact = o;
      }
    } else {
      delete out.emergencyContact;
    }
  }

  return out;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildListFilter(query) {
  const filter = {};
  const dept = query.department?.trim();
  const physician = query.physician?.trim();
  const bloodType = query.bloodType?.trim();
  const gender = query.gender?.trim();
  const recordSource = query.recordSource?.trim();

  if (dept) filter.department = dept;
  if (physician) filter.attendingPhysician = physician;
  if (bloodType) filter.bloodType = bloodType;
  if (gender) filter.gender = gender;
  if (
    recordSource &&
    ["clinical", "synthetic", "deidentified"].includes(recordSource)
  ) {
    filter.recordSource = recordSource;
  }

  const q = query.search?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [
      { chartNumber: rx },
      { name: rx },
      { diagnosis: rx },
      { attendingPhysician: rx },
      { department: rx },
      { medications: rx },
      { externalRecordId: rx },
    ];
  }

  return filter;
}

patientsRouter.get("/", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    const skip = Math.max(Number(req.query.skip) || 0, 0);
    const listFilter = buildListFilter(req.query);

    const [patients, matchedTotal, dbTotal] = await Promise.all([
      Patient.find(listFilter)
        .sort({ lastCheckupDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Patient.countDocuments(listFilter),
      Patient.countDocuments({}),
    ]);

    res.json({
      patients,
      total: matchedTotal,
      dbTotal,
      limit,
      skip,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

patientsRouter.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "잘못된 환자 ID입니다." });
  }
  try {
    const patient = await Patient.findById(id).lean();
    if (!patient) {
      return res.status(404).json({ message: "환자를 찾을 수 없습니다." });
    }
    res.json(patient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

patientsRouter.patch("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "잘못된 환자 ID입니다." });
  }

  const payload = normalizePatientWritePayload(pickAllowedPatientFields(req.body));
  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ message: "수정할 항목이 없습니다." });
  }

  try {
    const patient = await Patient.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    }).lean();

    if (!patient) {
      return res.status(404).json({ message: "환자를 찾을 수 없습니다." });
    }

    res.json(patient);
  } catch (err) {
    if (err.name === "ValidationError") {
      const details = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: "입력값을 확인해 주세요.", details });
    }
    if (err.name === "CastError") {
      return res.status(400).json({
        message: "입력값을 확인해 주세요.",
        details: [err.message],
      });
    }
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ message: "이미 사용 중인 차트번호이거나, 외부 레코드 ID가 중복입니다." });
    }
    console.error(err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

patientsRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "잘못된 환자 ID입니다." });
  }
  try {
    const deleted = await Patient.findByIdAndDelete(id).lean();
    if (!deleted) {
      return res.status(404).json({ message: "환자를 찾을 수 없습니다." });
    }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

patientsRouter.post("/", async (req, res) => {
  const payload = normalizePatientWritePayload(pickAllowedPatientFields(req.body));

  try {
    const patient = await Patient.create(payload);
    res.status(201).json(patient);
  } catch (err) {
    if (err.name === "ValidationError") {
      const details = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: "입력값을 확인해 주세요.", details });
    }
    if (err.name === "CastError") {
      return res.status(400).json({
        message: "입력값을 확인해 주세요.",
        details: [err.message],
      });
    }
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ message: "이미 사용 중인 차트번호이거나, 외부 레코드 ID가 중복입니다." });
    }
    console.error(err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

export async function sendPatientFacets(_req, res) {
  try {
    const [departments, physicians] = await Promise.all([
      Patient.distinct("department", {
        department: { $nin: [null, ""] },
      }),
      Patient.distinct("attendingPhysician", {
        attendingPhysician: { $nin: [null, ""] },
      }),
    ]);
    res.json({
      departments: departments.filter(Boolean).sort((a, b) => a.localeCompare(b, "ko")),
      physicians: physicians.filter(Boolean).sort((a, b) => a.localeCompare(b, "ko")),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
}

export async function sendPatientsDbInfo(_req, res) {
  try {
    const documentCount = await Patient.countDocuments();
    const hostStr = String(mongoose.connection.host ?? "");
    const isAtlas = hostStr.includes("mongodb.net");
    const hint = isAtlas
      ? "지금 백엔드는 MongoDB Atlas(클라우드)에만 저장합니다. PC의 로컬 MongoDB(127.0.0.1)에는 이 앱 데이터가 들어가지 않습니다. Compass에서 Atlas용 연결(mongodb+srv://…)을 추가한 뒤 같은 DB·컬렉션을 여세요. 환자를 추가할 때마다 새 데이터베이스가 생기지 않고, 항상 위 DB의 patients 컬렉션에 문서가 쌓입니다."
      : "백엔드는 이 PC의 MongoDB(로컬)에 저장 중입니다. Compass에서 127.0.0.1:27017로 연결한 뒤 위 DB·컬렉션을 여세요.";
    res.json({
      database: mongoose.connection.db?.databaseName ?? null,
      collection: "patients",
      documentCount,
      hosts: mongoose.connection.host,
      isAtlas,
      hint,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
}
