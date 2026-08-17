const APP = (() => {
  const LS_KEY = 'license_sakuran_v1';
  const today  = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (v) => {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit', timeZone:'Asia/Tokyo' }).format(d);
  };
  const daysUntil = (v) => {
    if (!v) return null;
    const t = new Date(v); t.setHours(0,0,0,0);
    const n = new Date(); n.setHours(0,0,0,0);
    return Math.round((t - n) / 86400000);
  };
  const normStatus = (status, date) => {
    if (status) return status;
    const d = daysUntil(date);
    if (d === null) return '期限なし';
    if (d < 0)   return '期限切れ';
    if (d <= 30) return '30日以内';
    if (d <= 90) return '90日以内';
    return '正常';
  };
  const statusClass = (s) => {
    const v = String(s || '');
    if (v.includes('期限切れ')) return 'danger';
    if (v.includes('30'))       return 'warning';
    if (v.includes('90'))       return 'info';
    if (v.includes('正常'))     return 'success';
    return 'gray';
  };
  const escape = (v) => String(v ?? '').replace(/[&<>'"]/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const badge = (text, type = 'gray') =>
    `<span class="badge badge-${type}">${escape(text)}</span>`;
  const alertBadge = (status, date) => {
    const s = normStatus(status, date);
    return badge(s, statusClass(s));
  };
  const toast = (message, type = 'success') => {
    const old = document.querySelector('.toast'); if (old) old.remove();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icon = { success:'✦', warning:'⚠', error:'✕' }[type] || '◆';
    el.innerHTML = `<span>${icon}</span><span>${escape(message)}</span>`;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0'; el.style.transition = 'opacity .3s';
      setTimeout(() => el.remove(), 300);
    }, 3200);
  };
  const client = () => window.getSupabaseClient?.() ?? null;
  const isSupabaseReady = () => !!client();

  const sample = {
    employees:[
      {id:'e1',employee_code:'203',name:'三浦 浩一', center:'北埼玉',division:'家電物流事業部',position:'職員',  employment_type:'正社員',current_grade:'管理職',promotion_target_flag:true, last_promotion_date:'2020-04-01'},
      {id:'e2',employee_code:'204',name:'山田 太郎', center:'戸田',  division:'家電物流事業部',position:'外商員',employment_type:'正社員',current_grade:'3級',  promotion_target_flag:false,last_promotion_date:'2021-07-01'},
      {id:'e3',employee_code:'205',name:'佐藤 花子', center:'さいたま',division:'家電物流事業部',position:'職員', employment_type:'正社員',current_grade:'2級',  promotion_target_flag:false,last_promotion_date:'2023-04-01'},
    ],
    licenses:[
      {id:'l1',license_name:'運行管理者（貨物）',        category_name:'国家資格・免許',need_expiration:false,enabled:true},
      {id:'l2',license_name:'第一種衛生管理者',          category_name:'国家資格・免許',need_expiration:false,enabled:true},
      {id:'l3',license_name:'フォークリフト運転技能講習',category_name:'技能講習',      need_expiration:false,enabled:true},
      {id:'l4',license_name:'テールゲートリフター特別教育',category_name:'特別教育',   need_expiration:false,enabled:true},
    ],
    employeeLicenses:[
      {id:'el1',employee_id:'e1',employee_code:'203',employee_name:'三浦 浩一',center:'北埼玉',position:'職員',  license_id:'l1',license_name:'運行管理者（貨物）',        category_name:'国家資格・免許',acquired_date:'2020-04-01',expiration_date:'2026-07-01',renewal_date:'2025-04-01',alert_status:null,memo:''},
      {id:'el2',employee_id:'e2',employee_code:'204',employee_name:'山田 太郎',center:'戸田',  position:'外商員',license_id:'l4',license_name:'テールゲートリフター特別教育',category_name:'特別教育',      acquired_date:'2024-02-01',expiration_date:'2026-06-20',renewal_date:null,         alert_status:null,memo:''},
    ],
    centers:   [{center_name:'北埼玉'},{center_name:'戸田'},{center_name:'さいたま'}],
    divisions: [{division_name:'家電物流事業部'}],
    positions: [{position_name:'外商員'},{position_name:'職員'},{position_name:'内務員'}],
    categories:[{category_name:'国家資格・免許'},{category_name:'技能講習'},{category_name:'特別教育'},{category_name:'管理者講習・選任前研修'}],
  };
  const getLocal = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || sample; } catch { return sample; } };
  const setLocal = (d) => localStorage.setItem(LS_KEY, JSON.stringify(d));

  async function query(table, select='*', opts={}) {
    const sb = client(); if (!sb) return {data:null,error:null,demo:true};
    let q = sb.from(table).select(select);
    if (opts.order) q = q.order(opts.order, {ascending: opts.ascending ?? true});
    if (opts.limit) q = q.limit(opts.limit);
    return {...(await q), demo:false};
  }
  async function insert(table, payload) {
    const sb = client(); if (!sb) return {data:null,error:null,demo:true};
    return await sb.from(table).insert(payload).select();
  }
  async function currentSession() {
    const sb = client();
    if (!sb?.auth) return null;
    const {data,error} = await sb.auth.getSession();
    if (error) return null;
    return data?.session || null;
  }
  async function upsertEmployees(rows) {
    const sb = client();
    if (!sb) return {data:null,error:new Error('Supabaseに接続されていません')};
    const session = await currentSession();
    if (!session) return {data:null,error:new Error('DB更新にはSupabaseの認証済みセッションが必要です')};
    return await sb.from('employees').upsert(rows,{onConflict:'employee_code'}).select('id,employee_code');
  }
  async function importEmployeesBatch({sourceFile,rows,fileSize=null,lastModified=null}) {
    const sb = client();
    if (!sb) return {data:null,error:new Error('Supabaseに接続されていません')};
    const session = await currentSession();
    if (!session) return {data:null,error:new Error('DB更新にはSupabaseの認証済みセッションが必要です')};
    return await sb.rpc('import_employees_batch_v1',{
      p_source_file:sourceFile,
      p_rows:rows,
      p_source_file_size:fileSize,
      p_source_file_last_modified:lastModified
    });
  }

  // JSONファイルから社員マスタを読み込む（Supabase未接続時のフォールバック）
  let _employeeCache = null;
  async function loadEmployeesFromJson() {
    if (_employeeCache) return _employeeCache;
    try {
      const res = await fetch('assets/data/employee_master_2026_04.json');
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json();
      _employeeCache = (json.employees || []).sort((a,b) => a.employee_code.localeCompare(b.employee_code));
      return _employeeCache;
    } catch(e) {
      console.warn('社員JSONの読み込みに失敗、サンプルデータを使用:', e);
      return getLocal().employees;
    }
  }
  function gradeHistoryDate(row) {
    const value = String(row?.effective_date || '').slice(0,10);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  }
  function isGradeHistory(row) {
    const before = String(row?.from_grade || '').trim();
    const after = String(row?.to_grade || '').trim();
    if (!after) return false;
    if (before && before === after) return false;
    return ['資格昇格','入社時等級','正社員登用時等級','懲戒・降格','資格等級確認']
      .some(type => String(row?.event_type || '').includes(type));
  }
  function elapsedLabel(dateValue) {
    if (!dateValue) return '—';
    const start = new Date(`${dateValue}T00:00:00+09:00`);
    const now = new Date();
    if (Number.isNaN(start.getTime()) || start > now) return '—';
    let months = (now.getFullYear()-start.getFullYear())*12 + (now.getMonth()-start.getMonth());
    if (now.getDate() < start.getDate()) months -= 1;
    months = Math.max(0, months);
    const years = Math.floor(months/12), rest = months%12;
    return years ? `${years}年${rest}ヶ月` : `${rest}ヶ月`;
  }
  async function enrichEmployeesWithHrHistory(employees) {
    const sb = client();
    if (!sb || !employees?.length) return employees;
    const {data,error} = await sb.from('employee_hr_history_official')
      .select('employee_id,effective_date,effective_label,event_type,from_grade,to_grade,status')
      .eq('status','active');
    if (error) {
      console.warn('正式人事履歴の社員一覧連携に失敗:', error);
      return employees;
    }
    const byEmployee = new Map();
    (data || []).filter(isGradeHistory).forEach(row => {
      if (!byEmployee.has(row.employee_id)) byEmployee.set(row.employee_id, []);
      byEmployee.get(row.employee_id).push(row);
    });
    return employees.map(emp => {
      const history = byEmployee.get(emp.id) || [];
      const dated = history.filter(r => gradeHistoryDate(r)).sort((a,b)=>gradeHistoryDate(a).localeCompare(gradeHistoryDate(b)));
      const latest = dated.at(-1) || null;
      const promotions = dated.filter(r => String(r.event_type||'').includes('資格昇格'));
      const latestPromotion = promotions.at(-1) || null;
      const lastGradeDate = latest ? gradeHistoryDate(latest) : null;
      const unknownGradeDate = !lastGradeDate && history.some(r => !gradeHistoryDate(r));
      return {
        ...emp,
        last_promotion_date: latestPromotion ? gradeHistoryDate(latestPromotion) : (emp.last_promotion_date || null),
        last_grade_change_date: lastGradeDate,
        last_grade_change_label: lastGradeDate ? null : (unknownGradeDate ? '日付不明' : null),
        grade_tenure_label: lastGradeDate ? elapsedLabel(lastGradeDate) : (unknownGradeDate ? '日付不明' : '—')
      };
    });
  }
  async function loadEmployees() {
    const r = await query('employees','*',{order:'employee_code'});
    if (!r.demo && !r.error && r.data?.length > 0) return await enrichEmployeesWithHrHistory(r.data);
    return loadEmployeesFromJson();
  }
  async function loadLicenseRows() {
    const r = await query('v_license_screen','*',{order:'employee_name'});
    const src = r.demo||r.error ? getLocal().employeeLicenses : r.data||[];
    return src.map(x => ({...x, alert_status: normStatus(x.alert_status, x.expiration_date)}));
  }
  async function loadAlertRows() {
    const r = await query('v_employee_license_alerts','*',{order:'days_remaining'});
    const src = r.demo||r.error ? getLocal().employeeLicenses : r.data||[];
    return src.map(x => ({...x, alert_status: normStatus(x.alert_status, x.expiration_date), days_remaining: daysUntil(x.expiration_date)}));
  }
  async function loadLicenseMaster() {
    const r = await query('license_master','*, license_categories(category_name)',{order:'license_name'});
    if (r.demo||r.error) return getLocal().licenses;
    return (r.data||[]).map(x => ({...x, category_name: x.license_categories?.category_name||x.category_name||''}));
  }
  async function loadMasters() {
    const d = getLocal();
    const [c,dv,p,cat,lics] = await Promise.all([
      query('centers','*',{order:'center_name'}), query('divisions','*',{order:'division_name'}),
      query('positions','*',{order:'position_name'}), query('license_categories','*',{order:'sort_order'}),
      loadLicenseMaster()
    ]);
    return {
      centers:   c.demo||c.error   ? d.centers   : c.data||[],
      divisions: dv.demo||dv.error ? d.divisions  : dv.data||[],
      positions: p.demo||p.error   ? d.positions  : p.data||[],
      categories:cat.demo||cat.error?d.categories : cat.data||[],
      licenses: lics
    };
  }

  const csvQuote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const downloadCSV = (filename, headers, rows) => {
    const lines = [headers.map(h => csvQuote(h.label)).join(',')];
    rows.forEach(row => lines.push(headers.map(h => csvQuote(typeof h.value === 'function' ? h.value(row) : row[h.value])).join(',')));
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    URL.revokeObjectURL(a.href);
  };
  const exportStamp = () => new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}).replaceAll('-','');
  async function dataSourceStatus() {
    const sb = client();
    if (!sb) return {mode:'fallback', label:'JSON / ローカル', writable:false};
    const r = await sb.from('employees').select('id',{count:'exact',head:true});
    return r.error
      ? {mode:'error', label:'Supabase接続エラー', writable:false, error:r.error}
      : {mode:'supabase', label:'Supabase', writable:true, count:r.count ?? null};
  }

  async function saveEmployeeLicense(payload) {
    const sb = client();
    if (sb) return await insert('employee_licenses', payload);
    const d = getLocal();
    const emp = d.employees.find(e => e.id === payload.employee_id);
    const lic = d.licenses.find(l => l.id === payload.license_id);
    d.employeeLicenses.unshift({
      id:`local_${Date.now()}`, employee_id:payload.employee_id,
      employee_code:emp?.employee_code, employee_name:emp?.name,
      center:emp?.center, position:emp?.position,
      license_id:payload.license_id, license_name:lic?.license_name,
      category_name:lic?.category_name, acquired_date:payload.acquired_date,
      expiration_date:payload.expiration_date, renewal_date:payload.renewal_date,
      memo:payload.memo, alert_status: normStatus(null, payload.expiration_date),
    });
    setLocal(d);
    return {data:[payload], error:null, demo:true};
  }

  /* ナビ定義：人事業務の情報設計に合わせて整理 */
  const NAV = [
    { id:'index',          group:'overview', label:'ダッシュボード',         sub:'状況と要対応の確認', href:'index.html',             badge:false },
    { id:'employees',      group:'people',   label:'社員管理',     sub:'社員一覧・検索',     href:'employees.html',         badge:false },
    { id:'promotion',      group:'people',   label:'人事評価・昇格',     sub:'昇格・人事評価',     href:'promotion.html',         badge:false },
    { id:'licenses',       group:'license',  label:'資格・免許管理',     sub:'資格・免許管理',     href:'licenses.html',          badge:false },
    { id:'facility',       group:'license',  label:'事業所資格管理',   sub:'事業所別管理',       href:'facility_licenses.html', badge:false },
    { id:'alerts',         group:'license',  label:'資格期限アラート', sub:'期限管理',           href:'alerts.html',            badge:true },
    { id:'masters',        group:'system',   label:'各種マスタ設定',   sub:'マスタ管理',         href:'masters.html',           badge:false },
    { id:'master_import',  group:'system',   label:'社員データ取込',     sub:'社員マスタ初期取込', href:'master_import.html',     badge:false },
    { id:'data_operations', group:'system', label:'データ運用確認', sub:'接続・品質確認', href:'data_operations.html', badge:false },
    { id:'external_links', group:'system',   label:'関連リンク',   sub:'リンク集・登録',     href:'external_links.html',    badge:false }
  ];

  const SYSTEM_LINKS = [
    { id:'recruit', label:'採用管理', href:'https://seven123789-cmd.github.io/recruit-app-clean/' },
    { id:'center', label:'センター管理', href:'https://seven123kick-art.github.io/center-dashboard/' }
  ];

  // ── カスタム関連リンク管理（LocalStorageで永続化） ──────
  const EXT_LS_KEY = 'sidebar_ext_links_v1';

  function loadExtLinks() {
    try { return JSON.parse(localStorage.getItem(EXT_LS_KEY)) || []; }
    catch { return []; }
  }
  function saveExtLinks(links) {
    localStorage.setItem(EXT_LS_KEY, JSON.stringify(links));
  }
  function addExtLink(label, href) {
    const links = loadExtLinks();
    links.push({ id: 'ext_' + Date.now(), label, href });
    saveExtLinks(links);
  }
  function removeExtLink(id) {
    saveExtLinks(loadExtLinks().filter(l => l.id !== id));
  }


  function normalizeExtHref(href) {
    const raw = String(href || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return 'https://' + raw;
  }

  function moveExtLink(id, direction) {
    const links = loadExtLinks();
    const idx = links.findIndex(l => l.id === id);
    if (idx < 0) return;
    const next = idx + direction;
    if (next < 0 || next >= links.length) return;
    const tmp = links[idx];
    links[idx] = links[next];
    links[next] = tmp;
    saveExtLinks(links);
  }

  function renderSidebar(active) {
    const sb = document.getElementById('sidebar');
    if (!sb) return;

    const row = n => `
      <a class="imperial-menu-card${n.id === active ? ' active' : ''}" href="${n.href}" data-menu="${n.id}"${n.id === active ? ' aria-current="page"' : ''}>
        <span class="imperial-menu-copy"><span class="imperial-menu-title">${n.label}</span></span>
        ${n.badge ? '<span class="nav-badge imperial-alert-dot" id="nav-alert-badge" style="display:none">!</span>' : ''}
      </a>`;

    const group = (key, label) => {
      const rows = NAV.filter(n => n.group === key).map(row).join('');
      return `<section class="sidebar-nav-section"><div class="sidebar-section-label">${label}</div><nav class="imperial-nav">${rows}</nav></section>`;
    };

    const sysRows = SYSTEM_LINKS.map(n => `
      <a class="imperial-menu-card imperial-system-menu-card" href="${n.href}" target="_blank" rel="noopener">
        <span class="imperial-menu-copy"><span class="imperial-menu-title">${n.label}</span></span>
      </a>`).join('');

    sb.innerHTML = `
      <div class="imperial-brand-card imperial-brand-card-textonly">
        <div class="imperial-brand-copy">
          <div class="imperial-brand-title">統合管理システム</div>
          <div class="imperial-brand-sub">Integrated Management System</div>
        </div>
      </div>
      ${group('overview','概要')}
      ${group('people','社員・人事')}
      ${group('license','資格・免許')}
      ${group('system','システム設定')}
      <section class="sidebar-nav-section">
        <div class="sidebar-section-label">関連システム</div>
        <div class="sidebar-system-section">${sysRows}</div>
      </section>
      <div class="sidebar-account" id="sidebar-account">
        <div class="sidebar-account-copy">
          <span class="sidebar-account-label">アカウント</span>
          <strong id="sidebar-account-name">確認中…</strong>
        </div>
        <button type="button" class="sidebar-account-action" id="sidebar-account-action">—</button>
      </div>
      <div class="imperial-sidebar-future-space" aria-hidden="true"></div>`;
    setupSidebarAccount();
  }

  function initExternalLinksPage() {
    const listEl = document.getElementById('external-link-list');
    const countEl = document.getElementById('external-link-count');
    const labelEl = document.getElementById('external-link-label');
    const urlEl = document.getElementById('external-link-url');
    const addBtn = document.getElementById('external-link-add');
    if (!listEl || !addBtn) return;

    function render() {
      const links = loadExtLinks();
      if (countEl) countEl.textContent = `${links.length}件`;
      if (!links.length) {
        listEl.innerHTML = '<div class="external-link-empty">まだ関連リンクは登録されていません。よく使うForms・共有フォルダ・外部システムを登録してください。</div>';
        return;
      }
      listEl.innerHTML = links.map((n, i) => `
        <article class="external-link-item" data-ext-id="${n.id}">
          <div class="external-link-mark" aria-hidden="true">🔗</div>
          <div class="external-link-main">
            <div class="external-link-name">${escape(n.label)}</div>
            <div class="external-link-url">${escape(n.href)}</div>
          </div>
          <div class="external-link-actions">
            <button class="btn btn-secondary btn-sm ext-move-up" data-ext-id="${n.id}" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn btn-secondary btn-sm ext-move-down" data-ext-id="${n.id}" ${i === links.length - 1 ? 'disabled' : ''}>↓</button>
            <a class="btn btn-primary btn-sm" href="${escape(n.href)}" target="_blank" rel="noopener">開く ↗</a>
            <button class="btn btn-danger btn-sm ext-remove" data-ext-id="${n.id}">削除</button>
          </div>
        </article>`).join('');

      listEl.querySelectorAll('.ext-remove').forEach(btn => {
        btn.addEventListener('click', e => {
          const id = e.currentTarget.dataset.extId;
          removeExtLink(id);
          render();
          APP.toast('関連リンクを削除しました');
        });
      });
      listEl.querySelectorAll('.ext-move-up').forEach(btn => {
        btn.addEventListener('click', e => {
          moveExtLink(e.currentTarget.dataset.extId, -1);
          render();
        });
      });
      listEl.querySelectorAll('.ext-move-down').forEach(btn => {
        btn.addEventListener('click', e => {
          moveExtLink(e.currentTarget.dataset.extId, 1);
          render();
        });
      });
    }

    function add() {
      const label = labelEl.value.trim();
      const href = normalizeExtHref(urlEl.value);
      if (!label || !href) { APP.toast('名前とリンク先を入力してください', 'warning'); return; }
      try { new URL(href); } catch { APP.toast('正しいURLを入力してください', 'error'); return; }
      addExtLink(label, href);
      labelEl.value = '';
      urlEl.value = '';
      render();
      APP.toast(`「${label}」を追加しました`);
    }

    addBtn.addEventListener('click', add);
    [labelEl, urlEl].forEach(el => el.addEventListener('keydown', e => {
      if (e.key === 'Enter') add();
    }));
    render();
  }

  async function setupSidebarAccount() {
    const nameEl = document.getElementById('sidebar-account-name');
    const btn = document.getElementById('sidebar-account-action');
    if (!nameEl || !btn) return;
    const user = await Auth.currentUser();
    if (user) {
      nameEl.textContent = Auth.displayName(user);
      btn.textContent = 'ログアウト';
      btn.onclick = () => Auth.logout();
    } else {
      nameEl.textContent = Auth.isRequired() ? '未ログイン' : '任意ログイン';
      btn.textContent = 'ログイン';
      btn.onclick = () => {
        const here = location.pathname.split('/').pop() || 'index.html';
        location.href = `login.html?next=${encodeURIComponent(here + location.search + location.hash)}`;
      };
    }
  }

  async function enforcePageAuth() {
    if ((location.pathname.split('/').pop() || 'index.html') === 'login.html') return true;
    const session = await Auth.requireAuth();
    return !!session;
  }

  function initHeader() {
    const d = document.getElementById('today-date');
    if (d) d.textContent = new Intl.DateTimeFormat('ja-JP', {
      dateStyle: 'medium', timeZone: 'Asia/Tokyo'
    }).format(new Date());
    const m = document.getElementById('connection-status');
    if (m) m.innerHTML = isSupabaseReady()
      ? '<span class="status-dot"></span>Supabase接続'
      : '<span class="status-dot demo"></span>デモ表示';
  }

  const Auth = {
    isRequired() { return window.AUTH_REQUIRED === true; },
    async session() {
      const sb = client();
      if (!sb?.auth) return null;
      const {data,error} = await sb.auth.getSession();
      if (error) { console.warn('Auth session error:', error); return null; }
      return data?.session || null;
    },
    async requireAuth() {
      const session = await this.session();
      if (session) return session;
      if (!this.isRequired()) return null;

      const here = location.pathname.split('/').pop() || 'index.html';
      if (here !== 'login.html') {
        const next = encodeURIComponent(here + location.search + location.hash);
        location.replace(`${window.AUTH_LOGIN_URL || 'login.html'}?next=${next}`);
      }
      return null;
    },
    async currentUser() {
      const session = await this.session();
      return session?.user || null;
    },
    displayName(user) {
      if (!user) return '未ログイン';
      return user.user_metadata?.display_name
        || user.user_metadata?.name
        || user.email
        || 'ログイン中';
    },
    async signIn(email, password) {
      const sb = client();
      if (!sb?.auth) return {data:null,error:new Error('Supabase Authを利用できません')};
      return await sb.auth.signInWithPassword({email, password});
    },
    async logout() {
      const sb = client();
      if (!sb?.auth) return;
      const {error} = await sb.auth.signOut();
        if (window.AUTH_REQUIRED) {
          location.replace('login.html');
          return;
        }
      if (error) { toast(error.message || 'ログアウトできませんでした','error'); return; }
      if (this.isRequired()) location.replace(window.AUTH_LOGIN_URL || 'login.html');
      else location.replace('index.html');
    }
  };

  return {
    today, fmtDate, daysUntil, normStatus, statusClass,
    escape, badge, alertBadge, toast, client, isSupabaseReady,
    query, insert, currentSession, upsertEmployees, importEmployeesBatch, loadEmployees, loadLicenseRows, loadAlertRows,
    loadLicenseMaster, loadMasters, saveEmployeeLicense,
    downloadCSV, exportStamp, dataSourceStatus,
    renderSidebar, initHeader, initExternalLinksPage, Auth, enforcePageAuth, NAV,
    loadExtLinks, addExtLink, removeExtLink
  };
})();

window.Auth          = APP.Auth;
window.renderSidebar = APP.renderSidebar;
window.Toast = { success:m=>APP.toast(m), warning:m=>APP.toast(m,'warning'), error:m=>APP.toast(m,'error') };
window.Modal = {
  open:  id => document.getElementById(id)?.classList.remove('hidden'),
  close: id => document.getElementById(id)?.classList.add('hidden'),
  setup() {
    document.querySelectorAll('[data-modal-close]').forEach(b => b.onclick = () => Modal.close(b.dataset.modalClose));
    document.querySelectorAll('.modal-backdrop').forEach(m => m.onclick = e => { if (e.target === m) Modal.close(m.id); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape')
        document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => Modal.close(m.id));
    });
  }
};


