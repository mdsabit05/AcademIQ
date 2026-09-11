import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useEffect, useRef } from 'react'
import {
  BookOpen, MessageSquare, FileText, BarChart2, ArrowRight,
  CheckCircle, Brain, Upload, Zap, Target, Heart, Play,
  Moon, Bell, Search, Home, TrendingUp,
} from 'lucide-react'
import Logo from '../components/Logo'

// ── Scroll reveal hook ────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('revealed'); obs.disconnect() } },
      { threshold: 0.15 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

// ── Word-by-word tagline reveal ───────────────────────────────────────────────
function TaglineReveal({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const container = ref.current
    if (!container) return
    const words = container.querySelectorAll<HTMLSpanElement>('[data-word]')
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          words.forEach((w, i) => {
            setTimeout(() => w.classList.add('word-lit'), i * 60)
          })
          obs.disconnect()
        })
      },
      { threshold: 0.3 },
    )
    obs.observe(container)
    return () => obs.disconnect()
  }, [])
  const words = text.split(' ')
  return (
    <div ref={ref} className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
      {words.map((w, i) => (
        <span
          key={i}
          data-word
          className="word-dim text-4xl md:text-5xl font-bold leading-tight"
          style={{ transition: `color 0.6s cubic-bezier(0.32,0.72,0,1) ${i * 60}ms` }}
        >
          {w}
        </span>
      ))}
    </div>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NAV_LINKS = ['Home', 'Features', 'How It Works', 'For Educators', 'Pricing', 'FAQ']

const STATS = [
  { icon: Brain,     value: '10K+', label: 'Active Learners',   color: '#6366F1' },
  { icon: BookOpen,  value: '500+', label: 'Books & Resources', color: '#22D3EE' },
  { icon: BarChart2, value: '95%',  label: 'Positive Feedback', color: '#22C55E' },
  { icon: Zap,       value: '24/7', label: 'AI Support',        color: '#F97316' },
]

const FEATURES = [
  { icon: BookOpen,    label: 'Upload Books', sub: 'Upload your PDFs and instantly convert them into interactive learning material.', color: '#22C55E' },
  { icon: MessageSquare, label: 'AI Tutor',  sub: 'Get instant, accurate answers to your questions from your own study material.',    color: '#6366F1' },
  { icon: FileText,    label: 'Take a Test', sub: 'Practice with chapter-wise and full-length tests.',                                color: '#EF4444' },
  { icon: TrendingUp,  label: 'Study Plan',  sub: 'Plan your learning journey and stay consistent.',                                  color: '#F97316' },
]

const WHY_CARDS = [
  { icon: Zap,       label: 'Save Time',      sub: 'Get quick answers and summaries from your own books.',            color: '#A855F7' },
  { icon: Target,    label: 'Learn Better',   sub: 'Practice with real tests and track your understanding.',          color: '#22C55E' },
  { icon: BarChart2, label: 'Stay Organized', sub: 'Keep all your study material in one place.',                      color: '#F97316' },
  { icon: Heart,     label: 'Achieve More',   sub: 'Build consistent habits and reach your academic goals.',          color: '#22D3EE' },
]

const FOOTER = {
  Product:  ['Features', 'Pricing', 'FAQ', 'Changelog'],
  Company:  ['About Us', 'Careers', 'Blog', 'Contact'],
  Legal:    ['Privacy Policy', 'Terms of Service', 'Cookie Policy'],
}

// ── Mini Dashboard Preview ────────────────────────────────────────────────────
function DashboardPreview() {
  const P = ['#22C55E', '#A855F7', '#F97316', '#EF4444']
  return (
    <div className="rounded-2xl border border-white/10 bg-[#000000] overflow-hidden shadow-2xl">
      {/* topbar */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-[#181818] px-3 py-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-5 h-5 rounded bg-[#6366F1] flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">A</span>
          </div>
          <span className="text-[9px] font-bold text-white">Academ<span className="text-[#6366F1]">IQ</span></span>
        </div>
        <div className="flex-1 flex items-center gap-1.5 bg-[#000000] border border-white/10 rounded-md px-2 py-1">
          <Search size={7} className="text-white/30" />
          <span className="text-[7px] text-white/30">Search books, topics, tests, or ask anything...</span>
          <span className="ml-auto text-[6px] text-white/20 font-mono">Ctrl K</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Moon size={9} className="text-white/40" />
          <div className="relative"><Bell size={9} className="text-white/40" /><div className="absolute -top-px -right-px w-1 h-1 bg-red-500 rounded-full" /></div>
          <div className="w-5 h-5 rounded-full bg-[#6366F1] flex items-center justify-center text-[7px] font-bold text-white ml-1">SA</div>
          <div className="hidden sm:block">
            <p className="text-[7px] text-white leading-none">Sameer Ali</p>
            <p className="text-[6px] text-white/40">Student</p>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* sidebar */}
        <div className="w-24 border-r border-white/10 bg-[#181818] py-2 shrink-0">
          <p className="text-[6px] font-semibold uppercase tracking-widest text-white/20 px-2 pt-1 pb-0.5">Main</p>
          {[{icon:Home,l:'Dashboard',a:true},{icon:BookOpen,l:'My Books'},{icon:MessageSquare,l:'AI Tutor'},{icon:FileText,l:'Tests'},{icon:BarChart2,l:'Progress'},{icon:TrendingUp,l:'Study Plan'},{icon:BookOpen,l:'Syllabus'},{icon:Brain,l:'Memory'},{icon:Zap,l:'General AI'}].map(({icon:Icon,l,a})=>(
            <div key={l} className={`flex items-center gap-1 mx-1 px-2 py-1 rounded my-px ${a?'bg-[#6366F1]/15 text-[#6366F1]':'text-white/30'}`}>
              <Icon size={8} className="shrink-0" /><span className="text-[7px] font-medium">{l}</span>
            </div>
          ))}
          <p className="text-[6px] font-semibold uppercase tracking-widest text-white/20 px-2 pt-2 pb-0.5">Teacher</p>
          <div className="flex items-center gap-1 mx-1 px-2 py-1 rounded text-white/30"><FileText size={8}/><span className="text-[7px] font-medium">Question Papers</span></div>
          <p className="text-[6px] font-semibold uppercase tracking-widest text-white/20 px-2 pt-2 pb-0.5">Admin</p>
          {[{i:Brain,l:'User Management'},{i:Zap,l:'Settings'}].map(({i:Icon,l})=>(
            <div key={l} className="flex items-center gap-1 mx-1 px-2 py-1 rounded text-white/30"><Icon size={8}/><span className="text-[7px] font-medium">{l}</span></div>
          ))}
          <div className="mx-3 mt-3 pt-2 border-t border-white/10">
            <p className="text-[6px] text-white/20 italic leading-relaxed">"A better you, for a brighter tomorrow."</p>
            <div className="mt-1 h-px w-4 bg-[#6366F1]/40" />
            <p className="text-[5px] text-white/15 mt-1">v1.0.0</p>
          </div>
        </div>

        {/* main content */}
        <div className="flex-1 p-2.5 space-y-2 min-w-0">
          {/* hero */}
          <div className="rounded-xl border border-white/8 bg-[#181818] px-3 py-2.5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#6366F1]/8 to-transparent pointer-events-none" />
            <p className="text-[6.5px] text-white/40 mb-0.5">Good Evening, Sameer</p>
            <div className="text-[11px] font-bold text-white leading-tight">Learn Today. Build <span className="text-[#6366F1]">Tomorrow.</span></div>
            <p className="text-[5.5px] text-white/40 mt-0.5 max-w-[160px]">Your AI-powered study companion. Turn your books into knowledge.</p>
            <div className="absolute right-2 top-2 flex flex-col gap-0.5">
              {['STUDY','PRACTICE','PROGRESS','GROW'].map((w,i)=>(
                <span key={w} className="font-bold tracking-widest" style={{fontSize:5,color:i===3?'#6366F1':`rgba(248,250,252,${0.7-i*0.15})`}}>{w}</span>
              ))}
            </div>
          </div>

          {/* action cards */}
          <div className="grid grid-cols-4 gap-1.5">
            {[{icon:Upload,l:'Upload Book',s:'Add PDF & start learning',c:'#22C55E'},{icon:MessageSquare,l:'AI Tutor',s:'Get instant, accurate answers',c:'#6366F1'},{icon:FileText,l:'Take a Test',s:'Practice & evaluate',c:'#EF4444'},{icon:TrendingUp,l:'Study Plan',s:'Plan your learning journey',c:'#F97316'}].map(({icon:Icon,l,s,c})=>(
              <div key={l} className="rounded-lg border border-white/8 bg-[#181818] p-1.5 flex items-center gap-1">
                <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{backgroundColor:`${c}20`}}><Icon size={9} style={{color:c}}/></div>
                <div className="min-w-0"><p className="text-[6.5px] font-semibold text-white leading-tight truncate">{l}</p><p className="text-[5.5px] text-white/40 truncate">{s}</p></div>
              </div>
            ))}
          </div>

          {/* middle: progress + continue */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg border border-white/8 bg-[#181818] p-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[6.5px] font-semibold text-white">Your Learning Progress</p>
                <span className="text-[5.5px] text-white/30 border border-white/10 rounded px-1">All Subjects</span>
              </div>
              <div className="flex items-end gap-1.5 mb-1">
                <span className="text-[14px] font-bold text-[#6366F1]">68%</span>
                <span className="text-[5.5px] text-[#22C55E] mb-0.5">↑ +12% this month</span>
              </div>
              <div className="h-1 bg-[#000000] rounded-full overflow-hidden mb-2">
                <div className="h-full w-[68%] rounded-full" style={{background:'linear-gradient(to right,#6366F1,#22D3EE)'}}/>
              </div>
              {['Database Management Systems','Operating Systems','Computer Networks','Discrete Mathematics'].map((t,i)=>(
                <div key={t} className="flex items-center gap-1.5 mb-1">
                  <span className="text-[5.5px] text-white/40 w-[68px] truncate shrink-0">{t}</span>
                  <div className="flex-1 h-0.5 bg-[#000000] rounded overflow-hidden">
                    <div className="h-full rounded" style={{width:`${[78,62,35,48][i]}%`,backgroundColor:P[i]}}/>
                  </div>
                  <span className="text-[5.5px] font-semibold shrink-0" style={{color:P[i]}}>{[78,62,35,48][i]}%</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-white/8 bg-[#181818] p-2 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[6.5px] font-semibold text-white">Continue Learning</p>
                <span className="text-[5.5px] text-[#6366F1]">Open Book</span>
              </div>
              <div className="flex gap-2 mb-2">
                <div className="w-10 h-12 rounded-md flex items-center justify-center shrink-0" style={{background:'linear-gradient(135deg,#6366F1,#4338CA)'}}>
                  <BookOpen size={10} className="text-white/70"/>
                </div>
                <div className="min-w-0">
                  <p className="text-[6.5px] font-semibold text-white leading-tight">Database Management Systems</p>
                  <p className="text-[5.5px] text-white/40 mt-0.5">Elmasri & Navathe</p>
                  <div className="mt-1.5 h-0.5 bg-[#000000] rounded overflow-hidden">
                    <div className="h-full w-[78%] bg-[#6366F1] rounded"/>
                  </div>
                  <p className="text-[5.5px] text-white/40 mt-0.5">78%</p>
                  <p className="text-[5.5px] text-white/25">Current: Chapter 4 - Normalization</p>
                </div>
              </div>
              <div className="mt-auto w-full rounded-md bg-[#6366F1] flex items-center justify-center gap-1 py-1.5 text-[6.5px] font-semibold text-white">
                Continue Reading →
              </div>
            </div>
          </div>

          {/* bottom 3 cols */}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded-lg border border-white/8 bg-[#181818] p-2">
              <div className="flex items-center justify-between mb-1.5"><p className="text-[6.5px] font-semibold text-white">Upcoming Tests</p><span className="text-[5.5px] text-[#6366F1]">View All</span></div>
              {[['DBMS – Unit 2','20 Questions • 30 mins','12 Sep',0],['OS – Unit 1','20 Questions • 30 mins','15 Sep',1],['CN – Full Test','50 Questions • 60 mins','18 Sep',2]].map(([t,s,d,i])=>(
                <div key={String(t)} className="flex items-center gap-1 mb-1">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{backgroundColor:`${P[Number(i)]}20`}}><FileText size={7} style={{color:P[Number(i)]}}/></div>
                  <div className="flex-1 min-w-0"><p className="text-[6px] text-white truncate">{t}</p><p className="text-[5px] text-white/30">{s}</p></div>
                  <span className="text-[5.5px] text-white/40 shrink-0">{d}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-white/8 bg-[#181818] p-2">
              <div className="flex items-center justify-between mb-1.5"><p className="text-[6.5px] font-semibold text-white">Your Subjects</p><span className="text-[5.5px] text-[#6366F1]">Manage</span></div>
              {[['DBMS',78,'#22C55E'],['Operating Systems',62,'#A855F7'],['Computer Networks',35,'#F97316'],['Discrete Mathematics',48,'#EF4444']].map(([n,p,c])=>(
                <div key={String(n)} className="flex items-center gap-1 mb-1.5">
                  <BookOpen size={7} style={{color:String(c)}} className="shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-0.5"><p className="text-[6px] text-white truncate">{n}</p><span className="text-[5.5px] font-semibold" style={{color:String(c)}}>{p}%</span></div>
                    <div className="h-0.5 bg-[#000000] rounded overflow-hidden"><div className="h-full rounded" style={{width:`${p}%`,backgroundColor:String(c)}}/></div>
                  </div>
                  <ArrowRight size={7} className="text-white/20 shrink-0"/>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-white/8 bg-[#181818] p-2">
              <div className="flex items-center justify-between mb-1.5"><p className="text-[6.5px] font-semibold text-white">Recent Activity</p><span className="text-[5.5px] text-[#6366F1]">View All</span></div>
              {[{l:'Read Chapter 3 – ER Model',s:'DBMS • 2 hours ago',c:'#22C55E'},{l:'Completed Quiz – Normalization',s:'Score: 8/10 • 5 hours ago',c:'#6366F1'},{l:'Asked a question in AI Tutor',s:'"Explain BCNF" • 1 day ago',c:'#F97316'},{l:'Uploaded a new book',s:'Operating Systems.pdf • 2 days ago',c:'#A855F7'}].map(({l,s,c},i)=>(
                <div key={i} className="flex items-start gap-1 mb-1.5">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{backgroundColor:`${c}20`}}><CheckCircle size={7} style={{color:c}}/></div>
                  <div className="min-w-0"><p className="text-[6px] text-white leading-tight truncate">{l}</p><p className="text-[5px] text-white/30">{s}</p></div>
                </div>
              ))}
            </div>
          </div>

          {/* quick actions */}
          <div className="rounded-lg border border-white/8 bg-[#181818] p-2">
            <p className="text-[6.5px] font-semibold text-white mb-1.5">Quick Actions</p>
            <div className="grid grid-cols-4 gap-1">
              {[{icon:MessageSquare,l:'Ask AI',s:'Get instant help',c:'#6366F1'},{icon:FileText,l:'Generate Test',s:'Create custom tests',c:'#EF4444'},{icon:BookOpen,l:'View Syllabus',s:'Explore your syllabus',c:'#22C55E'},{icon:TrendingUp,l:'Study Plan',s:'Plan smarter',c:'#F97316'}].map(({icon:Icon,l,s,c})=>(
                <div key={l} className="flex items-center gap-1 rounded-md border border-white/8 bg-[#000000] p-1.5">
                  <div className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{backgroundColor:`${c}20`}}><Icon size={7} style={{color:c}}/></div>
                  <div className="min-w-0"><p className="text-[6px] font-medium text-white truncate">{l}</p><p className="text-[5px] text-white/30 truncate">{s}</p></div>
                  <ArrowRight size={6} className="text-white/20 shrink-0 ml-auto"/>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Landing() {
  const { isSignedIn } = useAuth()
  const navigate = useNavigate()
  const featuresRef = useReveal()
  const statsRef = useReveal()
  const dashRef = useReveal()
  const whyRef = useReveal()

  function go() { navigate(isSignedIn ? '/dashboard' : '/sign-up') }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap');
        .reveal { opacity: 0; transform: translateY(24px); filter: blur(4px); transition: opacity 0.8s cubic-bezier(0.32,0.72,0,1), transform 0.8s cubic-bezier(0.32,0.72,0,1), filter 0.8s cubic-bezier(0.32,0.72,0,1); }
        .reveal.revealed { opacity: 1; transform: translateY(0); filter: blur(0); }
        .word-dim { color: rgba(255,255,255,0.2); }
        .word-lit { color: rgba(255,255,255,0.9); }
        .handwrite { font-family: 'Caveat', cursive; }
      `}</style>

      <div className="flex min-h-screen flex-col bg-[#000000] text-white" style={{fontFamily:'Manrope,system-ui,sans-serif'}}>

        {/* ── Navbar ─────────────────────────────────────────────────────────── */}
        <nav className="sticky top-0 z-50 border-b border-white/8 bg-[#000000]/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
            <div className="flex items-center gap-2.5 shrink-0">
              <Logo size="sm" showWordmark={false} />
              <div>
                <p className="text-sm font-bold text-white leading-none">Academ<span className="text-[#6366F1]">IQ</span></p>
                <p className="text-[9px] tracking-[0.18em] text-white/30 uppercase leading-none mt-0.5">LEARN · PRACTICE · GROW</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-7">
              {NAV_LINKS.map((l, i) => (
                <a key={l} href="#" className={`text-sm font-medium transition-colors duration-300 ${i === 0 ? 'text-white border-b border-[#6366F1] pb-0.5' : 'text-white/50 hover:text-white'}`}>{l}</a>
              ))}
            </div>

            <div className="flex items-center gap-2.5">
              <Moon size={16} className="text-white/40 hidden sm:block" />
              {isSignedIn ? (
                <button onClick={() => navigate('/dashboard')} className="rounded-lg bg-[#6366F1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4F46E5] transition-all duration-300" style={{transition:'all 0.3s cubic-bezier(0.32,0.72,0,1)'}}>Dashboard</button>
              ) : (
                <>
                  <button onClick={() => navigate('/sign-in')} className="rounded-lg border border-white/12 px-4 py-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 transition-all duration-300">Log In</button>
                  <button onClick={go} className="rounded-lg bg-[#6366F1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4F46E5] transition-all duration-300" style={{transition:'all 0.3s cubic-bezier(0.32,0.72,0,1)'}}>Get Started</button>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden min-h-[calc(100vh-64px)] flex items-center">
          <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-[#6366F1]/8 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#22D3EE]/4 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#6366F1]/4 rounded-full blur-3xl pointer-events-none" />

          <div className="mx-auto w-full max-w-7xl px-6 py-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20 items-center">
              {/* left */}
              <div>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#6366F1]/30 bg-[#6366F1]/10 px-3.5 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] animate-pulse" />
                  <span className="text-xs font-semibold text-[#6366F1]">Your AI-Powered Study Companion</span>
                </div>

                <h1 className="text-5xl xl:text-6xl font-bold leading-[1.06] tracking-tight mb-5" style={{textWrap:'balance'}}>
                  <span style={{background:'linear-gradient(to right,#FFFFFF,#9B9B9B)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>
                    Learn Today.<br />Build{' '}
                  </span>
                  <span style={{color:'#6366F1',WebkitTextFillColor:'#6366F1',textShadow:'0 0 60px rgba(99,102,241,0.45)'}}>Tomorrow.</span>
                </h1>

                <p className="text-base text-white/50 leading-relaxed max-w-md mb-8" style={{textWrap:'pretty'}}>
                  Turn your study materials into knowledge, practice with real tests, and track your progress — all in one place.
                </p>

                <div className="flex flex-wrap gap-3 mb-8">
                  <button onClick={go} className="inline-flex items-center gap-2 rounded-xl bg-[#6366F1] px-6 py-3 text-sm font-semibold text-white hover:bg-[#4F46E5] active:scale-[0.98] transition-all" style={{boxShadow:'0 8px 32px rgba(99,102,241,0.3)',transition:'all 0.3s cubic-bezier(0.32,0.72,0,1)'}}>
                    Get Started Free <ArrowRight size={15} />
                  </button>
                  <button className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 active:scale-[0.98] transition-all" style={{transition:'all 0.3s cubic-bezier(0.32,0.72,0,1)'}}>
                    <Play size={13} className="text-[#6366F1]" /> Watch Demo
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[{icon:Upload,label:'Upload Your Books',color:'#22C55E'},{icon:Brain,label:'Learn with AI',color:'#6366F1'},{icon:FileText,label:'Take Tests',color:'#EF4444'},{icon:BarChart2,label:'Track Progress',color:'#F97316'}].map(({icon:Icon,label,color})=>(
                    <div key={label} className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/4 px-3 py-1.5">
                      <div className="w-4 h-4 rounded flex items-center justify-center" style={{backgroundColor:`${color}22`}}><Icon size={10} style={{color}}/></div>
                      <span className="text-xs text-white/60">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* right – book image */}
              <div className="hidden lg:flex items-end justify-center relative">
                <div className="absolute inset-x-0 bottom-0 h-3/4 bg-[#6366F1]/8 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-[#22D3EE]/6 rounded-full blur-2xl pointer-events-none" />
                <img
                  src="/hero-books.png"
                  alt="Study books"
                  className="relative w-full select-none"
                  style={{
                    maxWidth: '580px',
                    filter: 'drop-shadow(0 32px 64px rgba(99,102,241,0.3)) drop-shadow(0 8px 24px rgba(0,0,0,0.5))',
                  }}
                  draggable={false}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────────────────── */}
        <section id="features" className="mx-auto w-full max-w-7xl px-6 py-16">
          <div ref={featuresRef} className="reveal">
            <div className="text-center mb-12">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#6366F1]/30 bg-[#6366F1]/10 px-3.5 py-1.5">
                <span className="text-xs font-semibold text-[#6366F1]">Everything You Need</span>
              </div>
              <h2 className="text-3xl font-bold text-white md:text-4xl" style={{textWrap:'balance'}}>Powerful Features for Smarter Learning</h2>
              <p className="mt-3 text-white/40 max-w-lg mx-auto text-sm" style={{textWrap:'pretty'}}>Designed to make your study journey simpler, faster, and more effective.</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map(({icon:Icon,label,sub,color})=>(
                <div key={label} className="group rounded-2xl border border-white/8 bg-[#181818] p-6 flex flex-col gap-4 cursor-pointer"
                  style={{transition:'all 0.4s cubic-bezier(0.32,0.72,0,1)'}}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(255,255,255,0.15)')}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(255,255,255,0.08)')}>
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{backgroundColor:`${color}20`,border:`1px solid ${color}28`}}>
                      <Icon size={22} style={{color}}/>
                    </div>
                    <ArrowRight size={16} style={{color, transition:'all 0.3s cubic-bezier(0.32,0.72,0,1)'}} className="opacity-30 group-hover:opacity-80 group-hover:translate-x-0.5 mt-1"/>
                  </div>
                  <div>
                    <p className="font-bold text-white text-base">{label}</p>
                    <p className="text-sm text-white/40 mt-2 leading-relaxed" style={{textWrap:'pretty'}}>{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats ──────────────────────────────────────────────────────────── */}
        <section className="border-y border-white/8 bg-[#0d0d18]">
          <div ref={statsRef} className="reveal mx-auto max-w-7xl px-6 py-10">
            <div className="grid grid-cols-2 divide-x divide-white/8 md:grid-cols-4">
              {STATS.map(({icon:Icon,value,label,color})=>(
                <div key={label} className="flex items-center gap-4 px-8 first:pl-0 last:pr-0">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 border"
                    style={{backgroundColor:`${color}15`, borderColor:`${color}30`}}>
                    <Icon size={22} style={{color}}/>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white leading-none">{value}</p>
                    <p className="text-xs text-white/40 mt-1">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Dashboard Preview ───────────────────────────────────────────────── */}
        <section id="how-it-works" className="mx-auto w-full max-w-7xl px-6 py-24">
          <div ref={dashRef} className="reveal grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-12 xl:gap-16 items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#6366F1]/30 bg-[#6366F1]/10 px-3.5 py-1.5">
                <span className="text-xs font-semibold text-[#6366F1]">A Smarter Way to Learn</span>
              </div>
              <h2 className="text-4xl font-bold leading-tight text-white mb-5" style={{textWrap:'balance'}}>Your Complete<br />Learning Dashboard</h2>
              <p className="text-white/50 leading-relaxed mb-7 text-sm" style={{textWrap:'pretty'}}>Track progress, take tests, get AI help, and manage your study plan — all in one clean and intuitive dashboard.</p>
              <ul className="space-y-3 mb-8">
                {['Real-time progress tracking','Subject-wise organization','AI-powered learning tools','Personalized study recommendations'].map(p=>(
                  <li key={p} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#22C55E]/15 flex items-center justify-center shrink-0 border border-[#22C55E]/25">
                      <CheckCircle size={11} className="text-[#22C55E]"/>
                    </div>
                    <span className="text-sm text-white/70">{p}</span>
                  </li>
                ))}
              </ul>
              <button onClick={go} className="inline-flex items-center gap-2 rounded-xl bg-[#6366F1] px-6 py-3 text-sm font-semibold text-white hover:bg-[#4F46E5] active:scale-[0.98] transition-all"
                style={{boxShadow:'0 4px 24px rgba(99,102,241,0.25)',transition:'all 0.3s cubic-bezier(0.32,0.72,0,1)'}}>
                Explore Dashboard <ArrowRight size={15}/>
              </button>
            </div>
            <div className="relative">
              <div className="absolute -inset-6 bg-[#6366F1]/5 rounded-3xl blur-3xl pointer-events-none" />
              <div className="relative"><DashboardPreview/></div>
            </div>
          </div>
        </section>

        {/* ── Tagline reveal ──────────────────────────────────────────────────── */}
        <section className="border-t border-white/8 py-20 bg-[#181818]/30">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <TaglineReveal text="More than a study tool. A complete academic companion built to help you master any subject, any time." />
          </div>
        </section>

        {/* ── Why AcademIQ ───────────────────────────────────────────────────── */}
        <section id="educators" className="border-t border-white/8 py-24">
          <div ref={whyRef} className="reveal mx-auto max-w-7xl px-6">
            <div className="mb-14 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#6366F1]/30 bg-[#6366F1]/10 px-3.5 py-1.5">
                <span className="text-xs font-semibold text-[#6366F1]">Why AcademIQ</span>
              </div>
              <h2 className="text-3xl font-bold text-white md:text-4xl" style={{textWrap:'balance'}}>More Than Just a Study Platform</h2>
              <p className="mt-4 text-white/40 max-w-md mx-auto text-sm" style={{textWrap:'pretty'}}>Built for students, educators, and lifelong learners.</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {WHY_CARDS.map(({icon:Icon,label,sub,color})=>(
                <div key={label} className="rounded-2xl border border-white/8 bg-[#0d0d18] p-8 text-center"
                  style={{transition:'border-color 0.3s cubic-bezier(0.32,0.72,0,1)'}}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='rgba(255,255,255,0.14)')}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor='rgba(255,255,255,0.08)')}>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{backgroundColor:color}}>
                    <Icon size={26} className="text-white"/>
                  </div>
                  <h3 className="font-bold text-white mb-2 text-base">{label}</h3>
                  <p className="text-xs text-white/40 leading-relaxed" style={{textWrap:'pretty'}}>{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────────────────── */}
        <section className="border-t border-white/8">
          <div className="mx-auto max-w-7xl px-6 py-24">
            <div className="relative rounded-3xl border border-white/8 bg-[#181818] overflow-hidden p-14 text-center">
              <div className="absolute -top-28 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#6366F1]/8 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute left-8 top-1/2 -translate-y-1/2 hidden lg:block select-none" style={{transform:'translateY(-50%) rotate(-6deg)'}}>
                <div className="handwrite text-white/20 font-bold leading-tight text-center" style={{fontSize:'22px',lineHeight:'1.5'}}>
                  <div>Better</div>
                  <div>Students</div>
                  <div>Brighter</div>
                  <div>Futures</div>
                </div>
                <div className="mt-2 h-px w-10 mx-auto" style={{backgroundColor:'rgba(99,102,241,0.3)'}}/>
              </div>
              <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:block select-none" style={{transform:'translateY(-50%) rotate(6deg)'}}>
                <div className="handwrite text-white/20 font-bold leading-tight text-center" style={{fontSize:'22px',lineHeight:'1.5'}}>
                  <div>Learn</div>
                  <div>Practice</div>
                  <div>Grow</div>
                </div>
                <div className="mt-2 h-px w-8 mx-auto" style={{backgroundColor:'rgba(99,102,241,0.3)'}}/>
              </div>
              <div className="relative">
                <h2 className="text-3xl font-bold text-white md:text-4xl mb-4" style={{textWrap:'balance'}}>Ready to Start Your Learning Journey?</h2>
                <p className="text-white/40 mb-8 max-w-md mx-auto text-sm" style={{textWrap:'pretty'}}>Join thousands of learners and make your studies smarter, simpler, and more effective.</p>
                <button onClick={go} className="inline-flex items-center gap-2 rounded-xl bg-[#6366F1] px-8 py-3.5 text-sm font-semibold text-white hover:bg-[#4F46E5] active:scale-[0.98] transition-all"
                  style={{boxShadow:'0 8px 32px rgba(99,102,241,0.3)',transition:'all 0.3s cubic-bezier(0.32,0.72,0,1)'}}>
                  Get Started Free <ArrowRight size={15}/>
                </button>
                <p className="mt-3 text-xs text-white/20">No credit card required</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <footer className="border-t border-white/8 bg-[#181818]">
          <div className="mx-auto max-w-7xl px-6 py-14">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-5">
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-3">
                  <Logo size="sm" />
                </div>
                <p className="text-xs text-white/30 leading-relaxed max-w-xs" style={{textWrap:'pretty'}}>A modern learning platform to help students learn, practice, and grow with the power of AI.</p>
                <div className="mt-5 flex gap-2">
                  {['D','X','in','▶'].map(s=>(
                    <button key={s} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-[11px] text-white/40 hover:text-white hover:border-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-[#6366F1]/50">{s}</button>
                  ))}
                </div>
                <p className="mt-5 text-xs text-white/20">© 2026 AcademIQ. All rights reserved.</p>
              </div>
              {Object.entries(FOOTER).map(([section,links])=>(
                <div key={section}>
                  <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/40">{section}</p>
                  <div className="space-y-2.5">
                    {links.map(l=><a key={l} href="#" className="block text-xs text-white/25 hover:text-white transition-colors duration-200">{l}</a>)}
                  </div>
                </div>
              ))}
              <div>
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/40">Follow Us</p>
                <div className="space-y-2.5">
                  {['Discord','X (Twitter)','LinkedIn','YouTube'].map(s=><a key={s} href="#" className="block text-xs text-white/25 hover:text-white transition-colors duration-200">{s}</a>)}
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
