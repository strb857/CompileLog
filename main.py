from flask import Flask, render_template, request, jsonify
from replit import db # Import Replit DB
import datetime
import json
from collections import defaultdict

app = Flask(__name__)

# Key for storing the list of game logs in Replit DB
DB_LOG_KEY = "compile_game_logs"

# --- Database Helper Functions ---

def get_all_game_logs():
    """Retrieves all game logs from the database."""
    logs = db.get(DB_LOG_KEY)
    if logs is None:
        return [] # Return empty list if key doesn't exist
    # Ensure it's treated as a list (Replit DB might return ObsValue)
    return list(logs)

def add_game_log(log_entry):
    """Adds a new game log entry to the database."""
    logs = get_all_game_logs()
    logs.append(log_entry)
    db[DB_LOG_KEY] = logs # Overwrite the key with the updated list

def calculate_stats(logs):
    """Calculates player wins, protocol W/L, and matchup stats."""
    stats = {
        "gamesPlayed": len(logs),
        "playerWins": defaultdict(int),
        "protocolStats": defaultdict(lambda: {"wins": 0, "losses": 0}),
        # Matchup key: "ProtoA_vs_ProtoB" (alphabetical order)
        # Value: {"wins_A": 0, "losses_A": 0} (Wins/Losses for ProtoA in this matchup)
        "protocolMatchups": defaultdict(lambda: {"wins_A": 0, "losses_A": 0})
    }

    if not logs:
        return stats # Return empty stats if no logs

    for game in logs:
        p1_name = game.get("player1Name", "Unknown P1")
        p2_name = game.get("player2Name", "Unknown P2")
        p1_protos = game.get("player1Protocols", [])
        p2_protos = game.get("player2Protocols", [])
        winner = game.get("winnerName")

        # --- Player Wins ---
        # Ensure players exist in stats even if they haven't won yet
        stats["playerWins"][p1_name] = stats["playerWins"].get(p1_name, 0)
        stats["playerWins"][p2_name] = stats["playerWins"].get(p2_name, 0)
        if winner:
            stats["playerWins"][winner] += 1

        # --- Overall Protocol W/L ---
        winner_protos = []
        loser_protos = []
        if winner == p1_name:
            winner_protos = p1_protos
            loser_protos = p2_protos
        elif winner == p2_name:
            winner_protos = p2_protos
            loser_protos = p1_protos
        else: # Handle draws or logs without a winner if necessary
             # For now, also count overall presence if no winner logged
             for p in p1_protos: stats["protocolStats"][p]
             for p in p2_protos: stats["protocolStats"][p]


        for p in winner_protos:
            stats["protocolStats"][p]["wins"] += 1
        for p in loser_protos:
            stats["protocolStats"][p]["losses"] += 1
        # Ensure protocols only involved in losses are also listed
        for p in p1_protos: stats["protocolStats"][p]
        for p in p2_protos: stats["protocolStats"][p]


        # --- Detailed Matchup Stats (Draft Order Based) ---
        # Ensure protocol lists have the expected length (3)
        if len(p1_protos) == 3 and len(p2_protos) == 3 and winner:
            for i in range(3):
                proto1 = p1_protos[i]
                proto2 = p2_protos[i]

                # Create consistent key (alphabetical order)
                proto_A, proto_B = sorted([proto1, proto2])
                matchup_key = f"{proto_A}_vs_{proto_B}"

                # Get the current stats for this matchup pair
                matchup_data = stats["protocolMatchups"][matchup_key]

                # Determine who won this specific protocol pair comparison
                if winner == p1_name: # Player 1 won the game
                    if proto1 == proto_A: # Proto A was P1's
                        matchup_data["wins_A"] += 1
                    else: # Proto B was P1's (so Proto A lost)
                        matchup_data["losses_A"] += 1
                elif winner == p2_name: # Player 2 won the game
                    if proto2 == proto_A: # Proto A was P2's
                         matchup_data["wins_A"] += 1
                    else: # Proto B was P2's (so Proto A lost)
                        matchup_data["losses_A"] += 1

                # Update the stats dictionary (defaultdict handles creation)
                stats["protocolMatchups"][matchup_key] = matchup_data


    # Convert defaultdicts back to regular dicts for JSON serialization
    stats["playerWins"] = dict(stats["playerWins"])
    stats["protocolStats"] = dict(stats["protocolStats"])
    stats["protocolMatchups"] = dict(stats["protocolMatchups"])

    return stats


# --- Flask Routes ---

@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """API endpoint to get calculated statistics."""
    try:
        logs = get_all_game_logs()
        stats = calculate_stats(logs)
        return jsonify({"status": "success", "data": stats})
    except Exception as e:
        print(f"Error getting stats: {e}") # Log error server-side
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/log_game', methods=['POST'])
def log_game():
    """API endpoint to log a completed game."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No JSON data received."}), 400

        # Basic validation (can be more thorough)
        required_fields = ["player1Name", "player1Protocols", "player2Name", "player2Protocols", "winnerName"]
        if not all(field in data for field in required_fields):
             return jsonify({"status": "error", "message": "Missing required fields."}), 400
        if not isinstance(data["player1Protocols"], list) or len(data["player1Protocols"]) != 3:
             return jsonify({"status": "error", "message": "player1Protocols must be a list of 3."}), 400
        if not isinstance(data["player2Protocols"], list) or len(data["player2Protocols"]) != 3:
             return jsonify({"status": "error", "message": "player2Protocols must be a list of 3."}), 400


        # Add a timestamp
        data["timestamp"] = datetime.datetime.utcnow().isoformat()

        add_game_log(data)
        return jsonify({"status": "success", "message": "Game logged successfully."})

    except json.JSONDecodeError:
         return jsonify({"status": "error", "message": "Invalid JSON format."}), 400
    except Exception as e:
        print(f"Error logging game: {e}") # Log error server-side
        return jsonify({"status": "error", "message": str(e)}), 500

# --- Run the App ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=81) # Standard Replit port