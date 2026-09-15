# Laundry Machine Status App

A mobile-first web application for viewing and updating shared laundry machine status across dormitories.

## Quick Start

```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Run the application
python app.py
```

Open http://localhost:5000 in your browser.

## Project Structure

```
laundry-management/
├── backend/
│   ├── app.py              # Flask application & REST API
│   ├── models.py           # SQLite database models
│   ├── config.py           # Configuration loader
│   ├── init_db.py          # Database initialization
│   ├── config/
│   │   └── machines.json   # Machine configuration
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
└── README.md
```

## Configuration

Edit `backend/config/machines.json` to add/remove dormitories, machine types, or machines.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dormitories` | List all dormitories |
| GET | `/api/machine-types` | List all machine types |
| GET | `/api/machines` | List machines (supports `?dormitory=` and `?type=` filters) |
| GET | `/api/machines/<id>` | Get single machine |
| PATCH | `/api/machines/<id>` | Update machine status |

## Status Rules

- **Operational + Not Occupied** = Available (green)
- **Operational + Occupied** = Occupied (yellow)
- **Not Operational** = Out of Order (red, occupied forced to No)
