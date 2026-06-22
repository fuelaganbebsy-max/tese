import { useEffect, useState } from 'react';
import {
  fetchSchools,
  login as loginRequest,
  credentialsComplete,
  type School,
} from '../auth/api';
import { makeSession, saveSession } from '../auth/session';

interface Props {
  onEnter: () => void;
}

const ERROR_TEXT: Record<string, string> = {
  not_authorized: '学校、姓名或学号/工号不匹配，请核对后重试。',
  invalid_input: '请填写学校、姓名和学号/工号。',
  server_error: '服务暂时不可用，请稍后再试。',
  network_error: '网络异常，无法连接服务器。',
  schools_unavailable: '学校列表加载失败，请刷新重试。',
};

const FEATURES = [
  {
    icon: 'view_in_ar',
    title: '实时 3D 渲染',
    desc: '参数变动即刻反映到钢筋骨架与混凝土模型，所见即所得。',
  },
  {
    icon: 'schema',
    title: '22G101 规范',
    desc: '自动计算锚固长度、弯钩、箍筋加密区，严格遵循国标图集。',
  },
  {
    icon: 'dashboard',
    title: '多构件支持',
    desc: '框架梁 KL、次梁 L、屋面梁 WKL、悬挑梁 XL、柱 KZ 一站覆盖。',
  },
  {
    icon: 'tune',
    title: '参数化设计',
    desc: '截面尺寸、配筋规格、跨度、支座条件等全参数实时可调。',
  },
  {
    icon: 'file_upload',
    title: '导入 / 导出',
    desc: '以 JSON 格式保存和加载设计方案，方便多次复用与协作。',
  },
  {
    icon: 'devices',
    title: '响应式布局',
    desc: '自适应宽屏与平板尺寸，侧栏和面板随窗口智能折叠。',
  },
];

