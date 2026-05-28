// Backend Connection Configurations
const API_BASE_URL = window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
    checkBackendHealth();
    setupScrollSpy();
});

function setupScrollSpy() {
    const sections = [
        document.getElementById('diagnostic-panel'),
        document.getElementById('search-panel')
    ];
    const navItems = {
        'diagnostic-panel': document.querySelector('a[href="#diagnostic-panel"]'),
        'search-panel': document.querySelector('a[href="#search-panel"]')
    };

    const observerOptions = {
        root: null,
        rootMargin: '-10% 0px -50% 0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                Object.values(navItems).forEach(item => {
                    if (item) item.classList.remove('active');
                });
                const item = navItems[entry.target.id];
                if (item) item.classList.add('active');
            }
        });
    }, observerOptions);

    sections.forEach(sec => {
        if (sec) observer.observe(sec);
    });
}

// 1. Connection Health Check
async function checkBackendHealth() {
    const indicator = document.getElementById('health-indicator');
    const dot = indicator.querySelector('.status-dot');
    const label = indicator.querySelector('.status-label');

    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        const data = await response.json();
        
        if (data.status === 'ok') {
            dot.className = 'status-dot online pulsing';
            label.textContent = `Server Online (${data.medicines_count} Drugs, ${data.illnesses_count} Rules)`;
        } else {
            setOfflineState(dot, label);
        }
    } catch (error) {
        console.error('Backend health ping failed:', error);
        setOfflineState(dot, label);
    }
}

function setOfflineState(dot, label) {
    dot.className = 'status-dot offline pulsing';
    label.textContent = 'Server Offline (Using Local Mode)';
}

// 2. Module A: Diagnostic Rule Engine
async function runDiagnosis() {
    const checkedBoxes = document.querySelectorAll('input[name="symptom"]:checked');
    const emptyState = document.getElementById('diagnostic-empty-state');
    const resultsContainer = document.getElementById('diagnostic-results');
    const illnessList = document.getElementById('illness-list');
    const triageText = document.getElementById('triage-text');

    if (checkedBoxes.length === 0) {
        alert('Please select at least one symptom to run diagnosis.');
        return;
    }

    const symptoms = Array.from(checkedBoxes).map(box => box.value);

    // Show loading skeleton if needed, or update text
    emptyState.style.display = 'none';
    resultsContainer.style.display = 'block';
    illnessList.innerHTML = '<p style="color: var(--color-text-muted); font-size: 0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> Processing symptom vectors...</p>';
    triageText.textContent = 'Analyzing rule sets...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/diagnose`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ symptoms })
        });
        
        const data = await response.json();

        if (data.status === 'success') {
            renderDiagnosisResults(data);
        } else {
            illnessList.innerHTML = `<p style="color: var(--color-danger); font-size: 0.85rem;">Error: ${data.message}</p>`;
            triageText.textContent = 'Could not establish triage guidance.';
        }
    } catch (error) {
        console.error('Diagnostic call failed:', error);
        // Offline Fallback calculations (optional, fallback to local rule check if API fails)
        runOfflineDiagnosisFallback(symptoms);
    }
}

function renderDiagnosisResults(data) {
    const illnessList = document.getElementById('illness-list');
    const triageText = document.getElementById('triage-text');

    if (!data.illnesses || data.illnesses.length === 0) {
        illnessList.innerHTML = `
            <div class="empty-state" style="padding: 1.5rem 0; min-height: auto;">
                <div class="empty-icon" style="font-size: 1.8rem;"><i class="fa-solid fa-circle-question"></i></div>
                <p style="font-size: 0.8rem;">No illnesses matched those selected symptoms. Check for alternative symptoms.</p>
            </div>
        `;
        triageText.textContent = data.triage_advice || "No specific precautions needed. Monitor your condition and rest.";
        return;
    }

    let rowsHTML = '';
    data.illnesses.forEach(illness => {
        rowsHTML += `
            <article class="illness-item">
                <div class="illness-info">
                    <span class="illness-name">${illness.name}</span>
                    <span class="illness-match-score">${illness.match}% Match</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${illness.match}%"></div>
                </div>
            </article>
        `;
    });

    illnessList.innerHTML = rowsHTML;
    triageText.textContent = data.triage_advice;
}

function clearSymptoms() {
    const checkboxes = document.querySelectorAll('input[name="symptom"]:checked');
    checkboxes.forEach(box => {
        box.checked = false;
    });

    document.getElementById('diagnostic-empty-state').style.display = 'flex';
    document.getElementById('diagnostic-results').style.display = 'none';
}

