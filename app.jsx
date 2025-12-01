// use React globals provided by the CDN
const { useState, useMemo } = React;

function FinancialModel() {
  // --- 1. MASTER ASSUMPTIONS (Detailed) ---
  const defaultAssumptions = {
    // Macro
    exchangeRate: 3.3,
    inflationRate: 0.02,
    // Phasing & Land Use
    phase1Year: 2027,
    phase2Year: 2029,
    phase3Year: 2031,
    haPerPhase: 16,
    oliveHaPercent: 0.5,
    carobHaPercent: 0.5,
    // Tree Density
    oliveDensitySHD: 1250,
    carobDensity: 100,
    // CAPEX - Infrastructure (TND)
    wellDepth: 250,
    wellCostPerMeter: 500,
    pumpCost: 50000,
    irrigationPerHa: 5000,
    soilPrepPerHa: 2500,
    tractorCost: 150000,
    // CAPEX - Plants (TND)
    treeOliveCost: 12,
    treeCarobCost: 25,
    // CAPEX - Factory (TND)
    factoryYear: 2035,
    factoryCost: 1000000,
    // OPEX - Variable (TND)
    electricityPerWell: 5000,
    fertilizerPerHa: 1200,
    waterCost: 0,
    landLeasePerHa: 800,
    // OPEX - Labor (TND)
    engineerSalary: 1500,
    guardianSalary: 1000,
    harvestLaborOlive: 0.25,
    harvestLaborCarob: 0.15,
    pruningOlive: 2,
    pruningCarob: 3,
    // OPEX - Logistics & Admin
    packagingIBC: 200,
    logisticsPerKg: 0.5,
    adminLegalTND: 16500,
    // Revenue Assumptions
    oliveOilPriceBulk: 11.2,
    carobSeedPrice: 16,
    carobGumPrice: 66,
    // Taxes & Friction
    taxRateCorpTN_Exp: 0.2,
    taxRateCorpTN_Agri: 0.0,
    taxRateRamzi: 0.4,
    taxRateMahdi: 0.3,
    transferFriction: 0.03
  };

  const [inputs, setInputs] = useState(defaultAssumptions);
  const [activeTab, setActiveTab] = useState("corporate");

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs((prev) => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const resetDefaults = () => setInputs(defaultAssumptions);

  const calculations = useMemo(() => {
    const years = Array.from({ length: 15 }, (_, i) => 2026 + i);

    const oliveYieldCurve = [0, 0, 0, 2, 5, 8, 12, 15, 18];
    const carobYieldCurve = [0, 0, 0, 0, 0, 5, 15, 30, 50];

    let cumulativeInvRamzi = 0;
    let cumulativeInvMahdi = 0;
    let cumulativeCashRamzi = 0;
    let cumulativeCashMahdi = 0;
    let totalAssetValue = 0;

    const yearlyData = years.map((year) => {
      const phases = [
        { year: inputs.phase1Year, active: year >= inputs.phase1Year, age: year - inputs.phase1Year },
        { year: inputs.phase2Year, active: year >= inputs.phase2Year, age: year - inputs.phase2Year },
        { year: inputs.phase3Year, active: year >= inputs.phase3Year, age: year - inputs.phase3Year }
      ];

      let activeHa = 0;
      let activeWells = 0;
      let totalOliveTrees = 0;
      let totalCarobTrees = 0;
      let productionOliveKg = 0;
      let productionCarobKg = 0;
      let capexTND = 0;

      phases.forEach((p) => {
        if (p.active) {
          const phaseHa = inputs.haPerPhase;
          activeHa += phaseHa;
          activeWells += 1;
          const phaseOliveTrees = phaseHa * inputs.oliveHaPercent * inputs.oliveDensitySHD;
          const phaseCarobTrees = phaseHa * inputs.carobHaPercent * inputs.carobDensity;

          totalOliveTrees += phaseOliveTrees;
          totalCarobTrees += phaseCarobTrees;

          if (p.age >= 0) {
            const oY = oliveYieldCurve[Math.min(p.age, oliveYieldCurve.length - 1)];
            const cY = carobYieldCurve[Math.min(p.age, carobYieldCurve.length - 1)];
            productionOliveKg += phaseOliveTrees * oY;
            productionCarobKg += phaseCarobTrees * cY;
          }

          if (p.age === 0) {
            const well = inputs.wellCostPerMeter * inputs.wellDepth + inputs.pumpCost;
            const irr = inputs.irrigationPerHa * phaseHa;
            const soil = inputs.soilPrepPerHa * phaseHa;
            const trees =
              phaseOliveTrees * inputs.treeOliveCost +
              phaseCarobTrees * inputs.treeCarobCost;
            capexTND += well + irr + soil + trees;
          }
        }
      });

      if (year === inputs.phase1Year) capexTND += inputs.tractorCost;
      if (year === inputs.factoryYear) capexTND += inputs.factoryCost;

      const oliveOilLiters = productionOliveKg * 0.18;
      const revOlive = oliveOilLiters * inputs.oliveOilPriceBulk;

      const carobSeedKg = productionCarobKg * 0.2;
      const revCarob =
        year < inputs.factoryYear + 1
          ? carobSeedKg * inputs.carobSeedPrice
          : carobSeedKg * 0.9 * inputs.carobGumPrice;

      const totalRevenueTND = revOlive + revCarob;

      const staffCount = year < inputs.phase3Year ? 2 : 3;
      const laborFixed =
        inputs.engineerSalary * 12 +
        inputs.guardianSalary * 12 * (staffCount - 1);
      const electricity = inputs.electricityPerWell * activeWells;
      const admin = inputs.adminLegalTND;
      const rent = inputs.landLeasePerHa * activeHa;
      const fertilizer = inputs.fertilizerPerHa * activeHa;
      const harvestCost =
        productionOliveKg * inputs.harvestLaborOlive +
        productionCarobKg * inputs.harvestLaborCarob;
      const pruningCost =
        totalOliveTrees * inputs.pruningOlive +
        totalCarobTrees * inputs.pruningCarob;
      const packaging = (oliveOilLiters / 1000) * inputs.packagingIBC;
      const logistics = (oliveOilLiters + carobSeedKg) * inputs.logisticsPerKg;

      const totalOpexTND =
        laborFixed +
        electricity +
        admin +
        rent +
        fertilizer +
        harvestCost +
        pruningCost +
        packaging +
        logistics;

      const ebitdaTND = totalRevenueTND - totalOpexTND;
      const factoryMargin = totalRevenueTND * 0.1;
      const taxableIncome = year > 2029 ? factoryMargin : 0;
      const corpTaxTND = taxableIncome * inputs.taxRateCorpTN_Exp;

      const netProfitTND = ebitdaTND - corpTaxTND;
      const netProfitEUR = netProfitTND / inputs.exchangeRate;
      const capexEUR = capexTND / inputs.exchangeRate;

      let cashCallEUR = 0;
      let dividendEUR = 0;

      if (capexEUR > 0) {
        const netCashPosition = netProfitEUR - capexEUR;
        if (netCashPosition < 0) {
          cashCallEUR = netCashPosition;
          dividendEUR = 0;
        } else {
          cashCallEUR = 0;
          dividendEUR = netCashPosition;
        }
      } else {
        if (netProfitEUR > 0) {
          dividendEUR = netProfitEUR;
        } else {
          cashCallEUR = netProfitEUR;
        }
      }

      if (year === 2026) cashCallEUR = -15000;

      const ramziSharePre =
        cashCallEUR < 0 ? cashCallEUR / 2 : dividendEUR / 2;
      const mahdiSharePre =
        cashCallEUR < 0 ? cashCallEUR / 2 : dividendEUR / 2;

      const ramziInput =
        ramziSharePre < 0
          ? ramziSharePre * (1 + inputs.transferFriction)
          : 0;
      const mahdiInput =
        mahdiSharePre < 0
          ? mahdiSharePre * (1 + inputs.transferFriction)
          : 0;

      const ramziPocket =
        ramziSharePre > 0
          ? ramziSharePre * (1 - inputs.taxRateRamzi)
          : ramziInput;
      const mahdiPocket =
        mahdiSharePre > 0
          ? mahdiSharePre * (1 - inputs.taxRateMahdi)
          : mahdiInput;

      if (ramziPocket < 0) cumulativeInvRamzi += Math.abs(ramziPocket);
      if (mahdiPocket < 0) cumulativeInvMahdi += Math.abs(mahdiPocket);
      if (ramziPocket > 0) cumulativeCashRamzi += ramziPocket;
      if (mahdiPocket > 0) cumulativeCashMahdi += mahdiPocket;

      if (year === 2040) {
        const businessValue = netProfitEUR * 4;
        const tangibleAssets =
          (inputs.factoryCost + 500000) / inputs.exchangeRate;
        totalAssetValue = businessValue + tangibleAssets;
      }

      return {
        year,
        activeHa,
        revenueTND: Math.round(totalRevenueTND),
        opexTND: Math.round(totalOpexTND),
        capexTND: Math.round(capexTND),
        profitEUR: Math.round(netProfitEUR),
        ramziPocket: Math.round(ramziPocket),
        mahdiPocket: Math.round(mahdiPocket),
        cashCall: cashCallEUR < 0,
        isFactory: year === inputs.factoryYear
      };
    });

    return {
      yearlyData,
      cumulativeInvRamzi,
      cumulativeInvMahdi,
      cumulativeCashRamzi,
      cumulativeCashMahdi,
      totalAssetValue: Math.round(totalAssetValue)
    };
  }, [inputs]);

  const thClass =
    "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";
  const tdClass = "px-4 py-3 whitespace-nowrap text-sm text-gray-700";

  return (
    <div className="p-6 max-w-[1600px] mx-auto bg-slate-50 min-h-screen font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            WeFarm Strategy Model
          </h1>
          <p className="text-sm text-slate-500">
            Dynamic Financial Plan (2026-2040)
          </p>
        </div>
        <button
          onClick={resetDefaults}
          className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm"
        >
          Reset Assumptions
        </button>
      </div>

      {/* Left vs right columns kept as in your original JSX, just without icon components */}
      {/* ...keep all your JSX here unchanged except removing <Sprout/>, <Factory/>, <Users/>, etc. */}
      {/* The important part is: no imports, no undefined icon components. */}
    </div>
  );
}

// Mount the app
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<FinancialModel />);
