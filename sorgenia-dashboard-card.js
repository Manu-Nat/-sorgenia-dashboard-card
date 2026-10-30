/* Sorgenia Dashboard Card — dependency-free Lovelace card. */
const DEFAULT_ENTITIES = {
  bills: "sensor.bill_count",
  totalDue: "sensor.total_remaining_due",
  latestElectricityBill: "sensor.latest_electricity_bill_amount",
  latestGasBill: "sensor.latest_gas_bill_amount",
  electricityDue: "sensor.electricity_remaining_due",
  gasDue: "sensor.gas_remaining_due",
  electricityDueDate: "sensor.latest_electricity_bill_due_date",
  gasDueDate: "sensor.latest_gas_bill_due_date",
  electricityStatus: "sensor.latest_electricity_bill_status",
  gasStatus: "sensor.latest_gas_bill_status",
  electricityBilledLatest: "sensor.latest_electricity_billed_consumption",
  electricityBilledTotal: "sensor.electricity_billed_consumption_total",
  electricityBilledMonths: "sensor.electricity_billed_consumption_months",
  electricityCurveLatest: "sensor.latest_curve_monthly_consumption",
  electricityCurveTotal: "sensor.sorgenia_curve_consumption_total",
  electricityBands: [
    "sensor.latest_consumption_band_1",
    "sensor.latest_consumption_band_2",
    "sensor.latest_consumption_band_3",
  ],
  electricityPeak: "sensor.latest_monthly_peak_power",
  gasBilledLatest: "sensor.latest_gas_consumption",
  gasBilledTotal: "sensor.gas_consumption_total_for_period",
  gasBilledMonths: "sensor.gas_consumption_months",
  gasCurveLatest: "sensor.latest_gas_monthly_consumption_curve",
  gasCurveTotal: "sensor.gas_curve_consumption_total",
  gasMeter: "sensor.gas_meter_reading",
  gasMeterDate: "sensor.gas_meter_reading_date",
  electricityCosts: "sensor.latest_electricity_bill_cost_breakdown",
  gasCosts: "sensor.latest_gas_bill_cost_breakdown",
  electricityUnitCost: "sensor.latest_electricity_all_in_unit_cost",
  gasUnitCost: "sensor.latest_gas_all_in_unit_cost",
};

const COST_LABELS = {
  spesaMateriaEnergia: "Materia energia",
  spesaTrasporto: "Trasporto e gestione",
  spesaOneri: "Oneri di sistema",
  ivaImposte: "IVA e imposte",
  canoneRai: "Canone TV",
  altrePartite: "Altre voci",
  ricalcoli: "Ricalcoli",
  bonusSociale: "Bonus sociale",
  canoneFibra: "Canone fibra",
  scontoFibra: "Sconto fibra",
  altrePartiteFibra: "Altre voci fibra",
  ricalcoliFibra: "Ricalcoli fibra",
};

const fmt = (value, digits = 1) => {
  const n = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(n);
};

const money = (value) => (value === "unknown" || value === "unavailable" || value == null ? "—" : `${fmt(value, 2)} €`);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

