# butime

A lightweight, offline-first time-management app that combines a weekly timetable with an Eisenhower matrix, a calendar, and a Pomodoro timer. Everything runs in the browser and persists its data in `localStorage`.

## Features

butime ships with two modes that you switch between from the Settings page. Each mode keeps its own data, and switching never deletes the other mode's data.

### Legacy mode

- Weekly timetable with event blocks and a current-time indicator
- To-do list grouped by day with deadline-based urgency coloring
- Multiple instances via the collapsible sidebar
- Customizable "near deadline" thresholds and per-todo urgency overrides
- JSON export / import for full backups

### BBU mode

- Eisenhower matrix with four color-coded quadrants
- Quick-add task dialog with optional due date, time, and priority
- Right-click context menu: date shortcuts, priority flags, subtasks, pin, won't do, duplicate, delete
- Subtasks inherit their parent's date, time, priority, and quadrant
- Calendar view with month / week zoom and an overdue strip
- Flat task list sorted by Eisenhower priority
- Instances and the collapsible sidebar are shared with Legacy mode

### Pomodoro timer

- Configurable focus, short break, and long break durations
- Runs as a dropdown view or in the sidebar (configurable)
- Session tracker with progress dots
- Sound chime when a session ends (generated with the Web Audio API, no audio files)
- Link a task from its context menu to fill the timer title, then finish or remove it

## Getting Started

butime has no build step and no external dependencies. Serve the project root and open `front/index.html`.

### Option A - Python

```bash
python -m http.server 8080 --directory .
```

Then open `http://localhost:8080/front/index.html`.

### Option B - Any static server

Serve the project folder with your preferred static file server and navigate to `front/index.html`.

> Note: data is stored per origin. Opening the app from a different port or via `file://` shows a separate, empty storage bucket. Use Settings > Export / Import JSON to move data between origins.

## Project Structure

```text
.
|-- back/
|   |-- app.js      # UI logic, rendering, and interactions
|   `-- db.js       # Data layer, persistence, and migrations
|-- front/
|   |-- index.html  # App shell and markup
|   `-- style.css   # Styles and theme
`-- README.md
```

## Storage

All data lives in the browser's `localStorage` and persists across refreshes, browser restarts, and closing the folder.

| Key(s)                 | Purpose                          |
|------------------------|----------------------------------|
| `butime_instances`     | Instance list                    |
| `butime_data_<id>`     | Legacy data per instance         |
| `butime_bbu_data_<id>` | BBU tasks per instance           |
| `butime_settings`      | Legacy settings                  |
| `butime_pomodoro`      | Pomodoro settings and location   |
| `butime_mode`          | Active mode and view preferences |

## Built With

- Vanilla JavaScript (ES2020+)
- HTML5 and CSS3
- Web Audio API (Pomodoro chime)
- No frameworks, no external dependencies

## License

Licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).

