# 🧠 Skill Decay Tracker

**Don't let your skills rust away.**

Track your skills, monitor their decay, and never let a talent slip away from disuse. Skills decay at different rates—physical skills fade faster than knowledge. This app helps you stay on top of everything you've learned.

![Version](https://img.shields.io/badge/version-1.2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### Core
- **📊 Dashboard** — See your skill health at a glance
- **🔥 Streak Tracking** — Track consecutive practice days
- **⚠️ Decay Alerts** — Get notified when skills need attention
- **📝 Practice Logging** — Log sessions with duration and quality

### Smart Decay Algorithm
- **Category-aware decay rates** — Physical skills (1.5x), Music (1.2x), Languages (0.8x), Technical (0.6x)
- **Target frequency** — Set how often you want to practice each skill
- **Health scoring** — Based on actual practice vs. target frequency

### Organization
- **🔍 Search** — Find skills instantly
- **📊 Sort** — By health, name, category, or last practiced
- **🏷️ Filter** — By category
- **7 Categories** — Music, Language, Physical, Technical, Creative, Social, Other

### New in v1.2.0 — MAANG-Level Polish 🚀
- **📱 Mobile-First Design** — Bottom navigation, FAB, touch-friendly
- **✨ Glass Morphism** — Beautiful frosted glass cards
- **🎯 Hero Dashboard** — Health ring, quick stats at a glance
- **⚡ Quick Practice Chips** — One-tap practice from dashboard
- **🎉 Confetti Celebrations** — Streak milestones trigger confetti
- **👆 Swipe Gestures** — Swipe left to practice, right for details
- **🔄 Pull-to-Refresh** — Native mobile feel
- **💀 Skeleton Loading** — No blank screens, elegant loading states
- **🚀 Onboarding Flow** — Beautiful intro for new users
- **📐 Consistent Spacing** — Professional typography and rhythm

### v1.1.0
- **🌓 Auto Theme** — Time-based dark/light mode switching
- **📈 Progress View** — Charts showing practice activity over 30 days
- **💾 Backup/Restore** — Export all data as JSON, import with merge or replace
- **⌨️ Keyboard Shortcuts** — `n` new skill, `/` search, `1-4` switch views, `⌘E` export
- **⚙️ Settings Page** — Configure theme, defaults, and more
- **🍞 Toast Notifications** — Feedback on actions

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/skill-decay-tracker.git
cd skill-decay-tracker

# Install dependencies
cd server && npm install && cd ..
cd client && npm install && cd ..

# Start the app
./start.sh
```

Or manually:

```bash
# Terminal 1: Start server
cd server && node index.js

# Terminal 2: Start client
cd client && npm run dev
```

Open http://localhost:5173

## 🎯 How It Works

### Decay Algorithm

Skills decay based on:
1. **Days since last practice**
2. **Target practice frequency** (how often you want to practice)
3. **Decay rate multiplier** (varies by category)

```
decay_score = (days_since_practice / target_frequency) × decay_rate
```

### Health Levels

| Level | Score | Meaning |
|-------|-------|---------|
| 🟢 Excellent | ≤0.7 | Within 70% of target |
| 🟡 Good | ≤1.0 | At or near target |
| 🟠 Fair | ≤1.5 | Slightly overdue |
| 🔴 Rusty | ≤3.0 | Significantly overdue |
| 💀 Critical | >3.0 | Urgent attention needed |

### Default Decay Rates

| Category | Rate | Why |
|----------|------|-----|
| Physical/Sports | 1.5x | Muscle memory fades fast |
| Music | 1.2x | Technique degrades quickly |
| Creative | 1.0x | Balanced decay |
| Language | 0.8x | Memory persists longer |
| Social | 0.7x | Soft skills are stable |
| Technical | 0.6x | Knowledge lasts |

## 📁 Project Structure

```
skill-decay-tracker/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.tsx        # Main application
│   │   └── App.css        # Styles
│   └── package.json
├── server/                 # Express backend
│   ├── index.js           # API server
│   ├── skilltracker.db    # SQLite database
│   └── package.json
├── start.sh               # Quick start script
└── README.md
```

## 🛠️ API Reference

### Skills

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/skills` | List all skills with health status |
| GET | `/api/skills/:id` | Get skill details with history |
| POST | `/api/skills` | Create new skill |
| PUT | `/api/skills/:id` | Update skill |
| DELETE | `/api/skills/:id` | Delete skill |

### Practice Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/skills/:id/practice` | Log detailed practice |
| POST | `/api/skills/:id/quick-practice` | Quick log (just timestamp) |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Overview stats and alerts |
| GET | `/api/alerts` | Skills needing attention |
| GET | `/api/categories` | Available categories |

## 🔮 Roadmap

- [ ] Electron desktop app
- [x] Dark/Light/Auto theme (time-based)
- [x] Progress charts over time
- [x] Data export/import (JSON backup)
- [x] Keyboard shortcuts
- [ ] Notifications/Reminders
- [ ] Mobile PWA
- [ ] Spaced repetition suggestions

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with React, Express, and SQLite
- Inspired by spaced repetition systems
- Created by Zenith ⚡

---

**Remember:** A skill unused is a skill decaying. Practice today! 🎯
