/* AI 提示词浮窗 —— 样式（注入到 Shadow DOM，避免与宿主站点 CSS 互相污染）
 * 全局变量：AIPF_CSS
 */
globalThis.AIPF_CSS = `
:host { all: initial; }

.aipf-panel,
.aipf-panel *,
.aipf-ball,
.aipf-toast {
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Microsoft YaHei", "Hiragino Sans GB", sans-serif;
}

/* ------------------------------------------------ 悬浮球 */
.aipf-ball {
  position: fixed;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #4f7cff, #7a5cff);
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  cursor: grab;
  user-select: none;
  touch-action: none;
  box-shadow: 0 6px 18px rgba(60, 90, 220, 0.36), inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease;
  opacity: 0.94;
}
.aipf-ball:hover { transform: scale(1.07); opacity: 1; }
.aipf-ball:active { cursor: grabbing; }
.aipf-ball[data-active="1"] {
  background: linear-gradient(135deg, #2f5df0, #5b3de0);
  box-shadow: 0 6px 22px rgba(50, 70, 200, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.22);
}
.aipf-ball svg { width: 22px; height: 22px; display: block; }

/* ------------------------------------------------ 面板 */
.aipf-panel {
  --aipf-bg: #ffffff;
  --aipf-bg-soft: #f5f6fa;
  --aipf-bg-hover: #eef1f9;
  --aipf-fg: #1e2230;
  --aipf-fg-dim: #6b7285;
  --aipf-line: #e4e7ef;
  --aipf-accent: #4f7cff;
  --aipf-danger: #e04a4a;
  position: fixed;
  width: 344px;
  max-height: min(68vh, 620px);
  display: flex;
  flex-direction: column;
  background: var(--aipf-bg);
  color: var(--aipf-fg);
  border-radius: 14px;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.55;
  box-shadow: 0 18px 48px rgba(14, 20, 45, 0.26), 0 0 0 1px rgba(120, 130, 165, 0.2);
}
:host([data-theme="dark"]) .aipf-panel {
  --aipf-bg: #1d2027;
  --aipf-bg-soft: #262a33;
  --aipf-bg-hover: #2e3340;
  --aipf-fg: #e8eaf0;
  --aipf-fg-dim: #9aa1b1;
  --aipf-line: #343a46;
  --aipf-accent: #7a9cff;
  --aipf-danger: #ff6b6b;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.07);
}
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) .aipf-panel {
    --aipf-bg: #1d2027;
    --aipf-bg-soft: #262a33;
    --aipf-bg-hover: #2e3340;
    --aipf-fg: #e8eaf0;
    --aipf-fg-dim: #9aa1b1;
    --aipf-line: #343a46;
    --aipf-accent: #7a9cff;
    --aipf-danger: #ff6b6b;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.07);
  }
}
.aipf-panel[hidden] { display: none !important; }

.aipf-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 10px 10px 14px;
  background: var(--aipf-bg-soft);
  border-bottom: 1px solid var(--aipf-line);
  flex: 0 0 auto;
}
.aipf-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
}
.aipf-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--aipf-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--aipf-accent) 22%, transparent);
}
.aipf-count { color: var(--aipf-fg-dim); font-weight: 400; font-size: 12px; }
.aipf-head-actions { display: flex; align-items: center; gap: 2px; }

.aipf-icon {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--aipf-fg-dim);
  width: 26px;
  height: 26px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s ease, color 0.12s ease;
  font-family: inherit;
  padding: 0;
}
.aipf-icon:hover { background: var(--aipf-bg-hover); color: var(--aipf-fg); }
.aipf-icon.sm { width: 22px; height: 22px; font-size: 12px; }
.aipf-icon.danger:hover { color: var(--aipf-danger); }

.aipf-view { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }
.aipf-view[hidden] { display: none !important; }

.aipf-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--aipf-line);
  flex: 0 0 auto;
}
.aipf-search input {
  flex: 1 1 auto;
  min-width: 0;
  appearance: none;
  border: 1px solid var(--aipf-line);
  background: var(--aipf-bg-soft);
  color: var(--aipf-fg);
  border-radius: 8px;
  padding: 6px 9px;
  font-size: 12.5px;
  outline: none;
  font-family: inherit;
}
.aipf-search input:focus { border-color: var(--aipf-accent); }
.aipf-mode {
  flex: 0 0 auto;
  font-size: 11.5px;
  color: var(--aipf-fg-dim);
  border: 1px solid var(--aipf-line);
  border-radius: 999px;
  padding: 3px 9px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  background: transparent;
}
.aipf-mode:hover { color: var(--aipf-fg); background: var(--aipf-bg-hover); }

.aipf-list { overflow-y: auto; overflow-x: hidden; padding: 6px; flex: 1 1 auto; min-height: 0; }
.aipf-list::-webkit-scrollbar { width: 9px; }
.aipf-list::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--aipf-fg-dim) 34%, transparent);
  border-radius: 9px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.aipf-list::-webkit-scrollbar-track { background: transparent; }

.aipf-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 9px;
  border-radius: 9px;
  cursor: pointer;
  transition: background 0.12s ease;
}
.aipf-item:hover { background: var(--aipf-bg-hover); }
.aipf-item + .aipf-item { margin-top: 1px; }
.aipf-item-main { min-width: 0; flex: 1 1 auto; }
.aipf-item-title {
  font-weight: 600;
  font-size: 12.8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.aipf-item-preview {
  color: var(--aipf-fg-dim);
  font-size: 11.6px;
  margin-top: 1px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
.aipf-item-actions {
  display: flex;
  gap: 1px;
  opacity: 0;
  transition: opacity 0.12s ease;
  flex: 0 0 auto;
}
.aipf-item:hover .aipf-item-actions,
.aipf-item:focus-within .aipf-item-actions { opacity: 1; }

.aipf-empty {
  padding: 26px 16px;
  text-align: center;
  color: var(--aipf-fg-dim);
  font-size: 12.5px;
}
.aipf-empty[hidden] { display: none !important; }
.aipf-empty-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 12px;
}

.aipf-form { padding: 12px; display: flex; flex-direction: column; gap: 7px; overflow-y: auto; }
.aipf-label { font-size: 11.5px; color: var(--aipf-fg-dim); font-weight: 600; letter-spacing: 0.3px; }
.aipf-input,
.aipf-textarea,
.aipf-select {
  appearance: none;
  width: 100%;
  border: 1px solid var(--aipf-line);
  background: var(--aipf-bg-soft);
  color: var(--aipf-fg);
  border-radius: 8px;
  padding: 7px 9px;
  font-size: 12.8px;
  font-family: inherit;
  outline: none;
  resize: vertical;
}
.aipf-input:focus,
.aipf-textarea:focus,
.aipf-select:focus { border-color: var(--aipf-accent); }
.aipf-textarea { min-height: 132px; line-height: 1.6; }

.aipf-row { display: flex; align-items: center; gap: 8px; }
.aipf-row-end { justify-content: flex-end; margin-top: 4px; }
.aipf-row-between { justify-content: space-between; }

.aipf-btn {
  appearance: none;
  border: 1px solid transparent;
  background: var(--aipf-accent);
  color: #fff;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 12.5px;
  cursor: pointer;
  font-family: inherit;
  transition: filter 0.12s ease, background 0.12s ease;
}
.aipf-btn:hover { filter: brightness(1.07); }
.aipf-btn:disabled { opacity: 0.5; cursor: default; filter: none; }
.aipf-btn.ghost {
  background: transparent;
  color: var(--aipf-fg);
  border-color: var(--aipf-line);
}
.aipf-btn.ghost:hover { background: var(--aipf-bg-hover); filter: none; }
.aipf-btn.ghost[data-on="1"] {
  border-color: var(--aipf-accent);
  color: var(--aipf-accent);
  background: color-mix(in srgb, var(--aipf-accent) 12%, transparent);
}
.aipf-btn.ghost.danger { color: var(--aipf-danger); }
.aipf-btn.ghost.danger:hover {
  background: color-mix(in srgb, var(--aipf-danger) 12%, transparent);
}

.aipf-settings { padding: 12px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
.aipf-group { display: flex; flex-direction: column; gap: 6px; }
.aipf-radio { display: flex; align-items: flex-start; gap: 7px; cursor: pointer; font-size: 12.5px; }
.aipf-radio input { margin: 2px 0 0; accent-color: var(--aipf-accent); }
.aipf-radio small { display: block; color: var(--aipf-fg-dim); font-size: 11.3px; }
.aipf-actions { display: flex; flex-wrap: wrap; gap: 7px; }
.aipf-hint { color: var(--aipf-fg-dim); font-size: 11.3px; }
.aipf-hint a { color: var(--aipf-accent); text-decoration: none; }
.aipf-hint a:hover { text-decoration: underline; }
.aipf-hint[data-kind="error"] { color: var(--aipf-danger); }
.aipf-hint[data-kind="ok"] { color: var(--aipf-fg); }
.aipf-hint[data-role="notion-status"] { overflow-wrap: anywhere; }
.aipf-kbd {
  border: 1px solid var(--aipf-line);
  border-bottom-width: 2px;
  border-radius: 5px;
  padding: 0 5px;
  font-size: 11px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  background: var(--aipf-bg-soft);
}
.aipf-sep { height: 1px; background: var(--aipf-line); }

.aipf-foot {
  flex: 0 0 auto;
  border-top: 1px solid var(--aipf-line);
  background: var(--aipf-bg-soft);
  color: var(--aipf-fg-dim);
  font-size: 11.2px;
  padding: 6px 12px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
}
.aipf-foot a { color: var(--aipf-accent); text-decoration: none; }

/* ------------------------------------------------ 轻提示 */
.aipf-toast {
  position: fixed;
  background: rgba(28, 32, 44, 0.94);
  color: #fff;
  font-size: 12.5px;
  padding: 7px 14px;
  border-radius: 999px;
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.18s ease, transform 0.18s ease;
  max-width: 340px;
  text-align: center;
}
.aipf-toast[data-show="1"] { opacity: 1; transform: translateY(0); }
.aipf-toast[data-kind="error"] { background: rgba(196, 48, 48, 0.96); }
`;
