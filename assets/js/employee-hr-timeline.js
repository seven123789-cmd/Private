/* Phase22: 正式人事履歴タイムライン
   - 通常画面は employee_hr_history_official のみを使用
   - employee_hr_events（Phase20/21監査層）は表示・更新しない
   - 所属 / 担当 / 等級 / 役職 / 兼務を分離し、変更項目だけ表示
   - 3級=副主任、4級=主任。5級以上の役職は正式履歴の役職名をそのまま表示
   - 訂正 / 取消は物理削除せず、Phase22 RPCで履歴を保持
*/
window.EmployeeHrTimeline = (() => {
  let employee = null;
  let rows = [];

  const esc = v => APP.escape(v ?? '');
  const text = v => String(v ?? '').trim();
  const normalize = v => text(v).replace(/\s+/g, ' ');
  const normalizeArray = v => (Array.isArray(v) ? v : [])
    .map(x => normalize(x))
    .filter(Boolean);

  function gradeLabel(v) {
    const s = text(v);
    if (s === '3級') return '3級（副主任）';
    if (s === '4級') return '4級（主任）';
    return s;
  }

  function roleLabel(v) {
    return normalizeArray(v).join(' 兼 ');
  }

  function sameText(a, b) {
    return normalize(a) === normalize(b);
  }

  function sameArray(a, b) {
    const aa = normalizeArray(a);
    const bb = normalizeArray(b);
    return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
  }

  function fmtOfficialDate(r) {
    if (r.effective_date) {
      const m = String(r.effective_date).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return `${m[1]}/${m[2]}/${m[3]}`;
    }
    return text(r.effective_label) || '日付未設定';
  }

  function typeLabel(t) {
    return text(t) || '人事変更';
  }

  function addChange(list, label, before, after, options = {}) {
    const isArray = options.array === true;
    const formatter = options.formatter || (v => text(v));
    const equal = isArray ? sameArray(before, after) : sameText(before, after);
    if (equal) return;

    const beforeText = isArray ? roleLabel(before) : formatter(before);
    const afterText = isArray ? roleLabel(after) : formatter(after);
    if (!beforeText && !afterText) return;

    list.push({ label, before: beforeText, after: afterText });
  }

  function eventChanges(r) {
    const changes = [];
    addChange(changes, '所属', r.from_affiliation, r.to_affiliation);
    addChange(changes, '担当', r.from_assignment, r.to_assignment);
    addChange(changes, '等級', r.from_grade, r.to_grade, { formatter: gradeLabel });
    addChange(changes, '役職', r.from_job_titles, r.to_job_titles, { array: true });
    addChange(changes, '兼務', r.from_concurrent, r.to_concurrent, { array: true });
    return changes;
  }

  function compactAffiliationPair(before, after) {
    let b = text(before);
    let a = text(after);
    if (!b || !a) return [b, a];
    const bp = b.split(/\\s+/);
    const ap = a.split(/\\s+/);
    let i = 0;
    while (i < bp.length - 1 && i < ap.length - 1 && bp[i] === ap[i]) i += 1;
    if (i > 0) {
      b = bp.slice(i).join(' ');
      a = ap.slice(i).join(' ');
    }
    return [b, a];
  }

  function displayPair(change) {
    if (change.label === '所属') return compactAffiliationPair(change.before, change.after);
    return [change.before, change.after];
  }

  function renderTableRows(r) {
    const changes = eventChanges(r);
    if (!changes.length) return '';
    const date = esc(fmtOfficialDate(r));
    const type = esc(typeLabel(r.event_type));

    return changes.map((change, index) => {
      const [beforeRaw, afterRaw] = displayPair(change);
      const before = beforeRaw ? esc(beforeRaw) : '—';
      const after = afterRaw ? esc(afterRaw) : '—';
      const note = index === 0 && text(r.note)
        ? `<div class="cell-sub">補足：${esc(r.note)}</div>` : '';
      const actions = index === 0
        ? `<div class="row-actions" style="justify-content:flex-start;gap:6px;white-space:nowrap">
             <button class="btn btn-secondary btn-sm" data-hr-correct="${esc(r.id)}">訂正</button>
             <button class="btn btn-danger-subtle btn-sm" data-hr-cancel="${esc(r.id)}">取消</button>
           </div>` : '';

      return `<tr>
        <td>${index === 0 ? `<strong>${date}</strong>` : ''}</td>
        <td>${index === 0 ? type : ''}</td>
        <td><strong>${esc(change.label)}</strong>${note}</td>
        <td>${before}</td>
        <td class="hr-history-arrow">→</td>
        <td><strong>${after}</strong></td>
        <td>${actions}</td>
      </tr>`;
    }).join('');
  }

  function compactAffiliationPair(before, after) {
    let b = text(before);
    let a = text(after);
    if (!b || !a) return [b, a];

    const bp = b.split(/\s+/);
    const ap = a.split(/\s+/);
    let i = 0;
    while (i < bp.length - 1 && i < ap.length - 1 && bp[i] === ap[i]) i += 1;

    if (i > 0) {
      b = bp.slice(i).join(' ');
      a = ap.slice(i).join(' ');
    }
    return [b, a];
  }

  function displayPair(change) {
    if (change.label === '所属') return compactAffiliationPair(change.before, change.after);
    return [change.before, change.after];
  }

  function renderTableRows(r) {
    const changes = eventChanges(r);
    const date = esc(fmtOfficialDate(r));
    const type = esc(typeLabel(r.event_type));

    // 正社員登用など「イベント自体」が正式履歴で、前後項目を持たないものも消さない。
    if (!changes.length) {
      return `<tr>
        <td><strong>${date}</strong></td>
        <td>${type}</td>
        <td><strong>内容</strong></td>
        <td>—</td>
        <td class="hr-history-arrow">→</td>
        <td><strong>${type}</strong></td>
        <td>
          <div class="row-actions hr-history-actions">
            <button class="btn btn-secondary btn-sm" data-hr-correct="${esc(r.id)}">訂正</button>
            <button class="btn btn-danger-subtle btn-sm" data-hr-cancel="${esc(r.id)}">取消</button>
          </div>
        </td>
      </tr>`;
    }

    return changes.map((change, index) => {
      const [beforeRaw, afterRaw] = displayPair(change);
      const before = beforeRaw ? esc(beforeRaw) : '—';
      const after = afterRaw ? esc(afterRaw) : '—';
      const note = index === 0 && text(r.note)
        ? `<div class="cell-sub">補足：${esc(r.note)}</div>` : '';
      const actions = index === 0
        ? `<div class="row-actions hr-history-actions">
             <button class="btn btn-secondary btn-sm" data-hr-correct="${esc(r.id)}">訂正</button>
             <button class="btn btn-danger-subtle btn-sm" data-hr-cancel="${esc(r.id)}">取消</button>
           </div>` : '';

      return `<tr>
        <td>${index === 0 ? `<strong>${date}</strong>` : ''}</td>
        <td>${index === 0 ? type : ''}</td>
        <td><strong>${esc(change.label)}</strong>${note}</td>
        <td>${before}</td>
        <td class="hr-history-arrow">→</td>
        <td><strong>${after}</strong></td>
        <td>${actions}</td>
      </tr>`;
    }).join('');
  }

  async function load(id) {
    return APP.client().rpc('get_employee_hr_history_official_v1', { p_employee_id: id });
  }

  function render() {
    const box = document.getElementById('emp-hr-timeline');
    if (!box) return;

    if (!rows.length) {
      box.innerHTML = '<div class="empty">正式な人事履歴はありません</div>';
      return;
    }

    const body = rows.map(renderTableRows).join('');
    box.innerHTML = `
      <style>
        #emp-hr-timeline{padding-top:8px}
        #emp-hr-timeline .hr-history-table{table-layout:auto;min-width:860px;width:100%;border-collapse:collapse}
        #emp-hr-timeline .hr-history-table th,
        #emp-hr-timeline .hr-history-table td{vertical-align:middle;padding:10px 12px}
        #emp-hr-timeline .hr-history-table th:nth-child(1){width:112px}
        #emp-hr-timeline .hr-history-table th:nth-child(2){width:142px}
        #emp-hr-timeline .hr-history-table th:nth-child(3){width:70px}
        #emp-hr-timeline .hr-history-table th:nth-child(5){width:30px;text-align:center}
        #emp-hr-timeline .hr-history-table th:nth-child(7){width:116px}
        #emp-hr-timeline .hr-history-table td:nth-child(1),
        #emp-hr-timeline .hr-history-table td:nth-child(2),
        #emp-hr-timeline .hr-history-table td:nth-child(3){white-space:nowrap}
        #emp-hr-timeline .hr-history-table td:nth-child(4),
        #emp-hr-timeline .hr-history-table td:nth-child(6){
          white-space:normal;overflow-wrap:anywhere;word-break:normal;line-height:1.5
        }
        #emp-hr-timeline .hr-history-arrow{text-align:center;color:var(--muted,#766d62);white-space:nowrap}
        #emp-hr-timeline .cell-sub{font-size:12px;font-weight:400;margin-top:4px;white-space:normal}
        #emp-hr-timeline .hr-history-actions{justify-content:flex-start;gap:6px;white-space:nowrap}
        @media(max-width:760px){#emp-hr-timeline .hr-history-table{min-width:760px}}
      </style>
      <div class="table-wrap">
        <table class="hr-history-table">
          <thead>
            <tr>
              <th>発令日</th><th>種別</th><th>項目</th>
              <th>変更前</th><th></th><th>変更後</th><th>操作</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;

    box.querySelectorAll('[data-hr-correct]').forEach(btn => {
      btn.onclick = () => openCorrect(btn.dataset.hrCorrect);
    });
    box.querySelectorAll('[data-hr-cancel]').forEach(btn => {
      btn.onclick = () => cancelEvent(btn.dataset.hrCancel);
    });
  }

  async function mount(e) {
    employee = e;
    const result = await load(e.id);
    if (result.error) {
      console.error('official hr history load failed', result.error);
      const box = document.getElementById('emp-hr-timeline');
      if (box) box.innerHTML = '<div class="empty">正式人事履歴を読み込めませんでした</div>';
      return;
    }
    rows = result.data || [];
    render();
    document.getElementById('btn-add-hr-event')?.addEventListener('click', openAdd);
  }

  function modal() {
    return document.getElementById('hr-event-modal');
  }

  function field(id) {
    return document.getElementById(id);
  }

  function setValue(id, value) {
    const el = field(id);
    if (el) el.value = value ?? '';
  }

  function getValue(id) {
    return text(field(id)?.value);
  }

  function splitList(value) {
    return text(value)
      .split(/\r?\n|、|,|\/|\s+兼\s+/)
      .map(v => normalize(v))
      .filter(Boolean);
  }

  function arrayToInput(value) {
    return normalizeArray(value).join(' 兼 ');
  }

  function resetForm() {
    [
      'hr-event-id', 'hr-event-date', 'hr-event-year-label', 'hr-event-from-affiliation',
      'hr-event-to-affiliation', 'hr-event-from-assignment', 'hr-event-to-assignment',
      'hr-event-from-grade', 'hr-event-to-grade', 'hr-event-from-job-titles',
      'hr-event-to-job-titles', 'hr-event-from-concurrent', 'hr-event-to-concurrent',
      'hr-event-note', 'hr-event-reason'
    ].forEach(id => setValue(id, ''));
    setValue('hr-event-type', '人事異動');
  }

  function openAdd() {
    resetForm();
    field('hr-event-modal-title').textContent = '正式人事履歴を追加';
    setValue('hr-event-date', new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date()));
    field('hr-event-reason-group').hidden = true;
    modal()?.classList.remove('hidden');
  }

  function openCorrect(id) {
    const r = rows.find(x => String(x.id) === String(id));
    if (!r) return;

    resetForm();
    field('hr-event-modal-title').textContent = '正式人事履歴を訂正';
    setValue('hr-event-id', r.id);
    setValue('hr-event-date', r.effective_date || '');
    setValue('hr-event-year-label', r.effective_label || '');
    setValue('hr-event-type', r.event_type || '人事異動');
    setValue('hr-event-from-affiliation', r.from_affiliation || '');
    setValue('hr-event-to-affiliation', r.to_affiliation || '');
    setValue('hr-event-from-assignment', r.from_assignment || '');
    setValue('hr-event-to-assignment', r.to_assignment || '');
    setValue('hr-event-from-grade', r.from_grade || '');
    setValue('hr-event-to-grade', r.to_grade || '');
    setValue('hr-event-from-job-titles', arrayToInput(r.from_job_titles));
    setValue('hr-event-to-job-titles', arrayToInput(r.to_job_titles));
    setValue('hr-event-from-concurrent', arrayToInput(r.from_concurrent));
    setValue('hr-event-to-concurrent', arrayToInput(r.to_concurrent));
    setValue('hr-event-note', r.note || '');
    field('hr-event-reason-group').hidden = false;
    modal()?.classList.remove('hidden');
  }

  async function cancelEvent(id) {
    const reason = prompt('取消理由を入力してください。');
    if (!reason || !reason.trim()) return;

    const result = await APP.client().rpc('cancel_employee_hr_history_official_v1', {
      p_id: id,
      p_reason: reason.trim()
    });
    if (result.error) {
      APP.toast(result.error.message, 'error');
      return;
    }
    location.reload();
  }

  function collectPayload() {
    const effectiveDate = getValue('hr-event-date') || null;
    const effectiveLabel = effectiveDate ? null : (getValue('hr-event-year-label') || null);

    return {
      p_effective_date: effectiveDate,
      p_effective_label: effectiveLabel,
      p_event_type: getValue('hr-event-type'),
      p_from_affiliation: getValue('hr-event-from-affiliation') || null,
      p_to_affiliation: getValue('hr-event-to-affiliation') || null,
      p_from_grade: getValue('hr-event-from-grade') || null,
      p_to_grade: getValue('hr-event-to-grade') || null,
      p_from_job_titles: splitList(getValue('hr-event-from-job-titles')),
      p_to_job_titles: splitList(getValue('hr-event-to-job-titles')),
      p_from_assignment: getValue('hr-event-from-assignment') || null,
      p_to_assignment: getValue('hr-event-to-assignment') || null,
      p_from_concurrent: splitList(getValue('hr-event-from-concurrent')),
      p_to_concurrent: splitList(getValue('hr-event-to-concurrent')),
      p_note: getValue('hr-event-note') || null
    };
  }

  function hasAnyChange(p) {
    return [
      [p.p_from_affiliation, p.p_to_affiliation],
      [p.p_from_assignment, p.p_to_assignment],
      [p.p_from_grade, p.p_to_grade]
    ].some(([a, b]) => !sameText(a, b) && (text(a) || text(b))) ||
      (!sameArray(p.p_from_job_titles, p.p_to_job_titles) && (p.p_from_job_titles.length || p.p_to_job_titles.length)) ||
      (!sameArray(p.p_from_concurrent, p.p_to_concurrent) && (p.p_from_concurrent.length || p.p_to_concurrent.length));
  }

  async function submit(ev) {
    ev.preventDefault();
    const id = getValue('hr-event-id');
    const reason = getValue('hr-event-reason');
    const payload = collectPayload();

    if (!payload.p_effective_date && !payload.p_effective_label) {
      APP.toast('発令日、または日付不明の過去履歴用の年度表記を入力してください', 'warning');
      return;
    }
    if (!payload.p_event_type) {
      APP.toast('種別は必須です', 'warning');
      return;
    }
    if (!hasAnyChange(payload) && !payload.p_note) {
      APP.toast('変更前後のいずれか、または補足を入力してください', 'warning');
      return;
    }

    const sb = APP.client();
    let result;

    if (id) {
      if (!reason) {
        APP.toast('訂正理由は必須です', 'warning');
        return;
      }
      result = await sb.rpc('correct_employee_hr_history_official_v1', {
        p_id: id,
        ...payload,
        p_reason: reason
      });
    } else {
      result = await sb.rpc('add_employee_hr_history_official_v1', {
        p_employee_id: employee.id,
        ...payload
      });
    }

    if (result.error) {
      APP.toast(result.error.message, 'error');
      return;
    }
    location.reload();
  }

  function syncDateInputs() {
    const date = field('hr-event-date');
    const label = field('hr-event-year-label');
    if (!date || !label) return;

    date.addEventListener('input', () => {
      if (date.value) label.value = '';
    });
    label.addEventListener('input', () => {
      if (label.value.trim()) date.value = '';
    });
  }

  function setup() {
    field('hr-event-form')?.addEventListener('submit', submit);
    field('btn-close-hr-event')?.addEventListener('click', () => modal()?.classList.add('hidden'));
    field('btn-cancel-hr-event')?.addEventListener('click', () => modal()?.classList.add('hidden'));
    syncDateInputs();
  }

  return { mount, setup };
})();
