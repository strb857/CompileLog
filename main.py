from flask import Flask, render_template, request, jsonify
import sqlite3
import json
import datetime
from collections import defaultdict
import os # To help construct the database path

app = Flask(__name__)

# --- Configuration ---
DATABASE_NAME = 'compile_stats.db'
# Get the directory where the script is running
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, DATABASE_NAME)

# --- Database Helper Functions ---

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        # Return rows as dictionary-like objects (access columns by name)
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.Error as e:
        print(f"Database connection error: {e}")
        return None

def init_db():
    """Initializes the database and creates the table if it doesn't exist."""
    print(f"Initializing database at: {DATABASE_PATH}")
    conn = get_db_connection()
    if conn is None:
        print("Failed to get DB connection for initialization.")
        return
    try:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS game_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                player1_name TEXT NOT NULL,
                player1_protocols TEXT NOT NULL, -- Store as JSON string
                player2_name TEXT NOT NULL,
                player2_protocols TEXT NOT NULL, -- Store as JSON string
                winner_name TEXT NOT NULL
            )
        ''')
        conn.commit()
        print("Database initialized successfully.")
    except sqlite3.Error as e:
        print(f"Error initializing database table: {e}")
    finally:
        if conn:
            conn.close()

def add_game_log_db(log_entry):
    """Adds a new game log entry to the SQLite database."""
    conn = get_db_connection()
    if conn is None:
        raise ConnectionError("Failed to connect to the database.")
    try:
        sql = ''' INSERT INTO game_logs(timestamp, player1_name, player1_protocols, player2_name, player2_protocols, winner_name)
                  VALUES(?,?,?,?,?,?) '''
        cursor = conn.cursor()

        # Serialize protocol lists to JSON strings
        p1_protocols_json = json.dumps(log_entry.get('player1Protocols', []))
        p2_protocols_json = json.dumps(log_entry.get('player2Protocols', []))

        values = (
            log_entry['timestamp'],
            log_entry['player1Name'],
            p1_protocols_json,
            log_entry['player2Name'],
            p2_protocols_json,
            log_entry['winnerName']
        )
        cursor.execute(sql, values)
        conn.commit()
        print(f"Game log added successfully. ID: {cursor.lastrowid}")
        return cursor.lastrowid
    except sqlite3.Error as e:
        print(f"Error adding game log: {e}")
        conn.rollback() # Roll back changes on error
        raise # Re-raise the exception to be caught by the API route
    finally:
        if conn:
            conn.close()

def get_all_game_logs_db():
    """Retrieves all game logs from the SQLite database."""
    conn = get_db_connection()
    if conn is None:
        raise ConnectionError("Failed to connect to the database.")
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM game_logs ORDER BY timestamp ASC")
        logs = cursor.fetchall() # fetchall returns a list of sqlite3.Row objects
        # Convert sqlite3.Row objects to plain dictionaries for easier handling downstream
        dict_logs = [dict(row) for row in logs]
        return dict_logs
    except sqlite3.Error as e:
        print(f"Error retrieving game logs: {e}")
        raise # Re-raise the exception
    finally:
        if conn:
            conn.close()

def calculate_stats(logs):
    """
    Calculates player wins, protocol W/L, and matchup stats.
    Expects logs as a list of dictionaries.
    """
    stats = {
        "gamesPlayed": len(logs),
        "playerWins": defaultdict(int),
        "protocolStats": defaultdict(lambda: {"wins": 0, "losses": 0}),
        "protocolMatchups": defaultdict(lambda: {"wins_A": 0, "losses_A": 0})
    }

    if not logs:
        return stats

    for game in logs:
        try:
            p1_name = game.get("player1_name", "Unknown P1") # Note column names from DB
            p2_name = game.get("player2_name", "Unknown P2")
            # Deserialize JSON strings back into lists
            p1_protocols_json = game.get("player1_protocols", '[]')
            p2_protocols_json = game.get("player2_protocols", '[]')
            p1_protos = json.loads(p1_protocols_json)
            p2_protos = json.loads(p2_protocols_json)

            winner = game.get("winner_name")

            # --- Player Wins ---
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
            else: # Include presence even without a winner
                 for p in p1_protos: stats["protocolStats"][p]
                 for p in p2_protos: stats["protocolStats"][p]


            for p in winner_protos:
                 if not p: continue # Skip empty strings if any weird data
                 stats["protocolStats"][p]["wins"] += 1
            for p in loser_protos:
                 if not p: continue
                 stats["protocolStats"][p]["losses"] += 1
            # Ensure all played protocols exist in the stats dict
            for p in p1_protos:
                 if p: stats["protocolStats"][p]
            for p in p2_protos:
                 if p: stats["protocolStats"][p]

            # --- Detailed Matchup Stats ---
            if len(p1_protos) == 3 and len(p2_protos) == 3 and winner:
                for i in range(3):
                    proto1 = p1_protos[i]
                    proto2 = p2_protos[i]

                    if not proto1 or not proto2: continue # Skip if a protocol is missing

                    proto_A, proto_B = sorted([proto1, proto2])
                    matchup_key = f"{proto_A}_vs_{proto_B}"
                    matchup_data = stats["protocolMatchups"][matchup_key]

                    if winner == p1_name:
                        if proto1 == proto_A: matchup_data["wins_A"] += 1
                        else: matchup_data["losses_A"] += 1
                    elif winner == p2_name:
                        if proto2 == proto_A: matchup_data["wins_A"] += 1
                        else: matchup_data["losses_A"] += 1
                    stats["protocolMatchups"][matchup_key] = matchup_data

        except json.JSONDecodeError as json_err:
            print(f"Warning: Skipping game log due to JSON decode error: {json_err} - Data: P1='{game.get('player1_protocols')}', P2='{game.get('player2_protocols')}'")
            stats["gamesPlayed"] -= 1 # Decrement count for skipped game
            continue # Skip to the next game log
        except Exception as calc_err:
             print(f"Warning: Error processing game log {game.get('id', 'N/A')}: {calc_err}")
             stats["gamesPlayed"] -= 1
             continue


    # Convert defaultdicts back to regular dicts
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
        logs = get_all_game_logs_db()
        stats = calculate_stats(logs)
        return jsonify({"status": "success", "data": stats})
    except Exception as e:
        print(f"Error in /api/stats: {e}")
        return jsonify({"status": "error", "message": f"Failed to retrieve stats: {e}"}), 500

@app.route('/api/log_game', methods=['POST'])
def log_game():
    """API endpoint to log a completed game."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No JSON data received."}), 400

        # --- Validation (Matching JS Payload) ---
        required_fields = ["player1Name", "player1Protocols", "player2Name", "player2Protocols", "winnerName"]
        if not all(field in data for field in required_fields):
             return jsonify({"status": "error", "message": "Missing required fields."}), 400
        # Check if protocols are lists of 3 (before serialization)
        if not isinstance(data["player1Protocols"], list) or len(data["player1Protocols"]) != 3:
             return jsonify({"status": "error", "message": "player1Protocols must be a list of 3."}), 400
        if not isinstance(data["player2Protocols"], list) or len(data["player2Protocols"]) != 3:
             return jsonify({"status": "error", "message": "player2Protocols must be a list of 3."}), 400

        # Add timestamp (using server time)
        data["timestamp"] = datetime.datetime.now(datetime.timezone.utc).isoformat() # Store in UTC

        # Add to SQLite database
        add_game_log_db(data)

        return jsonify({"status": "success", "message": "Game logged successfully."})

    except json.JSONDecodeError:
         return jsonify({"status": "error", "message": "Invalid JSON format received."}), 400
    except Exception as e:
        print(f"Error in /api/log_game: {e}")
        return jsonify({"status": "error", "message": f"Failed to log game: {e}"}), 500

# --- Initialize DB and Run App ---
# Ensure the database and table exist when the app starts
init_db()

if __name__ == '__main__':
    # Use 0.0.0.0 to make it accessible on the network if needed (e.g., testing from phone on same wifi)
    # Use debug=True for development (auto-reloads on code change, provides debugger)
    # Port 8080 is often used for development, Replit might map its default port (81 or others)
    app.run(host='0.0.0.0', port=8080, debug=True) # Change port if needed