# main.py

from flask import Flask, render_template, request, jsonify
import sqlite3
import json
import datetime
from collections import defaultdict
import os

app = Flask(__name__)

# --- Configuration ---
DATABASE_NAME = 'compile_stats.db'
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, DATABASE_NAME)

# --- Database Helper Functions ---
def get_db_connection():
    """Establishes a connection to the SQLite database."""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.Error as e:
        print(f"Database connection error: {e}")
        return None

def init_db():
    """Initializes the database."""
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
                player1_protocols TEXT NOT NULL,
                player2_name TEXT NOT NULL,
                player2_protocols TEXT NOT NULL,
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
    """Adds a new game log entry."""
    conn = get_db_connection()
    if conn is None: raise ConnectionError("Failed to connect to the database.")
    try:
        sql = ''' INSERT INTO game_logs(timestamp, player1_name, player1_protocols, player2_name, player2_protocols, winner_name) VALUES(?,?,?,?,?,?) '''
        cursor = conn.cursor()
        p1_protocols_json = json.dumps(log_entry.get('player1Protocols', []))
        p2_protocols_json = json.dumps(log_entry.get('player2Protocols', []))
        values = (log_entry['timestamp'], log_entry['player1Name'], p1_protocols_json, log_entry['player2Name'], p2_protocols_json, log_entry['winnerName'])
        cursor.execute(sql, values)
        conn.commit()
        print(f"Game log added successfully. ID: {cursor.lastrowid}")
        return cursor.lastrowid
    except sqlite3.Error as e:
        print(f"Error adding game log: {e}"); conn.rollback(); raise
    finally:
        if conn: conn.close()

def get_all_game_logs_db():
    """Retrieves all game logs."""
    conn = get_db_connection()
    if conn is None: raise ConnectionError("Failed to connect to the database.")
    try:
        cursor = conn.cursor()
        # Fetch newest first for display
        cursor.execute("SELECT * FROM game_logs ORDER BY id DESC")
        logs = cursor.fetchall()
        dict_logs = [dict(row) for row in logs]
        return dict_logs
    except sqlite3.Error as e:
        print(f"Error retrieving game logs: {e}"); raise
    finally:
        if conn: conn.close()

# --- Get single log ---
def get_log_by_id_db(log_id):
    """Retrieves a single game log by its ID."""
    conn = get_db_connection()
    if conn is None: raise ConnectionError("Failed to connect to the database.")
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM game_logs WHERE id = ?", (log_id,))
        log = cursor.fetchone() # fetchone returns one row or None
        return dict(log) if log else None
    except sqlite3.Error as e:
        print(f"Error retrieving log ID {log_id}: {e}"); raise
    finally:
        if conn: conn.close()

# --- Update log ---
def update_log_db(log_id, data):
    """Updates an existing game log."""
    conn = get_db_connection()
    if conn is None: raise ConnectionError("Failed to connect to the database.")
    try:
        sql = ''' UPDATE game_logs
                  SET player1_name = ?,
                      player1_protocols = ?,
                      player2_name = ?,
                      player2_protocols = ?,
                      winner_name = ?
                  WHERE id = ? '''
        cursor = conn.cursor()
        # Ensure protocols are stored as JSON strings
        p1_protocols_json = json.dumps(data.get('player1_protocols', []))
        p2_protocols_json = json.dumps(data.get('player2_protocols', []))
        values = (
            data.get('player1_name'),
            p1_protocols_json,
            data.get('player2_name'),
            p2_protocols_json,
            data.get('winner_name'),
            log_id
        )
        cursor.execute(sql, values)
        conn.commit()
        return cursor.rowcount # Returns number of rows updated (should be 1 or 0)
    except sqlite3.Error as e:
        print(f"Error updating log ID {log_id}: {e}"); conn.rollback(); raise
    finally:
        if conn: conn.close()

# --- Delete log ---
def delete_log_db(log_id):
    """Deletes a specific game log."""
    conn = get_db_connection()
    if conn is None: raise ConnectionError("Failed to connect to the database.")
    try:
        sql = 'DELETE FROM game_logs WHERE id = ?'
        cursor = conn.cursor()
        cursor.execute(sql, (log_id,))
        conn.commit()
        return cursor.rowcount # Returns number of rows deleted (should be 1 or 0)
    except sqlite3.Error as e:
        print(f"Error deleting log ID {log_id}: {e}"); conn.rollback(); raise
    finally:
        if conn: conn.close()

# --- Clear all logs ---
def clear_all_logs_db():
    """Deletes all entries from the game_logs table."""
    conn = get_db_connection()
    if conn is None: raise ConnectionError("Failed to connect to the database.")
    try:
        sql = 'DELETE FROM game_logs'
        cursor = conn.cursor()
        cursor.execute(sql)
        # Optional: Reset autoincrement counter (specific to SQLite)
        # cursor.execute("DELETE FROM sqlite_sequence WHERE name='game_logs';")
        conn.commit()
        print("All game logs cleared.")
        return True
    except sqlite3.Error as e:
        print(f"Error clearing game logs: {e}"); conn.rollback(); raise
    finally:
        if conn: conn.close()

