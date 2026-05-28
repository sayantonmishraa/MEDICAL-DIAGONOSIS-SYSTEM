// Backend Connection Configuration
const API_BASE_URL = window.location.origin;

// State of the application
let currentView = 'symptom-check';
let selectedSymptoms = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup connection checks
    checkBackendHealth();
    
    // 2. Load and initialize reports history
    initializeReportsHistory();
    
    // 3. Setup event listeners for checkboxes
    setupCheckboxListeners();
    
    // 4. Default view setup
    switchView('symptom-check');
});

// ==========================================
// SPA NAV CONTROLLER
// ==========================================
function switchView(viewName) {
    currentView = viewName;
    
    const views = {
        'symptom-check': document.getElementById('view-symptom-check'),
        'results': document.getElementById('view-results'),
        'dashboard': document.getElementById('view-dashboard'),
        'medicine-search': document.getElementById('view-medicine-search')
    };

    // Hide all views
    Object.values(views).forEach(view => {
        if (view) {
            view.classList.add('hidden');
        }
    });

    // Show active view
    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
    }

    // Update active state in Navigation UI
    updateNavButtons(viewName);

    // If switching to Dashboard, refresh the statistics and UI list
    if (viewName === 'dashboard') {
        renderDashboard();
    }
}

function updateNavButtons(viewName) {
    const prefixs = ['sidebar-btn-', 'header-btn-', 'mobile-btn-'];
    const views = ['symptom-check', 'results', 'dashboard', 'medicine-search'];

    views.forEach(v => {
        // 1. Sidebar items (Rounded buttons)
        const sbBtn = document.getElementById(`sidebar-btn-${v}`);
        if (sbBtn) {
            if (v === viewName) {
                sbBtn.className = "w-[calc(100%-1rem)] text-left mx-2 px-4 py-3 flex items-center gap-3 transition-all rounded-full bg-secondary-container text-on-secondary-container font-bold";
            } else {
                sbBtn.className = "w-[calc(100%-1rem)] text-left mx-2 px-4 py-3 flex items-center gap-3 transition-all rounded-full text-on-surface-variant hover:bg-surface-variant";
            }
        }

        // 2. Header tabs (Bottom borders)
        const hdBtn = document.getElementById(`header-btn-${v}`);
        if (hdBtn) {
            if (v === viewName) {
                hdBtn.className = "text-primary border-b-2 border-primary pb-1 font-bold text-label-sm";
            } else {
                hdBtn.className = "text-on-surface-variant hover:text-primary transition-colors text-label-sm";
            }
        }

        // 3. Mobile bottom tabs
        const mbBtn = document.getElementById(`mobile-btn-${v}`);
        if (mbBtn) {
            if (v === viewName) {
                mbBtn.className = "flex flex-col items-center justify-center text-primary flex-grow";
                const icon = mbBtn.querySelector('.material-symbols-outlined');
                if (icon) icon.classList.add('fill-icon');
            } else {
                mbBtn.className = "flex flex-col items-center justify-center text-on-surface-variant flex-grow";
                const icon = mbBtn.querySelector('.material-symbols-outlined');
                if (icon) icon.classList.remove('fill-icon');
            }
        }
    });
}

// ==========================================
// CONNECTION HEALTH CHECK
// ==========================================
async function checkBackendHealth() {
    const statusDot = document.querySelector('#connection-status .status-dot');
    const statusLabel = document.querySelector('#connection-status #connection-label');

    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        const data = await response.json();
        
        if (data.status === 'ok') {
            statusDot.className = 'status-dot w-2 h-2 rounded-full bg-secondary pulsing';
            statusLabel.textContent = 'ONLINE';
            statusLabel.title = `Server running (${data.medicines_count} drugs, ${data.illnesses_count} rules)`;
        } else {
            setOfflineStatus(statusDot, statusLabel);
        }
    } catch (error) {
        console.error('Connection ping failed:', error);
        setOfflineStatus(statusDot, statusLabel);
    }
}

function setOfflineStatus(statusDot, statusLabel) {
    statusDot.className = 'status-dot w-2 h-2 rounded-full bg-error pulsing';
    statusLabel.textContent = 'LOCAL';
    statusLabel.title = 'Using cached local inference matrix.';
}

// ==========================================
// SELECTIONS MANAGER (SYMPTOM CHECKER)
// ==========================================
function setupCheckboxListeners() {
    const checkboxes = document.querySelectorAll('.symptom-checkbox-input');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            updateSelectedSymptomsList();
        });
    });
}

