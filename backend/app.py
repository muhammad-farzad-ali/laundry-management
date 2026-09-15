from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from models import (
    init_db,
    get_all_machines,
    get_machine,
    update_machine,
    expire_machines,
)
from config import (
    get_dormitories,
    get_machine_types,
)
import os

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

app = Flask(__name__)
CORS(app)

init_db()


@app.route("/")
def index():
    response = send_from_directory(FRONTEND_DIR, "index.html")
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


@app.route("/<path:path>")
def serve_static(path):
    response = send_from_directory(FRONTEND_DIR, path)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


@app.route("/api/dormitories", methods=["GET"])
def api_dormitories():
    return jsonify(get_dormitories())


@app.route("/api/machine-types", methods=["GET"])
def api_machine_types():
    return jsonify(get_machine_types())


@app.route("/api/machines", methods=["GET"])
def api_machines():
    dormitory = request.args.get("dormitory")
    machine_type = request.args.get("type")

    machines = get_all_machines()

    if dormitory:
        machines = [m for m in machines if m["dormitory_id"] == dormitory]

    if machine_type:
        machines = [m for m in machines if m["machine_type"] == machine_type]

    return jsonify(machines)


@app.route("/api/machines/<machine_id>", methods=["GET"])
def api_get_machine(machine_id):
    machine = get_machine(machine_id)
    if not machine:
        return jsonify({"error": "Machine not found"}), 404
    return jsonify(machine)


@app.route("/api/machines/<machine_id>", methods=["PATCH"])
def api_update_machine(machine_id):
    machine = get_machine(machine_id)
    if not machine:
        return jsonify({"error": "Machine not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    operational = data.get("operational")
    occupied = data.get("occupied")

    if operational is not None:
        operational = bool(operational)

    if occupied is not None:
        occupied = bool(occupied)

    if operational is False and occupied is True:
        return jsonify(
            {"error": "Cannot mark an out-of-order machine as occupied"}
        ), 400

    occupied_hours = data.get("occupied_hours")
    occupied_minutes = data.get("occupied_minutes")
    occupied_by_name = data.get("occupied_by_name")
    occupied_by_phone = data.get("occupied_by_phone")
    consent_to_remove = data.get("consent_to_remove")

    if occupied_hours is not None:
        occupied_hours = int(occupied_hours)
    if occupied_minutes is not None:
        occupied_minutes = int(occupied_minutes)

    updated = update_machine(
        machine_id,
        operational=operational,
        occupied=occupied,
        occupied_hours=occupied_hours,
        occupied_minutes=occupied_minutes,
        occupied_by_name=occupied_by_name,
        occupied_by_phone=occupied_by_phone,
        consent_to_remove=consent_to_remove,
    )
    return jsonify(updated)


@app.route("/api/machines/expire", methods=["POST"])
def api_expire_machines():
    expired_ids, machines = expire_machines()
    return jsonify({"expired": expired_ids, "machines": machines})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
