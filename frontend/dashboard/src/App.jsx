import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function App() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/dashboard/stats`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load stats: ${res.status}`);
        return res.json();
      })
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p style={{ color: "crimson", padding: 24 }}>{error}</p>;
  if (!stats) return <p style={{ padding: 24 }}>Loading...</p>;

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 800, margin: "40px auto", padding: "0 16px" }}>
      <h1>Digitization Dashboard</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <StatCard label="Total Processed" value={stats.total_processed} />
        <StatCard label="Avg. Extraction Accuracy" value={`${(stats.avg_extraction_accuracy * 100).toFixed(1)}%`} />
        <StatCard label="Pending Review" value={stats.pending_review_count} />
        <StatCard label="Errors" value={stats.error_count} />
      </div>

      <h2 style={{ marginTop: 32 }}>By District</h2>
      <ul>
        {Object.entries(stats.by_district).map(([district, count]) => (
          <li key={district}>{district}: {count}</li>
        ))}
      </ul>

      {/* TODO: swap the plain list above for a Recharts bar chart once the
          demo data has enough districts to make a chart meaningful. */}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ color: "#666", fontSize: 13 }}>{label}</div>
    </div>
  );
}
