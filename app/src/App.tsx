import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  CalendarDays,
  FileJson,
  MapPin,
  Navigation,
  Phone,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import retailRules from "./data/retail_rules.example.json";
import { formatMissingField, quote } from "./quoteEngine";
import { addAuditEvent, addQuoteSnapshot, loadState, resetState, saveState } from "./storage";
import { krw, labelForCategory, todayKst } from "./format";
import { businessStatus } from "./businessHours";
import type {
  AreaType,
  BuildingType,
  Catalog,
  Crew,
  FlooringMaterial,
  LaborGrade,
  Material,
  QuoteInput,
  QuoteRules,
  RuleEntries,
  StoredState,
} from "./types";

const INITIAL_INPUT: QuoteInput = {
  building_type: "apartment",
  area_type: "평형",
  area_pyeong: 24,
  material_id: null,
  include_flooring: false,
  flooring_thickness: "1.8T",
};

const FURNITURE = ["냉장고", "장롱", "TV", "선반", "기타"];

const COMPANY_INFO = {
  name: "가경지업사",
  category: "도배공사",
  address: "인천 미추홀구 석정로376번길 17 1층",
  phone: "0507-1351-3531",
  naverMapUrl: "https://map.naver.com/p/entry/place/2096080820?placePath=%2Fhome",
  kakaoMapUrl: "https://place.map.kakao.com/870596657",
};

