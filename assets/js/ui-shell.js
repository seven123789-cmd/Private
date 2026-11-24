/* ui-shell.js — 画面の枠（スマホ用メニュー）だけを扱うUI専用スクリプト
   ・業務ロジック、Supabase、既存のID・イベントには一切触れない。
   ・幅860px以下で、サイドバーを左から開くメニューにする（表示はCSSで制御）。
   ・このファイルを読み込まなくても、既存画面はそのまま動作する。 */
(() => {
  'use strict';
  const init = () => {
    const sidebar = document.getElementById('sidebar');
    const shell = document.querySelector('.app-shell');
    if (!sidebar || !shell || document.querySelector('.ui-topbar')) return;

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
