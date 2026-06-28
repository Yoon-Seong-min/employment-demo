import React, { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════
// 안정성 유틸리티 — 네트워크 의존 없이 즉시 복구 가능한 데모
// ═══════════════════════════════════════════════════════
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededOffset(seed, range = 3) {
  return (hashText(seed) % range) - Math.floor(range / 2);
}

function makePredictions(finalValue, min, max, step) {
  // 동일한 예측값은 현실적으로 허용된다. 중복 제거용 while 루프를 쓰지 않아
  // 경계값에서 9↔10처럼 무한 왕복하는 공회전 문제를 원천 차단한다.
  const low = finalValue - step >= min ? finalValue - step : finalValue;
  const high = finalValue + step <= max ? finalValue + step : finalValue;
  const values = (low === finalValue || high === finalValue)
    ? [finalValue, finalValue, finalValue, finalValue, finalValue]
    : [finalValue, low, high, finalValue, finalValue];
  const names = ["참여자A", "참여자B", "참여자C", "참여자D", "참여자E"];
  return values.map((value, index) => ({ name: names[index], value }));
}

function buildLocalInsights({ currentHours, opHours, added, dividendMgmt, dividendWorker }) {
  const productivity = Math.max(0, Math.round((opHours / Math.max(1, currentHours) - 1) * 100));
  return {
    insights: [
      `가동시간 ${currentHours}h → ${opHours}h, 가동 여력 약 ${productivity}% 확대`,
      `${added}명 신규 고용으로 확장 시간대를 단계적으로 충원`,
      `성과 발생 후 경영진 ${dividendMgmt}%·근로자 ${dividendWorker}% 배당 검토`,
    ],
    warning: "초기 도입은 2조2교대 과도기와 관리자 중간배치를 병행해 운영 리스크를 낮추는 것이 적절합니다.",
  };
}

// ═══════════════════════════════════════════════════════
// 조편성 계산 — 특허 도면 17 공식
// 오전:오후 = 주중:주말 = r:(10-r), 곱해서 4개조 배정
// r=7, 100명 → 49:21:21:9 / r=5 → 25:25:25:25 (균등)
// ═══════════════════════════════════════════════════════
function calcTeams(total, r) {
  const am = r / 10, pm = (10 - r) / 10;
  const A = Math.round(total * am * am);  // 주중오전
  const B = Math.round(total * pm * am);  // 주중오후
  const C = Math.round(total * am * pm);  // 주말오전
  const D = total - A - B - C;            // 주말오후 (나머지)
  return { A, B, C, D };
}

// 수치결정 — 네트워크 없이 작동하는 결정론적 로컬 엔진
function buildNumericDecision(employees, industry, attempt = 0, companyName = "") {
  const base = {
    "제조업": { emp: 16, ratio: 7, hours: 16, start: 8 },
    "IT/소프트웨어": { emp: 12, ratio: 7, hours: 14, start: 9 },
    "물류/유통": { emp: 18, ratio: 8, hours: 16, start: 7 },
    "서비스업": { emp: 14, ratio: 7, hours: 15, start: 9 },
    "의료/바이오": { emp: 14, ratio: 6, hours: 14, start: 8 },
    "금융/보험": { emp: 12, ratio: 7, hours: 14, start: 9 },
    "공공기관": { emp: 10, ratio: 6, hours: 13, start: 9 },
    "기타": { emp: 14, ratio: 7, hours: 15, start: 8 },
  }[industry] || { emp: 14, ratio: 7, hours: 15, start: 8 };

  const employeeCount = Math.max(10, toInt(employees, 100));
  const sizeAdjustment = employeeCount >= 500 ? 2 : employeeCount >= 200 ? 1 : 0;
  const seedBase = `${companyName}|${industry}|${employeeCount}|${attempt}`;

  const buildItem = (key, center, min, max, step, expertLabels) => {
    const drift = seededOffset(`${seedBase}|${key}`, 3) * step;
    const finalValue = clamp(center + drift, min, max);
    const expertValues = [
      clamp(center - step, min, max),
      clamp(center + step, min, max),
      finalValue,
    ];
    return {
      experts: expertValues.map((value, index) => ({
        name: `전문가${index + 1}`,
        value,
        basis: expertLabels[index],
      })),
      predictions: makePredictions(finalValue, min, max, step),
      final: finalValue,
    };
  };

  return {
    empRate: buildItem(
      "employment",
      Math.min(30, base.emp + sizeAdjustment),
      5,
      30,
      1,
      ["초기 부담 최소화 관점", "적극적 고용 확대", "시장 정착 고려"],
    ),
    ratioA: buildItem(
      "ratio",
      base.ratio,
      5,
      9,
      1,
      ["선호조 집중 단계", "균형 지향 배치", "단계적 균등화"],
    ),
    opHours: buildItem(
      "hours",
      base.hours,
      12,
      16,
      1,
      ["표준 2교대 기준", "최대 가동 지향", "보수적 운영"],
    ),
    startHour: buildItem(
      "start",
      base.start,
      6,
      10,
      1,
      ["표준 출근 시각", "이른 개시 방안", "여유 있는 시작"],
    ),
  };
}

// ═══════════════════════════════════════════════════════
// 상수
// ═══════════════════════════════════════════════════════
const BG_PROS = [
  "가동시간 확대로 기업 생산성이 향상된다",
  "근로시간 단축(주 3.5일)으로 삶의 질이 개선된다",
  "출퇴근 시간 분산으로 교통혼잡이 완화된다",
];
const BG_CONS = [
  "주말·야간 근무로 인한 초기 매출 불확실성이 있다",
  "4개조 구성에 필요한 추가 인건비 부담이 있다",
  "근무패턴 변화에 적응하는 과도기 관리가 필요하다",
];

const INDUSTRIES = ["제조업","IT/소프트웨어","물류/유통","서비스업","의료/바이오","금융/보험","공공기관","기타"];

// ═══════════════════════════════════════════════════════
// 색상
// ═══════════════════════════════════════════════════════
const C = {
  navy:"#0f1f3d", navyLight:"#1e3a5f",
  amber:"#f59e0b", amberLight:"#fef3c7", amberDark:"#b45309",
  emerald:"#10b981", emeraldLight:"#d1fae5", emeraldDark:"#065f46",
  violet:"#7c3aed", violetLight:"#ede9fe",
  rose:"#f43f5e", roseLight:"#ffe4e6",
  sl50:"#f8fafc", sl100:"#f1f5f9", sl200:"#e2e8f0", sl300:"#cbd5e1",
  sl400:"#94a3b8", sl500:"#64748b", sl600:"#475569", sl700:"#334155", sl800:"#1e293b",
  white:"#ffffff",
};

// ═══════════════════════════════════════════════════════
// 스타일 유틸
// ═══════════════════════════════════════════════════════
const card = (extra={}) => ({ background:C.white, borderRadius:12, border:`1px solid ${C.sl200}`, marginBottom:16, overflow:"hidden", ...extra });
const cardHead = () => ({ padding:"14px 20px", borderBottom:`1px solid ${C.sl200}`, display:"flex", alignItems:"center", gap:8, background:C.sl50 });
const badge = (bg,col) => ({ display:"inline-block", padding:"2px 8px", borderRadius:100, fontSize:10, fontWeight:700, background:bg, color:col });
const btn = (v="primary") => ({
  padding: v==="lg"?"12px 28px":v==="sm"?"6px 12px":"9px 18px",
  background: v==="ghost"?"transparent":v==="secondary"?C.sl100:v==="danger"?"#ef4444":C.navy,
  color: v==="ghost"?C.sl600:v==="secondary"?C.sl800:C.white,
  border: v==="ghost"?`1px solid ${C.sl200}`:"none",
  borderRadius:8, fontSize:v==="sm"?11:13, fontWeight:700, cursor:"pointer",
  display:"inline-flex", alignItems:"center", gap:6,
});
const fld = { width:"100%", padding:"8px 10px", border:`1px solid ${C.sl200}`, borderRadius:6, fontSize:13, color:C.sl800, background:C.white, boxSizing:"border-box" };
const lbl = { fontSize:12, fontWeight:600, color:C.sl600, marginBottom:4, display:"block" };

// ═══════════════════════════════════════════════════════
// 서브 컴포넌트
// ═══════════════════════════════════════════════════════

// StepTabs
function StepTabs({ current, steps, onSelect }) {
  return (
    <div style={{ display:"flex", gap:0, background:C.sl100, borderRadius:10, padding:4, marginBottom:16 }}>
      {steps.map((s,i) => {
        const active = current===i, done = current>i;
        return (
          <button key={i} onClick={()=>onSelect(i)} style={{
            flex:1, padding:"8px 4px", textAlign:"center", fontSize:11, fontWeight:active?700:500,
            borderRadius:7, background:active?C.white:"transparent",
            color:active?C.navy:done?C.emerald:C.sl400, cursor:"pointer", border:"none",
            boxShadow:active?"0 1px 4px rgba(0,0,0,0.10)":"none", transition:"all 0.15s",
          }}>
            <span style={{ display:"block", fontSize:9, marginBottom:1 }}>{done?"✓":`STEP ${i+1}`}</span>
            {s}
          </button>
        );
      })}
    </div>
  );
}

// 가동시간 타임라인 (9시→18시 기준)
function OperatingTimeline({ currentHours, targetHours }) {
  const [prog, setProg] = useState(0);
  useEffect(() => {
    setProg(0);
    let intervalId = null;
    const timeoutId = window.setTimeout(() => {
      let value = 0;
      intervalId = window.setInterval(() => {
        value += 0.04;
        if (value >= 1) {
          setProg(1);
          window.clearInterval(intervalId);
          intervalId = null;
        } else {
          setProg(value);
        }
      }, 16);
    }, 120);
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [currentHours, targetHours]);

  const gap = targetHours - currentHours;
  const curStart=9, fourStart=8;
  const pct = h => (h/24*100).toFixed(2)+"%";
  const ticks = [0,3,6,9,12,15,18,21,24];

  return (
    <div style={{ padding:"16px 20px 12px" }}>
      <div style={{ position:"relative", height:18, marginBottom:4 }}>
        {ticks.map(h=>(
          <div key={h} style={{ position:"absolute", left:pct(h), top:0, fontSize:9, color:C.sl400, transform:"translateX(-50%)" }}>{h}시</div>
        ))}
        {ticks.map(h=>(
          <div key={`t${h}`} style={{ position:"absolute", left:pct(h), bottom:0, width:1, height:4, background:C.sl300 }}/>
        ))}
      </div>

      <div style={{ marginBottom:8 }}>
        <div style={{ fontSize:11, color:C.sl500, marginBottom:3, fontWeight:600 }}>현재 ({curStart}시 ~ {curStart+currentHours}시)</div>
        <div style={{ height:26, background:C.sl100, borderRadius:5, position:"relative", overflow:"hidden", border:`1px solid ${C.sl200}` }}>
          <div style={{ position:"absolute", left:pct(curStart), top:0, bottom:0, width:`${currentHours/24*100*prog}%`, background:C.sl400, borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:10, color:C.white, fontWeight:700, whiteSpace:"nowrap" }}>{currentHours}h</span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:11, color:C.emeraldDark, marginBottom:3, fontWeight:700 }}>4조2교대 도입 후 ({fourStart}시 ~ {fourStart+targetHours}시)</div>
        <div style={{ height:26, background:C.sl100, borderRadius:5, position:"relative", overflow:"hidden", border:`1px solid ${C.emerald}` }}>
          <div style={{ position:"absolute", left:pct(fourStart), top:0, bottom:0, width:`${currentHours/24*100*prog}%`, background:C.sl400 }}/>
          <div style={{ position:"absolute", left:pct(fourStart+currentHours), top:0, bottom:0, width:`${gap/24*100*prog}%`, background:C.amber, borderRadius:"0 4px 4px 0", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {gap>2&&<span style={{ fontSize:10, color:C.white, fontWeight:800 }}>+{gap}h</span>}
          </div>
        </div>
      </div>

      <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
        {[[C.sl400,"기존 가동"],[C.amber,`확장 +${gap}h`]].map(([c,lb])=>(
          <div key={lb} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:C.sl600 }}>
            <div style={{ width:10, height:8, background:c, borderRadius:2 }}/>{lb}
          </div>
        ))}
        <div style={{ marginLeft:"auto", fontSize:9, color:C.sl400 }}>0~24시 기준</div>
      </div>
    </div>
  );
}

