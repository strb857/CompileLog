// --- JavaScript for Flask Backend Interaction ---
document.addEventListener('DOMContentLoaded', () => {

    // --- Global State & Elements ---
    let gameState = 'initial-setup';
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
    const sections = {}; // Will be populated below
    const navButtons = document.querySelectorAll('.nav-button');
    const initialSetupView = document.getElementById('initial-setup');
    const p1NameInput = document.getElementById('player1-name');
    const p2NameInput = document.getElementById('player2-name');
    const includeAux1Checkbox = document.getElementById('include-aux1');
    const startDraftProcessButton = document.getElementById('start-draft-process-button');
    const randomizerView = document.getElementById('randomizer');
    const randomizerStatus = document.getElementById('randomizer-status');
    const draftingInterfaceView = document.getElementById('drafting-interface');
    const firstPlayerAnnouncementDrafting = document.getElementById('first-player-announcement-drafting');
    const availableProtocolsTitle = document.getElementById('available-protocols-title');
    const draftResultsView = document.getElementById('draft-results');
    const restartDraftButton = document.getElementById('restart-draft-button');
    const availableProtocolsList = document.getElementById('available-protocols-list');
    const player1ProtocolsList = document.getElementById('player1-protocols-list');
    const player2ProtocolsList = document.getElementById('player2-protocols-list');
    const resultsP1List = document.getElementById('results-p1-list');
    const resultsP2List = document.getElementById('results-p2-list');
    const draftStatus = document.getElementById('draft-status');
    const draftError = document.getElementById('draft-error');
    const p1DraftTitle = document.getElementById('player1-draft-title');
    const p2DraftTitle = document.getElementById('player2-draft-title');
    const resultsP1Title = document.getElementById('results-p1-title');
    const resultsP2Title = document.getElementById('results-p2-title');
    const outcomeRecorder = document.getElementById('outcome-recorder');
    const p1WinsButton = document.getElementById('p1-wins-button');
    const p2WinsButton = document.getElementById('p2-wins-button');
    const outcomeMessage = document.getElementById('outcome-message');
    const statsDisplay = document.getElementById('stats-display');
    const statsContent = document.getElementById('stats-content');
    const cardFilterInput = document.getElementById('card-filter');
    const cardDisplay = document.getElementById('card-display');

    // Helper to get references to all sections
    Object.assign(sections, {
        draft: document.getElementById('section-draft'),
        cards: document.getElementById('section-cards'),
        rules: document.getElementById('section-rules')
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
         // Load stats when navigating to draft section after game completion or restart
        if (sectionId === 'draft' && (gameState === 'post-game' || gameState === 'results')) {
           loadAndDisplayStats(); // Will make statsDisplay visible
        } else if (sectionId !== 'draft') {
            statsDisplay.classList.add('hidden'); // Hide stats if navigating away
        }
    }
    navButtons.forEach(button => button.addEventListener('click', () => showSection(button.dataset.section)));

    // --- Player Name Quick Select Logic ---
    async function loadPlayerNames() {
        const datalist = document.getElementById('player-names-list');
        if (!datalist) return;

        try {
            const response = await fetch('/api/players'); // Fetch from the Flask endpoint
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
            datalist.innerHTML = '<option value="">Error loading names</option>'; // Indicate failure
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
        startDraftProcessButton.disabled = true; // Prevent multiple clicks

        runRandomizer(); // Start the randomization process
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
                setTimeout(setupAndStartDraft, 1500); // Proceed after showing result
            }
        }, 400);
    }

    // --- Setup Draft State & UI (Called after randomizer) ---
     function setupAndStartDraft() {
         randomizerView.classList.add('hidden');
         draftingInterfaceView.classList.remove('hidden');
         firstPlayerAnnouncementDrafting.textContent = `${startingPlayer === 1 ? player1Name : player2Name}`;

         // Determine protocol pool based on checkbox
         const currentProtocolPool = includeAux1 ? [...mainProtocols, ...auxProtocols] : [...mainProtocols];
         availableProtocolsTitle.textContent = `Available Protocols (${currentProtocolPool.length} Total):`;

         // Initialize draft state variables
         availableProtocols = [...currentProtocolPool].sort(() => Math.random() - 0.5);
         player1Protocols = [];
         player2Protocols = [];
         currentPickNumber = 0;
         currentPlayer = startingPlayer;
         gameState = 'drafting';

         // Reset UI elements for new draft
         outcomeRecorder.classList.add('hidden');
         outcomeMessage.classList.add('hidden');
         statsDisplay.classList.add('hidden');

         determineNextPick(); // Set up the first pick
         updateDraftUI(); // Render the initial draft state
    }

    // --- Draft Logic ---
     function determineNextPick() {
         currentPickNumber++;
         draftError.classList.add('hidden'); // Hide previous errors
         // Determine who picks and how many based on the 1-2-2-1 sequence
         if (currentPickNumber === 1) { currentPlayer = startingPlayer; picksThisTurn = 1; }
         else if (currentPickNumber === 2 || currentPickNumber === 3) { currentPlayer = (startingPlayer === 1) ? 2 : 1; picksThisTurn = 1; }
         else if (currentPickNumber === 4 || currentPickNumber === 5) { currentPlayer = startingPlayer; picksThisTurn = 1; }
         else if (currentPickNumber === 6) { currentPlayer = (startingPlayer === 1) ? 2 : 1; picksThisTurn = 1; }
         else { endDraft(); return; } // Draft finished

         // Update status message
         let pickInstruction = "";
         if (currentPickNumber === 2) pickInstruction = "(Pick 1 of 2)";
         if (currentPickNumber === 3) pickInstruction = "(Pick 2 of 2)";
         if (currentPickNumber === 4) pickInstruction = "(Pick 1 of 2)";
         if (currentPickNumber === 5) pickInstruction = "(Pick 2 of 2)";
         const currentTurnPlayerName = currentPlayer === 1 ? player1Name : player2Name;
         draftStatus.textContent = `Pick ${currentPickNumber}/${totalProtocolsToDraft}: ${currentTurnPlayerName} selects 1 Protocol ${pickInstruction}`;
     }

     function selectProtocol(protocolName) {
        if (gameState !== 'drafting' || picksThisTurn <= 0) return; // Only allow picks during drafting phase

        const packIndex = availableProtocols.indexOf(protocolName);
        if (packIndex > -1) {
            // Move protocol from available to player's list
            availableProtocols.splice(packIndex, 1);
            if (currentPlayer === 1) {
                player1Protocols.push(protocolName);
            } else {
                player2Protocols.push(protocolName);
            }
            picksThisTurn--; // This pick is done

            // Check if draft is complete or move to next pick
            if (currentPickNumber >= totalProtocolsToDraft) {
                endDraft();
            } else {
                determineNextPick();
                updateDraftUI();
            }
        } else {
            // Should not happen with button interface, but good error handling
            draftError.textContent = "Error: Protocol already selected or invalid.";
            draftError.classList.remove('hidden');
        }
     }

     function endDraft() {
         gameState = 'results'; // Update game state
         // Transition UI views
         draftingInterfaceView.classList.add('hidden');
         draftResultsView.classList.remove('hidden');
         outcomeRecorder.classList.remove('hidden'); // Show win recording buttons
         // Reset win buttons
         p1WinsButton.disabled = false;
         p2WinsButton.disabled = false;
         outcomeMessage.classList.add('hidden'); // Hide previous outcome messages

         updateDraftUI(); // Update final protocol lists display
         loadAndDisplayStats(); // Load and show stats immediately
    }

    // --- UI Update Logic ---
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
            listElement.innerHTML = '';
            protocols.forEach(p => {
                const li = document.createElement('li');
                li.textContent = p;
                listElement.appendChild(li);
            });
        };
        renderList(player1ProtocolsList, player1Protocols);
        renderList(player2ProtocolsList, player2Protocols);
        renderList(resultsP1List, player1Protocols); // Also update results view lists
        renderList(resultsP2List, player2Protocols);
    }

     // --- Restart Logic ---
     function restartDraft() {
         gameState = 'initial-setup'; // Reset state
         // Reset UI views
         draftResultsView.classList.add('hidden');
         draftingInterfaceView.classList.add('hidden');
         randomizerView.classList.add('hidden');
         statsDisplay.classList.add('hidden');
         initialSetupView.classList.remove('hidden'); // Show setup again
         startDraftProcessButton.disabled = false; // Re-enable start button

         // Reset visual elements
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

         loadPlayerNames(); // Reload player names in case new ones were added
     }

    // --- Game Outcome & Stats Logic (Using Fetch to Flask Backend) ---
    async function recordWin(winningPlayer) {
        // Allow recording from 'results' or 'post-game' state
        if (gameState !== 'results' && gameState !== 'post-game') return;

        // Prevent double submission
        p1WinsButton.disabled = true;
        p2WinsButton.disabled = true;
        outcomeMessage.textContent = "Logging game outcome...";
        outcomeMessage.style.color = 'var(--warning-color)';
        outcomeMessage.classList.remove('hidden');

        const winnerName = winningPlayer === 1 ? player1Name : player2Name;

        const gameData = {
            player1Name: player1Name,
            player1Protocols: player1Protocols,
            player2Name: player2Name,
            player2Protocols: player2Protocols,
            winnerName: winnerName
        };

        try {
            // Send data to the backend API
            const response = await fetch('/api/log_game', { // Use relative path
                method: 'POST',
                cache: 'no-cache',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(gameData)
            });
            const result = await response.json(); // Expecting JSON response

            if (response.ok && result.status === 'success') {
                outcomeMessage.textContent = `Outcome recorded: ${winnerName} wins!`;
                outcomeMessage.style.color = 'var(--primary-color)';
                gameState = 'post-game'; // Update state after successful logging
                loadPlayerNames(); // Update player list in case a new player won
                loadAndDisplayStats(); // Refresh stats display
            } else {
                // Throw error to be caught below
                throw new Error(result.message || `HTTP error ${response.status}`);
            }
        } catch (error) {
            console.error('Error recording win:', error);
            outcomeMessage.textContent = `Error recording outcome: ${error.message}`;
            outcomeMessage.style.color = 'var(--error-color)';
            // Optionally re-enable buttons on failure? Careful about spamming.
            // p1WinsButton.disabled = false;
            // p2WinsButton.disabled = false;
        }
        outcomeMessage.classList.remove('hidden'); // Ensure message is always shown
    }

    async function loadAndDisplayStats() {
        statsContent.innerHTML = '<p>Loading stats from server...</p>';
        statsDisplay.classList.remove('hidden'); // Make sure section is visible

        try {
            // Fetch stats data from the backend API
            const response = await fetch('/api/stats', { // Use relative path
                method: 'GET',
                cache: 'no-cache'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();

            if (result.status === 'success' && result.data) {
                const stats = result.data;
                statsContent.innerHTML = ''; // Clear "Loading..." message

                // Check if any games have been played
                if (!stats || stats.gamesPlayed === 0) {
                    statsContent.innerHTML = '<p>No game data recorded yet.</p>';
                    statsDisplay.classList.remove('hidden'); // Keep container visible
                    return; // Nothing more to display
                }

                // Build HTML to display stats
                let html = `<p><strong>Total Games Recorded:</strong> ${stats.gamesPlayed}</p>`;

                // --- Player Wins ---
                html += '<h3>Player Win Counts:</h3>';
                const sortedPlayers = Object.entries(stats.playerWins || {}).sort(([, a], [, b]) => b - a);
                if (sortedPlayers.length === 0) { html += '<p>No player wins recorded.</p>'; }
                else { sortedPlayers.forEach(([name, wins]) => { html += `<p><strong>${name}:</strong> ${wins} wins</p>`; }); }

                // --- Overall Protocol Stats ---
                html += '<h3 style="margin-top: 15px;">Overall Protocol Stats (W/L):</h3>';
                const sortedProtocols = Object.entries(stats.protocolStats || {}).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
                if (sortedProtocols.length === 0) { html += '<p>No protocol stats recorded.</p>'; }
                else {
                    sortedProtocols.forEach(([name, data]) => {
                        const wins = data.wins || 0; const losses = data.losses || 0; const total = wins + losses; const winRate = total > 0 ? ((wins / total) * 100).toFixed(0) : 0;
                        html += `<p><strong>${name}:</strong> ${wins}W / ${losses}L (${winRate}%)</p>`;
                    });
                }

                // --- Detailed Matchup Stats ---
                html += '<h3 style="margin-top: 15px;">Protocol Matchups (Based on Draft Slot):</h3>';
                const sortedMatchups = Object.entries(stats.protocolMatchups || {}).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
                if (sortedMatchups.length === 0) { html += '<p>No matchup stats recorded.</p>'; }
                else {
                    html += '<ul>'; // Start list for matchups
                    sortedMatchups.forEach(([key, data]) => {
                        const [protoA, protoB] = key.split('_vs_');
                        const winsA = data.wins_A || 0; const lossesA = data.losses_A || 0; const totalGames = winsA + lossesA;
                        const winsB = lossesA; const lossesB = winsA; // Wins for B = Losses for A
                        const winRateA = totalGames > 0 ? ((winsA / totalGames) * 100).toFixed(0) : 0;
                        const winRateB = totalGames > 0 ? ((winsB / totalGames) * 100).toFixed(0) : 0;
                        // Create list item for each matchup pair
                        html += `<li>`;
                        html += `<strong>${protoA}</strong> vs <strong>${protoB}</strong> (Total: ${totalGames})<br>`;
                        html += `<span>${protoA}: ${winsA}W / ${lossesA}L (${winRateA}%)</span><br>`;
                        html += `<span>${protoB}: ${winsB}W / ${lossesB}L (${winRateB}%)</span>`;
                        html += `</li>`;
                    });
                    html += '</ul>'; // End list for matchups
                }
                statsContent.innerHTML = html; // Display the generated HTML

            } else {
                 // Handle case where API call was okay but reported an error (e.g., data parsing failed server-side)
                throw new Error(result.message || 'Failed to parse stats data from server.');
            }
        } catch (error) {
            // Handle network errors or errors thrown above
            console.error('Error loading stats:', error);
            statsContent.innerHTML = `<p class="error-text">Error loading stats: ${error.message}.</p>`;
        }
        statsDisplay.classList.remove('hidden'); // Ensure stats section is visible even if loading failed
    }

    // --- Card Viewer Logic (Placeholder) ---
    const cardData = { /* Needs populating */ };
    function displayCard(cardName) { cardDisplay.textContent = `Display logic for "${cardName}" not implemented. Populate 'cardData'.`; }
    function filterCards() { cardDisplay.textContent = `Search logic not implemented. Populate 'cardData'.`; }
    cardFilterInput.addEventListener('input', filterCards);

    // --- Event Listeners ---
    startDraftProcessButton.addEventListener('click', startDraftProcess);
    restartDraftButton.addEventListener('click', restartDraft);
    p1WinsButton.addEventListener('click', () => recordWin(1));
    p2WinsButton.addEventListener('click', () => recordWin(2));
    // No listener needed for clearStatsButton as it was removed

    // --- Initial Setup ---
    showSection('draft'); // Start on the draft section
    // Ensure initial view state is correct
    initialSetupView.classList.remove('hidden');
    randomizerView.classList.add('hidden');
    draftingInterfaceView.classList.add('hidden');
    draftResultsView.classList.add('hidden');
    statsDisplay.classList.add('hidden');

}); // End DOMContentLoaded