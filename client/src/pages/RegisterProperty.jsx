import { useMemo, useState } from "react";
import MapPolygonPicker from "../components/MapPolygonPicker.jsx";
import { fetchParcelBySurveyNumber, registerProperty } from "../services/api.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const DOC_TYPES = ["application/pdf", "image/jpeg", "image/png", "text/plain"];
const MAX_ALLOWED_DEVIATION = 15;

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function parseGeometryFile(file) {
  const text = await file.text();

  if (file.name.toLowerCase().endsWith(".geojson") || file.name.toLowerCase().endsWith(".json")) {
    const geo = JSON.parse(text);
    const coords =
      geo?.type === "FeatureCollection"
        ? geo.features?.[0]?.geometry?.coordinates?.[0]
        : geo?.type === "Feature"
          ? geo.geometry?.coordinates?.[0]
          : geo?.coordinates?.[0];
    if (!Array.isArray(coords) || coords.length < 3) throw new Error("Invalid GeoJSON polygon");
    return coords.map(([lng, lat]) => [Number(lat), Number(lng)]);
  }

  if (file.name.toLowerCase().endsWith(".kml")) {
    const match = text.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
    if (!match?.[1]) throw new Error("Invalid KML coordinates");
    const coords = match[1]
      .trim()
      .split(/\s+/)
      .map((entry) => entry.split(",").map(Number))
      .filter((entry) => entry.length >= 2)
      .map(([lng, lat]) => [lat, lng]);
    if (coords.length < 3) throw new Error("Invalid KML polygon");
    return coords;
  }

  throw new Error("Only GeoJSON or KML geometry files are allowed");
}

