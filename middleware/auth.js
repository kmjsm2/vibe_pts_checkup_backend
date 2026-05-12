import jwt from "jsonwebtoken";

/**
 * Authorization: Bearer <JWT> 검증 후 req.user에 { id, email } 설정.
 */
export function requireAuth(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ message: "서버 JWT 설정이 없습니다." });
  }

  const header = req.header("Authorization");
  const token =
    typeof header === "string" && header.startsWith("Bearer ")
      ? header.slice(7).trim()
      : null;

  if (!token) {
    return res.status(401).json({ message: "인증이 필요합니다." });
  }

  try {
    const payload = jwt.verify(token, secret);
    const id = payload.sub;
    const email = payload.email;
    if (!id || typeof email !== "string") {
      return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
    }
    req.user = { id, email };
    next();
  } catch {
    return res.status(401).json({ message: "유효하지 않거나 만료된 토큰입니다." });
  }
}
