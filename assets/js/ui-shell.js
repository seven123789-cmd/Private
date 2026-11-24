/* ui-shell.js — 画面の枠と見た目の設定だけを扱うUI専用スクリプト
   ・業務ロジック、Supabase、既存のID・イベントには一切触れない。
   ・<head> で読み込み、配色テーマを描画前に反映する（ちらつき防止）。
   ・機能：①配色テーマの適用と切替（端末ごとに localStorage へ保存）
           ②サイドバーのアイコン表示 ③幅860px以下の開閉式メニュー
   ・このファイルを読み込まなくても、既存画面はそのまま動作する。 */
(() => {
  'use strict';

  /* ① 配色テーマ ------------------------------------------------------ */
  const THEME_KEY = 'ui_theme_v1';
  const DEFAULT_THEME = 'forest'; // 既定の配色（2026-11-24：グリーン×オレンジに変更）
  const THEMES = [
    { id: 'imperial', label: '帝劇モダン' },
    { id: 'navy', label: 'ネイビー' },
    { id: 'violet', label: 'バイオレット' },
    { id: 'wine', label: 'ホワイト×ワイン' },
    { id: 'forest', label: 'グリーン×オレンジ' }
  ];
  const readTheme = () => {
    try { const v = localStorage.getItem(THEME_KEY); return THEMES.some(t => t.id === v) ? v : DEFAULT_THEME; }
    catch { return DEFAULT_THEME; }
  };
  const applyTheme = (id) => {
    document.documentElement.setAttribute('data-theme', id);
    try { localStorage.setItem(THEME_KEY, id); } catch { /* 保存できない環境では今回の表示のみ */ }
    document.querySelectorAll('.ui-theme-chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeValue === id)));
  };
  document.documentElement.setAttribute('data-theme', readTheme());

  /* ② サイドバーのアイコン ------------------------------------------- */
  const P = {
    index: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    employees: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.6.8 2.6 2.5 3 5.2"/>',
    monthly_management: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 14h3M13.5 14h3M7.5 17.5h3"/>',
    promotion: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/><path d="m14 7 3-3 3 3"/>',
    licenses: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5.5 16c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2M14 10h4.5M14 13.5h3"/>',
    facility: '<path d="M3 21V8l6-4 6 4v13M15 12h6v9M3 21h18"/><path d="M7 11h4M7 15h4"/>',
    alerts: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2.5h-15z"/><path d="M10 21h4"/>',
    masters: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.6M12 18.9v2.6M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12h2.6M18.9 12h2.6M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/>',
    master_import: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17"/>',
    data_operations: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6M4 11.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    external_links: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
    system: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'
  };
  const svg = (k) => `<span class="ui-nav-ico" aria-hidden="true"><svg viewBox="0 0 24 24">${P[k] || P.system}</svg></span>`;

  const decorateSidebar = (sidebar) => {
    sidebar.querySelectorAll('.imperial-menu-card').forEach(a => {
      if (a.querySelector('.ui-nav-ico')) return;
      const key = a.dataset.menu || (a.classList.contains('imperial-system-menu-card') ? 'system' : '');
      a.insertAdjacentHTML('afterbegin', svg(key));
    });
    if (sidebar.querySelector('.imperial-nav') && !sidebar.querySelector('.ui-theme-switch')) {
      const box = document.createElement('div');
      box.className = 'ui-theme-switch';
      box.innerHTML = '<span class="ui-theme-switch__label">表示テーマ</span><div class="ui-theme-switch__row">'
        + THEMES.map(t => `<button type="button" class="ui-theme-chip" data-theme-value="${t.id}" title="${t.label}" aria-label="表示テーマ：${t.label}" aria-pressed="false"></button>`).join('')
        + '</div>';
      box.addEventListener('click', (e) => { const b = e.target.closest('.ui-theme-chip'); if (b) applyTheme(b.dataset.themeValue); });
      const account = sidebar.querySelector('.sidebar-account');
      if (account) account.before(box); else sidebar.appendChild(box);
      applyTheme(readTheme());
    }
  };

  /* ③ 開閉式メニュー（幅860px以下。表示はCSSで制御） ---------------- */
  const init = () => {
    const sidebar = document.getElementById('sidebar');
    const shell = document.querySelector('.app-shell');
    if (!sidebar || !shell) return;

    decorateSidebar(sidebar);
    new MutationObserver(() => decorateSidebar(sidebar)).observe(sidebar, { childList: true });

    if (document.querySelector('.ui-topbar')) return;
    const titleEl = document.querySelector('.page-title');
    const title = (titleEl?.textContent || document.title.split('—')[0] || '').trim();

    const bar = document.createElement('header');
    bar.className = 'ui-topbar';
    bar.innerHTML = '<button type="button" class="ui-topbar__menu" aria-label="メニューを開く" aria-expanded="false" aria-controls="sidebar"><span></span></button>'
      + '<div class="ui-topbar__title"></div><div class="ui-topbar__brand">統合管理システム</div>';
    bar.querySelector('.ui-topbar__title').textContent = title;
    shell.parentNode.insertBefore(bar, shell);

    const backdrop = document.createElement('div');
    backdrop.className = 'ui-nav-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);

    const btn = bar.querySelector('.ui-topbar__menu');
    const setOpen = (open) => {
      document.body.classList.toggle('ui-nav-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    };
    btn.addEventListener('click', () => setOpen(!document.body.classList.contains('ui-nav-open')));
    backdrop.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    sidebar.addEventListener('click', (e) => { if (e.target.closest('a[href]')) setOpen(false); });
    window.matchMedia('(min-width: 861px)').addEventListener?.('change', (m) => { if (m.matches) setOpen(false); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
