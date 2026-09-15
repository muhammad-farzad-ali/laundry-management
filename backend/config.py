import json
import os

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config", "machines.json")


def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


def get_dormitories():
    config = load_config()
    return [
        {"id": d["id"], "name": d["name"], "lat": d.get("lat"), "lng": d.get("lng")}
        for d in config["dormitories"]
    ]


def get_machine_types():
    config = load_config()
    types = set()
    for dorm in config["dormitories"]:
        for mt in dorm["machine_types"]:
            types.add((mt["id"], mt["name"]))
    return [{"id": t[0], "name": t[1]} for t in sorted(types)]


def get_all_machines():
    config = load_config()
    machines = []
    for dorm in config["dormitories"]:
        for mt in dorm["machine_types"]:
            for m in mt["machines"]:
                machines.append(
                    {
                        "id": m["id"],
                        "dormitory_id": dorm["id"],
                        "dormitory_name": dorm["name"],
                        "machine_type": mt["id"],
                        "machine_type_name": mt["name"],
                        "name": m["name"],
                    }
                )
    return machines
