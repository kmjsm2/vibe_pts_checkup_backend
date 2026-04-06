import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    chartNumber: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    birthDate: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", "unspecified"],
      default: "unspecified",
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    bloodType: {
      type: String,
      enum: {
        values: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
        message: "{VALUE} is not a valid blood type",
      },
    },
    allergies: [{ type: String, trim: true }],
    notes: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    attendingPhysician: {
      type: String,
      trim: true,
    },
    lastCheckupDate: {
      type: Date,
    },
    diagnosis: {
      type: String,
      trim: true,
    },
    medications: [{ type: String, trim: true }],
    /** 임상 | 합성(synthetic) | 비식별화 — 타 기관 공유·연구용 구분 */
    recordSource: {
      type: String,
      enum: ["clinical", "synthetic", "deidentified"],
      default: "clinical",
    },
    /** 기관 코드(향후 연합·교환 시) */
    institutionCode: {
      type: String,
      trim: true,
    },
    /** 외부 시스템 연계용 식별자(선택, 비어 있으면 미저장) */
    externalRecordId: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

patientSchema.index({ name: 1, birthDate: 1 });
patientSchema.index({ phone: 1 });
patientSchema.index({ department: 1 });
patientSchema.index({ attendingPhysician: 1 });
patientSchema.index({ recordSource: 1 });
patientSchema.index(
  { externalRecordId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      externalRecordId: { $exists: true, $type: "string", $gt: "" },
    },
  }
);

export const Patient = mongoose.model("Patient", patientSchema);
