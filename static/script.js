// static/script.js
// Complete JavaScript for Compile Draft Helper v1.51 (Flask+SQLite+Config)

document.addEventListener('DOMContentLoaded', () => {

    // --- Global State & Elements ---
    let gameState = 'initial-setup'; // initial-setup, randomizing, drafting, results, post-game
    let currentPlayer = 1;
    let startingPlayer = 1;
    let currentPickNumber = 0;
    let picksThisTurn = 0;
    let availableProtocols = [];
    let player1Protocols = [];
    let player2Protocols = [];
    let player1Name = 'Player 1';
    let player2Name = 'Player 2';
    let includeAux1 = true;
    const totalProtocolsToDraft = 6;

    // --- Define Protocol Pools ---
    const mainProtocols = [
        "Spirit", "Death", "Metal", "Gravity", "Plague", "Life",
        "Fire", "Darkness", "Water", "Psychic", "Speed", "Hate"
    ];
    const auxProtocols = ["Light", "Love", "Apathy"];

    // --- DOM Element References ---
    const sections = {}; // Populated below
    const navButtons = document.querySelectorAll('.nav-button');
    // Draft Section Elements
    const initialSetupView = document.getElementById('initial-setup');
    const p1NameInput = document.getElementById('player1-name');
    const p2NameInput = document.getElementById('player2-name');
    const includeAux1Checkbox = document.getElementById('include-aux1');
    const startDraftProcessButton = document.getElementById('start-draft-process-button');
    const playerDatalist = document.getElementById('player-names-list'); // Datalist for names
    const randomizerView = document.getElementById('randomizer');
    const randomizerStatus = document.getElementById('randomizer-status');
    const draftingInterfaceView = document.getElementById('drafting-interface');
    const firstPlayerAnnouncementDrafting = document.getElementById('first-player-announcement-drafting');
    const availableProtocolsTitle = document.getElementById('available-protocols-title');
    const availableProtocolsList = document.getElementById('available-protocols-list');
    const draftStatus = document.getElementById('draft-status');
    const draftError = document.getElementById('draft-error');
    const p1DraftTitle = document.getElementById('player1-draft-title');
    const p2DraftTitle = document.getElementById('player2-draft-title');
    const player1ProtocolsList = document.getElementById('player1-protocols-list');
    const player2ProtocolsList = document.getElementById('player2-protocols-list');
    // Results Section Elements
    const draftResultsView = document.getElementById('draft-results');
    const resultsP1Title = document.getElementById('results-p1-title');
    const resultsP2Title = document.getElementById('results-p2-title');
    const resultsP1List = document.getElementById('results-p1-list');
    const resultsP2List = document.getElementById('results-p2-list');
    const outcomeRecorder = document.getElementById('outcome-recorder');
    const p1WinsButton = document.getElementById('p1-wins-button');
    const p2WinsButton = document.getElementById('p2-wins-button');
    const outcomeMessage = document.getElementById('outcome-message');
    const restartDraftButton = document.getElementById('restart-draft-button');
    // Stats Elements
    const statsDisplay = document.getElementById('stats-display');
    const statsContent = document.getElementById('stats-content');
    // Card Viewer Elements
    const cardFilterInput = document.getElementById('card-filter');
    const cardDisplay = document.getElementById('card-display');
    // Config Section Elements
    const configSection = document.getElementById('section-config'); // Added
    const configLoading = document.getElementById('config-loading');
    const configError = document.getElementById('config-error');
    const configLogTableContainer = document.getElementById('config-log-table-container');
    const configLogTableBody = document.getElementById('config-log-table-body');
    const configNoLogs = document.getElementById('config-no-logs');
    const clearAllLogsButton = document.getElementById('clear-all-logs-button');
    // Edit Modal Elements
    const editLogModal = document.getElementById('edit-log-modal');
    const editLogForm = document.getElementById('edit-log-form');
    const editLogIdSpan = document.getElementById('edit-log-id');
    const editLogIdInput = document.getElementById('edit-log-id-input');
    const editP1NameInput = document.getElementById('edit-p1-name');
    const editP1ProtocolsInput = document.getElementById('edit-p1-protocols');
    const editP2NameInput = document.getElementById('edit-p2-name');
    const editP2ProtocolsInput = document.getElementById('edit-p2-protocols');
    const editWinnerNameInput = document.getElementById('edit-winner-name');
    const editWinnerList = document.getElementById('edit-winner-list');
    const editLogError = document.getElementById('edit-log-error');
    const closeModalButton = document.querySelector('.close-modal-button');
    const cancelEditButton = document.querySelector('.cancel-edit-button');


    // Helper to get references to all sections
    Object.assign(sections, {
        draft: document.getElementById('section-draft'),
        cards: document.getElementById('section-cards'),
        rules: document.getElementById('section-rules'),
        config: document.getElementById('section-config') // Added config section
    });

    // --- Load Initial Data ---
    loadPlayerNames(); // Load names for quick select on page load


    // --- Navigation Logic ---
    function showSection(sectionId) {
        Object.values(sections).forEach(section => section.classList.remove('active'));
        if (sections[sectionId]) {
            sections[sectionId].classList.add('active');
        }
        navButtons.forEach(button => {
            button.classList.remove('active');
            if (button.dataset.section === sectionId) {
                button.classList.add('active');
            }
        });
        const activeSection = document.querySelector('.app-section.active');
        if (activeSection) activeSection.scrollTop = 0;

        // Load data when specific sections are shown
        if (sectionId === 'draft' && (gameState === 'post-game' || gameState === 'results')) {
           loadAndDisplayStats(); // Load stats if draft finished
        } else if (sectionId === 'config') {
            loadConfigLogs(); // Load logs when config tab is opened
        }

        // Hide stats if not on draft tab in post-game/results state
        if (!(sectionId === 'draft' && (gameState === 'post-game' || gameState === 'results'))) {
             statsDisplay.classList.add('hidden');
        }
    }

    // --- Player Name Quick Select Logic ---
    async function loadPlayerNames() {
        const datalist = playerDatalist; // Use already defined variable
        if (!datalist) return;

        try {
            const response = await fetch('/api/players');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();

            if (result.status === 'success' && Array.isArray(result.data)) {
                datalist.innerHTML = ''; // Clear existing options
                result.data.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    datalist.appendChild(option);
                });
                console.log('Player names loaded for quick select.');
            } else {
                 throw new Error(result.message || 'Failed to parse player names.');
            }
        } catch (error) {
            console.error('Error loading player names for quick select:', error);
            datalist.innerHTML = '<option value="">Error loading names</option>';
        }
    }

    // --- Main Draft Start Process ---
    function startDraftProcess() {
        player1Name = p1NameInput.value.trim() || 'Player 1';
        player2Name = p2NameInput.value.trim() || 'Player 2';
        includeAux1 = includeAux1Checkbox.checked;

        // Update UI elements with player names
        p1DraftTitle.textContent = `${player1Name}'s Acquired Protocols:`;
        p2DraftTitle.textContent = `${player2Name}'s Acquired Protocols:`;
        resultsP1Title.textContent = `${player1Name}'s Final Protocols:`;
        resultsP2Title.textContent = `${player2Name}'s Final Protocols:`;
        p1WinsButton.textContent = `${player1Name} Wins`;
        p2WinsButton.textContent = `${player2Name} Wins`;

        // Transition UI states
        initialSetupView.classList.add('hidden');
        randomizerView.classList.remove('hidden');
        gameState = 'randomizing';
        startDraftProcessButton.disabled = true;

        runRandomizer();
    }

    // --- Randomizer Logic ---
    function runRandomizer() {
        randomizerStatus.textContent = "Calibrating AI core...";
        let counter = 0;
        const messages = [ "Scanning tachyon signatures...", "Accessing probability matrix...", "Querying subspace anomalies...", "Rerouting power flow...", "Engaging stochastic decision engine...", "Finalizing priority sequence..." ];
        const interval = setInterval(() => {
            randomizerStatus.textContent = messages[counter % messages.length];
            counter++;
            if (counter > messages.length + Math.random() * 3) {
                clearInterval(interval);
                startingPlayer = Math.random() < 0.5 ? 1 : 2;
                const startingPlayerNameText = startingPlayer === 1 ? player1Name : player2Name;
                randomizerStatus.textContent = `\n>>> ${startingPlayerNameText} <<< \nhas established initial connection.\nThey will draft first.`;
                randomizerStatus.style.color = 'var(--primary-color)';
                randomizerStatus.style.fontSize = '1.3rem';
                randomizerStatus.style.fontWeight = 'bold';
                randomizerStatus.style.lineHeight = '1.4';
                setTimeout(setupAndStartDraft, 1500);
            }
        }, 400);
    }

    // --- Setup Draft State & UI (Called after randomizer) ---
     function setupAndStartDraft() {
         randomizerView.classList.add('hidden');
         draftingInterfaceView.classList.remove('hidden');
         firstPlayerAnnouncementDrafting.textContent = `${startingPlayer === 1 ? player1Name : player2Name}`;

         const currentProtocolPool = includeAux1 ? [...mainProtocols, ...auxProtocols] : [...mainProtocols];
         availableProtocolsTitle.textContent = `Available Protocols (${currentProtocolPool.length} Total):`;

         availableProtocols = [...currentProtocolPool].sort(() => Math.random() - 0.5);
         player1Protocols = [];
         player2Protocols = [];
         currentPickNumber = 0;
         currentPlayer = startingPlayer;
         gameState = 'drafting';

         outcomeRecorder.classList.add('hidden');
         outcomeMessage.classList.add('hidden');
         statsDisplay.classList.add('hidden');

         determineNextPick();
         updateDraftUI();
    }

    // --- Draft Logic ---
     function determineNextPick() {
         currentPickNumber++;
         draftError.classList.add('hidden');
         if (currentPickNumber === 1) { currentPlayer = startingPlayer; picksThisTurn = 1; }
         else if (currentPickNumber === 2 || currentPickNumber === 3) { currentPlayer = (startingPlayer === 1) ? 2 : 1; picksThisTurn = 1; }
         else if (currentPickNumber === 4 || currentPickNumber === 5) { currentPlayer = startingPlayer; picksThisTurn = 1; }
         else if (currentPickNumber === 6) { currentPlayer = (startingPlayer === 1) ? 2 : 1; picksThisTurn = 1; }
         else { endDraft(); return; }

         let pickInstruction = "";
         if (currentPickNumber === 2) pickInstruction = "(Pick 1 of 2)";
         if (currentPickNumber === 3) pickInstruction = "(Pick 2 of 2)";
         if (currentPickNumber === 4) pickInstruction = "(Pick 1 of 2)";
         if (currentPickNumber === 5) pickInstruction = "(Pick 2 of 2)";
         const currentTurnPlayerName = currentPlayer === 1 ? player1Name : player2Name;
         draftStatus.textContent = `Pick ${currentPickNumber}/${totalProtocolsToDraft}: ${currentTurnPlayerName} selects 1 Protocol ${pickInstruction}`;
     }

     function selectProtocol(protocolName) {
        if (gameState !== 'drafting' || picksThisTurn <= 0) return;
        const packIndex = availableProtocols.indexOf(protocolName);
        if (packIndex > -1) {
            availableProtocols.splice(packIndex, 1);
            if (currentPlayer === 1) { player1Protocols.push(protocolName); }
            else { player2Protocols.push(protocolName); }
            picksThisTurn--;

            if (currentPickNumber >= totalProtocolsToDraft) { endDraft(); }
            else { determineNextPick(); updateDraftUI(); }
        } else {
            draftError.textContent = "Error: Protocol already selected or invalid.";
            draftError.classList.remove('hidden');
        }
     }

     function endDraft() {
         gameState = 'results';
         draftingInterfaceView.classList.add('hidden');
         draftResultsView.classList.remove('hidden');
         outcomeRecorder.classList.remove('hidden');
         p1WinsButton.disabled = false;
         p2WinsButton.disabled = false;
         outcomeMessage.classList.add('hidden');
         updateDraftUI();
         loadAndDisplayStats();
    }

    // --- UI Update Logic (Draft section) ---
    function updateDraftUI() {
        // Render available protocol buttons
        availableProtocolsList.innerHTML = '';
        if (gameState === 'drafting') {
            availableProtocols.forEach(protocol => {
                const button = document.createElement('button');
                button.textContent = `SELECT: ${protocol}`;
                button.classList.add('protocol-button');
                button.onclick = () => selectProtocol(protocol);
                availableProtocolsList.appendChild(button);
            });
        }
        // Render player selected protocols
        const renderList = (listElement, protocols) => {
            if (!listElement) return; // Guard against elements not found
            listElement.innerHTML = '';
            protocols.forEach(p => {
                const li = document.createElement('li');
                li.textContent = p;
                listElement.appendChild(li);
            });
        };
        renderList(player1ProtocolsList, player1Protocols);
        renderList(player2ProtocolsList, player2Protocols);
        renderList(resultsP1List, player1Protocols);
        renderList(resultsP2List, player2Protocols);
    }

     // --- Restart Logic ---
     function restartDraft() {
         gameState = 'initial-setup';
         draftResultsView.classList.add('hidden');
         draftingInterfaceView.classList.add('hidden');
         randomizerView.classList.add('hidden');
         statsDisplay.classList.add('hidden');
         initialSetupView.classList.remove('hidden');
         startDraftProcessButton.disabled = false;

         randomizerStatus.textContent = 'Analyzing quantum fluctuations...';
         randomizerStatus.style.color = 'var(--accent-color)';
         randomizerStatus.style.fontSize = '1.2rem';
         randomizerStatus.style.fontWeight = 'normal';
         availableProtocolsList.innerHTML = '';
         player1ProtocolsList.innerHTML = '';
         player2ProtocolsList.innerHTML = '';
         resultsP1List.innerHTML = '';
         resultsP2List.innerHTML = '';
         draftStatus.textContent = 'Initializing...';
         loadPlayerNames(); // Reload names
     }

    // --- Game Outcome & Stats Logic (Using Fetch to Flask Backend) ---
    async function recordWin(winningPlayer) {
        if (gameState !== 'results' && gameState !== 'post-game') return;
        p1WinsButton.disabled = true;
        p2WinsButton.disabled = true;
        outcomeMessage.textContent = "Logging game outcome...";
        outcomeMessage.style.color = 'var(--warning-color)';
        outcomeMessage.classList.remove('hidden');
        const winnerName = winningPlayer === 1 ? player1Name : player2Name;
        const gameData = { player1Name, player1Protocols, player2Name, player2Protocols, winnerName };

        try {
            const response = await fetch('/api/log_game', { method: 'POST', cache: 'no-cache', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(gameData) });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') throw new Error(result.message || `HTTP error ${response.status}`);
            outcomeMessage.textContent = `Outcome recorded: ${winnerName} wins!`;
            outcomeMessage.style.color = 'var(--primary-color)';
            gameState = 'post-game';
            loadPlayerNames(); // Update player list
            loadAndDisplayStats();
        } catch (error) {
            console.error('Error recording win:', error);
            outcomeMessage.textContent = `Error recording outcome: ${error.message}`;
            outcomeMessage.style.color = 'var(--error-color)';
            // Consider re-enabling buttons?
            // p1WinsButton.disabled = false;
            // p2WinsButton.disabled = false;
        }
        outcomeMessage.classList.remove('hidden');
    }

    async function loadAndDisplayStats() {
        statsContent.innerHTML = '<p>Loading stats from server...</p>';
        statsDisplay.classList.remove('hidden'); // Ensure visible while loading/error

        try {
            const response = await fetch('/api/stats', { method: 'GET', cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || 'Failed to parse stats data.');

            const stats = result.data;
            statsContent.innerHTML = ''; // Clear loading message

            if (!stats || stats.gamesPlayed === 0) {
                statsContent.innerHTML = '<p>No game data recorded yet.</p>';
                return; // Exit early
            }

            let html = `<p><strong>Total Games Recorded:</strong> ${stats.gamesPlayed}</p>`;
            // Player Wins
            html += '<h3>Player Win Counts:</h3>';
            const sortedPlayers = Object.entries(stats.playerWins || {}).sort(([, a], [, b]) => b - a);
            if (sortedPlayers.length === 0) { html += '<p>No player wins recorded.</p>'; }
            else { sortedPlayers.forEach(([name, wins]) => { html += `<p><strong>${escapeHtml(name)}:</strong> ${wins} wins</p>`; }); }
            // Overall Protocol Stats
            html += '<h3 style="margin-top: 15px;">Overall Protocol Stats (W/L):</h3>';
            const sortedProtocols = Object.entries(stats.protocolStats || {}).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
            if (sortedProtocols.length === 0) { html += '<p>No protocol stats recorded.</p>'; }
            else {
                sortedProtocols.forEach(([name, data]) => {
                    const wins = data.wins || 0; const losses = data.losses || 0; const total = wins + losses; const winRate = total > 0 ? ((wins / total) * 100).toFixed(0) : 0;
                    html += `<p><strong>${escapeHtml(name)}:</strong> ${wins}W / ${losses}L (${winRate}%)</p>`;
                });
            }
            // Detailed Matchup Stats
            html += '<h3 style="margin-top: 15px;">Protocol Matchups (Based on Draft Slot):</h3>';
            const sortedMatchups = Object.entries(stats.protocolMatchups || {}).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
            if (sortedMatchups.length === 0) { html += '<p>No matchup stats recorded.</p>'; }
            else {
                html += '<ul>';
                sortedMatchups.forEach(([key, data]) => {
                    const [protoA, protoB] = key.split('_vs_');
                    const winsA = data.wins_A || 0; const lossesA = data.losses_A || 0; const totalGames = winsA + lossesA;
                    const winsB = lossesA; const lossesB = winsA;
                    const winRateA = totalGames > 0 ? ((winsA / totalGames) * 100).toFixed(0) : 0;
                    const winRateB = totalGames > 0 ? ((winsB / totalGames) * 100).toFixed(0) : 0;
                    html += `<li><strong>${escapeHtml(protoA)}</strong> vs <strong>${escapeHtml(protoB)}</strong> (Total: ${totalGames})<br>`;
                    html += `<span>${escapeHtml(protoA)}: ${winsA}W / ${lossesA}L (${winRateA}%)</span><br>`;
                    html += `<span>${escapeHtml(protoB)}: ${winsB}W / ${lossesB}L (${winRateB}%)</span></li>`;
                });
                html += '</ul>';
            }
            statsContent.innerHTML = html;

        } catch (error) {
            console.error('Error loading stats:', error);
            statsContent.innerHTML = `<p class="error-text">Error loading stats: ${error.message}.</p>`;
        }
        // Ensure section is visible even after error or no data
        statsDisplay.classList.remove('hidden');
    }

    // --- Config Tab Logic ---
    async function loadConfigLogs() {
        showConfigMessage('Loading game logs...', false);
        configLogTableContainer.classList.add('hidden');
        configNoLogs.classList.add('hidden');
        try {
            const response = await fetch('/api/logs');
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || 'Failed to fetch logs.');
            configLogTableBody.innerHTML = '';
            const logs = result.data;
            if (logs && logs.length > 0) {
                logs.forEach(log => {
                    const row = configLogTableBody.insertRow();
                    const p1Protos = Array.isArray(log.player1_protocols) ? log.player1_protocols.join(', ') : 'Error';
                    const p2Protos = Array.isArray(log.player2_protocols) ? log.player2_protocols.join(', ') : 'Error';
                    let timestampStr = 'Invalid Date'; try { timestampStr = new Date(log.timestamp).toLocaleString(); } catch(e) { /* ignore */ }
                    row.innerHTML = `<td>${log.id}</td><td>${timestampStr}</td><td>${escapeHtml(log.player1_name)}</td><td class="log-protocols">${escapeHtml(p1Protos)}</td><td>${escapeHtml(log.player2_name)}</td><td class="log-protocols">${escapeHtml(p2Protos)}</td><td>${escapeHtml(log.winner_name)}</td><td class="log-actions"><button class="action-button edit-log-btn" data-log-id="${log.id}">Edit</button><button class="action-button delete-log-btn" data-log-id="${log.id}">Delete</button></td>`;
                });
                configLogTableContainer.classList.remove('hidden');
                hideConfigMessage();
                addTableActionListeners(); // Add listeners AFTER rows are created
            } else {
                configNoLogs.classList.remove('hidden');
                hideConfigMessage();
            }
        } catch (error) {
            console.error("Error loading config logs:", error);
            showConfigMessage(`Error loading logs: ${error.message}`, true);
        }
    }

    function showConfigMessage(message, isError = false) {
        configLoading.classList.remove('hidden');
        configLoading.textContent = message;
        configError.classList.add('hidden');
        configLoading.style.color = isError ? 'var(--error-color)' : 'var(--text-color)';
    }

    function hideConfigMessage() {
        configLoading.classList.add('hidden');
        configError.classList.add('hidden');
    }

    function escapeHtml(unsafe) {
        if (unsafe === null || typeof unsafe === 'undefined') return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function addTableActionListeners() {
        configLogTableBody.querySelectorAll('.edit-log-btn').forEach(button => button.addEventListener('click', handleEditClick));
        configLogTableBody.querySelectorAll('.delete-log-btn').forEach(button => button.addEventListener('click', handleDeleteClick));
    }

    async function handleEditClick(event) {
        const logId = event.target.dataset.logId;
        showEditModal(logId);
    }

    async function handleDeleteClick(event) {
        const logId = event.target.dataset.logId;
        if (confirm(`Are you sure you want to permanently delete game log #${logId}?`)) {
            showConfigMessage(`Deleting log #${logId}...`, false);
             try {
                const response = await fetch(`/api/log/${logId}`, { method: 'DELETE' });
                const result = await response.json();
                if (!response.ok || result.status !== 'success') throw new Error(result.message || `HTTP Error ${response.status}`);
                showConfigMessage(`Log #${logId} deleted successfully. Refreshing list...`, false);
                setTimeout(loadConfigLogs, 1000);
                loadPlayerNames(); // Refresh player names after delete
            } catch (error) {
                 console.error("Error deleting log:", error);
                 showConfigMessage(`Error deleting log #${logId}: ${error.message}`, true);
            }
        }
    }

    async function showEditModal(logId) {
        editLogError.classList.add('hidden');
        editLogIdSpan.textContent = logId;
        editLogIdInput.value = logId;
        editLogForm.reset();
        editWinnerList.innerHTML = ''; // Clear dynamic list

        try {
            const response = await fetch(`/api/log/${logId}`);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || 'Failed to fetch log data.');

            const log = result.data;
            editP1NameInput.value = log.player1_name;
            editP2NameInput.value = log.player2_name;
            editWinnerNameInput.value = log.winner_name;
            editP1ProtocolsInput.value = Array.isArray(log.player1_protocols) ? log.player1_protocols.join(',') : '';
            editP2ProtocolsInput.value = Array.isArray(log.player2_protocols) ? log.player2_protocols.join(',') : '';
            updateEditWinnerDatalist(); // Populate based on names loaded
            editLogModal.classList.remove('hidden');
        } catch (error) {
            console.error("Error fetching log for edit:", error);
            showConfigMessage(`Error loading log #${logId} for edit: ${error.message}`, true);
        }
    }

    function updateEditWinnerDatalist() {
        editWinnerList.innerHTML = '';
        const p1 = editP1NameInput.value.trim();
        const p2 = editP2NameInput.value.trim();
        if (p1) { const opt1 = document.createElement('option'); opt1.value = p1; editWinnerList.appendChild(opt1); }
        if (p2 && p2 !== p1) { const opt2 = document.createElement('option'); opt2.value = p2; editWinnerList.appendChild(opt2); }
    }

    function hideEditModal() {
        editLogModal.classList.add('hidden');
    }

    async function handleSaveChanges(event) {
        event.preventDefault();
        editLogError.classList.add('hidden');
        const logId = editLogIdInput.value;
        const p1Protos = editP1ProtocolsInput.value.split(',').map(p => p.trim()).filter(p => p);
        const p2Protos = editP2ProtocolsInput.value.split(',').map(p => p.trim()).filter(p => p);

        if (p1Protos.length !== 3 || p2Protos.length !== 3) {
             editLogError.textContent = "Error: Both players must have exactly 3 protocols, separated by commas.";
             editLogError.classList.remove('hidden'); return;
        }
        const updatedData = {
            player1_name: editP1NameInput.value.trim(), player1_protocols: p1Protos,
            player2_name: editP2NameInput.value.trim(), player2_protocols: p2Protos,
            winner_name: editWinnerNameInput.value.trim()
        };
        const saveButton = editLogForm.querySelector('button[type="submit"]');
        saveButton.disabled = true; saveButton.textContent = 'Saving...';

        try {
            const response = await fetch(`/api/log/${logId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData) });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') throw new Error(result.message || `HTTP Error ${response.status}`);
            hideEditModal();
            showConfigMessage(`Log #${logId} updated successfully. Refreshing list...`, false);
            setTimeout(loadConfigLogs, 500);
            loadPlayerNames(); // Refresh player names after edit
        } catch (error) {
             console.error("Error saving log changes:", error);
             editLogError.textContent = `Error saving changes: ${error.message}`;
             editLogError.classList.remove('hidden');
        } finally {
            saveButton.disabled = false; saveButton.textContent = 'Save Changes';
        }
    }

    async function handleClearAllClick() {
        if (confirm("!! WARNING !!\n\nAre you ABSOLUTELY sure you want to delete ALL game logs?\n\nThis action cannot be undone!")) {
            showConfigMessage("Clearing all logs...", false);
             try {
                const response = await fetch('/api/logs/clear', { method: 'POST' });
                const result = await response.json();
                 if (!response.ok || result.status !== 'success') throw new Error(result.message || `HTTP Error ${response.status}`);
                showConfigMessage("All logs cleared successfully. Refreshing...", false);
                setTimeout(() => { loadConfigLogs(); loadPlayerNames(); }, 1000);
            } catch (error) {
                 console.error("Error clearing logs:", error);
                 showConfigMessage(`Error clearing logs: ${error.message}`, true);
            }
        }
    }

    // --- Card Viewer Logic (Placeholder) ---
    const cardData = { /* Needs populating */ };
    function displayCard(cardName) { cardDisplay.textContent = `Display logic for "${cardName}" not implemented. Populate 'cardData'.`; }
    function filterCards() { cardDisplay.textContent = `Search logic not implemented. Populate 'cardData'.`; }


    // --- Add Event Listeners ---
    // Navigation
    navButtons.forEach(button => button.addEventListener('click', () => showSection(button.dataset.section)));
    // Draft Setup/Control
    startDraftProcessButton.addEventListener('click', startDraftProcess);
    restartDraftButton.addEventListener('click', restartDraft);
    // Game Outcome
    p1WinsButton.addEventListener('click', () => recordWin(1));
    p2WinsButton.addEventListener('click', () => recordWin(2));
    // Card Viewer
    cardFilterInput.addEventListener('input', filterCards);
    // Config & Modal
    clearAllLogsButton.addEventListener('click', handleClearAllClick);
    editLogForm.addEventListener('submit', handleSaveChanges);
    closeModalButton.addEventListener('click', hideEditModal);
    cancelEditButton.addEventListener('click', hideEditModal);
    editP1NameInput.addEventListener('input', updateEditWinnerDatalist); // Update winner list dynamically
    editP2NameInput.addEventListener('input', updateEditWinnerDatalist);
    // Note: Edit/Delete listeners added dynamically in loadConfigLogs

    // --- Initial Setup ---
    console.log("DOM Loaded, setting initial state..."); // Add log
    showSection('draft'); // Start on the draft section (this should activate #section-draft)
    
    // Explicitly ensure all other views are hidden, especially the modal
    initialSetupView.classList.remove('hidden');
    randomizerView.classList.add('hidden');
    draftingInterfaceView.classList.add('hidden');
    draftResultsView.classList.add('hidden');
    statsDisplay.classList.add('hidden');
    // Deactivate other sections explicitly (showSection should handle this, but belt-and-suspenders)
    if (sections.cards) sections.cards.classList.remove('active');
    if (sections.rules) sections.rules.classList.remove('active');
    if (sections.config) sections.config.classList.remove('active');

    // *** CRITICAL: Explicitly hide the modal on load ***
    hideEditModal();
    console.log("Initial state set, modal should be hidden.");

}); // End DOMContentLoaded