export default function App() {
  const [state, setState] = useState<StoredState | null>(null);
  const [route, setRoute] = useState(readRoute());
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter | null>(null);

  useEffect(() => {
    loadState().then(setState).catch(() =>
      setState({
        rules: retailRules as unknown as QuoteRules,
        history: [],
        quotes: [],
        settings: { shopName: COMPANY_INFO.name, contactText: COMPANY_INFO.phone, managerName: "로컬 사용자" },
      }),
    );
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const persist = async (next: StoredState) => {
    setState(next);
    await saveState(next);
  };

  const showCatalog = (filter: CatalogFilter | null) => {
    if (route !== "/") {
      window.history.pushState(null, "", pathForRoute("/"));
      setRoute("/");
    }
    setCatalogFilter(filter);
  };

  if (!state) {
    return <div className="loading">견적 데이터를 불러오는 중입니다.</div>;
  }

  return (
    <div className="app-shell">
      {route === "/admin" ? (
        <AdminApp state={state} persist={persist} />
      ) : (
        <CustomerPage state={state} showCatalog={showCatalog} />
      )}
      {catalogFilter && <CatalogModal rules={state.rules} filter={catalogFilter} onClose={() => setCatalogFilter(null)} />}
    </div>
  );
}

function CustomerPage({
  state,
  showCatalog,
}: {
  state: StoredState;
  showCatalog: (filter: CatalogFilter | null) => void;
}) {
  const [input, setInput] = useState<QuoteInput>(INITIAL_INPUT);
  const [materialGroup, setMaterialGroup] = useState<"silk" | "wide_hapji" | "narrow_hapji">("silk");
  const [furniture, setFurniture] = useState<string[]>([]);
  const [now, setNow] = useState(() => new Date());
  const result = useMemo(() => quote(input, state.rules), [input, state.rules]);
  const hours = useMemo(() => businessStatus(now), [now]);
  const materials = state.rules.materials.filter((item) => item.active !== false);
  const shopName = state.settings.shopName || COMPANY_INFO.name;
  const contactText = state.settings.contactText || COMPANY_INFO.phone;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const chooseGroup = (group: typeof materialGroup) => {
    setMaterialGroup(group);
    const first = materials.find((item) => item.category === group);
    setInput((current) => ({ ...current, material_id: first?.id ?? null }));
  };

  const summaryText = [
    `견적일: ${todayKst()}`,
    `건물/면적: ${input.building_type} ${input.area_type} ${input.area_pyeong}평`,
    `벽지: ${materials.find((item) => item.id === input.material_id)?.name ?? "미선택"}`,
    `장판: ${input.include_flooring ? input.flooring_thickness : "미포함"}`,
    `짐: ${furniture.join(", ") || "없음"}`,
    result.status === "quoted" ? `견적 기준 합계: ${krw(result.amount_krw)}` : "견적 기준 합계: 산출 불가",
  ].join("\n");

  return (
    <main className="page">
      <section className="hero-band customer-hero">
        <div className="hero-copy">
          <p className="hero-shop">{shopName}</p>
          <h1>
            <span>도배·장판 견적 미리보기</span>
          </h1>
          <div className="business-strip" aria-label="업체 정보">
            <a href={COMPANY_INFO.naverMapUrl} target="_blank" rel="noreferrer">
              <MapPin aria-hidden />
              {COMPANY_INFO.address}
            </a>
            <a href={`tel:${contactText.replaceAll("-", "")}`}>
              <Phone aria-hidden />
              {contactText}
            </a>
            <span className={hours.isOpen ? "business-hours open" : "business-hours closed"}>{hours.label}</span>
          </div>
        </div>
        <div className="hero-side">
          <img className="hero-logo" src={`${normalizedBase()}gagyeong-logo.png`} alt="가경지업사 로고" />
        </div>
      </section>

      <section id="estimate" className="work-area two-column">
        <div className="section-intro">
          <p className="eyebrow">견적 산출</p>
        </div>
        <form className="quote-form" onSubmit={(event) => event.preventDefault()}>
          <Step title="1. 현장">
            <div className="segmented">
              <button
                type="button"
                className={input.building_type === "apartment" ? "selected" : ""}
                onClick={() => setInput((current) => ({ ...current, building_type: "apartment", area_type: "평형" }))}
              >
                아파트
              </button>
              <button
                type="button"
                className={input.building_type === "villa" ? "selected" : ""}
                onClick={() => setInput((current) => ({ ...current, building_type: "villa", area_type: "전용" }))}
              >
                빌라
              </button>
            </div>
            <label className="area-field">
              면적
              <div className="area-control">
                <select
                  value={input.area_type}
                  onChange={(event) => setInput((current) => ({ ...current, area_type: event.target.value as AreaType }))}
                >
                  <option value="평형">평형</option>
                  <option value="전용">전용</option>
                </select>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  value={input.area_pyeong > 0 ? String(input.area_pyeong) : ""}
                  onChange={(event) => {
                    const value = event.target.value.replace(/[^\d]/g, "");
                    setInput((current) => ({ ...current, area_pyeong: value ? Number(value) : 0 }));
                  }}
                />
                <span>평</span>
              </div>
            </label>
          </Step>

          <Step title="2. 벽지" className="wallpaper-step">
            <div className="segmented three">
              <button type="button" className={materialGroup === "silk" ? "selected" : ""} onClick={() => chooseGroup("silk")}>
                실크
              </button>
              <button
                type="button"
                className={materialGroup === "narrow_hapji" ? "selected" : ""}
                onClick={() => chooseGroup("narrow_hapji")}
              >
                소폭 합지
              </button>
              <button
                type="button"
                className={materialGroup === "wide_hapji" ? "selected" : ""}
                onClick={() => chooseGroup("wide_hapji")}
              >
                광폭 합지
              </button>
            </div>
            <div className="choice-grid">
              {materials
                .filter((item) => item.category === materialGroup)
                .map((material) => {
                  const hasCatalog = state.rules.catalogs.some(
                    (catalog) => catalog.active !== false && catalogMatchesMaterial(catalog, material),
                  );
                  return (
                    <article className={input.material_id === material.id ? "choice-card selected" : "choice-card"} key={material.id}>
                      <button
                        type="button"
                        className="choice"
                        onClick={() => setInput((current) => ({ ...current, material_id: material.id }))}
                      >
                        <strong>{material.name} / {material.brand}</strong>
                      </button>
                      <button
                        type="button"
                        className="catalog-command"
                        disabled={!hasCatalog}
                        onClick={() =>
                          hasCatalog &&
                          showCatalog({
                            materialId: material.id,
                            brand: material.brand,
                            label: `${material.brand ?? "브랜드"} ${material.name ?? "제품"}`,
                          })
                        }
                      >
                        카탈로그
                      </button>
                    </article>
                  );
                })}
            </div>
          </Step>

          <Step title="3. 장판">
            <label className="check-row">
              <input
                type="checkbox"
                checked={input.include_flooring}
                onChange={(event) => setInput((current) => ({ ...current, include_flooring: event.target.checked }))}
              />
              장판 포함
            </label>
            {input.include_flooring && (
              <div className="segmented three">
                {state.rules.flooring_materials.map((flooring) => (
                  <button
                    type="button"
                    key={flooring.thickness}
                    className={input.flooring_thickness === flooring.thickness ? "selected" : ""}
                    onClick={() => setInput((current) => ({ ...current, flooring_thickness: flooring.thickness }))}
                  >
                    {flooring.thickness}
                  </button>
                ))}
              </div>
            )}
          </Step>

          <Step title="4. 짐">
            <div className="check-grid">
              {FURNITURE.map((item) => (
                <label key={item} className="check-row">
                  <input
                    type="checkbox"
                    checked={furniture.includes(item)}
                    onChange={(event) =>
                      setFurniture((current) =>
                        event.target.checked ? [...current, item] : current.filter((value) => value !== item),
                      )
                    }
                  />
                  {item}
                </label>
              ))}
            </div>
          </Step>
        </form>

        <ResultPanel
          result={result}
          vatNotice={state.rules.policies.vat_notice}
          contactText={contactText}
          onCopy={() => navigator.clipboard?.writeText(summaryText)}
        />
      </section>
    </main>
  );
}

function ResultPanel({
  result,
  vatNotice,
  contactText,
  onCopy,
}: {
  result: ReturnType<typeof quote>;
  vatNotice: string;
  contactText: string;
  onCopy: () => void;
}) {
  const phone = contactText || COMPANY_INFO.phone;
  return (
    <aside className="result-panel" aria-live="polite">
      <p className="eyebrow">결과</p>
      <div className="result-notice">
        <ShieldAlert aria-hidden />
        <span>참고 견적 · 실측 후 변동 가능</span>
      </div>
      {result.status === "quoted" ? (
        <>
          <h2>{krw(result.amount_krw)}</h2>
          <p>{result.notice}</p>
          <div className="badge-row">
            <span>VAT 미확정</span>
            <span>실측 후 변동 가능</span>
          </div>
          <p className="warning-text">{vatNotice}</p>
        </>
      ) : (
        <>
          <h2>상담 확인 필요</h2>
        </>
      )}
      <div className="action-stack">
        <button type="button" className="secondary-action" onClick={onCopy}>
          <FileJson aria-hidden />
          견적 복사
        </button>
      </div>
      <div className="contact-box">
        <div>
          <strong>상담 문의</strong>
          <span>{phone}</span>
        </div>
        <div className="contact-actions">
          <a href={`tel:${phone.replaceAll("-", "")}`}>
            <Phone aria-hidden />
            전화 상담
          </a>
          <a href={COMPANY_INFO.naverMapUrl} target="_blank" rel="noreferrer">
            <Navigation aria-hidden />
            지도 보기
          </a>
        </div>
      </div>
    </aside>
  );
}

function CatalogModal({ rules, filter, onClose }: { rules: QuoteRules; filter: CatalogFilter; onClose: () => void }) {
  const material = filter.materialId ? rules.materials.find((item) => item.id === filter.materialId) : null;
  const catalogs = rules.catalogs
    .filter((catalog) => catalog.active !== false)
    .filter((catalog) => !material || catalogMatchesMaterial(catalog, material));

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="catalog-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-modal-title" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">외부 카탈로그</p>
            <h2 id="catalog-modal-title">{filter.label} 카탈로그</h2>
          </div>
          <button type="button" className="icon-command" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="catalog-grid">
          {catalogs.length ? (
            catalogs.map((catalog) => (
              <article className="catalog-card" key={catalog.id}>
                <div>
                  <strong>{catalog.name}</strong>
                  <span>{catalog.brand ?? "브랜드 미분류"}</span>
                </div>
                <p>{catalog.verification}</p>
                <a href={catalog.url} target="_blank" rel="noreferrer">
                  새 탭에서 열기
                </a>
              </article>
            ))
          ) : (
            <article className="catalog-card empty">
              <BookOpen aria-hidden />
              <strong>연결된 카탈로그가 없습니다.</strong>
              <p>관리자 페이지에서 카탈로그 링크의 제품 연결 또는 브랜드를 등록해 주세요.</p>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}

function ProductPickerModal({
  products,
  search,
  onSearch,
  selectedValue,
  title,
  placeholder,
  onSelect,
  onClose,
}: {
  products: ProductPickerOption[];
  search: string;
  onSearch: (value: string) => void;
  selectedValue: string | null;
  title: string;
  placeholder: string;
  onSelect: (product: ProductPickerOption) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-picker-title" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">제품 선택</p>
            <h2 id="product-picker-title">{title}</h2>
          </div>
          <button type="button" className="icon-command" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <input
          autoFocus
          className="product-search"
          value={search}
          placeholder={placeholder}
          onChange={(event) => onSearch(event.target.value)}
        />
        <div className="product-list">
          {products.map((product) => {
            const selected = selectedValue === product.value;
            return (
            <button
              type="button"
              className={selected ? "product-option selected" : "product-option"}
              key={`${product.kind}-${product.value}`}
              onClick={() => onSelect(product)}
            >
              <span>{product.group}</span>
              <strong>{product.title}</strong>
              <small>{product.subtitle}</small>
            </button>
          );
          })}
          {products.length === 0 && <p className="empty-search">검색 결과가 없습니다.</p>}
        </div>
      </section>
    </div>
  );
}

function AdminApp({ state, persist }: { state: StoredState; persist: (next: StoredState) => Promise<void> }) {
  const [tab, setTab] = useState<"calc" | "data" | "quotes" | "backup">("calc");
  const [adminInput, setAdminInput] = useState<QuoteInput>({ ...INITIAL_INPUT, material_id: "SHINHAN_SKETCH" });
  const [adminQuoteInfo, setAdminQuoteInfo] = useState<AdminQuoteInfo>({
    inquiryDate: todayKst(),
    customerPhone: "",
    siteAddress: "",
    preferredDates: ["", "", ""],
    memo: "",
  });
  const adminResult = useMemo(() => quote(adminInput, state.rules), [adminInput, state.rules]);
  const saveAdminQuote = async () => {
    const next = addQuoteSnapshot(state, {
      input: adminInput,
      result: adminResult,
      furniture: [],
      preferredDates: adminQuoteInfo.preferredDates.filter(Boolean),
      datasetVersion: state.rules.dataset_version,
      inquiryDate: adminQuoteInfo.inquiryDate || todayKst(),
      customerPhone: adminQuoteInfo.customerPhone,
      siteAddress: adminQuoteInfo.siteAddress,
      memo: adminQuoteInfo.memo,
    });
    await persist(next);
  };

  return (
    <main className="admin-layout">
      <aside className="admin-nav">
        <strong>견적 관리자</strong>
        <button className={tab === "calc" ? "active" : ""} onClick={() => setTab("calc")}>
          견적 계산
        </button>
        <button className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}>
          자료 관리
        </button>
        <button className={tab === "quotes" ? "active" : ""} onClick={() => setTab("quotes")}>
          견적 이력
        </button>
        <button className={tab === "backup" ? "active" : ""} onClick={() => setTab("backup")}>
          백업
        </button>
      </aside>
      <section className="admin-content">
        <div className="mode-warning">
          <ShieldAlert aria-hidden />
          <span>로컬 모드입니다. 이 URL은 인증이나 비밀보장을 제공하지 않으며, 데이터는 이 브라우저에만 저장됩니다.</span>
        </div>
        {tab === "calc" && (
          <AdminCalculator
            input={adminInput}
            setInput={setAdminInput}
            result={adminResult}
            rules={state.rules}
            quoteInfo={adminQuoteInfo}
            setQuoteInfo={setAdminQuoteInfo}
            onSaveQuote={saveAdminQuote}
          />
        )}
        {tab === "data" && <DataManager state={state} persist={persist} />}
        {tab === "quotes" && <QuoteHistory state={state} persist={persist} />}
        {tab === "backup" && <Backup state={state} persist={persist} />}
      </section>
    </main>
  );
}

function AdminCalculator({
  input,
  setInput,
  result,
  rules,
  quoteInfo,
  setQuoteInfo,
  onSaveQuote,
}: {
  input: QuoteInput;
  setInput: (input: QuoteInput) => void;
  result: ReturnType<typeof quote>;
  rules: QuoteRules;
  quoteInfo: AdminQuoteInfo;
  setQuoteInfo: (info: AdminQuoteInfo) => void;
  onSaveQuote: () => Promise<void>;
}) {
  const [productPickerKind, setProductPickerKind] = useState<"wallpaper" | "flooring" | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const selectedMaterial = rules.materials.find((material) => material.id === input.material_id);
  const selectedFlooring = input.include_flooring
    ? rules.flooring_materials.find((flooring) => flooring.thickness === input.flooring_thickness)
    : null;
  const wallpaperProducts = useMemo<ProductPickerOption[]>(() =>
    rules.materials.map((material) => ({
      kind: "wallpaper" as const,
      value: material.id ?? "",
      group: labelForCategory(material.category),
      title: material.name ?? "제품명 없음",
      subtitle: material.brand ?? "브랜드 없음",
    })),
  [rules.materials]);
  const flooringProducts = useMemo<ProductPickerOption[]>(() =>
    rules.flooring_materials.map((flooring) => ({
      kind: "flooring" as const,
      value: flooring.thickness,
      group: "장판",
      title: flooring.name || flooring.thickness,
      subtitle: flooring.brand ? `${flooring.brand} / ${flooring.thickness}` : flooring.thickness,
    })),
  [rules.flooring_materials]);
  const filteredProducts = useMemo<ProductPickerOption[]>(() => {
    const keyword = productSearch.trim().toLowerCase();
    const products = productPickerKind === "flooring" ? flooringProducts : wallpaperProducts;
    if (!keyword) return products;
    return products.filter((product) =>
      [product.kind === "wallpaper" ? "벽지" : "장판", product.group, product.title, product.subtitle].some((value) =>
        value.toLowerCase().includes(keyword),
      ),
    );
  }, [flooringProducts, productPickerKind, productSearch, wallpaperProducts]);

  const updatePreferredDate = (index: number, value: string) => {
    if (value && quoteInfo.preferredDates.some((date, dateIndex) => date === value && dateIndex !== index)) {
      return;
    }
    const preferredDates = [...quoteInfo.preferredDates, "", "", ""].slice(0, 3);
    preferredDates[index] = value;
    setQuoteInfo({
      ...quoteInfo,
      preferredDates,
    });
  };
  const preferredDateSlots = [...quoteInfo.preferredDates, "", "", ""].slice(0, 3);

  return (
    <div className="admin-stack">
      <section className="admin-hero-panel">
        <div>
          <p className="eyebrow">관리자 메인</p>
          <h1>견적 계산</h1>
          <p>고객 입력과 같은 기준으로 계산하고, 산출 결과는 견적 이력에 스냅샷으로 저장합니다.</p>
        </div>
        <button type="button" className="primary-action" onClick={onSaveQuote}>
          <Save aria-hidden />
          견적 이력에 저장
        </button>
      </section>

      <section className="editor-band">
        <div className="field-grid admin-estimate-grid">
          <label>
            건물
            <select value={input.building_type} onChange={(event) => setInput({ ...input, building_type: event.target.value as BuildingType })}>
              <option value="apartment">아파트</option>
              <option value="villa">빌라</option>
              <option value="officetel">오피스텔</option>
              <option value="house">주택</option>
            </select>
          </label>
          <label>
            면적 종류
            <select value={input.area_type} onChange={(event) => setInput({ ...input, area_type: event.target.value as AreaType })}>
              <option value="평형">평형</option>
              <option value="전용">전용</option>
            </select>
          </label>
          <label>
            면적
            <input type="number" min={1} value={input.area_pyeong} onChange={(event) => setInput({ ...input, area_pyeong: Number(event.target.value) })} />
          </label>
          <div className="field-label">
            <span>벽지</span>
            <button type="button" className="picker-trigger" onClick={() => {
              setProductSearch("");
              setProductPickerKind("wallpaper");
            }}>
              {selectedMaterial ? `${labelForCategory(selectedMaterial.category)} / ${selectedMaterial.name}` : "벽지 검색 및 선택"}
            </button>
          </div>
          <div className="field-label">
            <span>장판</span>
            <button type="button" className="picker-trigger" onClick={() => {
              setProductSearch("");
              setProductPickerKind("flooring");
            }}>
              {selectedFlooring ? `${selectedFlooring.name || selectedFlooring.thickness}` : "장판 검색 및 선택"}
            </button>
          </div>
        </div>
      </section>

      {productPickerKind && (
        <ProductPickerModal
          products={filteredProducts}
          search={productSearch}
          onSearch={setProductSearch}
          selectedValue={productPickerKind === "flooring" ? input.flooring_thickness ?? null : input.material_id}
          title={productPickerKind === "flooring" ? "장판을 검색하세요." : "벽지를 검색하세요."}
          placeholder={productPickerKind === "flooring" ? "장판, 두께, 브랜드 검색" : "벽지, 종류, 브랜드, 제품명 검색"}
          onClose={() => setProductPickerKind(null)}
          onSelect={(product) => {
            setInput(
              product.kind === "wallpaper"
                ? { ...input, material_id: product.value || null }
                : { ...input, include_flooring: true, flooring_thickness: product.value },
            );
            setProductPickerKind(null);
          }}
        />
      )}

      <section className="editor-band inquiry-panel">
        <div className="section-heading">
          <h2>문의 정보</h2>
        </div>
        <div className="field-grid">
          <label>
            문의 일자
            <input
              type="date"
              value={quoteInfo.inquiryDate}
              onChange={(event) => setQuoteInfo({ ...quoteInfo, inquiryDate: event.target.value })}
            />
          </label>
          <label>
            문의자 전화번호
            <input
              inputMode="tel"
              value={quoteInfo.customerPhone}
              placeholder="예: 010-0000-0000"
              onChange={(event) => setQuoteInfo({ ...quoteInfo, customerPhone: event.target.value })}
            />
          </label>
          <label className="wide-field">
            시공 주소
            <input
              value={quoteInfo.siteAddress}
              placeholder="시공 현장 주소"
              onChange={(event) => setQuoteInfo({ ...quoteInfo, siteAddress: event.target.value })}
            />
          </label>
        </div>
        <div className="inquiry-detail-grid">
          <div className="preferred-date-panel">
            <span className="field-title">희망 시공일</span>
            <div className="date-list admin-date-list">
              {preferredDateSlots.map((date, index) => (
                <label key={index} onClick={(event) => openDatePicker(event.currentTarget.querySelector("input"))}>
                  <CalendarDays aria-hidden />
                  <span className="priority-pill">{index + 1}순위</span>
                  <input
                    type="date"
                    value={date}
                    min={todayKst()}
                    onClick={(event) => openDatePicker(event.currentTarget)}
                    onChange={(event) => updatePreferredDate(index, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
          <label className="memo-field">
            메모
            <textarea
              value={quoteInfo.memo}
              placeholder="상담 내용, 특이사항, 현장 조건 등을 기록하세요."
              onChange={(event) => setQuoteInfo({ ...quoteInfo, memo: event.target.value })}
            />
          </label>
        </div>
      </section>

      {result.status === "quoted" && result.calculation ? (
        <section className="table-wrap">
          <h2>계산 상세 그리드</h2>
          <table>
            <tbody>
              <tr>
                <th>실사용량</th>
                <td>{result.calculation.actual_usage_pyeong}평</td>
                <th>구매수량</th>
                <td>{result.calculation.purchase_units} × {result.calculation.material_unit_label}</td>
              </tr>
              <tr>
                <th>자재 원가</th>
                <td>{krw(result.calculation.material_wholesale_krw)}</td>
                <th>자재 소매가</th>
                <td>{krw(result.calculation.material_retail_krw)}</td>
              </tr>
              <tr>
                <th>부자재</th>
                <td>{krw(result.calculation.supplies_krw)}</td>
                <th>시공비</th>
                <td>{krw(result.calculation.labor_krw)}</td>
              </tr>
              <tr>
                <th>조공/중기공/기공</th>
                <td>
                  {result.calculation.labor_crew.helper}/{result.calculation.labor_crew.intermediate}/
                  {result.calculation.labor_crew.expert}
                </td>
                <th>소매 기준 합계</th>
                <td>{krw(result.amount_krw)}</td>
              </tr>
              <tr>
                <th>참고 원가 기준 합계</th>
                <td>{krw(result.reference_cost_total_krw)}</td>
                <th>부가세</th>
                <td>처리 미확정</td>
              </tr>
            </tbody>
          </table>
        </section>
      ) : (
        <section className="editor-band">
          <h2>견적 산출 불가</h2>
          <ul className="missing-list">
            {result.missing_fields.map((issue) => (
              <li key={issue.code}>{formatMissingField(issue)}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DataManager({ state, persist }: { state: StoredState; persist: (next: StoredState) => Promise<void> }) {
  const [dataTab, setDataTab] = useState<DataTab>("wallpaper");
  const [materialDrafts, setMaterialDrafts] = useState<Material[]>(state.rules.materials);
  const [flooringDrafts, setFlooringDrafts] = useState<FlooringMaterial[]>(state.rules.flooring_materials);
  const [laborRateDrafts, setLaborRateDrafts] = useState(state.rules.daily_labor_rates_krw);
  const [laborRequirementDrafts, setLaborRequirementDrafts] = useState(state.rules.labor_requirements);
  const [catalogDrafts, setCatalogDrafts] = useState<Catalog[]>(state.rules.catalogs);

  useEffect(() => {
    setMaterialDrafts(state.rules.materials);
  }, [state.rules.materials]);

  useEffect(() => {
    setFlooringDrafts(state.rules.flooring_materials);
  }, [state.rules.flooring_materials]);

  useEffect(() => {
    setLaborRateDrafts(state.rules.daily_labor_rates_krw);
    setLaborRequirementDrafts(state.rules.labor_requirements);
  }, [state.rules.daily_labor_rates_krw, state.rules.labor_requirements]);

  useEffect(() => {
    setCatalogDrafts(state.rules.catalogs);
  }, [state.rules.catalogs]);

  const materialDirty = JSON.stringify(materialDrafts) !== JSON.stringify(state.rules.materials);
  const flooringDirty = JSON.stringify(flooringDrafts) !== JSON.stringify(state.rules.flooring_materials);
  const laborDirty =
    JSON.stringify(laborRateDrafts) !== JSON.stringify(state.rules.daily_labor_rates_krw) ||
    JSON.stringify(laborRequirementDrafts) !== JSON.stringify(state.rules.labor_requirements);
  const catalogDirty = JSON.stringify(catalogDrafts) !== JSON.stringify(state.rules.catalogs);

  const createMaterial = (): Material => ({
    id: `LOCAL_MATERIAL_${Date.now()}`,
    category: "" as Material["category"],
    brand: null,
    name: null,
    purchase_unit_pyeong: null,
    unit_label: "5평 단위",
    retail_krw: null,
    wholesale_krw: null,
    supplies_krw_per_actual_pyeong: null,
    supplies_included_in_retail: false,
    active: true,
  });

  const addMaterialDraft = () => {
    const material = createMaterial();
    setMaterialDrafts((materials) => [...materials, material]);
  };

  const updateMaterialDraft = (index: number, patch: Partial<Material>) => {
    setMaterialDrafts((materials) => materials.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const saveMaterials = async () => {
    const nextRules = {
      ...state.rules,
      materials: materialDrafts,
      dataset_version: bumpVersion(state.rules.dataset_version),
    };
    await persist(addAuditEvent({ ...state, rules: nextRules }, { action: "update", entity: "materials", before: state.rules.materials, after: materialDrafts }));
  };

  const addFlooringDraft = () => {
    setFlooringDrafts((items) => [
      ...items,
      {
        id: `LOCAL_FLOORING_${Date.now()}`,
        thickness: "",
        brand: null,
        name: null,
        purchase_unit_pyeong: null,
        retail_krw: null,
        wholesale_krw: null,
        supplies_krw_per_actual_pyeong: null,
      },
    ]);
  };

  const updateFlooringDraft = (index: number, patch: Partial<FlooringMaterial>) => {
    setFlooringDrafts((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const saveFlooring = async () => {
    const flooring_materials = flooringDrafts;
    const nextRules = { ...state.rules, flooring_materials, dataset_version: bumpVersion(state.rules.dataset_version) };
    await persist(addAuditEvent({ ...state, rules: nextRules }, { action: "update", entity: "flooring_materials", before: state.rules.flooring_materials, after: flooring_materials }));
  };

  const updateLaborRateDraft = (grade: LaborGrade, value: number) => {
    setLaborRateDrafts((rates) => ({ ...rates, [grade]: value }));
  };

  const addLaborCrewRule = () => {
    setLaborRequirementDrafts((requirements) => [
      ...requirements,
      {
        category: "" as Material["category"],
        area_type: "" as AreaType,
        building_scope: "generic",
        entries: { "": { helper: null, intermediate: null, expert: null } as unknown as Crew },
      },
    ]);
  };

  const updateLaborRecordDraft = (recordIndex: number, patch: Partial<RuleEntries<Crew>>) => {
    setLaborRequirementDrafts((requirements) => requirements.map((record, index) => (index === recordIndex ? { ...record, ...patch } : record)));
  };

  const updateLaborAreaDraft = (recordIndex: number, oldArea: string, nextArea: string) => {
    setLaborRequirementDrafts((requirements) => requirements.map((record, index) => {
      if (index !== recordIndex) return record;
      const { [oldArea]: crew, ...rest } = record.entries;
      return { ...record, entries: { ...rest, [nextArea]: crew ?? ({ helper: null, intermediate: null, expert: null } as unknown as Crew) } };
    }));
  };

  const updateLaborCrewDraft = (recordIndex: number, area: string, patch: Partial<Record<keyof Crew, number | null>>) => {
    setLaborRequirementDrafts((requirements) => requirements.map((record, index) => {
      if (index !== recordIndex) return record;
      const current = record.entries[area] ?? ({ helper: null, intermediate: null, expert: null } as unknown as Crew);
      return { ...record, entries: { ...record.entries, [area]: { ...current, ...patch } as Crew } };
    }));
  };

  const saveLabor = async () => {
    const daily_labor_rates_krw = laborRateDrafts;
    const labor_requirements = laborRequirementDrafts;
    const nextRules = { ...state.rules, daily_labor_rates_krw, labor_requirements, dataset_version: bumpVersion(state.rules.dataset_version) };
    await persist(
      addAuditEvent(
        { ...state, rules: nextRules },
        {
          action: "update",
          entity: "labor",
          before: { daily_labor_rates_krw: state.rules.daily_labor_rates_krw, labor_requirements: state.rules.labor_requirements },
          after: { daily_labor_rates_krw, labor_requirements },
        },
      ),
    );
  };

  const addCatalogDraft = () => {
    setCatalogDrafts((catalogs) => [
      ...catalogs,
      {
        id: `CAT_LOCAL_${Date.now()}`,
        name: "",
        brand: null,
        product_relation: null,
        url: "",
        verification: "",
      },
    ]);
  };

  const updateCatalogDraft = (index: number, patch: Partial<Catalog>) => {
    setCatalogDrafts((catalogs) => catalogs.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const saveCatalogs = async () => {
    const catalogs = catalogDrafts;
    const nextRules = { ...state.rules, catalogs, dataset_version: bumpVersion(state.rules.dataset_version) };
    await persist(addAuditEvent({ ...state, rules: nextRules }, { action: "update", entity: "catalogs", before: state.rules.catalogs, after: catalogs }));
  };
  const laborRows = laborRequirementDrafts.flatMap((record, recordIndex) =>
    Object.entries(record.entries).map(([area, crew]) => ({ record, recordIndex, area, crew })),
  );

  return (
    <div className="admin-stack">
      <section className="admin-hero-panel compact">
        <div>
          <p className="eyebrow">자료 관리</p>
          <h1>가격 기준을 항목별로 관리합니다.</h1>
          <p>벽지, 부자재, 장판, 공임을 나눠서 수정하고 필요한 항목을 추가합니다.</p>
        </div>
      </section>

      <div className="data-tabs" aria-label="자료 관리 분류">
        {[
          ["wallpaper", "벽지"],
          ["supplies", "부자재"],
          ["flooring", "장판"],
          ["labor", "공임"],
          ["catalog", "카탈로그"],
        ].map(([value, label]) => (
          <button type="button" className={dataTab === value ? "active" : ""} onClick={() => setDataTab(value as DataTab)} key={value}>
            {label}
          </button>
        ))}
      </div>

      {dataTab === "wallpaper" && (
        <section className="table-wrap">
        <div className="section-heading">
          <h2>벽지 가격</h2>
          <div className="button-row">
            <button type="button" className="primary-action compact-action" onClick={saveMaterials} disabled={!materialDirty}>
              <Save aria-hidden />
              변경사항 저장
            </button>
            <button type="button" className="inline-command" onClick={addMaterialDraft}>
              <Plus aria-hidden />
              벽지 추가
            </button>
          </div>
        </div>
        <table className="data-table wallpaper-table">
          <colgroup>
            <col className="col-index" />
            <col className="col-brand" />
            <col className="col-product" />
            <col className="col-category" />
            <col className="col-unit" />
            <col className="col-price" />
            <col className="col-cost" />
            <col className="col-supplies" />
            <col className="col-status" />
          </colgroup>
          <thead>
            <tr>
              <th>순번</th>
              <th>브랜드</th>
              <th>제품</th>
              <th>종류</th>
              <th className="numeric">구매단위 (평)</th>
              <th className="numeric">소매 단가</th>
              <th className="numeric">원가 단가</th>
              <th className="numeric">부자재</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {materialDrafts.map((material, index) => (
              <tr key={material.id ?? index}>
                <td className="center">{index + 1}</td>
                <td>
                  <input value={material.brand ?? ""} onChange={(event) => updateMaterialDraft(index, { brand: event.target.value || null })} />
                </td>
                <td>
                  <input value={material.name ?? ""} onChange={(event) => updateMaterialDraft(index, { name: event.target.value })} />
                </td>
                <td>
                  <select
                    value={material.category ?? ""}
                    onChange={(event) => updateMaterialDraft(index, { category: event.target.value as Material["category"] })}
                  >
                    <option value="">선택</option>
                    <option value="silk">실크</option>
                    <option value="narrow_hapji">소폭 합지</option>
                    <option value="wide_hapji">광폭 합지</option>
                  </select>
                </td>
                <td className="numeric">
                  <FormattedNumberCell
                    value={material.purchase_unit_pyeong}
                    onCommit={(value) => updateMaterialDraft(index, { purchase_unit_pyeong: value })}
                    ariaLabel="구매단위"
                  />
                </td>
                <td className="numeric">
                  <FormattedNumberCell value={material.retail_krw} onCommit={(value) => updateMaterialDraft(index, { retail_krw: value })} ariaLabel="소매 단가" />
                </td>
                <td className="numeric">
                  <FormattedNumberCell value={material.wholesale_krw} onCommit={(value) => updateMaterialDraft(index, { wholesale_krw: value })} ariaLabel="원가 단가" />
                </td>
                <td className="numeric">
                  <FormattedNumberCell
                    value={material.supplies_krw_per_actual_pyeong}
                    onCommit={(value) => updateMaterialDraft(index, { supplies_krw_per_actual_pyeong: value })}
                    ariaLabel="부자재"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="icon-command"
                    title={material.active === false ? "활성" : "비활성"}
                    onClick={() => updateMaterialDraft(index, { active: material.active === false })}
                  >
                    {material.active === false ? <RotateCcw aria-hidden /> : <Trash2 aria-hidden />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      )}

      {dataTab === "supplies" && (
        <section className="table-wrap">
          <div className="section-heading">
            <h2>부자재 기준</h2>
            <div className="button-row">
              <button type="button" className="primary-action compact-action" onClick={saveMaterials} disabled={!materialDirty}>
                <Save aria-hidden />
                변경사항 저장
              </button>
              <button type="button" className="inline-command" onClick={addMaterialDraft}>
                <Plus aria-hidden />
                부자재 항목 추가
              </button>
            </div>
          </div>
          <table className="data-table supplies-table">
            <colgroup>
              <col className="col-index" />
              <col className="col-product" />
              <col className="col-brand" />
              <col className="col-category" />
              <col className="col-price" />
              <col className="col-check" />
            </colgroup>
            <thead>
              <tr>
                <th>순번</th>
                <th>제품</th>
                <th>브랜드</th>
                <th>종류</th>
                <th className="numeric">실사용 평당 부자재</th>
                <th>소매가 포함</th>
              </tr>
            </thead>
            <tbody>
              {materialDrafts.map((material, index) => (
                <tr key={material.id ?? index}>
                  <td className="center">{index + 1}</td>
                  <td>
                    <input value={material.name ?? ""} onChange={(event) => updateMaterialDraft(index, { name: event.target.value || null })} />
                  </td>
                  <td>
                    <input value={material.brand ?? ""} onChange={(event) => updateMaterialDraft(index, { brand: event.target.value || null })} />
                  </td>
                  <td>
                    <select
                      value={material.category ?? ""}
                      onChange={(event) => updateMaterialDraft(index, { category: event.target.value as Material["category"] })}
                    >
                      <option value="">선택</option>
                      <option value="silk">실크</option>
                      <option value="narrow_hapji">소폭 합지</option>
                      <option value="wide_hapji">광폭 합지</option>
                    </select>
                  </td>
                  <td className="numeric">
                    <FormattedNumberCell
                      value={material.supplies_krw_per_actual_pyeong}
                      onCommit={(value) => updateMaterialDraft(index, { supplies_krw_per_actual_pyeong: value })}
                      ariaLabel="실사용 평당 부자재"
                    />
                  </td>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={Boolean(material.supplies_included_in_retail)}
                      onChange={(event) => updateMaterialDraft(index, { supplies_included_in_retail: event.target.checked })}
                      aria-label={`${material.name} 소매가 포함 여부`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {dataTab === "flooring" && (
        <section className="table-wrap">
          <div className="section-heading">
            <h2>장판 가격</h2>
            <div className="button-row">
              <button type="button" className="primary-action compact-action" onClick={saveFlooring} disabled={!flooringDirty}>
                <Save aria-hidden />
                변경사항 저장
              </button>
              <button type="button" className="inline-command" onClick={addFlooringDraft}>
                <Plus aria-hidden />
                장판 추가
              </button>
            </div>
          </div>
          <table className="data-table flooring-table">
            <colgroup>
              <col className="col-index" />
              <col className="col-thickness" />
              <col className="col-brand" />
              <col className="col-product" />
              <col className="col-unit" />
              <col className="col-price" />
              <col className="col-cost" />
              <col className="col-supplies" />
            </colgroup>
            <thead>
              <tr>
                <th>순번</th>
                <th>두께</th>
                <th>브랜드</th>
                <th>제품명</th>
                <th className="numeric">구매단위 (평)</th>
                <th className="numeric">소매 단가</th>
                <th className="numeric">원가 단가</th>
                <th className="numeric">부자재</th>
              </tr>
            </thead>
            <tbody>
              {flooringDrafts.map((flooring, index) => (
                <tr key={flooring.id ?? flooring.thickness}>
                  <td className="center">{index + 1}</td>
                  <td>
                    <input value={flooring.thickness} onChange={(event) => updateFlooringDraft(index, { thickness: event.target.value })} />
                  </td>
                  <td>
                    <input value={flooring.brand ?? ""} onChange={(event) => updateFlooringDraft(index, { brand: event.target.value || null })} />
                  </td>
                  <td>
                    <input value={flooring.name ?? ""} onChange={(event) => updateFlooringDraft(index, { name: event.target.value || null })} />
                  </td>
                  <td className="numeric">
                    <FormattedNumberCell value={flooring.purchase_unit_pyeong} onCommit={(value) => updateFlooringDraft(index, { purchase_unit_pyeong: value })} ariaLabel="구매단위" />
                  </td>
                  <td className="numeric">
                    <FormattedNumberCell value={flooring.retail_krw} onCommit={(value) => updateFlooringDraft(index, { retail_krw: value })} ariaLabel="소매 단가" />
                  </td>
                  <td className="numeric">
                    <FormattedNumberCell value={flooring.wholesale_krw} onCommit={(value) => updateFlooringDraft(index, { wholesale_krw: value })} ariaLabel="원가 단가" />
                  </td>
                  <td className="numeric">
                    <FormattedNumberCell
                      value={flooring.supplies_krw_per_actual_pyeong}
                      onCommit={(value) => updateFlooringDraft(index, { supplies_krw_per_actual_pyeong: value })}
                      ariaLabel="부자재"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {dataTab === "labor" && (
        <section className="table-wrap">
          <div className="section-heading">
            <h2>공임</h2>
            <div className="button-row">
              <button type="button" className="primary-action compact-action" onClick={saveLabor} disabled={!laborDirty}>
                <Save aria-hidden />
                변경사항 저장
              </button>
              <button type="button" className="inline-command" onClick={addLaborCrewRule}>
                <Plus aria-hidden />
                인원 기준 추가
              </button>
            </div>
          </div>
          <div className="rate-grid">
            {(["helper", "intermediate", "expert"] as LaborGrade[]).map((grade) => (
              <label key={grade}>
                {gradeLabel(grade)}
                <FormattedNumberCell value={laborRateDrafts[grade]} onCommit={(value) => updateLaborRateDraft(grade, value ?? 0)} ariaLabel={`${gradeLabel(grade)} 일당`} />
              </label>
            ))}
          </div>
          <table className="data-table labor-table">
            <colgroup>
              <col className="col-index" />
              <col className="col-category" />
              <col className="col-area-type" />
              <col className="col-area" />
              <col className="col-crew" />
              <col className="col-crew" />
              <col className="col-crew" />
            </colgroup>
            <thead>
              <tr>
                <th>순번</th>
                <th>종류</th>
                <th>면적 타입</th>
                <th className="numeric">면적</th>
                <th className="numeric">조공</th>
                <th className="numeric">중기공</th>
                <th className="numeric">기공</th>
              </tr>
            </thead>
            <tbody>
              {laborRows.map(({ record, recordIndex, area, crew }, rowIndex) => (
                  <tr key={`${recordIndex}-${record.category}-${area}`}>
                    <td className="center">{rowIndex + 1}</td>
                    <td>
                      <select
                        value={record.category ?? ""}
                        onChange={(event) => updateLaborRecordDraft(recordIndex, { category: event.target.value as Material["category"] })}
                      >
                        <option value="">선택</option>
                        <option value="silk">실크</option>
                        <option value="narrow_hapji">소폭 합지</option>
                        <option value="wide_hapji">광폭 합지</option>
                      </select>
                    </td>
                    <td>
                      <select
                        value={record.area_type ?? ""}
                        onChange={(event) => updateLaborRecordDraft(recordIndex, { area_type: event.target.value as AreaType })}
                      >
                        <option value="">선택</option>
                        <option value="평형">평형</option>
                        <option value="전용">전용</option>
                      </select>
                    </td>
                    <td className="numeric">
                      <FormattedNumberCell value={area ? Number(area) : null} onCommit={(value) => updateLaborAreaDraft(recordIndex, area, value == null ? "" : String(value))} ariaLabel="면적" />
                    </td>
                    <td className="numeric">
                      <FormattedNumberCell value={crew?.helper ?? null} onCommit={(value) => updateLaborCrewDraft(recordIndex, area, { helper: value })} ariaLabel="조공" />
                    </td>
                    <td className="numeric">
                      <FormattedNumberCell value={crew?.intermediate ?? null} onCommit={(value) => updateLaborCrewDraft(recordIndex, area, { intermediate: value })} ariaLabel="중기공" />
                    </td>
                    <td className="numeric">
                      <FormattedNumberCell value={crew?.expert ?? null} onCommit={(value) => updateLaborCrewDraft(recordIndex, area, { expert: value })} ariaLabel="기공" />
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {dataTab === "catalog" && (
      <section className="table-wrap">
        <div className="section-heading">
          <h2>카탈로그 링크</h2>
          <div className="button-row">
            <button type="button" className="primary-action compact-action" onClick={saveCatalogs} disabled={!catalogDirty}>
              <Save aria-hidden />
              변경사항 저장
            </button>
            <button type="button" className="inline-command" onClick={addCatalogDraft}>
              <Plus aria-hidden />
              추가
            </button>
          </div>
        </div>
        <table className="data-table catalog-table">
          <colgroup>
            <col className="col-index" />
            <col className="col-name" />
            <col className="col-brand" />
            <col className="col-product" />
            <col className="col-url" />
            <col className="col-status" />
          </colgroup>
          <thead>
            <tr>
              <th>순번</th>
              <th>이름</th>
              <th>브랜드</th>
              <th>제품 연결</th>
              <th>URL</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {catalogDrafts.map((catalog, index) => (
              <tr key={catalog.id}>
                <td className="center">{index + 1}</td>
                <td>
                  <input value={catalog.name} onChange={(event) => updateCatalogDraft(index, { name: event.target.value })} />
                </td>
                <td>
                  <input value={catalog.brand ?? ""} onChange={(event) => updateCatalogDraft(index, { brand: event.target.value || null })} />
                </td>
                <td>
                  <select
                    value={catalog.product_relation ?? ""}
                    onChange={(event) => updateCatalogDraft(index, { product_relation: event.target.value || null })}
                  >
                    <option value="">브랜드 기준</option>
                    {state.rules.materials.map((material) => (
                      <option value={material.id ?? ""} key={material.id}>
                        {material.brand} / {material.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input value={catalog.url} onChange={(event) => updateCatalogDraft(index, { url: event.target.value })} />
                </td>
                <td>
                  <button
                    type="button"
                    className="icon-command"
                    title={catalog.active === false ? "활성" : "비활성"}
                    onClick={() => updateCatalogDraft(index, { active: catalog.active === false })}
                  >
                    {catalog.active === false ? <RotateCcw aria-hidden /> : <Trash2 aria-hidden />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      )}
    </div>
  );
}

function Backup({ state, persist }: { state: StoredState; persist: (next: StoredState) => Promise<void> }) {
  const [message, setMessage] = useState("");

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `wallpaper-estimate-backup-${todayKst()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text);
    const importedState: StoredState = parsed.rules ? parsed : { ...state, rules: parsed };
    const next = addAuditEvent(importedState, {
      action: "import",
      entity: "rules",
      before: state.rules.dataset_version,
      after: importedState.rules.dataset_version,
      reason: "JSON 가져오기",
    });
    await persist(next);
    setMessage("가져오기를 완료했습니다. 원가 포함 파일은 공개 저장소에 올리지 마세요.");
  };

  const exportMaterialsCsv = () => {
    const header = [
      "id",
      "category",
      "brand",
      "name",
      "purchase_unit_pyeong",
      "unit_label",
      "retail_krw",
      "wholesale_krw",
      "supplies_krw_per_actual_pyeong",
      "active",
    ];
    const rows = state.rules.materials.map((material) =>
      [
        material.id,
        material.category,
        material.brand,
        material.name,
        material.purchase_unit_pyeong,
        material.unit_label,
        material.retail_krw,
        material.wholesale_krw ?? "",
        material.supplies_krw_per_actual_pyeong,
        material.active !== false,
      ]
        .map(csvEscape)
        .join(","),
    );
    downloadText(`materials-${todayKst()}.csv`, [header.join(","), ...rows].join("\n"), "text/csv;charset=utf-8");
  };

  const importMaterialsCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const rows = (await file.text()).trim().split(/\r?\n/).map(parseCsvLine);
    const [header, ...body] = rows;
    const materials = body.map((row) => {
      const record = Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""]));
      return {
        id: record.id || `LOCAL_MATERIAL_${crypto.randomUUID()}`,
        category: record.category as Material["category"],
        brand: record.brand || null,
        name: record.name || null,
        purchase_unit_pyeong: Number(record.purchase_unit_pyeong),
        unit_label: record.unit_label || null,
        retail_krw: Number(record.retail_krw),
        wholesale_krw: record.wholesale_krw ? Number(record.wholesale_krw) : undefined,
        supplies_krw_per_actual_pyeong: Number(record.supplies_krw_per_actual_pyeong),
        active: record.active !== "false",
      } satisfies Material;
    });
    const nextRules = { ...state.rules, materials, dataset_version: bumpVersion(state.rules.dataset_version) };
    const next = addAuditEvent(
      { ...state, rules: nextRules },
      { action: "import_csv", entity: "materials", before: state.rules.materials.length, after: materials.length },
    );
    await persist(next);
    setMessage("제품 가격 CSV를 가져왔습니다.");
  };

  const restorePublic = async () => {
    const nextState = await resetState();
    await persist(nextState);
    setMessage("공개 소매 기준 데이터로 초기화했습니다.");
  };

  return (
    <div className="admin-stack">
      <section className="editor-band">
        <h2>JSON 내보내기·가져오기</h2>
        <p>비공개 원가 자료를 가져오면 이 브라우저 IndexedDB에만 저장됩니다. 공개 빌드에는 포함하지 않습니다.</p>
        <div className="button-row">
          <button type="button" className="primary-action" onClick={exportJson}>
            <ArrowDownToLine aria-hidden />
            JSON 내보내기
          </button>
          <label className="file-button">
            <ArrowUpFromLine aria-hidden />
            JSON 가져오기
            <input type="file" accept="application/json" onChange={importJson} />
          </label>
          <button type="button" className="secondary-action" onClick={exportMaterialsCsv}>
            <ArrowDownToLine aria-hidden />
            제품 CSV 내보내기
          </button>
          <label className="file-button">
            <ArrowUpFromLine aria-hidden />
            제품 CSV 가져오기
            <input type="file" accept=".csv,text/csv" onChange={importMaterialsCsv} />
          </label>
          <button type="button" className="secondary-action" onClick={restorePublic}>
            <RotateCcw aria-hidden />
            공개 기준 초기화
          </button>
        </div>
        {message && <p className="success-text">{message}</p>}
      </section>
      <section className="editor-band">
        <h2>설정</h2>
        <SettingsEditor state={state} persist={persist} />
      </section>
    </div>
  );
}

function SettingsEditor({ state, persist }: { state: StoredState; persist: (next: StoredState) => Promise<void> }) {
  const [settings, setSettings] = useState(state.settings);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = addAuditEvent(
      { ...state, settings },
      { action: "update", entity: "settings", before: state.settings, after: settings },
    );
    await persist(next);
  };
  return (
    <form className="settings-form" onSubmit={submit}>
      <label>
        상호
        <input value={settings.shopName} onChange={(event) => setSettings({ ...settings, shopName: event.target.value })} />
      </label>
      <label>
        고객 문의 연락처
        <input value={settings.contactText} onChange={(event) => setSettings({ ...settings, contactText: event.target.value })} />
      </label>
      <label>
        로컬 사용자 이름
        <input value={settings.managerName} onChange={(event) => setSettings({ ...settings, managerName: event.target.value })} />
      </label>
      <button type="submit" className="primary-action">
        <Save aria-hidden />
        저장
      </button>
    </form>
  );
}

function QuoteHistory({ state, persist }: { state: StoredState; persist: (next: StoredState) => Promise<void> }) {
  const [selected, setSelected] = useState<StoredState["quotes"][number] | null>(null);
  const summaries = state.quotes.map((snapshot) => quoteSummaryRow(snapshot, state.rules));
  const deleteQuote = async (snapshot: StoredState["quotes"][number]) => {
    const next = addAuditEvent(
      { ...state, quotes: state.quotes.filter((quoteItem) => quoteItem.id !== snapshot.id) },
      { action: "delete", entity: `quote:${snapshot.id}`, before: snapshot, after: null },
    );
    setSelected(null);
    await persist(next);
  };

  return (
    <>
      <section className="table-wrap quote-sheet">
        <div className="section-heading">
          <h2>견적 이력</h2>
          <span className="sheet-count">{state.quotes.length}건</span>
        </div>
        {summaries.length ? (
          <table>
            <thead>
              <tr>
                <th>문의일자</th>
                <th>고객 전화번호</th>
                <th>견적 요약</th>
                <th>시공 주소</th>
                <th>선호 시공일</th>
                <th>견적금액</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((row) => (
                <tr className="clickable-row" key={row.id} onClick={() => setSelected(row.snapshot)}>
                  <td>{row.inquiryDate}</td>
                  <td>{row.customerPhone}</td>
                  <td>{row.summary}</td>
                  <td>{row.siteAddress}</td>
                  <td>{row.preferredDates}</td>
                  <td>{row.amount}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-sheet">
            <strong>저장된 견적이 없습니다.</strong>
            <p>견적 계산 화면에서 결과를 저장하면 문의 정보와 상세 견적서가 함께 표시됩니다.</p>
          </div>
        )}
      </section>

      {selected && <QuoteDetailModal snapshot={selected} onClose={() => setSelected(null)} onDelete={() => deleteQuote(selected)} />}
    </>
  );
}

function QuoteDetailModal({
  snapshot,
  onClose,
  onDelete,
}: {
  snapshot: StoredState["quotes"][number];
  onClose: () => void;
  onDelete: () => void;
}) {
  const rows = quoteSnapshotRows(snapshot);
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="quote-modal" role="dialog" aria-modal="true" aria-labelledby="quote-detail-title" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">견적 상세</p>
            <h2 id="quote-detail-title">{snapshot.id}</h2>
          </div>
          <div className="button-row">
            <button type="button" className="secondary-action danger-action" onClick={onDelete}>
              <Trash2 aria-hidden />
              삭제
            </button>
            <button type="button" className="icon-command" onClick={onClose} aria-label="닫기">
              ×
            </button>
          </div>
        </div>
        <div className="quote-meta-grid">
          <span>문의일자 <strong>{snapshot.inquiryDate || new Date(snapshot.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</strong></span>
          <span>고객 전화번호 <strong>{snapshot.customerPhone || "-"}</strong></span>
          <span>시공 주소 <strong>{snapshot.siteAddress || "-"}</strong></span>
          <span>선호일 <strong>{formatPreferredDates(snapshot.preferredDates)}</strong></span>
        </div>
        {snapshot.memo && <p className="quote-memo">{snapshot.memo}</p>}
        <div className="table-wrap quote-sheet">
          <table>
            <thead>
              <tr>
                <th>품목</th>
                <th>규격</th>
                <th>수량</th>
                <th>단가</th>
                <th>금액</th>
                <th>합계</th>
                <th>상태</th>
                <th>부가세</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.item}</td>
                  <td>{row.spec}</td>
                  <td>{row.qty}</td>
                  <td>{row.unitPrice}</td>
                  <td>{row.amount}</td>
                  <td>{row.total}</td>
                  <td>{row.status}</td>
                  <td>{row.vat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function History({ events }: { events: StoredState["history"] }) {
  return (
    <section className="table-wrap">
      <h2>변경 이력</h2>
      <table>
        <thead>
          <tr>
            <th>일시</th>
            <th>사용자</th>
            <th>작업</th>
            <th>대상</th>
            <th>버전</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>{new Date(event.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</td>
              <td>{event.actor}</td>
              <td>{event.action}</td>
              <td>{event.entity}</td>
              <td>{event.version}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function FormattedNumberCell({
  value,
  onCommit,
  ariaLabel,
}: {
  value: number | null | undefined;
  onCommit: (value: number | null) => void;
  ariaLabel: string;
}) {
  return (
    <input
      className="numeric-input"
      inputMode="numeric"
      value={formatNumberInput(value)}
      onChange={(event) => onCommit(parseNumberInput(event.target.value))}
      aria-label={ariaLabel}
    />
  );
}

function formatNumberInput(value: number | null | undefined) {
  return value == null ? "" : value.toLocaleString("ko-KR");
}

function parseNumberInput(value: string) {
  const normalized = value.replace(/[^\d]/g, "");
  return normalized ? Number(normalized) : null;
}

function openDatePicker(input: HTMLInputElement | null) {
  input?.showPicker?.();
}

function Step({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`form-step ${className}`.trim()}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

type AppRoute = "/" | "/admin";
type CatalogFilter = { materialId: string | null; brand: string | null; label: string };
type DataTab = "wallpaper" | "supplies" | "flooring" | "labor" | "catalog";
type ProductPickerOption = {
  kind: "wallpaper" | "flooring";
  value: string;
  group: string;
  title: string;
  subtitle: string;
};
type AdminQuoteInfo = {
  inquiryDate: string;
  customerPhone: string;
  siteAddress: string;
  preferredDates: string[];
  memo: string;
};

function readRoute(): AppRoute {
  const redirectedPath = new URLSearchParams(window.location.search).get("spa");
  if (redirectedPath?.startsWith("/")) {
    window.history.replaceState(null, "", redirectedPath);
  }

  const path = stripBase(window.location.pathname).replace(/\/$/, "") || "/";
  if (path === "/admin") return "/admin";
  return "/";
}

function pathForRoute(route: AppRoute) {
  const base = normalizedBase();
  return route === "/" ? base : `${base.replace(/\/$/, "")}${route}`;
}

function stripBase(pathname: string) {
  const base = normalizedBase().replace(/\/$/, "");
  if (base && base !== "/" && pathname.startsWith(base)) {
    return pathname.slice(base.length) || "/";
  }
  return pathname;
}

function normalizedBase() {
  return import.meta.env.BASE_URL || "/";
}

function bumpVersion(version: string) {
  return `${version}-local-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
}

function catalogMatchesMaterial(catalog: Catalog, material: Material) {
  if (catalog.active === false) return false;
  if (catalog.product_relation) return catalog.product_relation === material.id;
  return Boolean(catalog.brand && material.brand && catalog.brand === material.brand);
}

function formatPreferredDates(dates: string[]) {
  const validDates = dates.filter(Boolean);
  return validDates.length ? validDates.map((date, index) => `${index + 1}순위 ${date}`).join(", ") : "미입력";
}

function gradeLabel(grade: LaborGrade) {
  return { helper: "조공 일당", intermediate: "중기공 일당", expert: "기공 일당" }[grade];
}

function quoteSummaryRow(snapshot: StoredState["quotes"][number], rules: QuoteRules) {
  const materialName = rules.materials.find((material) => material.id === snapshot.input.material_id)?.name ?? "벽지 미선택";
  const flooring = snapshot.input.include_flooring ? `장판 ${snapshot.input.flooring_thickness}` : "장판 미포함";
  const inquiryDate =
    snapshot.inquiryDate || new Date(snapshot.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }).replace(/\. /g, "-").replace(".", "");
  return {
    id: snapshot.id,
    snapshot,
    inquiryDate,
    customerPhone: snapshot.customerPhone || "-",
    siteAddress: snapshot.siteAddress || "-",
    preferredDates: formatPreferredDates(snapshot.preferredDates),
    summary: `${snapshot.input.building_type} ${snapshot.input.area_type} ${snapshot.input.area_pyeong}평 / ${materialName} / ${flooring}`,
    amount: snapshot.result.status === "quoted" ? krw(snapshot.result.amount_krw) : "확인 필요",
    status: snapshot.result.status === "quoted" ? "산출" : "확인 필요",
  };
}

function quoteSnapshotRows(snapshot: StoredState["quotes"][number]) {
  const createdAt = new Date(snapshot.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const site = `${snapshot.input.building_type} / ${snapshot.input.area_type} ${snapshot.input.area_pyeong}평`;
  const base = {
    quoteId: snapshot.id,
    createdAt,
    site,
    total: krw(snapshot.result.amount_krw),
    status: snapshot.result.status === "quoted" ? "산출" : "확인 필요",
    vat: "미확정",
  };

  if (!snapshot.result.calculation) {
    return [
      {
        ...base,
        key: `${snapshot.id}-missing`,
        item: "미등록 항목",
        spec: snapshot.result.missing_fields.map((issue) => issue.code).join(", "),
        qty: "-",
        unitPrice: "-",
        amount: "-",
      },
    ];
  }

  const calculation = snapshot.result.calculation;
  return [
    {
      ...base,
      key: `${snapshot.id}-material`,
      item: "벽지",
      spec: calculation.material_unit_label,
      qty: `${calculation.purchase_units}`,
      unitPrice: krw(calculation.material_retail_krw / calculation.purchase_units),
      amount: krw(calculation.material_retail_krw),
    },
    {
      ...base,
      key: `${snapshot.id}-supplies`,
      item: "부자재",
      spec: `실사용 ${calculation.actual_usage_pyeong}평`,
      qty: `${calculation.actual_usage_pyeong}`,
      unitPrice: calculation.actual_usage_pyeong ? krw(calculation.supplies_krw / calculation.actual_usage_pyeong) : "-",
      amount: krw(calculation.supplies_krw),
    },
    {
      ...base,
      key: `${snapshot.id}-labor`,
      item: "공임",
      spec: `조공 ${calculation.labor_crew.helper}, 중기공 ${calculation.labor_crew.intermediate}, 기공 ${calculation.labor_crew.expert}`,
      qty: "1식",
      unitPrice: krw(calculation.labor_krw),
      amount: krw(calculation.labor_krw),
    },
  ];
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
