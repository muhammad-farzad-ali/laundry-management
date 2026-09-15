# Laundry Management App - Implementation Plan

## Overview
A mobile-first, responsive web application for viewing and updating shared laundry machine status across dormitories. Follows KISS principle.

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Backend | Python + Flask | Simple, lightweight, easy to maintain |
| Frontend | Vanilla HTML/CSS/JS | No build step, minimal dependencies |
| Database | SQLite | Lightweight, no server needed |
| Config | JSON | Easy to edit, human-readable |

---

## Project Structure

```
laundry-management/
├── backend/
│   ├── app.py              # Flask application & routes
│   ├── models.py           # SQLite database models
│   ├── config.py           # Configuration loader
│   ├── init_db.py          # Database initialization script
│   ├── config/
│   │   └── machines.json   # Machine structure configuration
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── index.html          # Single landing page
│   ├── css/
│   │   └── style.css       # Mobile-first responsive styles
│   └── js/
│       └── app.js          # Frontend logic & API calls
└── README.md
```

---

## Phase 1: Backend Foundation

### Task 1.1: Project Setup
- Create directory structure
- Create `requirements.txt` with Flask dependencies
- Create `backend/config/machines.json` with sample data

### Task 1.2: Configuration System
- Create `backend/config.py`
- Load and parse `machines.json`
- Provide helper functions to get dormitories, machine types, machines

### Task 1.3: Database Layer
- Create `backend/models.py`
- Define SQLite schema for machines table
- Implement CRUD operations
- Create `backend/init_db.py` to initialize DB from config

**SQLite Schema:**
```sql
CREATE TABLE machines (
    id TEXT PRIMARY KEY,
    dormitory_id TEXT NOT NULL,
    dormitory_name TEXT NOT NULL,
    machine_type TEXT NOT NULL,
    machine_type_name TEXT NOT NULL,
    name TEXT NOT NULL,
    operational BOOLEAN DEFAULT 1,
    occupied BOOLEAN DEFAULT 0
);
```

### Task 1.4: REST API Endpoints
Create `backend/app.py` with Flask routes:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dormitories` | List all dormitories |
| GET | `/api/machines` | List machines (with filters) |
| GET | `/api/machines/<id>` | Get single machine |
| PATCH | `/api/machines/<id>` | Update machine status |

**Query Parameters for GET /api/machines:**
- `dormitory` - Filter by dormitory ID
- `type` - Filter by machine type

**Status Rules (enforced by backend):**
- If `operational=false`, force `occupied=false`
- Reject invalid state: `operational=false` + `occupied=true`

---

## Phase 2: Frontend Implementation

### Task 2.1: HTML Structure
- Mobile-first viewport meta tag
- Dormitory filter dropdown
- Optional machine type filter
- Machine list grouped by dormitory
- Table layout for each dormitory

### Task 2.2: CSS Styling
- Mobile-first responsive design
- Touch-friendly controls (min 44px tap targets)
- Clean, minimal table styling
- Status indicator colors (green=available, yellow=occupied, red=out of order)
- Responsive breakpoints for tablet/desktop

### Task 2.3: JavaScript Logic
- Fetch and render dormitories
- Fetch and render machines
- Filter functionality
- Update machine status via PATCH API
- Disable occupied control when operational=No
- Optimistic UI updates

---

## Phase 3: Integration & Polish

### Task 3.1: Static File Serving
- Configure Flask to serve frontend static files

### Task 3.2: Error Handling
- Backend validation errors
- Network error handling in frontend
- User-friendly error messages

### Task 3.3: Documentation
- Create README.md with setup instructions
- Document configuration format
- Document API endpoints

---

## Configuration Format

**machines.json:**
```json
{
  "dormitories": [
    {
      "id": "dorm-a",
      "name": "Dormitory A",
      "machine_types": [
        {
          "id": "washer",
          "name": "Washer",
          "machines": [
            {"id": "dorm-a-washer-1", "name": "Washer 1"},
            {"id": "dorm-a-washer-2", "name": "Washer 2"}
          ]
        },
        {
          "id": "dryer",
          "name": "Dryer",
          "machines": [
            {"id": "dorm-a-dryer-1", "name": "Dryer 1"}
          ]
        }
      ]
    }
  ]
}
```

---

## Status Display Logic

| Operational | Occupied | Display | Color |
|-------------|----------|---------|-------|
| Yes | No | Available | Green |
| Yes | Yes | Occupied | Yellow/Orange |
| No | No | Out of Order | Red |

---

## API Validation Rules

1. **PATCH /api/machines/{id}**
   - If body contains `operational: false`, set `occupied: false` regardless
   - If body contains `occupied: true` and machine is not operational, reject with 400
   - Return updated machine object

---

## Implementation Order

1. Backend: config → models → API endpoints
2. Frontend: HTML → CSS → JavaScript
3. Integration: static serving → testing → polish

---

## Success Criteria

- [ ] Machines display grouped by dormitory
- [ ] Dormitory filter works
- [ ] Machine type filter works
- [ ] Operational toggle works
- [ ] Occupied toggle disabled when operational=No
- [ ] Backend enforces status rules
- [ ] Mobile-responsive layout
- [ ] Touch-friendly controls
- [ ] Configuration-driven machine structure