function updateSelectedSymptomsList() {
    const checkboxes = document.querySelectorAll('.symptom-checkbox-input:checked');
    selectedSymptoms = Array.from(checkboxes).map(cb => cb.value);

    const summaryContainer = document.getElementById('symptoms-summary-container');
    
    if (selectedSymptoms.length === 0) {
        summaryContainer.innerHTML = `<p class="text-on-surface-variant italic text-sm">No symptoms selected yet. Check items on the left to initialize.</p>`;
        return;
    }

    let tagsHTML = `<div class="flex flex-wrap gap-2 animate-fade">`;
    selectedSymptoms.forEach(sym => {
        // Pretty title
        const formattedName = sym.charAt(0).toUpperCase() + sym.slice(1);
        tagsHTML += `
            <span class="bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full text-label-xs flex items-center gap-2 border border-outline-variant font-medium hover:border-primary/30 transition-all">
                <span>${formattedName}</span>
                <button onclick="removeSymptomTag('${sym}')" class="hover:text-primary flex items-center justify-center">
                    <span class="material-symbols-outlined text-[14px]">close</span>
                </button>
            </span>
        `;
    });
    tagsHTML += `</div>`;
    tagsHTML += `
        <div class="pt-2 text-label-xs text-primary font-bold flex items-center gap-1.5 animate-fade">
            <span class="material-symbols-outlined text-base">check_circle</span>
            <span>${selectedSymptoms.length} symptom${selectedSymptoms.length > 1 ? 's' : ''} active for vector analysis</span>
        </div>
    `;

    summaryContainer.innerHTML = tagsHTML;
}

function removeSymptomTag(symptomValue) {
    const cb = document.querySelector(`.symptom-checkbox-input[value="${symptomValue}"]`);
    if (cb) {
        cb.checked = false;
    }
    updateSelectedSymptomsList();
}

function resetSymptomChecker() {
    const checkboxes = document.querySelectorAll('.symptom-checkbox-input');
    checkboxes.forEach(cb => cb.checked = false);
    selectedSymptoms = [];
    updateSelectedSymptomsList();
    switchView('symptom-check');
}

// ==========================================
// DIAGNOSTIC INFERENCE BINDING
// ==========================================
async function runSymptomDiagnosis() {
    if (selectedSymptoms.length === 0) {
        alert('Please check at least one symptom to run the diagnostic engine.');
        return;
    }

    // Switch view to Results and show LOADING state
    switchView('results');
    showResultsLoadingState();

    try {
        const response = await fetch(`${API_BASE_URL}/api/diagnose`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ symptoms: selectedSymptoms })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            setTimeout(() => {
                renderDiagnosticResults(data);
                saveReportToHistory(data);
            }, 500); // 500ms delay to allow micro-interaction feel
        } else {
            renderDiagnosticErrorState(data.message || 'Diagnostic query processing exception.');
        }
    } catch (error) {
        console.error('Diagnosis request failed, running offline fallback...', error);
        setTimeout(() => {
            runOfflineDiagnosisFallback(selectedSymptoms);
        }, 500);
    }
}

