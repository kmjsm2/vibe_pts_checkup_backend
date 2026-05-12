import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export const authRouter = Router();

const BCRYPT_ROUNDS = 10;
const JWT_EXPIRES_IN = "7d";

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error("JWT_SECRET이 설정되어 있지 않습니다.");
    err.statusCode = 500;
    throw err;
  }
  return jwt.sign(
    { sub: user._id.toString(), email: user.email },
    secret,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function validateRegisterBody(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const errors = [];
  if (!name) errors.push("이름을 입력해 주세요.");
  if (!email) errors.push("이메일을 입력해 주세요.");
  if (!password) errors.push("비밀번호를 입력해 주세요.");
  else if (password.length < 8) errors.push("비밀번호는 8자 이상이어야 합니다.");

  return { name, email, password, errors };
}

authRouter.post("/register", async (req, res) => {
  const { name, email, password, errors } = validateRegisterBody(req.body ?? {});
  if (errors.length) {
    return res.status(400).json({ message: "입력값을 확인해 주세요.", details: errors });
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({ name, email, passwordHash });
    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user._id.toString(), name: user.name, email: user.email },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "이미 가입된 이메일입니다." });
    }
    if (err.name === "ValidationError") {
      const details = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: "입력값을 확인해 주세요.", details });
    }
    if (err.statusCode === 500) {
      console.error(err);
      return res.status(500).json({ message: err.message });
    }
    console.error(err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

authRouter.post("/login", async (req, res) => {
  const email =
    typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({ message: "이메일과 비밀번호를 입력해 주세요." });
  }

  try {
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) {
      return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id.toString(), name: user.name, email: user.email },
    });
  } catch (err) {
    if (err.statusCode === 500) {
      console.error(err);
      return res.status(500).json({ message: err.message });
    }
    console.error(err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});
