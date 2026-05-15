import { Router } from "express";
import mongoose from "mongoose";
import Anthropic from "@anthropic-ai/sdk";
import { Patient } from "../models/Patient.js";

export const aiRouter = Router();

const VISION_MODEL = "claude-sonnet-4-20250514";
const VISION_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function parseJsonFromModelText(text) {
  let t = String(text).trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/m.exec(t);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(t.slice(start, end + 1));
    }
    throw new Error("invalid JSON");
  }
}

const SYSTEM_PROMPT =
  "당신은 병원 관리자를 돕는 의료 AI 어시스턴트입니다.\n" +
  "환자의 현재 진료과와 증상을 바탕으로:\n" +
  "1. 현재 진료과에서 볼 수 있는 유사 케이스와 주의할 edge case 안내\n" +
  "2. 현재 치료로 호전이 없을 경우 추가로 의뢰할 진료과 추천\n" +
  "3. 담당의가 놓치지 말아야 할 체크포인트\n" +
  "형식은 마크다운으로, 한국어로 답변하세요.\n" +
  "반드시 진단이 아닌 참고용임을 명시하세요.";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

aiRouter.post("/symptom-check", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ message: "ANTHROPIC_API_KEY가 설정되어 있지 않습니다." });
  }

  const symptoms =
    typeof req.body?.symptoms === "string" ? req.body.symptoms.trim() : "";
  const patientAge = req.body?.patientAge;

  if (!symptoms) {
    return res.status(400).json({ message: "symptoms(문자열)를 입력해 주세요." });
  }
  const ageNum = Number(patientAge);
  if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 150) {
    return res.status(400).json({
      message: "patientAge는 0~150 사이의 숫자여야 합니다.",
    });
  }

  const userMessage = `환자 나이: ${ageNum}세\n증상 설명:\n${symptoms}`;

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;

    const msg = await client.messages.create({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlocks = msg.content.filter((b) => b.type === "text");
    const result = textBlocks.map((b) => b.text).join("\n").trim();

    res.json({ result });
  } catch (err) {
    console.error(err);
    const status = err.status === 401 || err.status === 403 ? err.status : 502;
    res.status(status).json({
      message:
        err.status === 401 || err.status === 403
          ? "Anthropic API 인증에 실패했습니다."
          : "AI 응답을 가져오는 중 오류가 발생했습니다.",
    });
  }
});

aiRouter.post("/patients/:id/images/:imageId/analyze", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ message: "ANTHROPIC_API_KEY가 설정되어 있지 않습니다." });
  }

  const { id, imageId } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "잘못된 환자 ID입니다." });
  }

  try {
    const patient = await Patient.findById(id).select("images").lean();
    if (!patient) {
      return res.status(404).json({ message: "환자를 찾을 수 없습니다." });
    }
    const img = (patient.images ?? []).find((i) => i.imageId === imageId);
    if (!img) {
      return res.status(404).json({ message: "이미지를 찾을 수 없습니다." });
    }
    if (!img.base64 || !img.mimeType) {
      return res.status(400).json({ message: "이미지 데이터가 없습니다." });
    }
    if (!VISION_MEDIA_TYPES.has(img.mimeType)) {
      return res.status(400).json({
        message:
          "Claude Vision이 지원하는 이미지 형식이 아닙니다. (image/jpeg, image/png, image/gif, image/webp)",
      });
    }

    const imageType = img.imageType;
    const userText = `당신은 영상의학과 전문의 보조 AI입니다.
이 ${imageType} 영상을 분석하고 아래 JSON 형식으로만 응답하세요.
JSON 외 다른 텍스트는 절대 포함하지 마세요.
{
  "findings": "영상에서 관찰되는 객관적 소견을 상세히 기술",
  "impression": "판독 소견 및 의심 진단",
  "recommendation": "추가 검사 또는 임상적 권고사항",
  "confidence": 75
}`;

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: img.mimeType,
                data: img.base64,
              },
            },
            {
              type: "text",
              text: userText,
            },
          ],
        },
      ],
    });

    const textBlocks = msg.content.filter((b) => b.type === "text");
    const rawText = textBlocks.map((b) => b.text).join("\n").trim();
    let parsed;
    try {
      parsed = parseJsonFromModelText(rawText);
    } catch {
      return res.status(502).json({
        message: "AI 응답을 JSON으로 해석할 수 없습니다.",
      });
    }

    const findings = String(parsed.findings ?? "");
    const impression = String(parsed.impression ?? "");
    const recommendation = String(parsed.recommendation ?? "");
    const confidence = Number(parsed.confidence);
    if (!Number.isFinite(confidence)) {
      return res.status(502).json({ message: "AI 응답에 유효한 confidence가 없습니다." });
    }

    const analyzedAt = new Date();
    const upd = await Patient.updateOne(
      { _id: id, "images.imageId": imageId },
      {
        $set: {
          "images.$.aiReport": {
            findings,
            impression,
            recommendation,
            confidence,
            analyzedAt,
          },
        },
      }
    );

    if (upd.matchedCount === 0) {
      return res.status(404).json({ message: "이미지를 찾을 수 없습니다." });
    }

    res.json({
      findings,
      impression,
      recommendation,
      confidence,
      analyzedAt,
    });
  } catch (err) {
    console.error(err);
    const status = err.status === 401 || err.status === 403 ? err.status : 502;
    res.status(status).json({
      message:
        err.status === 401 || err.status === 403
          ? "Anthropic API 인증에 실패했습니다."
          : "AI 분석 중 오류가 발생했습니다.",
    });
  }
});
