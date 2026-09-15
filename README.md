# Laundry Machine Status App

A mobile-first web application for viewing and updating shared laundry machine status across dormitories.

## Quick Start (Development)

```bash
cd backend
pip install -r requirements.txt
python cli.py seed
python app.py
```

Open http://localhost:5000 in your browser.

## Production Deployment (Ubuntu)

### 1. Install dependencies

```bash
sudo apt update && sudo apt install python3 python3-pip -y
cd backend
pip3 install -r requirements.txt
```

### 2. Run with Gunicorn

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

- `-w 4` — 4 worker processes (adjust based on CPU cores)
- `-b 0.0.0.0:5000` — listen on all interfaces, port 5000

### 3. Run as a systemd service

Create `/etc/systemd/system/laundry.service`:

```ini
[Unit]
Description=Laundry Machine Status App
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/laundry-management/backend
ExecStart=/usr/local/bin/gunicorn -w 4 -b 127.0.0.1:5000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable laundry
sudo systemctl start laundry
```

### 4. Reverse proxy with Nginx

```bash
sudo apt install nginx -y
```

Create `/etc/nginx/sites-available/laundry`:

```nginx
server {
    listen 80;
    server_name laundry.example.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/laundry /etc/nginx/sites-enabled
sudo nginx -t
sudo systemctl reload nginx
```

## Project Structure

```
laundry-management/
├── backend/
│   ├── app.py              # Flask application & REST API
│   ├── models.py           # SQLite database models
│   ├── config.py           # Configuration loader
│   ├── cli.py              # Database seed/clean CLI
│   ├── config/
│   │   └── machines.json   # Machine configuration
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   └── js/app.js
└── README.md
```

## Configuration

Edit `backend/config/machines.json` to add/remove dormitories, machine types, or machines.

## Database CLI

The server does not auto-seed the database. Use the CLI to manage it:

```bash
cd backend

# Seed database from machines.json (creates/updates machines)
python cli.py seed

# Clean database (removes all machines)
python cli.py clean

# Reset all machines to default status
python cli.py reset
```

After editing `machines.json`, run `python cli.py seed` to sync changes.

All machines automatically reset to default status (Available, no occupation data) at midnight every day.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dormitories` | List all dormitories |
| GET | `/api/machine-types` | List all machine types |
| GET | `/api/machines` | List machines (supports `?dormitory=` and `?type=` filters) |
| GET | `/api/machines/<id>` | Get single machine |
| PATCH | `/api/machines/<id>` | Update machine status |
| POST | `/api/machines/expire` | Expire timed-out occupied machines |

## Status Rules

- **Operational + Not Occupied** = Available (green)
- **Operational + Occupied** = Occupied (yellow)
- **Not Operational** = Out of Order (red, occupied forced to No)

When a machine is occupied, a timer counts down (max 2 hours) and automatically resets to Available when expired.

## Machine Status Fields

| Field | Description |
|-------|-------------|
| Operational | Whether the machine is working (Yes/No) |
| Occupied | Whether someone is using it (Yes/No) |
| Duration | How long the machine is occupied (max 2 hours) |
| Occupant Name | Optional name of the person using the machine |
| Occupant Phone | Optional phone number with country code |
| Permission to Remove | Whether others can remove laundry when timer expires |
