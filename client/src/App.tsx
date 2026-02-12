import { useState, useEffect, useRef } from 'react'
import type { TouchEvent } from 'react'
import './App.css'
import { UpdateChecker } from './UpdateChecker'
import * as storage from './storage'
import type { Category, SkillWithStats, Dashboard, Alert, HistoryData, Settings } from './storage'
import { 
  Brain, Home, BookOpen, TrendingUp, Settings as SettingsIcon, Plus,
  Flame, Zap, Target, Search, X, Edit2, Trash2, FileText,
  ChevronRight, Clock, BarChart3, Award,
  CheckCircle2, AlertCircle, AlertTriangle, XCircle, HelpCircle
} from 'lucide-react'

// Confetti component
const Confetti = ({ active }: { active: boolean }) => {
  if (!active) return null
  
  return (
    <div className="confetti-container">
      {[...Array(50)].map((_, i) => (
        <div 
          key={i} 
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 0.5}s`,
            backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9'][Math.floor(Math.random() * 6)]
          }}
        />
      ))}
    </div>
  )
}

// Skeleton loader component
const Skeleton = ({ width = '100%', height = '20px', rounded = false }: { width?: string, height?: string, rounded?: boolean }) => (
  <div 
    className={`skeleton ${rounded ? 'skeleton-rounded' : ''}`} 
    style={{ width, height }}
  />
)

// Skeleton card
const SkillCardSkeleton = () => (
  <div className="skill-card skeleton-card">
    <div className="skill-header">
      <Skeleton width="40px" height="40px" rounded />
      <Skeleton width="24px" height="24px" rounded />
    </div>
    <Skeleton width="70%" height="24px" />
    <div className="skill-meta" style={{ marginTop: 12 }}>
      <Skeleton width="40%" height="16px" />
      <Skeleton width="30%" height="16px" />
    </div>
    <Skeleton width="50%" height="14px" />
    <div className="skill-actions" style={{ marginTop: 16 }}>
      <Skeleton width="100%" height="36px" />
    </div>
  </div>
)

// Onboarding component
const Onboarding = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState(0)
  
  const steps = [
    {
      icon: '🧠',
      title: 'Track Your Skills',
      description: 'Add any skill you want to maintain - music, languages, coding, sports, anything!'
    },
    {
      icon: '⏱️',
      title: 'Smart Decay Algorithm',
      description: 'Each skill decays at different rates. Physical skills fade faster than knowledge.'
    },
    {
      icon: '🔥',
      title: 'Build Streaks',
      description: 'Practice daily to build streaks. Never let your skills rust away!'
    },
    {
      icon: '📈',
      title: 'Track Progress',
      description: 'See your practice history, trends, and celebrate your growth.'
    }
  ]

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-icon">{steps[step].icon}</div>
        <h2>{steps[step].title}</h2>
        <p>{steps[step].description}</p>
        
        <div className="onboarding-dots">
          {steps.map((_, i) => (
            <div key={i} className={`dot ${i === step ? 'active' : ''}`} />
          ))}
        </div>
        
        <div className="onboarding-actions">
          {step > 0 && (
            <button className="secondary" onClick={() => setStep(step - 1)}>Back</button>
          )}
          {step < steps.length - 1 ? (
            <button className="primary" onClick={() => setStep(step + 1)}>Next</button>
          ) : (
            <button className="primary" onClick={onComplete}>Get Started</button>
          )}
        </div>
      </div>
    </div>
  )
}

type SortOption = 'name' | 'health' | 'lastPracticed' | 'category'
type ViewType = 'dashboard' | 'skills' | 'progress' | 'settings'

function App() {
  const [view, setView] = useState<ViewType>('dashboard')
  const [skills, setSkills] = useState<SkillWithStats[]>([])
  const [categories] = useState<Category[]>(storage.getCategories())
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [history, setHistory] = useState<HistoryData | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<SkillWithStats | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPracticeModal, setShowPracticeModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingSkill, setEditingSkill] = useState<SkillWithStats | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('health')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [settings, setSettings] = useState<Settings>(storage.DEFAULT_SETTINGS)
  const [, setCurrentTheme] = useState<'dark' | 'light'>('dark')
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [swipedSkillId, setSwipedSkillId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pullStartY = useRef<number>(0)
  const mainRef = useRef<HTMLElement>(null)

  // Form state
  const [newSkill, setNewSkill] = useState({
    name: '',
    category: 'other',
    decay_rate: 1.0,
    target_frequency_days: 7,
    notes: ''
  })

  const [practiceLog, setPracticeLog] = useState({
    duration_minutes: 30,
    quality: 3,
    notes: ''
  })

  // Toast helper with haptic
  const showToast = (message: string, celebrate = false) => {
    setToast(message)
    if (celebrate) {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 30, 50])
      }
    }
    setTimeout(() => setToast(null), 3000)
  }

  // Load all data from localStorage
  const loadData = () => {
    try {
      const loadedSettings = storage.getSettings()
      setSettings(loadedSettings)
      setSkills(storage.getSkillsWithStats())
      setDashboard(storage.getDashboard())
      setAlerts(storage.getAlerts())
      setHistory(storage.getHistory(30))
      
      if (loadedSettings.showOnboarding) {
        setShowOnboarding(true)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial load - no delay needed for localStorage
  useEffect(() => {
    loadData()
  }, [])

  // Refresh all data
  const refreshAll = () => {
    setSkills(storage.getSkillsWithStats())
    setDashboard(storage.getDashboard())
    setAlerts(storage.getAlerts())
    setHistory(storage.getHistory(30))
  }

  // Save settings
  const saveSettings = (newSettings: Settings) => {
    storage.saveSettings(newSettings)
    setSettings(newSettings)
  }

  // Complete onboarding
  const completeOnboarding = () => {
    setShowOnboarding(false)
    saveSettings({ ...settings, showOnboarding: false })
  }

  // Theme handling
  useEffect(() => {
    const updateTheme = () => {
      let theme: 'dark' | 'light' = 'dark'
      
      if (settings.theme === 'auto') {
        const now = new Date()
        const currentTime = now.getHours() * 60 + now.getMinutes()
        const [lightH, lightM] = settings.autoThemeLight.split(':').map(Number)
        const [darkH, darkM] = settings.autoThemeDark.split(':').map(Number)
        const lightTime = lightH * 60 + lightM
        const darkTime = darkH * 60 + darkM
        
        if (lightTime < darkTime) {
          theme = currentTime >= lightTime && currentTime < darkTime ? 'light' : 'dark'
        } else {
          theme = currentTime >= lightTime || currentTime < darkTime ? 'light' : 'dark'
        }
      } else {
        theme = settings.theme
      }
      
      setCurrentTheme(theme)
      document.documentElement.setAttribute('data-theme', theme)
    }

    updateTheme()
    const interval = setInterval(updateTheme, 60000)
    return () => clearInterval(interval)
  }, [settings.theme, settings.autoThemeLight, settings.autoThemeDark])

  // Pull to refresh
  const handleTouchStart = (e: TouchEvent) => {
    if (mainRef.current?.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (pullStartY.current > 0 && mainRef.current?.scrollTop === 0) {
      const pullDistance = e.touches[0].clientY - pullStartY.current
      if (pullDistance > 80 && !refreshing) {
        setRefreshing(true)
        setTimeout(() => {
          refreshAll()
          setRefreshing(false)
          pullStartY.current = 0
        }, 300)
      }
    }
  }

  const handleTouchEnd = () => {
    pullStartY.current = 0
  }

  // Swipe gesture for skill cards
  const touchStartX = useRef<number>(0)
  
  const handleSkillTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleSkillTouchEnd = (e: TouchEvent, skill: SkillWithStats) => {
    const touchEndX = e.changedTouches[0].clientX
    const diff = touchStartX.current - touchEndX
    
    if (diff > 80) {
      setSwipedSkillId(skill.id)
      setTimeout(() => {
        doQuickPractice(skill.id)
        setSwipedSkillId(null)
      }, 200)
    } else if (diff < -80) {
      setSelectedSkill(skill)
      setShowPracticeModal(true)
    }
  }

  // Add skill
  const addSkill = () => {
    if (!newSkill.name.trim()) return
    storage.addSkill({
      name: newSkill.name,
      category: newSkill.category,
      decay_rate: newSkill.decay_rate,
      target_frequency_days: newSkill.target_frequency_days,
      notes: newSkill.notes || null,
    })
    setNewSkill({ 
      name: '', 
      category: 'other', 
      decay_rate: 1.0, 
      target_frequency_days: settings.defaultTargetFrequency, 
      notes: '' 
    })
    setShowAddModal(false)
    refreshAll()
    showToast('Skill added')
  }

  // Update skill
  const updateSkill = () => {
    if (!editingSkill) return
    storage.updateSkill(editingSkill.id, {
      name: editingSkill.name,
      category: editingSkill.category,
      decay_rate: editingSkill.decay_rate,
      target_frequency_days: editingSkill.target_frequency_days,
      notes: editingSkill.notes,
    })
    setShowEditModal(false)
    setEditingSkill(null)
    refreshAll()
    showToast('Skill updated')
  }

  const openEditModal = (skill: SkillWithStats) => {
    setEditingSkill({ ...skill })
    setShowEditModal(true)
  }

  // Quick practice
  const doQuickPractice = (skillId: number) => {
    storage.quickPractice(skillId)
    refreshAll()
    
    const newDashboard = storage.getDashboard()
    if (newDashboard.current_streak > 0 && newDashboard.current_streak % 7 === 0) {
      showToast(`${newDashboard.current_streak} day streak! Amazing!`, true)
    } else {
      showToast('Practice logged')
    }
  }

  // Log practice with details
  const logPractice = () => {
    if (!selectedSkill) return
    storage.addPracticeLog({
      skill_id: selectedSkill.id,
      duration_minutes: practiceLog.duration_minutes,
      quality: practiceLog.quality,
      notes: practiceLog.notes || null,
    })
    setPracticeLog({ duration_minutes: 30, quality: 3, notes: '' })
    setShowPracticeModal(false)
    setSelectedSkill(null)
    refreshAll()
    showToast('Practice session logged', true)
  }

  // Delete skill
  const deleteSkill = (skillId: number) => {
    if (!confirm('Delete this skill and all practice history?')) return
    storage.deleteSkill(skillId)
    refreshAll()
    showToast('Skill deleted')
  }

  // Export data
  const exportData = () => {
    const data = storage.exportAllData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `skill-tracker-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Backup downloaded')
  }

  // Import data
  const importData = async (file: File, mode: 'merge' | 'replace') => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const result = storage.importData(data, mode)
      showToast(`Imported ${result.skills_imported} skills! ✅`, true)
      setShowImportModal(false)
      refreshAll()
    } catch {
      showToast('Import failed: Invalid file')
    }
  }

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'excellent': return <CheckCircle2 size={16} className="health-icon excellent" />
      case 'good': return <CheckCircle2 size={16} className="health-icon good" />
      case 'fair': return <AlertCircle size={16} className="health-icon fair" />
      case 'rusty': return <AlertTriangle size={16} className="health-icon rusty" />
      case 'critical': return <XCircle size={16} className="health-icon critical" />
      default: return <HelpCircle size={16} className="health-icon unknown" />
    }
  }

  const getHealthPriority = (health: string) => {
    switch (health) {
      case 'critical': return 0
      case 'rusty': return 1
      case 'fair': return 2
      case 'unknown': return 3
      case 'good': return 4
      case 'excellent': return 5
      default: return 6
    }
  }

  const filteredAndSortedSkills = skills
    .filter(skill => {
      const matchesSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.category_name?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = filterCategory === 'all' || skill.category === filterCategory
      return matchesSearch && matchesCategory
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'health':
          return getHealthPriority(a.health) - getHealthPriority(b.health)
        case 'lastPracticed':
          if (a.days_since_practice === null) return 1
          if (b.days_since_practice === null) return -1
          return b.days_since_practice - a.days_since_practice
        case 'category':
          return (a.category_name || '').localeCompare(b.category_name || '')
        default:
          return 0
      }
    })

  const formatDaysAgo = (days: number | null) => {
    if (days === null) return 'Never practiced'
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return `${days}d ago`
  }

  // Health ring component
  const HealthRing = ({ value, max, size = 80 }: { value: number, max: number, size?: number }) => {
    const percentage = Math.min((value / max) * 100, 100)
    const strokeWidth = size * 0.1
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (percentage / 100) * circumference
    
    const getColor = () => {
      if (percentage >= 80) return '#22c55e'
      if (percentage >= 60) return '#84cc16'
      if (percentage >= 40) return '#eab308'
      if (percentage >= 20) return '#f97316'
      return '#ef4444'
    }

    return (
      <svg width={size} height={size} className="health-ring">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-card)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="health-ring-progress"
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dy="0.35em"
          className="health-ring-text"
          fill="var(--text-primary)"
          fontSize={size * 0.25}
          fontWeight="bold"
        >
          {Math.round(percentage)}%
        </text>
      </svg>
    )
  }

  // Sparkline chart
  const Sparkline = ({ data, height = 60, color = '#3b82f6' }: { data: number[], height?: number, color?: string }) => {
    if (data.length < 2) return <div className="sparkline-empty">No data yet</div>
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    const width = 100
    
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - 8 - ((v - min) / range) * (height - 16)
      return `${x},${y}`
    }).join(' ')

    const areaPoints = `0,${height} ${points} ${width},${height}`
    
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="sparkline" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkline-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          fill="url(#sparkline-gradient)"
          points={areaPoints}
        />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    )
  }

  // Calculate overall health percentage
  const getOverallHealth = () => {
    if (!dashboard || dashboard.total_skills === 0) return 0
    const { health_breakdown, total_skills } = dashboard
    const score = (
      health_breakdown.excellent * 100 +
      health_breakdown.good * 80 +
      health_breakdown.fair * 60 +
      health_breakdown.rusty * 30 +
      health_breakdown.critical * 10
    ) / total_skills
    return Math.round(score)
  }

  if (showOnboarding) {
    return <Onboarding onComplete={completeOnboarding} />
  }

  return (
    <div className="app">
      <Confetti active={showConfetti} />
      <UpdateChecker />
      
      {refreshing && (
        <div className="refresh-indicator">
          <div className="refresh-spinner" />
        </div>
      )}

      <header className="header">
        <div className="header-left">
          <Brain size={28} className="header-logo" />
        </div>
        <div className="header-center">
          <span className="header-title">Skill Decay</span>
        </div>
        <div className="header-right">
          {/* Theme toggle moved to Settings */}
        </div>
      </header>

      <main 
        className="main" 
        ref={mainRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading ? (
          <div className="loading-state">
            <div className="card">
              <div className="stats-grid">
                {[1,2,3,4].map(i => (
                  <div key={i} className="stat-item">
                    <Skeleton width="48px" height="48px" rounded />
                    <Skeleton width="40px" height="24px" />
                    <Skeleton width="60px" height="14px" />
                  </div>
                ))}
              </div>
            </div>
            <div className="skills-grid">
              {[1,2,3,4].map(i => <SkillCardSkeleton key={i} />)}
            </div>
          </div>
        ) : (
          <>
            {view === 'dashboard' && dashboard && (
              <div className="dashboard fade-in">
                <section className="hero-card">
                  <div className="hero-left">
                    <HealthRing value={getOverallHealth()} max={100} size={100} />
                    <span className="hero-label">Overall Health</span>
                  </div>
                  <div className="hero-right">
                    <div className="hero-stat">
                      <span className="hero-number">{dashboard.current_streak}</span>
                      <span className="hero-text"><Flame size={14} className="inline-icon" /> Day Streak</span>
                    </div>
                    <div className="hero-stat">
                      <span className="hero-number">{dashboard.total_skills}</span>
                      <span className="hero-text"><BookOpen size={14} className="inline-icon" /> Skills</span>
                    </div>
                    <div className="hero-stat">
                      <span className={`hero-badge ${dashboard.practiced_today ? 'success' : 'warning'}`}>
                        {dashboard.practiced_today ? <><CheckCircle2 size={12} /> Done</> : <><Clock size={12} /> Pending</>}
                      </span>
                      <span className="hero-text">Today</span>
                    </div>
                  </div>
                </section>

                {alerts.length > 0 && (
                  <section className="quick-actions">
                    <h3><Zap size={18} className="section-icon" /> Quick Practice</h3>
                    <div className="quick-actions-scroll">
                      {alerts.slice(0, 5).map((alert) => (
                        <button 
                          key={alert.skill_id}
                          className={`quick-action-chip ${alert.severity}`}
                          onClick={() => doQuickPractice(alert.skill_id)}
                        >
                          <span className="chip-icon">{alert.icon}</span>
                          <span className="chip-name">{alert.skill_name}</span>
                          {alert.days_since && <span className="chip-days">{alert.days_since}d</span>}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <section className="card glass">
                  <h3>Health Overview</h3>
                  <div className="health-grid">
                    {[
                      { key: 'excellent', label: 'Excellent', color: '#22c55e' },
                      { key: 'good', label: 'Good', color: '#84cc16' },
                      { key: 'fair', label: 'Fair', color: '#eab308' },
                      { key: 'rusty', label: 'Rusty', color: '#f97316' },
                      { key: 'critical', label: 'Critical', color: '#ef4444' }
                    ].map(({ key, label, color }) => (
                      <div key={key} className="health-item">
                        <div className="health-count" style={{ color }}>
                          {dashboard.health_breakdown[key as keyof typeof dashboard.health_breakdown]}
                        </div>
                        <div className="health-label">
                          <span className="health-dot" style={{ backgroundColor: color }} />
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {history && history.dailyStats.length > 0 && (
                  <section className="card glass">
                    <h3><BarChart3 size={18} className="section-icon" /> Activity (30 days)</h3>
                    <div className="chart-wrapper">
                      <Sparkline 
                        data={history.dailyStats.map(d => d.sessions)} 
                        height={80}
                        color="#3b82f6"
                      />
                    </div>
                    <div className="chart-summary">
                      <span>{history.dailyStats.reduce((sum, d) => sum + d.sessions, 0)} sessions</span>
                      <span>•</span>
                      <span>{history.dailyStats.filter(d => d.sessions > 0).length} active days</span>
                    </div>
                  </section>
                )}

                {dashboard.decaying_skills.length > 0 && (
                  <section className="card glass warning-card">
                    <h3><AlertTriangle size={18} className="section-icon warning" /> Needs Attention</h3>
                    <ul className="decay-list">
                      {dashboard.decaying_skills.slice(0, 3).map(skill => (
                        <li key={skill.id} className="decay-item" onClick={() => doQuickPractice(skill.id)}>
                          <span className="decay-icon">{skill.category_icon}</span>
                          <span className="decay-name">{skill.name}</span>
                          <span className="decay-days">{skill.days_since_practice}d</span>
                          <ChevronRight size={16} className="decay-arrow" />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}

            {view === 'skills' && (
              <div className="skills-view fade-in">
                <div className="search-bar">
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search skills..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button className="clear-search" onClick={() => setSearchQuery('')}><X size={14} /></button>
                  )}
                </div>

                <div className="filter-row">
                  <select 
                    value={sortBy} 
                    onChange={e => setSortBy(e.target.value as SortOption)}
                  >
                    <option value="health">Health ↓</option>
                    <option value="name">Name A-Z</option>
                    <option value="lastPracticed">Last Used</option>
                    <option value="category">Category</option>
                  </select>
                  <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                  >
                    <option value="all">All</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>

                <p className="swipe-hint">← Swipe left to practice, right for details →</p>

                <div className="skills-grid">
                  {filteredAndSortedSkills.map(skill => (
                    <div 
                      key={skill.id} 
                      className={`skill-card glass ${skill.health} ${swipedSkillId === skill.id ? 'swiped' : ''}`}
                      onTouchStart={handleSkillTouchStart}
                      onTouchEnd={(e) => handleSkillTouchEnd(e, skill)}
                    >
                      <div className="skill-header">
                        <div className="skill-icon-wrapper">
                          <span className="skill-category-icon">{skill.category_icon}</span>
                        </div>
                        <span className={`health-badge ${skill.health}`}>
                          {getHealthIcon(skill.health)}
                        </span>
                      </div>
                      
                      <h3 className="skill-name">{skill.name}</h3>
                      
                      <div className="skill-info">
                        <span className="skill-category">{skill.category_name}</span>
                        <span className="skill-last">{formatDaysAgo(skill.days_since_practice)}</span>
                      </div>
                      
                      {skill.total_sessions > 0 && (
                        <div className="skill-progress">
                          <div 
                            className="skill-progress-bar" 
                            style={{ 
                              width: `${Math.min(skill.total_sessions * 5, 100)}%`,
                              backgroundColor: skill.health_color 
                            }} 
                          />
                        </div>
                      )}
                      
                      <div className="skill-actions">
                        <button 
                          className="btn-primary"
                          onClick={(e) => {
                            e.stopPropagation()
                            doQuickPractice(skill.id)
                          }}
                        >
                          <Zap size={14} /> Practice
                        </button>
                        <button 
                          className="btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedSkill(skill)
                            setShowPracticeModal(true)
                          }}
                        >
                          <FileText size={16} />
                        </button>
                        <button 
                          className="btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditModal(skill)
                          }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className="btn-danger"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteSkill(skill.id)
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {skills.length === 0 && (
                  <div className="empty-state">
                    <Target size={48} className="empty-icon" />
                    <h2>No skills yet</h2>
                    <p>Add your first skill to start tracking!</p>
                    <button className="btn-primary large" onClick={() => setShowAddModal(true)}>
                      <Plus size={16} /> Add Skill
                    </button>
                  </div>
                )}

                {skills.length > 0 && filteredAndSortedSkills.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">🔍</div>
                    <h2>No matches</h2>
                    <p>Try a different search or filter</p>
                  </div>
                )}
              </div>
            )}

            {view === 'progress' && (
              <div className="progress-view fade-in">
                <section className="card glass">
                  <h3><BarChart3 size={18} className="section-icon" /> 30-Day Summary</h3>
                  {history && history.dailyStats.length > 0 ? (
                    <>
                      <div className="chart-wrapper large">
                        <Sparkline 
                          data={history.dailyStats.map(d => d.sessions)} 
                          height={120}
                          color="#3b82f6"
                        />
                      </div>
                      <div className="stats-row">
                        <div className="stat-box">
                          <span className="stat-number">{history.dailyStats.reduce((sum, d) => sum + d.sessions, 0)}</span>
                          <span className="stat-label">Sessions</span>
                        </div>
                        <div className="stat-box">
                          <span className="stat-number">{history.dailyStats.reduce((sum, d) => sum + (d.total_minutes || 0), 0)}</span>
                          <span className="stat-label">Minutes</span>
                        </div>
                        <div className="stat-box">
                          <span className="stat-number">{history.dailyStats.filter(d => d.sessions > 0).length}</span>
                          <span className="stat-label">Active Days</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="empty-mini">Start practicing to see your progress!</div>
                  )}
                </section>

                <section className="card glass">
                  <h3><Award size={18} className="section-icon" /> Most Practiced</h3>
                  {history && history.skillTrends.length > 0 ? (
                    <ul className="trends-list">
                      {history.skillTrends
                        .filter(s => s.recent_sessions > 0)
                        .sort((a, b) => b.recent_sessions - a.recent_sessions)
                        .slice(0, 5)
                        .map((skill, i) => (
                          <li key={skill.id} className="trend-item">
                            <span className="trend-rank">#{i + 1}</span>
                            <span className="trend-icon">{skill.category_icon}</span>
                            <span className="trend-name">{skill.name}</span>
                            <span className="trend-count">{skill.recent_sessions}×</span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <div className="empty-mini">No practice data yet</div>
                  )}
                </section>
              </div>
            )}

            {view === 'settings' && (
              <div className="settings-view fade-in">
                <section className="card glass">
                  <h3>🎨 Appearance</h3>
                  <div className="setting-item">
                    <span>Theme</span>
                    <select
                      value={settings.theme}
                      onChange={e => saveSettings({ ...settings, theme: e.target.value as 'dark' | 'light' | 'auto' })}
                    >
                      <option value="dark">🌙 Dark</option>
                      <option value="light">☀️ Light</option>
                      <option value="auto">🌓 Auto</option>
                    </select>
                  </div>
                  {settings.theme === 'auto' && (
                    <>
                      <div className="setting-item">
                        <span>Light starts</span>
                        <input
                          type="time"
                          value={settings.autoThemeLight}
                          onChange={e => saveSettings({ ...settings, autoThemeLight: e.target.value })}
                        />
                      </div>
                      <div className="setting-item">
                        <span>Dark starts</span>
                        <input
                          type="time"
                          value={settings.autoThemeDark}
                          onChange={e => saveSettings({ ...settings, autoThemeDark: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                </section>

                <section className="card glass">
                  <h3>⚙️ Defaults</h3>
                  <div className="setting-item">
                    <span>Practice frequency (days)</span>
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={settings.defaultTargetFrequency}
                      onChange={e => saveSettings({ ...settings, defaultTargetFrequency: parseInt(e.target.value) || 7 })}
                    />
                  </div>
                </section>

                <section className="card glass">
                  <h3>💾 Data</h3>
                  <div className="setting-buttons">
                    <button className="btn-primary" onClick={exportData}>
                      📥 Export Backup
                    </button>
                    <button className="btn-secondary" onClick={() => setShowImportModal(true)}>
                      📤 Import Data
                    </button>
                  </div>
                </section>

                <section className="card glass">
                  <h3>ℹ️ About</h3>
                  <p className="about-text">
                    Skill Decay Tracker v1.3.0<br/>
                    Built by Zenith<br/>
                    <small>Now works offline! 📱</small>
                  </p>
                  <button 
                    className="btn-text"
                    onClick={() => {
                      saveSettings({ ...settings, showOnboarding: true })
                      setShowOnboarding(true)
                    }}
                  >
                    View Tutorial
                  </button>
                </section>
              </div>
            )}
          </>
        )}
      </main>

      <nav className="bottom-nav">
        <button 
          className={view === 'dashboard' ? 'active' : ''} 
          onClick={() => setView('dashboard')}
        >
          <Home size={22} />
          <span className="nav-label">Home</span>
        </button>
        <button 
          className={view === 'skills' ? 'active' : ''} 
          onClick={() => setView('skills')}
        >
          <BookOpen size={22} />
          <span className="nav-label">Skills</span>
        </button>
        <button 
          className="fab"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={24} />
        </button>
        <button 
          className={view === 'progress' ? 'active' : ''} 
          onClick={() => setView('progress')}
        >
          <TrendingUp size={22} />
          <span className="nav-label">Progress</span>
        </button>
        <button 
          className={view === 'settings' ? 'active' : ''} 
          onClick={() => setView('settings')}
        >
          <SettingsIcon size={22} />
          <span className="nav-label">Settings</span>
        </button>
      </nav>

      {toast && (
        <div className="toast slide-up">{toast}</div>
      )}

      {/* Add Skill Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Skill</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}><X size={18} /></button>
            </div>
            
            <div className="form-group">
              <label>Skill Name</label>
              <input
                type="text"
                value={newSkill.name}
                onChange={e => setNewSkill({ ...newSkill, name: e.target.value })}
                placeholder="e.g., Guitar, Spanish, Chess..."
                autoFocus
              />
            </div>
            
            <div className="form-group">
              <label>Category</label>
              <div className="category-grid">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    className={`category-btn ${newSkill.category === cat.id ? 'selected' : ''}`}
                    onClick={() => setNewSkill({ 
                      ...newSkill, 
                      category: cat.id,
                      decay_rate: cat.default_decay_rate
                    })}
                  >
                    <span className="cat-icon">{cat.icon}</span>
                    <span className="cat-name">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="form-group">
              <label>Practice every {newSkill.target_frequency_days} days</label>
              <input
                type="range"
                value={newSkill.target_frequency_days}
                onChange={e => setNewSkill({ ...newSkill, target_frequency_days: parseInt(e.target.value) })}
                min="1"
                max="30"
              />
              <div className="range-labels">
                <span>Daily</span>
                <span>Monthly</span>
              </div>
            </div>

            <button className="btn-primary large full-width" onClick={addSkill}>
              Add Skill
            </button>
          </div>
        </div>
      )}

      {/* Practice Modal */}
      {showPracticeModal && selectedSkill && (
        <div className="modal-overlay" onClick={() => setShowPracticeModal(false)}>
          <div className="modal slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Log Practice</h2>
              <button className="close-btn" onClick={() => setShowPracticeModal(false)}><X size={18} /></button>
            </div>
            
            <div className="practice-skill-info">
              <span className="practice-icon">{selectedSkill.category_icon}</span>
              <span className="practice-name">{selectedSkill.name}</span>
            </div>

            <div className="form-group">
              <label>Duration: {practiceLog.duration_minutes} min</label>
              <input
                type="range"
                value={practiceLog.duration_minutes}
                onChange={e => setPracticeLog({ ...practiceLog, duration_minutes: parseInt(e.target.value) })}
                min="5"
                max="180"
                step="5"
              />
              <div className="range-labels">
                <span>5 min</span>
                <span>3 hrs</span>
              </div>
            </div>

            <div className="form-group">
              <label>How was it?</label>
              <div className="quality-selector">
                {['😞', '😕', '😐', '🙂', '😄'].map((emoji, i) => (
                  <button
                    key={i}
                    className={`quality-btn ${practiceLog.quality === i + 1 ? 'selected' : ''}`}
                    onClick={() => setPracticeLog({ ...practiceLog, quality: i + 1 })}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea
                value={practiceLog.notes}
                onChange={e => setPracticeLog({ ...practiceLog, notes: e.target.value })}
                placeholder="What did you work on?"
                rows={3}
              />
            </div>

            <button className="btn-primary large full-width" onClick={logPractice}>
              Save Practice
            </button>
          </div>
        </div>
      )}

      {/* Edit Skill Modal */}
      {showEditModal && editingSkill && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Skill</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}><X size={18} /></button>
            </div>
            
            <div className="form-group">
              <label>Skill Name</label>
              <input
                type="text"
                value={editingSkill.name}
                onChange={e => setEditingSkill({ ...editingSkill, name: e.target.value })}
                placeholder="e.g., Guitar, Spanish, Chess..."
              />
            </div>
            
            <div className="form-group">
              <label>Category</label>
              <div className="category-grid">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    className={`category-btn ${editingSkill.category === cat.id ? 'selected' : ''}`}
                    onClick={() => setEditingSkill({ 
                      ...editingSkill, 
                      category: cat.id,
                      decay_rate: cat.default_decay_rate
                    })}
                  >
                    <span className="cat-icon">{cat.icon}</span>
                    <span className="cat-name">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="form-group">
              <label>Practice every {editingSkill.target_frequency_days} days</label>
              <input
                type="range"
                value={editingSkill.target_frequency_days}
                onChange={e => setEditingSkill({ ...editingSkill, target_frequency_days: parseInt(e.target.value) })}
                min="1"
                max="30"
              />
              <div className="range-labels">
                <span>Daily</span>
                <span>Monthly</span>
              </div>
            </div>

            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea
                value={editingSkill.notes || ''}
                onChange={e => setEditingSkill({ ...editingSkill, notes: e.target.value })}
                placeholder="Any notes about this skill..."
                rows={3}
              />
            </div>

            <button className="btn-primary large full-width" onClick={updateSkill}>
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal slide-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Import Data</h2>
              <button className="close-btn" onClick={() => setShowImportModal(false)}><X size={18} /></button>
            </div>
            
            <p className="modal-text">Choose how to handle existing data:</p>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) {
                  const mode = (document.querySelector('input[name="importMode"]:checked') as HTMLInputElement)?.value as 'merge' | 'replace'
                  importData(file, mode || 'merge')
                }
              }}
            />
            
            <div className="import-options">
              <label className="radio-option">
                <input type="radio" name="importMode" value="merge" defaultChecked />
                <span className="radio-label">
                  <strong>Merge</strong>
                  <small>Keep existing, add new</small>
                </span>
              </label>
              <label className="radio-option">
                <input type="radio" name="importMode" value="replace" />
                <span className="radio-label">
                  <strong>Replace</strong>
                  <small>Delete all existing data</small>
                </span>
              </label>
            </div>

            <button className="btn-primary large full-width" onClick={() => fileInputRef.current?.click()}>
              Select File
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
