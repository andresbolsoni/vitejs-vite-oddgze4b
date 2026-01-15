
import React, { useEffect } from 'react';
import { KPIType, Employee, CalculationResult, EmployeePerformance } from '../types';
import { KPI_LABELS } from '../constants';
import { getBonusPercentage, formatCurrency, calculateBonusValue } from '../services/calculator';

interface Props {
  employee: Employee;
  performance: EmployeePerformance;
  onPerformanceChange: (kpi: KPIType, value: number) => void;
  onCalculatedResults: (results: CalculationResult[]) => void;
}

const KPICalculator: React.FC<Props> = ({ employee, performance, onPerformanceChange, onCalculatedResults }) => {
  
  const results: CalculationResult[] = Object.values(KPIType).map(type => {
    const achievement = performance[type] || 0;
    const bonusPct = getBonusPercentage(type, achievement, employee.role);
    const bonusValue = calculateBonusValue(type, employee.baseSalary, bonusPct);
    return { kpiType: type, achievement, bonusPercentage: bonusPct, bonusValue };
  });

  useEffect(() => {
    onCalculatedResults(results);
  }, [performance, employee.baseSalary, employee.role]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {results.map((res) => {
        const label = KPI_LABELS[res.kpiType];
        const isQuarterly = res.kpiType === KPIType.QUARTERLY_GERENCIAL;
        const isAnnual = res.kpiType === KPIType.ANNUAL_EBITDA;
        
        return (
          <div key={res.kpiType} className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-tight pr-4">{label}</h3>
                <p className="text-[9px] text-blue-400 font-bold mt-1">
                  {isQuarterly ? "Base: 3x Salário" : isAnnual ? "Base: Salário Anual" : "Base: Salário Mensal"}
                </p>
              </div>
              {res.bonusPercentage > 0 && (
                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[10px] font-black">+{res.bonusPercentage.toFixed(2)}%</span>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <input
                  type="number"
                  placeholder="0"
                  className="w-full pl-4 pr-10 py-4 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none text-2xl font-black transition-all"
                  value={res.achievement || ''}
                  onChange={(e) => onPerformanceChange(res.kpiType, parseFloat(e.target.value) || 0)}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 font-black text-xl">%</span>
              </div>
              
              <div className="text-right min-w-[120px]">
                <p className="text-2xl font-black text-blue-600">{formatCurrency(res.bonusValue)}</p>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-tighter">Bônus Calculado</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KPICalculator;