function estimatePolygonAreaSqm(points = []) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  const earthRadius = 6378137;
  const lat0 = (points.reduce((sum, [lat]) => sum + Number(lat), 0) / points.length) * (Math.PI / 180);

  const projected = points.map(([lat, lng]) => {
    const x = earthRadius * Number(lng) * (Math.PI / 180) * Math.cos(lat0);
    const y = earthRadius * Number(lat) * (Math.PI / 180);
    return [x, y];
  });

  let area = 0;
  for (let i = 0; i < projected.length; i += 1) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[(i + 1) % projected.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

export default function RegisterProperty() {
  const [registrationScope, setRegistrationScope] = useState("local");
  const [surveyNumber, setSurveyNumber] = useState("");
  const [parcel, setParcel] = useState(null);
  const [geometrySource, setGeometrySource] = useState("official");
  const [allowEdit, setAllowEdit] = useState(false);
  const [polygonCoordinates, setPolygonCoordinates] = useState([]);
  const [countryCode, setCountryCode] = useState("");
  const [countryName, setCountryName] = useState("");
  const [stateProvince, setStateProvince] = useState("");
  const [cityDistrict, setCityDistrict] = useState("");
  const [landRegistryOffice, setLandRegistryOffice] = useState("");
  const [parcelReference, setParcelReference] = useState("");
  const [titleDeedNumber, setTitleDeedNumber] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");
  const [ownerWallet, setOwnerWallet] = useState("");

  const [documentFile, setDocumentFile] = useState(null);
  const [geometryFile, setGeometryFile] = useState(null);
  const [documentType, setDocumentType] = useState("Sale Deed");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issuingAuthority, setIssuingAuthority] = useState("");
  const [issueDate, setIssueDate] = useState("");

  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const mapLocked = registrationScope === "local" && geometrySource === "official" && !allowEdit;
  const hasGeometry = Array.isArray(polygonCoordinates) && polygonCoordinates.length >= 3;
  const isGlobal = registrationScope === "global";
  const globalWalletValid = /^0x[a-fA-F0-9]{40}$/.test(ownerWallet.trim());
  const estimatedAreaSqm = useMemo(() => estimatePolygonAreaSqm(polygonCoordinates), [polygonCoordinates]);
  const areaDeviationPercent = useMemo(() => {
    if (!parcel?.areaSqm || !estimatedAreaSqm) return 0;
    return Math.abs(((estimatedAreaSqm - parcel.areaSqm) / parcel.areaSqm) * 100);
  }, [estimatedAreaSqm, parcel?.areaSqm]);
  const isDeviationExceeded = !isGlobal && allowEdit && areaDeviationPercent > MAX_ALLOWED_DEVIATION;

  const documentSummary = useMemo(() => {
    if (!documentFile) return "No document selected";
    return `${documentFile.name} (${(documentFile.size / 1024).toFixed(1)} KB)`;
  }, [documentFile]);

  const readiness = useMemo(() => {
    const checks = [
      { label: isGlobal ? "Country and deed details entered" : "Survey number entered", ok: isGlobal ? Boolean(countryName.trim() && parcelReference.trim() && titleDeedNumber.trim()) : Boolean(surveyNumber?.trim()) },
      { label: isGlobal ? "Claimant owner identity provided" : "Official parcel fetched", ok: isGlobal ? Boolean(ownerFullName.trim() && globalWalletValid) : Boolean(parcel) },
      { label: "Valid geometry available", ok: hasGeometry },
      { label: "Document uploaded", ok: Boolean(documentFile) },
      { label: "Deviation within limit", ok: !isDeviationExceeded }
    ];
    const completed = checks.filter((item) => item.ok).length;
    return {
      checks,
      completed,
      total: checks.length,
      percent: Math.round((completed / checks.length) * 100)
    };
  }, [isGlobal, countryName, parcelReference, titleDeedNumber, ownerFullName, globalWalletValid, surveyNumber, parcel, hasGeometry, documentFile, isDeviationExceeded]);

  async function loadOfficialParcel() {
    try {
      setStatusType("info");
      setStatus("Fetching cadastral parcel...");
      const data = await fetchParcelBySurveyNumber(surveyNumber);
      setParcel(data.parcel);
      setRegistrationScope("local");
      setGeometrySource("official");
      setAllowEdit(false);
      setPolygonCoordinates(data.parcel.polygonCoordinates || []);
      setStatusType("success");
      setStatus(`Official parcel loaded: ${data.parcel.parcelId}`);
    } catch (error) {
      setStatusType("error");
      setStatus(error.response?.data?.message || error.message);
      setParcel(null);
    }
  }

  async function importGeometry() {
    if (!geometryFile) {
      setStatusType("error");
      setStatus("Please choose a GeoJSON/KML file first.");
      return;
    }
    try {
      const coords = await parseGeometryFile(geometryFile);
      setGeometrySource("imported");
      setAllowEdit(false);
      setPolygonCoordinates(coords);
      setStatusType("success");
      setStatus(`Imported geometry with ${coords.length} points.`);
    } catch (error) {
      setStatusType("error");
      setStatus(error.message);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusType("info");
    setStatus("Submitting transaction to blockchain...");
    setResult(null);

    if (!isGlobal) {
      if (!surveyNumber) {
        setStatusType("error");
        setStatus("Survey/Khasra number is required.");
        setIsSubmitting(false);
        return;
      }
      if (!parcel) {
        setStatusType("error");
        setStatus("Fetch official parcel first using survey number.");
        setIsSubmitting(false);
        return;
      }
    } else {
      if (!countryName.trim() || !parcelReference.trim() || !titleDeedNumber.trim()) {
        setStatusType("error");
        setStatus("Country, parcel reference, and title deed number are required for global registration.");
        setIsSubmitting(false);
        return;
      }
      if (!ownerFullName.trim() || !globalWalletValid) {
        setStatusType("error");
        setStatus("Claimant owner name and valid owner wallet are required for global registration.");
        setIsSubmitting(false);
        return;
      }
    }
    if (!documentFile) {
      setStatusType("error");
      setStatus("Please upload a property document.");
      setIsSubmitting(false);
      return;
    }
    if (!DOC_TYPES.includes(documentFile.type)) {
      setStatusType("error");
      setStatus("Only PDF, JPEG, PNG, and TXT documents are allowed.");
      setIsSubmitting(false);
      return;
    }
    if (documentFile.size > MAX_FILE_SIZE) {
      setStatusType("error");
      setStatus("Document size must be 5MB or smaller.");
      setIsSubmitting(false);
      return;
    }
    if (!Array.isArray(polygonCoordinates) || polygonCoordinates.length < 3) {
      setStatusType("error");
      setStatus("Valid geometry is required.");
      setIsSubmitting(false);
      return;
    }
    if (isDeviationExceeded) {
      setStatusType("error");
      setStatus(`Geometry deviation exceeds ${MAX_ALLOWED_DEVIATION}% limit.`);
      setIsSubmitting(false);
      return;
    }

    try {
      const base64 = await readFileAsBase64(documentFile);
      const response = await registerProperty({
        registrationScope,
        surveyNumber,
        geometrySource: !isGlobal && geometrySource === "official" && allowEdit ? "edited" : geometrySource,
        polygonCoordinates,
        jurisdiction: {
          countryCode,
          countryName,
          stateProvince,
          cityDistrict,
          landRegistryOffice,
          parcelReference,
          titleDeedNumber
        },
        claimant: {
          ownerFullName,
          ownerWallet
        },
        document: {
          fileName: documentFile.name,
          mimeType: documentFile.type,
          sizeBytes: documentFile.size,
          base64,
          documentType,
          documentNumber,
          issuingAuthority,
          issueDate: issueDate || undefined
        }
      });

      setStatusType("success");
      setStatus("Registered successfully.");
      setResult({
        chainId: response.chainId,
        tokenId: response.tokenId,
        txHash: response.txHash,
        parcelId: response.parcelId,
        areaDeviationPercent: response.spatialValidation?.areaDeviationPercent
      });
    } catch (error) {
      setStatusType("error");
      setStatus(error.response?.data?.message || error.message);
      setResult(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="section-stack register-page">
      <div className="hero hero-register">
        <h2>Register Property</h2>
        <p>Register local or global land ownership using official records, verifiable geometry, and blockchain audit trail.</p>
      </div>
      <div className="module-action-bar register-action-bar register-toolbar">
        <div>
          <p className="muted">Module Actions</p>
          <h3>Registration Workflow</h3>
        </div>
        <button type="submit" form="register-property-form" disabled={isSubmitting}>
          {isSubmitting ? "Registering..." : "Register on Chain"}
        </button>
      </div>
      <div className="readiness-strip panel register-readiness">
        <div>
          <p className="muted">Registration Readiness</p>
          <h3>{readiness.percent}% complete</h3>
        </div>
        <div className="readiness-meter" aria-hidden="true">
          <span style={{ width: `${readiness.percent}%` }} />
        </div>
        <p className="muted">{readiness.completed}/{readiness.total} checks passed</p>
      </div>

      <div className="grid-2 register-layout">
        <form id="register-property-form" className="form panel register-form" onSubmit={onSubmit}>
          <div className="register-step-head">
            <div className="panel-subtitle">Step 1</div>
            <h3>Registration Scope & Parcel Identification</h3>
          </div>
          <label>
            Registration Scope
            <select
              value={registrationScope}
              onChange={(e) => {
                const next = e.target.value;
                setRegistrationScope(next);
                setParcel(null);
                if (next === "global") {
                  setGeometrySource("edited");
                  setAllowEdit(false);
                } else {
                  setGeometrySource("official");
                }
              }}
            >
              <option value="local">Local Cadastral Registry</option>
              <option value="global">Global Ownership Claim (Official Documents)</option>
            </select>
          </label>
          <label>
            Survey / Khasra Number
            <input
              value={surveyNumber}
              onChange={(e) => setSurveyNumber(e.target.value)}
              placeholder="e.g. 118/2"
              required={!isGlobal}
              disabled={isGlobal}
            />
          </label>
          <button type="button" className="secondary-btn" onClick={loadOfficialParcel} disabled={isGlobal}>
            Fetch Official Parcel
          </button>

          {parcel ? (
            <div className="panel info-panel">
              <p className="muted"><strong>Parcel ID:</strong> {parcel.parcelId}</p>
              <p className="muted"><strong>Plot:</strong> {parcel.plotNumber} | <strong>Ward:</strong> {parcel.ward}</p>
              <p className="muted"><strong>Official Area:</strong> {parcel.areaSqm} sqm</p>
            </div>
          ) : null}

          <label>
            Geometry Source
            <select value={geometrySource} onChange={(e) => setGeometrySource(e.target.value)}>
              <option value="official">Official Cadastral Boundary (Locked)</option>
              <option value="imported">Import GeoJSON/KML</option>
              <option value="edited">Draw/Edit Manually</option>
            </select>
          </label>

          {geometrySource === "official" ? (
            <label className="checkbox-row">
              <input type="checkbox" checked={allowEdit} onChange={(e) => setAllowEdit(e.target.checked)} />
              Enable controlled edit (max 15% area deviation)
            </label>
          ) : (
            <>
              <label>
                Import Survey Geometry (GeoJSON/KML)
                <input type="file" accept=".geojson,.json,.kml" onChange={(e) => setGeometryFile(e.target.files?.[0] || null)} />
              </label>
              <button type="button" className="secondary-btn" onClick={importGeometry}>Import Geometry</button>
            </>
          )}

          <MapPolygonPicker
            key={`${geometrySource}-${allowEdit ? "edit" : "lock"}`}
            onPolygonChange={setPolygonCoordinates}
            polygonCoordinates={polygonCoordinates}
            locked={mapLocked}
          />
          <div className="map-metrics register-metrics">
            <p className="muted">Selected polygon points: {polygonCoordinates.length}</p>
            <p className="muted">Estimated area: {estimatedAreaSqm ? `${estimatedAreaSqm.toFixed(2)} sqm` : "N/A"}</p>
            {parcel && !isGlobal ? (
              <p className={`muted ${isDeviationExceeded ? "error" : ""}`}>
                Area deviation: {areaDeviationPercent.toFixed(2)}% {allowEdit ? `(max ${MAX_ALLOWED_DEVIATION}%)` : ""}
              </p>
            ) : null}
          </div>

          {isGlobal ? (
            <>
              <div className="register-step-head">
                <div className="panel-subtitle">Step 2</div>
                <h3>Global Jurisdiction & Ownership Claim</h3>
              </div>
              <div className="register-field-grid">
                <label>
                  Country Name
                  <input value={countryName} onChange={(e) => setCountryName(e.target.value)} placeholder="e.g. United States" required={isGlobal} />
                </label>
                <label>
                  Country Code (ISO-2)
                  <input value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} placeholder="e.g. US" />
                </label>
                <label>
                  State / Province
                  <input value={stateProvince} onChange={(e) => setStateProvince(e.target.value)} placeholder="e.g. California" />
                </label>
                <label>
                  City / District
                  <input value={cityDistrict} onChange={(e) => setCityDistrict(e.target.value)} placeholder="e.g. Los Angeles County" />
                </label>
                <label>
                  Land Registry Office
                  <input value={landRegistryOffice} onChange={(e) => setLandRegistryOffice(e.target.value)} placeholder="Official registry authority" />
                </label>
                <label>
                  Parcel / Plot Reference
                  <input value={parcelReference} onChange={(e) => setParcelReference(e.target.value)} placeholder="Official parcel reference" required={isGlobal} />
                </label>
                <label>
                  Title Deed Number
                  <input value={titleDeedNumber} onChange={(e) => setTitleDeedNumber(e.target.value)} placeholder="Official title/deed number" required={isGlobal} />
                </label>
                <label>
                  Claimant Owner Full Name
                  <input value={ownerFullName} onChange={(e) => setOwnerFullName(e.target.value)} placeholder="Owner name on official paper" required={isGlobal} />
                </label>
                <label>
                  Claimant Owner Wallet (EVM)
                  <input value={ownerWallet} onChange={(e) => setOwnerWallet(e.target.value)} placeholder="0x..." required={isGlobal} />
                </label>
              </div>
            </>
          ) : null}

          <div className="register-step-head">
            <div className="panel-subtitle">{isGlobal ? "Step 3" : "Step 2"}</div>
            <h3>Document Registry Metadata</h3>
          </div>
          <div className="register-field-grid">
            <label>
              Document Type
              <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                <option>Sale Deed</option>
                <option>Gift Deed</option>
                <option>Mutation Certificate</option>
                <option>Encumbrance Certificate</option>
                <option>Tax Receipt</option>
              </select>
            </label>
            <label>
              Document Number
              <input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="e.g. SD/HR/2026/0098" />
            </label>
            <label>
              Issuing Authority
              <input value={issuingAuthority} onChange={(e) => setIssuingAuthority(e.target.value)} placeholder="Sub-Registrar Gurugram II" />
            </label>
            <label>
              Issue Date
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </label>
          </div>
          <label className="register-document-upload">
            Property Document (PDF/JPEG/PNG/TXT)
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
              onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
              required
            />
          </label>
          <p className="muted file-summary">{documentSummary}</p>

          <button type="submit" className="register-submit-btn" disabled={isSubmitting}>
            {isSubmitting ? "Registering..." : "Register on Chain"}
          </button>
        </form>

        <aside className="panel register-side-panel">
          <h3>Real-World Validation Pipeline</h3>
          <ul className="gov-list">
            <li>Select registration scope: local cadastral or global ownership claim</li>
            <li>Attach official deed/paper and provide traceable jurisdiction metadata</li>
            <li>Validate geometry and run duplicate-risk analysis before anchoring on-chain</li>
            <li>Store complete metadata off-chain; anchor tamper-proof reference hash on-chain</li>
          </ul>
          <div className="checklist">
            {readiness.checks.map((item) => (
              <div key={item.label} className="check-row">
                <span className={item.ok ? "check-dot done" : "check-dot"} />
                <p className="muted">{item.label}</p>
              </div>
            ))}
          </div>

          {status ? (
            <p className={`status-banner ${statusType === "error" ? "status-error" : ""} ${statusType === "success" ? "status-success" : ""}`}>
              {status}
            </p>
          ) : null}

          {result ? (
            <div className="panel">
              <h3>Transaction Result</h3>
              <p className="muted">chainId: {result.chainId}</p>
              <p className="muted">tokenId: {result.tokenId}</p>
              <p className="muted">parcelId: {result.parcelId}</p>
              <p className="muted">areaDeviation: {Number(result.areaDeviationPercent || 0).toFixed(2)}%</p>
              <p className="muted">txHash: {result.txHash}</p>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
