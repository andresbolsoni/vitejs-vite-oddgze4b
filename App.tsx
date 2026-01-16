
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Employee, KPIType, CalculationResult, EmployeeRole, MonthlyHistory } from './types';
import EmployeeCard from './components/EmployeeCard';
import KPICalculator from './components/KPICalculator';
import { KPI_LABELS } from './constants';
import { getBonusPercentage, formatCurrency, calculateBonusValue } from './services/calculator';

const DB_KEY = 'APP_PREMIACAO_V1';

const KPI_CODE_MAP: Record<string, KPIType> = {
  'VENDAS_BSC': KPIType.MONTHLY_BSC,
  'GERENCIAL_MAT': KPIType.MONTHLY_MAT,
  'RESULTADO_GERENCIAL': KPIType.QUARTERLY_GERENCIAL,
  'EBITDA': KPIType.ANNUAL_EBITDA
};

const App: React.FC = () => {
  // --- ESTADOS DA APLICAÇÃO ---
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [history, setHistory] = useState<MonthlyHistory>({});
  const [showSalaries, setShowSalaries] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRHModal, setShowRHModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', baseSalary: '', role: EmployeeRole.EQUIPE });
  const [currentSelectedResults, setCurrentSelectedResults] = useState<CalculationResult[]>([]);
  
  const excelInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const currentMonthPerformance = useMemo(() => history[currentMonth] || {}, [history, currentMonth]);

  // --- PERSISTÊNCIA (LOAD) ---
  useEffect(() => {
    const savedData = localStorage.getItem(DB_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setEmployees(parsed.employees || []);
        setHistory(parsed.history || {});
        setShowSalaries(parsed.showSalaries ?? true);
        if (parsed.currentMonth) setCurrentMonth(parsed.currentMonth);
        if (parsed.employees?.length > 0) setSelectedId(parsed.employees[0].id);
      } catch (e) {
        console.error("Erro ao carregar bando de dados local", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // --- PERSISTÊNCIA (SAVE) ---
  useEffect(() => {
    if (!isLoaded) return;
    const stateToSave = {
      employees,
      history,
      showSalaries,
      currentMonth
    };
    localStorage.setItem(DB_KEY, JSON.stringify(stateToSave));
  }, [employees, history, showSalaries, currentMonth, isLoaded]);

  // --- FUNÇÃO AUXILIAR: GARANTIR CARREGAMENTO DA LIB EXCEL ---
  const ensureXlsxLoaded = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).XLSX) {
        resolve((window as any).XLSX);
        return;
      }

      console.log("SheetJS não detectado. Iniciando carregamento dinâmico...");
      const script = document.createElement('script');
      script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
      script.async = true;
      script.onload = () => {
        if ((window as any).XLSX) {
          resolve((window as any).XLSX);
        } else {
          reject(new Error("Falha ao inicializar objeto XLSX após download."));
        }
      };
      script.onerror = () => reject(new Error("Falha ao baixar a biblioteca de Excel do CDN."));
      document.head.appendChild(script);
    });
  };

  // --- FUNÇÕES DE BACKUP ---
  const handleExportBackup = () => {
    const stateToSave = { employees, history, showSalaries, timestamp: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(stateToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backup_Premiacao_KPI_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.employees && parsed.history) {
          if (confirm("Isso irá substituir todos os dados atuais. Deseja continuar?")) {
            setEmployees(parsed.employees);
            setHistory(parsed.history);
            if (parsed.employees.length > 0) setSelectedId(parsed.employees[0].id);
            alert("✅ Backup restaurado com sucesso!");
          }
        } else {
          alert("Arquivo de backup inválido.");
        }
      } catch (err) {
        alert("Erro ao ler arquivo de backup.");
      }
    };
    reader.readAsText(file);
    if (backupInputRef.current) backupInputRef.current.value = "";
  };

  // --- LÓGICA DE NEGÓCIO ---
  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedId);
  }, [employees, selectedId]);

  const parseNum = (val: string | number): number => {
    if (typeof val === 'number') return val;
    if (!val || val === "0") return 0;
    let clean = val.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    const result = parseFloat(clean);
    return isNaN(result) ? 0 : result;
  };

  const handlePerformanceChange = (kpi: KPIType, value: number) => {
    if (!selectedId) return;
    setHistory(prev => ({
      ...prev,
      [currentMonth]: {
        ...(prev[currentMonth] || {}),
        [selectedId]: {
          ...(prev[currentMonth]?.[selectedId] || {}),
          [kpi]: value
        }
      }
    }));
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
      if (lines.length < 2) return;
      const delimiter = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(delimiter).map(h => h.trim().toUpperCase());
      
      const idx = {
        name: headers.findIndex(h => ['NOME', 'NOME_COLABORADOR', 'COLABORADOR'].includes(h)),
        role: headers.findIndex(h => ['PERFIL', 'CARGO', 'ROLE'].includes(h)),
        salary: headers.findIndex(h => ['SALÁRIO', 'SALARIO', 'BASE', 'SALARIO_BASE'].includes(h))
      };

      if (idx.name === -1 || idx.salary === -1) {
        alert(`Erro de Colunas CSV.\nEsperado: [NOME, SALARIO]\nEncontrado: [${headers.join(", ")}]`);
        return;
      }

      const newEmployeesList = [...employees];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delimiter).map(p => p.trim());
        if (parts.length < 2) continue;
        const name = parts[idx.name].toUpperCase();
        if (!name) continue;
        const roleStr = idx.role !== -1 ? parts[idx.role].toUpperCase() : "EQUIPE";
        const role = roleStr.includes("GERENTE") ? EmployeeRole.GERENTE : EmployeeRole.EQUIPE;
        const baseSalary = parseNum(parts[idx.salary]);
        
        let emp = newEmployeesList.find(e => e.name === name);
        if (!emp) {
          emp = { id: (Date.now() + i).toString(), name, baseSalary, role };
          newEmployeesList.push(emp);
        } else {
          emp.baseSalary = baseSalary;
          emp.role = role;
        }
      }
      setEmployees(newEmployeesList);
      alert("✅ Cadastro e Salários atualizados!");
      if (csvInputRef.current) csvInputRef.current.value = "";
    };
    reader.readAsText(file, 'ISO-8859-1');
  };

  // --- IMPORTAÇÃO DE EXCEL (FIX: DYNAMIC LOADING & ASYNC) ---
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 1. Garante que a lib está carregada antes de qualquer processamento
      const xlsxLib = await ensureXlsxLoaded();

      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target?.result;
          if (!arrayBuffer) throw new Error("Não foi possível ler o buffer do arquivo.");

          // Uso de Uint8Array para arquivos binários (.xlsx)
          const data = new Uint8Array(arrayBuffer as ArrayBuffer);
          
          // Acesso via variável retornada pela Promise de carregamento
          const workbook = xlsxLib.read(data, { type: 'array' });
          
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error("O arquivo Excel parece estar vazio ou inválido.");
          }

          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[][] = xlsxLib.utils.sheet_to_json(worksheet, { header: 1 });

          if (!rows || rows.length < 2) {
            throw new Error("Planilha sem dados ou cabeçalhos ausentes.");
          }

          // Normalização de Headers
          const rawHeaders = rows[0].map(h => String(h || "").trim().toUpperCase());

          const findHeaderIdx = (aliases: string[]) => rawHeaders.findIndex(h => aliases.includes(h));

          const idxNome = findHeaderIdx(['NOME_COLABORADOR', 'NOME', 'COLABORADOR', 'NOME_COLAB', 'EMPLOYEE', 'FUNCIONARIO']);
          const idxKpi = findHeaderIdx(['KPI_CODIGO', 'KPI', 'INDICADOR', 'CODIGO_KPI', 'CODIGO', 'KPI_CODE']);
          const idxValor = findHeaderIdx(['VALOR_REALIZADO', 'VALOR', 'REALIZADO', 'ATINGIMENTO', 'RESULTADO']);

          if (idxNome === -1 || idxKpi === -1 || idxValor === -1) {
            const expected = ["NOME_COLABORADOR", "KPI_CODIGO", "VALOR_REALIZADO"];
            const found = rawHeaders.filter(h => h).join(", ");
            alert(`ERRO DE MAPEAMENTO\n\nEsperado: [${expected.join(", ")}]\nEncontrado: [${found || "Nenhuma coluna identificada"}]\n\nVerifique os títulos na primeira linha da planilha.`);
            return;
          }

          const newHistory = { ...history };
          const monthData = { ...(newHistory[currentMonth] || {}) };
          let count = 0;

          rows.slice(1).forEach((row) => {
            if (!row || row.length === 0) return;

            const nomeExcel = String(row[idxNome] || '').toUpperCase().trim();
            const codigoKpi = String(row[idxKpi] || '').toUpperCase().trim();
            const valorRealizado = parseNum(row[idxValor]);

            if (!nomeExcel || !codigoKpi) return;

            const emp = employees.find(e => e.name === nomeExcel);
            if (!emp) return;

            const kpiType = KPI_CODE_MAP[codigoKpi];
            if (!kpiType) return;

            if (!monthData[emp.id]) monthData[emp.id] = {};
            monthData[emp.id][kpiType] = valorRealizado;
            count++;
          });

          setHistory({ ...newHistory, [currentMonth]: monthData });
          alert(`✅ Importação realizada com sucesso!\n\nRegistros processados: ${count}\nMês de Referência: ${currentMonth}`);
          
          if (excelInputRef.current) excelInputRef.current.value = "";
          
        } catch (err: any) {
          console.error("Erro interno no processamento do Excel:", err);
          alert(`FALHA NA LEITURA\n\nMensagem Técnica: ${err.message}`);
        }
      };

      reader.readAsArrayBuffer(file);

    } catch (loadErr: any) {
      console.error("Erro ao carregar SheetJS:", loadErr);
      alert(`FALHA NO SISTEMA\n\nNão foi possível carregar a ferramenta de processamento de Excel. Verifique sua conexão.\nErro: ${loadErr.message}`);
    }
  };

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.name || !newEmployee.baseSalary) return;
    const employee: Employee = {
      id: Date.now().toString(),
      name: newEmployee.name.toUpperCase(),
      baseSalary: parseFloat(newEmployee.baseSalary),
      role: newEmployee.role
    };
    setEmployees(prev => [...prev, employee]);
    setSelectedId(employee.id);
    setNewEmployee({ name: '', baseSalary: '', role: EmployeeRole.EQUIPE });
    setShowAddModal(false);
  };

  const exportToCSV = () => {
    let csv = `\uFEFFNome;Perfil;Salário;Ating. BSC;Prêmio BSC;Ating. MAT;Prêmio MAT;Ating. Trim.;Prêmio Trim.;Ating. EBITDA;Prêmio EBITDA;Total Premiação;Total Bruto\n`;
    employees.forEach(emp => {
      const perf = currentMonthPerformance[emp.id] || {};
      let totalBonus = 0;
      let kpiData = "";
      Object.values(KPIType).forEach(type => {
        const achievement = perf[type] || 0;
        const pct = getBonusPercentage(type, achievement, emp.role);
        const value = calculateBonusValue(type, emp.baseSalary, pct);
        totalBonus += value;
        kpiData += `${achievement.toFixed(2).replace('.', ',')}%;${value.toFixed(2).replace('.', ',')};`;
      });
      csv += `${emp.name};${emp.role};${emp.baseSalary.toFixed(2).replace('.', ',')};${kpiData}${totalBonus.toFixed(2).replace('.', ',')};${(emp.baseSalary + totalBonus).toFixed(2).replace('.', ',')}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_RH_Completo_${currentMonth}.csv`;
    link.click();
  };

  const totalBonusForSelected = currentSelectedResults.reduce((acc, curr) => acc + curr.bonusValue, 0);

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      options.push({ val, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return options;
  }, []);

  return (
    <div className="min-h-screen pb-12 bg-[#f8fafc]">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1440px] mx-auto px-4 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none">KPI Manager</h1>
              <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-1">Enterprise Database</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-grow justify-end overflow-x-auto pb-2 sm:pb-0 custom-scrollbar">
            <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100 gap-1">
              <button onClick={handleExportBackup} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg transition-all" title="Baixar Backup JSON">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              </button>
              <label className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-white rounded-lg transition-all cursor-pointer" title="Restaurar Backup JSON">
                <input ref={backupInputRef} type="file" className="hidden" accept=".json" onChange={handleImportBackup} />
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 16l-4-4m0 0l-4 4m4-4v12M12 4v1m0 0a1 1 0 100 2 1 1 0 000-2z" /></svg>
              </label>
              <div className="w-px h-4 bg-gray-200 mx-1"></div>
              <button onClick={() => setShowSalaries(!showSalaries)} className={`p-2 rounded-lg transition-all ${showSalaries ? 'text-gray-400' : 'text-blue-600 bg-white shadow-sm'}`}>
                {showSalaries ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                )}
              </button>
            </div>

            <div className="h-8 w-px bg-gray-100 mx-1"></div>

            <div className="flex flex-col min-w-[130px]">
              <span className="text-[8px] font-black text-blue-600 uppercase mb-0.5 ml-1">Mês de Referência</span>
              <select value={currentMonth} onChange={(e) => setCurrentMonth(e.target.value)} className="bg-white text-gray-700 font-bold py-1.5 px-3 rounded-xl border border-gray-200 outline-none text-[11px] cursor-pointer hover:border-blue-400 transition-colors">
                {monthOptions.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
              </select>
            </div>

            <label className="cursor-pointer px-4 py-2.5 bg-white text-blue-600 hover:bg-blue-50 rounded-xl text-[11px] font-black transition-all flex items-center gap-2 border border-blue-100 whitespace-nowrap">
              <input ref={csvInputRef} type="file" className="hidden" accept=".csv" onChange={handleCSVImport} />
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth="2" /></svg>
              Importar Cadastro
            </label>

            <label className="cursor-pointer px-4 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-[11px] font-black transition-all flex items-center gap-2 shadow-lg shadow-emerald-50 whitespace-nowrap">
              <input ref={excelInputRef} type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2" /></svg>
              Importar Metas
            </label>

            <button onClick={() => setShowRHModal(true)} className="px-4 py-2.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-xl text-[11px] font-black transition-all whitespace-nowrap">Relatório RH</button>
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-[11px] font-black shadow-lg shadow-blue-50 whitespace-nowrap">Novo +</button>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 space-y-4">
          <div className="flex justify-between items-center ml-1">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Colaboradores ({employees.length})</h2>
          </div>
          <div className="max-h-[calc(100vh-180px)] overflow-y-auto pr-2 custom-scrollbar space-y-3">
            {employees.length > 0 ? (
              employees.map(emp => (
                <EmployeeCard key={emp.id} employee={emp} isSelected={selectedId === emp.id} showSalary={showSalaries} onSelect={(e) => setSelectedId(e.id)} onDelete={(id) => { if(confirm("Remover colaborador e todo seu histórico?")) setEmployees(prev => prev.filter(e => e.id !== id)); }} />
              ))
            ) : (
              <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                 <p className="text-[10px] font-black text-gray-300 uppercase">Nenhum colaborador cadastrado</p>
              </div>
            )}
          </div>
        </aside>

        <section className="lg:col-span-3">
          {selectedEmployee ? (
            <div className="animate-fade-in space-y-6">
              <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight">{selectedEmployee.name}</h2>
                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase">{selectedEmployee.role}</span>
                  </div>
                  <p className="text-gray-500 font-medium">Salário Base: <span className="text-gray-900 font-bold">{showSalaries ? formatCurrency(selectedEmployee.baseSalary) : '••••••'}</span></p>
                </div>
                <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-2xl shadow-blue-100 min-w-[280px] text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Premiação Total - {monthOptions.find(o => o.val === currentMonth)?.label}</p>
                  <p className="text-4xl font-black">{formatCurrency(totalBonusForSelected)}</p>
                </div>
              </div>
              <KPICalculator 
                employee={selectedEmployee} 
                performance={currentMonthPerformance[selectedId || ''] || {}} 
                onPerformanceChange={handlePerformanceChange} 
                onCalculatedResults={setCurrentSelectedResults} 
              />
            </div>
          ) : (
            <div className="h-[500px] flex flex-col items-center justify-center border-4 border-dashed border-gray-100 rounded-[48px] bg-white/50 p-12 text-center">
              <div className="bg-gray-100 p-6 rounded-full mb-6">
                <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth="1" /></svg>
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-tight">Pronto para começar?</h2>
              <p className="text-gray-500 max-w-sm font-medium">Selecione um colaborador da lista lateral ou importe os dados do RH para começar a calcular as metas de <strong>{monthOptions.find(o => o.val === currentMonth)?.label}</strong>.</p>
            </div>
          )}
        </section>
      </main>

      {showRHModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[40px] w-full max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-10 border-b flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-2xl font-black text-gray-900 uppercase">Resumo da Folha - {monthOptions.find(o => o.val === currentMonth)?.label}</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Dados Consolidados</p>
              </div>
              <div className="flex gap-3">
                <button onClick={exportToCSV} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-sm font-black shadow-lg shadow-emerald-50 flex items-center gap-2">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 8l-4-4m0 0L8 8m4-4v12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                   Exportar Relatório Final
                </button>
                <button onClick={() => setShowRHModal(false)} className="bg-gray-100 text-gray-400 p-3 rounded-2xl font-black hover:bg-gray-200 transition-colors">X</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-0 custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1400px]">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b tracking-widest sticky top-0 z-10">
                    <th className="p-6 bg-gray-50">Colaborador</th>
                    <th className="p-6 text-right">Salário Base</th>
                    {Object.values(KPIType).map(type => (
                      <th key={type} className="p-6 text-center border-l border-gray-100 bg-white/50">
                        <div className="whitespace-nowrap">{KPI_LABELS[type].replace('Prêmio ', '')}</div>
                        <div className="flex mt-2 justify-center gap-4 text-[8px] opacity-60"><span>Ating.</span><span>Valor (R$)</span></div>
                      </th>
                    ))}
                    <th className="p-6 text-right border-l border-gray-100 bg-blue-50/50 text-blue-600">Total Prêmio</th>
                    <th className="p-6 text-right bg-blue-600 text-white">Total Bruto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {employees.map(emp => {
                    const perf = currentMonthPerformance[emp.id] || {};
                    let totalPrize = 0;
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-6">
                           <div className="font-black text-gray-900 uppercase leading-none">{emp.name}</div>
                           <div className="text-[9px] font-bold text-gray-400 mt-1 uppercase">{emp.role}</div>
                        </td>
                        <td className="p-6 text-right font-bold text-gray-500">{showSalaries ? formatCurrency(emp.baseSalary) : '••••••'}</td>
                        {Object.values(KPIType).map(type => {
                          const achievement = perf[type] || 0;
                          const pct = getBonusPercentage(type, achievement, emp.role);
                          const val = calculateBonusValue(type, emp.baseSalary, pct);
                          totalPrize += val;
                          return (
                            <td key={type} className="p-6 text-center border-l border-gray-100">
                               <div className="flex justify-center items-center gap-4">
                                  <span className={`font-bold text-xs ${achievement >= 90 ? 'text-emerald-600' : 'text-gray-300'}`}>{achievement}%</span>
                                  <span className={`font-black text-xs ${val > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{formatCurrency(val)}</span>
                               </div>
                            </td>
                          );
                        })}
                        <td className="p-6 text-right font-black text-blue-600 border-l border-gray-100 bg-blue-50/30">{formatCurrency(totalPrize)}</td>
                        <td className="p-6 text-right font-black text-gray-900 bg-gray-50/50">{showSalaries ? formatCurrency(emp.baseSalary + totalPrize) : '••••••'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[40px] w-full max-w-md p-10 shadow-2xl">
            <h2 className="text-2xl font-black text-gray-900 mb-8 uppercase">Novo Colaborador</h2>
            <form onSubmit={handleAddEmployee} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Nome Completo</label>
                <input required className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none font-bold uppercase transition-all focus:ring-4 focus:ring-blue-100" value={newEmployee.name} onChange={(e) => setNewEmployee(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Perfil</label>
                  <select className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold" value={newEmployee.role} onChange={(e) => setNewEmployee(p => ({ ...p, role: e.target.value as EmployeeRole }))}>
                    <option value={EmployeeRole.EQUIPE}>Equipe</option>
                    <option value={EmployeeRole.GERENTE}>Gerente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Salário Base</label>
                  <input type="number" step="0.01" required className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold outline-none" value={newEmployee.baseSalary} onChange={(e) => setNewEmployee(p => ({ ...p, baseSalary: e.target.value }))} />
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-100">Salvar Cadastro</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
