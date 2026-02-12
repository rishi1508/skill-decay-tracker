const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 3003;

// Database setup
const db = new Database(path.join(__dirname, 'skilltracker.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    decay_rate REAL NOT NULL DEFAULT 1.0,
    target_frequency_days INTEGER DEFAULT 7,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    archived INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS practice_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_id INTEGER NOT NULL,
    practiced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration_minutes INTEGER,
    quality INTEGER CHECK(quality >= 1 AND quality <= 5),
    notes TEXT,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    default_decay_rate REAL DEFAULT 1.0,
    color TEXT
  );
`);

// Seed default categories if empty
const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
if (categoryCount.count === 0) {
  const insertCategory = db.prepare('INSERT INTO categories (id, name, icon, default_decay_rate, color) VALUES (?, ?, ?, ?, ?)');
  const categories = [
    ['music', 'Music', '🎵', 1.2, '#9333ea'],
    ['language', 'Language', '🗣️', 0.8, '#2563eb'],
    ['physical', 'Physical/Sports', '💪', 1.5, '#dc2626'],
    ['technical', 'Technical', '💻', 0.6, '#059669'],
    ['creative', 'Creative', '🎨', 1.0, '#d97706'],
    ['social', 'Social', '🤝', 0.7, '#ec4899'],
    ['other', 'Other', '📌', 1.0, '#6b7280']
  ];
  categories.forEach(cat => insertCategory.run(...cat));
}

app.use(cors());
app.use(express.json());

// === CATEGORIES ===
app.get('/api/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.json(categories);
});

// === SKILLS ===

// Get all skills with decay status
app.get('/api/skills', (req, res) => {
  const includeArchived = req.query.archived === 'true';
  const skills = db.prepare(`
    SELECT 
      s.*,
      c.name as category_name,
      c.icon as category_icon,
      c.color as category_color,
      (SELECT practiced_at FROM practice_logs WHERE skill_id = s.id ORDER BY practiced_at DESC LIMIT 1) as last_practiced,
      (SELECT COUNT(*) FROM practice_logs WHERE skill_id = s.id) as total_sessions,
      (SELECT SUM(duration_minutes) FROM practice_logs WHERE skill_id = s.id) as total_minutes
    FROM skills s
    LEFT JOIN categories c ON s.category = c.id
    WHERE s.archived = ?
    ORDER BY s.name
  `).all(includeArchived ? 1 : 0);

  // Calculate decay status for each skill
  // Health is based on: days since practice relative to target frequency
  const now = new Date();
  const enrichedSkills = skills.map(skill => {
    const lastPracticed = skill.last_practiced ? new Date(skill.last_practiced) : null;
    const daysSince = lastPracticed 
      ? Math.floor((now - lastPracticed) / (1000 * 60 * 60 * 24))
      : null;
    
    // Decay score considers both time elapsed AND target frequency
    // If target is 7 days and it's been 7 days, that's different than target 2 days and 7 days elapsed
    const targetDays = skill.target_frequency_days || 7;
    const overdueRatio = daysSince !== null ? daysSince / targetDays : null;
    const decayScore = overdueRatio !== null ? overdueRatio * skill.decay_rate : null;
    
    let health = 'unknown';
    let healthColor = '#6b7280';
    if (decayScore !== null) {
      // Health based on how overdue relative to target
      if (decayScore <= 0.7) { health = 'excellent'; healthColor = '#22c55e'; }      // Within 70% of target
      else if (decayScore <= 1.0) { health = 'good'; healthColor = '#84cc16'; }      // At or near target
      else if (decayScore <= 1.5) { health = 'fair'; healthColor = '#eab308'; }      // 1-1.5x overdue
      else if (decayScore <= 3.0) { health = 'rusty'; healthColor = '#f97316'; }     // 1.5-3x overdue
      else { health = 'critical'; healthColor = '#ef4444'; }                          // 3x+ overdue
    }

    return {
      ...skill,
      days_since_practice: daysSince,
      decay_score: decayScore,
      overdue_ratio: overdueRatio,
      health,
      health_color: healthColor
    };
  });

  res.json(enrichedSkills);
});

// Get single skill with history
app.get('/api/skills/:id', (req, res) => {
  const skill = db.prepare(`
    SELECT 
      s.*,
      c.name as category_name,
      c.icon as category_icon,
      c.color as category_color
    FROM skills s
    LEFT JOIN categories c ON s.category = c.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!skill) {
    return res.status(404).json({ error: 'Skill not found' });
  }

  const logs = db.prepare(`
    SELECT * FROM practice_logs 
    WHERE skill_id = ? 
    ORDER BY practiced_at DESC 
    LIMIT 50
  `).all(req.params.id);

  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_sessions,
      SUM(duration_minutes) as total_minutes,
      AVG(quality) as avg_quality,
      MIN(practiced_at) as first_practice,
      MAX(practiced_at) as last_practice
    FROM practice_logs 
    WHERE skill_id = ?
  `).get(req.params.id);

  res.json({ skill, logs, stats });
});

// Create skill
app.post('/api/skills', (req, res) => {
  const { name, category, decay_rate, target_frequency_days, notes } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const result = db.prepare(`
    INSERT INTO skills (name, category, decay_rate, target_frequency_days, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    name,
    category || 'other',
    decay_rate || 1.0,
    target_frequency_days || 7,
    notes || null
  );

  res.json({ id: result.lastInsertRowid, message: 'Skill created' });
});

