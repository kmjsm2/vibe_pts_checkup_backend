# ClinicalAI — Backend API

**REST API server for the ClinicalAI Healthcare Patient Management Platform**  
Node.js · Express · MongoDB Atlas · Anthropic Claude SDK

> Frontend repo: [vibe_pts_checkup_frontend](https://github.com/kmjsm2/vibe_pts_checkup_frontend)  
> Live demo: [vibe-pts-checkup-frontend-vxci.vercel.app](https://vibe-pts-checkup-frontend-vxci.vercel.app)

---

## Overview

This server handles patient record management, medical image storage, and AI-assisted radiology report generation. All AI inference is performed server-side to prevent API key exposure and ensure auditability.

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |

All routes except `/api/auth/*` and `/api/patients/db-info` require:
```
Authorization: Bearer <jwt_token>
```

---

### Patients

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patients` | List patients (paginated, searchable) |
| GET | `/api/patients/db-info` | DB connection status |
| GET | `/api/patients/:id` | Get single patient record |
| POST | `/api/patients` | Create patient |
| PATCH | `/api/patients/:id` | Update patient |
| DELETE | `/api/patients/:id` | Delete patient |

**Query params for GET `/api/patients`:**
```
?limit=50&skip=0&search=keyword
```

---

### Medical Images

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/patients/:id/images` | Upload image (multipart/form-data) |
| GET | `/api/patients/:id/images` | List images (metadata only, no base64) |
| GET | `/api/patients/:id/images/:imageId` | Get single image with base64 |

**Upload request:**
```
Content-Type: multipart/form-data
Fields:
  image      — file (JPEG or PNG, max 10MB)
  imageType  — "xray" | "ct" | "mri"
```

**Upload response:**
```json
{
  "imageId": "uuid",
  "imageType": "mri",
  "uploadedAt": "2026-05-15T01:28:00.000Z"
}
```

**Image list response** (base64 excluded):
```json
[
  {
    "imageId": "uuid",
    "imageType": "mri",
    "uploadedAt": "2026-05-15T01:28:00.000Z",
    "hasAiReport": true
  }
]
```

---

### AI — Image Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/patients/:id/images/:imageId/analyze` | Generate AI findings for single image |
| POST | `/api/ai/patients/:id/images/compare` | Compare two images longitudinally |
| POST | `/api/ai/symptom-check` | Symptom-based triage assistant |

**Analyze response:**
```json
{
  "findings": "Bilateral periventricular white matter hypointensities...",
  "impression": "Findings consistent with demyelinating disease...",
  "recommendation": "FLAIR and T2 sequences recommended...",
  "confidence": 75,
  "analyzedAt": "2026-05-15T01:29:00.000Z"
}
```

**Compare request body:**
```json
{
  "imageId1": "uuid-of-earlier-image",
  "imageId2": "uuid-of-later-image"
}
```

**Compare response:**
```json
{
  "summary": "Lesions in the left cerebellar hemisphere have resolved...",
  "status": "호전",
  "keyChanges": ["Lesion resolution in left hemisphere", "White matter signal normalized"],
  "confidence": 80,
  "comparedAt": "2026-05-15T01:30:00.000Z"
}
```

`status` is validated against: `["호전", "악화", "유지", "판단불가"]`

---

### Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Patient count by department, diagnosis distribution |

---

## Data Architecture

### Patient Schema (MongoDB)

```
Patient {
  name, chartNumber, department, doctor
  gender, bloodType, birthDate
  diagnosis, medications[], allergies[]
  notes, lastCheckupDate

  images: [{
    imageId        String (UUID)
    imageType      "xray" | "ct" | "mri"
    base64         String (stored server-side only)
    mimeType       String
    uploadedAt     Date

    aiReport: {
      findings       String
      impression     String
      recommendation String
      confidence     Number (0–100)
      analyzedAt     Date
    }
  }]
}
```

### Image Storage Design

```
Client uploads image
      │
      ▼
multer memoryStorage (never written to disk)
      │
      ▼
buffer.toString('base64')
      │
      ▼
Stored in MongoDB Atlas (encrypted at rest)
      │
      ▼
GET /images → strips base64, returns metadata only
GET /images/:id → returns base64 for preview
```

Base64 is never logged or returned in list endpoints — only on explicit single-image fetch.

---

## AI Integration

### Claude Vision — Single Image Analysis

```javascript
// Model: claude-sonnet-4-20250514
// Image passed as base64 in content array

messages: [{
  role: "user",
  content: [
    {
      type: "image",
      source: { type: "base64", media_type: mimeType, data: base64 }
    },
    {
      type: "text",
      text: `Analyze this ${imageType} image. Respond in JSON only:
      {
        "findings": "...",
        "impression": "...",
        "recommendation": "...",
        "confidence": 75
      }`
    }
  ]
}]
```

**Reliability design:**
- JSON parse with fallback: strips markdown code fences, retries
- `status` validated against allowed set with auto-correction
- All inference runs server-side — API key never reaches client

### Claude Vision — Longitudinal Comparison

```javascript
// Loads existing aiReport from both images in DB
// No image re-upload needed — compares findings text only

system: "영상의학과 전문의 보조 AI로서 두 시점의 소견을 비교합니다."

user: `
이전 소견 (${date1} / ${type1}):
Findings: ${findings1}
Impression: ${impression1}

최근 소견 (${date2} / ${type2}):
Findings: ${findings2}
Impression: ${impression2}

JSON only: { summary, status, keyChanges[], confidence }
`
```

---

## Security & Compliance

| Area | Implementation |
|------|---------------|
| Authentication | JWT (jsonwebtoken), bcrypt password hashing |
| Authorization | `requireAuth` middleware on all non-public routes |
| API key exposure | All Claude API calls server-side only |
| Patient data | MongoDB Atlas (encrypted at rest, TLS in transit) |
| Image data | base64 stored in DB, never written to disk or logged |
| HIPAA relevance | No real patient data used — all records are synthetic seed data |
| Environment secrets | `.env` via `loadEnv.js`, never committed |

---

## Project Structure

```
pts_checkup_backend/
├── index.js              # App entry, Express setup, MongoDB connect
├── loadEnv.js            # Environment variable loader
├── routes/
│   ├── auth.js           # Register / login
│   ├── patients.js       # Patient CRUD + image upload/retrieve
│   ├── ai.js             # Claude Vision analysis + comparison
│   └── stats.js          # Aggregation queries
├── models/
│   └── Patient.js        # Mongoose schema (images[] embedded)
├── middleware/
│   └── auth.js           # requireAuth JWT verification
└── scripts/
    └── seed.js           # Synthetic data seeder
```

---

## Running Locally

```bash
git clone https://github.com/kmjsm2/vibe_pts_checkup_backend.git
cd vibe_pts_checkup_backend
npm install
```

Create `.env`:
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret_here
ANTHROPIC_API_KEY=sk-ant-...
PORT=5000
```

```bash
npm run dev     # node --watch
npm start       # production
npm run seed    # populate synthetic patient data
```

Server runs at `http://localhost:5000`

---

## Tech Stack

| | |
|-|-|
| Runtime | Node.js 20+ |
| Framework | Express 5, ES Module |
| Database | MongoDB Atlas, Mongoose 9 |
| AI | Anthropic Claude SDK `@anthropic-ai/sdk` |
| Image upload | multer 2 (memoryStorage) |
| Auth | jsonwebtoken, bcrypt |
| Deploy | Render (free tier — cold start ~50s after inactivity) |

---

## Author

**MyungJoo (Zoe) Kim**  
UCSD Bioinformatics · Incoming JHU Health Science Informatics MS  
[linkedin.com/in/myungjoo-zoe-kim](https://linkedin.com/in/myungjoo-zoe-kim)

---

*Disclaimer: AI-generated findings are assistive tools only. Final diagnosis must be confirmed by a licensed physician. Compliant with MFDS SaMD guidelines.*
