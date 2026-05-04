import { useState, useRef } from "react";

const API_BASE = "http://localhost:5000";

const SCORE_COLOR = (score) => {
  if (score >= 70) return { bg: "#EAF3DE", border: "#639922", text: "#27500A" };
  if (score >= 45) return { bg: "#FAEEDA", border: "#BA7517", text: "#633806" };
  return { bg: "#FCEBEB", border: "#A32D2D", text: "#501313" };
};

const DIM_COLORS = ["#378ADD", "#1D9E75", "#D85A30", "#D4537E"];
const ACCEPTED = ".pdf,.doc,.docx,.txt";

// ---------- File reader helper ----------
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ---------- Input Panel ----------
function InputPanel({ label, value, onChange, placeholder }) {
  const [mode, setMode] = useState("text");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef();

  async function handleFile(file) {
    if (!file) return;
    const ext = file.name.toLowerCase();
    if (!ext.match(/\.(txt|pdf|doc|docx)$/)) {
      alert("Only PDF, DOCX, and TXT files are supported.");
      return;
    }
    setFileName(file.name);

    // For TXT files, read directly in browser
    if (ext.endsWith(".txt")) {
      const text = await readFileAsText(file);
      onChange(text);
      return;
    }

    // For PDF/DOCX, send to backend for parsing
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/api/parse-file`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.text) {
        onChange(data.text);
      } else {
        alert(data.error || "Could not parse file. Please paste text instead.");
      }
    } catch (e) {
      alert("File parsing failed. Please paste text instead.");
    }
  }

  function switchMode(m) {
    setMode(m);
    if (m === "text") {
      setFileName("");
      onChange("");
    }
  }

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", color: "#888" }}>
          {label}
        </label>
        <div style={{ display: "flex", gap: 4 }}>
          {["text", "file"].map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 20, cursor: "pointer",
                border: "0.5px solid",
                borderColor: mode === m ? "#378ADD" : "#ddd",
                background: mode === m ? "#E6F1FB" : "#fafafa",
                color: mode === m ? "#185FA5" : "#888",
                fontWeight: mode === m ? 600 : 400,
              }}
            >
              {m === "text" ? "Type" : "Upload"}
            </button>
          ))}
        </div>
      </div>

      {mode === "text" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%", minHeight: 160, fontFamily: "inherit", fontSize: 14,
            border: "0.5px solid #e0e0e0", borderRadius: 8, padding: 12, resize: "vertical",
            outline: "none", lineHeight: 1.6, background: "#fafafa",
          }}
        />
      ) : (
        <div
          onClick={() => fileRef.current.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          style={{
            minHeight: 160, border: "1.5px dashed #d0d0d0", borderRadius: 8,
            background: "#fafafa", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 8,
          }}
        >
          {fileName ? (
            <>
              <span style={{ fontSize: 28 }}>📄</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>{fileName}</span>
              <span style={{ fontSize: 11, color: "#888" }}>Click to replace</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 28 }}>☁️</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#555" }}>Click or drag & drop</span>
              <span style={{ fontSize: 11, color: "#aaa" }}>PDF, DOCX, or TXT</span>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED}
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* Show extracted text preview when file is uploaded */}
      {mode === "file" && value && (
        <div style={{ marginTop: 8, padding: 8, background: "#f0f7ff", borderRadius: 6, fontSize: 12, color: "#555", maxHeight: 80, overflow: "hidden" }}>
          <span style={{ color: "#185FA5", fontWeight: 600 }}>✓ Text extracted · </span>
          {value.slice(0, 150)}...
        </div>
      )}
    </div>
  );
}

// ---------- Main Component ----------
export default function MatchPredictor() {
  const [candidateText, setCandidateText] = useState("");
  const [clientText, setClientText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function analyze() {
    setError("");
    setResult(null);

    if (!candidateText.trim() || !clientText.trim()) {
      setError("Please provide both a candidate profile and client requirements.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_profile: candidateText,
          client_requirements: clientText,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const scoreStyle = result ? SCORE_COLOR(result.overall_score) : {};

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "2rem 1rem", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <span style={{ fontSize: 12, background: "#E6F1FB", color: "#185FA5", padding: "3px 12px", borderRadius: 20, fontFamily: "monospace" }}>
          AI-powered · NLP Analysis
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginTop: 10 }}>Client–Candidate Match Predictor</h1>
        <p style={{ color: "#888", fontSize: 14, marginTop: 6 }}>
          Type or upload a document — get an instant fit score and coaching notes
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <InputPanel
          label="Candidate profile"
          value={candidateText}
          onChange={setCandidateText}
          placeholder="Paste the candidate's CV or profile summary here..."
        />
        <InputPanel
          label="Client requirements"
          value={clientText}
          onChange={setClientText}
          placeholder="Paste the client's job description or requirements here..."
        />
      </div>

      {error && (
        <div style={{ background: "#FCEBEB", color: "#A32D2D", border: "0.5px solid #F09595", borderRadius: 8, padding: 12, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <button
        onClick={analyze}
        disabled={loading}
        style={{
          width: "100%", padding: 14, fontSize: 15, fontWeight: 500,
          background: "#fff", border: "0.5px solid #bbb", borderRadius: 8,
          cursor: loading ? "not-allowed" : "pointer", marginBottom: 16,
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Analyzing..." : "Analyze match ↗"}
      </button>

      {result && (
        <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "1.5rem" }}>
          {/* Score row */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: "1.5rem", paddingBottom: "1.5rem", borderBottom: "0.5px solid #f0f0f0" }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
              background: scoreStyle.bg, border: `2px solid ${scoreStyle.border}`,
            }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: scoreStyle.text }}>{result.overall_score}%</span>
              <span style={{ fontSize: 10, color: "#888", fontFamily: "monospace" }}>match</span>
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{result.verdict}</h3>
              <p style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>{result.summary}</p>
            </div>
          </div>

          {/* Dimensions */}
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", color: "#888", marginBottom: 10 }}>
            Dimension breakdown
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: "1.5rem" }}>
            {result.dimensions.map((d, i) => (
              <div key={d.label} style={{ background: "#fafafa", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{d.label}</div>
                <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600 }}>{d.score}%</div>
                <div style={{ height: 4, background: "#eee", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${d.score}%`, background: DIM_COLORS[i % DIM_COLORS.length], borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Coaching notes */}
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", color: "#888", marginBottom: 10 }}>
            Coaching notes for candidate
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {result.improvements.map((note, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#378ADD", marginTop: 7, flexShrink: 0 }} />
                <span>{note}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ fontSize: 12, color: "#bbb", textAlign: "center", marginTop: 12 }}>
        · Results are AI-generated suggestions, not guarantees
      </p>
    </div>
  );
}
