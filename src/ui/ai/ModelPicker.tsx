import { useState } from 'react';
import { useAiStore } from './aiStore';
import { PROVIDERS } from './providers';

export function ModelPicker() {
  const [showConfig, setShowConfig] = useState(false);
  const [tempKey, setTempKey] = useState('');

  const activeProviderId = useAiStore((s) => s.activeProviderId);
  const apiKeys = useAiStore((s) => s.apiKeys);
  const setApiKey = useAiStore((s) => s.setApiKey);
  const setActiveProvider = useAiStore((s) => s.setActiveProvider);

  const currentProvider = PROVIDERS.find((p) => p.config.id === activeProviderId) ?? PROVIDERS[0];
  const hasKey = !!apiKeys[activeProviderId];

  const handleOpenConfig = () => {
    setTempKey(apiKeys[activeProviderId] ?? '');
    setShowConfig(true);
  };

  const handleSave = () => {
    setApiKey(activeProviderId, tempKey.trim());
    setShowConfig(false);
  };

  const handleClearKey = () => {
    setApiKey(activeProviderId, '');
    setTempKey('');
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <select
          value={activeProviderId}
          onChange={(e) => {
            const p = PROVIDERS.find((pr) => pr.config.id === e.target.value);
            setActiveProvider(e.target.value, p?.config.defaultModel);
          }}
          className="bg-surface-container-lowest border border-white/10 rounded text-[12px] text-on-surface-variant px-2 py-1 focus:border-primary-fixed-dim focus:outline-none transition-colors appearance-none cursor-pointer"
          style={{ paddingRight: '24px' }}
        >
          {PROVIDERS.map((p) => (
            <option key={p.config.id} value={p.config.id}>
              {p.config.displayName}
            </option>
          ))}
        </select>

        <button
          onClick={handleOpenConfig}
          title={hasKey ? 'API Key 已配置，点击修改' : '配置 API Key（可选）'}
          className="p-1 rounded text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">
            {hasKey ? 'key' : 'settings'}
          </span>
        </button>
      </div>

      {showConfig && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
          onClick={(e) => e.target === e.currentTarget && setShowConfig(false)}
        >
          <div className="bg-surface-container border border-white/10 rounded-xl p-5 w-[320px] shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-fixed-dim text-[18px]">key</span>
                <h3 className="text-sm font-semibold text-on-surface">
                  {currentProvider.config.displayName} API Key
                </h3>
              </div>
              <button
                onClick={() => setShowConfig(false)}
                className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="relative mb-3">
              <input
                type="password"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="粘贴你的 API Key…"
                autoFocus
                className="w-full bg-surface-container-lowest border border-white/10 rounded-lg px-3 py-2 text-[13px] text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim/30 outline-none transition-colors"
              />
              {tempKey && (
                <button
                  onClick={handleClearKey}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-on-surface-variant/60 mb-4 leading-relaxed">
              Key 仅保存在本地浏览器，不会上传或共享。
              <a
                href={currentProvider.config.apiKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-fixed-dim/80 hover:text-primary-fixed-dim ml-1 underline-offset-2 hover:underline"
              >
                获取 Key →
              </a>
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfig(false)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-[12px] text-on-surface-variant hover:bg-white/5 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!tempKey.trim()}
                className="flex-1 py-2 rounded-lg bg-primary-fixed-dim text-on-primary text-[12px] font-semibold hover:bg-primary-fixed transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