// Update skill
app.put('/api/skills/:id', (req, res) => {
  const { name, category, decay_rate, target_frequency_days, notes, archived } = req.body;
  
  db.prepare(`
    UPDATE skills 
    SET name = COALESCE(?, name),
        category = COALESCE(?, category),
        decay_rate = COALESCE(?, decay_rate),
        target_frequency_days = COALESCE(?, target_frequency_days),
        notes = COALESCE(?, notes),
        archived = COALESCE(?, archived)
    WHERE id = ?
  `).run(name, category, decay_rate, target_frequency_days, notes, archived, req.params.id);

  res.json({ message: 'Skill updated' });
});

// Delete skill
app.delete('/api/skills/:id', (req, res) => {
  db.prepare('DELETE FROM practice_logs WHERE skill_id = ?').run(req.params.id);
  db.prepare('DELETE FROM skills WHERE id = ?').run(req.params.id);
  res.json({ message: 'Skill deleted' });
});

// === PRACTICE LOGS ===

// Log practice session
app.post('/api/skills/:id/practice', (req, res) => {
  const { duration_minutes, quality, notes, practiced_at } = req.body;
  
  const result = db.prepare(`
    INSERT INTO practice_logs (skill_id, duration_minutes, quality, notes, practiced_at)
    VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
  `).run(req.params.id, duration_minutes || null, quality || null, notes || null, practiced_at || null);

  res.json({ id: result.lastInsertRowid, message: 'Practice logged' });
});

// Quick practice (just mark as practiced now)
app.post('/api/skills/:id/quick-practice', (req, res) => {
  const result = db.prepare(`
    INSERT INTO practice_logs (skill_id, practiced_at)
    VALUES (?, CURRENT_TIMESTAMP)
  `).run(req.params.id);

  res.json({ id: result.lastInsertRowid, message: 'Quick practice logged' });
});

// Delete practice log
app.delete('/api/practice/:id', (req, res) => {
  db.prepare('DELETE FROM practice_logs WHERE id = ?').run(req.params.id);
  res.json({ message: 'Practice log deleted' });
});

// === DASHBOARD / STATS ===

