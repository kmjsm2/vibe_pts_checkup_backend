// Vite 개발: "" + 프록시. 빌드 후 정적 서빙: 기본 백엔드(환경변수 VITE_API_BASE로 덮어쓰기).
const BASE =
  import.meta.env.VITE_API_BASE ??
  (import.meta.env.PROD ? "https://vibe-pts-checkup-backend.onrender.com" : "");

async function parseBody(res) {
  if (res.status === 204) return { data: null, text: "" };
  const text = await res.text();
  if (!text) return { data: null, text: "" };
  try {
    return { data: JSON.parse(text), text };
  } catch {
    return { data: null, text };
  }
}

async function handleResponse(res) {
  const { data, text } = await parseBody(res);
  if (!res.ok) {
    const msg =
      data?.message ??
      (text && !text.trimStart().startsWith("<")
        ? text.slice(0, 280)
        : null) ??
      res.statusText;
    const err = new Error(msg);
    err.details = data?.details;
    err.status = res.status;
    throw err;
  }
  return data;
}

export function listPatients(params = {}) {
  const q = new URLSearchParams();
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.skip != null) q.set("skip", String(params.skip));
  if (params.search) q.set("search", params.search);
  if (params.department) q.set("department", params.department);
  if (params.physician) q.set("physician", params.physician);
  if (params.bloodType) q.set("bloodType", params.bloodType);
  if (params.gender) q.set("gender", params.gender);
  if (params.recordSource) q.set("recordSource", params.recordSource);
  const qs = q.toString();
  const url = `${BASE}/api/patients${qs ? `?${qs}` : ""}`;
  return fetch(url).then(handleResponse);
}

export function listPatientFacets() {
  return fetch(`${BASE}/api/patients/facets`).then(handleResponse);
}

export function getPatientsDbInfo() {
  return fetch(`${BASE}/api/patients/db-info`).then(handleResponse);
}

export function getPatient(id) {
  return fetch(`${BASE}/api/patients/${id}`).then(handleResponse);
}

export function createPatient(body) {
  return fetch(`${BASE}/api/patients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(handleResponse);
}

export function updatePatient(id, body) {
  return fetch(`${BASE}/api/patients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(handleResponse);
}

export function deletePatient(id) {
  return fetch(`${BASE}/api/patients/${id}`, { method: "DELETE" }).then(
    handleResponse
  );
}
