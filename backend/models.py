import sqlite3
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "laundry.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS machines (
            id TEXT PRIMARY KEY,
            dormitory_id TEXT NOT NULL,
            dormitory_name TEXT NOT NULL,
            machine_type TEXT NOT NULL,
            machine_type_name TEXT NOT NULL,
            name TEXT NOT NULL,
            operational BOOLEAN DEFAULT 1,
            occupied BOOLEAN DEFAULT 0,
            occupied_at TEXT,
            occupied_until TEXT,
            occupied_by_name TEXT,
            occupied_by_phone TEXT,
            consent_to_remove BOOLEAN DEFAULT 0
        )
    """)
    cursor.execute("PRAGMA table_info(machines)")
    existing_cols = [row[1] for row in cursor.fetchall()]
    new_cols = {
        "occupied_at": "TEXT",
        "occupied_until": "TEXT",
        "occupied_by_name": "TEXT",
        "occupied_by_phone": "TEXT",
        "consent_to_remove": "BOOLEAN DEFAULT 0",
    }
    for col, col_type in new_cols.items():
        if col not in existing_cols:
            cursor.execute(f"ALTER TABLE machines ADD COLUMN {col} {col_type}")
    conn.commit()
    conn.close()


def seed_db(machines):
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


def get_all_machines():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM machines ORDER BY dormitory_id, machine_type, name")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_machine(machine_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM machines WHERE id = ?", (machine_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def update_machine(
    machine_id,
    operational=None,
    occupied=None,
    occupied_hours=None,
    occupied_minutes=None,
    occupied_by_name=None,
    occupied_by_phone=None,
    consent_to_remove=None,
):
    conn = get_db()
    cursor = conn.cursor()

    if operational is not None:
        cursor.execute(
            "UPDATE machines SET operational = ? WHERE id = ?",
            (1 if operational else 0, machine_id),
        )
        if not operational:
            cursor.execute(
                """UPDATE machines SET occupied = 0,
                   occupied_at = NULL, occupied_until = NULL,
                   occupied_by_name = NULL, occupied_by_phone = NULL,
                   consent_to_remove = 0
                   WHERE id = ?""",
                (machine_id,),
            )

    if occupied is not None and operational is not False:
        if occupied:
            hours = occupied_hours if occupied_hours is not None else 1
            minutes = occupied_minutes if occupied_minutes is not None else 20
            duration = timedelta(hours=hours, minutes=minutes)
            now = datetime.now()
            until = now + duration
            consent = 1 if consent_to_remove else 0
            cursor.execute(
                """UPDATE machines SET occupied = 1,
                   occupied_at = ?, occupied_until = ?,
                   occupied_by_name = ?, occupied_by_phone = ?,
                   consent_to_remove = ?
                   WHERE id = ?""",
                (
                    now.isoformat(),
                    until.isoformat(),
                    occupied_by_name,
                    occupied_by_phone,
                    consent,
                    machine_id,
                ),
            )
        else:
            cursor.execute(
                """UPDATE machines SET occupied = 0,
                   occupied_at = NULL, occupied_until = NULL,
                   occupied_by_name = NULL, occupied_by_phone = NULL,
                   consent_to_remove = 0
                   WHERE id = ?""",
                (machine_id,),
            )

    conn.commit()
    cursor.execute("SELECT * FROM machines WHERE id = ?", (machine_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def expire_machines():
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now().isoformat()

    cursor.execute(
        "SELECT id FROM machines WHERE occupied = 1 AND occupied_until IS NOT NULL AND occupied_until < ?",
        (now,),
    )
    expired_ids = [row[0] for row in cursor.fetchall()]

    cursor.execute(
        """UPDATE machines SET occupied = 0,
           occupied_at = NULL, occupied_until = NULL,
           occupied_by_name = NULL, occupied_by_phone = NULL
           WHERE occupied = 1 AND occupied_until IS NOT NULL AND occupied_until < ?""",
        (now,),
    )
    conn.commit()

    expired_machines = []
    for mid in expired_ids:
        cursor.execute("SELECT * FROM machines WHERE id = ?", (mid,))
        row = cursor.fetchone()
        if row:
            expired_machines.append(dict(row))

    conn.close()
    return expired_ids, expired_machines