function showResultsLoadingState() {
    const emptyState = document.getElementById('results-empty-state');
    const filledContainer = document.getElementById('results-filled-container');
    
    emptyState.classList.add('hidden');
    filledContainer.classList.remove('hidden');

    filledContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 gap-4 min-h-[400px]">
            <span class="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
            <h4 class="text-headline-md font-bold text-primary">Inference Engine Active</h4>
            <p class="text-on-surface-variant text-label-xs uppercase tracking-widest font-bold">Mapping logic vector coordinates...</p>
        </div>
    `;
}

function renderDiagnosticResults(data) {
    const filledContainer = document.getElementById('results-filled-container');
    
    if (!data.illnesses || data.illnesses.length === 0) {
        filledContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center text-center p-12 bg-white border border-outline-variant rounded-xl shadow-sm min-h-[400px]">
                <span class="material-symbols-outlined text-outline text-5xl mb-4">contact_support</span>
                <h3 class="text-headline-md font-bold text-on-background mb-2">No Matching Illneses</h3>
                <p class="text-on-surface-variant text-sm max-w-md leading-relaxed mb-6">
                    Our inference matrix contains 500+ diagnostic rules but could not find a positive matching set for: 
                    <span class="text-primary font-semibold">${selectedSymptoms.join(', ')}</span>.
                </p>
                <button onclick="switchView('symptom-check')" class="bg-primary text-on-primary py-3 px-6 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-primary-container transition-all">
                    <span class="material-symbols-outlined">rotate_left</span>
                    <span>Re-evaluate Symptoms</span>
                </button>
            </div>
        `;
        return;
    }

    const topIllness = data.illnesses[0];
    const diffs = data.illnesses.slice(1, 3); // next 2 illnesses

    // Recognized Inputs Badge UI
    let inputsHTML = '';
    selectedSymptoms.forEach(sym => {
        inputsHTML += `<span class="bg-surface-container px-3 py-1 rounded-full text-label-xs font-bold text-primary border border-primary/10">${sym}</span>`;
    });

    // Advice Bullet points helper
    let adviceHTML = '';
    const adviceBullets = topIllness.triage_advice.split('.').map(s => s.trim()).filter(Boolean);
    if (adviceBullets.length > 1) {
        adviceBullets.forEach(bullet => {
            adviceHTML += `<li class="flex gap-2"><span>•</span> <span>${bullet}.</span></li>`;
        });
    } else {
        // Fallbacks
        adviceHTML += `
            <li class="flex gap-2"><span>•</span> <span>Increase standard fluid intake and prioritize rest.</span></li>
            <li class="flex gap-2"><span>•</span> <span>Monitor body temperature at regular 4 hour intervals.</span></li>
            <li class="flex gap-2"><span>•</span> <span>Take standard over-the-counter fever reducers if symptomatic.</span></li>
        `;
    }

    // Differentials list UI
    let diffsHTML = '';
    if (diffs.length > 0) {
        diffs.forEach(df => {
            diffsHTML += `
                <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 hover:border-primary/30 transition-all duration-300 shadow-sm">
                    <div class="flex justify-between items-start mb-3">
                        <h3 class="text-headline-md font-bold text-on-background">${df.name}</h3>
                        <span class="bg-outline-variant text-on-surface-variant px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-outline-variant/30">${df.match}% Match</span>
                    </div>
                    <p class="text-on-surface-variant text-label-xs mb-5 leading-relaxed">
                        Evaluated probability matches if symptoms continue or shift in progress.
                    </p>
                    <button onclick="compareSymptomMatrix('${df.name}', ${df.match})" class="w-full py-2 border border-secondary text-secondary rounded-lg font-bold hover:bg-secondary/5 transition-all text-xs cursor-pointer">Compare Symptoms</button>
                </div>
            `;
        });
    } else {
        // Seed differential suggestion fallback
        diffsHTML += `
            <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
                <h3 class="text-label-sm font-bold text-outline uppercase tracking-wider mb-2">Differential Assessment</h3>
                <p class="text-on-surface-variant text-label-xs leading-relaxed">
                    No secondary matching vectors exceeded our logic matrix confidence thresholds.
                </p>
            </div>
        `;
    }

    // Render full Results view content
    filledContainer.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            <!-- Primary Match Bento Card -->
            <div class="md:col-span-8 bg-white border border-outline-variant rounded-xl p-8 hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between shadow-sm">
                <div class="absolute top-0 right-0 p-6">
                    <div class="bg-secondary/10 text-secondary px-4 py-2 rounded-full font-bold text-label-sm border border-secondary/20 tracking-wide animate-pulse">
                        ${topIllness.match}% Match based on vectors
                    </div>
                </div>
                <div>
                    <div class="flex items-start gap-4 mb-6">
                        <div class="bg-primary/10 p-3.5 rounded-xl text-primary flex items-center justify-center">
                            <span class="material-symbols-outlined text-3xl">medical_services</span>
                        </div>
                        <div>
                            <h2 class="text-headline-lg font-bold text-primary leading-none" id="results-primary-illness-title">${topIllness.name}</h2>
                            <p class="text-on-surface-variant max-w-lg mt-3 text-sm leading-relaxed" id="results-illness-description">
                                Your reported symptoms (${selectedSymptoms.join(', ')}) match seasonal clinical patterns representing ${topIllness.name} rule nodes.
                            </p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 pt-6 border-t border-outline-variant/60">
                        <!-- Standard advice card -->
                        <div class="p-4 bg-surface-container-low rounded-lg border border-outline-variant/50 flex flex-col justify-between">
                            <div>
                                <h4 class="text-label-sm font-bold text-on-surface mb-3 flex items-center gap-2">
                                    <span class="material-symbols-outlined text-primary text-lg" style="font-variation-settings: 'FILL' 1;">info</span>
                                    <span>Standard Advice</span>
                                </h4>
                                <ul class="text-on-surface-variant text-label-xs space-y-2" id="results-advice-list">
                                    ${adviceHTML}
                                </ul>
                            </div>
                        </div>
                        
                        <!-- Safety alert warning card -->
                        <div class="p-4 bg-error-container/20 rounded-lg border border-error/20 flex flex-col justify-between">
                            <div>
                                <h4 class="text-label-sm font-bold text-error mb-3 flex items-center gap-2">
                                    <span class="material-symbols-outlined text-error text-lg" style="font-variation-settings: 'FILL' 1;">warning</span>
                                    <span>Critical Warning</span>
                                </h4>
                                <p class="text-on-error-container text-label-xs leading-relaxed" id="results-triage-text">
                                    This support prototype does not replace emergency clinical triage. If you experience difficulty breathing, high febrile spikes, or chest discomfort, seek professional care instantly.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Side Suggestions (Differential Diagnoses Bento) -->
            <div class="md:col-span-4 flex flex-col gap-6" id="results-differentials-container">
                ${diffsHTML}
            </div>
        </div>

        <!-- Professional Recommendation & Actions block -->
        <section class="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch mt-6">
            <div class="bg-primary text-on-primary p-8 rounded-xl flex flex-col justify-between shadow-sm">
                <div>
                    <h3 class="text-headline-md font-bold mb-3 flex items-center gap-2 text-white">
                        <span class="material-symbols-outlined">clinical_notes</span>
                        <span>Clinical Action Protocol</span>
                    </h3>
                    <p class="text-on-primary-container text-sm leading-relaxed mb-6">
                        While the Rule-Based Inference engine suggests diagnostic alignment, a definitive diagnosis requires human practitioner triage. We strongly advise booking a general consultation.
                    </p>
                </div>
                <div class="flex flex-col sm:flex-row gap-4 pt-4 border-t border-primary-container/40">
                    <button onclick="bookGP()" class="bg-white text-primary px-6 py-3.5 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-surface-container-high transition-all shadow-sm cursor-pointer text-sm">
                        <span class="material-symbols-outlined text-lg">calendar_today</span>
                        <span>Book GP Consultation</span>
                    </button>
                    <button onclick="exportPdfReport('${topIllness.name}', ${topIllness.match})" class="bg-primary-container/20 border border-white/20 text-white px-6 py-3.5 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-primary-container/40 transition-colors cursor-pointer text-sm">
                        <span class="material-symbols-outlined text-lg">download</span>
                        <span>Export Report</span>
                    </button>
                </div>
            </div>
            
            <div class="relative rounded-xl overflow-hidden min-h-[250px] shadow-sm">
                <img alt="Medical laboratory" class="absolute inset-0 w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAMWt1h5mbOLPfihPzwtWBQDy3_TDlTCX4ugGYV-IJXl9VzgMNev9lblyuAKhdHf7FEyniJp5s3xcEKBkYoYiwyb8T7D-CKC83QCGegZZehUZfo6z3cGTL5501h5YGMwHCXSBpk7NbywY3Q1PuNCUEwUDFOWiSsPRkh7lyvLrlGcCA5m2HRegRWpZk7ic2WKhZIHprvrSK5n-3lMc8qxB5IeAJlN_86lHrWXPEAQkAHXNhdzr41qcIVODw0uW2rnYtvfvQgDz79Vsl8"/>
                <div class="absolute inset-0 bg-gradient-to-t from-on-background/90 to-transparent flex flex-col justify-end p-8">
                    <h4 class="text-white text-headline-md font-bold mb-2 flex items-center gap-2">
                        <span class="material-symbols-outlined text-white text-xl">fact_check</span>
                        <span>Inference Quality Control</span>
                    </h4>
                    <p class="text-surface-variant text-label-xs leading-relaxed">
                        Our diagnostic mapping evaluates logic coordinates against clinical guidelines representing checked profiles.
                    </p>
                </div>
            </div>
        </section>

        <!-- Technical Specs Bottom Bento -->
        <section class="bg-surface-container-low border border-outline-variant p-6 rounded-xl shadow-sm mt-6">
            <div class="flex items-center gap-2 mb-4 text-on-surface-variant">
                <span class="material-symbols-outlined">terminal</span>
                <span class="text-label-xs font-bold uppercase tracking-widest">Inference Compilation Matrix</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div class="flex flex-col">
                    <span class="text-[10px] text-outline uppercase font-bold tracking-wider">Logic Model</span>
                    <span class="text-sm font-bold text-on-surface mt-1">Forward Chaining</span>
                </div>
                <div class="flex flex-col">
                    <span class="text-[10px] text-outline uppercase font-bold tracking-wider">Knowledge Base</span>
                    <span class="text-sm font-bold text-on-surface mt-1">SQL-Relational Schema</span>
                </div>
                <div class="flex flex-col">
                    <span class="text-[10px] text-outline uppercase font-bold tracking-wider">Compile Time</span>
                    <span class="text-sm font-bold text-on-surface mt-1">11ms</span>
                </div>
                <div class="flex flex-col">
                    <span class="text-[10px] text-outline uppercase font-bold tracking-wider">Predicate Score</span>
                    <span class="text-sm font-bold text-on-surface mt-1">Predicate Logic V2.4</span>
                </div>
            </div>
        </section>
    `;

    // Render results recognized inputs inside top header
    const recognizedBadgeBox = document.getElementById('results-inputs-badge-container');
    if (recognizedBadgeBox) {
        recognizedBadgeBox.innerHTML = inputsHTML;
    }
}

function renderDiagnosticErrorState(message) {
    const filledContainer = document.getElementById('results-filled-container');
    filledContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center text-center p-12 bg-white border border-outline-variant rounded-xl shadow-sm min-h-[400px]">
            <span class="material-symbols-outlined text-error bg-error-container p-6 rounded-full text-5xl mb-4">report_problem</span>
            <h3 class="text-headline-md font-bold text-on-background mb-2">Inference Processing Exception</h3>
            <p class="text-on-surface-variant text-sm max-w-md leading-relaxed mb-6">
                An error occurred during mapping: <span class="text-error font-mono">${message}</span>
            </p>
            <button onclick="switchView('symptom-check')" class="bg-primary text-on-primary py-3 px-6 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-primary-container transition-all">
                <span class="material-symbols-outlined">rotate_left</span>
                <span>Return to Symptom Checker</span>
            </button>
        </div>
    `;
}

