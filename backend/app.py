from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
import json
import re
import io
import os

# File parsing libraries (optional - may not be available on all platforms)
try:
    import pdfplumber
    HAS_PDF = True
except ImportError:
    HAS_PDF = False

try:
    import docx
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

app = Flask(__name__)
CORS(app, origins="*")

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

client = Groq(api_key="YOUR_GROQ_API_KEY_HERE")

MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are an expert recruitment analyst specializing in matching candidates 
to client requirements. Your analysis is data-driven, specific, and actionable. 
Always respond with valid JSON only — no markdown, no preamble, no explanation."""

ANALYSIS_TEMPLATE = """Analyze the match between the following candidate profile and client requirements.

Candidate Profile:
{candidate}

Client Requirements:
{client}

Return ONLY this JSON structure:
{{
  "overall_score": <integer 0-100>,
  "verdict": "<3-5 word verdict e.g. 'Strong potential fit'>",
  "summary": "<1-2 sentence overall assessment>",
  "dimensions": [
    {{"label": "Technical skills", "score": <0-100>}},
    {{"label": "Communication style", "score": <0-100>}},
    {{"label": "Domain experience", "score": <0-100>}},
    {{"label": "Culture alignment", "score": <0-100>}}
  ],
  "improvements": [
    "<specific actionable coaching note 1>",
    "<specific actionable coaching note 2>",
    "<specific actionable coaching note 3>",
    "<specific actionable coaching note 4>"
  ]
}}"""


def extract_text(file) -> str:
    """Extract plain text from uploaded PDF, DOCX, or TXT file."""
    filename = file.filename.lower()
    raw = file.read()

    if filename.endswith(".txt"):
        return raw.decode("utf-8", errors="ignore")

    elif filename.endswith(".pdf"):
        if not HAS_PDF:
            raise ValueError("PDF parsing is not available on this server. Please paste text instead.")
        text_parts = []
        with pdfplumber.open(io.BytesIO(raw)) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text_parts.append(t)
        return "\n".join(text_parts)

    elif filename.endswith(".docx") or filename.endswith(".doc"):
        if not HAS_DOCX:
            raise ValueError("DOCX parsing is not available on this server. Please paste text instead.")
        doc = docx.Document(io.BytesIO(raw))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    else:
        raise ValueError(f"Unsupported file type: {filename}")


def parse_json(text: str) -> dict:
    clean = re.sub(r"```(?:json)?", "", text).strip()
    return json.loads(clean)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL})


@app.route("/api/analyze", methods=["POST"])
def analyze():
    # Support both JSON and multipart/form-data
    candidate = ""
    client_req = ""

    # Try to get text from form fields or uploaded files
    if request.content_type and "multipart/form-data" in request.content_type:
        # Text fields
        candidate = (request.form.get("candidate_profile") or "").strip()
        client_req = (request.form.get("client_requirements") or "").strip()

        # File fields (override text if provided)
        if "candidate_file" in request.files:
            f = request.files["candidate_file"]
            if f.filename:
                try:
                    candidate = extract_text(f)
                except ValueError as e:
                    return jsonify({"error": str(e)}), 422

        if "client_file" in request.files:
            f = request.files["client_file"]
            if f.filename:
                try:
                    client_req = extract_text(f)
                except ValueError as e:
                    return jsonify({"error": str(e)}), 422
    else:
        # Fallback: plain JSON body
        body = request.get_json(silent=True) or {}
        candidate = (body.get("candidate_profile") or "").strip()
        client_req = (body.get("client_requirements") or "").strip()

    if not candidate or not client_req:
        return jsonify({
            "error": "Both candidate profile and client requirements are required (text or file)"
        }), 422

    if len(candidate) > 8000 or len(client_req) > 8000:
        return jsonify({"error": "Input exceeds 8,000 character limit per field"}), 422

    try:
        completion = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": ANALYSIS_TEMPLATE.format(
                    candidate=candidate,
                    client=client_req
                )}
            ],
            temperature=0.3,
            max_tokens=1024,
        )

        raw_text = completion.choices[0].message.content
        result = parse_json(raw_text)
        return jsonify(result)

    except json.JSONDecodeError as e:
        return jsonify({"error": f"Failed to parse model response: {str(e)}"}), 502

    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
