import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from models import init_db, get_db, reset_all_machines
from config import get_all_machines as config_machines


def seed():
    init_db()
    machines = config_machines()
    conn = get_db()
    cursor = conn.cursor()
    valid_ids = [m["id"] for m in machines]
    for m in machines:
        cursor.execute(
            """
            INSERT INTO machines (id, dormitory_id, dormitory_name, machine_type, machine_type_name, name)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                dormitory_id = excluded.dormitory_id,
                dormitory_name = excluded.dormitory_name,
                machine_type = excluded.machine_type,
                machine_type_name = excluded.machine_type_name,
                name = excluded.name
        """,
            (
                m["id"],
                m["dormitory_id"],
                m["dormitory_name"],
                m["machine_type"],
                m["machine_type_name"],
                m["name"],
            ),
        )
    if valid_ids:
        placeholders = ",".join("?" * len(valid_ids))
        cursor.execute(
            f"DELETE FROM machines WHERE id NOT IN ({placeholders})", valid_ids
        )
    conn.commit()
    conn.close()
    print(f"Seeded {len(machines)} machines")


def clean():
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM machines")
    conn.commit()
    conn.close()
    print("Database cleaned")


def reset():
    reset_all_machines()
    print("All machines reset to default status")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python cli.py [seed|clean|reset]")
        sys.exit(1)

    command = sys.argv[1]
    if command == "seed":
        seed()
    elif command == "clean":
        clean()
    elif command == "reset":
        reset()
    else:
        print(f"Unknown command: {command}")
        print("Usage: python cli.py [seed|clean|reset]")
        sys.exit(1)