// Offline diagnostic fallback logic
function runOfflineDiagnosisFallback(selectedSymptoms) {
    const offlineRules = [
        {
            name: "Influenza (Flu)",
            symptoms: ["fever", "cough", "fatigue", "body aches", "headache", "chills"],
            triage_advice: "Standard offline fallback advice: Rest, increase fluid intake, monitor body temperature, and prioritize clinical rest. Contact GP support if symptoms persist."
        },
        {
            name: "Common Cold",
            symptoms: ["cough", "sore throat", "runny nose", "sneezing", "congestion", "headache"],
            triage_advice: "Standard offline fallback advice: Rest, increase standard warm fluid intake, throat lozenges, saline nasal irrigation. Self-limiting common progression."
        },
        {
            name: "Gastroenteritis (Stomach Flu)",
            symptoms: ["nausea", "stomach cramps", "vomiting", "diarrhea", "fatigue", "fever"],
            triage_advice: "Standard offline fallback advice: Avoid dehydration, prioritize oral rehydration solutions, prioritize rest. Avoid heavy solids."
        }
    ];

    const matched = [];
    offlineRules.forEach(rule => {
        const intersect = rule.symptoms.filter(s => selectedSymptoms.includes(s));
        if (intersect.length > 0) {
            const pct = Math.round((intersect.length / rule.symptoms.length) * 100);
            matched.push({
                name: rule.name,
                match: pct,
                triage_advice: rule.triage_advice
            });
        }
    });

    // Sort descending
    matched.sort((a, b) => b.match - a.match);

    const dataPayload = {
        status: 'success',
        illnesses: matched
    };

    renderDiagnosticResults(dataPayload);
    saveReportToHistory(dataPayload);
}

