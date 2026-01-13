
import { KPIType, PrizeBracket } from './types';

/**
 * ESCALAS CONFORME IMAGENS FORNECIDAS
 */

// Tabela 1 e 3: Mensal BSC / MAT (5.0% a 20.0%)
// Inicia em 90% -> 5% e aumenta 0.5% a cada 1% de atingimento
export const MONTHLY_SCALE_GERENTE: PrizeBracket[] = Array.from({ length: 31 }, (_, i) => ({
  attaining: 90 + i,
  basePercentage: 5 + (i * 0.5)
}));

// Tabela 2: Trimestral Gerencial - GERENTE (10% a 40%)
// Inicia em 90% -> 10% e aumenta 1.0% a cada 1% de atingimento
export const QUARTERLY_SCALE_GERENTE: PrizeBracket[] = Array.from({ length: 31 }, (_, i) => ({
  attaining: 90 + i,
  basePercentage: 10 + i
}));

// Escala Mensal para EQUIPE (Ex: Metade da escala gerente ou proporcional)
export const MONTHLY_SCALE_EQUIPE: PrizeBracket[] = Array.from({ length: 31 }, (_, i) => ({
  attaining: 90 + i,
  basePercentage: 2.5 + (i * 0.25)
}));

// Tabela 4: Trimestral Gerencial - EQUIPE (2.1% a 16.7%)
// Valores exatos extraídos da imagem
export const QUARTERLY_SCALE_EQUIPE: PrizeBracket[] = [
  { attaining: 90, basePercentage: 2.1 }, { attaining: 91, basePercentage: 2.5 },
  { attaining: 92, basePercentage: 2.9 }, { attaining: 93, basePercentage: 3.3 },
  { attaining: 94, basePercentage: 3.7 }, { attaining: 95, basePercentage: 4.2 },
  { attaining: 96, basePercentage: 5.0 }, { attaining: 97, basePercentage: 5.8 },
  { attaining: 98, basePercentage: 6.7 }, { attaining: 99, basePercentage: 7.5 },
  { attaining: 100, basePercentage: 8.3 }, { attaining: 101, basePercentage: 8.7 },
  { attaining: 102, basePercentage: 9.2 }, { attaining: 103, basePercentage: 9.6 },
  { attaining: 104, basePercentage: 10.0 }, { attaining: 105, basePercentage: 10.4 },
  { attaining: 106, basePercentage: 10.8 }, { attaining: 107, basePercentage: 11.2 },
  { attaining: 108, basePercentage: 11.7 }, { attaining: 109, basePercentage: 12.1 },
  { attaining: 110, basePercentage: 12.5 }, { attaining: 111, basePercentage: 12.9 },
  { attaining: 112, basePercentage: 13.3 }, { attaining: 113, basePercentage: 13.7 },
  { attaining: 114, basePercentage: 14.2 }, { attaining: 115, basePercentage: 14.6 },
  { attaining: 116, basePercentage: 15.0 }, { attaining: 117, basePercentage: 15.4 },
  { attaining: 118, basePercentage: 15.8 }, { attaining: 119, basePercentage: 16.2 },
  { attaining: 120, basePercentage: 16.7 },
];

export const KPI_LABELS = {
  [KPIType.MONTHLY_BSC]: "Prêmio Mensal - Vendas BSC",
  [KPIType.QUARTERLY_GERENCIAL]: "Prêmio Trimestral - Orçamento Gerencial",
  [KPIType.MONTHLY_MAT]: "Prêmio Mensal - Gerencial MAT",
  [KPIType.QUARTERLY_SPECIAL]: "Prêmio Trimestral - Especial (Extra)"
};
