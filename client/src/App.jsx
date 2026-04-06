import { useCallback, useEffect, useState } from "react";
import * as api from "./api/patients.js";
import "./App.css";

const GENDER_LABELS = {
  male: "남성",
  female: "여성",
  other: "기타",
  unspecified: "미지정",
};

const GENDER_SHORT = {
  male: "남",
  female: "여",
  other: "기타",
  unspecified: "",
};

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const RECORD_SOURCE_LABELS = {
  clinical: "임상",
  synthetic: "합성 데이터",
  deidentified: "비식별화",
};

function formatDateDisplay(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ko-KR");
}

function formatDateInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function emptyForm() {
  return {
    chartNumber: "",
    name: "",
    birthDate: "",
    gender: "unspecified",
    phone: "",
    email: "",
    address: "",
    emergencyName: "",
    emergencyPhone: "",
    bloodType: "",
    allergies: "",
    notes: "",
    department: "",
    attendingPhysician: "",
    lastCheckupDate: "",
    diagnosis: "",
    medications: "",
    recordSource: "clinical",
    institutionCode: "",
    externalRecordId: "",
  };
}

function patientToForm(p) {
  return {
    chartNumber: p.chartNumber ?? "",
    name: p.name ?? "",
    birthDate: formatDateInput(p.birthDate),
    gender: p.gender ?? "unspecified",
    phone: p.phone ?? "",
    email: p.email ?? "",
    address: p.address ?? "",
    emergencyName: p.emergencyContact?.name ?? "",
    emergencyPhone: p.emergencyContact?.phone ?? "",
    bloodType: p.bloodType ?? "",
    allergies: Array.isArray(p.allergies) ? p.allergies.join(", ") : "",
    notes: p.notes ?? "",
    department: p.department ?? "",
    attendingPhysician: p.attendingPhysician ?? "",
    lastCheckupDate: formatDateInput(p.lastCheckupDate),
    diagnosis: p.diagnosis ?? "",
    medications: Array.isArray(p.medications) ? p.medications.join(", ") : "",
    recordSource: p.recordSource ?? "clinical",
    institutionCode: p.institutionCode ?? "",
    externalRecordId: p.externalRecordId ?? "",
  };
}

function formToPayload(form) {
  const allergiesStr = form.allergies.trim();
  const allergies = allergiesStr
    ? allergiesStr.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const medStr = form.medications.trim();
  const medications = medStr
    ? medStr.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const payload = {
    name: form.name.trim(),
    birthDate: form.birthDate,
    phone: form.phone.trim(),
    gender: form.gender || undefined,
    department: form.department.trim() || null,
    attendingPhysician: form.attendingPhysician.trim() || null,
    diagnosis: form.diagnosis.trim() || null,
    lastCheckupDate: form.lastCheckupDate || null,
    medications,
    recordSource: form.recordSource || "clinical",
    institutionCode: form.institutionCode.trim() || null,
  };

  const extId = form.externalRecordId.trim();
  if (extId) payload.externalRecordId = extId;

  const chart = form.chartNumber.trim();
  if (chart) payload.chartNumber = chart;

  const email = form.email.trim();
  if (email) payload.email = email;

  const address = form.address.trim();
  if (address) payload.address = address;

  const notes = form.notes.trim();
  if (notes) payload.notes = notes;

  if (allergies.length) payload.allergies = allergies;

  if (form.bloodType) payload.bloodType = form.bloodType;

  const en = form.emergencyName.trim();
  const ep = form.emergencyPhone.trim();
  if (en || ep) {
    payload.emergencyContact = {};
    if (en) payload.emergencyContact.name = en;
    if (ep) payload.emergencyContact.phone = ep;
  }

  return payload;
}

function formatNameWithGender(p) {
  const g = GENDER_SHORT[p.gender];
  return g ? `${p.name} (${g})` : p.name;
}

function formatMedications(p) {
  if (!Array.isArray(p.medications) || p.medications.length === 0) return "—";
  return p.medications.join(", ");
}