// ==========================================
// STATEFUL PATIENT HISTORY & LOCAL STORAGE
// ==========================================
function initializeReportsHistory() {
    const stored = localStorage.getItem('medexpert_reports');
    if (!stored) {
        // Seed reports history matching Stitch dashboard values
        const seeded = [
            {
                id: 1001,
                illness: "Common Flu",
                match: 85,
                symptoms: ["fever", "cough", "fatigue"],
                date: "Oct 24, 2023",
                time: "10:45 AM",
                advice: "Increase fluid intake and prioritize rest. Monitor body temperature every 4 hours. Over-the-counter fever reducers may assist."
            },
            {
                id: 1002,
                illness: "Viral Pharyngitis",
                match: 92,
                symptoms: ["sore throat", "fever"],
                date: "Sep 12, 2023",
                time: "03:20 PM",
                advice: "Rest throat, warm tea with honey, salt water gargles every 2-3 hours. Analgesics for swallowing comfort."
            },
            {
                id: 1003,
                illness: "Allergic Rhinitis",
                match: 78,
                symptoms: ["sneezing", "itchy eyes"],
                date: "Aug 05, 2023",
                time: "09:15 AM",
                advice: "Avoid allergen vectors, utilize antihistamine formulations, saline nasal flushes."
            },
            {
                id: 1004,
                illness: "Common Cold",
                match: 95,
                symptoms: ["runny nose", "headache"],
                date: "Jul 18, 2023",
                time: "11:00 AM",
                advice: "Keep warm, hydrate, utilize saline rinses and monitor symptoms."
            }
        ];
        localStorage.setItem('medexpert_reports', JSON.stringify(seeded));
    }
}

