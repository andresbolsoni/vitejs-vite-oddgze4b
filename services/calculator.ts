
import { KPIType, PrizeBracket, EmployeeRole } from '../types';
import { 
  MONTHLY_SCALE_GERENTE, 
  QUARTERLY_SCALE_GERENTE, 
  ANNUAL_EBITDA_SCALE 
} from '../constants';

export const getBonusPercentage = (kpiType: KPIType, achievement: number, role: EmployeeRole): number => {
  const roundedAchievement = Math.floor(achievement);
  if (roundedAchievement < 90) return 0;
  
  const isGerente = role === EmployeeRole.GERENTE;
  const targetAchievement = Math.min(roundedAchievement, 120);
  
  let scale: PrizeBracket[];
  let percentage = 0;

  switch (kpiType) {
    case KPIType.MONTHLY_BSC:
    case KPIType.MONTHLY_MAT:
      scale = MONTHLY_SCALE_GERENTE;
      const matchM = scale.find(s => s.attaining === targetAchievement);
      percentage = matchM ? matchM.basePercentage : 0;
      // Regra: Equipe ganha 50% da porcentagem do Gerente
      return isGerente ? percentage : percentage / 2;

    case KPIType.QUARTERLY_GERENCIAL:
      scale = QUARTERLY_SCALE_GERENTE;
      const matchQ = scale.find(s => s.attaining === targetAchievement);
      percentage = matchQ ? matchQ.basePercentage : 0;
      // Regra: Equipe ganha 50% da porcentagem do Gerente
      return isGerente ? percentage : percentage / 2;

    case KPIType.ANNUAL_EBITDA:
      scale = ANNUAL_EBITDA_SCALE;
      const matchA = scale.find(s => s.attaining === targetAchievement);
      // Anual é igual para ambos (conforme pedido: "menos no prêmio anual")
      return matchA ? matchA.basePercentage : 0;

    default:
      return 0;
  }
};

export const calculateBonusValue = (kpiType: KPIType, baseSalary: number, percentage: number): number => {
  if (kpiType === KPIType.QUARTERLY_GERENCIAL) {
    // Trimestral base é acumulado de 3 meses
    return (baseSalary * 3 * percentage) / 100;
  }
  if (kpiType === KPIType.ANNUAL_EBITDA) {
    // Anual base é o salário anual (12 meses)
    return (baseSalary * 12 * percentage) / 100;
  }
  // Mensal base é o salário normal
  return (baseSalary * percentage) / 100;
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};
