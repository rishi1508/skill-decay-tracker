// localStorage-based storage for Skill Decay Tracker
// Replaces server API - works offline in APK

export interface Category {
  id: string
  name: string
  icon: string
  default_decay_rate: number
  color: string
}

export interface Skill {
  id: number
  name: string
  category: string
  decay_rate: number
  target_frequency_days: number
  notes: string | null
  created_at: string
  archived: number
}

export interface PracticeLog {
  id: number
  skill_id: number
  practiced_at: string
  duration_minutes: number
  quality: number
  notes: string | null
}

export interface Settings {
  theme: 'dark' | 'light' | 'auto'
  autoThemeLight: string
  autoThemeDark: string
  defaultTargetFrequency: number
  showOnboarding: boolean
}

export interface SkillWithStats extends Skill {
  category_name: string
  category_icon: string
  category_color: string
  last_practiced: string | null
  days_since_practice: number | null
  days_since?: number
  decay_score: number | null
  health: string
  health_color: string
  total_sessions: number
  total_minutes: number
}

export interface Dashboard {
  total_skills: number
  health_breakdown: {
    excellent: number
    good: number
    fair: number
    rusty: number
    critical: number
    unknown: number
  }
  decaying_skills: SkillWithStats[]
  recent_activity: { date: string; sessions: number; total_minutes: number }[]
  practiced_today: boolean
  current_streak: number
  total_practice_days: number
}

export interface Alert {
  skill_id: number
  skill_name: string
  icon: string
  type: string
  message: string
  severity: string
  days_since?: number
}

export interface HistoryData {
  dailyStats: { date: string; sessions: number; skills_practiced: number; total_minutes: number; avg_quality: number }[]
  skillTrends: { id: number; name: string; category_icon: string; recent_sessions: number; last_practiced: string }[]
  days: number
}

const KEYS = {
  SKILLS: 'skill_decay_skills',
  LOGS: 'skill_decay_logs',
  SETTINGS: 'skill_decay_settings',
}

// Default categories (hardcoded - no server needed)
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'music', name: 'Music', icon: '🎵', default_decay_rate: 1.2, color: '#9333ea' },
  { id: 'language', name: 'Language', icon: '🗣️', default_decay_rate: 0.8, color: '#2563eb' },
  { id: 'physical', name: 'Physical/Sports', icon: '💪', default_decay_rate: 1.5, color: '#dc2626' },
  { id: 'technical', name: 'Technical', icon: '💻', default_decay_rate: 0.6, color: '#059669' },
  { id: 'creative', name: 'Creative', icon: '🎨', default_decay_rate: 1.0, color: '#d97706' },
  { id: 'social', name: 'Social', icon: '🤝', default_decay_rate: 0.7, color: '#ec4899' },
  { id: 'other', name: 'Other', icon: '📌', default_decay_rate: 1.0, color: '#6b7280' },
]

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  autoThemeLight: '07:00',
  autoThemeDark: '19:00',
  defaultTargetFrequency: 7,
  showOnboarding: true,
}

// Helper functions
function getItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch {
    return defaultValue
  }
}

function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 1000)
}

function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000
  return Math.floor(Math.abs((date1.getTime() - date2.getTime()) / oneDay))
}

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

// Category helpers
export function getCategories(): Category[] {
  return DEFAULT_CATEGORIES
}

export function getCategoryById(id: string): Category | undefined {
  return DEFAULT_CATEGORIES.find(c => c.id === id)
}

// Skills CRUD
export function getSkills(): Skill[] {
  return getItem<Skill[]>(KEYS.SKILLS, [])
}

export function getSkill(id: number): Skill | undefined {
  return getSkills().find(s => s.id === id)
}

export function addSkill(skill: Omit<Skill, 'id' | 'created_at' | 'archived'>): Skill {
  const skills = getSkills()
  const newSkill: Skill = {
    ...skill,
    id: generateId(),
    created_at: new Date().toISOString(),
    archived: 0,
  }
  skills.push(newSkill)
  setItem(KEYS.SKILLS, skills)
  return newSkill
}

export function updateSkill(id: number, updates: Partial<Skill>): void {
  const skills = getSkills()
  const index = skills.findIndex(s => s.id === id)
  if (index !== -1) {
    skills[index] = { ...skills[index], ...updates }
    setItem(KEYS.SKILLS, skills)
  }
}