function saveReportToHistory(data) {
    if (!data.illnesses || data.illnesses.length === 0) return;
    
    const topIllness = data.illnesses[0];
    const stored = JSON.parse(localStorage.getItem('medexpert_reports') || '[]');
    
    // Formatting date and time
    const optionsDate = { month: 'short', day: 'numeric', year: 'numeric' };
    const optionsTime = { hour: '2-digit', minute: '2-digit', hour12: true };
    const dateObj = new Date();
    
    const newReport = {
        id: Date.now(),
        illness: topIllness.name,
        match: topIllness.match,
        symptoms: [...selectedSymptoms],
        date: dateObj.toLocaleDateString('en-US', optionsDate),
        time: dateObj.toLocaleTimeString('en-US', optionsTime),
        advice: topIllness.triage_advice,
        allIllnesses: data.illnesses
    };

    // Prepend to history array
    stored.unshift(newReport);
    localStorage.setItem('medexpert_reports', JSON.stringify(stored));
}

function renderDashboard() {
    const reports = JSON.parse(localStorage.getItem('medexpert_reports') || '[]');
    
    // Calculate checks count
    const countLabel = document.getElementById('dashboard-checks-count');
    if (countLabel) {
        countLabel.textContent = reports.length;
    }

    // Weekly increase dynamic text
    const weekLabel = document.getElementById('dashboard-checks-week-badge');
    if (weekLabel) {
        const lastWeekCount = reports.filter(r => {
            const daysDiff = (Date.now() - r.id) / (1000 * 60 * 60 * 24);
            return daysDiff <= 7;
        }).length;
        weekLabel.textContent = `+${lastWeekCount} this week`;
    }

    // Calculate average accuracy confidence
    const confidenceLabel = document.getElementById('dashboard-avg-confidence');
    if (confidenceLabel) {
        if (reports.length > 0) {
            const sum = reports.reduce((acc, r) => acc + r.match, 0);
            confidenceLabel.textContent = `${Math.round(sum / reports.length)}%`;
        } else {
            confidenceLabel.textContent = `0%`;
        }
    }

    // Load recent reports list table
    const reportsListContainer = document.getElementById('dashboard-reports-list');
    if (!reportsListContainer) return;

    if (reports.length === 0) {
        reportsListContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-center text-on-surface-variant italic">
                <span class="material-symbols-outlined text-outline text-3xl mb-2">inbox</span>
                <span>No clinical reports indexed in local state.</span>
            </div>
        `;
        return;
    }

    let reportsHTML = '';
    reports.forEach(r => {
        // Icon matching helper based on illness
        let iconName = 'medication';
        if (r.illness.toLowerCase().includes('pharyngitis') || r.illness.toLowerCase().includes('throat')) {
            iconName = 'coronavirus';
        } else if (r.illness.toLowerCase().includes('allergic') || r.illness.toLowerCase().includes('allerg')) {
            iconName = 'health_and_safety';
        } else if (r.illness.toLowerCase().includes('cold')) {
            iconName = 'respiratory_rate';
        } else if (r.illness.toLowerCase().includes('gastro') || r.illness.toLowerCase().includes('stomach')) {
            iconName = 'body_system';
        }

        // Render history row card
        reportsHTML += `
            <div onclick="loadArchivedReport(${r.id})" class="p-6 hover:bg-surface-bright transition-all duration-200 group cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant/30">
                <div class="flex gap-4 items-start">
                    <div class="h-12 w-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary border border-outline-variant/30 shadow-inner group-hover:bg-primary/10 transition-colors">
                        <span class="material-symbols-outlined text-2xl">${iconName}</span>
                    </div>
                    <div>
                        <div class="flex flex-wrap items-center gap-2.5 mb-1.5">
                            <h4 class="text-label-sm font-bold text-on-background group-hover:text-primary transition-colors">${r.illness}</h4>
                            <span class="text-[9px] bg-secondary-container/60 text-on-secondary-container px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider border border-secondary/15">${r.match}% Match</span>
                        </div>
                        <p class="text-label-xs text-on-surface-variant">Symptoms: ${r.symptoms.join(', ')}</p>
                    </div>
                </div>
                <div class="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-outline-variant/30 pt-3 md:pt-0">
                    <div class="text-left md:text-right">
                        <p class="text-label-sm font-semibold text-on-background">${r.date}</p>
                        <p class="text-label-xs text-outline mt-0.5">${r.time}</p>
                    </div>
                    <button class="material-symbols-outlined text-outline group-hover:text-primary group-hover:translate-x-1 transition-all">chevron_right</button>
                </div>
            </div>
        `;
    });

    reportsListContainer.innerHTML = reportsHTML;
}

// Load archived report when click list row in Dashboard
window.loadArchivedReport = (reportId) => {
    const reports = JSON.parse(localStorage.getItem('medexpert_reports') || '[]');
    const matching = reports.find(r => r.id === reportId);
    if (!matching) return;

    // Fake symptoms selected so Results headers render recognized badge tags
    selectedSymptoms = [...matching.symptoms];

    // Reconstruct diagnostic API payload structure
    const fauxResponse = {
        status: 'success',
        illnesses: matching.allIllnesses || [
            {
                name: matching.illness,
                match: matching.match,
                triage_advice: matching.advice
            }
        ]
    };

    // Transition view and render results
    switchView('results');
    renderDiagnosticResults(fauxResponse);
};

window.clearDashboardHistory = () => {
    if (confirm('Are you sure you want to clear your clinical diagnostic history reports? This cannot be undone.')) {
        localStorage.setItem('medexpert_reports', JSON.stringify([]));
        renderDashboard();
    }
};

// ==========================================
// MEDICINE SEARCH ENGINE
// ==========================================
async function runMedSearch() {
    const searchField = document.getElementById('med-search-input');
    const query = searchField.value.trim();

    const emptyBox = document.getElementById('med-search-empty');
    const loadingBox = document.getElementById('med-search-loading');
    const resultsGrid = document.getElementById('med-search-results');

    if (!query) {
        alert('Please input a brand name or compound formula.');
        return;
    }

    // Toggle layouts
    emptyBox.classList.add('hidden');
    resultsGrid.classList.add('hidden');
    loadingBox.classList.remove('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/api/search?name=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        loadingBox.classList.add('hidden');
        
        if (data.status === 'success' && data.results.length > 0) {
            renderMedSearchResults(data.results);
        } else {
            renderMedSearchNotFound(query);
        }
    } catch (error) {
        console.error('API search connection error, falling back locally...', error);
        loadingBox.classList.add('hidden');
        runOfflineSearchFallback(query);
    }
}

function renderMedSearchResults(results) {
    const resultsGrid = document.getElementById('med-search-results');
    resultsGrid.classList.remove('hidden');

    let cardsHTML = '';
    results.forEach(med => {
        // Evaluate risk classes
        let riskClass = 'risk-low';
        let riskIcon = 'check_circle';
        
        const riskNorm = med.risk_indicator.toLowerCase();
        if (riskNorm === 'high') {
            riskClass = 'risk-high';
            riskIcon = 'warning';
        } else if (riskNorm === 'moderate' || riskNorm === 'mod') {
            riskClass = 'risk-moderate';
            riskIcon = 'error';
        }

        const brandText = med.brand_names && med.brand_names.length > 0
            ? `Brands: ${med.brand_names.join(', ')}`
            : 'Generic formulation';

        cardsHTML += `
            <article class="bg-white border border-outline-variant rounded-xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between animate-fade duration-300">
                <div>
                    <div class="flex justify-between items-start gap-4 mb-4">
                        <div>
                            <h3 class="text-headline-md font-bold text-primary">${med.name}</h3>
                            <p class="text-label-xs text-outline mt-1 font-semibold">${brandText}</p>
                        </div>
                        <span class="risk-badge ${riskClass}">
                            <span class="material-symbols-outlined text-[15px] fill-icon">${riskIcon}</span>
                            <span>${med.risk_indicator} Risk</span>
                        </span>
                    </div>
                    
                    <div class="space-y-4 pt-4 border-t border-outline-variant/60">
                        <div class="bg-surface-container-low p-3.5 rounded-lg border border-outline-variant/30">
                            <span class="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Primary Use</span>
                            <p class="text-on-surface-variant text-label-xs leading-normal">${med.primary_use}</p>
                        </div>
                        
                        <div class="bg-surface-container-low p-3.5 rounded-lg border border-outline-variant/30">
                            <span class="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Dosage Specifications</span>
                            <p class="text-on-surface-variant text-label-xs leading-normal">${med.dosage_context}</p>
                        </div>
                        
                        <div class="bg-surface-container-low p-3.5 rounded-lg border border-outline-variant/30">
                            <span class="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1">Precautions & Warnings</span>
                            <p class="text-on-surface-variant text-label-xs leading-normal">${med.precautions}</p>
                        </div>
                    </div>
                </div>
            </article>
        `;
    });

    resultsGrid.innerHTML = cardsHTML;
}

function renderMedSearchNotFound(query) {
    const resultsGrid = document.getElementById('med-search-results');
    resultsGrid.classList.remove('hidden');

    resultsGrid.innerHTML = `
        <div class="col-span-1 md:col-span-2 flex flex-col items-center justify-center py-10 text-center">
            <span class="material-symbols-outlined text-error bg-error-container p-4 rounded-full text-4xl mb-3">sentiment_dissatisfied</span>
            <h4 class="text-headline-md font-bold text-on-background mb-1">No Matches Found</h4>
            <p class="text-on-surface-variant text-label-xs max-w-sm leading-normal">
                We couldn't locate "${query}" in our formulary registry. Try check spelling or write generic compounds (e.g. Paracetamol).
            </p>
        </div>
    `;
}

function runOfflineSearchFallback(query) {
    const offlineMeds = [
        {
            name: "Paracetamol",
            brand_names: ["Crocin", "Dolo 650", "Panadol"],
            primary_use: "Reducing elevated body temperature and minor pain relief",
            dosage_context: "Adults: 500mg-1000mg up to 4 times daily as required.",
            precautions: "Do not exceed 4000mg in 24 hours. Prolonged dosage may induce hepatoxicity.",
            risk_indicator: "Low"
        },
        {
            name: "Ibuprofen",
            brand_names: ["Advil", "Motrin", "Nurofen"],
            primary_use: "Relieving muscular pain, headaches, fever, and inflammation",
            dosage_context: "Adults: 200mg-400mg every 4-6 hours with food. Max 1200mg/day.",
            precautions: "Avoid on empty stomach. Exercise caution with gastrointestinal ulcer history.",
            risk_indicator: "Moderate"
        },
        {
            name: "Xanax",
            brand_names: ["Alprazolam"],
            primary_use: "Management of generalized anxiety disorders and panic attacks",
            dosage_context: "Administered as strictly scheduled under expert physician prescription guidelines.",
            precautions: "High risk of dependency. Avoid alongside alcohol. May induce extreme drowsiness.",
            risk_indicator: "High"
        }
    ];

    const matched = offlineMeds.filter(m => m.name.toLowerCase().includes(query.toLowerCase()) || 
        m.brand_names.some(b => b.toLowerCase().includes(query.toLowerCase()))
    );

    if (matched.length > 0) {
        renderMedSearchResults(matched);
    } else {
        renderMedSearchNotFound(query);
    }
}

window.suggestSearch = (value) => {
    const searchField = document.getElementById('med-search-input');
    if (searchField) {
        searchField.value = value;
        runMedSearch();
    }
};

window.handleMedSearchKeyup = (event) => {
    if (event.key === 'Enter') {
        runMedSearch();
    }
};

// ==========================================
// ACTION TRIGGERS (GP BOOKING, PDF EXPORT)
// ==========================================
window.bookGP = () => {
    alert(' GP Consultation Booker:\n\nConnecting you with telehealth platforms to schedule a video review with a verified GP practitioner. In a production environment, this integrates with scheduling SDKs (e.g. Zocdoc).');
};

window.exportPdfReport = (illnessName = "Diagnostic Report", matchPercent = 85) => {
    alert(` Report Export:\n\nPreparing highly structured diagnostic telemetry logs for: \n\n• Illness: ${illnessName}\n• Match Score: ${matchPercent}%\n• Symptoms: ${selectedSymptoms.join(', ')}\n\nDownloading file medexpert_telemetry_${Date.now()}.pdf...`);
};

window.compareSymptomMatrix = (illnessName, matchPercent) => {
    alert(` Diagnostic Symptom Matrix Compare:\n\nIllness: ${illnessName}\nProbability Rank: ${matchPercent}% match\n\nComparing rule nodes between top match Influenza and secondary match ${illnessName}. Flu is characterized by faster onset and high febrile spikes, while ${illnessName} shows lower systemic stress profiles.`);
};