export function LandingPage({ onEnter }: Props) {
  const [leaving, setLeaving] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolsError, setSchoolsError] = useState(false);
  const [schoolId, setSchoolId] = useState('');
  const [name, setName] = useState('');
  const [identityCode, setIdentityCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSchools()
      .then((list) => {
        if (alive) setSchools(list);
      })
      .catch(() => {
        if (alive) setSchoolsError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const canSubmit =
    !submitting && credentialsComplete({ schoolId, name, identityCode });

  const handleEnter = () => {
    setLeaving(true);
    setTimeout(onEnter, 320);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!credentialsComplete({ schoolId, name, identityCode })) {
      setError(ERROR_TEXT.invalid_input);
      return;
    }
    setSubmitting(true);
    const result = await loginRequest({ schoolId, name, identityCode });
    setSubmitting(false);
    if (result.ok) {
      saveSession(makeSession(result.school, result.name));
      handleEnter();
    } else {
      setError(ERROR_TEXT[result.reason] ?? ERROR_TEXT.server_error);
    }
  };

  return (
    <div
      className="min-h-screen w-screen overflow-y-auto bg-background text-on-background antialiased"
      style={{
        transition: 'opacity 300ms ease',
        opacity: leaving ? 0 : 1,
      }}
    >
      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-16 bg-background/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2 font-display-lg text-headline-md text-primary-fixed-dim tracking-tight">
          <span
            className="material-symbols-outlined text-primary-fixed-dim"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            view_in_ar
          </span>
          Octopus的AI钢筋平法工具
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center text-center min-h-screen px-6 pt-16 overflow-hidden">
        {/* Background glow blobs */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(0,218,243,0.07) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(0,218,243,0.04) 0%, transparent 70%)',
          }}
        />

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary-fixed-dim/30 bg-primary-fixed-dim/10 text-primary-fixed-dim text-body-sm mb-6">
          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified
          </span>
          按22G101国标图集构建
        </div>

        {/* Title */}
        <h1
          className="font-display-lg text-on-surface mb-4 max-w-3xl"
          style={{ fontSize: 'clamp(2.2rem, 6vw, 4rem)', lineHeight: 1.1, fontWeight: 700, letterSpacing: '-0.02em' }}
        >
          AI钢筋平法
          <span
            style={{
              background: 'linear-gradient(90deg, #00daf3 0%, #9cf0ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            3D可视化
          </span>
          工具
        </h1>

        {/* Subtitle */}
        <p className="text-on-surface-variant max-w-xl mb-10 text-body-md leading-relaxed" style={{ fontSize: '1rem' }}>
          在浏览器中即时生成框架梁、柱等构件的三维钢筋骨架与混凝土模型。<br />
          纯前端运行，无需安装，无需后端，开箱即用。
        </p>

        {/* Login card */}
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface-container/80 backdrop-blur-md p-6 text-left shadow-2xl"
          style={{ borderColor: 'rgba(0,218,243,0.15)' }}
        >
          <div className="flex items-center gap-2 mb-5 text-on-surface font-semibold">
            <span className="material-symbols-outlined text-primary-fixed-dim text-[20px]">login</span>
            登录以进入系统
          </div>

          <label className="block text-body-sm text-on-surface-variant mb-1.5">学校</label>
          <select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            disabled={schoolsError}
            className="w-full mb-4 px-3 py-2.5 rounded-DEFAULT bg-background/60 border border-white/10 text-on-surface text-body-md focus:outline-none focus:border-primary-fixed-dim disabled:opacity-50"
          >
            <option value="" disabled>
              {schoolsError ? '学校列表加载失败' : '请选择学校'}
            </option>
            {schools.map((s) => (
              <option key={String(s.id)} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>

          <label className="block text-body-sm text-on-surface-variant mb-1.5">姓名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入姓名"
            autoComplete="off"
            className="w-full mb-4 px-3 py-2.5 rounded-DEFAULT bg-background/60 border border-white/10 text-on-surface text-body-md focus:outline-none focus:border-primary-fixed-dim placeholder:text-on-surface-variant/50"
          />

          <label className="block text-body-sm text-on-surface-variant mb-1.5">学号 / 工号</label>
          <input
            type="text"
            value={identityCode}
            onChange={(e) => setIdentityCode(e.target.value)}
            placeholder="请输入学号或工号"
            autoComplete="off"
            className="w-full mb-2 px-3 py-2.5 rounded-DEFAULT bg-background/60 border border-white/10 text-on-surface text-body-md focus:outline-none focus:border-primary-fixed-dim placeholder:text-on-surface-variant/50"
          />

          {error && (
            <p className="flex items-center gap-1.5 text-error text-body-sm mb-2" style={{ color: '#ff6b6b' }}>
              <span className="material-symbols-outlined text-[16px]">error</span>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 w-full flex items-center justify-center gap-2 px-8 py-3 rounded-DEFAULT bg-primary-fixed-dim text-on-primary font-semibold text-body-md hover:bg-primary-fixed transition-all duration-200 active:scale-95 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            style={{ boxShadow: '0 0 24px rgba(0,218,243,0.25)' }}
          >
            <span className="material-symbols-outlined text-[18px]">
              {submitting ? 'progress_activity' : 'rocket_launch'}
            </span>
            {submitting ? '登录中…' : '登录并进入'}
          </button>
        </form>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-on-surface-variant/50 text-body-sm animate-bounce">
          <span className="material-symbols-outlined text-[20px]">keyboard_arrow_down</span>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2
            className="font-display-lg text-on-surface mb-3"
            style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 700, letterSpacing: '-0.015em' }}
          >
            为建筑工程识图打造
          </h2>
          <p className="text-on-surface-variant text-body-md max-w-md mx-auto">
            覆盖日常平法识图与配筋校验所需的核心功能
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.icon}
              className="group relative rounded-xl p-6 border border-white/5 bg-surface-container hover:border-primary-fixed-dim/30 transition-all duration-300 overflow-hidden"
              style={{ background: 'rgba(29,32,34,0.8)' }}
            >
              {/* Hover glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 50% 0%, rgba(0,218,243,0.06) 0%, transparent 70%)' }}
              />
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 shrink-0"
                style={{ background: 'rgba(0,218,243,0.1)' }}
              >
                <span
                  className="material-symbols-outlined text-primary-fixed-dim text-[22px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {f.icon}
                </span>
              </div>
              <h3 className="font-semibold text-on-surface mb-2" style={{ fontSize: '0.95rem' }}>
                {f.title}
              </h3>
              <p className="text-on-surface-variant text-body-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-8 text-center text-on-surface-variant text-body-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span
            className="material-symbols-outlined text-primary-fixed-dim text-[16px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            view_in_ar
          </span>
          <span className="text-on-surface font-semibold">Octopus的AI钢筋平法工具</span>
        </div>
      </footer>
    </div>
  );
}