// 배경지식 카드
function BgCard({ pros, cons }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
      <div style={{ padding:"12px 14px", background:C.emeraldLight, borderRadius:8, border:`1px solid ${C.emerald}30` }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.emeraldDark, marginBottom:8 }}>찬성 배경지식 (필수열람)</div>
        {pros.map((p,i)=>(
          <div key={i} style={{ fontSize:11, color:C.emeraldDark, marginBottom:4, display:"flex", gap:5 }}>
            <span>✓</span><span>{p}</span>
          </div>
        ))}
      </div>
      <div style={{ padding:"12px 14px", background:C.roseLight, borderRadius:8, border:`1px solid ${C.rose}30` }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.rose, marginBottom:8 }}>반대 배경지식 (필수열람)</div>
        {cons.map((c,i)=>(
          <div key={i} style={{ fontSize:11, color:"#9f1239", marginBottom:4, display:"flex", gap:5 }}>
            <span>!</span><span>{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 수치결정 패널
function NumPanel({ title, claim, unit, experts, predictions, finalValue }) {
  const ranked = [...predictions].map((p,i)=>({...p,i,dist:Math.abs(p.value-finalValue)})).sort((a,b)=>a.dist-b.dist);
  const rewardMap = {};
  ranked.forEach((p,r)=>{ rewardMap[p.i]=r===0?"50%":r<=2?"15%":r<=4?"10%":"—"; });
  const fmt = v => Number(v).toFixed(0);
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <span style={{ fontSize:12, fontWeight:700, color:C.sl800 }}>{title} <span style={{ ...badge(C.amberLight, C.amberDark), marginLeft:4 }}>{claim}</span></span>
        <span style={{ fontSize:18, fontWeight:900, color:C.navy }}>{fmt(finalValue)}{unit}</span>
      </div>
      {/* 전문가 수치 */}
      <div style={{ display:"flex", gap:6, marginBottom:8 }}>
        {experts.map((e,i)=>(
          <div key={i} style={{ flex:1, padding:"8px 10px", background:C.violetLight, borderRadius:7, border:`1px solid ${C.violet}20` }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.violet }}>{e.name}</div>
            <div style={{ fontSize:15, fontWeight:900, color:C.navy, margin:"2px 0" }}>{e.value}{unit}</div>
            <div style={{ fontSize:9, color:C.sl500 }}>{e.basis}</div>
          </div>
        ))}
      </div>
      {/* 참여자 예측 */}
      <div style={{ fontSize:10, color:C.sl500, marginBottom:5 }}>참여자 예측 → 평균값이 최종 수치 (근접 예측자 보상)</div>
      <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
        {predictions.map((p,i)=>{
          const isWin = rewardMap[i]==="50%";
          return (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 10px", background:isWin?C.amberLight:C.sl50, borderRadius:5, border:`1px solid ${isWin?C.amber:C.sl200}` }}>
              <span style={{ fontSize:11, fontWeight:isWin?700:400 }}>{p.name}</span>
              <span style={{ fontSize:11, color:C.sl500 }}>예측 {p.value}{unit}</span>
              <span style={{ fontSize:11, fontWeight:700, color:isWin?C.amberDark:C.sl500 }}>{isWin?"🏆 ":""}{rewardMap[i]}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop:6, padding:"6px 12px", background:C.navy, borderRadius:5, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:10, color:"#93c5fd" }}>예측값 평균 → 최종</span>
        <span style={{ fontSize:14, fontWeight:900, color:"#34d399" }}>{fmt(finalValue)}{unit}</span>
      </div>
    </div>
  );
}

// 조편성 막대
function TeamBar({ total, r }) {
  const { A, B, C:Cc, D } = calcTeams(total, r);
  const teams = [["A조 주중오전",A,C.violet],["B조 주중오후",B,C.emerald],["C조 주말오전",Cc,C.amber],["D조 주말오후",D,C.rose]];
  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:8, alignItems:"flex-end", height:90 }}>
        {teams.map(([lb,n,col])=>{
          const h = Math.max(12,(n/total)*80);
          return (
            <div key={lb} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
              <div style={{ fontSize:10, fontWeight:700, color:col }}>{n}명</div>
              <div style={{ width:"100%", height:h, background:col, borderRadius:"4px 4px 0 0", opacity:0.85 }}/>
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {teams.map(([lb,,col])=>(
          <div key={lb} style={{ display:"flex", alignItems:"center", gap:4, fontSize:9, color:C.sl600 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:col }}/>{lb}
          </div>
        ))}
      </div>
    </div>
  );
}

// 연쇄 효과
function CascadeEffects({ added, gap }) {
  const items = [
    ["👔","고용 창출",`${added}명 신규 채용 — 임금 삭감 없음`,C.emerald,"청구항 1"],
    ["🕐","실질 주 3.5일제","1인 월 근무 119h (기존 대비 34% 감소)",C.violet,"발명의 효과"],
    ["🚗","교통체증 해소","출퇴근 시간대 분산 → 도심 정체 감소",C.amber,"특허 10-2807125"],
    ["🌱","환경 개선","피크타임 차량 감소 → 대기오염 저감",C.emeraldDark,"특허 10-2807125"],
    ["🏢","기업 비용 절감","공간·재료비 효율화 → 판관비 절감",C.navyLight,"청구항 2"],
    ["⚖️","가산수당 미발생","본인 정규 근무시간 → 야간·주말 가산 비해당",C.sl600,"법령 개정 전제"],
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {items.map((it,i)=>(
        <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"9px 12px", background:C.sl50, borderRadius:7, border:`1px solid ${C.sl200}` }}>
          <span style={{ fontSize:16, flexShrink:0 }}>{it[0]}</span>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:12, fontWeight:700, color:it[3] }}>{it[1]}</span>
              <span style={{ ...badge(C.sl100,C.sl500) }}>{it[4]}</span>
            </div>
            <div style={{ fontSize:11, color:C.sl600, marginTop:2 }}>{it[2]}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// 관리자 배치 (청구항 7)
function ManagerPlacement({ total }) {
  const leads = Math.max(2, Math.round(total*0.08));
  const execs = Math.max(1, Math.round(total*0.02));
  const saved = Math.floor(leads*0.5) + Math.floor(execs*0.5);
  const rows = [
    ["팀장급", leads, Math.ceil(leads*0.5), "하루 가동시간 중간 시간대 배치"],
    ["상무급", execs, Math.ceil(execs*0.5), "A조~C조 중간 요일에 배치"],
    ["사장/부사장", 2, 2, "팀장·상무 중간 시간대 배치"],
  ];
  return (
    <div>
      <div style={{ fontSize:11, color:C.sl600, marginBottom:10, lineHeight:1.6 }}>2개조 근무시간의 <strong>중간 시간대에 관리자를 배치</strong>하면 추가 채용 없이 두 조를 커버합니다.</div>
      {rows.map((r,i)=>(
        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:C.sl50, borderRadius:7, border:`1px solid ${C.sl200}`, marginBottom:5 }}>
          <span style={{ fontSize:12, fontWeight:700, color:C.sl800 }}>{r[0]}</span>
          <span style={{ fontSize:12, color:C.sl500 }}>{r[1]}명 → <strong style={{ color:r[1]!==r[2]?C.emerald:C.sl600 }}>{r[2]}명</strong></span>
          <span style={{ fontSize:10, color:C.sl500 }}>{r[3]}</span>
        </div>
      ))}
      <div style={{ padding:"9px 12px", background:C.emeraldLight, borderRadius:7, border:`1px solid ${C.emerald}40`, fontSize:11, color:C.emeraldDark }}>
        관리자 중간배치로 <strong>약 {saved}명</strong> 신규 채용 회피 → 고위급 인건비 부담 저감
      </div>
    </div>
  );
}

// 비용 절감 산출 (청구항 2)
function CostSaving({ employees, added, opHours, currentHours, salary }) {
  const prodInc = (opHours/currentHours)-1;
  const annual = employees*salary/10000;
  const addedCost = added*salary/10000;
  const items = [
    ["재료비 절감","생산량 증가 → 대량구매 할인",+(prodInc*annual*0.08).toFixed(1),C.amber,"도 21"],
    ["판관비 절감","공간 여유 → 임대료·관리비",+(0.12*annual*0.5).toFixed(1),C.violet,"도 21"],
    ["세제 혜택","고용 증대 세액공제",+(added*0.07).toFixed(1),C.emerald,"도 21"],
  ];
  const total = items.reduce((s,it)=>s+it[2],0);
  return (
    <div>
      {items.map((it,i)=>(
        <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background:C.sl50, borderRadius:7, border:`1px solid ${C.sl200}`, borderLeft:`3px solid ${it[3]}`, marginBottom:5 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ fontSize:12, fontWeight:700, color:it[3] }}>{it[0]}</span>
              <span style={{ ...badge(C.white,it[3]), border:`1px solid ${it[3]}30` }}>{it[4]}</span>
            </div>
            <div style={{ fontSize:10, color:C.sl500 }}>{it[1]}</div>
          </div>
          <span style={{ fontSize:13, fontWeight:800, color:it[3] }}>~{it[2]}억</span>
        </div>
      ))}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:C.navy, borderRadius:8, marginTop:8 }}>
        <div>
          <div style={{ fontSize:10, color:"#93c5fd" }}>연간 절감 합계 (추정)</div>
          <div style={{ fontSize:10, color:"#93c5fd" }}>추가 인건비 {addedCost.toFixed(1)}억 대비</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:20, fontWeight:900, color:"#34d399" }}>~{total.toFixed(1)}억</div>
          <div style={{ fontSize:10, color:"#93c5fd" }}>상쇄율 {Math.min(100,Math.round(total/addedCost*100))}%</div>
        </div>
      </div>
    </div>
  );
}

