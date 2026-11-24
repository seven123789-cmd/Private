// Synthetic regression tests; run with node tests/hr-reconciliation.test.cjs
require('../assets/js/hr-reconciliation.js');
const run=globalThis.HrReconciliation.reconcile;
const e={"id":"synthetic","employee_code":"001","join_date":"2026-01-01","is_active":true}, a={"personnel_code":"1","month":"2026-11-01","center":"B"}, h=[{"employee_id":"synthetic","effective_from":"2026-01-01","effective_to":"2026-11-14","center_id":"A"},{"employee_id":"synthetic","effective_from":"2026-11-15","center_id":"B"}];
const tests=[["normalized code",()=>run({month:"2026-11",employees:[e],attendance:[a]}).issues.length===0],
["missing attendance",()=>run({month:"2026-11",employees:[e],attendance:[]}).counts.missing_attendance===1],
["missing master",()=>run({month:"2026-11",employees:[],attendance:[a]}).counts.missing_master===1],
["midmonth transfer",()=>!run({month:"2026-11",employees:[e],attendance:[a],assignments:h,fields:{center:"center"},historyComplete:true}).counts.center_mismatch],
["wrong center",()=>run({month:"2026-11",employees:[e],attendance:[{...a,center:"C"}],assignments:h,fields:{center:"center"},historyComplete:true}).counts.center_mismatch===1],
["retired",()=>run({month:"2026-11",employees:[{...e,retirement_date:"2026-10-31"}],attendance:[a]}).counts.outside_employment===1]];
for(const [name,test] of tests){if(!test())throw Error(name);console.log('PASS '+name);}
