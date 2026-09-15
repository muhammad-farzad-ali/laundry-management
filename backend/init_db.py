from models import init_db, seed_db
from config import get_all_machines

if __name__ == "__main__":
    init_db()
    machines = get_all_machines()
    seed_db(machines)
    print(f"Database initialized with {len(machines)} machines")
