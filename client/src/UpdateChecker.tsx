import { useState, useEffect } from 'react'

const GITHUB_REPO = 'rishi1508/skill-decay-tracker'
const CURRENT_VERSION = '1.4.0' // Update this with each release

interface Release {
  tag_name: string
  name: string
  html_url: string
  assets: { name: string; browser_download_url: string }[]
  published_at: string
}

export function UpdateChecker() {
  const [update, setUpdate] = useState<Release | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [, setChecking] = useState(false)

  useEffect(() => {
    // Check if we've dismissed this session
    const dismissedVersion = sessionStorage.getItem('dismissed-update')
    if (dismissedVersion) {
      setDismissed(true)
      return
    }

    checkForUpdates()
  }, [])

  const checkForUpdates = async () => {
    setChecking(true)
    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
      )
      
      if (!response.ok) return
      
      const release: Release = await response.json()
      const latestVersion = release.tag_name.replace('v', '')
      
      if (isNewerVersion(latestVersion, CURRENT_VERSION)) {
        setUpdate(release)
      }
    } catch (error) {
      console.log('Update check failed:', error)
    } finally {
      setChecking(false)
    }
  }

  const isNewerVersion = (latest: string, current: string): boolean => {
    const latestParts = latest.split('.').map(Number)
    const currentParts = current.split('.').map(Number)
    
    for (let i = 0; i < 3; i++) {
      const l = latestParts[i] || 0
      const c = currentParts[i] || 0
      if (l > c) return true
      if (l < c) return false
    }
    return false
  }

  const getApkUrl = (): string | null => {
    if (!update) return null
    const apk = update.assets.find(a => a.name.endsWith('.apk'))
    return apk?.browser_download_url || null
  }

  const dismiss = () => {
    setDismissed(true)
    if (update) {
      sessionStorage.setItem('dismissed-update', update.tag_name)
    }
  }

  if (dismissed || !update) return null

  const apkUrl = getApkUrl()

  return (
    <div className="update-banner">
      <div className="update-content">
        <div className="update-icon">🎉</div>
        <div className="update-text">
          <strong>New version available!</strong>
          <span>{update.tag_name}</span>
        </div>
      </div>
      <div className="update-actions">
        {apkUrl ? (
          <a 
            href={apkUrl} 
            className="update-download"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download APK
          </a>
        ) : (
          <a 
            href={update.html_url}
            className="update-download"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Release
          </a>
        )}
        <button className="update-dismiss" onClick={dismiss}>
          Later
        </button>
      </div>
    </div>
  )
}

// CSS to be added to App.css
export const updateCheckerStyles = `
.update-banner {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 32px);
  max-width: 448px;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 150;
  box-shadow: 0 4px 24px rgba(99, 102, 241, 0.4);
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.update-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.update-icon {
  font-size: 28px;
}

.update-text {
  display: flex;
  flex-direction: column;
}

.update-text strong {
  font-size: 15px;
}

.update-text span {
  font-size: 13px;
  opacity: 0.9;
}

.update-actions {
  display: flex;
  gap: 8px;
}

.update-download {
  flex: 1;
  padding: 10px 16px;
  background: white;
  color: #4f46e5;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
  transition: transform 0.2s;
}

.update-download:active {
  transform: scale(0.97);
}

.update-dismiss {
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.update-dismiss:hover {
  background: rgba(255, 255, 255, 0.3);
}
`
