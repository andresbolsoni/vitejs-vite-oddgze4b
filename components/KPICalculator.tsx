import React, { useEffect } from 'react';
import { KPIType, Employee, CalculationResult, EmployeePerformance } from '../types';
import { KPI_LABELS } from '../constants';
import { getBonusPercentage, formatCurrency } from '../services/calculator';

interface Props {
  employee: Employee;
  performance: EmployeePerformance;
  onPerformanceChange: (kpi: KPIType, value: number) => void;
  onCalculatedResults: (results: CalculationResult[]) => void;
}

const KPICalculator: React.FC<Props> = ({ employee, performance, onPerformanceChange, onCalculatedResults }) => {
  useEffect(() => {
    const results: CalculationResult[] = Object.values(KPIType).map(type => {
      const achievement = performance[type] || 0;
      const bonusPct = getBonusPercentage(type, achievement, employee.role);
      const bonusValue = (employee.baseSalary * bonusPct) / 100;
      return { kpiType: type, achievement, bonusPercentage: bonusPct, bonusValue };
    });
    onCalculatedResults(results);
  }, [performance, employee.baseSalary, employee.role, onCalculatedResults]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {Object.entries(KPI_LABELS).map(([type, label]) => {
        const kpiType = type as KPIType;
        const achievement = performance[kpiType] || 0;
        const bonusPct = getBonusPercentage(kpiType, achievement, employee.role);
        const bonusValue = (employee.baseSalary * bonusPct) / 100;
        
        return (
          <div key={type} className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-tight pr-4">{label}</h3>
              {bonusPct > 0 && (
                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[10px] font-black">+{bonusPct}%</span>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <input
                  type="number"
                  placeholder="0"
                  className="w-full pl-4 pr-10 py-4 bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none text-2xl font-black transition-all"
                  value={achievement || ''}
                  onChange={(e) => onPerformanceChange(kpiType, parseFloat(e.target.value) || 0)}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 font-black text-xl">%</span>
              </div>
              
              <div className="text-right min-w-[120px]">
                <p className="text-2xl font-black text-blue-600">{formatCurrency(bonusValue)}</p>
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