export function deleteSkill(id: number): void {
  const skills = getSkills().filter(s => s.id !== id)
  setItem(KEYS.SKILLS, skills)
  // Also delete practice logs for this skill
  const logs = getPracticeLogs().filter(l => l.skill_id !== id)
  setItem(KEYS.LOGS, logs)
}

// Practice Logs
export function getPracticeLogs(): PracticeLog[] {
  return getItem<PracticeLog[]>(KEYS.LOGS, [])
}

export function getLogsForSkill(skillId: number): PracticeLog[] {
  return getPracticeLogs().filter(l => l.skill_id === skillId)
}

export function addPracticeLog(log: Omit<PracticeLog, 'id' | 'practiced_at'>): PracticeLog {
  const logs = getPracticeLogs()
  const newLog: PracticeLog = {
    ...log,
    id: generateId(),
    practiced_at: new Date().toISOString(),
  }
  logs.push(newLog)
  setItem(KEYS.LOGS, logs)
  return newLog
}

export function quickPractice(skillId: number): PracticeLog {
  return addPracticeLog({
    skill_id: skillId,
    duration_minutes: 15,
    quality: 3,
    notes: null,
  })
}

// Computed: Skills with stats
export function getSkillsWithStats(): SkillWithStats[] {
  const skills = getSkills().filter(s => !s.archived)
  const logs = getPracticeLogs()
  const now = new Date()

  return skills.map(skill => {
    const category = getCategoryById(skill.category) || DEFAULT_CATEGORIES[6]
    const skillLogs = logs.filter(l => l.skill_id === skill.id)
    const lastLog = skillLogs.sort((a, b) => 
      new Date(b.practiced_at).getTime() - new Date(a.practiced_at).getTime()
    )[0]

    const lastPracticed = lastLog?.practiced_at || null
    const daysSince = lastPracticed 
      ? daysBetween(now, new Date(lastPracticed))
      : null

    // Calculate health based on days since practice and target frequency
    let health = 'unknown'
    let healthColor = '#6b7280'
    let decayScore: number | null = null

    if (daysSince !== null) {
      const ratio = daysSince / skill.target_frequency_days
      decayScore = Math.min(ratio * skill.decay_rate * 100, 100)

      if (ratio <= 0.5) {
        health = 'excellent'
        healthColor = '#22c55e'
      } else if (ratio <= 1) {
        health = 'good'
        healthColor = '#84cc16'
      } else if (ratio <= 1.5) {
        health = 'fair'
        healthColor = '#eab308'
      } else if (ratio <= 2.5) {
        health = 'rusty'
        healthColor = '#f97316'
      } else {
        health = 'critical'
        healthColor = '#ef4444'
      }
    }

    return {
      ...skill,
      category_name: category.name,
      category_icon: category.icon,
      category_color: category.color,
      last_practiced: lastPracticed,
      days_since_practice: daysSince,
      days_since: daysSince ?? undefined,
      decay_score: decayScore,
      health,
      health_color: healthColor,
      total_sessions: skillLogs.length,
      total_minutes: skillLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0),
    }
  })
}

// Dashboard
export function getDashboard(): Dashboard {
  const skills = getSkillsWithStats()
  const logs = getPracticeLogs()
  const today = getToday()

  // Health breakdown
  const health_breakdown = {
    excellent: 0, good: 0, fair: 0, rusty: 0, critical: 0, unknown: 0
  }
  skills.forEach(s => {
    health_breakdown[s.health as keyof typeof health_breakdown]++
  })

  // Decaying skills (fair, rusty, critical)
  const decaying_skills = skills
    .filter(s => ['fair', 'rusty', 'critical'].includes(s.health))
    .sort((a, b) => (b.days_since_practice || 999) - (a.days_since_practice || 999))

  // Recent activity (last 7 days)
  const recent_activity: { date: string; sessions: number; total_minutes: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const dayLogs = logs.filter(l => l.practiced_at.startsWith(dateStr))
    recent_activity.push({
      date: dateStr,
      sessions: dayLogs.length,
      total_minutes: dayLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0),
    })
  }

  // Practiced today
  const practiced_today = logs.some(l => l.practiced_at.startsWith(today))

  // Current streak
  let current_streak = 0
  const dates = [...new Set(logs.map(l => l.practiced_at.split('T')[0]))].sort().reverse()
  const checkDate = new Date()
  
  // Check if practiced today
  if (dates[0] === today) {
    current_streak = 1
    checkDate.setDate(checkDate.getDate() - 1)
    
    for (let i = 1; i < dates.length; i++) {
      const expectedDate = checkDate.toISOString().split('T')[0]
      if (dates[i] === expectedDate) {
        current_streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }
  }

  // Total practice days
  const total_practice_days = dates.length

  return {
    total_skills: skills.length,
    health_breakdown,
    decaying_skills,
    recent_activity,
    practiced_today,
    current_streak,
    total_practice_days,
  }
}

