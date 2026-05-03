import { useState, useRef } from "react";

const SCORE_COLOR = (score) => {
  if (score >= 70) return { bg: "#EAF3DE", border: "#639922", text: "#27500A" };
  if (score >= 45) return { bg: "#FAEEDA", border: "#BA7517", text: "#633806" };
  return { bg: "#FCEBEB", border: "#A32D2D", text: "#501313" };
};

const DIM_COLORS = ["#378ADD", "#1D9E75", "#D85A30", "#D4537E"];

// ---------- PDF Generator ----------
async function downloadResultAsPDF(result) {
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const PAGE_W = 210;
  const MARGIN = 20;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  let y = 0;

  const scoreColor = SCORE_COLOR(result.overall_score);

  doc.setFillColor(24, 95, 165);
  doc.rect(0, 0, PAGE_W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Client–Candidate Match Report", MARGIN, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`, MARGIN, 20);
  doc.text("Powered by Groq · AI-generated analysis", PAGE_W - MARGIN, 20, { align: "right" });

  y = 38;

  const hexToRgb = (hex) => [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];

  const [bgR, bgG, bgB] = hexToRgb(scoreColor.bg);
  const [brR, brG, brB] = hexToRgb(scoreColor.border);
  const [txR, txG, txB] = hexToRgb(scoreColor.text);
  const circleX = MARGIN + 18;
  const circleY = y + 14;

  doc.setFillColor(bgR, bgG, bgB);
  doc.setDrawColor(brR, brG, brB);
  doc.setLineWidth(0.8);
  doc.circle(circleX, circleY, 14, "FD");
  doc.setTextColor(txR, txG, txB);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`${result.overall_score}%`, circleX, circleY + 2, { align: "center" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("match", circleX, circleY + 7, { align: "center" });

  const textX = MARGIN + 36;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(result.verdict, textX, y + 8);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  const summaryLines = doc.splitTextToSize(result.summary, CONTENT_W - 36);
  doc.text(summaryLines, textX, y + 16);

  y += 36;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("DIMENSION BREAKDOWN", MARGIN, y);
  y += 6;

  const colW = CONTENT_W / 2 - 4;
  result.dimensions.forEach((dim, i) => {
    const col = i % 2;
    const xOff = MARGIN + col * (colW + 8);
    const yOff = y + Math.floor(i / 2) * 22;
    doc.setFillColor(248, 248, 248);
    doc.setDrawColor(235, 235, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(xOff, yOff, colW, 18, 2, 2, "FD");
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(dim.label, xOff + 4, yOff + 6);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${dim.score}%`, xOff + 4, yOff + 13);
    const barX = xOff + 4;
    const barY = yOff + 15;
    const barW = colW - 8;
    doc.setFillColor(220, 220, 220);
    doc.roundedRect(barX, barY, barW, 2, 1, 1, "F");
    const [dR, dG, dB] = hexToRgb(DIM_COLORS[i % DIM_COLORS.length]);
    doc.setFillColor(dR, dG, dB);
    doc.roundedRect(barX, barY, (barW * dim.score) / 100, 2, 1, 1, "F");
  });

  y += Math.ceil(result.dimensions.length / 2) * 22 + 6;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("COACHING NOTES FOR CANDIDATE", MARGIN, y);
  y += 6;

  result.improvements.forEach((note) => {
    doc.setFillColor(55, 138, 221);
    doc.circle(MARGIN + 2, y + 1.5, 1.2, "F");
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(note, CONTENT_W - 10);
    doc.text(lines, MARGIN + 6, y + 3);
    y += lines.length * 5.5 + 3;
  });

  y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;
  doc.setTextColor(160, 160, 160);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text("This report is AI-generated and intended as a recruitment aid, not a guarantee of candidate performance.", PAGE_W / 2, y, { align: "center" });

  doc.save(`match-report-${Date.now()}.pdf`);
}

// ---------- Input Panel ----------
function InputPanel({ label, value, onChange, placeholder }) {
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "1.25rem" }}>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", color: "#888" }}>
          {label}
        </label>
      </div>
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
    </div>
  );
}

// ---------- Main Component ----------
export default function MatchPredictor() {
  const [candidateText, setCandidateText] = useState("");
  const [clientText, setClientText] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
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
      const res = await fetch("/api/analyze", {
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

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadResultAsPDF(result);
    } finally {
      setDownloading(false);
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
          Paste a candidate profile and client requirements — get an instant fit score and coaching notes
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
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                padding: "8px 16px", fontSize: 13, fontWeight: 500,
                background: "#185FA5", color: "#fff", border: "none",
                borderRadius: 8, cursor: downloading ? "not-allowed" : "pointer",
                opacity: downloading ? 0.7 : 1, whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {downloading ? "Generating..." : "⬇ Download PDF"}
            </button>
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
        Powered by Groq · Results are AI-generated suggestions, not guarantees
      </p>
    </div>
  );
}
