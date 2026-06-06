from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
from dotenv import load_dotenv
import json
import re
import io
import os

load_dotenv()

app = Flask(__name__)
CORS(app)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

MODEL = "llama-3.3-70b-versatile"

# Optional file parsing libraries
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

SYSTEM_PROMPT = """You are an expert recruitment analyst specializing in matching candidates 
to client requirements. Your analysis is data-driven, specific, and actionable. 
Always respond with valid JSON only — no markdown, no preamble, no explanation."""

ANALYSIS_TEMPLATE = """Analyze the match between the following candidate profile and client requirements.

Candidate Profile:
{candidate}

Client Requirements:
{client}

Carefully extract and evaluate the following from the candidate profile before scoring:

EDUCATION GATING:
- What is the candidate's highest level of education? (e.g. Bachelor's, Master's, PhD, Diploma, High School)
- What is their field of study? Is it relevant to the role?
- Does it meet the client's education requirements (if stated)?

EXPERIENCE GATING:
- How many years of relevant work experience does the candidate have?
- What roles or industries have they worked in?
- Does their experience level meet the client's requirements (if stated)?

CERTIFICATION GATING:
- Does the candidate hold any certifications relevant to this role?
- If the client requires specific certifications, does the candidate have them?
- If no certifications are mentioned, note it as "None mentioned"

Use the above gating to inform and justify your scores. Do not give high scores if the candidate 
clearly fails a gating requirement (e.g. requires 5 years experience but candidate has 1 year).

Return ONLY this JSON structure:
{{
  "overall_score": <integer 0-100>,
  "verdict": "<3-5 word verdict e.g. 'Strong potential fit'>",
  "summary": "<2-3 sentence overall assessment referencing education, experience, and certifications>",
  "gating": {{
    "education": {{
      "detected": "<what was found in the profile e.g. 'Bachelor of Computer Science, BINUS University'>",
      "meets_requirement": <true or false>,
      "note": "<1 sentence explanation>"
    }},
    "experience": {{
      "detected": "<what was found e.g. '1 year as AI Engineer Intern'>",
      "meets_requirement": <true or false>,
      "note": "<1 sentence explanation>"
    }},
    "certifications": {{
      "detected": "<list certifications found or 'None mentioned'>",
      "meets_requirement": <true or false>,
      "note": "<1 sentence explanation>"
    }}
  }},
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


def parse_json(text: str) -> dict:
    clean = re.sub(r"```(?:json)?", "", text).strip()
    return json.loads(clean)


def extract_text_from_file(file) -> str:
    filename = file.filename.lower()
    raw = file.read()

    if filename.endswith(".txt"):
        return raw.decode("utf-8", errors="ignore")

    elif filename.endswith(".pdf"):
        if not HAS_PDF:
            raise ValueError("PDF parsing not available on this server. Please paste text instead.")
        text_parts = []
        with pdfplumber.open(io.BytesIO(raw)) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text_parts.append(t)
        return "\n".join(text_parts)

    elif filename.endswith(".docx") or filename.endswith(".doc"):
        if not HAS_DOCX:
            raise ValueError("DOCX parsing not available on this server. Please paste text instead.")
        document = docx.Document(io.BytesIO(raw))
        return "\n".join(p.text for p in document.paragraphs if p.text.strip())

    else:
        raise ValueError(f"Unsupported file type: {filename}")


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model": MODEL,
        "pdf_support": HAS_PDF,
        "docx_support": HAS_DOCX
    })


@app.route("/api/parse-file", methods=["POST", "OPTIONS"])
def parse_file():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty file"}), 400

    try:
        text = extract_text_from_file(file)
        if not text.strip():
            return jsonify({"error": "Could not extract text from file. Please paste text instead."}), 422
        return jsonify({"text": text})
    except ValueError as e:
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        return jsonify({"error": f"File parsing failed: {str(e)}"}), 500


@app.route("/api/analyze", methods=["POST", "OPTIONS"])
def analyze():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})

    body = request.get_json(silent=True) or {}
    candidate = (body.get("candidate_profile") or "").strip()
    client_req = (body.get("client_requirements") or "").strip()

    if not candidate or not client_req:
        return jsonify({"error": "Both 'candidate_profile' and 'client_requirements' are required"}), 422

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
            max_tokens=1500,
        )

        raw_text = completion.choices[0].message.content
        result = parse_json(raw_text)
        return jsonify(result)

    except json.JSONDecodeError as e:
        return jsonify({"error": f"Failed to parse model response: {str(e)}"}), 502

    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