export default function App() {
  const [patients, setPatients] = useState([]);
  const [matchedTotal, setMatchedTotal] = useState(0);
  const [dbTotal, setDbTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterPhysician, setFilterPhysician] = useState("");
  const [filterBloodType, setFilterBloodType] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterRecordSource, setFilterRecordSource] = useState("");

  const [facetDepts, setFacetDepts] = useState([]);
  const [facetPhysicians, setFacetPhysicians] = useState([]);
  const [dbInfo, setDbInfo] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const showToast = (message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const loadFacets = useCallback(async () => {
    try {
      const d = await api.listPatientFacets();
      setFacetDepts(d.departments ?? []);
      setFacetPhysicians(d.physicians ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listPatients({
        limit: 500,
        search: debouncedSearch || undefined,
        department: filterDepartment || undefined,
        physician: filterPhysician || undefined,
        bloodType: filterBloodType || undefined,
        gender: filterGender || undefined,
        recordSource: filterRecordSource || undefined,
      });
      setPatients(data.patients ?? []);
      setMatchedTotal(data.total ?? 0);
      setDbTotal(data.dbTotal ?? data.total ?? 0);
    } catch (e) {
      setError(e.message || "목록을 불러오지 못했습니다.");
      setPatients([]);
    } finally {
      setLoading(false);
      try {
        const info = await api.getPatientsDbInfo();
        setDbInfo(info);
      } catch {
        setDbInfo(null);
      }
    }
  }, [
    debouncedSearch,
    filterDepartment,
    filterPhysician,
    filterBloodType,
    filterGender,
    filterRecordSource,
  ]);

  useEffect(() => {
    loadFacets();
  }, [loadFacets]);

  useEffect(() => {
    load();
  }, [load]);

  const resetFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setFilterDepartment("");
    setFilterPhysician("");
    setFilterBloodType("");
    setFilterGender("");
    setFilterRecordSource("");
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = async (id) => {
    setEditingId(id);
    setForm(emptyForm());
    setModalOpen(true);
    setError(null);
    try {
      const p = await api.getPatient(id);
      setForm(patientToForm(p));
    } catch (e) {
      showToast(e.message || "환자 정보를 불러오지 못했습니다.", true);
      setModalOpen(false);
      setEditingId(null);
    }
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const payload = formToPayload(form);
    if (!payload.name || !payload.birthDate || !payload.phone) {
      showToast("이름, 생년월일, 연락처는 필수입니다.", true);
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api.updatePatient(editingId, payload);
        showToast("환자 정보가 수정되었습니다.");
      } else {
        await api.createPatient(payload);
        showToast("환자가 등록되었습니다.");
      }
      closeModal();
      await load();
      await loadFacets();
    } catch (err) {
      const extra =
        Array.isArray(err.details) && err.details.length
          ? ` (${err.details.join("; ")})`
          : "";
      showToast((err.message || "저장 실패") + extra, true);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id, name) => {
    if (!window.confirm(`「${name}」 환자 정보를 삭제할까요?`)) return;
    try {
      await api.deletePatient(id);
      showToast("삭제되었습니다.");
      await load();
      await loadFacets();
    } catch (e) {
      showToast(e.message || "삭제에 실패했습니다.", true);
    }
  };

  const updateField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const filtersActive =
    debouncedSearch ||
    filterDepartment ||
    filterPhysician ||
    filterBloodType ||
    filterGender ||
    filterRecordSource;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>PTS 환자 관리</h1>
          <p className="app-lead">
            검진일, 병명, 복용 약물, 담당 의사 등 정보를 등록·수정·삭제할 수 있습니다. 데이터 유형(임상·합성·비식별화)과
            기관 코드를 두어 향후 타 병원과의 합성·공유 DB 연계에 활용할 수 있습니다.
          </p>
        </div>
        <div className="toolbar">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { load(); loadFacets(); }}>
            새로고침
          </button>
          <button type="button" className="btn btn-primary btn-add" onClick={openCreate}>
            환자 추가
          </button>
        </div>
      </header>

      {toast && (
        <div
          className={`banner ${toast.isError ? "banner-error" : "banner-success"}`}
          role="status"
        >
          {toast.message}
        </div>
      )}

      {error && !loading && (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      )}

      <section className="filters-card card">
        <div className="search-row">
          <div className="search-field">
            <label htmlFor="search">검색</label>
            <input
              id="search"
              type="search"
              placeholder="환자 ID, 이름, 병명, 의사명, 진료과…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="search-meta" aria-live="polite">
            표시 <strong>{patients.length}</strong>명 / 필터 일치{" "}
            <strong>{matchedTotal}</strong>
            {filtersActive && dbTotal !== matchedTotal ? (
              <>
                {" "}
                · DB 전체 <strong>{dbTotal}</strong>
              </>
            ) : null}
          </div>
        </div>

        <div className="filter-block">
          <div className="filter-block-title">필터</div>
          <div className="filter-grid">
            <div>
              <label htmlFor="f-dept">진료과</label>
              <select
                id="f-dept"
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
              >
                <option value="">전체</option>
                {facetDepts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-doc">담당 의사</label>
              <select
                id="f-doc"
                value={filterPhysician}
                onChange={(e) => setFilterPhysician(e.target.value)}
              >
                <option value="">전체</option>
                {facetPhysicians.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-blood">혈액형</label>
              <select
                id="f-blood"
                value={filterBloodType}
                onChange={(e) => setFilterBloodType(e.target.value)}
              >
                <option value="">전체</option>
                {BLOOD_TYPES.map((bt) => (
                  <option key={bt} value={bt}>
                    {bt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-gender">성별</label>
              <select
                id="f-gender"
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
              >
                <option value="">전체</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
                <option value="other">기타</option>
                <option value="unspecified">미지정</option>
              </select>
            </div>
            <div>
              <label htmlFor="f-source">데이터 유형</label>
              <select
                id="f-source"
                value={filterRecordSource}
                onChange={(e) => setFilterRecordSource(e.target.value)}
              >
                <option value="">전체</option>
                <option value="clinical">임상</option>
                <option value="synthetic">합성 데이터</option>
                <option value="deidentified">비식별화</option>
              </select>
            </div>
          </div>
          <div className="filter-actions">
            <button type="button" className="btn-link" onClick={resetFilters}>
              필터 초기화
            </button>
          </div>
        </div>
      </section>

      <div className="card table-card">
        {loading ? (
          <div className="loading">불러오는 중…</div>
        ) : patients.length === 0 ? (
          <div className="empty">
            {filtersActive
              ? "조건에 맞는 환자가 없습니다. 필터를 바꿔 보세요."
              : "등록된 환자가 없습니다. 환자 추가를 눌러 등록하세요."}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>환자 ID</th>
                  <th>이름</th>
                  <th>진료과</th>
                  <th>생년월일</th>
                  <th>마지막 검진일</th>
                  <th>병명</th>
                  <th>복용 약물</th>
                  <th>담당 의사</th>
                  <th>유형</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p._id}>
                    <td>{p.chartNumber || "—"}</td>
                    <td>{formatNameWithGender(p)}</td>
                    <td>{p.department || "—"}</td>
                    <td>{formatDateDisplay(p.birthDate)}</td>
                    <td>{formatDateDisplay(p.lastCheckupDate)}</td>
                    <td>{p.diagnosis || "—"}</td>
                    <td className="cell-muted">{formatMedications(p)}</td>
                    <td>{p.attendingPhysician || "—"}</td>
                    <td className="cell-muted">
                      {RECORD_SOURCE_LABELS[p.recordSource] ?? p.recordSource}
                    </td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEdit(p._id)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => onDelete(p._id, p.name)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="overlay" role="presentation" onClick={closeModal}>
          <div
            className="modal modal-wide"
            role="dialog"
            aria-labelledby="modal-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="modal-head">
              <h2 id="modal-title">{editingId ? "환자 수정" : "환자 등록"}</h2>
              <button
                type="button"
                className="modal-close"
                aria-label="닫기"
                onClick={closeModal}
              >
                ×
              </button>
            </div>
            <form onSubmit={onSubmit}>
              <div className="modal-body">
                <p className="form-section-label">기본 정보</p>
                <div className="form-grid">
                  <div>
                    <label htmlFor="name">이름 *</label>
                    <input
                      id="name"
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-row2">
                    <div>
                      <label htmlFor="birthDate">생년월일 *</label>
                      <input
                        id="birthDate"
                        type="date"
                        value={form.birthDate}
                        onChange={(e) => updateField("birthDate", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="gender">성별</label>
                      <select
                        id="gender"
                        value={form.gender}
                        onChange={(e) => updateField("gender", e.target.value)}
                      >
                        <option value="unspecified">미지정</option>
                        <option value="male">남성</option>
                        <option value="female">여성</option>
                        <option value="other">기타</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row2">
                    <div>
                      <label htmlFor="phone">연락처 *</label>
                      <input
                        id="phone"
                        value={form.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="chartNumber">환자 ID (차트번호)</label>
                      <input
                        id="chartNumber"
                        value={form.chartNumber}
                        onChange={(e) => updateField("chartNumber", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <p className="form-section-label">진료 · 검진</p>
                <div className="form-grid">
                  <div className="form-row2">
                    <div>
                      <label htmlFor="department">진료과</label>
                      <input
                        id="department"
                        value={form.department}
                        onChange={(e) => updateField("department", e.target.value)}
                        list="list-departments"
                        placeholder="예: 신경과"
                      />
                      <datalist id="list-departments">
                        {facetDepts.map((d) => (
                          <option key={d} value={d} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label htmlFor="attendingPhysician">담당 의사</label>
                      <input
                        id="attendingPhysician"
                        value={form.attendingPhysician}
                        onChange={(e) => updateField("attendingPhysician", e.target.value)}
                        list="list-physicians"
                      />
                      <datalist id="list-physicians">
                        {facetPhysicians.map((d) => (
                          <option key={d} value={d} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div className="form-row2">
                    <div>
                      <label htmlFor="lastCheckupDate">마지막 검진일</label>
                      <input
                        id="lastCheckupDate"
                        type="date"
                        value={form.lastCheckupDate}
                        onChange={(e) => updateField("lastCheckupDate", e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="bloodType">혈액형</label>
                      <select
                        id="bloodType"
                        value={form.bloodType}
                        onChange={(e) => updateField("bloodType", e.target.value)}
                      >
                        <option value="">선택 안 함</option>
                        {BLOOD_TYPES.map((bt) => (
                          <option key={bt} value={bt}>
                            {bt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="diagnosis">병명</label>
                    <input
                      id="diagnosis"
                      value={form.diagnosis}
                      onChange={(e) => updateField("diagnosis", e.target.value)}
                      placeholder="예: 감기"
                    />
                  </div>
                  <div>
                    <label htmlFor="medications">복용 약물 (쉼표로 구분)</label>
                    <input
                      id="medications"
                      value={form.medications}
                      onChange={(e) => updateField("medications", e.target.value)}
                      placeholder="예: 아세트아미노펜 500mg"
                    />
                  </div>
                </div>

                <p className="form-section-label">공유·연구용 메타데이터</p>
                <div className="form-grid">
                  <div>
                    <label htmlFor="recordSource">데이터 유형</label>
                    <select
                      id="recordSource"
                      value={form.recordSource}
                      onChange={(e) => updateField("recordSource", e.target.value)}
                    >
                      <option value="clinical">임상 (실제 진료)</option>
                      <option value="synthetic">합성 데이터</option>
                      <option value="deidentified">비식별화</option>
                    </select>
                  </div>
                  <div className="form-row2">
                    <div>
                      <label htmlFor="institutionCode">기관 코드</label>
                      <input
                        id="institutionCode"
                        value={form.institutionCode}
                        onChange={(e) => updateField("institutionCode", e.target.value)}
                        placeholder="향후 연합 DB·교환 시"
                      />
                    </div>
                    <div>
                      <label htmlFor="externalRecordId">외부 레코드 ID</label>
                      <input
                        id="externalRecordId"
                        value={form.externalRecordId}
                        onChange={(e) => updateField("externalRecordId", e.target.value)}
                        placeholder="타 시스템 식별자 (선택)"
                      />
                    </div>
                  </div>
                </div>

                <p className="form-section-label">기타</p>
                <div className="form-grid">
                  <div>
                    <label htmlFor="email">이메일</label>
                    <input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="address">주소</label>
                    <textarea
                      id="address"
                      value={form.address}
                      onChange={(e) => updateField("address", e.target.value)}
                    />
                  </div>
                  <div className="form-row2">
                    <div>
                      <label htmlFor="emergencyName">비상 연락 이름</label>
                      <input
                        id="emergencyName"
                        value={form.emergencyName}
                        onChange={(e) => updateField("emergencyName", e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="emergencyPhone">비상 연락 전화</label>
                      <input
                        id="emergencyPhone"
                        value={form.emergencyPhone}
                        onChange={(e) => updateField("emergencyPhone", e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="allergies">알레르기 (쉼표로 구분)</label>
                    <input
                      id="allergies"
                      value={form.allergies}
                      onChange={(e) => updateField("allergies", e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="notes">비고</label>
                    <textarea
                      id="notes"
                      value={form.notes}
                      onChange={(e) => updateField("notes", e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-foot">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeModal}
                  disabled={saving}
                >
                  취소
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "저장 중…" : editingId ? "저장" : "등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {dbInfo?.database && (
        <footer className="db-footnote" aria-label="MongoDB 저장 위치">
          <p>
            <strong>MongoDB에서 데이터 보기:</strong> 데이터베이스{" "}
            <code>{dbInfo.database}</code>, 컬렉션 <code>{dbInfo.collection}</code>
            {typeof dbInfo.documentCount === "number" ? (
              <>
                {" "}
                · 현재 문서 수 <strong>{dbInfo.documentCount}</strong>건
              </>
            ) : null}
            {dbInfo.hosts ? (
              <>
                {" "}
                · 호스트 <code>{String(dbInfo.hosts)}</code>
              </>
            ) : null}
            {typeof dbInfo.isAtlas === "boolean" ? (
              <>
                {" "}
                ·{" "}
                <strong>
                  {dbInfo.isAtlas
                    ? "백엔드는 Atlas에 연결된 상태입니다."
                    : "백엔드는 로컬/직접 호스트입니다(Atlas 아님)."}
                </strong>
              </>
            ) : null}
          </p>
          <p className="db-footnote-sub">{dbInfo.hint}</p>
        </footer>
      )}
    </div>
  );
}