function prettyDate(value) {
  if (!value) return "—";
  const text = String(value);
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return text;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function stateValue(hass, entity) {
  return entity ? hass?.states?.[entity] : undefined;
}

function stateText(hass, entity, unit = "") {
  const state = stateValue(hass, entity)?.state;
  if (state == null || state === "unknown" || state === "unavailable") return "—";
  return `${state}${unit ? ` ${unit}` : ""}`;
}

function amountValue(hass, entity) {
  const state = stateValue(hass, entity)?.state;
  return state == null || state === "unknown" || state === "unavailable" ? null : Number(String(state).replace(",", "."));
}

function periodText(start, end) {
  if (!start && !end) return "Periodo non indicato";
  return `${prettyDate(start)} – ${prettyDate(end)}`;
}

class SorgeniaDashboardCard extends HTMLElement {
  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Configurazione della card Sorgenia non valida");
    this._config = config;
    this._entities = { ...DEFAULT_ENTITIES, ...(config.entities || {}) };
    this._title = config.title || "Sorgenia";
    this._maxBills = Math.max(1, Math.min(20, Number(config.max_bills || 10)));
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 14;
  }

  static getStubConfig() {
    return { title: "Sorgenia" };
  }

  _get(key) {
    return stateValue(this._hass, this._entities[key]);
  }

  _value(key, unit = "") {
    return stateText(this._hass, this._entities[key], unit);
  }

  _render() {
    if (!this._hass || !this._config) return;
    const e = this._entities;
    const billsState = this._get("bills");
    const bills = Array.isArray(billsState?.attributes?.bills) ? billsState.attributes.bills : [];
    const sortedBills = [...bills].sort((a, b) => this._dateKey(b.issueDate) - this._dateKey(a.issueDate));
    const electricityCurve = this._get("electricityCurveTotal")?.attributes?.curve_consumption_history || [];
    const gasCurveState = this._get("gasCurveTotal");
    const gasCurve = gasCurveState?.attributes?.curve_consumption_history || [];
    const electricityCosts = this._get("electricityCosts")?.attributes || {};
    const gasCosts = this._get("gasCosts")?.attributes || {};
    const totalDue = amountValue(this._hass, e.totalDue);
    const dueCount = bills.filter((bill) => bill.statusCode && bill.statusCode !== "PAID").length;
    const lastUpdated = billsState?.last_changed ? new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(billsState.last_changed)) : "";

    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <main class="shell">
        <header class="hero">
          <div class="brand"><div class="brandmark"><ha-icon icon="mdi:lightning-bolt"></ha-icon></div><div><div class="eyebrow">AREA ENERGIA</div><h1>${esc(this._title)}</h1><div class="subline">Luce e gas · aggiornamento ${esc(lastUpdated || "disponibile")}</div></div></div>
          <div class="due-pill"><span class="pulse"></span>${dueCount ? `${dueCount} bollette da saldare` : "Situazione aggiornata"}</div>
        </header>

        <section class="summary-grid">
          ${this._metric("Da pagare", money(totalDue), `${dueCount} bollette in addebito`, "mdi:wallet-outline", "accent")}
          ${this._metric("Ultima bolletta luce", money(amountValue(this._hass, e.latestElectricityBill)), `Scadenza ${this._value("electricityStatus") === "—" ? "—" : prettyDate(this._dueDate("electricityDueDate"))}`, "mdi:flash-outline")}
          ${this._metric("Ultima bolletta gas", money(amountValue(this._hass, e.latestGasBill)), `Scadenza ${prettyDate(this._dueDate("gasDueDate"))}`, "mdi:fire")}
        </section>

        <section class="section">
          <div class="section-title"><div><span class="eyebrow">RIEPILOGO FORNITURE</span><h2>Le tue bollette</h2></div><span class="section-note">${bills.length} fatture disponibili</span></div>
          <div class="supply-grid">
            ${this._supplyCard("Luce", "mdi:flash", e.latestElectricityBill, e.electricityStatus, e.electricityDue, e.electricityBilledLatest, "kWh", electricityCosts, e.electricityUnitCost)}
            ${this._supplyCard("Gas", "mdi:fire", e.latestGasBill, e.gasStatus, e.gasDue, e.gasBilledLatest, "m³", gasCosts, e.gasUnitCost)}
          </div>
        </section>

        <section class="section">
          <div class="section-title"><div><span class="eyebrow">FATTURE</span><h2>Storico bollette</h2></div><span class="section-note">Più recenti in alto</span></div>
          ${this._renderBills(sortedBills.slice(0, this._maxBills))}
        </section>

        <section class="section">
          <div class="section-title"><div><span class="eyebrow">ANDAMENTO</span><h2>Consumi</h2></div><span class="section-note">Bolletta e curve di misura</span></div>
          <div class="consumption-grid">
            ${this._consumptionCard("Luce", "mdi:flash", this._value("electricityBilledLatest", "kWh"), this._value("electricityCurveLatest", "kWh"), this._value("electricityBilledTotal", "kWh"), electricityCurve, "kWh", true)}
            ${this._consumptionCard("Gas", "mdi:fire", this._value("gasBilledLatest", "m³"), this._value("gasCurveLatest", "m³"), this._value("gasBilledTotal", "m³"), gasCurve, "m³", false)}
          </div>
        </section>

        <section class="section meter-section">
          <div class="section-title"><div><span class="eyebrow">LETTURE</span><h2>Contatore gas</h2></div><span class="section-note">Lettura comunicata da Sorgenia</span></div>
          <div class="meter-card">
            <div class="meter-icon"><ha-icon icon="mdi:meter-gas"></ha-icon></div>
            <div class="meter-reading"><strong>${esc(this._value("gasMeter", "m³"))}</strong><span>lettura</span></div>
            <div class="meter-date"><span>Data lettura</span><strong>${esc(prettyDate(this._get("gasMeterDate")?.state))}</strong></div>
            ${this._get("gasMeter")?.attributes?.endpoint_error ? `<div class="inline-error">Lettura non disponibile: ${esc(this._get("gasMeter").attributes.endpoint_error)}</div>` : ""}
          </div>
        </section>

        <footer>Valori forniti dai servizi Sorgenia e aggiornati da Home Assistant.</footer>
      </main>`;
  }

  _dueDate(key) {
    const state = this._get(key)?.state;
    return state == null || state === "unknown" || state === "unavailable" ? undefined : state;
  }

  _dateKey(value) {
    const text = String(value || "");
    const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
    const parsed = new Date(text).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  _metric(label, value, detail, icon, className = "") {
    return `<article class="metric ${className}"><div class="metric-top"><span>${esc(label)}</span><ha-icon icon="${icon}"></ha-icon></div><strong>${esc(value)}</strong><small>${esc(detail)}</small></article>`;
  }

  _supplyCard(name, icon, amountEntity, statusEntity, dueEntity, consumptionEntity, unit, costs, unitCostEntity) {
    const amount = money(amountValue(this._hass, amountEntity));
    const status = stateText(this._hass, statusEntity);
    const dueDate = this._dueDate(name === "Luce" ? "electricityDueDate" : "gasDueDate");
    const consumption = stateText(this._hass, consumptionEntity, unit);
    const costRows = Object.entries(COST_LABELS)
      .filter(([key]) => costs[key] !== undefined && Number(costs[key]) !== 0)
      .map(([key, label]) => `<div class="cost-row"><span>${esc(label)}</span><strong>${esc(money(costs[key]))}</strong></div>`)
      .join("");
    const costError = costs.endpoint_error ? `<div class="inline-error">Dettaglio costi non disponibile: ${esc(costs.endpoint_error)}</div>` : "";
    const code = status.toLowerCase().includes("pagat") ? "paid" : "charging";
    const unitCost = this._value(name === "Luce" ? "electricityUnitCost" : "gasUnitCost", name === "Luce" ? "€/kWh" : "€/m³");
    return `<article class="supply-card">
      <div class="supply-head"><div class="supply-name"><div class="supply-icon ${name === "Gas" ? "gas" : "electric"}"><ha-icon icon="${icon}"></ha-icon></div><div><span class="eyebrow">FORNITURA</span><h3>${name}</h3></div></div><span class="status ${code}">${esc(status)}</span></div>
      <div class="supply-amount"><strong>${esc(amount)}</strong><span>ultima fattura</span></div>
      <div class="supply-facts"><div><span>Scadenza</span><strong>${esc(prettyDate(dueDate))}</strong></div><div><span>Consumo fatturato</span><strong>${esc(consumption)}</strong></div><div><span>Costo medio</span><strong>${esc(unitCost)}</strong></div></div>
      ${costRows ? `<details class="cost-details"><summary>Dettaglio costi</summary><div class="cost-list">${costRows}</div>${costError}</details>` : costError || `<div class="muted">Dettaglio costi non disponibile</div>`}
    </article>`;
  }

  _renderBills(bills) {
    if (!bills.length) return `<div class="empty">Nessuna bolletta disponibile.</div>`;
    return `<div class="table-wrap"><table><thead><tr><th>Fornitura</th><th>Periodo</th><th>Emissione</th><th>Scadenza</th><th>Stato</th><th class="right">Importo</th></tr></thead><tbody>${bills.map((bill) => {
      const gas = String(bill.commodity || "").toLowerCase() === "gas";
      const status = bill.statusLabel || bill.invoiceStatus || "—";
      const paid = String(bill.statusCode || "").toUpperCase() === "PAID";
      return `<tr><td><span class="commodity ${gas ? "gas" : "electric"}"><ha-icon icon="${gas ? "mdi:fire" : "mdi:flash"}"></ha-icon>${gas ? "Gas" : "Luce"}</span></td><td>${esc(periodText(bill.competenceStartDate, bill.competenceEndDate))}</td><td>${esc(prettyDate(bill.issueDate))}</td><td>${esc(prettyDate(bill.dueDate))}</td><td><span class="status ${paid ? "paid" : "charging"}">${esc(status)}</span></td><td class="right amount-cell">${esc(money(bill.amount))}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  }

  _consumptionCard(name, icon, billedLatest, curveLatest, billedTotal, history, unit, electric) {
    const currentCurve = amountValue(this._hass, electric ? this._entities.electricityCurveLatest : this._entities.gasCurveLatest);
    const bands = electric ? this._entities.electricityBands.map((entity, index) => ({ label: `F${index + 1}`, state: stateValue(this._hass, entity)?.state })) : [];
    const peak = electric ? stateText(this._hass, this._entities.electricityPeak, "kW") : "";
    const rows = [...history].sort((a, b) => this._dateKey(b.dataCompetenzaStart) - this._dateKey(a.dataCompetenzaStart)).slice(0, 6);
    const maximum = Math.max(1, ...rows.map((r) => Number(String(r.curveconsumomensile || 0).replace(",", ".")) || 0));
    const chart = rows.length ? rows.map((row) => {
      const val = Number(String(row.curveconsumomensile || 0).replace(",", ".")) || 0;
      const width = Math.max(2, (val / maximum) * 100);
      return `<div class="bar-row"><span>${esc(this._monthLabel(row.dataCompetenzaStart))}</span><div class="bar-track"><i style="width:${width}%"></i></div><strong>${esc(fmt(val, 1))} ${unit}</strong></div>`;
    }).join("") : `<div class="empty">Storico curva non disponibile</div>`;
    const curveAttrs = this._get(electric ? "electricityCurveTotal" : "gasCurveTotal")?.attributes || {};
    const curveError = !electric && curveAttrs.endpoint_error ? `<div class="inline-error">Curva gas non disponibile: ${esc(curveAttrs.endpoint_error)}</div>` : "";
    const range = electric ? this._get("electricityBilledMonths")?.state : this._get("gasBilledMonths")?.state;
    return `<article class="consumption-card">
      <div class="consumption-head"><div class="supply-icon ${electric ? "electric" : "gas"}"><ha-icon icon="${icon}"></ha-icon></div><div><h3>${name}</h3><span>${esc(range || "—")} mesi fatturati</span></div></div>
      <div class="consumption-stats"><div><span>Ultima bolletta</span><strong>${esc(billedLatest)}</strong></div><div><span>Ultima curva</span><strong>${esc(curveLatest)}</strong></div><div><span>Totale bollette</span><strong>${esc(billedTotal)}</strong></div><div><span>Totale curve</span><strong>${esc(stateText(this._hass, electric ? this._entities.electricityCurveTotal : this._entities.gasCurveTotal, unit))}</strong></div></div>
      ${electric ? `<div class="bands">${bands.map((band) => `<div><span>${band.label}</span><strong>${esc(stateText(this._hass, this._entities.electricityBands[Number(band.label.slice(1)) - 1], "kWh"))}</strong></div>`).join("")}<div><span>Picco</span><strong>${esc(peak)}</strong></div></div>` : `<div class="curve-note">${curveAttrs.unique_full_months ? `${esc(curveAttrs.unique_full_months)} mesi interi, duplicati rimossi` : "Curve mensili del gas"}</div>${curveError}`}
      <div class="chart-title">Storico curve mensili</div><div class="bars">${chart}</div>
    </article>`;
  }

  _monthLabel(value) {
    const date = new Date(String(value || "").replace(" ", "T") + (String(value || "").length === 10 ? "T00:00:00" : ""));
    return Number.isNaN(date.getTime()) ? String(value || "—") : new Intl.DateTimeFormat("it-IT", { month: "short", year: "2-digit" }).format(date);
  }

  _styles() {
    return `
      :host{display:block;color:var(--primary-text-color);--sg-ink:var(--primary-text-color);--sg-muted:var(--secondary-text-color);--sg-line:var(--divider-color);--sg-blue:#2478d4;--sg-blue-soft:rgba(36,120,212,.11);--sg-green:#24966d;--sg-green-soft:rgba(36,150,109,.12);--sg-red:#c77c35;--sg-red-soft:rgba(199,124,53,.13);font-family:var(--paper-font-body1_-_font-family,Roboto,"Arial",sans-serif)}
      *{box-sizing:border-box}.shell{overflow:hidden;border:1px solid var(--sg-line);border-radius:24px;background:var(--ha-card-background,var(--card-background-color));box-shadow:var(--ha-card-box-shadow,0 8px 28px rgba(20,45,75,.08));padding:clamp(16px,2.2vw,28px)}
      .hero{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}.brand,.brandmark,.metric-top,.supply-head,.supply-name,.consumption-head,.commodity{display:flex;align-items:center}.brand{gap:14px}.brandmark{justify-content:center;width:48px;height:48px;border-radius:16px;color:white;background:linear-gradient(145deg,#3294e8,#155fae)}.brandmark ha-icon{--mdc-icon-size:26px}.eyebrow{font-size:10px;letter-spacing:.14em;font-weight:800;color:var(--sg-muted)}h1,h2,h3,p{margin:0}h1{font-size:25px;letter-spacing:-.03em;margin-top:2px}.subline,.section-note{color:var(--sg-muted);font-size:12px;margin-top:4px}.due-pill{display:flex;align-items:center;gap:8px;padding:9px 13px;border:1px solid var(--sg-line);border-radius:999px;font-size:12px;font-weight:650;white-space:nowrap}.pulse{width:8px;height:8px;border-radius:50%;background:var(--sg-green);box-shadow:0 0 0 4px var(--sg-green-soft)}
      .summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.metric{min-width:0;padding:16px;border:1px solid var(--sg-line);border-radius:18px;background:var(--secondary-background-color,rgba(127,127,127,.035))}.metric.accent{background:linear-gradient(135deg,var(--sg-blue-soft),transparent 90%);border-color:color-mix(in srgb,var(--sg-blue) 28%,var(--sg-line))}.metric-top{justify-content:space-between;color:var(--sg-muted);font-size:12px;font-weight:650}.metric-top ha-icon{--mdc-icon-size:19px;color:var(--sg-blue)}.metric>strong{display:block;font-size:clamp(22px,3vw,30px);letter-spacing:-.04em;margin:10px 0 3px;font-variant-numeric:tabular-nums}.metric small{color:var(--sg-muted);font-size:11px}
      .section{margin-top:28px}.section-title{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:12px}.section-title h2{font-size:18px;letter-spacing:-.02em;margin-top:3px}.section-note{margin:0}.supply-grid,.consumption-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.supply-card,.consumption-card,.meter-card{border:1px solid var(--sg-line);border-radius:18px;padding:16px;background:var(--ha-card-background,var(--card-background-color))}.supply-head{justify-content:space-between;gap:10px}.supply-name{gap:10px}.supply-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:13px;background:var(--sg-blue-soft);color:var(--sg-blue);flex:none}.supply-icon.gas{background:var(--sg-green-soft);color:var(--sg-green)}.supply-icon ha-icon{--mdc-icon-size:21px}.supply-name h3,.consumption-head h3{font-size:16px;margin-top:2px}.status{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;font-size:10px;font-weight:700;white-space:nowrap;background:var(--sg-red-soft);color:var(--sg-red)}.status.paid{background:var(--sg-green-soft);color:var(--sg-green)}.supply-amount{display:flex;align-items:baseline;gap:8px;margin:18px 0 14px}.supply-amount strong{font-size:28px;letter-spacing:-.04em;font-variant-numeric:tabular-nums}.supply-amount span,.supply-facts span{font-size:11px;color:var(--sg-muted)}.supply-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:11px 0;border-top:1px solid var(--sg-line);border-bottom:1px solid var(--sg-line)}.supply-facts>div{min-width:0}.supply-facts strong{display:block;font-size:12px;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cost-details{margin-top:12px}.cost-details summary{font-size:12px;color:var(--sg-blue);font-weight:650;cursor:pointer}.cost-list{margin-top:8px}.cost-row{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px dashed var(--sg-line);font-size:11px}.cost-row span{color:var(--sg-muted)}.cost-row strong{font-variant-numeric:tabular-nums}.muted,.empty{padding:12px 0;color:var(--sg-muted);font-size:12px}
      .table-wrap{overflow:auto;border:1px solid var(--sg-line);border-radius:16px}table{width:100%;border-collapse:collapse;min-width:640px}th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--sg-line);font-size:11px;white-space:nowrap}th{background:var(--secondary-background-color,rgba(127,127,127,.04));color:var(--sg-muted);font-size:10px;text-transform:uppercase;letter-spacing:.07em}tbody tr:last-child td{border-bottom:0}.commodity{width:max-content;gap:5px;font-weight:650}.commodity ha-icon{--mdc-icon-size:15px;color:var(--sg-blue)}.commodity.gas ha-icon{color:var(--sg-green)}.right{text-align:right}.amount-cell{font-size:12px;font-weight:750;font-variant-numeric:tabular-nums}
      .consumption-card{padding:16px}.consumption-head{gap:10px}.consumption-head>div:last-child span{display:block;color:var(--sg-muted);font-size:11px;margin-top:4px}.consumption-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:16px 0 12px}.consumption-stats>div{padding:10px;border-radius:12px;background:var(--secondary-background-color,rgba(127,127,127,.04))}.consumption-stats span,.bands span{display:block;color:var(--sg-muted);font-size:10px}.consumption-stats strong{display:block;font-size:16px;margin-top:4px;font-variant-numeric:tabular-nums}.bands{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:10px 0;border-top:1px solid var(--sg-line)}.bands>div{padding:8px;border-radius:10px;background:var(--sg-blue-soft)}.bands strong{display:block;margin-top:4px;font-size:12px}.curve-note{padding:10px 0;border-top:1px solid var(--sg-line);font-size:11px;color:var(--sg-muted)}.chart-title{font-size:11px;font-weight:700;margin:8px 0}.bars{display:grid;gap:8px}.bar-row{display:grid;grid-template-columns:42px minmax(40px,1fr) auto;align-items:center;gap:8px;font-size:10px}.bar-row>span{color:var(--sg-muted);text-transform:capitalize}.bar-row strong{font-size:10px;font-variant-numeric:tabular-nums}.bar-track{height:7px;border-radius:20px;background:var(--secondary-background-color,rgba(127,127,127,.08));overflow:hidden}.bar-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#54a8ed,#2478d4)}
      .meter-card{display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:linear-gradient(110deg,var(--sg-green-soft),transparent 80%)}.meter-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:var(--sg-green);color:white}.meter-icon ha-icon{--mdc-icon-size:24px}.meter-reading strong{display:block;font-size:24px;font-variant-numeric:tabular-nums}.meter-reading span,.meter-date span{display:block;font-size:11px;color:var(--sg-muted);margin-top:2px}.meter-date{margin-left:auto;text-align:right}.meter-date strong{display:block;font-size:13px;margin-top:4px}.inline-error{flex-basis:100%;font-size:11px;color:var(--sg-red);padding-top:8px;border-top:1px solid var(--sg-line)}footer{padding-top:18px;text-align:center;color:var(--sg-muted);font-size:10px}
      @media(max-width:700px){.hero{align-items:flex-start;flex-direction:column}.due-pill{align-self:flex-start}.summary-grid{grid-template-columns:1fr}.metric{padding:13px}.metric>strong{margin-top:6px}.supply-grid,.consumption-grid{grid-template-columns:1fr}.section{margin-top:22px}.section-title{align-items:flex-start;flex-direction:column;gap:4px}.section-note{margin-top:0}.supply-facts{gap:4px}.supply-facts strong{font-size:11px}.meter-date{margin-left:0;text-align:left}.meter-card{align-items:flex-start}.supply-amount strong{font-size:25px}}
      /* Larger type and spacing for wall displays and wide dashboards. */
      .eyebrow{font-size:12px}.subline,.section-note{font-size:13px}.due-pill{font-size:13px}.metric-top{font-size:14px}.metric small{font-size:12px}.section-title h2{font-size:21px}.supply-name h3,.consumption-head h3{font-size:18px}.status{font-size:12px;padding:6px 10px}.supply-amount strong{font-size:31px}.supply-amount span,.supply-facts span{font-size:13px}.supply-facts strong{font-size:14px}.cost-details summary{font-size:14px}.cost-row{font-size:13px}.muted,.empty{font-size:14px}th{font-size:12px}td{font-size:13px;padding:13px 14px}.commodity{font-size:13px}.amount-cell{font-size:14px}.consumption-head>div:last-child span{font-size:13px}.consumption-stats span,.bands span{font-size:12px}.consumption-stats strong{font-size:18px}.bands strong{font-size:14px}.curve-note,.chart-title{font-size:13px}.bar-row,.bar-row strong{font-size:12px}.meter-reading span,.meter-date span{font-size:13px}.meter-date strong{font-size:15px}footer{font-size:12px}
      @media(max-width:700px){.supply-facts{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.supply-facts strong{font-size:12px}.supply-facts span{font-size:12px}.bands{grid-template-columns:repeat(2,minmax(0,1fr))}.bar-row{grid-template-columns:38px minmax(30px,1fr) auto;gap:6px}td{padding:11px 10px}}
    `;
  }
}

if (!customElements.get("sorgenia-dashboard-card")) {
  customElements.define("sorgenia-dashboard-card", SorgeniaDashboardCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "sorgenia-dashboard-card",
  name: "Sorgenia dashboard",
  description: "Pannello riepilogativo per bollette e consumi Sorgenia.",
  preview: false,
});
