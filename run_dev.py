import os
import sys
import subprocess
import time
import urllib.request
import signal

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

NPM_DEV_CMD = ["cmd.exe", "/c", "npm", "run", "dev"] if os.name == "nt" else ["npm", "run", "dev"]

SERVICES = [
    {
        "name": "GIS Service",
        "cwd": "services/gis-service/src",
        "cmd": [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8003", "--reload"],
        "health_url": "http://127.0.0.1:8003/health",
    },
    {
        "name": "Extraction Engine",
        "cwd": "services/extraction-engine/src",
        "cmd": [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8002", "--reload"],
        "health_url": "http://127.0.0.1:8002/health",
    },
    {
        "name": "OCR Pipeline",
        "cwd": "services/ocr-pipeline/src",
        "cmd": [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8001", "--reload"],
        "health_url": "http://127.0.0.1:8001/health",
    },
    {
        "name": "API Gateway",
        "cwd": "services/api-gateway/src",
        "cmd": [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"],
        "health_url": "http://127.0.0.1:8000/health",
    },
    {
        "name": "Upload Portal",
        "cwd": "frontend/upload-portal",
        "cmd": NPM_DEV_CMD,
        "health_url": "http://localhost:3000",
    },
    {
        "name": "Dashboard",
        "cwd": "frontend/dashboard",
        "cmd": NPM_DEV_CMD,
        "health_url": "http://localhost:3001",
    },
]

processes = []

def cleanup(sig=None, frame=None):
    print("\nShutting down all services...")
    for svc, proc in processes:
        try:
            print(f"Terminating {svc['name']} (PID {proc.pid})...")
            proc.terminate()
        except Exception:
            pass
    time.sleep(1)
    for svc, proc in processes:
        try:
            proc.kill()
        except Exception:
            pass
    print("All services stopped.")
    sys.exit(0)

signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

print("=" * 60)
print("STARTING LAND RECORD DIGITIZER SERVICES")
print("=" * 60)

for svc in SERVICES:
    print(f"Starting {svc['name']}...")
    proc = subprocess.Popen(
        svc["cmd"],
        cwd=os.path.abspath(svc["cwd"]),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    processes.append((svc, proc))
    time.sleep(0.5)

print("\nWaiting for services to become healthy...")
for svc, proc in processes:
    healthy = False
    for attempt in range(20):
        try:
            req = urllib.request.Request(svc["health_url"], headers={"User-Agent": "HealthCheck/1.0"})
            with urllib.request.urlopen(req, timeout=2) as resp:
                if resp.status in (200, 304):
                    healthy = True
                    break
        except Exception:
            pass
        time.sleep(1)
    if healthy:
        print(f"  [OK]   {svc['name']: <20} -> {svc['health_url']}")
    else:
        print(f"  [FAIL] {svc['name']: <20} -> {svc['health_url']}")

print("=" * 60)
print("ALL SERVICES ARE RUNNING!")
print("  - Upload Portal: http://localhost:3000")
print("  - Dashboard:     http://localhost:3001")
print("  - API Gateway:   http://localhost:8000/docs")
print("=" * 60)
print("Services running in background.")

try:
    while True:
        time.sleep(1)
        for svc, proc in processes:
            if proc.poll() is not None:
                print(f"Service {svc['name']} exited with code {proc.returncode}")
                cleanup()
except KeyboardInterrupt:
    cleanup()