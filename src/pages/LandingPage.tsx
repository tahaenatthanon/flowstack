import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Briefcase, TrendingUp, Headphones, GitBranch,
  LayoutTemplate, BarChart3, Check, Globe, Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

type Lang = 'th' | 'en';

const T = {
  th: {
    nav_login: 'เข้าสู่ระบบ', nav_start: 'เริ่มต้นฟรี',
    hero_title: 'ระบบจัดการธุรกิจครบวงจร',
    hero_sub: 'โปรเจกต์ · ไปป์ไลน์การขาย · ซัพพอร์ต · BPM · คอนเทนต์ · วิเคราะห์ข้อมูล',
    hero_cta: 'ทดลองใช้ฟรี 30 วัน — ไม่ต้องใส่บัตรเครดิต',
    feat_title: 'ทุกอย่างที่ธุรกิจต้องการ ในที่เดียว',
    price_title: 'ราคาที่เหมาะกับทุกขนาดธุรกิจ',
    cta_btn: 'เริ่มต้นฟรีวันนี้',
    cta_sub: 'ทดลองใช้ฟรี 30 วัน ไม่ต้องใส่บัตรเครดิต ยกเลิกได้ทุกเมื่อ',
    footer_copy: '© 2026 Flowstack — ระบบจัดการธุรกิจครบวงจร',
    free: 'ฟรี', contact: 'ติดต่อ', unlimited: 'ไม่จำกัด',
    day_trial: 'วันทดลองใช้', users: 'ผู้ใช้', per_month: '/เดือน',
    recommended: 'แนะนำ', choose: 'เลือกแผนนี้', start_now: 'เริ่มต้นเลย', contact_us: 'ติดต่อทีม',
  },
  en: {
    nav_login: 'Log in', nav_start: 'Start Free',
    hero_title: 'All-in-One Business Management Platform',
    hero_sub: 'Projects · Sales Pipeline · Support Helpdesk · BPM · Content · Analytics',
    hero_cta: 'Try free for 30 days — no credit card required',
    feat_title: 'Everything your business needs, in one place',
    price_title: 'Pricing for every business size',
    cta_btn: 'Start free today',
    cta_sub: 'Free 30-day trial. No credit card. Cancel anytime.',
    footer_copy: '© 2026 Flowstack — All-in-One Business Management',
    free: 'Free', contact: 'Contact', unlimited: 'Unlimited',
    day_trial: '-day trial', users: 'users', per_month: '/month',
    recommended: 'Popular', choose: 'Choose plan', start_now: 'Start now', contact_us: 'Contact us',
  },
} as const;

const FEATURES = {
  th: [
    { icon: Briefcase,      title: 'โปรเจกต์และงาน',       desc: 'จัดการโปรเจกต์, งาน, WBS และบันทึกชั่วโมงการทำงาน' },
    { icon: TrendingUp,     title: 'ไปป์ไลน์การขาย',       desc: 'ติดตามโอกาสการขาย ใบเสนอราคา และปิดดีล' },
    { icon: Headphones,     title: 'ระบบซัพพอร์ต',         desc: 'จัดการคำร้องลูกค้าพร้อม SLA และ AI ช่วยวิเคราะห์' },
    { icon: GitBranch,      title: 'กระบวนการทำงาน (BPM)', desc: 'ออกแบบกระบวนการทำงาน ตรวจคอขวด วิเคราะห์ประสิทธิภาพ' },
    { icon: LayoutTemplate, title: 'วางแผนคอนเทนต์',       desc: 'วางแผนคอนเทนต์หลายแพลตฟอร์ม ส่งอีเมลแคมเปญ' },
    { icon: BarChart3,      title: 'วิเคราะห์ข้อมูลและ KPI', desc: 'แดชบอร์ดภาพรวม รายงาน KPI รายบุคคลและทีม' },
  ],
  en: [
    { icon: Briefcase,      title: 'Projects & Tasks',  desc: 'Manage projects, tasks, WBS and log work hours' },
    { icon: TrendingUp,     title: 'Sales Pipeline',    desc: 'Track opportunities, quotations and close deals' },
    { icon: Headphones,     title: 'Support Helpdesk',  desc: 'Manage customer tickets with SLA and AI analysis' },
    { icon: GitBranch,      title: 'BPM Workflow',      desc: 'Design workflows, detect bottlenecks, analyze performance' },
    { icon: LayoutTemplate, title: 'Content Planner',   desc: 'Plan multi-platform content and send email campaigns' },
    { icon: BarChart3,      title: 'Analytics & KPI',   desc: 'Overview dashboard, KPI reports for individuals and teams' },
  ],
};