// 로드맵 SVG
function EmployRoadmap({ current }) {
  const phases = [{y:"1년차",r:10},{y:"2년차",r:18},{y:"3년차",r:27},{y:"5년차",r:40},{y:"목표",r:48}];
  const W=460,H=130,PL=36,PR=50,PT=12,PB=24;
  const cW=W-PL-PR,cH=H-PT-PB;
  const xP=i=>PL+i/(phases.length-1)*cW;
  const yP=v=>PT+cH-(v/50)*cH;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
        <line x1={PL} y1={yP(48)} x2={W-PR} y2={yP(48)} stroke={C.rose} strokeWidth="1" strokeDasharray="4 3"/>
        <text x={W-PR+4} y={yP(48)+4} fontSize="9" fill={C.rose} fontWeight="700">상한 48%</text>
        {[0,25,50].map(r=>(
          <g key={r}>
            <line x1={PL} y1={yP(r)} x2={W-PR} y2={yP(r)} stroke={C.sl200} strokeWidth="0.8" strokeDasharray="3 3"/>
            <text x={PL-4} y={yP(r)+4} fontSize="9" fill={C.sl400} textAnchor="end">{r}%</text>
          </g>
        ))}
        <path d={`M ${xP(0)} ${yP(phases[0].r)} ${phases.map((p,i)=>`L ${xP(i)} ${yP(p.r)}`).join(" ")} L ${xP(phases.length-1)} ${yP(0)} L ${xP(0)} ${yP(0)} Z`} fill={C.emerald} opacity="0.08"/>
        <polyline points={phases.map((p,i)=>`${xP(i)},${yP(p.r)}`).join(" ")} fill="none" stroke={C.emerald} strokeWidth="2.5"/>
        {phases.map((p,i)=>(
          <g key={i}>
            <circle cx={xP(i)} cy={yP(p.r)} r={i===phases.length-1?5:3.5} fill={i===phases.length-1?C.rose:C.emerald}/>
            <text x={xP(i)} y={yP(p.r)-8} fontSize="9" fill={C.sl700||C.sl600} textAnchor="middle" fontWeight="700">{p.r}%</text>
            <text x={xP(i)} y={H-3} fontSize="8" fill={C.sl500} textAnchor="middle">{p.y}</text>
          </g>
        ))}
        {current&&<line x1={PL} y1={yP(current)} x2={W-PR} y2={yP(current)} stroke={C.navy} strokeWidth="1" strokeDasharray="2 2" opacity="0.5"/>}
      </svg>
      <div style={{ fontSize:11, color:C.sl600, lineHeight:1.6, padding:"8px 12px", background:C.emeraldLight, borderRadius:7, border:`1px solid ${C.emerald}40` }}>
        <strong>이론적 상한 48%</strong>는 가동시간 최대 확대 시 산술적 상한입니다. 기업은 <strong>집단지성수렴으로 부담 없는 수준(초기 10%~)에서 자율 시작</strong>해 시장 반응에 따라 확대합니다.
      </div>
    </div>
  );
}

// 최후 방어선: 렌더링 오류가 발생해도 복구 버튼을 유지한다.
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "알 수 없는 화면 오류" };
  }

  componentDidCatch(error, info) {
    // 콘솔 진단은 남기되 사용자 화면에는 내부 스택을 노출하지 않는다.
    console.error("Demo render error", error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: "" });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight:"100vh", background:"#f8fafc", padding:24, fontFamily:"'Pretendard','Noto Sans KR',sans-serif" }}>
        <div style={{ maxWidth:620, margin:"80px auto", background:"#fff", border:"1px solid #fecaca", borderRadius:14, padding:24, textAlign:"center" }}>
          <div style={{ fontSize:34, marginBottom:10 }}>⚠️</div>
          <div style={{ fontSize:18, fontWeight:800, color:"#991b1b", marginBottom:8 }}>화면 오류가 자동 차단되었습니다</div>
          <div style={{ fontSize:12, color:"#64748b", marginBottom:18 }}>진행 중 작업을 폐기하고 안전한 초기상태로 복구할 수 있습니다.</div>
          <button onClick={this.props.onReset} style={{ padding:"11px 22px", background:"#dc2626", color:"#fff", border:0, borderRadius:8, fontWeight:800, cursor:"pointer" }}>
            ↺ 강제 초기화 및 복구
          </button>
          {this.state.message && <div style={{ marginTop:12, fontSize:10, color:"#94a3b8" }}>{this.state.message}</div>}
        </div>
      </div>
    );
  }
}

// ═══════════════════════════════════════════════════════
// 메인 앱
// ═══════════════════════════════════════════════════════
const INITIAL_STATE = {
  co: { name:"", employees:"100", industry:"제조업", currentHours:"9", sales:"50", salary:"4000" },
  step: 0, running: false, numRunning: false, error: "",
  targetHours: 16, agreeVote: "찬성", ratioA: 7, opHours: 16, startHour: 8,
  startDay: "월", dividendMgmt: 33, dividendWorker: 35, dividendApproved: "찬성",
  convergStep: 0, chartData: { agreeRate:[] }, step1Done: false, minorityNote: "",
  empRate: 16, step2Done: false, numDecision: null, insightData: null,
  result: null, useTransition: false, printReady: false,
};

