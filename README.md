# ClinicalCare Hub: Diagnostic Engine & Medicine Search

This is a standalone Clinical Decision Support System prototype built with a Python Flask backend and a modern HTML/CSS/JS frontend.

## Project Structure
```
MEDICAL ASSISTENT/
├── Backend/
│   ├── database/
│   │   ├── illnesses.csv    # Diagnostic rules database
│   │   └── medicines.csv    # Medication information database
│   └── server.py            # Flask API server
├── Frontend/
│   ├── index.html           # Dashboard UI
│   ├── style.css            # Dark mode styles & animations
│   └── app.js               # Logic, event listeners, API fetch
└── requirements.txt         # Python dependencies
```

## Setup & Running the Application

1. **Install Dependencies**:
   Open a terminal and navigate to the project directory, then run:
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the Flask Backend Server**:
   Start the server by running:
   ```bash
   python Backend/server.py
   ```
   The backend server will run on `http://127.0.0.1:5000`.

3. **Open the Frontend**:
   Open your browser and navigate to `http://127.0.0.1:5000/` to access the full-featured dashboard.

## Module Implementations

### Module A: Diagnostic Rule Engine
- **Input**: Selecting symptom checkboxes triggers calculations based on symptom weight indicators mapped to each illness.
- **Output**: Returns an ordered list of matched illnesses with progress bars indicating the match percentage. The top matching illness automatically displays corresponding care instructions in the triage guidelines block.

### Module B: Medicine Search Engine
- **Input**: Enter a generic or brand name in the medication search bar.
- **Output**: Yields details regarding primary indications, dosage contexts, safety warnings, and risk levels with color-coded safety indicators (Low Risk [Green], Moderate Risk [Orange], High Risk [Red]).
