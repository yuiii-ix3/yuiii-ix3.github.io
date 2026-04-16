#!/usr/bin/env python3
import json
import re
from datetime import datetime, timezone
from pathlib import Path

SAMSUNG_SLEEPY_REPEAT_THRESHOLD = 1
SAMSUNG_QUIET_REPEAT_THRESHOLD = 2

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "quiet-corner-content.json"
WORKSPACE = Path("/home/azhar/.openclaw/workspace")
LENOVO_LOG = WORKSPACE / "telemetry" / "lenovo-sensors.log"
SAMSUNG_LOG = WORKSPACE / "telemetry" / "samsung-sensors.log"
TIMELINE_LIMIT = 12


def read_json(path: Path):
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def read_text(path: Path):
    if not path.exists():
        return ""
    return path.read_text(errors="replace")


def get_last_block(text: str):
    blocks = [block.strip() for block in re.split(r"^--- .* ---$", text, flags=re.MULTILINE) if block.strip()]
    return blocks[-1] if blocks else ""


def get_last_timestamp(text: str):
    matches = re.findall(r"^---\s+([^\n]+?)\s+---$", text, flags=re.MULTILINE)
    return matches[-1] if matches else None


def parse_device_block(text: str, disk_home_device_pattern: str | None = None):
    temp = "unavailable"
    memory = "unavailable"
    disk = "unavailable"
    uptime = "unavailable"

    for line in text.splitlines():
        if temp == "unavailable" and "°C" in line and re.search(r"Package id 0:|Tctl:|Tdie:|temp1:|edge:", line):
            match = re.search(r"([+-]?\d+(?:\.\d+)?)°C", line)
            if match:
                temp = f"{match.group(1)}°C"
        if line.startswith("Mem:"):
            parts = line.split()
            if len(parts) >= 3:
                memory = f"{parts[2]} / {parts[1]}"
        if line.startswith("/dev/"):
            parts = line.split()
            if len(parts) >= 6:
                mount = parts[5]
                usage = parts[4]
                if mount == "/":
                    disk = f"/ {usage}"
                elif mount == "/home":
                    home = f"/home {usage}"
                    disk = f"{disk} · {home}" if disk != "unavailable" else home
                elif disk_home_device_pattern and re.search(disk_home_device_pattern, line):
                    home = f"/home {usage}"
                    disk = f"{disk} · {home}" if disk != "unavailable" else home
        if "up " in line and uptime == "unavailable":
            uptime = line.split("up ", 1)[1].strip()

    return {
        "temp": temp,
        "memory": memory,
        "disk": disk,
        "uptime": uptime,
    }


def parse_lenovo():
    text = read_text(LENOVO_LOG)
    block = get_last_block(text)
    info = parse_device_block(block)
    info["timestamp"] = get_last_timestamp(text)
    return info


def parse_samsung():
    text = read_text(SAMSUNG_LOG)
    block = get_last_block(text)
    info = parse_device_block(block, disk_home_device_pattern=r"ubuntu--vg-local")
    info["timestamp"] = get_last_timestamp(text)
    return info


def main():
    data = read_json(DATA_PATH)
    machine_status = data.get("machine_status", {})
    previous_devices = {device.get("name"): device for device in machine_status.get("devices", [])}
    generated_at_dt = datetime.now(timezone.utc).replace(microsecond=0)
    generated_at = generated_at_dt.isoformat().replace("+00:00", "Z")

    lenovo_info = parse_lenovo()
    lenovo = {
        "name": "Lenovo",
        "role": "Main runtime",
        "status": "steady" if lenovo_info.get("timestamp") else "unreachable",
        "temp": lenovo_info["temp"],
        "memory": lenovo_info["memory"],
        "disk": lenovo_info["disk"],
        "uptime": lenovo_info["uptime"],
        "last_collected_at": lenovo_info.get("timestamp"),
        "status_confidence": "high" if lenovo_info.get("timestamp") else "low",
        "last_seen_text": "just now" if lenovo_info.get("timestamp") else "unknown",
    }

    samsung_info = parse_samsung()
    samsung_previous = previous_devices.get("Samsung", {})
    samsung_timestamp = samsung_info.get("timestamp")
    samsung_previous_timestamp = samsung_previous.get("last_collected_at")
    samsung_repeat_count = int(samsung_previous.get("stale_repeat_count", 0) or 0)

    if not samsung_timestamp:
        samsung_status = "unreachable"
        samsung_repeat_count = 0
        samsung_confidence = "low"
        samsung_last_seen_text = "unknown"
    else:
        try:
            samsung_seen_dt = datetime.fromisoformat(samsung_timestamp.replace('Z', '+00:00'))
            age_seconds = max(int((generated_at_dt - samsung_seen_dt).total_seconds()), 0)
        except ValueError:
            age_seconds = None

        if samsung_timestamp == samsung_previous_timestamp:
            samsung_repeat_count += 1
        else:
            samsung_repeat_count = 0

        if samsung_repeat_count >= SAMSUNG_QUIET_REPEAT_THRESHOLD:
            samsung_status = "quiet"
            samsung_confidence = "low"
        elif samsung_repeat_count >= SAMSUNG_SLEEPY_REPEAT_THRESHOLD:
            samsung_status = "sleepy"
            samsung_confidence = "medium"
        else:
            samsung_status = "steady"
            samsung_confidence = "high"

        if age_seconds is None:
            samsung_last_seen_text = "unknown"
        elif age_seconds < 60:
            samsung_last_seen_text = "just now"
        elif age_seconds < 3600:
            samsung_last_seen_text = f"{age_seconds // 60} min ago"
        elif age_seconds < 86400:
            samsung_last_seen_text = f"{age_seconds // 3600}h ago"
        else:
            samsung_last_seen_text = f"{age_seconds // 86400}d ago"

    samsung = {
        "name": "Samsung",
        "role": "Helper node",
        "status": samsung_status,
        "temp": samsung_info["temp"],
        "memory": samsung_info["memory"],
        "disk": samsung_info["disk"],
        "uptime": samsung_info["uptime"],
        "last_collected_at": samsung_timestamp,
        "stale_repeat_count": samsung_repeat_count,
        "status_confidence": samsung_confidence,
        "last_seen_text": samsung_last_seen_text,
    }
    machine_status["generated_at"] = generated_at
    machine_status["diagram"] = machine_status.get("diagram", {
        "title": "Yui runtime layout",
        "nodes": [
            {"name": "Lenovo", "role": "main runtime", "note": "main chat, page work, local runtime"},
            {"name": "Samsung", "role": "helper node", "note": "helper services, telemetry, support tasks"},
        ],
        "link": "Lenovo ↔ Samsung helper",
    })
    machine_status["devices"] = [lenovo, samsung]

    timeline = machine_status.get("timeline", [])
    new_entry = {
        "timestamp": generated_at,
        "devices": [
            {"name": lenovo["name"], "status": lenovo["status"], "temp": lenovo["temp"]},
            {"name": samsung["name"], "status": samsung["status"], "temp": samsung["temp"]},
        ],
    }
    timeline.append(new_entry)
    machine_status["timeline"] = timeline[-TIMELINE_LIMIT:]
    data["machine_status"] = machine_status

    write_json(DATA_PATH, data)


if __name__ == "__main__":
    main()
