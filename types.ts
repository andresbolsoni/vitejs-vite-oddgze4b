
export enum KPIType {
  MONTHLY_BSC = 'MONTHLY_BSC',
  MONTHLY_MAT = 'MONTHLY_MAT',
  QUARTERLY_GERENCIAL = 'QUARTERLY_GERENCIAL',
  ANNUAL_EBITDA = 'ANNUAL_EBITDA'
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
