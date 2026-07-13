const KEY = 'wm_theme'

export function getStoredTheme() {
  return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', t)
  localStorage.setItem(KEY, t)
}
