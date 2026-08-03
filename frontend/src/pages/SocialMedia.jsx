import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { toast } from '../components/Toast'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

// Facebook and Instagram both connect through a single Meta OAuth flow - the
// callback saves the Page and its linked Instagram Business account together.
const PLATFORMS = [
  { key: 'facebook',  label: 'Facebook',  icon: '📘', connectVia: 'meta' },
  { key: 'instagram', label: 'Instagram', icon: '📸', connectVia: 'meta' },
  { key: 'linkedin',  label: 'LinkedIn',  icon: '💼', connectVia: 'linkedin' },
]

const STATUS_BADGE = {
  posted:  { label: 'Posted',  bg: '#dcfce7', color: '#166534' },
  failed:  { label: 'Failed',  bg: '#fee2e2', color: '#991b1b' },
  pending: { label: 'Pending', bg: '#f3f4f6', color: '#6b7280' },
}

export default function SocialMedia() {
  const [accounts, setAccounts] = useState([])
  const [posts, setPosts] = useState([])
  const [content, setContent] = useState('')
  const [platforms, setPlatforms] = useState([])
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [posting, setPosting] = useState(false)
  const [connecting, setConnecting] = useState(null)
  const fileInput = useRef(null)
  const [params, setParams] = useSearchParams()

  const loadAccounts = useCallback(() => {
    api.getSocialAccounts().then(setAccounts).catch(e => toast(e.message, 'error'))
  }, [])
  const loadPosts = useCallback(() => {
    api.getSocialPosts().then(setPosts).catch(e => toast(e.message, 'error'))
  }, [])

  useEffect(() => { loadAccounts(); loadPosts() }, [loadAccounts, loadPosts])
  useAutoRefresh(loadPosts)

  useEffect(() => {
    const connected = params.get('connected')
    const error = params.get('error')
    if (connected) { toast(`Connected: ${connected}`); loadAccounts() }
    if (error) toast(error, 'error')
    if (connected || error) setParams({}, { replace: true })
  }, [params, setParams, loadAccounts])

  function connectedAccount(platformKey) {
    return accounts.find(a => a.platform === platformKey)
  }

  async function connect(platform) {
    setConnecting(platform.connectVia)
    try {
      const { url } = await api.getSocialConnectUrl(platform.connectVia)
      window.location.href = url
    } catch (e) {
      toast(e.message, 'error')
      setConnecting(null)
    }
  }

  async function disconnect(account) {
    if (!confirm(`Disconnect ${account.account_name || account.platform}?`)) return
    try { await api.disconnectSocial(account.id); toast('Disconnected'); loadAccounts() }
    catch (e) { toast(e.message, 'error') }
  }

  function togglePlatform(key) {
    setPlatforms(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key])
  }

  function pickImage(e) {
    const f = e.target.files?.[0]
    setImage(f || null)
    setImagePreview(f ? URL.createObjectURL(f) : null)
  }

  function clearImage() {
    setImage(null)
    setImagePreview(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function post() {
    if (!content.trim() && !image) { toast('Write something or add an image', 'error'); return }
    if (!platforms.length) { toast('Pick at least one platform', 'error'); return }
    setPosting(true)
    try {
      const res = await api.createSocialPost({ content, platforms, image })
      const failed = res.targets.filter(t => t.status === 'failed')
      if (failed.length === res.targets.length) toast('Post failed on all platforms', 'error')
      else if (failed.length) toast(`Posted, but failed on: ${failed.map(f => f.platform).join(', ')}`, 'error')
      else toast('Posted!')
      setContent(''); setPlatforms([]); clearImage()
      loadPosts()
    } catch (e) { toast(e.message, 'error') }
    finally { setPosting(false) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Social Media</h1>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>

          {/* Connected accounts */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Connected Accounts</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PLATFORMS.map(p => {
                const acc = connectedAccount(p.key)
                return (
                  <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--input)', borderRadius: 8 }}>
                    <span style={{ fontSize: 18 }}>{p.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {acc ? (acc.account_name || 'Connected') : 'Not connected'}
                      </div>
                    </div>
                    {acc ? (
                      <button className="btn btn-ghost btn-sm" onClick={() => disconnect(acc)}>Disconnect</button>
                    ) : (
                      <button className="btn btn-ghost btn-sm" disabled={connecting === p.connectVia} onClick={() => connect(p)}>
                        {connecting === p.connectVia ? 'Connecting…' : 'Connect'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Composer */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>New Post</div>
            <div className="field">
              <textarea className="input" rows={4} placeholder="What do you want to share?"
                value={content} onChange={e => setContent(e.target.value)} />
            </div>

            {imagePreview ? (
              <div style={{ position: 'relative', width: 140, marginBottom: 10 }}>
                <img src={imagePreview} alt="" style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 8 }} />
                <button className="btn btn-ghost btn-sm" onClick={clearImage}
                  style={{ position: 'absolute', top: 4, right: 4, padding: '2px 6px' }}>✕</button>
              </div>
            ) : (
              <div className="field">
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickImage} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
              {PLATFORMS.map(p => {
                const acc = connectedAccount(p.key)
                const active = platforms.includes(p.key)
                return (
                  <button key={p.key} type="button" disabled={!acc}
                    onClick={() => togglePlatform(p.key)}
                    className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`}
                    title={!acc ? `Connect ${p.label} first` : ''}>
                    {p.icon} {p.label}
                  </button>
                )
              })}
            </div>

            <button className="btn btn-primary" onClick={post} disabled={posting}>
              {posting ? 'Posting…' : 'Post Now'}
            </button>
          </div>

          {/* History */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: 13, padding: '14px 16px 0' }}>Recent Posts</div>
            {posts.length === 0 ? (
              <div className="empty"><span className="icon">📣</span>No posts yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {posts.map(post => (
                  <div key={post.id} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderTop: '1px solid var(--border-soft)' }}>
                    {post.image_path && (
                      <img src={`${api.uploadsUrl(post.image_path)}`} alt=""
                        style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, marginBottom: 6, whiteSpace: 'pre-wrap' }}>{post.content || <em style={{ color: 'var(--muted)' }}>No caption</em>}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {post.targets.map(t => {
                          const b = STATUS_BADGE[t.status] || STATUS_BADGE.pending
                          return (
                            <span key={t.id} title={t.error || ''} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: b.bg, color: b.color, fontWeight: 600 }}>
                              {t.platform} · {b.label}
                            </span>
                          )
                        })}
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{post.created_at}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