// Get dashboard overview
app.get('/api/dashboard', (req, res) => {
  const now = new Date();
  
  // Get all active skills with their status
  const skills = db.prepare(`
    SELECT 
      s.*,
      c.name as category_name,
      c.icon as category_icon,
      (SELECT practiced_at FROM practice_logs WHERE skill_id = s.id ORDER BY practiced_at DESC LIMIT 1) as last_practiced
    FROM skills s
    LEFT JOIN categories c ON s.category = c.id
    WHERE s.archived = 0
  `).all();

  let excellent = 0, good = 0, fair = 0, rusty = 0, critical = 0, unknown = 0;
  const decayingSkills = [];

  skills.forEach(skill => {
    const lastPracticed = skill.last_practiced ? new Date(skill.last_practiced) : null;
    const daysSince = lastPracticed 
      ? Math.floor((now - lastPracticed) / (1000 * 60 * 60 * 24))
      : null;
    
    // Use same health calculation as skills endpoint
    const targetDays = skill.target_frequency_days || 7;
    const overdueRatio = daysSince !== null ? daysSince / targetDays : null;
    const decayScore = overdueRatio !== null ? overdueRatio * skill.decay_rate : null;

    if (decayScore === null) { unknown++; }
    else if (decayScore <= 0.7) { excellent++; }
    else if (decayScore <= 1.0) { good++; }
    else if (decayScore <= 1.5) { fair++; }
    else if (decayScore <= 3.0) { 
      rusty++; 
      decayingSkills.push({ ...skill, days_since: daysSince, decay_score: decayScore, health: 'rusty' });
    }
    else { 
      critical++; 
      decayingSkills.push({ ...skill, days_since: daysSince, decay_score: decayScore, health: 'critical' });
    }
  });

  // Recent activity (last 7 days)
  const recentActivity = db.prepare(`
    SELECT 
      DATE(practiced_at) as date,
      COUNT(*) as sessions,
      SUM(duration_minutes) as total_minutes
    FROM practice_logs
    WHERE practiced_at >= DATE('now', '-7 days')
    GROUP BY DATE(practiced_at)
    ORDER BY date DESC
  `).all();

  // Streak calculation - count consecutive days with practice
  const practiceToday = db.prepare(`
    SELECT COUNT(*) as count FROM practice_logs 
    WHERE DATE(practiced_at) = DATE('now')
  `).get();

  // Get all practice dates in the last 30 days
  const practiceDates = db.prepare(`
    SELECT DISTINCT DATE(practiced_at) as date 
    FROM practice_logs 
    WHERE practiced_at >= DATE('now', '-30 days')
    ORDER BY date DESC
  `).all();

  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check if practiced today or yesterday to start counting
  if (practiceDates.length > 0) {
    const dates = practiceDates.map(d => new Date(d.date));
    let checkDate = new Date(today);
    
    // If didn't practice today, start from yesterday
    if (!practiceToday.count) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    for (let i = 0; i < 30; i++) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (dates.some(d => d.toISOString().split('T')[0] === dateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Best streak (would need historical tracking, simplified for now)
  const totalPracticeDays = db.prepare(`
    SELECT COUNT(DISTINCT DATE(practiced_at)) as days FROM practice_logs
  `).get();

  res.json({
    total_skills: skills.length,
    health_breakdown: { excellent, good, fair, rusty, critical, unknown },
    decaying_skills: decayingSkills.sort((a, b) => b.decay_score - a.decay_score),
    recent_activity: recentActivity,
    practiced_today: practiceToday.count > 0,
    current_streak: currentStreak,
    total_practice_days: totalPracticeDays.days
  });
});

// === ALERTS ===
app.get('/api/alerts', (req, res) => {
  const now = new Date();
  
  const skills = db.prepare(`
    SELECT 
      s.*,
      c.icon as category_icon,
      (SELECT practiced_at FROM practice_logs WHERE skill_id = s.id ORDER BY practiced_at DESC LIMIT 1) as last_practiced
    FROM skills s
    LEFT JOIN categories c ON s.category = c.id
    WHERE s.archived = 0
  `).all();

  const alerts = [];

  skills.forEach(skill => {
    const lastPracticed = skill.last_practiced ? new Date(skill.last_practiced) : null;
    const daysSince = lastPracticed 
      ? Math.floor((now - lastPracticed) / (1000 * 60 * 60 * 24))
      : null;

    if (daysSince === null) {
      alerts.push({
        skill_id: skill.id,
        skill_name: skill.name,
        icon: skill.category_icon,
        type: 'never_practiced',
        message: `You haven't practiced ${skill.name} yet!`,
        severity: 'info'
      });
    } else if (daysSince > skill.target_frequency_days * 3) {
      alerts.push({
        skill_id: skill.id,
        skill_name: skill.name,
        icon: skill.category_icon,
        type: 'critical_decay',
        message: `${skill.name} is critically decaying! ${daysSince} days since last practice.`,
        severity: 'critical',
        days_since: daysSince
      });
    } else if (daysSince > skill.target_frequency_days) {
      alerts.push({
        skill_id: skill.id,
        skill_name: skill.name,
        icon: skill.category_icon,
        type: 'overdue',
        message: `${skill.name} is overdue for practice. ${daysSince} days since last session.`,
        severity: 'warning',
        days_since: daysSince
      });
    }
  });

  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  res.json(alerts);
});

// === HISTORY / CHARTS ===

// Get practice history for charts (last N days)
app.get('/api/history', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  
  // Daily practice summary
  const dailyStats = db.prepare(`
    SELECT 
      DATE(practiced_at) as date,
      COUNT(*) as sessions,
      COUNT(DISTINCT skill_id) as skills_practiced,
      SUM(duration_minutes) as total_minutes,
      AVG(quality) as avg_quality
    FROM practice_logs
    WHERE practiced_at >= DATE('now', '-' || ? || ' days')
    GROUP BY DATE(practiced_at)
    ORDER BY date ASC
  `).all(days);

  // Skill health snapshots (calculate what health would have been each day)
  // Simplified: just return current health trend per skill
  const skillTrends = db.prepare(`
    SELECT 
      s.id,
      s.name,
      s.category,
      c.icon as category_icon,
      s.target_frequency_days,
      s.decay_rate,
      (SELECT COUNT(*) FROM practice_logs WHERE skill_id = s.id AND practiced_at >= DATE('now', '-' || ? || ' days')) as recent_sessions,
      (SELECT practiced_at FROM practice_logs WHERE skill_id = s.id ORDER BY practiced_at DESC LIMIT 1) as last_practiced
    FROM skills s
    LEFT JOIN categories c ON s.category = c.id
    WHERE s.archived = 0
  `).all(days);

  res.json({ dailyStats, skillTrends, days });
});

// Get single skill practice history for mini chart
app.get('/api/skills/:id/history', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  
  const history = db.prepare(`
    SELECT 
      DATE(practiced_at) as date,
      COUNT(*) as sessions,
      SUM(duration_minutes) as minutes,
      AVG(quality) as avg_quality
    FROM practice_logs
    WHERE skill_id = ? AND practiced_at >= DATE('now', '-' || ? || ' days')
    GROUP BY DATE(practiced_at)
    ORDER BY date ASC
  `).all(req.params.id, days);

  res.json(history);
});

// === EXPORT / IMPORT ===

// Export all data
app.get('/api/export', (req, res) => {
  const skills = db.prepare('SELECT * FROM skills').all();
  const practiceLogs = db.prepare('SELECT * FROM practice_logs').all();
  const categories = db.prepare('SELECT * FROM categories').all();
  
  const exportData = {
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    skills,
    practice_logs: practiceLogs,
    categories
  };

  res.json(exportData);
});

// Import data (merge or replace)
app.post('/api/import', (req, res) => {
  const { skills, practice_logs, mode } = req.body;
  const replaceAll = mode === 'replace';

  try {
    if (replaceAll) {
      db.prepare('DELETE FROM practice_logs').run();
      db.prepare('DELETE FROM skills').run();
    }

    let skillsImported = 0;
    let logsImported = 0;
    const skillIdMap = {}; // old id -> new id

    // Import skills
    if (skills && Array.isArray(skills)) {
      const insertSkill = db.prepare(`
        INSERT INTO skills (name, category, decay_rate, target_frequency_days, notes, created_at, archived)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      skills.forEach(skill => {
        // Check for duplicate by name (for merge mode)
        if (!replaceAll) {
          const existing = db.prepare('SELECT id FROM skills WHERE name = ?').get(skill.name);
          if (existing) {
            skillIdMap[skill.id] = existing.id;
            return;
          }
        }

        const result = insertSkill.run(
          skill.name,
          skill.category || 'other',
          skill.decay_rate || 1.0,
          skill.target_frequency_days || 7,
          skill.notes || null,
          skill.created_at || new Date().toISOString(),
          skill.archived || 0
        );
        skillIdMap[skill.id] = result.lastInsertRowid;
        skillsImported++;
      });
    }

    // Import practice logs
    if (practice_logs && Array.isArray(practice_logs)) {
      const insertLog = db.prepare(`
        INSERT INTO practice_logs (skill_id, practiced_at, duration_minutes, quality, notes)
        VALUES (?, ?, ?, ?, ?)
      `);

      practice_logs.forEach(log => {
        const newSkillId = skillIdMap[log.skill_id];
        if (!newSkillId) return;

        // For merge mode, check if exact log exists
        if (!replaceAll) {
          const existing = db.prepare(
            'SELECT id FROM practice_logs WHERE skill_id = ? AND practiced_at = ?'
          ).get(newSkillId, log.practiced_at);
          if (existing) return;
        }

        insertLog.run(
          newSkillId,
          log.practiced_at,
          log.duration_minutes || null,
          log.quality || null,
          log.notes || null
        );
        logsImported++;
      });
    }

    res.json({ 
      message: 'Import successful',
      skills_imported: skillsImported,
      logs_imported: logsImported,
      mode: replaceAll ? 'replace' : 'merge'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === SETTINGS ===

// Settings stored in a simple key-value table
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(row => {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  });
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  
  Object.entries(req.body).forEach(([key, value]) => {
    upsert.run(key, JSON.stringify(value));
  });

  res.json({ message: 'Settings saved' });
});

app.listen(PORT, () => {
  console.log(`Skill Decay Tracker API running on http://localhost:${PORT}`);
});
