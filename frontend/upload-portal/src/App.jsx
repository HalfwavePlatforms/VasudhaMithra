import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/records/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 640, margin: "40px auto", padding: "0 16px" }}>
      <h1>Land Record Digitizer — Upload</h1>
      <p style={{ color: "#555" }}>
        Upload a scanned/photographed land record. It'll be OCR'd, extracted into
        structured fields, and validated automatically.
      </p>

      <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload} disabled={!file || loading} style={{ marginLeft: 12 }}>
        {loading ? "Processing..." : "Upload & Process"}
      </button>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 24, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
          <strong>Record ID:</strong> {result.record_id}
          <br />
          <strong>Status:</strong> {result.status}
        </div>
      )}

      {/* TODO: review queue view for status=pending_review records, with
          per-field correction inputs hitting PATCH /records/{id}.
          See docs/api-contracts.md for the response shape to build against. */}
    </div>
  );
}