// 3. Module B: Medicine Search Engine
async function runSearch() {
    const queryInput = document.getElementById('medicine-search-input');
    const query = queryInput.value.trim();
    
    const emptyState = document.getElementById('search-empty-state');
    const loadingState = document.getElementById('search-loading');
    const resultsContainer = document.getElementById('search-results-container');

    if (!query) {
        alert('Please enter a medicine name to search.');
        return;
    }

    // Toggle panel visibility
    emptyState.style.display = 'none';
    resultsContainer.style.display = 'none';
    loadingState.style.display = 'flex';

    try {
        const response = await fetch(`${API_BASE_URL}/api/search?name=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        loadingState.style.display = 'none';
        
        if (data.status === 'success' && data.results.length > 0) {
            renderSearchResults(data.results);
        } else {
            renderSearchNotFound(query);
        }
    } catch (error) {
        console.error('Search request failed:', error);
        loadingState.style.display = 'none';
        runOfflineSearchFallback(query);
    }
}

function renderSearchResults(results) {
    const container = document.getElementById('search-results-container');
    container.style.display = 'block';

    let html = '';
    results.forEach(med => {
        const riskClass = med.risk_indicator.toLowerCase() === 'high' 
            ? 'risk-high' 
            : med.risk_indicator.toLowerCase() === 'moderate' 
                ? 'risk-moderate' 
                : 'risk-low';

        const riskIcon = med.risk_indicator.toLowerCase() === 'high' 
            ? '<i class="fa-solid fa-triangle-exclamation"></i>' 
            : med.risk_indicator.toLowerCase() === 'moderate' 
                ? '<i class="fa-solid fa-circle-exclamation"></i>' 
                : '<i class="fa-solid fa-circle-check"></i>';

        const brandText = med.brand_names && med.brand_names.length > 0
            ? `Brands: ${med.brand_names.join(', ')}`
            : 'Generic medication';

        html += `
            <article class="medicine-card">
                <div class="medicine-header">
                    <div class="medicine-title-area">
                        <h3>${med.name}</h3>
                        <p class="medicine-brands">${brandText}</p>
                    </div>
                    <span class="risk-badge ${riskClass}">
                        ${riskIcon} ${med.risk_indicator} Risk
                    </span>
                </div>
                
                <div class="info-item">
                    <strong>Primary Use</strong>
                    <p>${med.primary_use}</p>
                </div>
                
                <div class="info-item">
                    <strong>Dosage Context</strong>
                    <p>${med.dosage_context}</p>
                </div>
                
                <div class="info-item">
                    <strong>Precautions</strong>
                    <p>${med.precautions}</p>
                </div>
            </article>
        `;
    });

    container.innerHTML = html;
}

function renderSearchNotFound(query) {
    const container = document.getElementById('search-results-container');
    container.style.display = 'block';
    container.innerHTML = `
        <div class="empty-state" style="padding: 2rem 1rem; min-height: auto;">
            <div class="empty-icon" style="font-size: 2.2rem; color: var(--color-danger);"><i class="fa-solid fa-face-frown-open"></i></div>
            <h4 style="color: var(--color-text-bright); margin-bottom: 0.5rem; font-family: var(--font-heading);">No Medication Matches</h4>
            <p style="font-size: 0.8rem; max-width: 250px;">We couldn't find "${query}" in our local formulary. Try spelling check or generic search (e.g. Paracetamol).</p>
        </div>
    `;
}

function handleSearchKeyup(event) {
    if (event.key === 'Enter') {
        runSearch();
    }
}

// 4. Fallbacks when backend is not active
function runOfflineDiagnosisFallback(selectedSymptoms) {
    const illnessList = document.getElementById('illness-list');
    const triageText = document.getElementById('triage-text');
    
    // Quick local rule check if backend is offline
    const localRules = [
        {
            name: "Influenza (Flu)",
            symptoms: ["fever", "cough", "fatigue", "body aches", "headache", "sore throat"],
            triage: "Offline Fallback: Rest, hydrate, and take antipyretics. Seek care if breath shortness occurs."
        },
        {
            name: "Common Cold",
            symptoms: ["cough", "sore throat", "runny nose", "sneezing", "congestion"],
            triage: "Offline Fallback: Keep warm, hydrate, symptoms will usually resolve in 7 days."
        }
    ];

    const matched = [];
    localRules.forEach(rule => {
        const intersection = rule.symptoms.filter(x => selectedSymptoms.includes(x));
        if (intersection.length > 0) {
            const score = Math.round((intersection.length / rule.symptoms.length) * 100);
            matched.push({ name: rule.name, match: score, triage_advice: rule.triage });
        }
    });

    matched.sort((a,b) => b.match - a.match);
    renderDiagnosisResults({ status: "success", illnesses: matched, triage_advice: matched[0]?.triage_advice || "Monitor symptoms." });
}

function runOfflineSearchFallback(query) {
    const localMeds = [
        {
            name: "Paracetamol",
            brand_names: ["Crocin", "Dolo 650"],
            primary_use: "Fever and mild pain relief",
            dosage_context: "Adults: 500mg-1000mg every 4-6 hours.",
            precautions: "Do not exceed 4000mg/day to prevent liver damage.",
            risk_indicator: "Low"
        }
    ];

    const matched = localMeds.filter(m => m.name.toLowerCase().includes(query.toLowerCase()));
    if (matched.length > 0) {
        renderSearchResults(matched);
    } else {
        renderSearchNotFound(query);
    }
}

// 5. Navigation Bar controller
window.activateNavItem = (element) => {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    element.classList.add('active');
};
