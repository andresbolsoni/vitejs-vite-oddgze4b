
export enum KPIType {
  MONTHLY_BSC = 'MONTHLY_BSC',
  QUARTERLY_GERENCIAL = 'QUARTERLY_GERENCIAL',
  MONTHLY_MAT = 'MONTHLY_MAT',
  QUARTERLY_SPECIAL = 'QUARTERLY_SPECIAL'
}

export enum EmployeeRole {
  GERENTE = 'GERENTE',
  EQUIPE = 'EQUIPE'
}

export interface Employee {
  id: string;
  name: string;
  baseSalary: number;
  role: EmployeeRole;
}

export interface EmployeePerformance {
  [kpi: string]: number;
}

// Estrutura: { "2024-03": { "empId1": { MONTHLY_BSC: 100, ... } } }
export interface MonthlyHistory {
  [monthYear: string]: {
    [empId: string]: EmployeePerformance;
  };
}

export interface CalculationResult {
  kpiType: KPIType;
  achievement: number;
  bonusPercentage: number;
  bonusValue: number;
}

export interface PrizeBracket {
  attaining: number;
  basePercentage: number;
}