def calculate_stats(logs):
    """Calculates stats"""
    stats = {
        "gamesPlayed": 0, # Start at 0, increment only for valid logs
        "playerWins": defaultdict(int),
        "protocolStats": defaultdict(lambda: {"wins": 0, "losses": 0}),
        "protocolMatchups": defaultdict(lambda: {"wins_A": 0, "losses_A": 0})
    }
    if not logs: return stats
    valid_games_processed = 0
    for game in logs:
        try:
            p1_name = game.get("player1_name", "Unknown P1"); p2_name = game.get("player2_name", "Unknown P2")
            p1_protocols_json = game.get("player1_protocols", '[]'); p2_protocols_json = game.get("player2_protocols", '[]')
            p1_protos = json.loads(p1_protocols_json); p2_protos = json.loads(p2_protocols_json)
            winner = game.get("winner_name")
            if not isinstance(p1_protos, list) or not isinstance(p2_protos, list): continue
            valid_games_processed += 1
            # Initialize player entries safely
            stats["playerWins"][p1_name] = stats["playerWins"].get(p1_name, 0)
            stats["playerWins"][p2_name] = stats["playerWins"].get(p2_name, 0)
            if winner: stats["playerWins"][winner] += 1

            winner_protos = []; loser_protos = []
            if winner == p1_name: winner_protos = p1_protos; loser_protos = p2_protos
            elif winner == p2_name: winner_protos = p2_protos; loser_protos = p1_protos

            # Increment wins/losses directly; defaultdict handles initialization
            for p in winner_protos:
                 if not p: continue
                 stats["protocolStats"][p]["wins"] += 1
            for p in loser_protos:
                 if not p: continue
                 stats["protocolStats"][p]["losses"] += 1

            # --- Protocol Matchup Calculation (unchanged) ---
            if len(p1_protos) == 3 and len(p2_protos) == 3 and winner:
                for i in range(3):
                    proto1 = p1_protos[i]; proto2 = p2_protos[i]
                    if not proto1 or not proto2: continue
                    proto_A, proto_B = sorted([proto1, proto2]); matchup_key = f"{proto_A}_vs_{proto_B}"
                    matchup_data = stats["protocolMatchups"][matchup_key] # defaultdict initializes if needed
                    if winner == p1_name:
                        if proto1 == proto_A: matchup_data["wins_A"] += 1
                        else: matchup_data["losses_A"] += 1
                    elif winner == p2_name:
                        if proto2 == proto_A: matchup_data["wins_A"] += 1
                        else: matchup_data["losses_A"] += 1
                    # No need to assign back, modifying the mutable dict directly
                    # stats["protocolMatchups"][matchup_key] = matchup_data # This line is redundant for defaultdicts with mutable values

        except json.JSONDecodeError as json_err: print(f"Warning: Skipping log due to JSON decode error: {json_err}"); continue
        except Exception as calc_err: print(f"Warning: Error processing log {game.get('id', 'N/A')}: {calc_err}"); continue
    stats["gamesPlayed"] = valid_games_processed
    # Convert defaultdicts to regular dicts for the final output
    stats["playerWins"] = dict(stats["playerWins"])
    stats["protocolStats"] = dict(stats["protocolStats"])
    stats["protocolMatchups"] = dict(stats["protocolMatchups"])
    return stats


# --- Flask Routes ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/stats', methods=['GET'])
def get_stats_api():
    try:
        logs = get_all_game_logs_db()
        stats = calculate_stats(logs)
        return jsonify({"status": "success", "data": stats})
    except Exception as e:
        print(f"Error in /api/stats: {e}")
        return jsonify({"status": "error", "message": f"Failed to retrieve stats: {e}"}), 500

