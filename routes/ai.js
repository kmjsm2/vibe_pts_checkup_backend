import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";

export const aiRouter = Router();

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