const PLAN_FEATURES = {
  th: ['โปรเจกต์และงาน', 'ไปป์ไลน์การขาย', 'ระบบซัพพอร์ต', 'กระบวนการทำงาน (BPM)', 'วางแผนคอนเทนต์', 'วิเคราะห์ข้อมูลและ KPI'],
  en: ['Projects & Tasks', 'Sales Pipeline', 'Support Helpdesk', 'BPM Workflow', 'Content Planner', 'Analytics & KPI'],
};

function usePlans() {
  return useQuery<any[]>({
    queryKey: ['landing-plans'],
    queryFn: () => apiFetch('/billing/plans.php'),
    staleTime: 300_000,
  });
}

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('th');
  const t = T[lang];
  const features = FEATURES[lang];
  const planFeats = PLAN_FEATURES[lang];
  const { data: planLimits = [], isLoading: plansLoading } = usePlans();

  const buildPlans = () => {
    if (plansLoading || planLimits.length === 0) return null;
    return planLimits.map((pl: any) => {
      const price    = Number(pl.price_thb);
      const maxUsers = Number(pl.max_users);
      const isTrial  = pl.plan === 'trial';
      const isEnt    = pl.plan === 'enterprise';
      return {
        key:      pl.plan,
        name:     lang === 'th'
          ? ({ trial: 'ทดลองใช้', starter: 'เริ่มต้น', pro: 'มืออาชีพ', enterprise: 'องค์กร' } as Record<string,string>)[pl.plan] ?? pl.plan
          : pl.plan.charAt(0).toUpperCase() + pl.plan.slice(1),
        priceRaw: price,
        priceDisplay: isTrial ? t.free : isEnt ? t.contact : `฿${price.toLocaleString()}`,
        period: isTrial
          ? (lang === 'th' ? `${pl.trial_days} ${t.day_trial}` : `${pl.trial_days}${t.day_trial}`)
          : isEnt ? '' : t.per_month,
        users:     maxUsers === 0 ? t.unlimited : `${maxUsers} ${t.users}`,
        cta:       isTrial ? t.start_now : isEnt ? t.contact_us : t.choose,
        highlight: pl.plan === 'pro',
        badge:     pl.plan === 'pro' ? t.recommended : undefined,
      };
    });
  };

  const plans = buildPlans();

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-primary">Flowstack</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(l => l === 'th' ? 'en' : 'th')}
              className="flex items-center gap-1 text-xs border rounded-full px-2.5 py-1 hover:bg-slate-50 transition-colors"
            >
              <Globe className="h-3 w-3" />{lang === 'th' ? 'EN' : 'TH'}
            </button>
            <Link to="/auth"><Button variant="ghost" size="sm">{t.nav_login}</Button></Link>
            <Link to="/auth?mode=signup"><Button size="sm">{t.nav_start}</Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-4 text-center bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-3xl mx-auto">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">{lang === 'th' ? 'แพลตฟอร์มจัดการธุรกิจ' : 'SaaS Platform'}</Badge>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight mb-4">{t.hero_title}</h1>
          <p className="text-lg text-slate-500 mb-8">{t.hero_sub}</p>
          <Link to="/auth?mode=signup">
            <Button size="lg" className="gap-2 px-8">{t.hero_cta}</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">{t.feat_title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border p-6 hover:shadow-md transition-shadow">
                <f.icon className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
                <p className="text-slate-500 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">{t.price_title}</h2>
          {plansLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="rounded-xl border p-6 bg-white space-y-4">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-4 w-16" />
                  <div className="space-y-2">
                    {[1,2,3,4,5,6].map(j => <Skeleton key={j} className="h-4 w-full" />)}
                  </div>
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          ) : plans ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan) => (
                <div key={plan.key} className={`rounded-xl border p-6 bg-white flex flex-col gap-4 ${plan.highlight ? 'border-primary ring-2 ring-primary/20 shadow-lg' : ''}`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg">{plan.name}</h3>
                      {plan.badge && <Badge className="text-xs bg-primary text-primary-foreground">{plan.badge}</Badge>}
                    </div>
                    <div className="text-3xl font-bold text-slate-900">
                      {plan.priceDisplay}
                      {plan.period && <span className="text-sm font-normal text-slate-500 ml-1">{plan.period}</span>}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">{plan.users}</div>
                  </div>
                  <ul className="space-y-2 flex-1">
                    {planFeats.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth?mode=signup">
                    <Button className="w-full" variant={plan.highlight ? 'default' : 'outline'}>{plan.cta}</Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-primary text-primary-foreground text-center">
        <h2 className="text-3xl font-bold mb-2">
          {lang === 'th' ? 'พร้อมเริ่มต้นแล้วหรือยัง?' : 'Ready to get started?'}
        </h2>
        <p className="mb-6 opacity-90">{t.cta_sub}</p>
        <Link to="/auth?mode=signup">
          <Button size="lg" variant="secondary" className="px-10">{t.cta_btn}</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t text-center text-sm text-slate-500">
        <p>{t.footer_copy}</p>
      </footer>
    </div>
  );
}
