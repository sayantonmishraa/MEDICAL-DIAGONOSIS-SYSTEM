from pathlib import Path
import csv
import os
import re
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "Frontend"
DATABASE_DIR = BASE_DIR / "database"
ILLNESSES_PATH = DATABASE_DIR / "illnesses.csv"
MEDICINES_PATH = DATABASE_DIR / "medicines.csv"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
CORS(app)

# Load illnesses CSV helper
def load_illnesses_csv(file_path: Path) -> list:
    if not file_path.exists():
        return []
    try:
        illnesses_dict = {}
        with file_path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                illness_name = row["Illness"]
                symptom = row["Symptom"]
                try:
                    weight = float(row["Weight"])
                except ValueError:
                    weight = 1.0
                triage = row["Triage Advice"]
                
                if illness_name not in illnesses_dict:
                    illnesses_dict[illness_name] = {
                        "name": illness_name,
                        "symptoms": {},
                        "triage_advice": triage
                    }
                illnesses_dict[illness_name]["symptoms"][symptom] = weight
        return list(illnesses_dict.values())
    except Exception as e:
        print(f"Error loading illnesses CSV: {e}")
        return []

# Load medicines CSV helper
def load_medicines_csv(file_path: Path) -> list:
    if not file_path.exists():
        return []
    try:
        meds = []
        with file_path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                brands = [b.strip() for b in row["Brand Names"].split(";") if b.strip()]
                meds.append({
                    "name": row["Name"],
                    "brand_names": brands,
                    "primary_use": row["Primary Use"],
                    "dosage_context": row["Dosage Context"],
                    "precautions": row["Precautions"],
                    "risk_indicator": row["Risk Indicator"]
                })
        return meds
    except Exception as e:
        print(f"Error loading medicines CSV: {e}")
        return []

# Initialize data structures
illnesses_db = load_illnesses_csv(ILLNESSES_PATH)
medicines_db = load_medicines_csv(MEDICINES_PATH)

# Helper to normalize text
def normalize_text(text: str) -> str:
    return re.sub(r"[^a-z0-9\s]+", "", str(text).lower()).strip()

@app.route("/")
def home():
    return send_from_directory(str(FRONTEND_DIR), "index.html")

@app.route("/<path:path>")
def static_files(path: str):
    return send_from_directory(str(FRONTEND_DIR), path)

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "illnesses_count": len(illnesses_db),
        "medicines_count": len(medicines_db),
        "message": "Diagnostic Rule Engine and Medicine Search server online."
    })

@app.route("/api/diagnose", methods=["POST", "GET"])
def diagnose():
    # Retrieve user symptoms
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        user_symptoms = payload.get("symptoms", [])
    else:
        user_symptoms = request.args.getlist("symptoms")
        if not user_symptoms:
            # Fallback for comma separated query param: ?symptoms=fever,cough
            raw_symptoms = request.args.get("symptoms", "")
            if raw_symptoms:
                user_symptoms = [s.strip() for s in raw_symptoms.split(",") if s.strip()]

    if not user_symptoms:
        return jsonify({
            "status": "error",
            "message": "No symptoms provided. Please select at least one symptom."
        }), 400

    # Normalize user symptoms list
    user_symptoms_normalized = {normalize_text(s) for s in user_symptoms if s}

    results = []
    for illness in illnesses_db:
        illness_symptoms = illness.get("symptoms", {})
        
        # Calculate scores
        matched_weight = 0.0
        total_weight = sum(illness_symptoms.values())
        
        for symptom_name, weight in illness_symptoms.items():
            norm_symptom = normalize_text(symptom_name)
            # Match directly or check if user symptom is a substring of the illness symptom
            if any(norm_symptom in us or us in norm_symptom for us in user_symptoms_normalized):
                matched_weight += weight
        
        if total_weight > 0 and matched_weight > 0:
            match_percentage = round((matched_weight / total_weight) * 100)
            results.append({
                "name": illness["name"],
                "match": match_percentage,
                "triage_advice": illness["triage_advice"]
            })

    # Sort results by match percentage descending
    results.sort(key=lambda x: x["match"], reverse=True)

    if not results:
        return jsonify({
            "status": "success",
            "illnesses": [],
            "triage_advice": "No matching illnesses found for the selected symptoms. If you feel unwell, please consult a healthcare professional."
        })

    # Select triage advice of the top match
    top_triage_advice = results[0]["triage_advice"]

    return jsonify({
        "status": "success",
        "illnesses": results,
        "triage_advice": top_triage_advice
    })

@app.route("/api/search", methods=["GET"])
def search():
    query = request.args.get("name", "").strip()
    if not query:
        return jsonify({
            "status": "error",
            "message": "Search query cannot be empty."
        }), 400

    norm_query = normalize_text(query)
    matches = []

    for medicine in medicines_db:
        # Match generic name
        med_name_norm = normalize_text(medicine["name"])
        
        # Match brand names
        brand_names_norm = [normalize_text(brand) for brand in medicine.get("brand_names", [])]
        
        if norm_query in med_name_norm or any(norm_query in brand for brand in brand_names_norm):
            matches.append({
                "name": medicine["name"],
                "brand_names": medicine.get("brand_names", []),
                "primary_use": medicine["primary_use"],
                "dosage_context": medicine["dosage_context"],
                "precautions": medicine["precautions"],
                "risk_indicator": medicine["risk_indicator"]
            })

    if not matches:
        return jsonify({
            "status": "not_found",
            "results": [],
            "message": f"No medicines found matching '{query}'."
        })

    return jsonify({
        "status": "success",
        "results": matches
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Medical Assistant Backend starting on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
