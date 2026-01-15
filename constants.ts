
import { KPIType, PrizeBracket } from './types';

// ESCALAS GERENTE (Equipe será 50% disso, exceto Anual)

// Mensal BSC e MAT: 90%=10%, 100%=20%, 120%=40%
export const MONTHLY_SCALE_GERENTE: PrizeBracket[] = Array.from({ length: 31 }, (_, i) => ({
  attaining: 90 + i,
  basePercentage: 10 + i
}));

// Trimestral Gerencial: 90%=20%, 100%=40%, 120%=80%
export const QUARTERLY_SCALE_GERENTE: PrizeBracket[] = Array.from({ length: 31 }, (_, i) => ({
  attaining: 90 + i,
  basePercentage: 20 + (i * 2)
}));

/**
 * ESCALA ANUAL EBITDA (Extraída da nova imagem)
 * Base de cálculo: 12 salários anuais
 * 90%  = 0.25 sal (2.08%)
 * 95%  = 0.50 sal (4.17%)
 * 100% = 1.00 sal (8.33%)
 * 110% = 1.50 sal (12.50%)
 * 120% = 2.00 sal (16.67%)
 */
export const ANNUAL_EBITDA_SCALE: PrizeBracket[] = Array.from({ length: 31 }, (_, i) => {
  const attainment = 90 + i;
  let salaryMultiplier = 0;

  if (attainment >= 90 && attainment < 95) {
    // 90% a 95%: de 0.25 a 0.50 sal (sobe 0.05 por %)
    salaryMultiplier = 0.25 + (attainment - 90) * 0.05;
  } else if (attainment >= 95 && attainment <= 100) {
    // 95% a 100%: de 0.50 a 1.00 sal (sobe 0.10 por % - ACELERAÇÃO)
    salaryMultiplier = 0.50 + (attainment - 95) * 0.10;
  } else if (attainment > 100) {
    // 100% a 120%: de 1.00 a 2.00 sal (sobe 0.05 por %)
    salaryMultiplier = 1.00 + (attainment - 100) * 0.05;
  }

  return {
    attaining: attainment,
    // Converte multiplicador de salário para porcentagem da base ANUAL (12 meses)
    basePercentage: (salaryMultiplier / 12) * 100
  };
});

export const KPI_LABELS = {
  [KPIType.MONTHLY_BSC]: "Prêmio Mensal - Vendas BSC",
  [KPIType.MONTHLY_MAT]: "Prêmio Mensal - Gerencial MAT",
  [KPIType.QUARTERLY_GERENCIAL]: "Prêmio Trimestral - Orçamento Gerencial",
  [KPIType.ANNUAL_EBITDA]: "Prêmio Anual - EBITDA Empresa"
};
