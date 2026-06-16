// ══════════════════════════════════════════════════════════════
// 넘버원 어덜트 데이케어 — 기본 스태프 데이터
// data/members.js
// 멤버 데이터는 Google Sheets에서 로드 (core/state.js에서 MEMBERS 선언)
// ══════════════════════════════════════════════════════════════

DEFAULT_STAFF.push(
  {id:'S001',name:'Zoey Jeong',nameKr:'정지윤',role:'Program Director',phone:'718-799-0248',email:'zoey@numberone.com',
   certs:[{name:'LMSW',exp:'2026-12-31'},{name:'CPR/AED',exp:'2025-09-01'},{name:'DOH Supervisor',exp:'2026-06-30'}],
   avBg:'#FAECE7',avColor:'#993C1D'},
  {id:'S002',name:'Jin Ho Kim',nameKr:'김진호',role:'RN (Registered Nurse)',phone:'718-555-0201',email:'jkim@numberone.com',
   certs:[{name:'RN License',exp:'2026-03-15'},{name:'CPR/AED',exp:'2025-10-01'},{name:'HIPAA',exp:'2025-12-31'}],
   avBg:'#E6F1FB',avColor:'#185FA5'},
  {id:'S003',name:'Mi Young Park',nameKr:'박미영',role:'CNA',phone:'718-555-0202',email:'mpark@numberone.com',
   certs:[{name:'CNA License',exp:'2026-01-20'},{name:'CPR/AED',exp:'2024-04-01'},{name:'Abuse Prevention',exp:'2025-12-31'}],
   avBg:'#E1F5EE',avColor:'#0F6E56'},
  {id:'S004',name:'Sarah Lee',nameKr:'이사라',role:'Social Worker',phone:'718-555-0203',email:'slee@numberone.com',
   certs:[{name:'LCSW',exp:'2025-12-31'},{name:'CPR/AED',exp:'2025-11-15'},{name:'SNAP Certification',exp:'2026-05-01'}],
   avBg:'#EEEDFE',avColor:'#534AB7'}
);
