// Use React globals from CDN
const { useState, useMemo } = React;

function FinancialModel() {
  // --- 1. MASTER ASSUMPTIONS (Detailed) ---
  const defaultAssumptions = {
    // Macro
    exchangeRate: 3.3, // TND to 1 EUR
    inflationRate: 0.02, // Annual cost inflation

    // Phasing & Land Use
    phase1Year: 2027,
    phase2Year: 2029,
    phase3Year: 2031,
    haPerPhase: 16,
    oliveHaPercent: 0.50, // 50% of land
    carobHaPercent: 0.50, // 50% of land
    
    // Tree Density
    oliveDensitySHD: 1250, // Trees/Ha
    carobDensity: 100, // Trees/Ha

    // CAPEX - Infrastructure (TND)
    wellDepth: 250,
    wellCostPerMeter: 500,
    pumpCost: 50000, // Per well
    irrigationPerHa: 5000,
    soilPrepPerHa: 2500,
    tractorCost: 150000, 
    
    // CAPEX - Plants (TND)
    treeOliveCost: 12, 
    treeCarobCost: 25, 

    // CAPEX - Factory (TND)
    factoryYear: 2035,
    factoryCost: 1000000, // ~300k EUR

    // OPEX - Variable (TND)
    electricityPerWell: 5000, // Annual
    fertilizerPerHa: 1200, // High due to salinity
    waterCost: 0, // Free from well (electricity covers it)
    landLeasePerHa: 800, // Rent paid to Ramzi/Mahdi
    
    // OPEX - Labor (TND)
    engineerSalary: 1500, // Monthly
    guardianSalary: 1000, // Monthly
    harvestLaborOlive: 0.25, // Per Kg harvested
    harvestLaborCarob: 0.15, // Per Kg harvested
    pruningOlive: 2, // Per tree every 2 years (avg 1/yr)
    pruningCarob: 3, // Per tree
    
    // OPEX - Logistics & Admin
    packagingIBC: 200, // TND per 1000L
    logisticsPerKg: 0.5, // TND to France
    adminLegalTND: 16500, 

    // Revenue Assumptions
    oliveOilPriceBulk: 11.2, // TND (~3.40 EUR)
    carobSeedPrice: 16, // TND
    carobGumPrice: 66, // TND (~20 EUR) - Post Factory
    
    // Taxes & Friction
    taxRateCorpTN_Exp: 0.20, // Export Co after holiday
    taxRateCorpTN_Agri: 0.00, // 10 years
    taxRateRamzi: 0.40, // Canada Dividend Tax
    taxRateMahdi: 0.30, // France Flat Tax
    transferFriction: 0.03, // 3% lost in transfer
  };

  const [inputs, setInputs] = useState(defaultAssumptions);
  const [activeTab, setActiveTab] = useState('corporate');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const resetDefaults = () => setInputs(defaultAssumptions);

  // --- 2. CALCULATIONS ENGINE ---
  const calculations = useMemo(() => {
    const years = Array.from({ length: 15 }, (_, i) => 2026 + i);
    
    // Yield Curves (Kg per tree)
    const oliveYieldCurve = [0, 0, 0, 2, 5, 8, 12, 15, 18]; 
    const carobYieldCurve = [0, 0, 0, 0, 0, 5, 15, 30, 50];

    let cumulativeInvRamzi = 0;
    let cumulativeInvMahdi = 0;
    let cumulativeCashRamzi = 0;
    let cumulativeCashMahdi = 0;
    let totalAssetValue = 0;

    const yearlyData = years.map(year => {
      // 1. Determine Active Phases
      const phases = [
        { year: inputs.phase1Year, active: year >= inputs.phase1Year, age: year - inputs.phase1Year },
        { year: inputs.phase2Year, active: year >= inputs.phase2Year, age: year - inputs.phase2Year },
        { year: inputs.phase3Year, active: year >= inputs.phase3Year, age: year - inputs.phase3Year },
      ];

      let activeHa = 0;
      let activeWells = 0;
      let totalOliveTrees = 0;
      let totalCarobTrees = 0;
      let productionOliveKg = 0;
      let productionCarobKg = 0;
      let capexTND = 0;

      // 2. Agronomic Calcs
      phases.forEach(p => {
        if (p.active) {
            const phaseHa = inputs.haPerPhase;
            activeHa += phaseHa;
            activeWells += 1;
            const phaseOliveTrees = (phaseHa * inputs.oliveHaPercent) * inputs.oliveDensitySHD;
            const phaseCarobTrees = (phaseHa * inputs.carobHaPercent) * inputs.carobDensity;
            
            totalOliveTrees += phaseOliveTrees;
            totalCarobTrees += phaseCarobTrees;

            // Yields
            if (p.age >= 0) {
                const oY = oliveYieldCurve[Math.min(p.age, oliveYieldCurve.length - 1)];
                const cY = carobYieldCurve[Math.min(p.age, carobYieldCurve.length - 1)];
                productionOliveKg += phaseOliveTrees * oY;
                productionCarobKg += phaseCarobTrees * cY;
            }

            // One-off Phase CAPEX
            if (p.age === 0) {
                const well = (inputs.wellCostPerMeter * inputs.wellDepth) + inputs.pumpCost;
                const irr = inputs.irrigationPerHa * phaseHa;
                const soil = inputs.soilPrepPerHa * phaseHa;
                const trees = (phaseOliveTrees * inputs.treeOliveCost) + (phaseCarobTrees * inputs.treeCarobCost);
                capexTND += (well + irr + soil + trees);
            }
        }
      });

      // Additional CAPEX
      if (year === inputs.phase1Year) capexTND += inputs.tractorCost;
      if (year === inputs.factoryYear) capexTND += inputs.factoryCost;

      // 3. Revenue (TND)
      const oliveOilLiters = productionOliveKg * 0.18;
      const revOlive = oliveOilLiters * inputs.oliveOilPriceBulk;

      const carobSeedKg = productionCarobKg * 0.20;
      const revCarob = year < (inputs.factoryYear + 1) 
        ? carobSeedKg * inputs.carobSeedPrice 
        : (carobSeedKg * 0.9) * inputs.carobGumPrice; 

      const totalRevenueTND = revOlive + revCarob;

      // 4. OPEX (TND)
      const staffCount = year < inputs.phase3Year ? 2 : 3;
      const laborFixed = (inputs.engineerSalary * 12) + (inputs.guardianSalary * 12 * (staffCount - 1));
      const electricity = inputs.electricityPerWell * activeWells;
      const admin = inputs.adminLegalTND;
      const rent = inputs.landLeasePerHa * activeHa;
      
      const fertilizer = inputs.fertilizerPerHa * activeHa;
      const harvestCost = (productionOliveKg * inputs.harvestLaborOlive) + (productionCarobKg * inputs.harvestLaborCarob);
      const pruningCost = (totalOliveTrees * inputs.pruningOlive) + (totalCarobTrees * inputs.pruningCarob);
      const packaging = (oliveOilLiters / 1000) * inputs.packagingIBC; 
      const logistics = (oliveOilLiters + carobSeedKg) * inputs.logisticsPerKg;

      const totalOpexTND = laborFixed + electricity + admin + rent + fertilizer + harvestCost + pruningCost + packaging + logistics;

      // 5. Taxes & Net Profit (Euro)
      const ebitdaTND = totalRevenueTND - totalOpexTND;
      const factoryMargin = totalRevenueTND * 0.10; // Assumed internal margin for factory
      const taxableIncome = year > 2029 ? factoryMargin : 0; 
      const corpTaxTND = taxableIncome * inputs.taxRateCorpTN_Exp;

      const netProfitTND = ebitdaTND - corpTaxTND;
      const netProfitEUR = netProfitTND / inputs.exchangeRate;
      const capexEUR = capexTND / inputs.exchangeRate;

      // 6. Cash Flow Logic
      let cashCallEUR = 0;
      let dividendEUR = 0;

      if (capexEUR > 0) {
        // CAPEX Year: Use Profit to offset CAPEX
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

      const ramziSharePre = cashCallEUR < 0 ? cashCallEUR / 2 : dividendEUR / 2;
      const mahdiSharePre = cashCallEUR < 0 ? cashCallEUR / 2 : dividendEUR / 2;

      const ramziInput = ramziSharePre < 0 ? ramziSharePre * (1 + inputs.transferFriction) : 0;
      const mahdiInput = mahdiSharePre < 0 ? mahdiSharePre * (1 + inputs.transferFriction) : 0;

      const ramziPocket = ramziSharePre > 0 ? ramziSharePre * (1 - inputs.taxRateRamzi) : ramziInput;
      const mahdiPocket = mahdiSharePre > 0 ? mahdiSharePre * (1 - inputs.taxRateMahdi) : mahdiInput;

      if (ramziPocket < 0) cumulativeInvRamzi += Math.abs(ramziPocket);
      if (mahdiPocket < 0) cumulativeInvMahdi += Math.abs(mahdiPocket);
      if (ramziPocket > 0) cumulativeCashRamzi += ramziPocket;
      if (mahdiPocket > 0) cumulativeCashMahdi += mahdiPocket;

      if (year === 2040) {
         // Asset Valuation: Land (cost) + Trees (cost) + Factory (cost) + 4x EBITDA multiple
         const businessValue = (netProfitEUR * 4);
         const tangibleAssets = (inputs.factoryCost + 500000) / inputs.exchangeRate;
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

  // Helper for table classes
  const thClass = "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";
  const tdClass = "px-4 py-3 whitespace-nowrap text-sm text-gray-700";

  // --- 3. UI RENDER ---
  return (
    <div className="p-6 max-w-[1600px] mx-auto bg-slate-50 min-h-screen font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-3xl font-bold text-slate-900">WeFarm Strategy Model</h1>
            <p className="text-sm text-slate-500">Dynamic Financial Plan (2026-2040)</p>
        </div>
        <button 
          onClick={resetDefaults} 
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-md hover:bg-slate-100 text-sm font-medium transition-colors shadow-sm"
        >
          Reset Assumptions
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* LEFT COLUMN: ASSUMPTIONS */}
        <div className="xl:col-span-1 space-y-4 h-[calc(100vh-100px)] overflow-y-auto pr-2 pb-10">
            
            {/* Section 1: Phasing */}
            <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 font-bold text-sm text-slate-800 flex items-center gap-2">
                  Phase Timing & Land
                </div>
                <div className="p-4 space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block mb-1 text-slate-500 font-medium">Phase 1 Year</label>
                          <input type="number" className="w-full p-2 border rounded" name="phase1Year" value={inputs.phase1Year} onChange={handleInputChange} />
                        </div>
                        <div>
                          <label className="block mb-1 text-slate-500 font-medium">Phase 2 Year</label>
                          <input type="number" className="w-full p-2 border rounded" name="phase2Year" value={inputs.phase2Year} onChange={handleInputChange} />
                        </div>
                        <div>
                          <label className="block mb-1 text-slate-500 font-medium">Phase 3 Year</label>
                          <input type="number" className="w-full p-2 border rounded" name="phase3Year" value={inputs.phase3Year} onChange={handleInputChange} />
                        </div>
                        <div>
                          <label className="block mb-1 text-slate-500 font-medium">Ha Per Phase</label>
                          <input type="number" className="w-full p-2 border rounded" name="haPerPhase" value={inputs.haPerPhase} onChange={handleInputChange} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block mb-1 text-slate-500 font-medium">Olive Split (0.5)</label>
                          <input type="number" step="0.1" className="w-full p-2 border rounded" name="oliveHaPercent" value={inputs.oliveHaPercent} onChange={handleInputChange} />
                        </div>
                        <div>
                          <label className="block mb-1 text-slate-500 font-medium">Carob Split (0.5)</label>
                          <input type="number" step="0.1" className="w-full p-2 border rounded" name="carobHaPercent" value={inputs.carobHaPercent} onChange={handleInputChange} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 2: Infrastructure Costs */}
            <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 font-bold text-sm text-slate-800 flex items-center gap-2">
                  CAPEX (Unit Costs TND)
                </div>
                <div className="p-4 space-y-3 text-xs">
                    <div>
                      <label className="block mb-1 text-slate-500 font-medium">Well Depth (m)</label>
                      <input type="number" className="w-full p-2 border rounded" name="wellDepth" value={inputs.wellDepth} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block mb-1 text-slate-500 font-medium">Drilling (TND/m)</label>
                      <input type="number" className="w-full p-2 border rounded" name="wellCostPerMeter" value={inputs.wellCostPerMeter} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block mb-1 text-slate-500 font-medium">Pump Cost</label>
                      <input type="number" className="w-full p-2 border rounded" name="pumpCost" value={inputs.pumpCost} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block mb-1 text-slate-500 font-medium">Irrigation (Per Ha)</label>
                      <input type="number" className="w-full p-2 border rounded" name="irrigationPerHa" value={inputs.irrigationPerHa} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block mb-1 text-slate-500 font-medium">Tree Price (Olive)</label>
                      <input type="number" className="w-full p-2 border rounded" name="treeOliveCost" value={inputs.treeOliveCost} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block mb-1 text-slate-500 font-medium">Tree Price (Carob)</label>
                      <input type="number" className="w-full p-2 border rounded" name="treeCarobCost" value={inputs.treeCarobCost} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block mb-1 text-slate-500 font-medium">Tractor (One-off)</label>
                      <input type="number" className="w-full p-2 border rounded" name="tractorCost" value={inputs.tractorCost} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block mb-1 text-slate-500 font-medium">Chemical Factory</label>
                      <input type="number" className="w-full p-2 border rounded" name="factoryCost" value={inputs.factoryCost} onChange={handleInputChange} />
                    </div>
                </div>
            </div>

            {/* Section 3: OPEX */}
            <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 font-bold text-sm text-slate-800 flex items-center gap-2">
                  OPEX (TND)
                </div>
                <div className="p-4 space-y-3 text-xs">
                    <div>
                      <label className="block mb-1 text-slate-500 font-medium">Eng. Salary (Mo)</label>
                      <input type="number" className="w-full p-2 border rounded" name="engineerSalary" value={inputs.engineerSalary} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block mb-1 text-slate-500 font-medium">Guard Salary (Mo)</label>
                      <input type="number" className="w-full p-2 border rounded" name="guardianSalary" value={inputs.guardianSalary} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block mb-1 text-slate-500 font-medium">Electricity (Well/Yr)</label>
                      <input type="number" className="w-full p-2 border rounded" name="electricityPerWell" value={inputs.electricityPerWell} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block mb-1 text-slate-500 font-medium">Fertilizer (Ha/Yr)</label>
                      <input type="number" className="w-full p-2 border rounded" name="fertilizerPerHa" value={inputs.fertilizerPerHa} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block mb-1 text-slate-500 font-medium">Harvest Olive (Kg)</label>
                      <input type="number" step="0.01" className="w-full p-2 border rounded" name="harvestLaborOlive" value={inputs.harvestLaborOlive} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block mb-1 text-slate-500 font-medium">Admin/Legal (Yr)</label>
                      <input type="number" className="w-full p-2 border rounded" name="adminLegalTND" value={inputs.adminLegalTND} onChange={handleInputChange} />
                    </div>
                </div>
            </div>

            {/* Section 4: Market */}
            <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 font-bold text-sm text-slate-800 flex items-center gap-2">
                  Revenue & Tax
                </div>
                <div className="p-4 space-y-3 text-xs">
                    <div>
                      <label className="block mb-1 text-slate-500 font-medium">Oil Bulk Price (TND)</label>
                      <input type="number" step="0.1" className="w-full p-2 border rounded" name="oliveOilPriceBulk" value={inputs.oliveOilPriceBulk} onChange={handleInputChange} />
                    </div>
                    <div>
                      <label className="block mb-1 text-slate-500 font-medium">Gum Price (TND)</label>
                      <input type="number" className="w-full p-2 border rounded" name="carobGumPrice" value={inputs.carobGumPrice} onChange={handleInputChange} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block mb-1 text-slate-500 font-medium">Tax Ramzi</label>
                          <input type="number" step="0.01" className="w-full p-2 border rounded" name="taxRateRamzi" value={inputs.taxRateRamzi} onChange={handleInputChange} />
                        </div>
                        <div>
                          <label className="block mb-1 text-slate-500 font-medium">Tax Mahdi</label>
                          <input type="number" step="0.01" className="w-full p-2 border rounded" name="taxRateMahdi" value={inputs.taxRateMahdi} onChange={handleInputChange} />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN: TABS */}
        <div className="xl:col-span-3">
             {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 mb-4">
              <button 
                onClick={() => setActiveTab('corporate')} 
                className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${activeTab === 'corporate' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                1. Corporate Horizon
              </button>
              <button 
                onClick={() => setActiveTab('pocket')} 
                className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${activeTab === 'pocket' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                2. Pocket Cash
              </button>
              <button 
                onClick={() => setActiveTab('summary')} 
                className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${activeTab === 'summary' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                3. Summary
              </button>
            </div>


            {/* TAB 1: CORPORATE */}
            {activeTab === 'corporate' && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-medium leading-6 text-gray-900">Corporate P&L and Cash Flow (All Entities)</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className={thClass}>Year</th>
                                    <th scope="col" className={thClass}>Ha Active</th>
                                    <th scope="col" className={`text-right ${thClass}`}>Rev (TND)</th>
                                    <th scope="col" className={`text-right ${thClass}`}>OPEX (TND)</th>
                                    <th scope="col" className={`text-right text-red-600 ${thClass}`}>CAPEX (TND)</th>
                                    <th scope="col" className={`text-right text-blue-600 ${thClass}`}>Net Profit (€)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {calculations.yearlyData.map((row) => (
                                    <tr key={row.year} className={row.isFactory ? "bg-purple-50" : ""}>
                                        <td className={`${tdClass} font-bold`}>{row.year}</td>
                                        <td className={tdClass}>{row.activeHa} Ha</td>
                                        <td className={`${tdClass} text-right`}>{row.revenueTND.toLocaleString()}</td>
                                        <td className={`${tdClass} text-right text-gray-500`}>{row.opexTND.toLocaleString()}</td>
                                        <td className={`${tdClass} text-right text-red-500`}>{row.capexTND > 0 ? row.capexTND.toLocaleString() : "-"}</td>
                                        <td className={`${tdClass} text-right font-bold text-blue-600`}>€{row.profitEUR.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2: POCKET CASH */}
            {activeTab === 'pocket' && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-medium leading-6 text-gray-900">15-Year Investor Cash Flow (Post-Tax)</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className={thClass}>Year</th>
                                    <th scope="col" className={thClass}>Phase</th>
                                    <th scope="col" className={`text-right ${thClass}`}>Input/Div (€)</th>
                                    <th scope="col" className={`text-right ${thClass} bg-blue-50`}>Ramzi Net (€)</th>
                                    <th scope="col" className={`text-right ${thClass} bg-green-50`}>Mahdi Net (€)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {calculations.yearlyData.map((row) => (
                                    <tr key={row.year}>
                                        <td className={`${tdClass} font-bold`}>{row.year}</td>
                                        <td className={tdClass}>
                                            {row.cashCall ? (
                                              <span className="text-red-500 text-xs font-bold bg-red-100 px-2 py-1 rounded">
                                                CASH CALL
                                              </span>
                                            ) : (
                                              <span className="text-green-600 text-xs font-bold bg-green-100 px-2 py-1 rounded">
                                                DIVIDEND
                                              </span>
                                            )}
                                            {row.isFactory && (
                                              <span className="ml-2 bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded">
                                                FACTORY
                                              </span>
                                            )}
                                        </td>
                                        <td className={`${tdClass} text-right text-gray-500`}>
                                            {Math.round(
                                              row.ramziPocket /
                                                (row.ramziPocket > 0
                                                  ? (1 - inputs.taxRateRamzi)
                                                  : (1 + inputs.transferFriction))
                                            ).toLocaleString()}
                                        </td>
                                        <td className={`${tdClass} text-right font-bold bg-blue-50 ${row.ramziPocket > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {row.ramziPocket.toLocaleString()}
                                        </td>
                                        <td className={`${tdClass} text-right font-bold bg-green-50 ${row.mahdiPocket > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {row.mahdiPocket.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: SUMMARY */}
            {activeTab === 'summary' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900 text-white rounded-xl shadow-lg overflow-hidden">
                        <div className="p-6 border-b border-slate-800">
                            <h3 className="text-xl font-bold">Ramzi (Canada)</h3>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Total Cash Invested (15Y):</span>
                                <span className="text-red-400 font-mono text-lg">-€{Math.round(calculations.cumulativeInvRamzi).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Net Cash Extracted:</span>
                                <span className="text-green-400 font-mono text-lg">+€{Math.round(calculations.cumulativeCashRamzi).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center border-t border-slate-700 pt-4">
                                <span className="text-blue-300">Asset Share (50%):</span>
                                <span className="text-blue-300 font-mono text-lg">€{Math.round(calculations.totalAssetValue / 2).toLocaleString()}</span>
                            </div>
                            <div className="bg-slate-800 p-4 rounded-lg text-center mt-2">
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Wealth Creation</p>
                                <p className="text-3xl font-bold text-white">
                                  €{Math.round(calculations.cumulativeCashRamzi + (calculations.totalAssetValue/2)).toLocaleString()}
                                </p>
                                <p className="text-sm text-blue-400 font-bold mt-2 bg-blue-900/30 inline-block px-3 py-1 rounded-full">
                                    ROI: {((calculations.cumulativeCashRamzi + (calculations.totalAssetValue/2)) / calculations.cumulativeInvRamzi).toFixed(1)}x
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 text-white rounded-xl shadow-lg overflow-hidden">
                        <div className="p-6 border-b border-slate-800">
                            <h3 className="text-xl font-bold">Mahdi (France)</h3>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Total Cash Invested (15Y):</span>
                                <span className="text-red-400 font-mono text-lg">-€{Math.round(calculations.cumulativeInvMahdi).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Net Cash Extracted:</span>
                                <span className="text-green-400 font-mono text-lg">+€{Math.round(calculations.cumulativeCashMahdi).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center border-t border-slate-700 pt-4">
                                <span className="text-blue-300">Asset Share (50%):</span>
                                <span className="text-blue-300 font-mono text-lg">€{Math.round(calculations.totalAssetValue / 2).toLocaleString()}</span>
                            </div>
                            <div className="bg-slate-800 p-4 rounded-lg text-center mt-2">
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Wealth Creation</p>
                                <p className="text-3xl font-bold text-white">
                                  €{Math.round(calculations.cumulativeCashMahdi + (calculations.totalAssetValue/2)).toLocaleString()}
                                </p>
                                <p className="text-sm text-blue-400 font-bold mt-2 bg-blue-900/30 inline-block px-3 py-1 rounded-full">
                                    ROI: {((calculations.cumulativeCashMahdi + (calculations.totalAssetValue/2)) / calculations.cumulativeInvMahdi).toFixed(1)}x
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2 bg-blue-50 rounded-xl border border-blue-100 p-6">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                                    {/* Icon placeholder removed */}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-blue-900">Asset Valuation (Year 15)</h3>
                                    <ul className="text-sm text-blue-700 mt-1 space-y-1">
                                        <li>• 48 Hectares Mature Orchard</li>
                                        <li>• Operational Chemical Factory</li>
                                        <li>• Business Goodwill (4x Net Profit)</li>
                                    </ul>
                                </div>
                            </div>
                            <div className="text-right bg-white px-6 py-4 rounded-lg shadow-sm border border-blue-100">
                                <p className="text-sm text-slate-400 uppercase font-medium mb-1">Conservative Estimate</p>
                                <h2 className="text-4xl font-bold text-slate-800">€{calculations.totalAssetValue.toLocaleString()}</h2>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

// Mount the app into #root
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<FinancialModel />);
