(() => {
  "use strict";

  const STORAGE_KEY = "greeners-carbon-workspace-v2";
  const stepMeta = [
    ["MONITORING DASHBOARD", "온실가스 모니터링", "현재 입력 상태와 다음 작업을 한 화면에서 확인합니다."],
    ["STEP 01 · PROJECT SETUP", "사업장 설정", "산정 대상 사업장과 기간을 먼저 정의해주세요."],
    ["STEP 02 · ELIGIBILITY", "방법론 및 적용조건", "10개 적용조건을 모두 확인해야 다음 단계로 이동할 수 있습니다."],
    ["STEP 03 · PARAMETERS", "산정조건 설정", "생산 공정, 연료와 활동기간별 적용 계수를 설정해주세요."],
    ["STEP 04 · BASELINE", "베이스라인 자료", "사업 전 가열 아스팔트 자료로 베이스라인 배출계수를 계산합니다."],
    ["STEP 05 · PROJECT ACTIVITY", "월별 활동자료", "사업 후 중온 아스팔트 생산자료와 증빙을 월별로 연결합니다."],
    ["STEP 06 · REVIEW", "입력 검토", "누락, 단위 오류와 산정 제외 자료를 계산 전에 확인합니다."],
    ["STEP 07 · RESULTS", "산정 결과", "배출량과 감축량, 계산에 사용된 근거를 한눈에 확인합니다."]
  ];
  const nextLabels = [null, "적용조건 확인", "산정조건 설정", "베이스라인 입력", "월별 자료 입력", "입력 검토", "결과 계산", "처음으로", null];

  stepMeta.push([
    "FACILITY MAP · READY-MIX CONCRETE",
    "국내 레미콘 업체 지도",
    "OpenStreetMap의 공개 데이터를 기준으로 국내 레미콘·콘크리트 생산시설을 찾아봅니다."
  ]);

  const READY_MIX_CACHE_KEY = "greeners-ready-mix-facilities-v1";
  const READY_MIX_CACHE_TTL = 24 * 60 * 60 * 1000;
  const READY_MIX_REQUEST_TIMEOUT = 30000;
  const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
  const READY_MIX_FALLBACK = [
    { id: "example-seoul", name: "예시 레미콘 시설 (서울)", region: "서울특별시", address: "서울특별시 (예시 위치)", lat: 37.5665, lng: 126.9780, isExample: true },
    { id: "example-busan", name: "예시 레미콘 시설 (부산)", region: "부산광역시", address: "부산광역시 (예시 위치)", lat: 35.1796, lng: 129.0756, isExample: true },
    { id: "example-daegu", name: "예시 레미콘 시설 (대구)", region: "대구광역시", address: "대구광역시 (예시 위치)", lat: 35.8714, lng: 128.6014, isExample: true },
    { id: "example-gwangju", name: "예시 레미콘 시설 (광주)", region: "광주광역시", address: "광주광역시 (예시 위치)", lat: 35.1595, lng: 126.8526, isExample: true },
    { id: "example-daejeon", name: "예시 레미콘 시설 (대전)", region: "대전광역시", address: "대전광역시 (예시 위치)", lat: 36.3504, lng: 127.3845, isExample: true }
  ];

  const conditions = [
    { id: "EL-01", title: "중온 바인더 방식", text: "중온 첨가제를 미리 주입한 사전 혼합 방식입니다.", evidence: "바인더 제품 규격서·납품서" },
    { id: "EL-02", title: "설비 동일성", text: "사업 전후 에너지 사용 설비와 생산조건이 동일합니다.", evidence: "설비 목록·공정도" },
    { id: "EL-03", title: "연료 동일성", text: "사업 전후 생산 공정의 화석연료 종류가 동일합니다.", evidence: "연료 구매자료·계측일지" },
    { id: "EL-04", title: "품질 동등성", text: "기존 가열 아스팔트와 같은 등급이며 요구 품질기준을 충족합니다.", evidence: "제품검사성적서" },
    { id: "EL-05", title: "배출계수", text: "연료에 승인 가능한 국가·IPCC·사업장 고유 배출계수가 존재합니다.", evidence: "계수 출처 문서" },
    { id: "EL-06", title: "감축 범위", text: "중온 아스팔트 혼합물 생산 이외의 감축효과를 포함하지 않습니다.", evidence: "사업경계 설명" },
    { id: "EL-07", title: "동시 투입 금지", text: "중온 바인더와 일반 바인더를 동시에 투입하지 않습니다.", evidence: "배합설계서·생산일지" },
    { id: "EL-08", title: "생산 구분", text: "동일 시설 사용 시 Batch 단위로 가열·중온 생산과 활동자료를 구분합니다.", evidence: "Batch 생산기록" },
    { id: "EL-09", title: "외부 열공급 제외", text: "사업경계 외부의 열 또는 스팀으로 연료를 대체하는 사업이 아닙니다.", evidence: "에너지 흐름도" },
    { id: "EL-10", title: "기존 시설", text: "신규 사업 또는 생산용량 증대 사업이 아닙니다.", evidence: "시설 운영이력" }
  ];

  const evidenceTypes = {
    baseline: [
      ["production", "생산량 증빙", "계근대 자료 또는 생산일지"],
      ["fuel", "연료 계측·구매 증빙", "유량계 사진, 구매영수증 또는 전자세금계산서"],
      ["electricity", "전력 계측·고지서", "전력계 자료 또는 전력 고지서"]
    ],
    activity: [
      ["fuel", "연료 사용량 증빙", "유량계 사진과 구매량 교차확인 자료"],
      ["electricity", "전력 사용량 증빙", "계측값 또는 전력 고지서"],
      ["production", "생산량 증빙", "계근대 계측값 또는 생산일지"],
      ["temperature", "생산온도 증빙", "온도계 측정자료 또는 중간검사성적서"],
      ["quality", "품질 증빙", "제품검사성적서 (인정 필수)"]
    ]
  };

  const makeDefaultState = () => ({
    currentStep: 0,
    site: { name: "", address: "", startDate: "", endDate: "", batch: "", cutoffTime: "", boundary: "" },
    eligibility: Object.fromEntries(conditions.map(item => [item.id, null])),
    config: {
      processName: "", fuelType: "", fuelUnit: "",
      ncv: { value: null, unit: "MJ/L", source: "", from: "", to: "" },
      fuelEf: { value: null, unit: "kgCO2-eq/TJ", source: "", from: "", to: "" },
      gridFactors: [{ id: uid(), value: null, unit: "tCO2-eq/MWh", source: "", from: "", to: "" }],
      leakageMethod: "factor",
      additive: { production: null, fuel: null, electricity: null, ncv: null, fuelEf: null, mixRate: null }
    },
    baseline: [], baselineReason: "", activities: []
  });

  let state = restoreState();
  let modalContext = null;
  let pendingEvidence = {};
  let toastTimer = null;
  let saveTimer = null;
  let readyMixMap = null;
  let readyMixLayer = null;
  let readyMixFacilities = [];
  let readyMixFiltered = [];
  let readyMixSelectedId = null;
  let readyMixLoadPromise = null;
  let readyMixMarkers = new Map();

  const els = {
    panels: [...document.querySelectorAll("[data-step-panel]")],
    links: [...document.querySelectorAll("[data-step-target]")],
    kicker: document.getElementById("step-kicker"),
    title: document.getElementById("step-title"),
    description: document.getElementById("step-description"),
    prev: document.getElementById("prev-step"),
    next: document.getElementById("next-step"),
    footerLabel: document.getElementById("footer-step-label"),
    progress: document.getElementById("footer-progress-bar"),
    footer: document.querySelector(".wizard-footer"),
    error: document.getElementById("page-error"),
    errorMessage: document.getElementById("page-error-message"),
    saveState: document.getElementById("save-state"),
    modal: document.getElementById("evidence-modal"),
    evidenceList: document.getElementById("evidence-list")
  };

  init();

  function init() {
    bindStaticFields();
    bindActions();
    bindReadyMixControls();
    renderAll();
  }

  function uid() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  function restoreState() {
    const fallback = makeDefaultState();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== "object") return fallback;
      return {
        ...fallback,
        ...saved,
        site: { ...fallback.site, ...(saved.site || {}) },
        eligibility: { ...fallback.eligibility, ...(saved.eligibility || {}) },
        config: {
          ...fallback.config,
          ...(saved.config || {}),
          ncv: { ...fallback.config.ncv, ...(saved.config?.ncv || {}) },
          fuelEf: { ...fallback.config.fuelEf, ...(saved.config?.fuelEf || {}) },
          additive: { ...fallback.config.additive, ...(saved.config?.additive || {}) },
          gridFactors: Array.isArray(saved.config?.gridFactors) ? saved.config.gridFactors : fallback.config.gridFactors
        },
        baseline: Array.isArray(saved.baseline) ? saved.baseline : [],
        activities: Array.isArray(saved.activities) ? saved.activities : []
      };
    } catch (_) {
      return fallback;
    }
  }

  function bindStaticFields() {
    document.querySelectorAll("[data-bind], [data-bind-number]").forEach(input => {
      const path = input.dataset.bind || input.dataset.bindNumber;
      const value = getByPath(state, path);
      input.value = value ?? "";
      const handler = () => {
        const next = input.dataset.bindNumber !== undefined ? numberOrNull(input.value) : input.value;
        setByPath(state, path, next);
        clearError();
        scheduleSave();
      };
      input.addEventListener("input", handler);
      input.addEventListener("change", () => {
        handler();
        renderDependentViews();
      });
    });
  }

  function bindActions() {
    els.links.forEach(button => button.addEventListener("click", () => requestStep(Number(button.dataset.stepTarget))));
    document.querySelectorAll("[data-go-step]").forEach(button => button.addEventListener("click", () => goToStep(Number(button.dataset.goStep))));
    els.prev.addEventListener("click", () => goToStep(Math.max(1, state.currentStep - 1)));
    els.next.addEventListener("click", handleNext);
    document.getElementById("load-sample").addEventListener("click", loadSampleData);
    document.getElementById("add-grid-factor").addEventListener("click", addGridFactor);
    document.getElementById("add-baseline").addEventListener("click", addBaselineRow);
    document.getElementById("add-activity").addEventListener("click", addActivityRow);
    document.getElementById("dashboard-action").addEventListener("click", event => goToStep(Number(event.currentTarget.dataset.target || 1)));
    document.getElementById("dashboard-recent-action").addEventListener("click", () => requestStep(5));

    document.getElementById("condition-list").addEventListener("click", event => {
      const button = event.target.closest("[data-condition-value]");
      if (!button) return;
      state.eligibility[button.dataset.conditionId] = button.dataset.conditionValue === "yes";
      clearError();
      scheduleSave();
      renderConditions();
      updateNavigationState();
    });

    document.querySelectorAll('input[name="leakage-method"]').forEach(radio => radio.addEventListener("change", () => {
      state.config.leakageMethod = radio.value;
      document.getElementById("additive-fields").hidden = radio.value !== "actual";
      scheduleSave();
      renderDependentViews();
    }));

    bindCollectionTable("grid-factor-body", "gridFactors");
    bindCollectionTable("baseline-body", "baseline");
    bindCollectionTable("activity-body", "activities");

    document.addEventListener("click", event => {
      const remove = event.target.closest("[data-remove-row]");
      if (remove) removeRow(remove.dataset.collection, remove.dataset.removeRow);
      const evidence = event.target.closest("[data-evidence-row]");
      if (evidence) openEvidenceModal(evidence.dataset.evidenceType, evidence.dataset.evidenceRow);
    });

    document.getElementById("close-modal").addEventListener("click", closeEvidenceModal);
    document.getElementById("cancel-modal").addEventListener("click", closeEvidenceModal);
    document.getElementById("save-evidence").addEventListener("click", saveEvidence);
    els.modal.addEventListener("click", event => { if (event.target === els.modal) closeEvidenceModal(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !els.modal.hidden) closeEvidenceModal(); });
  }

  function bindCollectionTable(id, collection) {
    const body = document.getElementById(id);
    body.addEventListener("input", event => {
      const input = event.target.closest("[data-row-field]");
      if (!input) return;
      const row = getCollection(collection).find(item => item.id === input.dataset.rowId);
      if (!row) return;
      row[input.dataset.rowField] = input.dataset.valueType === "number" ? numberOrNull(input.value) : input.value;
      clearError();
      scheduleSave();
      if (collection === "baseline") renderBaselineMetrics();
    });
    body.addEventListener("change", event => {
      if (!event.target.closest("[data-row-field]")) return;
      renderDependentViews();
    });
  }

  function getCollection(name) {
    if (name === "gridFactors") return state.config.gridFactors;
    return state[name];
  }

  function renderAll() {
    syncStaticBindings();
    renderDashboard();
    renderConditions();
    renderGridFactors();
    renderBaseline();
    renderActivities();
    renderReview();
    renderResults();
    updateStepView();
  }

  function syncStaticBindings() {
    document.querySelectorAll("[data-bind], [data-bind-number]").forEach(input => {
      const path = input.dataset.bind || input.dataset.bindNumber;
      input.value = getByPath(state, path) ?? "";
    });
    document.querySelectorAll('input[name="leakage-method"]').forEach(radio => radio.checked = radio.value === state.config.leakageMethod);
    document.getElementById("additive-fields").hidden = state.config.leakageMethod !== "actual";
    document.getElementById("context-site").textContent = state.site.name || "사업장 미설정";
    document.getElementById("context-year").textContent = getCalculationPeriodLabel();
  }

  function renderDependentViews() {
    renderDashboard();
    renderConditions();
    renderBaselineMetrics();
    renderActivities();
    renderReview();
    renderResults();
    updateNavigationState();
  }

  function renderConditions() {
    const yesCount = conditions.filter(item => state.eligibility[item.id] === true).length;
    document.getElementById("eligibility-summary").innerHTML = `
      <div><strong>${yesCount === 10 ? "모든 적용조건을 충족했습니다" : `${10 - yesCount}개 조건을 더 확인해주세요`}</strong>
      <p>${yesCount === 10 ? "산정조건 설정 단계로 이동할 수 있습니다." : "하나라도 ‘아니요’이면 방법론 적용 가능 여부 확인 전까지 계산할 수 없습니다."}</p></div>
      <div class="progress-ring" style="--progress:${yesCount * 10}%"><span>${yesCount}/10</span></div>`;
    document.getElementById("condition-list").innerHTML = conditions.map(item => {
      const value = state.eligibility[item.id];
      return `<article class="condition-row ${value === true ? "is-yes" : value === false ? "is-no" : ""}">
        <span class="condition-code">${item.id}</span>
        <div class="condition-text"><strong>${item.title}</strong><p>${item.text}</p></div>
        <span class="evidence-tag">${item.evidence}</span>
        <div class="toggle-group" aria-label="${item.title} 충족 여부">
          <button type="button" class="${value === true ? "is-active yes" : ""}" data-condition-id="${item.id}" data-condition-value="yes">예</button>
          <button type="button" class="${value === false ? "is-active no" : ""}" data-condition-id="${item.id}" data-condition-value="no">아니요</button>
        </div>
      </article>`;
    }).join("");
  }

  function renderDashboard() {
    const reviews = state.activities.map(row => ({ row, review: getActivityReview(row) }));
    const completeCount = reviews.filter(item => item.review.level === "success").length;
    const warningCount = reviews.filter(item => item.review.level === "warning").length;
    const excludedCount = reviews.filter(item => item.review.level === "danger").length;
    const calculation = calculateAll();
    const reduction = calculation.ok ? `${formatNumber(calculation.er, 3)}<small>tCO2-eq/년</small>` : `—<small>계산 전</small>`;
    const metrics = [
      ["success", "입력 완료", "✓", `${completeCount}<small>개월</small>`, "필수 입력과 증빙이 준비됨"],
      ["warning", "확인 필요", "!", `${warningCount}<small>개월</small>`, "입력 또는 증빙 확인 필요"],
      ["danger", "산정 제외", "×", `${excludedCount}<small>개월</small>`, "온도·품질조건으로 제외"],
      ["", "예상 감축량", "ER", reduction, calculation.ok ? "현재 입력값 기준" : "필수 입력 완료 후 계산"]
    ];
    document.getElementById("dashboard-status-grid").innerHTML = metrics.map(item => `<article class="dashboard-metric ${item[0]}"><div class="dashboard-metric-head"><span>${item[1]}</span><span class="dashboard-metric-icon">${item[2]}</span></div><strong>${item[3]}</strong><small>${item[4]}</small></article>`).join("");

    const nextTask = getDashboardNextTask(reviews, calculation);
    document.getElementById("next-task-title").textContent = nextTask.title;
    document.getElementById("next-task-description").textContent = nextTask.description;
    document.getElementById("next-task-icon").textContent = nextTask.icon;
    const action = document.getElementById("dashboard-action");
    action.dataset.target = nextTask.target;
    action.innerHTML = `${escapeHtml(nextTask.action)} <span>→</span>`;

    const recent = [...reviews].sort((a, b) => String(b.row.period).localeCompare(String(a.row.period))).slice(0, 3);
    document.getElementById("dashboard-recent-body").innerHTML = recent.map(({ row, review }) => `<tr>
      <td data-label="대상 월">${escapeHtml(formatPeriod(row.period))}</td>
      <td data-label="생산량">${displayNumber(row.production)} t</td>
      <td data-label="연료 사용량">${displayNumber(row.fuel)} ${escapeHtml(state.config.fuelUnit || "원단위")}</td>
      <td data-label="전력 사용량">${displayNumber(row.electricity)} kWh</td>
      <td data-label="상태"><span class="status-badge ${review.level}">${review.level === "success" ? "✓ " : review.level === "warning" ? "! " : "× "}${review.label}</span></td>
    </tr>`).join("");
    const hasRecent = recent.length > 0;
    document.getElementById("dashboard-recent-wrap").hidden = !hasRecent;
    document.getElementById("dashboard-recent-empty").hidden = hasRecent;
    document.getElementById("dashboard-recent-action").disabled = !hasRecent;
    document.getElementById("context-site").textContent = state.site.name || "사업장 미설정";
    document.getElementById("context-year").textContent = getCalculationPeriodLabel();
  }

  function getDashboardNextTask(reviews, calculation) {
    const stepTasks = [
      null,
      { target: 1, icon: "1", title: "사업장 기본정보를 입력해주세요.", description: "사업장과 산정기간을 설정하면 방법론 확인을 시작할 수 있습니다.", action: "사업장 설정 시작하기" },
      { target: 2, icon: "2", title: "방법론 적용조건을 확인해주세요.", description: "EL-01부터 EL-10까지 모든 필수 조건의 충족 여부를 확인합니다.", action: "적용조건 확인하기" },
      { target: 3, icon: "3", title: "연료와 적용 계수를 설정해주세요.", description: "활동자료 발생일에 유효한 순발열량과 배출계수가 필요합니다.", action: "산정조건 설정하기" },
      { target: 4, icon: "4", title: "베이스라인 자료를 입력해주세요.", description: "사업 전 생산량, 연료와 전력 자료를 입력해 베이스라인을 계산합니다.", action: "베이스라인 입력하기" },
      { target: 5, icon: "5", title: "월별 활동자료를 입력해주세요.", description: "중온 아스팔트 생산량, 에너지, 온도, 품질과 증빙을 월별로 입력합니다.", action: "월별 자료 입력하기" }
    ];
    for (let step = 1; step <= 5; step += 1) if (!validateStep(step, true).ok) return stepTasks[step];
    const attention = reviews.find(item => item.review.level === "danger") || reviews.find(item => item.review.level === "warning");
    if (attention) return {
      target: 5,
      icon: attention.review.level === "danger" ? "×" : "!",
      title: `${formatPeriod(attention.row.period)} 자료를 확인해주세요.`,
      description: attention.review.reasons.join(" · "),
      action: `${formatPeriod(attention.row.period)} 활동자료 확인하기`
    };
    if (calculation.ok) return { target: 7, icon: "✓", title: "산정 결과를 확인할 수 있습니다.", description: "현재 입력값과 적용 계수로 온실가스 감축량 계산이 완료되었습니다.", action: "산정 결과 확인하기" };
    return { target: 6, icon: "6", title: "입력자료를 검토해주세요.", description: "계산 전에 누락된 값과 증빙, 산정 제외 사유를 확인합니다.", action: "입력 검토하기" };
  }

  function renderGridFactors() {
    const body = document.getElementById("grid-factor-body");
    body.innerHTML = state.config.gridFactors.map(row => `<tr>
      <td><input aria-label="전력 배출계수" type="number" min="0" step="any" value="${valueAttr(row.value)}" data-row-id="${row.id}" data-row-field="value" data-value-type="number" placeholder="0.00000"></td>
      <td><select aria-label="전력 배출계수 단위" data-row-id="${row.id}" data-row-field="unit"><option value="tCO2-eq/MWh" ${selected(row.unit, "tCO2-eq/MWh")}>tCO2-eq/MWh</option><option value="kgCO2-eq/kWh" ${selected(row.unit, "kgCO2-eq/kWh")}>kgCO2-eq/kWh</option></select></td>
      <td><input aria-label="전력 배출계수 출처" type="text" value="${escapeAttr(row.source)}" data-row-id="${row.id}" data-row-field="source" placeholder="출처 입력"></td>
      <td><input aria-label="전력 계수 적용 시작일" type="date" value="${escapeAttr(row.from)}" data-row-id="${row.id}" data-row-field="from"></td>
      <td><input aria-label="전력 계수 적용 종료일" type="date" value="${escapeAttr(row.to)}" data-row-id="${row.id}" data-row-field="to"></td>
      <td><button class="delete-row" type="button" aria-label="계수 삭제" data-collection="gridFactors" data-remove-row="${row.id}">×</button></td>
    </tr>`).join("");
  }

  function renderBaseline() {
    const body = document.getElementById("baseline-body");
    body.innerHTML = state.baseline.map(row => {
      const evidence = evidenceCount(row, "baseline");
      return `<tr>
        <td><input aria-label="자료 연도 또는 연월" type="text" inputmode="numeric" value="${valueAttr(row.period)}" data-row-id="${row.id}" data-row-field="period" placeholder="YYYY 또는 YYYY-MM"></td>
        <td><input aria-label="가열 아스팔트 생산량" type="number" min="0" step="any" value="${valueAttr(row.production)}" data-row-id="${row.id}" data-row-field="production" data-value-type="number"></td>
        <td><input aria-label="베이스라인 연료 종류" type="text" value="${escapeAttr(row.fuelType)}" data-row-id="${row.id}" data-row-field="fuelType" placeholder="${escapeAttr(state.config.fuelType || "연료")}"></td>
        <td><input aria-label="베이스라인 연료 사용량" type="number" min="0" step="any" value="${valueAttr(row.fuel)}" data-row-id="${row.id}" data-row-field="fuel" data-value-type="number"></td>
        <td><input aria-label="베이스라인 전력 사용량" type="number" min="0" step="any" value="${valueAttr(row.electricity)}" data-row-id="${row.id}" data-row-field="electricity" data-value-type="number"></td>
        <td><button class="evidence-button ${evidence.complete ? "is-complete" : ""}" type="button" data-evidence-type="baseline" data-evidence-row="${row.id}">증빙 ${evidence.count}/${evidence.total}</button></td>
        <td><button class="delete-row" type="button" aria-label="베이스라인 행 삭제" data-collection="baseline" data-remove-row="${row.id}">×</button></td>
      </tr>`;
    }).join("");
    document.getElementById("baseline-empty").hidden = state.baseline.length > 0;
    body.closest(".table-wrap").hidden = state.baseline.length === 0;
    const coverage = getBaselineCoverage();
    document.getElementById("baseline-reason-wrap").hidden = !(coverage.completeYears > 0 && coverage.completeYears < 3);
    renderBaselineMetrics();
  }

  function renderBaselineMetrics() {
    const rows = state.baseline.filter(row => positiveOrZero(row.production) && positiveOrZero(row.fuel) && positiveOrZero(row.electricity));
    const count = rows.length;
    const avg = key => count ? sum(rows.map(row => Number(row[key]) || 0)) / count : 0;
    const baselineCalc = calculateBaseline(false);
    document.getElementById("baseline-metrics").innerHTML = [
      ["입력기간", state.baseline.length ? `${getBaselineCoverage().completeYears}개년` : "—", getBaselineCoverage().completeYears >= 3 ? "기본기간 충족" : "최소 1년 필요"],
      ["연평균 생산량", baselineCalc.ok ? formatNumber(baselineCalc.avgProduction, 1) : count ? formatNumber(avg("production"), 1) : "—", "t-아스콘/년"],
      ["연평균 연료 사용량", baselineCalc.ok ? formatNumber(baselineCalc.avgFuel, 1) : count ? formatNumber(avg("fuel"), 1) : "—", `${state.config.fuelUnit || "원단위"}/년`],
      ["베이스라인 배출계수", baselineCalc.ok ? formatNumber(baselineCalc.ef, 5) : "—", "tCO2-eq/t-아스콘"]
    ].map(item => `<div class="metric-mini"><span>${item[0]}</span><strong>${item[1]}</strong><small>${item[2]}</small></div>`).join("");
  }

  function renderActivities() {
    const body = document.getElementById("activity-body");
    body.innerHTML = state.activities.map(row => {
      const review = getActivityReview(row);
      const evidence = evidenceCount(row, "activity");
      return `<tr class="${review.level === "danger" ? "row-excluded" : review.level === "warning" ? "row-warning" : ""}">
        <td><input aria-label="대상 연월" type="month" value="${escapeAttr(row.period)}" data-row-id="${row.id}" data-row-field="period"></td>
        <td><input aria-label="중온 아스팔트 생산량" type="number" min="0" step="any" value="${valueAttr(row.production)}" data-row-id="${row.id}" data-row-field="production" data-value-type="number"></td>
        <td><input aria-label="사업 후 연료 종류" type="text" value="${escapeAttr(row.fuelType)}" data-row-id="${row.id}" data-row-field="fuelType" placeholder="${escapeAttr(state.config.fuelType || "연료")}"></td>
        <td><input aria-label="사업 후 연료 사용량" type="number" min="0" step="any" value="${valueAttr(row.fuel)}" data-row-id="${row.id}" data-row-field="fuel" data-value-type="number"></td>
        <td><input aria-label="사업 후 전력 사용량" type="number" min="0" step="any" value="${valueAttr(row.electricity)}" data-row-id="${row.id}" data-row-field="electricity" data-value-type="number"></td>
        <td><input aria-label="생산온도 최솟값" type="number" min="0" step="any" value="${valueAttr(row.tempMin)}" data-row-id="${row.id}" data-row-field="tempMin" data-value-type="number"></td>
        <td><input aria-label="생산온도 최댓값" type="number" min="0" step="any" value="${valueAttr(row.tempMax)}" data-row-id="${row.id}" data-row-field="tempMax" data-value-type="number"></td>
        <td><select aria-label="품질 등급" data-row-id="${row.id}" data-row-field="grade"><option value="">선택</option><option value="W64" ${selected(row.grade, "W64")}>W64</option><option value="W70" ${selected(row.grade, "W70")}>W70</option><option value="W76" ${selected(row.grade, "W76")}>W76</option></select></td>
        <td><select aria-label="품질 적합 여부" data-row-id="${row.id}" data-row-field="quality"><option value="">선택</option><option value="yes" ${selected(row.quality, "yes")}>적합</option><option value="no" ${selected(row.quality, "no")}>부적합</option></select></td>
        <td><button class="evidence-button ${evidence.complete ? "is-complete" : ""}" type="button" data-evidence-type="activity" data-evidence-row="${row.id}">증빙 ${evidence.count}/${evidence.total}</button></td>
        <td><button class="delete-row" type="button" aria-label="월별 활동자료 삭제" data-collection="activities" data-remove-row="${row.id}">×</button></td>
      </tr>`;
    }).join("");
    document.getElementById("activity-empty").hidden = state.activities.length > 0;
    body.closest(".table-wrap").hidden = state.activities.length === 0;
  }

  function renderReview() {
    const reviews = state.activities.map(row => ({ row, review: getActivityReview(row) }));
    const success = reviews.filter(item => item.review.level === "success").length;
    const warning = reviews.filter(item => item.review.level === "warning").length;
    const danger = reviews.filter(item => item.review.level === "danger").length;
    document.getElementById("review-summary").innerHTML = [
      ["success", "계산 가능", success, "필수값·증빙 충족"],
      ["warning", "확인 필요", warning, "일부 교차증빙 부족"],
      ["danger", "산정 제외", danger, "온도·품질·필수값 오류"]
    ].map(item => `<div class="review-stat ${item[0]}"><span>${item[1]}</span><strong>${item[2]}<small>개월</small></strong><small>${item[3]}</small></div>`).join("");

    document.getElementById("review-body").innerHTML = reviews.length ? reviews.map(({ row, review }) => {
      const evidence = evidenceCount(row, "activity");
      const quality = row.quality === "yes" ? "적합" : row.quality === "no" ? "부적합" : "미입력";
      return `<tr><td>${escapeHtml(formatPeriod(row.period))}</td><td>${displayNumber(row.production)} t</td><td>${displayNumber(row.tempMin)}~${displayNumber(row.tempMax)}℃</td><td>${quality} · ${escapeHtml(row.grade || "—")}</td><td>${evidence.count}/${evidence.total}건</td><td><span class="status-badge ${review.level}">${review.label}</span></td><td class="reason-cell">${escapeHtml(review.reasons.join(" · ") || "검증 완료")}</td></tr>`;
    }).join("") : `<tr><td colspan="7" class="exclusion-empty">검토할 월별 활동자료가 없습니다.</td></tr>`;

    const blockers = calculationBlockers();
    const gate = document.getElementById("validation-gate");
    gate.className = `validation-gate ${blockers.length ? "is-blocked" : "is-ready"}`;
    gate.innerHTML = blockers.length
      ? `<span class="gate-icon">!</span><div><strong>계산을 시작할 수 없습니다</strong><p>${escapeHtml(blockers[0])}${blockers.length > 1 ? ` 외 ${blockers.length - 1}건` : ""}</p></div>`
      : `<span class="gate-icon">✓</span><div><strong>계산 준비가 완료되었습니다</strong><p>산정 제외 자료를 제외하고 방법론 산식을 적용할 수 있습니다.</p></div>`;
  }

  function renderResults() {
    const calculation = calculateAll();
    const resultContent = document.getElementById("result-content");
    const resultYear = state.site.endDate ? state.site.endDate.slice(0, 4) : state.activities[0]?.period?.slice(0, 4) || "—";
    document.getElementById("result-year").textContent = resultYear;
    if (!calculation.ok) {
      document.getElementById("result-status").innerHTML = `<span></span>계산 불가`;
      document.getElementById("result-subtitle").textContent = "필수 입력과 적용조건을 보완한 뒤 다시 계산해주세요.";
      resultContent.innerHTML = `<div class="panel-card form-card"><div class="validation-gate is-blocked"><span class="gate-icon">!</span><div><strong>아직 결과를 계산할 수 없습니다</strong><p>${escapeHtml(calculation.errors[0] || "필수 입력을 확인해주세요.")}</p></div></div></div>`;
      return;
    }

    const status = calculation.excluded.length ? "산정 제외 포함" : calculation.warnings.length ? "확인 필요" : "계산 완료";
    document.getElementById("result-status").innerHTML = `<span></span>${status}`;
    document.getElementById("result-subtitle").textContent = `${calculation.included.length}개월 활동자료와 ${calculation.baseline.years}개년 베이스라인을 기준으로 계산했습니다.`;
    const ncvNorm = normalizeNcv(state.config.ncv.value, state.config.ncv.unit);
    const fuelEfNorm = normalizeFuelEf(state.config.fuelEf.value, state.config.fuelEf.unit);
    const representativeGrid = calculation.included[0]?.gridFactor || state.config.gridFactors[0];

    resultContent.innerHTML = `
      <div class="result-hero">
        <div class="reduction-value"><span>온실가스 감축량 · ER<sub>y</sub></span><strong>${formatNumber(calculation.er, 3)}<small>tCO2-eq/년</small></strong><p>인정 생산량 ${formatNumber(calculation.eligibleProduction, 1)} t-아스콘 기준</p></div>
        <div class="result-equation"><span>CALCULATION EQUATION</span><div class="equation">ER<sub>y</sub> = BE<sub>y</sub> − PE<sub>y</sub> − LE<sub>y</sub></div><div class="equation-values">${formatNumber(calculation.be, 3)} − ${formatNumber(calculation.pe, 3)} − ${formatNumber(calculation.le, 3)} = ${formatNumber(calculation.er, 3)} tCO2-eq</div></div>
      </div>
      <div class="result-cards">
        <div class="result-card"><span>인정 생산량 · PA<sub>eligible</sub></span><strong>${formatNumber(calculation.eligibleProduction, 1)}</strong><small>t-아스콘/년${calculation.excess > 0 ? ` · 초과 ${formatNumber(calculation.excess, 1)} t 제외` : ""}</small></div>
        <div class="result-card"><span>베이스라인 배출량 · BE</span><strong>${formatNumber(calculation.be, 3)}</strong><small>tCO2-eq/년</small></div>
        <div class="result-card"><span>사업 배출량 · PE</span><strong>${formatNumber(calculation.pe, 3)}</strong><small>tCO2-eq/년</small></div>
        <div class="result-card highlight"><span>누출량 · LE</span><strong>${formatNumber(calculation.le, 3)}</strong><small>tCO2-eq/년 · ${state.config.leakageMethod === "factor" ? "PE의 2%" : "실제 누출량"}</small></div>
      </div>
      <div class="result-grid">
        <div class="calculation-card">
          <h3>계산 상세</h3>
          <div class="formula-row"><span class="formula-code">EF<sub>BL</sub></span><div><strong>베이스라인 온실가스 배출계수</strong><p>(연평균 연료배출량 + 연평균 전력배출량) ÷ 연평균 생산량</p></div><span class="formula-result">${formatNumber(calculation.baseline.ef, 6)} tCO2-eq/t</span></div>
          <div class="formula-row"><span class="formula-code">EF<sub>PJ</sub></span><div><strong>사업 후 온실가스 배출계수</strong><p>(월별 연료배출량 + 월별 전력배출량) 합계 ÷ 인정 전 사업 생산량</p></div><span class="formula-result">${formatNumber(calculation.projectEf, 6)} tCO2-eq/t</span></div>
          <div class="formula-row"><span class="formula-code">BE<sub>y</sub></span><div><strong>베이스라인 배출량</strong><p>EF<sub>BL</sub> × PA<sub>eligible,y</sub></p></div><span class="formula-result">${formatNumber(calculation.be, 3)} tCO2-eq</span></div>
          <div class="formula-row"><span class="formula-code">PE<sub>y</sub></span><div><strong>사업 배출량</strong><p>EF<sub>PJ,y</sub> × PA<sub>eligible,y</sub></p></div><span class="formula-result">${formatNumber(calculation.pe, 3)} tCO2-eq</span></div>
          <div class="formula-row"><span class="formula-code">LE<sub>y</sub></span><div><strong>누출량</strong><p>${state.config.leakageMethod === "factor" ? "0.02 × PE_y" : "EF_AD × MR_AD × PA_eligible,y"}</p></div><span class="formula-result">${formatNumber(calculation.le, 3)} tCO2-eq</span></div>
        </div>
        <div class="calculation-card">
          <h3>적용 계수와 출처</h3>
          <div class="source-list">
            <div class="source-row"><span>순발열량 · NCV</span><strong>${formatNumber(state.config.ncv.value, 4)} ${escapeHtml(state.config.ncv.unit)}</strong><small>표준환산 ${formatNumber(ncvNorm, 6)} GJ/${escapeHtml(state.config.fuelUnit || "연료단위")} · ${escapeHtml(state.config.ncv.source)}<br>${dateRangeText(state.config.ncv)}</small></div>
            <div class="source-row"><span>연료 배출계수 · EF<sub>FF</sub></span><strong>${formatNumber(state.config.fuelEf.value, 4)} ${escapeHtml(state.config.fuelEf.unit)}</strong><small>표준환산 ${formatNumber(fuelEfNorm, 7)} tCO2-eq/GJ · ${escapeHtml(state.config.fuelEf.source)}<br>${dateRangeText(state.config.fuelEf)}</small></div>
            <div class="source-row"><span>전력 배출계수 · EF<sub>grid</sub></span><strong>${representativeGrid ? `${formatNumber(representativeGrid.value, 5)} ${escapeHtml(representativeGrid.unit)}` : "—"}</strong><small>${representativeGrid ? `${escapeHtml(representativeGrid.source)}<br>${dateRangeText(representativeGrid)}` : "적용 계수 없음"}</small></div>
          </div>
        </div>
      </div>
      <div class="calculation-card exclusion-card">
        <h3>제외자료 및 확인 필요</h3>
        ${renderExclusions(calculation)}
      </div>`;
  }

  function renderExclusions(calculation) {
    const rows = [
      ...calculation.excluded.map(item => ({ ...item, kind: "산정 제외", level: "danger" })),
      ...calculation.warnings.map(item => ({ ...item, kind: "확인 필요", level: "warning" }))
    ];
    if (!rows.length && calculation.excess <= 0) return `<div class="exclusion-empty">제외되거나 확인이 필요한 자료가 없습니다.</div>`;
    let html = `<div class="table-wrap"><table class="data-table"><thead><tr><th>대상</th><th>구분</th><th>생산량</th><th>사유</th><th>필요 조치</th></tr></thead><tbody>`;
    html += rows.map(item => `<tr><td>${escapeHtml(formatPeriod(item.row.period))}</td><td><span class="status-badge ${item.level}">${item.kind}</span></td><td>${displayNumber(item.row.production)} t</td><td>${escapeHtml(item.review.reasons.join(" · "))}</td><td>${item.level === "danger" ? "입력값 또는 필수 품질증빙 수정" : "교차확인 증빙 연결"}</td></tr>`).join("");
    if (calculation.excess > 0) html += `<tr><td>연간 합계</td><td><span class="status-badge warning">상한 적용</span></td><td>${formatNumber(calculation.excess, 1)} t</td><td>사업 후 생산량이 베이스라인 연평균 생산량을 초과했습니다.</td><td>초과 생산량은 BE·PE 산정에서 제외됨</td></tr>`;
    return `${html}</tbody></table></div>`;
  }

  function updateStepView() {
    const requestedStep = Number(state.currentStep);
    const step = Math.min(8, Math.max(0, Number.isFinite(requestedStep) ? requestedStep : 0));
    state.currentStep = step;
    els.panels.forEach(panel => panel.hidden = Number(panel.dataset.stepPanel) !== step);
    const meta = stepMeta[step];
    els.kicker.textContent = meta[0];
    els.title.textContent = meta[1];
    els.description.textContent = meta[2];
    els.footer.hidden = step === 0 || step === 8;
    els.prev.hidden = step <= 1;
    if (step > 0 && step < 8) {
      els.next.innerHTML = `${nextLabels[step]}${step < 7 ? " <span>→</span>" : ""}`;
      els.footerLabel.textContent = `${step} / 7`;
      els.progress.style.width = `${(step / 7) * 100}%`;
    }
    updateNavigationState();
    clearError();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (step === 8) window.setTimeout(activateReadyMixMap, 80);
  }

  function updateNavigationState() {
    els.links.forEach(link => {
      const step = Number(link.dataset.stepTarget);
      if (step === state.currentStep) link.setAttribute("aria-current", "step"); else link.removeAttribute("aria-current");
      link.classList.toggle("is-complete", step > 0 && step < state.currentStep && validateStep(step, true).ok);
    });
  }

  function requestStep(target) {
    if (target === 8) return goToStep(8);
    if (target <= state.currentStep) return goToStep(target);
    for (let step = 1; step < target; step += 1) {
      const validation = validateStep(step, true);
      if (!validation.ok) {
        showError(validation.message);
        showToast(`${stepMeta[step][1]} 단계를 먼저 완료해주세요.`);
        return;
      }
    }
    goToStep(target);
  }

  function goToStep(step) {
    state.currentStep = Math.min(8, Math.max(0, step));
    scheduleSave();
    renderReview();
    renderResults();
    updateStepView();
  }

  function handleNext() {
    if (state.currentStep === 7) return goToStep(1);
    const validation = validateStep(state.currentStep, false);
    if (!validation.ok) return showError(validation.message);
    if (state.currentStep === 6) {
      const result = calculateAll();
      if (!result.ok) return showError(result.errors[0]);
      showToast("방법론 산식에 따라 계산을 완료했습니다.");
    }
    goToStep(state.currentStep + 1);
  }

  function validateStep(step, silent = false) {
    let result = { ok: true, message: "" };
    if (step === 1) {
      const missing = [state.site.name, state.site.address, state.site.startDate, state.site.endDate, state.site.batch, state.site.cutoffTime, state.site.boundary].some(value => !String(value || "").trim());
      if (missing) result = { ok: false, message: "사업장명, 주소, 산정기간, 생산방식, 측정 기준시각과 사업경계를 모두 입력해주세요." };
      else if (state.site.startDate > state.site.endDate) result = { ok: false, message: "산정 종료일은 시작일보다 빠를 수 없습니다." };
    }
    if (step === 2 && !conditions.every(item => state.eligibility[item.id] === true)) result = { ok: false, message: "방법론 적용 가능 여부를 확인해야 합니다. EL-01부터 EL-10까지 모두 ‘예’인지 확인해주세요." };
    if (step === 3) {
      const coreMissing = !state.config.processName || !state.config.fuelType || !state.config.fuelUnit || !factorComplete(state.config.ncv) || !factorComplete(state.config.fuelEf);
      if (coreMissing) result = { ok: false, message: "공정, 연료, 순발열량과 연료 배출계수의 값·출처·적용기간을 모두 입력해주세요." };
      else if (!state.config.gridFactors.some(factorComplete)) result = { ok: false, message: "전력 배출계수를 한 개 이상 입력해주세요." };
      else if (hasGridFactorOverlap()) result = { ok: false, message: "동일한 기간에 두 개의 전력 배출계수가 적용되어 있습니다." };
      else if (state.config.leakageMethod === "actual" && Object.values(state.config.additive).some(value => !positive(value))) result = { ok: false, message: "방법 2 계산을 위해 첨가제 생산량, 연료·전력, 계수와 배합비를 모두 입력해주세요." };
    }
    if (step === 4) {
      const coverage = getBaselineCoverage();
      if (state.baseline.length < 1 || coverage.completeYears < 1) result = { ok: false, message: "베이스라인 자료는 최소 1년이 필요합니다. 월 단위 입력은 한 연도의 12개월을 모두 입력해주세요." };
      else if (state.baseline.some(row => !baselineRowComplete(row))) result = { ok: false, message: "베이스라인의 생산량, 연료, 전력과 3종 증빙을 모두 입력해주세요." };
      else if (new Set(state.baseline.map(row => String(row.period))).size !== state.baseline.length) result = { ok: false, message: "이미 입력된 기간의 베이스라인 자료가 있습니다." };
      else if (coverage.mixedYears.length) result = { ok: false, message: `${coverage.mixedYears[0]}년 자료는 연 단위와 월 단위를 함께 사용할 수 없습니다.` };
      else if (coverage.incompleteYears.length) result = { ok: false, message: `${coverage.incompleteYears[0]}년 월별 자료가 12개월 미만입니다. 누락 월을 입력해주세요.` };
      else if (coverage.completeYears < 3 && !state.baselineReason.trim()) result = { ok: false, message: "3년 미만 자료를 사용하는 사유를 입력해주세요." };
    }
    if (step === 5) {
      if (state.activities.length < 1) result = { ok: false, message: "월별 활동자료를 한 개 이상 입력해주세요." };
      else if (state.activities.some(row => !activityCoreComplete(row))) result = { ok: false, message: "월별 생산량, 연료, 전력, 생산온도, 품질 등급과 적합 여부를 모두 입력해주세요." };
      else if (new Set(state.activities.map(row => row.period)).size !== state.activities.length) result = { ok: false, message: "이미 입력된 월의 활동자료가 있습니다." };
    }
    if (step === 6) {
      const blockers = calculationBlockers();
      if (blockers.length) result = { ok: false, message: blockers[0] };
    }
    if (!silent && !result.ok) showToast("입력 내용을 확인해주세요.");
    return result;
  }

  function calculationBlockers() {
    const blockers = [];
    for (let step = 1; step <= 5; step += 1) {
      const validation = validateStep(step, true);
      if (!validation.ok) blockers.push(validation.message);
    }
    if (state.baseline.some(row => row.fuelType.trim() !== state.config.fuelType.trim()) || state.activities.some(row => row.fuelType.trim() !== state.config.fuelType.trim())) blockers.push("사업 전후 연료 종류가 동일해야 합니다.");
    const included = state.activities.filter(row => getActivityReview(row).level !== "danger");
    if (!included.length) blockers.push("온도·품질·필수 증빙을 충족하는 월별 생산자료가 없습니다.");
    [...state.baseline.map(row => baselinePeriodDate(row.period)), ...included.map(row => `${row.period}-15`)].forEach(date => {
      if (!factorApplies(state.config.ncv, date) || !factorApplies(state.config.fuelEf, date) || !findGridFactor(date)) blockers.push(`${date.slice(0, 7)}에 적용할 유효한 계수가 없습니다.`);
    });
    return [...new Set(blockers)];
  }

  function calculateBaseline(requireComplete = true) {
    if (!state.baseline.length) return { ok: false, errors: ["베이스라인 자료가 없습니다."] };
    const items = [];
    const errors = [];
    state.baseline.forEach(row => {
      const date = baselinePeriodDate(row.period);
      const grid = findGridFactor(date);
      if (requireComplete && (!baselineRowComplete(row) || !grid || !factorApplies(state.config.ncv, date) || !factorApplies(state.config.fuelEf, date))) {
        errors.push(`${row.period}년 베이스라인 자료 또는 적용 계수를 확인해주세요.`);
        return;
      }
      if (!positive(row.production) || !positiveOrZero(row.fuel) || !positiveOrZero(row.electricity) || !grid) return;
      const fuelEnergy = Number(row.fuel) * normalizeNcv(state.config.ncv.value, state.config.ncv.unit);
      const fuelEmission = fuelEnergy * normalizeFuelEf(state.config.fuelEf.value, state.config.fuelEf.unit);
      const electricityMwh = Number(row.electricity) / 1000;
      const electricityEmission = electricityMwh * normalizeGridEf(grid.value, grid.unit);
      items.push({ row, gridFactor: grid, fuelEnergy, fuelEmission, electricityMwh, electricityEmission, emission: fuelEmission + electricityEmission });
    });
    if (errors.length || !items.length) return { ok: false, errors: errors.length ? errors : ["베이스라인 계산에 필요한 값을 확인해주세요."] };
    const annualGroups = new Map();
    items.forEach(item => {
      const year = String(item.row.period).slice(0, 4);
      const group = annualGroups.get(year) || { production: 0, fuel: 0, electricity: 0, fuelEmission: 0, electricityEmission: 0 };
      group.production += Number(item.row.production);
      group.fuel += Number(item.row.fuel);
      group.electricity += Number(item.row.electricity);
      group.fuelEmission += item.fuelEmission;
      group.electricityEmission += item.electricityEmission;
      annualGroups.set(year, group);
    });
    const annualValues = [...annualGroups.values()];
    const years = annualValues.length;
    const avgProduction = sum(annualValues.map(item => item.production)) / years;
    const avgFuel = sum(annualValues.map(item => item.fuel)) / years;
    const avgElectricity = sum(annualValues.map(item => item.electricity)) / years;
    const avgFuelEmission = sum(annualValues.map(item => item.fuelEmission)) / years;
    const avgElectricityEmission = sum(annualValues.map(item => item.electricityEmission)) / years;
    const avgEmission = avgFuelEmission + avgElectricityEmission;
    return { ok: true, items, years, avgProduction, avgFuel, avgElectricity, avgFuelEmission, avgElectricityEmission, avgEmission, ef: avgEmission / avgProduction };
  }

  function calculateAll() {
    const errors = calculationBlockers();
    const baseline = calculateBaseline(true);
    if (!baseline.ok) errors.push(...baseline.errors);
    if (errors.length) return { ok: false, errors: [...new Set(errors)] };

    const excluded = [];
    const warnings = [];
    const included = [];
    state.activities.forEach(row => {
      const review = getActivityReview(row);
      if (review.level === "danger") return excluded.push({ row, review });
      const date = `${row.period}-15`;
      const gridFactor = findGridFactor(date);
      const fuelEnergy = Number(row.fuel) * normalizeNcv(state.config.ncv.value, state.config.ncv.unit);
      const fuelEmission = fuelEnergy * normalizeFuelEf(state.config.fuelEf.value, state.config.fuelEf.unit);
      const electricityMwh = Number(row.electricity) / 1000;
      const electricityEmission = electricityMwh * normalizeGridEf(gridFactor.value, gridFactor.unit);
      const item = { row, review, gridFactor, fuelEnergy, fuelEmission, electricityMwh, electricityEmission, emission: fuelEmission + electricityEmission };
      included.push(item);
      if (review.level === "warning") warnings.push({ row, review });
    });
    const projectProduction = sum(included.map(item => Number(item.row.production)));
    const projectEmission = sum(included.map(item => item.emission));
    const projectEf = projectEmission / projectProduction;
    const eligibleProduction = Math.min(projectProduction, baseline.avgProduction);
    const excess = Math.max(0, projectProduction - eligibleProduction);
    const be = baseline.ef * eligibleProduction;
    const pe = projectEf * eligibleProduction;
    let le = pe * .02;
    if (state.config.leakageMethod === "actual") {
      const a = state.config.additive;
      const grid = findGridFactor(state.site.startDate || `${state.activities[0].period}-15`);
      const additiveFuelEmission = Number(a.fuel) * (Number(a.ncv) / 1000) * (Number(a.fuelEf) / 1_000_000);
      const additiveElectricityEmission = (Number(a.electricity) / 1000) * normalizeGridEf(grid.value, grid.unit);
      const additiveEf = (additiveFuelEmission + additiveElectricityEmission) / Number(a.production);
      le = additiveEf * (Number(a.mixRate) / 100) * eligibleProduction;
    }
    return { ok: true, baseline, included, excluded, warnings, projectProduction, projectEmission, projectEf, eligibleProduction, excess, be, pe, le, er: be - pe - le };
  }

  function getActivityReview(row) {
    const reasons = [];
    let level = "success";
    if (!activityCoreComplete(row)) {
      reasons.push("필수 입력값 누락");
      level = "danger";
    }
    if (positiveOrZero(row.tempMin) && positiveOrZero(row.tempMax) && (Number(row.tempMin) < 130 || Number(row.tempMax) > 140 || Number(row.tempMin) > Number(row.tempMax))) {
      reasons.push("130~140℃ 범위 이탈");
      level = "danger";
    }
    if (row.quality === "no") {
      reasons.push("품질기준 부적합");
      level = "danger";
    }
    if (row.quality === "yes" && !row.evidence?.quality) {
      reasons.push("품질 증빙 없음");
      level = "danger";
    }
    const missingEvidence = evidenceTypes.activity.filter(([key]) => key !== "quality" && !row.evidence?.[key]).map(([, label]) => label);
    if (missingEvidence.length && level !== "danger") {
      reasons.push(`${missingEvidence.length}종 교차증빙 부족`);
      level = "warning";
    }
    if (positive(row.production) && Number(row.fuel) === 0 && Number(row.electricity) === 0 && level !== "danger") {
      reasons.push("생산량은 있으나 에너지 사용량 없음");
      level = "warning";
    }
    return { level, label: level === "success" ? "계산 가능" : level === "warning" ? "확인 필요" : "산정 제외", reasons };
  }

  function addGridFactor() {
    state.config.gridFactors.push({ id: uid(), value: null, unit: "tCO2-eq/MWh", source: "", from: "", to: "" });
    scheduleSave(); renderGridFactors(); showToast("새 전력 배출계수 행을 추가했습니다.");
  }

  function addBaselineRow() {
    const lastYear = Math.max(0, ...state.baseline.map(row => Number(String(row.period).slice(0, 4)) || 0));
    const suggested = lastYear ? lastYear + 1 : (Number(state.site.startDate?.slice(0, 4)) || new Date().getFullYear()) - 3;
    state.baseline.push({ id: uid(), period: suggested, production: null, fuelType: state.config.fuelType, fuel: null, electricity: null, evidence: {} });
    scheduleSave(); renderBaseline(); updateNavigationState();
  }

  function addActivityRow() {
    const last = state.activities.at(-1)?.period;
    const suggested = last ? nextMonth(last) : (state.site.startDate?.slice(0, 7) || `${new Date().getFullYear()}-01`);
    state.activities.push({ id: uid(), period: suggested, production: null, fuelType: state.config.fuelType, fuel: null, electricity: null, tempMin: null, tempMax: null, grade: "", quality: "", note: "", evidence: {} });
    scheduleSave(); renderActivities(); renderReview(); updateNavigationState();
  }

  function removeRow(collection, id) {
    const items = getCollection(collection);
    const index = items.findIndex(item => item.id === id);
    if (index < 0) return;
    items.splice(index, 1);
    if (collection === "gridFactors" && !items.length) addGridFactor();
    scheduleSave();
    if (collection === "gridFactors") renderGridFactors();
    if (collection === "baseline") renderBaseline();
    if (collection === "activities") renderActivities();
    renderReview(); renderResults(); updateNavigationState();
  }

  function openEvidenceModal(type, rowId) {
    const collection = type === "baseline" ? state.baseline : state.activities;
    const row = collection.find(item => item.id === rowId);
    if (!row) return;
    modalContext = { type, rowId };
    pendingEvidence = { ...(row.evidence || {}) };
    document.getElementById("evidence-modal-title").textContent = `${type === "baseline" ? `${row.period}년` : formatPeriod(row.period)} 증빙 연결`;
    renderEvidenceModal();
    els.modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function renderEvidenceModal() {
    els.evidenceList.innerHTML = evidenceTypes[modalContext.type].map(([key, label, help]) => `<div class="evidence-item"><div><strong>${label}</strong><small>${pendingEvidence[key] ? escapeHtml(pendingEvidence[key]) : help}</small></div><label class="file-label">${pendingEvidence[key] ? "교체" : "파일 선택"}<input type="file" data-evidence-key="${key}" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"></label></div>`).join("");
    els.evidenceList.querySelectorAll("input[type=file]").forEach(input => input.addEventListener("change", () => {
      if (input.files?.[0]) pendingEvidence[input.dataset.evidenceKey] = input.files[0].name;
      renderEvidenceModal();
    }));
  }

  function saveEvidence() {
    const collection = modalContext.type === "baseline" ? state.baseline : state.activities;
    const row = collection.find(item => item.id === modalContext.rowId);
    if (row) row.evidence = { ...pendingEvidence };
    closeEvidenceModal();
    scheduleSave(); renderBaseline(); renderActivities(); renderReview(); renderResults();
    showToast("증빙 연결 상태를 저장했습니다.");
  }

  function closeEvidenceModal() {
    els.modal.hidden = true;
    document.body.style.overflow = "";
    modalContext = null;
  }

  function loadSampleData() {
    const demoEvidence = prefix => ({ production: `${prefix}_생산일보.pdf`, fuel: `${prefix}_연료계량기.jpg`, electricity: `${prefix}_전력고지서.pdf`, temperature: `${prefix}_온도성적서.pdf`, quality: `${prefix}_제품검사성적서.pdf` });
    state = makeDefaultState();
    state.site = { name: "그리너스 아스콘 제1공장", address: "경기도 성남시 분당구 그린로 100", startDate: "2024-01-01", endDate: "2024-12-31", batch: "yes", cutoffTime: "17:00", boundary: "골재 투입부터 혼합·출하까지의 생산라인과 해당 라인의 연료 유량계, 전력계 및 계근대를 사업경계로 설정" };
    conditions.forEach(item => state.eligibility[item.id] = true);
    state.config = {
      processName: "아스팔트 혼합 공정", fuelType: "B-C유", fuelUnit: "L",
      ncv: { value: 39.2, unit: "MJ/L", source: "국가 온실가스 배출계수", from: "2020-01-01", to: "2025-12-31" },
      fuelEf: { value: 75500, unit: "kgCO2-eq/TJ", source: "국가고유 배출계수", from: "2020-01-01", to: "2025-12-31" },
      gridFactors: [
        { id: uid(), value: .46625, unit: "tCO2-eq/MWh", source: "국가고유 전력배출계수", from: "2010-01-01", to: "2019-12-31" },
        { id: uid(), value: .45941, unit: "tCO2-eq/MWh", source: "국가고유 전력배출계수", from: "2020-01-01", to: "2025-12-31" }
      ],
      leakageMethod: "factor", additive: { production: null, fuel: null, electricity: null, ncv: null, fuelEf: null, mixRate: null }
    };
    state.baseline = [
      { id: uid(), period: 2021, production: 63120, fuelType: "B-C유", fuel: 447800, electricity: 831500, evidence: demoEvidence("2021") },
      { id: uid(), period: 2022, production: 64600, fuelType: "B-C유", fuel: 458900, electricity: 852300, evidence: demoEvidence("2022") },
      { id: uid(), period: 2023, production: 64505, fuelType: "B-C유", fuel: 460145, electricity: 858577, evidence: demoEvidence("2023") }
    ];
    state.activities = [
      { id: uid(), period: "2024-01", production: 3320, fuelType: "B-C유", fuel: 22480, electricity: 38120, tempMin: 132, tempMax: 138, grade: "W64", quality: "yes", note: "", evidence: demoEvidence("2024-01") },
      { id: uid(), period: "2024-02", production: 3350, fuelType: "B-C유", fuel: 22610, electricity: 37940, tempMin: 133, tempMax: 139, grade: "W70", quality: "yes", note: "전력 고지서 교차확인 예정", evidence: { ...demoEvidence("2024-02"), electricity: "" } },
      { id: uid(), period: "2024-03", production: 3291, fuelType: "B-C유", fuel: 22592, electricity: 38125, tempMin: 134, tempMax: 142, grade: "W76", quality: "yes", note: "최대온도 범위 이탈", evidence: demoEvidence("2024-03") }
    ];
    state.currentStep = 0;
    syncStaticBindings(); renderAll(); scheduleSave();
    showToast("PRD 사례 기반의 예시 데이터를 불러왔습니다.");
  }

  function bindReadyMixControls() {
    const search = document.getElementById("ready-mix-search");
    const region = document.getElementById("ready-mix-region");
    const searchButton = document.getElementById("ready-mix-search-button");
    const resetButton = document.getElementById("ready-mix-reset");
    const retryButton = document.getElementById("retry-ready-mix");
    const list = document.getElementById("ready-mix-list");
    if (!search || !region || !list) return;

    const apply = () => applyReadyMixFilters(true);
    searchButton?.addEventListener("click", apply);
    search.addEventListener("search", apply);
    search.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        apply();
      }
    });
    region.addEventListener("change", apply);
    resetButton?.addEventListener("click", () => {
      search.value = "";
      region.value = "all";
      applyReadyMixFilters(true);
      search.focus();
    });
    retryButton?.addEventListener("click", () => loadReadyMixFacilities(true));
    list.addEventListener("click", event => {
      const card = event.target.closest("[data-ready-mix-id]");
      if (card) selectReadyMixFacility(card.dataset.readyMixId, true);
    });
  }

  function activateReadyMixMap() {
    const container = document.getElementById("ready-mix-map");
    if (!container) return;
    if (!readyMixMap) {
      if (!window.L) {
        useReadyMixFallback("지도 라이브러리를 불러오지 못했습니다. 예시 데이터를 목록에 표시합니다.");
        setReadyMixLoading(false);
        return;
      }
      readyMixMap = window.L.map(container, { zoomControl: true }).setView([36.35, 127.8], 7);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(readyMixMap);
      readyMixLayer = window.L.layerGroup().addTo(readyMixMap);
    }
    readyMixMap.invalidateSize();
    if (!readyMixLoadPromise && !readyMixFacilities.length) loadReadyMixFacilities(false);
    else renderReadyMixMap(false);
  }

  async function loadReadyMixFacilities(forceRefresh) {
    if (readyMixLoadPromise) return readyMixLoadPromise;
    setReadyMixLoading(true);
    hideReadyMixError();

    readyMixLoadPromise = (async () => {
      if (!forceRefresh) {
        const cached = readReadyMixCache();
        if (cached) {
          readyMixFacilities = cached.facilities;
          applyReadyMixFilters(true, `24시간 캐시 · ${formatReadyMixTime(cached.fetchedAt)} 기준`);
          setReadyMixLoading(false);
          return;
        }
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), READY_MIX_REQUEST_TIMEOUT);
      try {
        const query = `[out:json][timeout:25];
area["ISO3166-1"="KR"][admin_level=2]->.searchArea;
(
  nwr["industrial"="concrete_plant"](area.searchArea);
  nwr["man_made"="works"]["product"="concrete"](area.searchArea);
);
out center tags;`;
        const response = await fetch(OVERPASS_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`Overpass API 응답 오류 (${response.status})`);
        const payload = await response.json();
        const facilities = normalizeReadyMixFacilities(payload?.elements);
        if (!facilities.length) {
          useReadyMixFallback("공개 지도에서 검색 결과를 찾지 못해 예시 데이터를 표시합니다.");
          return;
        }
        readyMixFacilities = facilities;
        writeReadyMixCache(facilities);
        applyReadyMixFilters(true, `OpenStreetMap 공개 데이터 · ${formatReadyMixTime(Date.now())} 조회`);
      } catch (error) {
        const reason = error?.name === "AbortError"
          ? "업체 정보 요청 시간이 초과되어 예시 데이터를 표시합니다."
          : "업체 정보를 불러오지 못해 예시 데이터를 표시합니다.";
        useReadyMixFallback(reason);
      } finally {
        window.clearTimeout(timeoutId);
        setReadyMixLoading(false);
      }
    })();

    try {
      await readyMixLoadPromise;
    } finally {
      readyMixLoadPromise = null;
    }
  }

  function normalizeReadyMixFacilities(elements) {
    if (!Array.isArray(elements)) return [];
    const normalized = elements.map(element => {
      const lat = Number(element.lat ?? element.center?.lat);
      const lng = Number(element.lon ?? element.center?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const tags = element.tags || {};
      const name = String(tags.name || tags.operator || tags.brand || "이름 미등록 콘크리트 생산시설").trim();
      const addressParts = [tags["addr:province"], tags["addr:city"], tags["addr:district"], tags["addr:street"], tags["addr:housenumber"]].filter(Boolean);
      const address = addressParts.join(" ") || "주소 정보 없음";
      return {
        id: `osm-${element.type}-${element.id}`,
        name,
        operator: String(tags.operator || "").trim(),
        region: inferReadyMixRegion(tags, address),
        address,
        lat,
        lng,
        osmType: element.type,
        osmId: element.id,
        isExample: false
      };
    }).filter(Boolean);

    const seen = new Set();
    return normalized.filter(item => {
      const nameKey = item.name.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
      const locationKey = `${item.lat.toFixed(4)},${item.lng.toFixed(4)}`;
      const key = `${nameKey}|${locationKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
  }

  function inferReadyMixRegion(tags, address) {
    const regionText = [tags["addr:province"], tags["addr:state"], tags["addr:city"], tags["addr:county"], address].filter(Boolean).join(" ");
    const regions = [
      ["서울", "서울특별시"], ["부산", "부산광역시"], ["대구", "대구광역시"], ["인천", "인천광역시"],
      ["광주", "광주광역시"], ["대전", "대전광역시"], ["울산", "울산광역시"], ["세종", "세종특별자치시"],
      ["경기", "경기도"], ["강원", "강원특별자치도"], ["충북", "충청북도"], ["충청북", "충청북도"],
      ["충남", "충청남도"], ["충청남", "충청남도"], ["전북", "전북특별자치도"], ["전라북", "전북특별자치도"],
      ["전남", "전라남도"], ["전라남", "전라남도"], ["경북", "경상북도"], ["경상북", "경상북도"],
      ["경남", "경상남도"], ["경상남", "경상남도"], ["제주", "제주특별자치도"]
    ];
    return regions.find(([needle]) => regionText.includes(needle))?.[1] || "지역 미상";
  }

  function applyReadyMixFilters(fitMap = true, statusText = "") {
    const search = document.getElementById("ready-mix-search");
    const region = document.getElementById("ready-mix-region");
    if (!search || !region) return;
    const keyword = search.value.trim().toLocaleLowerCase("ko-KR");
    const selectedRegion = region.value;
    readyMixFiltered = readyMixFacilities.filter(item => {
      const haystack = [item.name, item.operator, item.address, item.region].join(" ").toLocaleLowerCase("ko-KR");
      return (!keyword || haystack.includes(keyword)) && (selectedRegion === "all" || item.region === selectedRegion);
    });
    if (!readyMixFiltered.some(item => item.id === readyMixSelectedId)) readyMixSelectedId = null;
    renderReadyMixList(statusText);
    renderReadyMixMap(fitMap);
  }

  function renderReadyMixList(statusText = "") {
    const list = document.getElementById("ready-mix-list");
    const count = document.getElementById("ready-mix-count");
    const status = document.getElementById("ready-mix-status");
    const empty = document.getElementById("ready-mix-empty");
    if (!list || !count || !status || !empty) return;
    count.textContent = `${readyMixFiltered.length}개`;
    const usingExamples = readyMixFacilities.some(item => item.isExample);
    status.textContent = statusText || (usingExamples ? "예시 데이터입니다. 실제 업체 정보가 아닙니다." : "OpenStreetMap 공개 데이터 검색 결과입니다.");
    empty.hidden = readyMixFiltered.length > 0;
    list.hidden = readyMixFiltered.length === 0;
    list.innerHTML = readyMixFiltered.map(item => `<div role="listitem"><button class="company-card${item.id === readyMixSelectedId ? " is-selected" : ""}" type="button" data-ready-mix-id="${escapeAttr(item.id)}" aria-current="${item.id === readyMixSelectedId ? "true" : "false"}">
      <span class="company-card__head"><strong>${escapeHtml(item.name)}</strong><span class="company-card__badge">${item.isExample ? "예시 데이터" : "OSM"}</span></span>
      <p>${escapeHtml(item.address)}</p>
      <span class="company-card__meta"><span>${escapeHtml(item.region)}</span><span>${item.isExample ? "검증용 위치" : "공개 지도 정보"}</span></span>
    </button></div>`).join("");
  }

  function renderReadyMixMap(fitMap) {
    if (!readyMixMap || !readyMixLayer || !window.L) return;
    readyMixLayer.clearLayers();
    readyMixMarkers = new Map();
    readyMixFiltered.forEach(item => {
      const accessibleName = String(item.name || "레미콘 생산시설").replace(/[\u0000-\u001F\u007F]/g, " ").trim() || "레미콘 생산시설";
      const marker = window.L.marker([item.lat, item.lng], {
        title: accessibleName,
        alt: `${accessibleName} 위치`,
        keyboard: true
      });
      marker.bindPopup(`<strong>${escapeHtml(item.name)}</strong><br>${escapeHtml(item.address)}${item.isExample ? "<br><em>예시 데이터 · 실제 업체 정보 아님</em>" : ""}`);
      marker.bindTooltip(escapeHtml(item.name));
      marker.on("click", () => selectReadyMixFacility(item.id, false));
      marker.addTo(readyMixLayer);
      readyMixMarkers.set(item.id, marker);
    });
    readyMixMap.invalidateSize();
    if (!fitMap) return;
    if (!readyMixFiltered.length) readyMixMap.setView([36.35, 127.8], 7);
    else if (readyMixFiltered.length === 1) readyMixMap.setView([readyMixFiltered[0].lat, readyMixFiltered[0].lng], 13);
    else readyMixMap.fitBounds(window.L.latLngBounds(readyMixFiltered.map(item => [item.lat, item.lng])), { padding: [24, 24], maxZoom: 13 });
  }

  function selectReadyMixFacility(id, fromList) {
    const facility = readyMixFiltered.find(item => item.id === id);
    if (!facility) return;
    readyMixSelectedId = id;
    renderReadyMixList();
    const marker = readyMixMarkers.get(id);
    if (marker && readyMixMap) {
      readyMixMap.setView(marker.getLatLng(), Math.max(readyMixMap.getZoom(), 13), { animate: true });
      marker.openPopup();
    }
    if (!fromList) [...document.querySelectorAll("[data-ready-mix-id]")].find(card => card.dataset.readyMixId === id)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function useReadyMixFallback(message) {
    readyMixFacilities = READY_MIX_FALLBACK.map(item => ({ ...item }));
    showReadyMixError(`${message} 아래 항목은 기능 확인용 예시이며 실제 업체 정보가 아닙니다.`);
    applyReadyMixFilters(true, "예시 데이터 · 실제 업체 정보가 아닙니다.");
  }

  function readReadyMixCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(READY_MIX_CACHE_KEY));
      if (!cached || !Number.isFinite(cached.fetchedAt) || Date.now() - cached.fetchedAt >= READY_MIX_CACHE_TTL) return null;
      if (!Array.isArray(cached.facilities) || !cached.facilities.length) return null;
      const facilities = cached.facilities.filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng) && !item.isExample);
      return facilities.length ? { fetchedAt: cached.fetchedAt, facilities } : null;
    } catch (_) {
      return null;
    }
  }

  function writeReadyMixCache(facilities) {
    try {
      localStorage.setItem(READY_MIX_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), facilities }));
    } catch (_) { /* file preview or storage policy may block cache */ }
  }

  function setReadyMixLoading(isLoading) {
    const loading = document.getElementById("ready-mix-loading");
    if (loading) loading.hidden = !isLoading;
  }

  function showReadyMixError(message) {
    const error = document.getElementById("ready-mix-error");
    const detail = document.getElementById("ready-mix-error-message");
    if (detail) detail.textContent = message;
    if (error) error.hidden = false;
  }

  function hideReadyMixError() {
    const error = document.getElementById("ready-mix-error");
    if (error) error.hidden = true;
  }

  function formatReadyMixTime(timestamp) {
    return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
  }

  function factorComplete(factor) {
    return Boolean(positive(factor?.value) && factor?.unit && factor?.source?.trim() && factor?.from);
  }

  function factorApplies(factor, date) {
    return factorComplete(factor) && date >= factor.from && (!factor.to || date <= factor.to);
  }

  function findGridFactor(date) {
    return state.config.gridFactors.find(factor => factorApplies(factor, date)) || null;
  }

  function hasGridFactorOverlap() {
    const factors = state.config.gridFactors.filter(factorComplete);
    for (let i = 0; i < factors.length; i += 1) {
      for (let j = i + 1; j < factors.length; j += 1) {
        const aEnd = factors[i].to || "9999-12-31";
        const bEnd = factors[j].to || "9999-12-31";
        if (factors[i].from <= bEnd && factors[j].from <= aEnd) return true;
      }
    }
    return false;
  }

  function baselineRowComplete(row) {
    return /^(19|20)\d{2}(-(?:0[1-9]|1[0-2]))?$/.test(String(row.period || "")) && positive(row.production) && positiveOrZero(row.fuel) && positiveOrZero(row.electricity) && Boolean(row.fuelType?.trim()) && evidenceCount(row, "baseline").complete;
  }

  function getBaselineCoverage() {
    const years = new Map();
    state.baseline.forEach(row => {
      const period = String(row.period || "");
      const year = period.slice(0, 4);
      if (!/^\d{4}$/.test(year)) return;
      const entry = years.get(year) || { annual: false, months: new Set() };
      if (/^\d{4}$/.test(period)) entry.annual = true;
      if (/^\d{4}-\d{2}$/.test(period)) entry.months.add(period.slice(5, 7));
      years.set(year, entry);
    });
    const completeYears = [...years.values()].filter(entry => entry.annual || entry.months.size === 12).length;
    const incompleteYears = [...years.entries()].filter(([, entry]) => !entry.annual && entry.months.size > 0 && entry.months.size < 12).map(([year]) => year);
    const mixedYears = [...years.entries()].filter(([, entry]) => entry.annual && entry.months.size > 0).map(([year]) => year);
    return { completeYears, incompleteYears, mixedYears };
  }

  function baselinePeriodDate(period) {
    const value = String(period || "");
    return /^\d{4}-\d{2}$/.test(value) ? `${value}-15` : `${value}-07-01`;
  }

  function activityCoreComplete(row) {
    return /^\d{4}-\d{2}$/.test(row.period || "") && positive(row.production) && positiveOrZero(row.fuel) && positiveOrZero(row.electricity) && positiveOrZero(row.tempMin) && positiveOrZero(row.tempMax) && Boolean(row.fuelType?.trim()) && ["W64", "W70", "W76"].includes(row.grade) && ["yes", "no"].includes(row.quality);
  }

  function evidenceCount(row, type) {
    const total = evidenceTypes[type].length;
    const count = evidenceTypes[type].filter(([key]) => Boolean(row.evidence?.[key])).length;
    return { count, total, complete: count === total };
  }

  function normalizeNcv(value, unit) {
    const number = Number(value) || 0;
    return unit?.startsWith("MJ/") ? number / 1000 : number;
  }

  function normalizeFuelEf(value, unit) {
    const number = Number(value) || 0;
    return unit === "kgCO2-eq/TJ" ? number / 1_000_000 : number;
  }

  function normalizeGridEf(value, unit) {
    const number = Number(value) || 0;
    return unit === "kgCO2-eq/kWh" ? number : number;
  }

  function getByPath(object, path) {
    return path.split(".").reduce((value, key) => value?.[key], object);
  }

  function setByPath(object, path, value) {
    const parts = path.split(".");
    const last = parts.pop();
    const target = parts.reduce((current, key) => current[key], object);
    target[last] = value;
  }

  function numberOrNull(value) { return value === "" ? null : Number(value); }
  function positive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }
  function positiveOrZero(value) { return value !== null && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0; }
  function sum(values) { return values.reduce((total, value) => total + (Number(value) || 0), 0); }
  function selected(value, expected) { return value === expected ? "selected" : ""; }
  function valueAttr(value) { return value === null || value === undefined ? "" : escapeAttr(String(value)); }
  function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
  function escapeAttr(value = "") { return escapeHtml(value); }
  function formatNumber(value, digits = 1) { return Number.isFinite(Number(value)) ? new Intl.NumberFormat("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value)) : "—"; }
  function displayNumber(value) { return value === null || value === "" || value === undefined ? "—" : formatNumber(value, 1); }
  function formatPeriod(value) { return /^\d{4}-\d{2}$/.test(value || "") ? `${value.slice(0, 4)}년 ${Number(value.slice(5, 7))}월` : value || "—"; }
  function dateRangeText(factor) { return `${factor.from || "—"} ~ ${factor.to || "종료일 없음"}`; }
  function getCalculationPeriodLabel() {
    if (!state.site.startDate || !state.site.endDate) return "산정기간 미설정";
    const startYear = state.site.startDate.slice(0, 4);
    const endYear = state.site.endDate.slice(0, 4);
    return startYear === endYear ? `${endYear}년 산정` : `${startYear}~${endYear}년 산정`;
  }
  function nextMonth(period) { const [year, month] = period.split("-").map(Number); const date = new Date(year, month, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }

  function scheduleSave() {
    els.saveState.classList.add("is-saving");
    els.saveState.innerHTML = "<span></span> 저장 중";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* file preview may block storage */ }
      els.saveState.classList.remove("is-saving");
      els.saveState.innerHTML = "<span></span> 자동 저장됨";
    }, 300);
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function showError(message) {
    els.error.hidden = false;
    els.errorMessage.textContent = message;
    els.error.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function clearError() { els.error.hidden = true; }
})();