export default function App() {
  const [co, setCo] = useState({ ...INITIAL_STATE.co });
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [numRunning, setNumRunning] = useState(false);
  const [error, setError] = useState("");
  const [targetHours, setTargetHours] = useState(16);
  const [agreeVote, setAgreeVote] = useState("찬성");
  const [ratioA, setRatioA] = useState(7);
  const [opHours, setOpHours] = useState(16);
  const [startHour, setStartHour] = useState(8);
  const [startDay, setStartDay] = useState("월");
  const [dividendMgmt, setDividendMgmt] = useState(33);
  const [dividendWorker, setDividendWorker] = useState(35);
  const [dividendApproved, setDividendApproved] = useState("찬성");
  const [convergStep, setConvergStep] = useState(0);
  const [chartData, setChartData] = useState({ agreeRate:[] });
  const [step1Done, setStep1Done] = useState(false);
  const [minorityNote, setMinorityNote] = useState("");
  const [empRate, setEmpRate] = useState(16);
  const [step2Done, setStep2Done] = useState(false);
  const [numDecision, setNumDecision] = useState(null);
  const [numStage, setNumStage] = useState(0);
  const [insightData, setInsightData] = useState(null);
  const [result, setResult] = useState(null);
  const [useTransition, setUseTransition] = useState(false);
  const [printReady, setPrintReady] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const taskRef = useRef({ id:0, controller:null, timers:new Set(), watchdog:null, type:"" });
  const numericAttemptRef = useRef(0);

  const curH = clamp(toInt(co.currentHours, 9), 4, 15);
  const employees = Math.max(10, toInt(co.employees, 100));

  useEffect(() => {
    setTargetHours(Math.min(16, curH + 7));
  }, [curH]);

  const cancelActiveTask = useCallback(() => {
    const current = taskRef.current;
    if (current.controller && !current.controller.signal.aborted) current.controller.abort();
    current.timers.forEach((timerId) => window.clearTimeout(timerId));
    current.timers.clear();
    if (current.watchdog !== null) window.clearTimeout(current.watchdog);
    taskRef.current = {
      id: current.id + 1,
      controller: null,
      timers: new Set(),
      watchdog: null,
      type: "",
    };
  }, []);

  const beginTask = useCallback((type, timeoutMs = 8000) => {
    cancelActiveTask();
    const controller = new AbortController();
    const task = {
      id: taskRef.current.id,
      controller,
      timers: new Set(),
      watchdog: null,
      type,
    };
    task.watchdog = window.setTimeout(() => {
      if (taskRef.current.id !== task.id) return;
      controller.abort();
      setRunning(false);
      setNumRunning(false);
      setNumStage(0);
      setError(`${type} 작업이 안전 제한시간을 초과해 자동 중단되었습니다. 상단 초기화 버튼으로 즉시 복구할 수 있습니다.`);
    }, timeoutMs);
    taskRef.current = task;
    return task;
  }, [cancelActiveTask]);

  const isCurrentTask = useCallback((task) => (
    taskRef.current.id === task.id && !task.controller.signal.aborted
  ), []);

  const sleepForTask = useCallback((ms, task) => new Promise((resolve, reject) => {
    if (!isCurrentTask(task)) {
      const aborted = new Error("작업이 취소되었습니다.");
      aborted.name = "AbortError";
      reject(aborted);
      return;
    }
    const timerId = window.setTimeout(() => {
      task.timers.delete(timerId);
      if (!isCurrentTask(task)) {
        const aborted = new Error("작업이 취소되었습니다.");
        aborted.name = "AbortError";
        reject(aborted);
        return;
      }
      resolve();
    }, ms);
    task.timers.add(timerId);
    task.controller.signal.addEventListener("abort", () => {
      window.clearTimeout(timerId);
      task.timers.delete(timerId);
      const aborted = new Error("작업이 취소되었습니다.");
      aborted.name = "AbortError";
      reject(aborted);
    }, { once:true });
  }), [isCurrentTask]);

  const finishTask = useCallback((task) => {
    if (taskRef.current.id !== task.id) return;
    task.timers.forEach((timerId) => window.clearTimeout(timerId));
    task.timers.clear();
    if (task.watchdog !== null) window.clearTimeout(task.watchdog);
    taskRef.current = { ...task, controller:null, timers:new Set(), watchdog:null, type:"" };
  }, []);

  // ── 전역 초기화: 비동기 작업·타이머·오류 상태를 모두 폐기 ──
  const hardReset = useCallback(() => {
    cancelActiveTask();
    numericAttemptRef.current = 0;
    setCo({ ...INITIAL_STATE.co });
    setStep(0);
    setRunning(false);
    setNumRunning(false);
    setError("");
    setTargetHours(16);
    setAgreeVote("찬성");
    setRatioA(7);
    setOpHours(16);
    setStartHour(8);
    setStartDay("월");
    setDividendMgmt(33);
    setDividendWorker(35);
    setDividendApproved("찬성");
    setConvergStep(0);
    setChartData({ agreeRate:[] });
    setStep1Done(false);
    setMinorityNote("");
    setEmpRate(16);
    setStep2Done(false);
    setNumDecision(null);
    setNumStage(0);
    setInsightData(null);
    setResult(null);
    setUseTransition(false);
    setPrintReady(false);
    setResetKey((value) => value + 1);
    window.requestAnimationFrame(() => window.scrollTo({ top:0, behavior:"auto" }));
  }, [cancelActiveTask]);

  useEffect(() => {
    const recoverFromUnhandledError = (event) => {
      event.preventDefault?.();
      cancelActiveTask();
      setRunning(false);
      setNumRunning(false);
      setNumStage(0);
      setError("예상하지 못한 오류가 차단되었습니다. 상단 초기화 버튼으로 안전하게 다시 시작할 수 있습니다.");
    };
    window.addEventListener("unhandledrejection", recoverFromUnhandledError);
    window.addEventListener("error", recoverFromUnhandledError);
    return () => {
      window.removeEventListener("unhandledrejection", recoverFromUnhandledError);
      window.removeEventListener("error", recoverFromUnhandledError);
      cancelActiveTask();
    };
  }, [cancelActiveTask]);

  const navigateTo = useCallback((nextStep) => {
    if (nextStep === step) return;
    if (nextStep === 2 && (!step1Done || agreeVote !== "찬성")) {
      setError("집단지성 수렴에서 도입 찬성 결과를 먼저 확정해야 합니다.");
      return;
    }
    if (nextStep === 3 && !result) {
      setError("수치결정과 최종 분석을 먼저 완료해야 합니다.");
      return;
    }
    cancelActiveTask();
    setRunning(false);
    setNumRunning(false);
    setNumStage(0);
    setError("");
    setStep(nextStep);
  }, [agreeVote, cancelActiveTask, result, step, step1Done]);

  // ── STEP 1: 집단지성 수렴 (취소·시간제한 지원) ───────
  const runConvergence = async () => {
    if (running || numRunning) return;
    const task = beginTask("집단지성 수렴", 7000);
    setRunning(true);
    setError("");
    setStep1Done(false);
    setConvergStep(0);
    setPrintReady(false);

    try {
      setConvergStep(1);
      await sleepForTask(320, task);

      setConvergStep(2);
      await sleepForTask(380, task);
      const seed = `${co.name}|${co.industry}|${employees}|convergence`;
      const sP = BG_PROS.map((_, index) => 55 + (hashText(`${seed}|p|${index}`) % 35));
      const sC = BG_CONS.map((_, index) => 30 + (hashText(`${seed}|c|${index}`) % 40));
      const topP = Math.max(...sP);
      const topC = Math.max(...sC);

      setConvergStep(3);
      await sleepForTask(320, task);

      setConvergStep(4);
      await sleepForTask(260, task);
      const target = 6 + (hashText(`${seed}|target`) % 3);
      const ordered = Array.from({ length:10 }, (_, index) => index)
        .sort((a, b) => hashText(`${seed}|order|${a}`) - hashText(`${seed}|order|${b}`));
      const agreeSet = new Set(ordered.slice(0, target));
      const parts = [];
      let agreeCount = 0;

      for (let index = 0; index < 10; index += 1) {
        const isAgree = agreeSet.has(index);
        const pro = isAgree
          ? 60 + (hashText(`${seed}|pro|${index}`) % 30)
          : 15 + (hashText(`${seed}|pro|${index}`) % 30);
        const con = isAgree
          ? 15 + (hashText(`${seed}|con|${index}`) % 30)
          : 60 + (hashText(`${seed}|con|${index}`) % 30);
        const vote = pro >= con ? "찬성" : "반대";
        if (vote === "찬성") agreeCount += 1;
        parts.push({ id:index + 1, pro, con, vote });
      }

      const disagreeCount = 10 - agreeCount;
      const agreeRate = Math.round((agreeCount / 10) * 100);
      const note = disagreeCount > 0 && disagreeCount < agreeCount
        ? "소수의견 보호 — 동의자 수와 무관하게 점수 높은 찬반 의견은 선택열람 순위 상승 (청구항 2)"
        : "";
      let cumulative = 0;
      const cumulativeRates = parts.map((participant, index) => {
        if (participant.vote === "찬성") cumulative += 1;
        return Math.round((cumulative / (index + 1)) * 100);
      });

      if (!isCurrentTask(task)) return;
      setMinorityNote(note);
      setAgreeVote(agreeRate >= 50 ? "찬성" : "반대");
      setChartData({
        agreeRate:[
          { cv:cumulativeRates[1] ?? agreeRate },
          { cv:cumulativeRates[4] ?? agreeRate },
          { cv:cumulativeRates[7] ?? agreeRate },
          { cv:agreeRate },
        ],
        parts,
        aCnt:agreeCount,
        dCnt:disagreeCount,
        aPct:agreeRate,
        sP,
        sC,
        topP,
        topC,
      });
      setStep1Done(true);
    } catch (caught) {
      if (caught?.name !== "AbortError" && isCurrentTask(task)) {
        setError("집단지성 수렴 중 오류가 발생했습니다. 상단 초기화 버튼으로 복구한 뒤 다시 실행해 주세요.");
      }
    } finally {
      if (isCurrentTask(task)) {
        setRunning(false);
        finishTask(task);
      }
    }
  };

  // ── STEP 2: 수치결정 — 공회전 방지형 단계 실행 ───────
  const runNumberDecision = async () => {
    if (numRunning || running) return;
    const task = beginTask("수치결정", 7000);
    numericAttemptRef.current += 1;
    const attempt = numericAttemptRef.current;

    setNumRunning(true);
    setError("");
    setStep2Done(false);
    setNumDecision(null);
    setNumStage(1);

    try {
      await sleepForTask(220, task);
      const decision = buildNumericDecision(employees, co.industry, attempt, co.name);

      setNumStage(2);
      await sleepForTask(240, task);

      let dividend = null;
      if (dividendApproved === "찬성") {
        const drift = seededOffset(`${co.name}|${co.industry}|${attempt}|dividend`, 3) * 2;
        const finalValue = clamp(35 + drift, 25, 50);
        dividend = {
          experts:[
            { name:"전문가1", value:35, basis:"동기부여 적정선" },
            { name:"전문가2", value:40, basis:"참여 독려 강화" },
            { name:"전문가3", value:30, basis:"경영 안정 고려" },
          ],
          predictions:makePredictions(finalValue, 25, 50, 2),
          final:finalValue,
        };
      }

      setNumStage(3);
      await sleepForTask(240, task);

      if (!isCurrentTask(task)) return;
      const nextDecision = { ...decision, dividend };
      setEmpRate(decision.empRate.final);
      setRatioA(decision.ratioA.final);
      setOpHours(decision.opHours.final);
      setStartHour(decision.startHour.final);
      if (dividend) {
        setDividendWorker(dividend.final);
        setDividendMgmt(clamp(100 - dividend.final, 25, 50));
      }
      setNumDecision(nextDecision);
      setNumStage(4);
      setStep2Done(true);
    } catch (caught) {
      if (caught?.name !== "AbortError" && isCurrentTask(task)) {
        setError("수치결정 중 오류가 발생했습니다. 작업은 자동 중단되었습니다. 초기화 후 다시 실행해 주세요.");
      }
    } finally {
      if (isCurrentTask(task)) {
        setNumRunning(false);
        finishTask(task);
      }
    }
  };

  // ── STEP 3: 최종 결과 생성 — 외부 API 없이 즉시 완료 ──
  const runFinal = async () => {
    if (running || numRunning || !step2Done || !numDecision) return;
    const task = beginTask("최종 분석", 5000);
    setRunning(true);
    setError("");

    try {
      await sleepForTask(180, task);
      const total = Math.round(employees * (1 + empRate / 100));
      const added = Math.max(0, total - employees);
      const teams = calcTeams(total, ratioA);
      const insights = buildLocalInsights({
        currentHours:curH,
        opHours,
        added,
        dividendMgmt,
        dividendWorker,
      });

      if (!isCurrentTask(task)) return;
      setInsightData(insights);
      setResult({
        total,
        added,
        teams,
        empRate,
        opHours,
        ratioA,
        startHour,
        startDay,
        dividendMgmt,
        dividendWorker,
        dividendApproved,
        useTransition,
      });
      setStep(3);
    } catch (caught) {
      if (caught?.name !== "AbortError" && isCurrentTask(task)) {
        setError("최종 분석 중 오류가 발생했습니다. 상단 초기화 버튼으로 복구해 주세요.");
      }
    } finally {
      if (isCurrentTask(task)) {
        setRunning(false);
        finishTask(task);
      }
    }
  };

  // ── 리포트 다운로드 ────────────────────────────────────
  const downloadReport = () => {
    if(!result) return;
    const esc=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
    const {A,B,C:Cc,D}=result.teams;
    const ins=(insightData?.insights||[]).map((t,i)=>`<li><b>0${i+1}</b> ${esc(t)}</li>`).join("");
    const html=`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${esc(co.name||"기업")} 분석리포트</title>
<style>@page{size:A4;margin:16mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact}body{font-family:'맑은 고딕',sans-serif;color:#1e293b;margin:0;padding:20px;line-height:1.5}.hint{background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px;margin-bottom:14px;font-size:12px;color:#065f46}@media print{.hint{display:none}}.head{border-bottom:3px solid #0f1f3d;padding-bottom:10px;margin-bottom:14px}.bk{display:inline-block;background:#1e3a5f;color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;margin-right:3px}h1{font-size:18px;font-weight:800;color:#0f1f3d;margin:5px 0 2px}h2{font-size:12px;font-weight:800;color:#0f1f3d;margin:14px 0 6px;padding-left:6px;border-left:3px solid #f59e0b}sub{font-size:11px;color:#64748b}.kpis{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.kpi{flex:1;min-width:80px;background:#0f1f3d;color:#fff;border-radius:8px;padding:10px 6px;text-align:center}.kpi .v{font-size:16px;font-weight:900}.kpi .l{font-size:9px;color:#93c5fd;margin-top:2px}table{width:100%;border-collapse:collapse;margin-bottom:6px}th{background:#0f1f3d;color:#fff;font-size:10px;padding:6px;text-align:center}td{font-size:10px;padding:6px;border:1px solid #e2e8f0;text-align:center}ul{list-style:none;padding:0;margin:0}li{font-size:11px;padding:7px 10px;background:#f0f9ff;border-radius:5px;margin-bottom:4px}li b{color:#7c3aed;margin-right:5px}.warn{font-size:10px;padding:8px 10px;background:#fef3c7;color:#854f0b;border-radius:5px;margin-top:5px}.foot{margin-top:16px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8;text-align:center}</style></head><body>
<div class="hint">✅ Ctrl+P (Mac:Cmd+P) → <strong>"PDF로 저장"</strong> 선택</div>
<div class="head"><div><span class="bk">특허 10-2045540</span><span class="bk">10-1804960</span><span class="bk">10-1998825</span></div><h1>4조2교대 고용창출 분석 리포트</h1><sub>${esc(co.name||"기업")} · ${esc(co.industry)} · 직원 ${employees}명 · 가동 ${curH}h→${result.opHours}h</sub></div>
<div class="kpis">
<div class="kpi"><div class="v" style="color:#34d399">${agreeVote}</div><div class="l">집단지성 가부</div></div>
<div class="kpi"><div class="v" style="color:#fbbf24">${result.opHours}h</div><div class="l">가동시간</div></div>
<div class="kpi"><div class="v" style="color:#f87171">${result.empRate}%</div><div class="l">고용확대율</div></div>
<div class="kpi"><div class="v" style="color:#34d399">+${result.added}명</div><div class="l">추가 고용</div></div>
<div class="kpi"><div class="v" style="color:#818cf8">${result.total}명</div><div class="l">총 인원</div></div>
<div class="kpi"><div class="v" style="color:#60a5fa">${result.dividendApproved==="찬성"?result.dividendWorker+"%":"미배당"}</div><div class="l">근로자 배당율</div></div>
</div>
<h2>1. 4조 인원 배분 (도면 17)</h2>
<table><thead><tr><th>A조 주중오전</th><th>B조 주중오후</th><th>C조 주말오전</th><th>D조 주말오후</th></tr></thead><tbody><tr><td>${A}명</td><td>${B}명</td><td>${Cc}명</td><td>${D}명</td></tr></tbody></table>
<sub>오전:오후=주중:주말=${result.ratioA}:${10-result.ratioA} · 시작 ${result.startHour}시/${esc(result.startDay)}요일 · 오전조 ${result.startHour}:00~${result.startHour+8}:00 · 오후조 ${result.startHour+8}:00~${result.startHour+16}:00</sub>
<h2>2. 수치결정 결과</h2>
<table><thead><tr><th>고용확대율</th><th>A조비율</th><th>가동시간</th><th>시작시간</th></tr></thead><tbody><tr><td>${result.empRate}%</td><td>${result.ratioA}:${10-result.ratioA}</td><td>${result.opHours}h</td><td>${result.startHour}시</td></tr></tbody></table>
<h2>3. 핵심 인사이트</h2><ul>${ins}</ul>
${insightData?.warning?`<div class="warn">⚠ ${esc(insightData.warning)}</div>`:""}
${result.useTransition?`<div class="warn" style="background:#ede9fe;color:#534ab7">과도기 2조2교대 모드 적용</div>`:""}
<div class="foot">집단지성수렴에 의한 근무형태 변경 고용창출시스템 · 등록특허 10-2045540</div>
</body></html>`;
    try {
      const blob=new Blob([html],{type:"text/html;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url; a.download=`${co.name||"리포트"}_고용창출분석.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),5000);
      setPrintReady(true);
    } catch(e){ setError("다운로드 중 오류가 발생했습니다."); }
  };

  const STEPS=["기업 현황","집단지성 수렴","수치결정","최종 결과"];

  // ── 렌더 ──────────────────────────────────────────────
  return (
    <AppErrorBoundary resetKey={resetKey} onReset={hardReset}>
      <div key={resetKey} style={{ fontFamily:"'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif", background:C.sl50, minHeight:"100vh" }}>

      {/* ── 헤더 ── */}
      <div style={{ background:C.navy, color:C.white, padding:"12px 20px", position:"sticky", top:0, zIndex:1000, boxShadow:"0 3px 12px rgba(15,31,61,0.22)" }}>
        <div style={{ maxWidth:860, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ display:"flex", gap:5, marginBottom:4, flexWrap:"wrap" }}>
              {[["10-2045540","고용창출"],["10-1804960","집단지성"],["10-1998825","수치결정"]].map(([n,l])=>(
                <span key={n} style={{ ...badge("#2d4f7a","#93c5fd") }}>특허 {n}·{l}</span>
              ))}
            </div>
            <div style={{ fontSize:15, fontWeight:800, letterSpacing:"-0.3px" }}>
              4조2교대 고용창출 시스템
              <span style={{ fontSize:11, fontWeight:400, color:"#93c5fd", marginLeft:8 }}>근무형태 변경을 통한 고용창출 데모</span>
            </div>
          </div>
          {/* 초기화 버튼 */}
          <button onClick={hardReset} title="진행 중인 모든 작업·타이머·오류를 폐기하고 처음으로 돌아갑니다" style={{ padding:"9px 16px", background:"#dc2626", color:C.white, border:"1px solid #fca5a5", borderRadius:8, fontSize:12, fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap", boxShadow:"0 2px 8px rgba(220,38,38,0.3)" }}>
            ↺ 전체 초기화 · 강제복구
          </button>
        </div>
      </div>

      <div style={{ maxWidth:860, margin:"0 auto", padding:"16px" }}>
        {/* 에러 */}
        {error&&(
          <div style={{ padding:"10px 14px", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, fontSize:12, color:"#dc2626", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span>⚠ {error}</span>
            <button onClick={()=>setError("")} style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626", fontSize:14 }}>✕</button>
          </div>
        )}

        <StepTabs current={step} steps={STEPS} onSelect={navigateTo}/>

        {/* ══ STEP 0: 기업 현황 ══ */}
        {step===0&&(<>
          {/* 핵심 메시지 */}
          <div style={{ ...card(), background:C.navy, border:"none" }}>
            <div style={{ padding:"18px 22px" }}>
              <div style={{ fontSize:11, color:"#93c5fd", fontWeight:700, marginBottom:5 }}>발명의 핵심 논리</div>
              <div style={{ fontSize:16, fontWeight:800, color:C.white, lineHeight:1.5, marginBottom:8 }}>
                수면시간(~6h)을 제외한 나머지 시간,<br/>경제가 돌아간다면?
              </div>
              <div style={{ fontSize:11, color:"#bfdbfe", lineHeight:1.7 }}>
                밤 9시 은행 상담 · 밤 11시 민원 접수 · 심야 카센터 — 공급이 정착되면 수요가 따른다.<br/>
                임금 삭감 없이, 기업 비용은 줄이면서, 고용을 늘린다.
              </div>
            </div>
          </div>

          {/* 기업 정보 */}
          <div style={card()}>
            <div style={cardHead()}>
              <span style={{ fontSize:13, fontWeight:700 }}>기업 정보 입력</span>
              <span style={{ ...badge(C.violetLight,C.violet), marginLeft:"auto" }}>청구항 1</span>
            </div>
            <div style={{ padding:20 }}>
              <div style={{ marginBottom:12 }}>
                <span style={lbl}>회사명 *</span>
                <input style={fld} placeholder="예: (주)한국제조" value={co.name} onChange={e=>setCo(p=>({...p,name:e.target.value}))}/>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div><span style={lbl}>직원 수 (명)</span><input style={fld} type="number" min="10" value={co.employees} onChange={e=>setCo(p=>({...p,employees:e.target.value}))}/></div>
                <div><span style={lbl}>현재 하루 가동시간 (시간)</span><input style={fld} type="number" min="4" max="15" value={co.currentHours} onChange={e=>setCo(p=>({...p,currentHours:e.target.value}))}/></div>
                <div><span style={lbl}>업종</span><select style={fld} value={co.industry} onChange={e=>setCo(p=>({...p,industry:e.target.value}))}>{INDUSTRIES.map(v=><option key={v}>{v}</option>)}</select></div>
                <div><span style={lbl}>1인 평균 인건비 (만원/년)</span><input style={fld} type="number" min="2000" value={co.salary} onChange={e=>setCo(p=>({...p,salary:e.target.value}))}/></div>
              </div>
            </div>
          </div>

          {/* 가동시간 갭 */}
          <div style={card()}>
            <div style={cardHead()}>
              <span style={{ fontSize:13, fontWeight:700 }}>가동시간 갭 분석 — 고용창출의 근거</span>
              <span style={{ ...badge(C.amberLight,C.amberDark), marginLeft:"auto" }}>발명의 핵심 원리</span>
            </div>
            <OperatingTimeline currentHours={curH} targetHours={targetHours}/>
            <div style={{ padding:"0 20px 16px" }}>
              <div style={{ marginBottom:10 }}>
                <span style={lbl}>4조2교대 목표 가동시간 <span style={{ ...badge(C.violetLight,C.violet) }}>청구항 1</span></span>
                <input type="range" min={curH+1} max={16} value={targetHours} onChange={e=>setTargetHours(Number(e.target.value))} style={{ width:"100%", accentColor:C.navy, margin:"6px 0" }}/>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.sl400 }}>
                  <span>{curH+1}h</span><span>8시 시작 → 최대 24시(자정)</span><span>16h</span>
                </div>
              </div>
              <div style={{ padding:"10px 14px", background:C.amberLight, borderRadius:8, border:`1px solid ${C.amber}50` }}>
                <span style={{ fontSize:12, color:C.amberDark, fontWeight:700 }}>
                  가동시간 {curH}h → {targetHours}h (+{targetHours-curH}h) · 기존 대비 {Math.round((targetHours/curH-1)*100)}% 증가
                </span>
                <div style={{ fontSize:11, color:C.amberDark, marginTop:4 }}>
                  이 {targetHours-curH}시간의 갭을 커버할 인력이 바로 신규 고용입니다
                </div>
              </div>
            </div>
          </div>

          {/* 연쇄 효과 */}
          <div style={card()}>
            <div style={cardHead()}><span style={{ fontSize:13, fontWeight:700 }}>연쇄 효과 — 하나의 근무형태 변경이 만드는 변화</span></div>
            <div style={{ padding:20 }}><CascadeEffects added={Math.round(employees*0.16)} gap={targetHours-curH}/></div>
          </div>

          {/* 과도기 모드 */}
          <div style={card()}>
            <div style={cardHead()}>
              <span style={{ fontSize:13, fontWeight:700 }}>과도기 2조2교대 모드</span>
              <span style={{ ...badge(C.violetLight,C.violet), marginLeft:8 }}>청구항 8</span>
              <label style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
                <input type="checkbox" checked={useTransition} onChange={e=>setUseTransition(e.target.checked)} style={{ accentColor:C.navy, width:16, height:16 }}/>
                <span style={{ fontSize:11, fontWeight:600, color:C.sl600 }}>과도기 적용</span>
              </label>
            </div>
            {useTransition?(
              <div style={{ padding:20 }}>
                <div style={{ fontSize:11, color:C.sl600, marginBottom:10 }}>4조2교대 직도입이 어려운 기업은 <strong>주중조·주말조 2개조</strong>로 시작합니다.</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div style={{ padding:"10px", background:C.violetLight, borderRadius:7 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.violet }}>주중조 (월~목)</div>
                    <div style={{ fontSize:18, fontWeight:900, color:C.violet, marginTop:3 }}>{Math.round(employees*0.7)}명</div>
                  </div>
                  <div style={{ padding:"10px", background:C.amberLight, borderRadius:7 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.amberDark }}>주말조 (금~일)</div>
                    <div style={{ fontSize:18, fontWeight:900, color:C.amberDark, marginTop:3 }}>{employees-Math.round(employees*0.7)}명</div>
                  </div>
                </div>
              </div>
            ):(
              <div style={{ padding:"12px 20px", fontSize:11, color:C.sl500 }}>4조2교대를 바로 도입하기 어렵다면 체크하세요. 주중·주말 2개조로 시작해 단계적으로 전환합니다.</div>
            )}
          </div>

          <div style={{ textAlign:"right", paddingBottom:16 }}>
            <button style={btn("lg")} onClick={()=>{ if(!co.name.trim()){setError("회사명을 입력해주세요.");return;} setError(""); navigateTo(1); }}>
              집단지성 수렴 시작 →
            </button>
          </div>
        </>)}

        {/* ══ STEP 1: 집단지성 수렴 ══ */}
        {step===1&&(<>
          <div style={{ ...card(), background:C.violetLight, border:`1px solid ${C.violet}30` }}>
            <div style={{ padding:"14px 20px" }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.violet, marginBottom:4 }}>집단지성수렴시스템 — 4단계 가부(可否) 결정</div>
              <div style={{ fontSize:11, color:C.sl600, lineHeight:1.6 }}>
                찬반 배경지식 제시 → 참여자 점수 부여 → 배경지식 순위 갱신 → 참여자 가부 의사결정.
                구체적 수치는 다음 단계(수치결정)에서 결정합니다.
              </div>
            </div>
          </div>

          {/* ① 배경지식 */}
          <div style={card()}>
            <div style={cardHead()}>
              <span style={{ fontSize:13, fontWeight:700 }}>① 전문가 배경지식 (찬반 각 3개)</span>
              <span style={{ ...badge(C.violetLight,C.violet), marginLeft:"auto" }}>특허 10-1804960 청구항 1</span>
            </div>
            <div style={{ padding:20 }}>
              <div style={{ fontSize:11, color:C.sl500, marginBottom:10 }}>참여자들은 아래 찬성·반대 배경지식(필수열람의견)을 반드시 열람한 후 점수를 부여합니다.</div>
              <BgCard pros={BG_PROS} cons={BG_CONS}/>
            </div>
          </div>

          {/* 배당 가부 */}
          <div style={card()}>
            <div style={cardHead()}>
              <span style={{ fontSize:13, fontWeight:700 }}>순이익 배당 가부</span>
              <span style={{ ...badge(C.violetLight,C.violet), marginLeft:"auto" }}>청구항 6</span>
            </div>
            <div style={{ padding:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C.sl700, marginBottom:8 }}>
                "도입으로 순이익이 증가할 경우, 근로자에게도 일정 비율을 배당하는 것에 찬성하십니까?"
              </div>
              <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                {["찬성","반대"].map(v=>(
                  <button key={v} onClick={()=>setDividendApproved(v)} style={{ flex:1, padding:"9px 0", borderRadius:6, fontSize:13, fontWeight:700, cursor:"pointer", background:dividendApproved===v?(v==="찬성"?C.emerald:C.rose):C.sl100, color:dividendApproved===v?C.white:C.sl600, border:"none" }}>{v}</button>
                ))}
              </div>
              <div style={{ padding:"9px 12px", background:C.emeraldLight, borderRadius:7, border:`1px solid ${C.emerald}40`, fontSize:11, color:C.emeraldDark }}>
                💡 순이익 증가 시 배당으로 <strong>근로자 소득 증대에도 기여</strong>합니다. (제도 참여 독려 장치)
              </div>
            </div>
          </div>

          {/* 수렴 실행 */}
          <div style={card()}>
            <div style={cardHead()}>
              <span style={{ fontSize:13, fontWeight:700 }}>집단지성 수렴 실행</span>
              <span style={{ ...badge(C.violetLight,C.violet), marginLeft:"auto" }}>4단계 프로세스</span>
            </div>
            <div style={{ padding:20 }}>
              {/* 4단계 진행 바 */}
              <div style={{ display:"flex", gap:0, marginBottom:16 }}>
                {["① 배경지식 제시","② 참여자 점수 부여","③ 배경지식 순위 갱신","④ 참여자 가부 결정"].map((lb,i)=>{
                  const done=convergStep>i+1, active=convergStep===i+1&&running;
                  return (
                    <div key={i} style={{ flex:1, textAlign:"center", padding:"8px 3px", background:done?C.emeraldLight:active?C.violetLight:C.sl50, borderTop:`3px solid ${done?C.emerald:active?C.violet:C.sl200}`, fontSize:9, fontWeight:done||active?700:400, color:done?C.emeraldDark:active?C.violet:C.sl400 }}>
                      {done?"✓":active?"●":""} {lb}
                    </div>
                  );
                })}
              </div>

              {/* ② 점수 결과 */}
              {step1Done&&chartData.sP&&(
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.sl600, marginBottom:8 }}>② 참여자 점수 부여 결과</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    <div style={{ padding:"10px 12px", background:C.emeraldLight, borderRadius:8, border:`1px solid ${C.emerald}30` }}>
                      <div style={{ fontSize:10, fontWeight:700, color:C.emeraldDark, marginBottom:6 }}>찬성 배경지식</div>
                      {BG_PROS.map((bg,i)=>(
                        <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.sl700, marginBottom:3 }}>
                          <span style={{ flex:1, marginRight:6 }}>{bg}</span>
                          <span style={{ fontWeight:700, color:C.emeraldDark, flexShrink:0 }}>{chartData.sP[i]}점</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding:"10px 12px", background:C.roseLight, borderRadius:8, border:`1px solid ${C.rose}30` }}>
                      <div style={{ fontSize:10, fontWeight:700, color:C.rose, marginBottom:6 }}>반대 배경지식</div>
                      {BG_CONS.map((bg,i)=>(
                        <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.sl700, marginBottom:3 }}>
                          <span style={{ flex:1, marginRight:6 }}>{bg}</span>
                          <span style={{ fontWeight:700, color:C.rose, flexShrink:0 }}>{chartData.sC[i]}점</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ③ 순위 갱신 */}
              {step1Done&&chartData.topP&&(
                <div style={{ marginBottom:14, padding:"10px 14px", background:C.sl50, borderRadius:8, border:`1px solid ${C.sl200}` }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.sl700, marginBottom:6 }}>③ 배경지식 순위 갱신 — 필수열람의견 확정</div>
                  <div style={{ fontSize:10, color:C.sl600, marginBottom:6 }}>점수 순위에 따라 찬성·반대 각 상위 3개가 <strong>필수열람의견</strong>으로 확정됩니다. 동의자 수와 무관하게 점수가 높으면 순위가 상승합니다 (소수의견 보호).</div>
                  <div style={{ display:"flex", gap:12, fontSize:10 }}>
                    <span style={{ color:C.emeraldDark, fontWeight:700 }}>찬성 최고점: {chartData.topP}점 → 필수열람 1위</span>
                    <span style={{ color:C.rose, fontWeight:700 }}>반대 최고점: {chartData.topC}점 → 필수열람 1위</span>
                  </div>
                  {minorityNote&&(
                    <div style={{ marginTop:6, padding:"5px 8px", background:C.amberLight, borderRadius:5, fontSize:9, color:C.amberDark, border:`1px solid ${C.amber}40` }}>⚡ {minorityNote}</div>
                  )}
                </div>
              )}

              {/* ④ 참여자 가부 결정 */}
              {step1Done&&(
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.sl600, marginBottom:8 }}>④ 참여자 가부 의사결정 (10명) — 필수열람의견 열람 후 찬반 결정</div>
                  <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                    {[[C.emeraldLight,C.emeraldDark,"찬성 인원",chartData.aCnt],[C.roseLight,C.rose,"반대 인원",chartData.dCnt],[C.navy,"#34d399","찬성율",`${chartData.aPct}%`]].map(([bg,tc,lb,v],i)=>(
                      <div key={i} style={{ flex:1, padding:"10px 12px", background:bg, borderRadius:8, textAlign:"center" }}>
                        <div style={{ fontSize:10, color:i===2?"#93c5fd":tc }}>{lb}</div>
                        <div style={{ fontSize:20, fontWeight:900, color:i===2?"#34d399":tc }}>{typeof v==="number"?`${v}명`:v}</div>
                      </div>
                    ))}
                  </div>
                  {chartData.parts&&(
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:10, color:C.sl500, marginBottom:5 }}>각 참여자는 필수열람의견(배경지식)을 모두 열람한 후 해당 안건에 대한 가부를 결정합니다</div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:4 }}>
                        {chartData.parts.map(p=>(
                          <div key={p.id} style={{ padding:"5px 4px", borderRadius:5, textAlign:"center", background:p.vote==="찬성"?C.emeraldLight:C.roseLight, border:`1px solid ${p.vote==="찬성"?C.emerald+"40":C.rose+"40"}` }}>
                            <div style={{ fontSize:8, color:C.sl500 }}>참여자{p.id}</div>
                            <div style={{ fontSize:8, color:C.sl500 }}>찬{p.pro}·반{p.con}점</div>
                            <div style={{ fontSize:10, fontWeight:800, color:p.vote==="찬성"?C.emeraldDark:C.rose }}>{p.vote}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 최종 가부 */}
              {step1Done&&(
                <div style={{ padding:"14px 18px", background:C.navy, borderRadius:8, marginBottom:16, textAlign:"center" }}>
                  <div style={{ fontSize:11, color:"#93c5fd", fontWeight:700, marginBottom:3 }}>집단지성 최종 가부 도출</div>
                  <div style={{ fontSize:26, fontWeight:900, color:agreeVote==="찬성"?"#34d399":"#f87171" }}>4조2교대 도입 "{agreeVote}"</div>
                  <div style={{ fontSize:11, color:"#93c5fd", marginTop:3 }}>
                    찬성 {chartData.aCnt??"-"}명 / 반대 {chartData.dCnt??"-"}명 → {chartData.aPct??"-"}% · 배당 {dividendApproved}
                  </div>
                </div>
              )}

              <div style={{ display:"flex", gap:8, justifyContent:"space-between", alignItems:"center" }}>
                <button style={btn("ghost")} onClick={()=>navigateTo(0)}>← 이전</button>
                <div style={{ display:"flex", gap:8 }}>
                  <button style={{ ...btn("secondary"), opacity:running?0.5:1 }} onClick={runConvergence} disabled={running}>
                    {running?"수렴 중...":step1Done?"↺ 재수렴":"▶ 가부 결정 시작"}
                  </button>
                  {step1Done&&agreeVote==="찬성"&&(
                    <button style={btn("lg")} onClick={()=>navigateTo(2)}>수치결정 →</button>
                  )}
                </div>
              </div>
              {step1Done&&agreeVote==="반대"&&(
                <div style={{ marginTop:10, padding:"9px 12px", background:C.roseLight, borderRadius:6, fontSize:11, color:"#9f1239" }}>
                  집단지성 결과가 "반대"입니다. 배경지식 보완 또는 배당 조건 변경 후 재수렴할 수 있습니다.
                </div>
              )}
            </div>
          </div>
        </>)}

        {/* ══ STEP 2: 수치결정 ══ */}
        {step===2&&(<>
          <div style={{ ...card(), background:C.amberLight, border:`1px solid ${C.amber}40` }}>
            <div style={{ padding:"14px 20px" }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.amberDark, marginBottom:4 }}>수치결정시스템 — 예측-평균 방식</div>
              <div style={{ fontSize:11, color:C.sl600, lineHeight:1.6 }}>
                전문가가 근거와 함께 수치를 제시 → 참여자가 <strong>"최종 수렴값"을 예측</strong> → 예측값의 평균이 최종 수치.
                근접 예측자에게 보상이 돌아가 객관성이 담보됩니다.
              </div>
            </div>
          </div>

          <div style={card()}>
            <div style={cardHead()}>
              <span style={{ fontSize:13, fontWeight:700 }}>수치결정 실행 — 4개 항목</span>
              <span style={{ ...badge(C.amberLight,C.amberDark), marginLeft:"auto" }}>특허 10-1998825 청구항 9</span>
            </div>
            <div style={{ padding:20 }}>
              {!step2Done&&(
                <div style={{ textAlign:"center", padding:"22px 0" }}>
                  <div style={{ fontSize:12, color:C.sl500, marginBottom:16, lineHeight:1.65 }}>
                    고용확대율 · A조비율 · 가동시간 · 시작시간을 업종별 전문가 기준과<br/>참여자 예측-평균 방식으로 안전하게 결정합니다.
                  </div>

                  {numRunning&&(
                    <div style={{ maxWidth:520, margin:"0 auto 16px", padding:"12px 14px", background:C.sl50, borderRadius:9, border:`1px solid ${C.sl200}` }}>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:5, marginBottom:9 }}>
                        {["입력 검증","전문가 수치","참여자 예측","결과 확정"].map((label,index)=>{
                          const stage=index+1;
                          const done=numStage>stage;
                          const active=numStage===stage;
                          return (
                            <div key={label} style={{ padding:"6px 4px", borderRadius:6, background:done?C.emeraldLight:active?C.amberLight:C.white, border:`1px solid ${done?C.emerald:active?C.amber:C.sl200}`, fontSize:9, fontWeight:done||active?800:500, color:done?C.emeraldDark:active?C.amberDark:C.sl400 }}>
                              {done?"✓ ":active?"● ":""}{label}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ height:6, background:C.sl200, borderRadius:99, overflow:"hidden" }}>
                        <div style={{ width:`${Math.max(8, numStage*25)}%`, height:"100%", background:C.amber, transition:"width 0.2s ease" }}/>
                      </div>
                      <div style={{ fontSize:10, color:C.sl500, marginTop:7 }}>외부 API 없이 로컬 엔진으로 처리 중 · 7초 초과 시 자동 중단</div>
                    </div>
                  )}

                  <button style={{ ...btn("lg"), opacity:numRunning?0.55:1 }} onClick={runNumberDecision} disabled={numRunning}>
                    {numRunning?"수치결정 진행 중…":"▶ 수치결정 실행"}
                  </button>
                </div>
              )}

              {step2Done&&numDecision&&(<>
                <NumPanel title="① 고용확대율" claim="핵심 수치" unit="%" experts={numDecision.empRate.experts} predictions={numDecision.empRate.predictions} finalValue={numDecision.empRate.final}/>

                {/* A조 비율 + 4개조 환산 */}
                <NumPanel title="② A조 비율 (오전:오후 = 주중:주말)" claim="조편성" unit="" experts={numDecision.ratioA.experts} predictions={numDecision.ratioA.predictions} finalValue={numDecision.ratioA.final}/>
                {(()=>{
                  const r=numDecision.ratioA.final, s=calcTeams(100,r);
                  return(
                    <div style={{ marginTop:-14, marginBottom:20, padding:"10px 14px", background:C.violetLight, borderRadius:8, border:`1px solid ${C.violet}30` }}>
                      <div style={{ fontSize:11, fontWeight:700, color:C.violet, marginBottom:6 }}>4개조 비율 환산 (100명 기준, 오전:오후=주중:주말={r}:{10-r})</div>
                      <div style={{ display:"flex", gap:6 }}>
                        {[["A조 주중오전",s.A,C.violet],["B조 주중오후",s.B,C.emerald],["C조 주말오전",s.C,C.amber],["D조 주말오후",s.D,C.rose]].map(([lb,v,col])=>(
                          <div key={lb} style={{ flex:1, textAlign:"center", padding:"6px 4px", background:C.white, borderRadius:5, border:`1px solid ${col}30` }}>
                            <div style={{ fontSize:8, color:C.sl500 }}>{lb}</div>
                            <div style={{ fontSize:14, fontWeight:900, color:col }}>{v}명</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <NumPanel title="③ 하루 가동시간" claim="가동" unit="h" experts={numDecision.opHours.experts} predictions={numDecision.opHours.predictions} finalValue={numDecision.opHours.final}/>
                <NumPanel title="④ A조 시작시간" claim="근무 시작" unit="시" experts={numDecision.startHour.experts} predictions={numDecision.startHour.predictions} finalValue={numDecision.startHour.final}/>
                {numDecision.dividend&&(
                  <NumPanel title="⑤ 근로자 순이익 배당율" claim="성과 분배" unit="%" experts={numDecision.dividend.experts} predictions={numDecision.dividend.predictions} finalValue={numDecision.dividend.final}/>
                )}

                {/* 점진적 로드맵 */}
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.sl700, marginBottom:10 }}>
                    고용확대율 점진적 로드맵 <span style={{ ...badge(C.emeraldLight,C.emeraldDark), marginLeft:5 }}>48% 상한 / 10% 출발</span>
                  </div>
                  <EmployRoadmap current={empRate}/>
                </div>

                {/* 비용 구조 */}
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.sl700, marginBottom:10 }}>비합리적 비용 재평가 <span style={{ ...badge(C.amberLight,C.amberDark) }}>청구항 4</span></div>
                  <div style={{ padding:"10px 14px", background:C.amberLight, borderRadius:8, border:`1px solid ${C.amber}40`, fontSize:11, color:C.amberDark }}>
                    경쟁사 대비 과도한 임금 등 비합리적 비용을 수치결정시스템으로 재평가하여 고용확대 비용 부담을 저감합니다.
                  </div>
                </div>
              </>)}

              <div style={{ display:"flex", gap:8, justifyContent:"space-between", marginTop:8 }}>
                <button style={btn("ghost")} onClick={()=>navigateTo(1)}>← 집단지성으로</button>
                <div style={{ display:"flex", gap:8 }}>
                  {step2Done&&(
                    <button style={{ ...btn("secondary"), opacity:numRunning?0.5:1 }} onClick={runNumberDecision} disabled={numRunning}>
                      ↺ 수치 재수렴
                    </button>
                  )}
                  {step2Done&&(
                    <button style={{ ...btn("lg"), opacity:running?0.5:1 }} onClick={runFinal} disabled={running}>
                      {running?"분석 중...":"최종 결과 →"}
                    </button>
                  )}
                </div>
              </div>
              {error&&<div style={{ marginTop:10, padding:"8px 12px", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:6, fontSize:11, color:"#dc2626" }}>{error}</div>}
            </div>
          </div>
        </>)}

        {/* ══ STEP 3: 최종 결과 ══ */}
        {step===3&&result&&(<>
          {/* KPI 배너 */}
          <div style={{ ...card(), background:C.navy, border:"none" }}>
            <div style={{ padding:"18px 22px" }}>
              <div style={{ fontSize:11, color:"#93c5fd", fontWeight:700, marginBottom:10 }}>집단지성수렴 + 수치결정 통합 최종 결과 — {co.name||"입력기업"}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))", gap:10 }}>
                {[["도입 결론",agreeVote==="찬성"?"찬성":"보류","#34d399"],["가동시간",`${result.opHours}h`,"#fbbf24"],["고용확대율",`${result.empRate}%`,"#f87171"],["+고용",`${result.added}명`,"#34d399"],["총 인원",`${result.total}명`,"#818cf8"],["근로자배당",result.dividendApproved==="찬성"?`${result.dividendWorker}%`:"미배당","#60a5fa"]].map(([l,v,c],i)=>(
                  <div key={i} style={{ textAlign:"center" }}>
                    <div style={{ fontSize:20, fontWeight:900, color:c, letterSpacing:"-0.5px" }}>{v}</div>
                    <div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4조 인원 배분 */}
          <div style={card()}>
            <div style={cardHead()}>
              <span style={{ fontSize:13, fontWeight:700 }}>4조 인원 배분 (도면 17 공식)</span>
              <span style={{ ...badge(C.violetLight,C.violet), marginLeft:"auto" }}>오전:오후=주중:주말={result.ratioA}:{10-result.ratioA}</span>
            </div>
            <div style={{ padding:20 }}>
              <TeamBar total={result.total} r={result.ratioA}/>
              <div style={{ marginTop:10, padding:"9px 12px", background:C.sl50, borderRadius:6, border:`1px solid ${C.sl200}`, fontSize:11, color:C.sl600 }}>
                시작 {result.startHour}시 / {result.startDay}요일 · 오전조 {result.startHour}:00~{result.startHour+8}:00 · 오후조 {result.startHour+8}:00~{result.startHour+16}:00
              </div>
            </div>
          </div>

          {/* 인사이트 */}
          {insightData&&(
            <div style={card()}>
              <div style={cardHead()}><span style={{ fontSize:13, fontWeight:700 }}>로컬 분석 핵심 인사이트</span></div>
              <div style={{ padding:20 }}>
                {insightData.insights.map((ins,i)=>(
                  <div key={i} style={{ display:"flex", gap:8, padding:"8px 10px", background:"#f0f9ff", borderRadius:6, marginBottom:5 }}>
                    <span style={{ fontSize:11, fontWeight:800, color:C.violet, flexShrink:0 }}>0{i+1}</span>
                    <span style={{ fontSize:11, color:C.sl800, lineHeight:1.5 }}>{ins}</span>
                  </div>
                ))}
                <div style={{ padding:"9px 12px", background:C.amberLight, borderRadius:6, border:`1px solid ${C.amber}50`, fontSize:11, color:C.amberDark, marginTop:6 }}>
                  ⚠ {insightData.warning}
                </div>
              </div>
            </div>
          )}

          {/* 관리자 중간배치 */}
          <div style={card()}>
            <div style={cardHead()}>
              <span style={{ fontSize:13, fontWeight:700 }}>관리자 중간배치 — 인건비 보완</span>
              <span style={{ ...badge(C.violetLight,C.violet), marginLeft:"auto" }}>청구항 7 · 도면 19</span>
            </div>
            <div style={{ padding:20 }}><ManagerPlacement total={result.total}/></div>
          </div>

          {/* 비용 절감 */}
          <div style={card()}>
            <div style={cardHead()}>
              <span style={{ fontSize:13, fontWeight:700 }}>기업비용 절감 자동 산출</span>
              <span style={{ ...badge(C.amberLight,C.amberDark), marginLeft:"auto" }}>청구항 2 · 도면 21</span>
            </div>
            <div style={{ padding:20 }}>
              <CostSaving employees={employees} added={result.added} opHours={result.opHours} currentHours={curH} salary={parseInt(co.salary)||4000}/>
            </div>
          </div>

          {/* 연쇄 효과 */}
          <div style={card()}>
            <div style={cardHead()}><span style={{ fontSize:13, fontWeight:700 }}>연쇄 사회 효과</span></div>
            <div style={{ padding:20 }}><CascadeEffects added={result.added} gap={result.opHours-curH}/></div>
          </div>

          <div style={{ display:"flex", gap:8, justifyContent:"space-between", alignItems:"flex-start", paddingBottom:16 }}>
            <button style={btn("ghost")} onClick={hardReset}>↺ 새 기업 분석</button>
            <div style={{ textAlign:"right" }}>
              <button style={btn("lg")} onClick={downloadReport}>📄 리포트 다운로드 (HTML)</button>
              {printReady&&(
                <div style={{ marginTop:6, padding:"7px 12px", background:C.emeraldLight, borderRadius:6, border:`1px solid ${C.emerald}40`, fontSize:10, color:C.emeraldDark }}>
                  ✅ 파일을 브라우저로 열고 <strong>Ctrl+P → "PDF로 저장"</strong> 선택
                </div>
              )}
              <div style={{ fontSize:10, color:C.sl400, marginTop:6 }}>
                Phase 2: 투자유치 (특허 10-2195052)<br/>Phase 3: 사회효과 (특허 10-2807125)
              </div>
            </div>
          </div>
        </>)}

        {/* 결과 없음 */}
        {step===3&&!result&&(
          <div style={{ textAlign:"center", padding:"60px 20px", color:C.sl400 }}>
            <div style={{ fontSize:14, marginBottom:12 }}>아직 분석 결과가 없습니다</div>
            <button style={btn("lg")} onClick={()=>navigateTo(0)}>처음부터 시작</button>
          </div>
        )}
      </div>
      </div>
    </AppErrorBoundary>
  );
}
