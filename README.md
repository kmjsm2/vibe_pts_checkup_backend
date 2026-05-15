# ClinicalAI — 의료 환자 관리 플랫폼

병원·클리닉 환경에서 환자 정보를 관리하고, Claude AI로 증상·진료과 관련 참고 안내를 받을 수 있는 풀스택 웹 애플리케이션입니다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| **프론트엔드** | React 19, Vite |
| **백엔드** | Node.js (Express 5), ES Modules |
| **데이터베이스** | MongoDB (Mongoose), MongoDB Atlas 권장 |
| **AI** | Anthropic Claude API (`@anthropic-ai/sdk`) |

## 주요 기능

1. **JWT 기반 로그인·인증** — 회원가입/로그인, 보호된 API용 Bearer 토큰 검증
2. **환자 CRUD 관리** — 환자 목록·상세·생성·수정·삭제 및 검색·필터
3. **Claude AI 증상 체크** — 현재 진료과·증상 맥락에서 유사 케이스·edge case, 추가 진료과 의뢰, 체크포인트를 **마크다운·한국어**로 안내 (진단이 아닌 참고용 명시)
4. **데이터 시각화 대시보드** — 환자·통계 데이터를 프론트에서 시각화 (React 클라이언트)

## 라이브 데모

| 구분 | 링크 |
|------|------|
| **백엔드 API (Render)** | [https://vibe-pts-checkup-backend.onrender.com](https://vibe-pts-checkup-backend.onrender.com) |
| **프론트엔드 (Vercel)** | Vercel에 연결한 프로덕션 도메인을 사용합니다. (`client/` 빌드 배포 후 해당 URL로 접속) |

루트 경로(`/`)는 백엔드 헬스용 짧은 문구를 반환합니다. API는 `/api` 하위를 사용합니다.

## 배포 구성

- **프론트엔드:** Vercel (정적 빌드, `client` 디렉터리)
- **백엔드:** Render (Node 서버, `npm start`)
- **데이터베이스:** MongoDB Atlas (`MONGODB_URI`)

프론트에서 프로덕션 API 주소는 `VITE_API_BASE` 또는 클라이언트 기본 설정으로 지정할 수 있습니다.

## 레포 구조

```
├── client/              # React (Vite) 대시보드
├── models/              # Mongoose 모델 (Patient, User 등)
├── routes/              # Express 라우터 (auth, patients, ai, stats)
├── middleware/          # JWT 검증 등
├── scripts/seed.js      # 테스트 환자 시드 (기존 데이터 유지, 추가만)
├── index.js             # 서버 진입점
├── loadEnv.js           # .env 로드
└── .env.example         # 환경 변수 예시
```

## 환경 변수

`.env.example`을 참고해 `.env`를 만듭니다.

| 변수 | 설명 |
|------|------|
| `MONGODB_URI` | MongoDB 연결 문자열 (Atlas 등) |
| `JWT_SECRET` | JWT 서명용 비밀값 |
| `ANTHROPIC_API_KEY` | Claude API 키 (증상 체크 등) |
| `ANTHROPIC_MODEL` | (선택) 사용 모델 ID, 미설정 시 코드 기본값 사용 |
| `PORT` | (선택) 서버 포트, 기본 `5000` |

## 로컬 실행

**요구 사항:** Node.js 20 이상, MongoDB 접근 가능한 URI

```bash
npm install
cp .env.example .env   # 값 채우기
npm run dev            # API 서버 (watch)
```

별도 터미널에서 프론트:

```bash
npm run client
```

**시드 데이터 삽입 (선택):**

```bash
npm run seed
# 또는 (프로젝트 루트에서, loadEnv가 시드 내에서 로드됨)
node scripts/seed.js
```

## API 개요

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/auth/register` | 회원가입 |
| `POST` | `/api/auth/login` | 로그인 → JWT |
| | `/api/patients` | 환자 CRUD |
| `POST` | `/api/ai/symptom-check` | 증상 체크 (인증 필요) |
| `GET` | `/api/stats` | 집계 통계 (인증 필요) |

`Authorization: Bearer <JWT>` 헤더가 필요한 엔드포인트는 미들웨어로 검증합니다.

## 라이선스

Private 프로젝트로 설정되어 있을 수 있습니다. 사용 조건은 저장소 소유자에게 문의하세요.