@app.route('/api/log_game', methods=['POST'])
def log_game_api():
    # (Keep log_game_api as it was)
    try:
        data = request.get_json();
        if not data: return jsonify({"status": "error", "message": "No JSON data received."}), 400
        required_fields = ["player1Name", "player1Protocols", "player2Name", "player2Protocols", "winnerName"]
        if not all(field in data for field in required_fields): return jsonify({"status": "error", "message": "Missing required fields."}), 400
        if not isinstance(data["player1Protocols"], list) or len(data["player1Protocols"]) != 3: return jsonify({"status": "error", "message": "player1Protocols must be a list of 3."}), 400
        if not isinstance(data["player2Protocols"], list) or len(data["player2Protocols"]) != 3: return jsonify({"status": "error", "message": "player2Protocols must be a list of 3."}), 400
        data["timestamp"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        add_game_log_db(data)
        return jsonify({"status": "success", "message": "Game logged successfully."})
    except json.JSONDecodeError: return jsonify({"status": "error", "message": "Invalid JSON format received."}), 400
    except Exception as e: print(f"Error in /api/log_game: {e}"); return jsonify({"status": "error", "message": f"Failed to log game: {e}"}), 500


@app.route('/api/players', methods=['GET'])
def get_players():
    # (Keep get_players as it was)
    conn = get_db_connection();
    if conn is None: return jsonify({"status": "error", "message": "Database connection failed."}), 500
    try:
        cursor = conn.cursor()
        cursor.execute(''' SELECT DISTINCT player_name FROM (SELECT player1_name AS player_name FROM game_logs UNION SELECT player2_name AS player_name FROM game_logs) WHERE player_name IS NOT NULL AND player_name != '' ORDER BY player_name COLLATE NOCASE ASC ''')
        player_tuples = cursor.fetchall()
        player_names = [row['player_name'] for row in player_tuples]
        return jsonify({"status": "success", "data": player_names})
    except sqlite3.Error as e: print(f"Error fetching player names: {e}"); return jsonify({"status": "error", "message": f"Failed to retrieve player names: {e}"}), 500
    finally:
        if conn: conn.close()

# --- NEW API Route: Get all logs for config page ---
@app.route('/api/logs', methods=['GET'])
def get_logs_api():
    """API endpoint to get all raw game logs."""
    try:
        logs = get_all_game_logs_db()
        # Deserialize protocols for easier frontend use
        for log in logs:
            log['player1_protocols'] = json.loads(log.get('player1_protocols', '[]'))
            log['player2_protocols'] = json.loads(log.get('player2_protocols', '[]'))
        return jsonify({"status": "success", "data": logs})
    except Exception as e:
        print(f"Error in /api/logs: {e}")
        return jsonify({"status": "error", "message": f"Failed to retrieve logs: {e}"}), 500

# --- NEW API Route: Get single log ---
@app.route('/api/log/<int:log_id>', methods=['GET'])
def get_single_log_api(log_id):
    """API endpoint to get a single game log by ID."""
    try:
        log = get_log_by_id_db(log_id)
        if log:
            # Deserialize protocols
            log['player1_protocols'] = json.loads(log.get('player1_protocols', '[]'))
            log['player2_protocols'] = json.loads(log.get('player2_protocols', '[]'))
            return jsonify({"status": "success", "data": dict(log)}) # Convert Row to dict
        else:
            return jsonify({"status": "error", "message": "Log not found."}), 404
    except Exception as e:
        print(f"Error in /api/log/{log_id} [GET]: {e}")
        return jsonify({"status": "error", "message": f"Failed to retrieve log: {e}"}), 500

# --- NEW API Route: Update single log ---
@app.route('/api/log/<int:log_id>', methods=['PUT']) # Using PUT for update
def update_log_api(log_id):
    """API endpoint to update a game log."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No JSON data received."}), 400

        # Basic validation (can add more checks)
        required_fields = ["player1_name", "player1_protocols", "player2_name", "player2_protocols", "winner_name"]
        if not all(field in data for field in required_fields):
             return jsonify({"status": "error", "message": "Missing required fields for update."}), 400
        if not isinstance(data["player1_protocols"], list) or not isinstance(data["player2_protocols"], list):
              return jsonify({"status": "error", "message": "Protocols must be lists."}), 400
        # Maybe check list length == 3?

        rows_affected = update_log_db(log_id, data)
        if rows_affected > 0:
            return jsonify({"status": "success", "message": f"Log ID {log_id} updated successfully."})
        else:
            return jsonify({"status": "error", "message": "Log not found or no changes made."}), 404
    except json.JSONDecodeError:
         return jsonify({"status": "error", "message": "Invalid JSON format received."}), 400
    except Exception as e:
        print(f"Error in /api/log/{log_id} [PUT]: {e}")
        return jsonify({"status": "error", "message": f"Failed to update log: {e}"}), 500

# --- NEW API Route: Delete single log ---
@app.route('/api/log/<int:log_id>', methods=['DELETE'])
def delete_log_api(log_id):
    """API endpoint to delete a game log."""
    try:
        rows_affected = delete_log_db(log_id)
        if rows_affected > 0:
            return jsonify({"status": "success", "message": f"Log ID {log_id} deleted successfully."})
        else:
            # If rowcount is 0, the log likely didn't exist
            return jsonify({"status": "error", "message": "Log not found."}), 404
    except Exception as e:
        print(f"Error in /api/log/{log_id} [DELETE]: {e}")
        return jsonify({"status": "error", "message": f"Failed to delete log: {e}"}), 500

# --- NEW API Route: Clear all logs ---
@app.route('/api/logs/clear', methods=['POST']) # Using POST for simplicity from JS
def clear_logs_api():
    """API endpoint to clear all game logs."""
    try:
        success = clear_all_logs_db()
        if success:
            return jsonify({"status": "success", "message": "All game logs cleared."})
        else:
            # This case might not be reached if clear_all_logs_db raises errors
            return jsonify({"status": "error", "message": "Failed to clear logs (unknown reason)."}), 500
    except Exception as e:
        print(f"Error in /api/logs/clear: {e}")
        return jsonify({"status": "error", "message": f"Failed to clear logs: {e}"}), 500


# --- Initialize DB and Run App ---
init_db()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)