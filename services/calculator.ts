import { KPIType, PrizeBracket, EmployeeRole } from '../types';
import { 
  MONTHLY_SCALE_GERENTE, 
  QUARTERLY_SCALE_GERENTE, 
  MONTHLY_SCALE_EQUIPE, 
  QUARTERLY_SCALE_EQUIPE 
} from '../constants';

export const getBonusPercentage = (kpiType: KPIType, achievement: number, role: EmployeeRole): number => {
  let scale: PrizeBracket[];
  const isGerente = role === EmployeeRole.GERENTE;
  
  // Arredondamos para baixo para encontrar a faixa (ex: 95.7% conta como 95% na tabela)
  const roundedAchievement = Math.floor(achievement);

  if (roundedAchievement < 90) return 0;

  switch (kpiType) {
    case KPIType.MONTHLY_BSC:
    case KPIType.MONTHLY_MAT:
      scale = isGerente ? MONTHLY_SCALE_GERENTE : MONTHLY_SCALE_EQUIPE;
      break;
    case KPIType.QUARTERLY_GERENCIAL:
    case KPIType.QUARTERLY_SPECIAL: // Usando a mesma escala gerencial para o especial por padrão
      scale = isGerente ? QUARTERLY_SCALE_GERENTE : QUARTERLY_SCALE_EQUIPE;
      break;
    default:
      return 0;
  }

  // Busca o valor exato na escala ou o teto de 120%
  if (roundedAchievement >= 120) return scale[scale.length - 1].basePercentage;
  
  const match = scale.find(s => s.attaining === roundedAchievement);
  return match ? match.basePercentage : 0;
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};