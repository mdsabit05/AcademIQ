import { useNavigate } from 'react-router-dom'
import { useAuth, useClerk } from '../lib/auth.ts'
import heroBgUrl from '../assets/hero-bg.png'
import lightLandingUrl from '../assets/lightLanding.png'
import academiqLogoUrl from '../assets/academiq-logo-transparent.svg'
import { useEffect, useRef, useState } from 'react'
import {
  BookOpen, MessageSquare, FileText, BarChart2, ArrowRight,
  CheckCircle, Brain, Upload, Zap, Target, Heart,
  Moon, Sun, Bell, Search, Home, TrendingUp, Users, Clock, Calendar, Sparkles,
} from 'lucide-react'

// ── Scroll reveal hook ─────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1'
          el.style.transform = 'translateY(0)'
          el.style.filter = 'blur(0)'
          obs.disconnect()
        }
      },
      { threshold: 0.12 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

// ── Constants ──────────────────────────────────────────────────────────────────

const NAV_LINKS = ['Home', 'Features', 'How It Works', 'For Educators', 'Pricing', 'FAQ']

const STATS = [
  { icon: Users,    value: '10K+', label: 'Active Learners',   },
  { icon: BookOpen, value: '500+', label: 'Books & Resources', },
  { icon: BarChart2,value: '95%',  label: 'Positive Feedback', },
  { icon: Clock,    value: '24/7', label: 'AI Support',        },
]

const FEATURES = [
  {
    icon: BookOpen,
    label: 'Upload Books',
    sub: 'Upload your PDFs and instantly convert them into interactive learning material.',
    color: '#22C55E',
  },
  {
    icon: MessageSquare,
    label: 'AI Tutor',
    sub: 'Get instant, accurate answers to your questions from your own study material.',
    color: '#22D3EE',
  },
  {
    icon: FileText,
    label: 'Take a Test',
    sub: 'Practice with chapter-wise and full-length tests.',
    color: '#EF4444',
  },
  {
    icon: Calendar,
    label: 'Study Plan',
    sub: 'Plan your learning journey and stay consistent.',
    color: '#F59E0B',
  },
]

const WHY_CARDS = [
  { icon: Zap,       label: 'Save Time',      sub: 'Get quick answers and summaries from your own books.',   color: '#A855F7' },
  { icon: Target,    label: 'Learn Better',   sub: 'Practice with real tests and track your understanding.', color: '#22C55E' },
  { icon: BarChart2, label: 'Stay Organized', sub: 'Keep all your study material in one place.',             color: '#F59E0B' },
  { icon: Heart,     label: 'Achieve More',   sub: 'Build consistent habits and reach your academic goals.', color: '#22D3EE' },
]

const FOOTER_LINKS = {
  Product:  ['Features', 'Pricing', 'FAQ', 'Changelog'],
  Company:  ['About Us', 'Careers', 'Blog', 'Contact'],
  Legal:    ['Privacy Policy', 'Terms of Service', 'Cookie Policy'],
}

// ── Dashboard Preview (matches frD.png) ───────────────────────────────────────
function DashboardPreview() {
  const CYAN = '#22D3EE'
  const BG   = '#080c14'
  const SIDE = '#0e1420'

  const sideItems = [
    { icon: Home,          label: 'Dashboard',      active: true  },
    { icon: BookOpen,      label: 'My Books'                      },
    { icon: MessageSquare, label: 'AI Tutor'                      },
    { icon: FileText,      label: 'Tests'                         },
    { icon: BarChart2,     label: 'Progress'                      },
    { icon: TrendingUp,    label: 'Study Plan'                    },
    { icon: BookOpen,      label: 'Syllabus'                      },
    { icon: Brain,         label: 'Memory'                        },
    { icon: Zap,           label: 'General AI'                    },
  ]
  const subjects = [
    { name: 'Database Management Systems', pct: 78, color: CYAN      },
    { name: 'Operating Systems',           pct: 62, color: '#A855F7' },
    { name: 'Computer Networks',           pct: 35, color: '#F59E0B' },
    { name: 'Discrete Mathematics',        pct: 48, color: '#22C55E' },
  ]
  const quickCards = [
    { icon: BookOpen,      label: 'Upload Book',  sub: 'Add PDF & start learning', color: '#22C55E' },
    { icon: Sparkles,      label: 'AI Tutor',     sub: 'Get instant, accurate answers', color: CYAN },
    { icon: FileText,      label: 'Take a Test',  sub: 'Practice & evaluate',     color: '#EF4444' },
    { icon: Calendar,      label: 'Study Plan',   sub: 'Plan your learning journey', color: '#F59E0B'},
  ]
  const tests = [
    { name: 'DBMS – Unit 2',              meta: '20 Questions · 30 mins', date: '12 Sep', color: '#EF4444' },
    { name: 'Operating Systems – Unit 1', meta: '20 Questions · 30 mins', date: '15 Sep', color: '#2563EB' },
    { name: 'Computer Networks – Full',   meta: '50 Questions · 60 mins', date: '18 Sep', color: '#F59E0B' },
  ]
  const activity = [
    { icon: BookOpen,   label: 'Read Chapter 3 – ER Model',    sub: 'DBMS · 2 hours ago',       color: '#22C55E' },
    { icon: CheckCircle,label: 'Completed Quiz – Normalization',sub: 'Score: 8/10 · 5 hours ago', color: CYAN    },
    { icon: MessageSquare,label:'Asked a question in AI Tutor', sub: '"Explain BCNF" · 1 day ago', color:'#A855F7'},
    { icon: Upload,     label: 'Uploaded a new book',          sub: 'Operating Systems.pdf · 2d', color:'#F59E0B'},
  ]

  return (
    <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.10)', background: BG, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', maxHeight: '74vh' }}>

      {/* ── Topbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.07)', background: SIDE, padding: '5px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, width: 80 }}>
          <img src={academiqLogoUrl} style={{ height: 20, width: 'auto', objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 5, padding: '3px 7px' }}>
          <Search size={6} style={{ color: 'rgba(255,255,255,0.22)', flexShrink: 0 }} />
          <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.22)', flex: 1 }}>Search books, topics, tests, or ask anything...</span>
          <span style={{ fontSize: 5, color: 'rgba(255,255,255,0.14)', fontFamily: 'monospace' }}>Ctrl K</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <Moon size={8} style={{ color: 'rgba(255,255,255,0.32)' }} />
          <div style={{ position: 'relative' }}>
            <Bell size={8} style={{ color: 'rgba(255,255,255,0.32)' }} />
            <div style={{ position: 'absolute', top: -1, right: -1, width: 3.5, height: 3.5, borderRadius: '50%', background: '#EF4444', border: '0.5px solid #0e1420' }} />
          </div>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: CYAN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 5.5, fontWeight: 800, color: '#000', flexShrink: 0 }}>SA</div>
          <div>
            <div style={{ fontSize: 6, color: '#fff', lineHeight: 1, fontWeight: 600 }}>Sameer Ali</div>
            <div style={{ fontSize: 4.5, color: 'rgba(255,255,255,0.32)', marginTop: 1 }}>Student</div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        <div style={{ width: 82, background: SIDE, borderRight: '1px solid rgba(255,255,255,0.07)', padding: '6px 0', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ fontSize: 4.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'rgba(255,255,255,0.2)', padding: '0 7px 3px' }}>Main</div>
          {sideItems.map(({ icon: Icon, label, active }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '1px 3px', padding: '3.5px 5px', borderRadius: 4, background: active ? `${CYAN}14` : 'transparent', borderLeft: `2px solid ${active ? CYAN : 'transparent'}`, color: active ? CYAN : 'rgba(255,255,255,0.28)' }}>
              <Icon size={6.5} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 6, fontWeight: active ? 600 : 400 }}>{label}</span>
            </div>
          ))}
          <div style={{ fontSize: 4.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'rgba(255,255,255,0.2)', padding: '7px 7px 3px' }}>Teacher</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '1px 3px', padding: '3.5px 5px', borderRadius: 4, color: 'rgba(255,255,255,0.28)', borderLeft: '2px solid transparent' }}>
            <FileText size={6.5} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 6 }}>Question Papers</span>
          </div>
          <div style={{ fontSize: 4.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'rgba(255,255,255,0.2)', padding: '7px 7px 3px' }}>Admin</div>
          {[{ icon: Users, label: 'User Management' }, { icon: Brain, label: 'Settings' }].map(({ icon: Icon, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '1px 3px', padding: '3.5px 5px', borderRadius: 4, color: 'rgba(255,255,255,0.28)', borderLeft: '2px solid transparent' }}>
              <Icon size={6.5} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 6 }}>{label}</span>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ padding: '6px 7px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 5.5, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', lineHeight: 1.4 }}>"A better you,<br/>for a brighter<br/>tomorrow."</div>
            <div style={{ width: 14, height: 1.5, background: CYAN, borderRadius: 1, marginTop: 4 }} />
            <div style={{ fontSize: 4.5, color: 'rgba(255,255,255,0.2)', marginTop: 3 }}>v1.0.0</div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Hero banner */}
          <div style={{ position: 'relative', background: '#0a0f1c', borderBottom: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', padding: '8px 12px', minHeight: 68, flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${heroBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center right', opacity: 0.35 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(8,12,20,0.98) 0%, rgba(8,12,20,0.9) 45%, rgba(8,12,20,0.3) 75%, rgba(8,12,20,0) 100%)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 5.5, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>Good Evening, Sameer</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1.1, marginBottom: 1 }}>Learn Today.</div>
              <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.1, marginBottom: 4 }}>Build <span style={{ color: CYAN }}>Tomorrow.</span></div>
              <div style={{ fontSize: 5, color: 'rgba(255,255,255,0.42)', maxWidth: 160, lineHeight: 1.5 }}>Your AI-powered study companion. Turn your books into knowledge, practice with real tests.</div>
            </div>
            {/* Quote overlay */}
            <div style={{ position: 'absolute', top: 8, left: '38%', zIndex: 1 }}>
              <div style={{ fontSize: 4.5, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.55)', lineHeight: 2 }}>"DISCIPLINE<br/>TURNS KNOWLEDGE<br/>INTO FREEDOM."</div>
              <div style={{ width: 10, height: 1.5, background: CYAN, borderRadius: 1, marginTop: 2 }} />
            </div>
          </div>

          {/* Quick action cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, padding: '5px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            {quickCards.map(({ icon: Icon, label, sub, color }) => (
              <div key={label} style={{ borderRadius: 6, border: `1px solid ${color}30`, background: `${color}0c`, padding: '5px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, background: `${color}22`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={8} style={{ color }} />
                </div>
                <div>
                  <div style={{ fontSize: 6, fontWeight: 700, color: '#fff' }}>{label}</div>
                  <div style={{ fontSize: 4.5, color: 'rgba(255,255,255,0.38)', lineHeight: 1.3 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Content grid */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, padding: '5px 8px', overflow: 'hidden' }}>

            {/* Your Learning Progress */}
            <div style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)', background: SIDE, padding: '6px 7px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 6.5, fontWeight: 700, color: '#fff' }}>Your Learning Progress</span>
                <span style={{ fontSize: 5, color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, padding: '1px 4px' }}>All Subjects ▾</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: CYAN, lineHeight: 1 }}>68%</div>
              <div style={{ fontSize: 4.5, color: '#22C55E', marginBottom: 4 }}>↑ +12% this month</div>
              <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 5 }}>
                <div style={{ height: '100%', width: '68%', background: CYAN, borderRadius: 2 }} />
              </div>
              {subjects.map(({ name, pct, color }) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3.5 }}>
                  <span style={{ fontSize: 5.5, color: 'rgba(255,255,255,0.5)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                  <div style={{ width: 55, height: 2.5, borderRadius: 1.5, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 1.5 }} />
                  </div>
                  <span style={{ fontSize: 5.5, color: 'rgba(255,255,255,0.45)', flexShrink: 0, width: 16, textAlign: 'right' }}>{pct}%</span>
                </div>
              ))}
            </div>

            {/* Right col: Continue Learning + Upcoming Tests */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {/* Continue Learning */}
              <div style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)', background: SIDE, padding: '6px 7px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 6.5, fontWeight: 700, color: '#fff' }}>Continue Learning</span>
                  <span style={{ fontSize: 5, color: CYAN, border: `1px solid ${CYAN}30`, borderRadius: 3, padding: '1px 4px' }}>Open Book</span>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <div style={{ width: 32, height: 38, borderRadius: 4, background: '#1a2540', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 3.5, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em', lineHeight: 1.4 }}>DATABASE<br/>MANAGEMENT<br/>SYSTEMS</div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 6, fontWeight: 700, color: '#fff', marginBottom: 1 }}>Database Management Systems</div>
                    <div style={{ fontSize: 5, color: 'rgba(255,255,255,0.38)', marginBottom: 3 }}>Elmasri & Navathe</div>
                    <div style={{ height: 2.5, borderRadius: 1.5, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 2 }}>
                      <div style={{ height: '100%', width: '78%', background: '#A855F7', borderRadius: 1.5 }} />
                    </div>
                    <div style={{ fontSize: 4.5, color: 'rgba(255,255,255,0.35)' }}>Current: Chapter 4 – Normalization</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: '#A855F7', borderRadius: 3, padding: '2px 5px', marginTop: 3, fontSize: 5, fontWeight: 700, color: '#fff' }}>
                      Continue Reading →
                    </div>
                  </div>
                </div>
              </div>

              {/* Upcoming Tests */}
              <div style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)', background: SIDE, padding: '6px 7px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 6.5, fontWeight: 700, color: '#fff' }}>Upcoming Tests</span>
                  <span style={{ fontSize: 5, color: CYAN }}>View All</span>
                </div>
                {tests.map(({ name, meta, date, color }) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3.5 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: `${color}20`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={6} style={{ color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 5.5, fontWeight: 600, color: '#fff' }}>{name}</div>
                      <div style={{ fontSize: 4.5, color: 'rgba(255,255,255,0.32)' }}>{meta}</div>
                    </div>
                    <span style={{ fontSize: 5, color: 'rgba(255,255,255,0.38)', flexShrink: 0 }}>{date}</span>
                    <ArrowRight size={5} style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Bottom row: Your Subjects + Recent Activity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, padding: '0 8px 6px', flexShrink: 0 }}>
            {/* Your Subjects */}
            <div style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)', background: SIDE, padding: '6px 7px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 6.5, fontWeight: 700, color: '#fff' }}>Your Subjects</span>
                <span style={{ fontSize: 5, color: CYAN, border: `1px solid ${CYAN}30`, borderRadius: 3, padding: '1px 4px' }}>Manage</span>
              </div>
              {subjects.map(({ name, pct, color }) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: `${color}20`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BookOpen size={5.5} style={{ color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 5.5, color: '#fff', marginBottom: 1.5 }}>{name.split(' ').slice(0,2).join(' ')}</div>
                    <div style={{ height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 1 }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 5.5, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{pct}%</span>
                  <ArrowRight size={5} style={{ color: 'rgba(255,255,255,0.2)' }} />
                </div>
              ))}
            </div>

            {/* Recent Activity */}
            <div style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)', background: SIDE, padding: '6px 7px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 6.5, fontWeight: 700, color: '#fff' }}>Recent Activity</span>
                <span style={{ fontSize: 5, color: CYAN }}>View All</span>
              </div>
              {activity.map(({ icon: Icon, label, sub, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 4 }}>
                  <div style={{ width: 13, height: 13, borderRadius: 3, background: `${color}20`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 0.5 }}>
                    <Icon size={6} style={{ color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 5.5, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{label}</div>
                    <div style={{ fontSize: 4.5, color: 'rgba(255,255,255,0.32)' }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Reveal wrapper ─────────────────────────────────────────────────────────────
function Reveal({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useReveal()
  return (
    <div ref={ref} style={{
      opacity: 0,
      transform: 'translateY(28px)',
      filter: 'blur(4px)',
      transition: 'opacity 0.8s cubic-bezier(0.32,0.72,0,1), transform 0.8s cubic-bezier(0.32,0.72,0,1), filter 0.8s cubic-bezier(0.32,0.72,0,1)',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function Landing() {
  const { isSignedIn } = useAuth()
  const { openSignIn, openSignUp } = useClerk()
  const navigate = useNavigate()
  const [isLight, setIsLight] = useState(() => localStorage.getItem('lp-theme') === 'light')

  function toggleTheme() {
    setIsLight(l => {
      const next = !l
      localStorage.setItem('lp-theme', next ? 'light' : 'dark')
      return next
    })
  }

  function go() {
    if (isSignedIn) navigate('/dashboard')
    else navigate('/sign-up')
  }

  const CYAN = '#22D3EE'
  const BLUE = '#2563EB'
  const ACCENT = isLight ? BLUE : CYAN

  // ── Theme ──────────────────────────────────────────────────────────────────
  const T = {
    bg:          isLight ? '#f3f7fb'                    : '#080c14',
    bgNav:       isLight ? 'rgba(243,247,251,0.96)'     : 'rgba(8,12,20,0.95)',
    bgCard:      isLight ? '#ffffff'                    : '#0d1220',
    text:        isLight ? '#0f172a'                    : '#fff',
    textMuted:   isLight ? 'rgba(15,23,42,0.72)'        : 'rgba(255,255,255,0.46)',
    textFaint:   isLight ? 'rgba(15,23,42,0.60)'        : 'rgba(255,255,255,0.28)',
    textDim:     isLight ? 'rgba(15,23,42,0.65)'        : 'rgba(255,255,255,0.4)',
    textVeryFaint:isLight? 'rgba(15,23,42,0.45)'        : 'rgba(255,255,255,0.18)',
    border:      isLight ? 'rgba(0,0,0,0.07)'           : 'rgba(255,255,255,0.07)',
    borderMid:   isLight ? 'rgba(0,0,0,0.10)'           : 'rgba(255,255,255,0.10)',
    borderFaint: isLight ? 'rgba(0,0,0,0.08)'           : 'rgba(255,255,255,0.08)',
    heroBg:      isLight ? lightLandingUrl               : heroBgUrl,
    heroGrad:    isLight
      ? 'linear-gradient(to right, rgba(243,247,251,0.97) 0%, rgba(243,247,251,0.92) 30%, rgba(243,247,251,0.65) 50%, rgba(243,247,251,0.15) 72%, rgba(243,247,251,0.0) 88%)'
      : 'linear-gradient(to right, rgba(8,12,20,0.97) 0%, rgba(8,12,20,0.92) 30%, rgba(8,12,20,0.65) 50%, rgba(8,12,20,0.15) 72%, rgba(8,12,20,0.0) 88%)',
    heroBottomFade: isLight
      ? 'linear-gradient(to top, rgba(243,247,251,0.85) 0%, transparent 100%)'
      : 'linear-gradient(to top, rgba(8,12,20,0.85) 0%, transparent 100%)',
    pillBg:      isLight ? 'rgba(255,255,255,0.88)'     : 'rgba(10,14,26,0.75)',
    ctaBg:       isLight ? '/MLAM.png'                    : '/M.png',
    statsBg:     isLight ? 'rgba(255,255,255,0.88)'     : 'rgba(8,14,28,0.85)',
    statsDivider:isLight ? 'rgba(0,0,0,0.10)'           : 'rgba(255,255,255,0.10)',
    footerBg:    isLight ? '#eaf0f6'                    : '#080c14',
    quoteColor:  isLight ? 'rgba(15,23,42,0.78)'        : 'rgba(255,255,255,0.72)',
    loginBorder: isLight ? 'rgba(0,0,0,0.22)'           : 'rgba(255,255,255,0.22)',
    loginColor:  isLight ? 'rgba(15,23,42,0.88)'        : 'rgba(255,255,255,0.88)',
    socialBorder:isLight ? 'rgba(0,0,0,0.12)'           : 'rgba(255,255,255,0.12)',
    socialColor: isLight ? 'rgba(15,23,42,0.45)'        : 'rgba(255,255,255,0.45)',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap');
        .lp-handwrite { font-family: 'Caveat', cursive; }
        .lp-nav-link { font-size: 13.5px; font-weight: 500; color: ${isLight ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.5)'}; text-decoration: none; transition: color 0.25s; }
        .lp-nav-link:hover { color: ${isLight ? '#0f172a' : '#fff'}; }
        .lp-nav-active { color: ${isLight ? BLUE : CYAN} !important; border-bottom: 1.5px solid ${isLight ? BLUE : CYAN}; padding-bottom: 2px; }
        .lp-btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #2563EB; color: #fff; font-weight: 600; font-size: 14px; padding: 12px 22px; border-radius: 10px; border: none; cursor: pointer; transition: all 0.3s cubic-bezier(0.32,0.72,0,1); box-shadow: 0 6px 28px rgba(37,99,235,0.35); }
        .lp-btn-primary:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 10px 36px rgba(37,99,235,0.42); }
        .lp-btn-primary:active { transform: scale(0.98); }
        .lp-btn-outline { display: inline-flex; align-items: center; gap: 8px; background: ${isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'}; color: ${isLight ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.8)'}; font-weight: 600; font-size: 14px; padding: 12px 22px; border-radius: 10px; border: 1px solid ${isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'}; cursor: pointer; transition: all 0.3s cubic-bezier(0.32,0.72,0,1); }
        .lp-btn-outline:hover { background: ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}; color: ${isLight ? '#0f172a' : '#fff'}; }
        .lp-btn-outline:active { transform: scale(0.98); }
        .lp-feature-card { border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 16px; cursor: pointer; transition: all 0.35s cubic-bezier(0.32,0.72,0,1); }
        .lp-feature-card:hover { transform: translateY(-2px); }
        .lp-why-card { border-radius: 16px; border: 1px solid ${T.borderFaint}; background: ${T.bgCard}; padding: 32px 24px; text-align: center; transition: border-color 0.3s cubic-bezier(0.32,0.72,0,1); }
        .lp-why-card:hover { border-color: ${isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)'}; }
        .lp-footer-link { font-size: 12px; color: ${T.textFaint}; text-decoration: none; display: block; margin-bottom: 10px; transition: color 0.2s; }
        .lp-footer-link:hover { color: ${isLight ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.7)'}; }
        .lp-pill { display: flex; align-items: center; gap: 6px; border-radius: 8px; border: 1px solid ${T.borderFaint}; background: ${isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'}; padding: 6px 12px; }
        @media (max-width: 900px) {
          .lp-hero-left { width: 100% !important; }
          .lp-hero-books { display: none !important; }
          .lp-hero-quote { display: none !important; }
          .lp-feature-grid { grid-template-columns: repeat(2,1fr) !important; }
          .lp-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
          .lp-dash-grid { grid-template-columns: 1fr !important; }
          .lp-why-grid { grid-template-columns: repeat(2,1fr) !important; }
          .lp-footer-grid { grid-template-columns: 1fr 1fr 1fr !important; }
          .lp-cta-deco { display: none !important; }
          .lp-nav-links { display: none !important; }
          .lp-hero-grid { grid-template-columns: 1fr !important; padding: 28px 5% !important; }
          .lp-hero-pills { flex-wrap: wrap !important; gap: 8px !important; }
          .lp-hero-pills > div { flex: 1 1 calc(50% - 8px) !important; min-width: 0 !important; }
          .lp-hero-pills > div span { font-size: 12px !important; white-space: normal !important; }
        }
        @media (max-width: 540px) {
          .lp-feature-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .lp-feature-card { padding: 14px !important; gap: 10px !important; }
          .lp-why-grid { grid-template-columns: 1fr 1fr !important; gap: 12px !important; }
          .lp-why-card-inner { padding: 18px 12px 20px !important; }
          .lp-why-icon { width: 56px !important; height: 56px !important; margin-bottom: 12px !important; }
          .lp-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 20px !important; }
          .lp-footer-brand { grid-column: 1 / -1 !important; }
          .lp-footer-brand img { width: 130px !important; }
          .lp-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
          .lp-stats-cell { padding: 14px 16px !important; gap: 10px !important; }
          .lp-stats-icon { display: none !important; }
          .lp-stats-val { font-size: 20px !important; }
          .lp-hero-pills { flex-direction: column !important; gap: 8px !important; }
          .lp-hero-pills > div { flex: none !important; width: 100% !important; }
          .lp-btn-primary, .lp-btn-outline { width: 100% !important; justify-content: center !important; }
          .lp-hero-btns { flex-direction: column !important; width: 100% !important; }
          .lp-logo { width: 130px !important; }
          .lp-nav-gap { display: none !important; }
          .lp-login-btn { display: none !important; }
          .lp-nav-actions { gap: 10px !important; }
          .lp-cta-nowrap { white-space: normal !important; font-size: 20px !important; }
          .lp-cta-sub-nowrap { white-space: normal !important; font-size: 12px !important; }
          .lp-dash-preview { display: none !important; }
          .lp-dash-text { display: block !important; max-width: 100% !important; }
          .lp-hero-section { min-height: auto !important; padding: 40px 0 32px !important; }
          .lp-hero-grid { padding: 20px 5% !important; }
          .lp-section-pad { padding: 20px 0 !important; }
          .lp-hero-badge { font-size: 11px !important; }
          .lp-hero-h1 { font-size: 36px !important; margin-bottom: 14px !important; }
          .lp-hero-p { font-size: 13px !important; margin-bottom: 20px !important; }
          .lp-stats-label { font-size: 10px !important; }
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: T.bg,
        color: T.text,
        fontFamily: 'Manrope, system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        transition: 'background 0.35s, color 0.35s',
        overflowX: 'hidden',
      }}>

        {/* ════════════════════════════════════════════════════
            NAVBAR
        ════════════════════════════════════════════════════ */}
        <nav style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: T.bgNav,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${T.border}`,
          height: 75,
          display: 'flex',
          alignItems: 'center',
          transition: 'background 0.35s, border-color 0.35s',
        }}>
          <div style={{
            width: '100%',
            padding: '0 2.5%',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            height: '100%',
          }}>
            {/* Logo */}
            <img
              src={academiqLogoUrl}
              alt="AcademIQ"
              className="lp-logo"
              style={{
                width: 210, height: 'auto', display: 'block', flexShrink: 0,
                filter: isLight ? 'invert(1) hue-rotate(180deg) brightness(0.2)' : 'none',
                transition: 'filter 0.35s',
              }}
            />

            {/* Gap: logo → nav links ~110px */}
            <div className="lp-nav-gap" style={{ width: 110, flexShrink: 0 }} />

            {/* Nav links */}
            <div className="lp-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
              {NAV_LINKS.map((l, i) => (
                <a key={l} href="#" className={`lp-nav-link${i === 0 ? ' lp-nav-active' : ''}`}>{l}</a>
              ))}
            </div>

            {/* Push actions to right */}
            <div style={{ flex: 1 }} />

            {/* Right actions */}
            <div className="lp-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              {/* Theme toggle switch */}
              <div
                onClick={toggleTheme}
                title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
                style={{
                  width: 48, height: 26, borderRadius: 13,
                  background: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.10)',
                  border: `1px solid ${isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.16)'}`,
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.35s',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: 3, left: isLight ? 24 : 3,
                  width: 18, height: 18,
                  borderRadius: '50%',
                  background: isLight ? '#F59E0B' : CYAN,
                  transition: 'all 0.35s cubic-bezier(0.32,0.72,0,1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isLight ? '0 2px 8px rgba(245,158,11,0.5)' : `0 2px 8px ${CYAN}60`,
                }}>
                  {isLight
                    ? <Sun size={10} style={{ color: '#fff' }} />
                    : <Moon size={10} style={{ color: '#080c14' }} />}
                </div>
              </div>

              {isSignedIn ? (
                <button onClick={() => navigate('/dashboard')} className="lp-btn-primary" style={{ padding: '9px 22px', fontSize: 13.5 }}>
                  Dashboard
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="lp-login-btn"
                    onClick={() => isSignedIn ? navigate('/dashboard') : navigate('/sign-in')}
                    style={{
                      background: 'transparent',
                      border: `1.5px solid ${T.loginBorder}`,
                      borderRadius: 8,
                      color: T.loginColor,
                      fontSize: 14,
                      fontWeight: 600,
                      padding: '9px 20px',
                      cursor: 'pointer',
                      transition: 'all 0.25s',
                      letterSpacing: '0.01em',
                    }}
                  >
                    Log In
                  </button>
                  <button onClick={go} className="lp-btn-primary" style={{ padding: '9px 24px', fontSize: 14 }}>
                    Get Started
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* ════════════════════════════════════════════════════
            HERO — full viewport, cinematic, books right
        ════════════════════════════════════════════════════ */}
        <section className="lp-hero-section" style={{
          position: 'relative',
          minHeight: 'calc(100vh - 75px)',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          background: T.bg,
          transition: 'background 0.35s',
        }}>
          {/* Hero background image */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${T.heroBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center right',
            backgroundRepeat: 'no-repeat',
            opacity: 0.9,
            transition: 'opacity 0.35s',
          }} />
          {/* Gradient blend */}
          <div style={{
            position: 'absolute', inset: 0,
            background: T.heroGrad,
            pointerEvents: 'none',
            transition: 'background 0.35s',
          }} />
          {/* Bottom fade */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '28%',
            background: T.heroBottomFade,
            pointerEvents: 'none',
            transition: 'background 0.35s',
          }} />

          <div className="lp-hero-grid" style={{
            width: '100%',
            padding: '40px 5%',
            position: 'relative',
            zIndex: 2,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 48,
            alignItems: 'center',
            boxSizing: 'border-box',
          }}>

            {/* LEFT */}
            <div className="lp-hero-left">
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                borderRadius: 999,
                border: `1px solid ${ACCENT}40`,
                background: `${ACCENT}0e`,
                padding: '6px 14px',
                marginBottom: 20,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 8px ${ACCENT}`, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>Your AI-Powered Study Companion</span>
              </div>

              <h1 className="lp-hero-h1" style={{
                fontSize: 'clamp(42px, 4.5vw, 64px)',
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: '-0.025em',
                margin: '0 0 20px',
              }}>
                <span style={{ color: T.text, display: 'block', transition: 'color 0.35s' }}>Learn Today.</span>
                <span style={{ color: T.text, transition: 'color 0.35s' }}>Build </span>
                <span style={{ color: ACCENT, textShadow: `0 0 48px ${ACCENT}55` }}>Tomorrow.</span>
              </h1>

              <p style={{
                fontSize: 15,
                color: T.textMuted,
                lineHeight: 1.7,
                marginBottom: 28,
                maxWidth: 440,
                transition: 'color 0.35s',
              }}>
                Turn your study materials into knowledge, practice with real tests, and track your progress — all in one place.
              </p>

              <div className="lp-hero-btns" style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
                <button onClick={go} className="lp-btn-primary" style={{ padding: '12px 22px', fontSize: 14 }}>
                  Get Started Free <ArrowRight size={15} />
                </button>
              </div>

              <div className="lp-hero-pills" style={{ display: 'flex', gap: 10, flexWrap: 'nowrap' }}>
                {[
                  { icon: BookOpen,   label: 'Upload Your Books', color: '#22C55E' },
                  { icon: Sparkles,  label: 'Learn with AI',     color: '#38BDF8' },
                  { icon: FileText,  label: 'Take Tests',        color: '#E879F9' },
                  { icon: Calendar,  label: 'Track Progress',    color: '#FBBF24' },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    borderRadius: 10,
                    border: `1px solid ${T.borderMid}`,
                    background: T.pillBg,
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    padding: '7px 12px',
                    transition: 'background 0.35s, border-color 0.35s',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                      background: `${color}28`,
                      border: `1px solid ${color}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={15} style={{ color }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: T.text, whiteSpace: 'nowrap', transition: 'color 0.35s' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — quote */}
            <div className="lp-hero-books" style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', paddingTop: 40, minHeight: 380 }}>
              <div className="lp-hero-quote" style={{ padding: '0 12px' }}>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: T.quoteColor,
                  lineHeight: 2,
                  textShadow: isLight ? 'none' : '0 2px 12px rgba(0,0,0,0.8)',
                  transition: 'color 0.35s',
                }}>
                  "DISCIPLINE<br />TURNS KNOWLEDGE<br />INTO FREEDOM."
                </div>
                <div style={{ width: 26, height: 2, background: ACCENT, borderRadius: 1, marginTop: 10, boxShadow: `0 0 8px ${ACCENT}88` }} />
              </div>
            </div>

          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            FEATURES — 4 colored cards
        ════════════════════════════════════════════════════ */}
        <section id="features" style={{ background: T.bg, padding: '28px 0', borderTop: `1px solid ${T.border}`, transition: 'background 0.35s, border-color 0.35s' }}>
          <div style={{ maxWidth: '100%', padding: '0 5%' }}>
            <Reveal>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  borderRadius: 999,
                  border: `1px solid ${ACCENT}35`,
                  background: `${ACCENT}10`,
                  padding: '5px 14px',
                  marginBottom: 16,
                }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: ACCENT }}>Everything You Need</span>
                </div>
                <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, color: T.text, margin: '0 0 10px', lineHeight: 1.18, transition: 'color 0.35s' }}>
                  Powerful Features for Smarter Learning
                </h2>
                <p style={{ fontSize: 14, color: T.textDim, maxWidth: 440, margin: '0 auto', lineHeight: 1.6, transition: 'color 0.35s' }}>
                  Designed to make your study journey simpler, faster, and more effective.
                </p>
              </div>

              {/* Feature cards */}
              <div className="lp-feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
                {FEATURES.map(({ icon: Icon, label, sub, color }) => (
                  <div
                    key={label}
                    className="lp-feature-card"
                    style={{
                      background: `${color}0d`,
                      border: `1px solid ${color}3a`,
                      padding: '20px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                        background: `${color}22`,
                        border: `1px solid ${color}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={19} style={{ color }} />
                      </div>
                      <ArrowRight size={15} style={{ color, opacity: 0.4, marginTop: 2 }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14.5, color: T.text, marginBottom: 6, transition: 'color 0.35s' }}>{label}</div>
                      <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.6, transition: 'color 0.35s' }}>{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            STATS
        ════════════════════════════════════════════════════ */}
        <section style={{ background: T.bg, padding: '16px 0 20px', transition: 'background 0.35s' }}>
          <div style={{ maxWidth: '100%', padding: '0 5%' }}>
            <Reveal>
              <div style={{
                border: `1px solid rgba(34,211,238,0.18)`,
                borderRadius: 14,
                background: T.statsBg,
                display: 'grid',
                gridTemplateColumns: 'repeat(4,1fr)',
                position: 'relative',
                transition: 'background 0.35s',
              }} className="lp-stats-grid">
                {STATS.map(({ icon: Icon, value, label }, i) => (
                  <div key={label} className="lp-stats-cell" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '20px 32px',
                    position: 'relative',
                  }}>
                    {i > 0 && (
                      <div style={{
                        position: 'absolute', left: 0, top: '50%',
                        transform: 'translateY(-50%)',
                        width: 1, height: 36,
                        background: T.statsDivider,
                        transition: 'background 0.35s',
                      }} />
                    )}
                    <Icon size={44} className="lp-stats-icon" style={{ color: CYAN, flexShrink: 0 }} />
                    <div>
                      <div className="lp-stats-val" style={{ fontSize: 24, fontWeight: 800, color: T.text, lineHeight: 1, transition: 'color 0.35s' }}>{value}</div>
                      <div className="lp-stats-label" style={{ fontSize: 12, color: T.textMuted, marginTop: 4, transition: 'color 0.35s' }}>{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            DASHBOARD SHOWCASE
        ════════════════════════════════════════════════════ */}
        <section id="how-it-works" style={{ background: T.bg, padding: '28px 0', transition: 'background 0.35s' }}>
          <div style={{ maxWidth: '100%', padding: '0 5%' }}>
            <Reveal>
              <div className="lp-dash-grid" style={{ display: 'grid', gridTemplateColumns: '3fr 7fr', gap: 48, alignItems: 'center' }}>

                {/* Left text */}
                <div className="lp-dash-text">
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    borderRadius: 999,
                    border: `1px solid ${ACCENT}35`,
                    background: `${ACCENT}10`,
                    padding: '4px 12px',
                    marginBottom: 14,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: ACCENT }}>A Smarter Way to Learn</span>
                  </div>
                  <h2 style={{ fontSize: 'clamp(24px, 2.8vw, 36px)', fontWeight: 800, color: T.text, lineHeight: 1.15, margin: '0 0 12px', transition: 'color 0.35s' }}>
                    Your Complete<br />Learning Dashboard
                  </h2>
                  <p style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.7, marginBottom: 18, transition: 'color 0.35s' }}>
                    Track progress, take tests, get AI help, and manage your study plan — all in one clean and intuitive dashboard.
                  </p>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {[
                      'Real-time progress tracking',
                      'Subject-wise organization',
                      'AI-powered learning tools',
                      'Personalized study recommendations',
                    ].map((item) => (
                      <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                          background: 'rgba(34,197,94,0.12)',
                          border: '1px solid rgba(34,197,94,0.28)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <CheckCircle size={10} style={{ color: '#22C55E' }} />
                        </div>
                        <span style={{ fontSize: 12.5, color: T.textMuted, transition: 'color 0.35s' }}>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <button onClick={go} className="lp-btn-primary" style={{ padding: '10px 18px', fontSize: 13 }}>
                    Explore Dashboard <ArrowRight size={14} />
                  </button>
                </div>

                {/* Right dashboard preview */}
                <div className="lp-dash-preview" style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', inset: -20,
                    background: `${CYAN}05`,
                    borderRadius: 28,
                    filter: 'blur(30px)',
                    pointerEvents: 'none',
                  }} />
                  <div style={{ position: 'relative' }}>
                    <DashboardPreview />
                  </div>
                </div>

              </div>
            </Reveal>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            WHY ACADEMIQ
        ════════════════════════════════════════════════════ */}
        <section id="educators" style={{ background: T.bg, padding: '28px 0', borderTop: `1px solid ${T.border}`, transition: 'background 0.35s, border-color 0.35s' }}>
          <div style={{ maxWidth: '100%', padding: '0 5%' }}>
            <Reveal>
              <div style={{ textAlign: 'center', marginBottom: 22 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  borderRadius: 999,
                  border: `1px solid ${ACCENT}35`,
                  background: `${ACCENT}10`,
                  padding: '5px 14px',
                  marginBottom: 16,
                }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: ACCENT }}>Why AcademIQ</span>
                </div>
                <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, color: T.text, margin: '0 0 10px', lineHeight: 1.18, transition: 'color 0.35s' }}>
                  More Than Just a Study Platform
                </h2>
                <p style={{ fontSize: 14, color: T.textDim, margin: 0, lineHeight: 1.6, transition: 'color 0.35s' }}>
                  Built for students, educators, and lifelong learners.
                </p>
              </div>

              <div className="lp-why-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24 }}>
                {WHY_CARDS.map(({ icon: Icon, label, sub, color }) => (
                  <div key={label} className="lp-why-card-inner" style={{ textAlign: 'center', padding: '12px 24px 28px' }}>
                    <div className="lp-why-icon" style={{
                      width: 82, height: 82, borderRadius: '50%',
                      background: `${color}22`,
                      border: `1.5px solid ${color}50`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 18px',
                      boxShadow: `0 8px 28px ${color}30`,
                    }}>
                      <Icon size={34} style={{ color }} />
                    </div>
                    <h3 style={{ fontWeight: 700, fontSize: 16, color: T.text, margin: '0 0 10px', transition: 'color 0.35s' }}>{label}</h3>
                    <p style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.65, margin: 0, transition: 'color 0.35s' }}>{sub}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            CTA
        ════════════════════════════════════════════════════ */}
        <section style={{
          position: 'relative',
          padding: '0 0 28px',
          overflow: 'hidden',
          backgroundColor: T.bg,
          backgroundImage: `url(${T.ctaBg})`,
          backgroundSize: '108%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          transition: 'background-color 0.35s',
        }}>
          <div style={{ maxWidth: '100%', padding: '0 5%' }}>
            <Reveal>
              <div style={{
                position: 'relative',
                padding: '48px 5%',
                textAlign: 'center',
                background: 'transparent',
              }}>

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <h2 className="lp-cta-nowrap" style={{ fontSize: 'clamp(18px, 2vw, 30px)', fontWeight: 800, color: isLight ? '#0f172a' : '#fff', margin: '0 0 10px', lineHeight: 1.2, whiteSpace: 'nowrap', transition: 'color 0.35s' }}>
                    Ready to Start Your Learning Journey?
                  </h2>
                  <p className="lp-cta-sub-nowrap" style={{ fontSize: 13, color: isLight ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.75)', marginBottom: 22, lineHeight: 1.65, whiteSpace: 'nowrap', transition: 'color 0.35s' }}>
                    Join thousands of learners and make your studies smarter, simpler, and more effective.
                  </p>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={go} className="lp-btn-primary" style={{ fontSize: 14, padding: '12px 26px' }}>
                      Get Started Free <ArrowRight size={15} />
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: isLight ? 'rgba(15,23,42,0.45)' : 'rgba(255,255,255,0.4)', marginTop: 12, transition: 'color 0.35s' }}>No credit card required</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            FOOTER
        ════════════════════════════════════════════════════ */}
        <footer style={{
          background: T.footerBg,
          borderTop: `1px solid ${T.border}`,
          padding: '40px 0 24px',
          transition: 'background 0.35s, border-color 0.35s',
        }}>
          <div style={{ maxWidth: '100%', padding: '0 5%' }}>
            <div className="lp-footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 32, marginBottom: 32 }}>

              {/* Brand col */}
              <div className="lp-footer-brand">
                <div style={{ marginBottom: 12 }}>
                  <img
                    src={academiqLogoUrl}
                    alt="AcademIQ"
                    style={{
                      width: 180, display: 'block',
                      filter: isLight ? 'invert(1) hue-rotate(180deg) brightness(0.2)' : 'none',
                      transition: 'filter 0.35s',
                    }}
                  />
                </div>
                <p style={{ fontSize: 12, color: T.textFaint, lineHeight: 1.7, maxWidth: 230, transition: 'color 0.35s' }}>
                  A modern learning platform to help students learn, practice, and grow with the power of AI.
                </p>
              </div>

              {/* Link columns */}
              {Object.entries(FOOTER_LINKS).map(([section, links]) => (
                <div key={section}>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: T.textFaint, marginBottom: 16, transition: 'color 0.35s' }}>
                    {section}
                  </p>
                  {links.map((l) => (
                    <a key={l} href="#" className="lp-footer-link">{l}</a>
                  ))}
                </div>
              ))}

              {/* Follow Us */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: T.textFaint, marginBottom: 16, transition: 'color 0.35s' }}>
                  Follow Us
                </p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  {[
                    { label: 'D', title: 'Discord' },
                    { label: 'X', title: 'X' },
                    { label: 'in', title: 'LinkedIn' },
                    { label: '▶', title: 'YouTube' },
                  ].map(({ label, title }) => (
                    <button key={title} title={title} style={{
                      width: 30, height: 30, borderRadius: 7,
                      border: `1px solid ${T.socialBorder}`,
                      background: 'transparent',
                      color: T.socialColor,
                      fontSize: 11, fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.35s',
                    }}>{label}</button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: T.textVeryFaint, transition: 'color 0.35s' }}>© 2026 AcademIQ. All rights reserved.</p>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