// Alerts
export function getAlerts(): Alert[] {
  const skills = getSkillsWithStats()
  return skills
    .filter(s => ['fair', 'rusty', 'critical'].includes(s.health))
    .map(s => ({
      skill_id: s.id,
      skill_name: s.name,
      icon: s.category_icon,
      type: 'decay',
      message: `${s.name} needs practice`,
      severity: s.health,
      days_since: s.days_since_practice ?? undefined,
    }))
    .sort((a, b) => {
      const priority = { critical: 0, rusty: 1, fair: 2 }
      return (priority[a.severity as keyof typeof priority] || 3) - 
             (priority[b.severity as keyof typeof priority] || 3)
    })
}

// History
export function getHistory(days: number = 30): HistoryData {
  const logs = getPracticeLogs()
  const skills = getSkillsWithStats()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  // Filter logs within date range
  const recentLogs = logs.filter(l => new Date(l.practiced_at) >= cutoff)

  // Daily stats
  const dailyMap = new Map<string, { sessions: number; skills: Set<number>; minutes: number; qualities: number[] }>()
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    dailyMap.set(dateStr, { sessions: 0, skills: new Set(), minutes: 0, qualities: [] })
  }

  recentLogs.forEach(log => {
    const dateStr = log.practiced_at.split('T')[0]
    const day = dailyMap.get(dateStr)
    if (day) {
      day.sessions++
      day.skills.add(log.skill_id)
      day.minutes += log.duration_minutes || 0
      if (log.quality) day.qualities.push(log.quality)
    }
  })

  const dailyStats = Array.from(dailyMap.entries()).map(([date, data]) => ({
    date,
    sessions: data.sessions,
    skills_practiced: data.skills.size,
    total_minutes: data.minutes,
    avg_quality: data.qualities.length 
      ? Math.round(data.qualities.reduce((a, b) => a + b, 0) / data.qualities.length * 10) / 10
      : 0,
  }))

  // Skill trends
  const skillTrends = skills.map(s => {
    const skillLogs = recentLogs.filter(l => l.skill_id === s.id)
    return {
      id: s.id,
      name: s.name,
      category_icon: s.category_icon,
      recent_sessions: skillLogs.length,
      last_practiced: s.last_practiced || '',
    }
  })

  return { dailyStats, skillTrends, days }
}

// Settings
export function getSettings(): Settings {
  return getItem(KEYS.SETTINGS, DEFAULT_SETTINGS)
}

export function saveSettings(settings: Settings): void {
  setItem(KEYS.SETTINGS, settings)
}

// Export/Import
export function exportAllData(): { skills: Skill[]; practice_logs: PracticeLog[]; settings: Settings; exported_at: string } {
  return {
    skills: getSkills(),
    practice_logs: getPracticeLogs(),
    settings: getSettings(),
    exported_at: new Date().toISOString(),
  }
}

export function importData(data: { skills?: Skill[]; practice_logs?: PracticeLog[]; settings?: Settings }, mode: 'merge' | 'replace'): { skills_imported: number } {
  if (mode === 'replace') {
    setItem(KEYS.SKILLS, [])
    setItem(KEYS.LOGS, [])
  }

  let skillsImported = 0

  if (data.skills) {
    const existing = mode === 'replace' ? [] : getSkills()
    const existingIds = new Set(existing.map(s => s.id))
    
    data.skills.forEach(skill => {
      if (!existingIds.has(skill.id)) {
        existing.push(skill)
        skillsImported++
      }
    })
    setItem(KEYS.SKILLS, existing)
  }

  if (data.practice_logs) {
    const existing = mode === 'replace' ? [] : getPracticeLogs()
    const existingIds = new Set(existing.map(l => l.id))
    
    data.practice_logs.forEach(log => {
      if (!existingIds.has(log.id)) {
        existing.push(log)
      }
    })
    setItem(KEYS.LOGS, existing)
  }

  if (data.settings) {
    saveSettings({ ...DEFAULT_SETTINGS, ...data.settings })
  }

  return { skills_imported: skillsImported }
}
