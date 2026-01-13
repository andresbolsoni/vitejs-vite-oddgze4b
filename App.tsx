
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Employee, KPIType, CalculationResult, EmployeePerformance, EmployeeRole, MonthlyHistory } from './types';
import EmployeeCard from './components/EmployeeCard';
import KPICalculator from './components/KPICalculator';
import { getBonusPercentage, formatCurrency } from './services/calculator';
import { KPI_LABELS } from './constants';

const App: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('kpi_employees');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [history, setHistory] = useState<MonthlyHistory>(() => {
    const saved = localStorage.getItem('kpi_history_v2');
    return saved ? JSON.parse(saved) : {};
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRHModal, setShowRHModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: '', baseSalary: '', role: EmployeeRole.EQUIPE });
  const [currentSelectedResults, setCurrentSelectedResults] = useState<CalculationResult[]>([]);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const currentMonthPerformance = useMemo(() => history[currentMonth] || {}, [history, currentMonth]);

  useEffect(() => {
    localStorage.setItem('kpi_employees', JSON.stringify(employees));
    if (employees.length > 0 && !selectedId) setSelectedId(employees[0].id);
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('kpi_history_v2', JSON.stringify(history));
  }, [history]);

  const selectedEmployee = useMemo(() => employees.find(e => e.id === selectedId), [employees, selectedId]);

  const totals = useMemo(() => {
    let totalBase = 0;
    let totalPrize = 0;
    employees.forEach(emp => {
      totalBase += emp.baseSalary;
      const perf = currentMonthPerformance[emp.id] || {};
      Object.values(KPIType).forEach(type => {
        const pct = getBonusPercentage(type, perf[type] || 0, emp.role);
        totalPrize += (emp.baseSalary * pct) / 100;
      });
    });
    return { totalBase, totalPrize, totalGeneral: totalBase + totalPrize };
  }, [employees, currentMonthPerformance]);

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
      const lines = text.split(/\r?\n/);
      
      const newEmployeesList = [...employees];
      const newHistory = { ...history };
      const monthData = newHistory[currentMonth] || {};

      // Pular cabeçalho (Linha 1)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Suporta vírgula ou ponto-e-vírgula
        const parts = line.includes(';') ? line.split(';') : line.split(',');
        if (parts.length < 3) continue;

        const [name, roleStr, salaryStr, bsc, gerencial, mat, special] = parts.map(p => p.trim());
        const nameUpper = name.toUpperCase();
        const baseSalary = parseFloat(salaryStr.replace('R$', '').replace('.', '').replace(',', '.')) || 0;
        const role = roleStr.toUpperCase().includes('GERENTE') ? EmployeeRole.GERENTE : EmployeeRole.EQUIPE;

        // 1. Verificar se colaborador já existe
        let emp = newEmployeesList.find(e => e.name === nameUpper);
        if (!emp) {
          emp = { id: Date.now().toString() + i, name: nameUpper, baseSalary, role };
          newEmployeesList.push(emp);
        } else {
          // Atualiza salário se já existir
          emp.baseSalary = baseSalary;
          emp.role = role;
        }

        // 2. Lançar performances
        monthData[emp.id] = {
          [KPIType.MONTHLY_BSC]: parseFloat(bsc) || 0,
          [KPIType.QUARTERLY_GERENCIAL]: parseFloat(gerencial) || 0,
          [KPIType.MONTHLY_MAT]: parseFloat(mat) || 0,
          [KPIType.QUARTERLY_SPECIAL]: parseFloat(special) || 0,
        };
      }

      setEmployees(newEmployeesList);
      setHistory({ ...newHistory, [currentMonth]: monthData });
      alert("Importação concluída! Dados carregados com sucesso.");
      if (csvInputRef.current) csvInputRef.current.value = '';
    };
    reader.readAsText(file, 'ISO-8859-1'); // Encoding comum para CSVs do Excel Brasil
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

  const handleDeleteEmployee = (id: string) => {
    if (confirm("Remover este colaborador permanentemente?")) {
      setEmployees(prev => prev.filter(e => e.id !== id));
      if (selectedId === id) setSelectedId(null);
    }
  };

  const exportToCSV = () => {
    const monthLabel = new Date(currentMonth + "-01").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    let csv = `\uFEFFNome;Perfil;Salario;Vendas BSC;Orcamento Gerencial;Gerencial MAT;Especial;Total Premiacao\n`;
    
    employees.forEach(emp => {
      const perf = currentMonthPerformance[emp.id] || {};
      let line = `${emp.name};${emp.role};${emp.baseSalary.toFixed(2)}`;
      let total = 0;
      Object.values(KPIType).forEach(type => {
        const valRaw = perf[type] || 0;
        const bonusPct = getBonusPercentage(type, valRaw, emp.role);
        const bonusVal = (emp.baseSalary * bonusPct) / 100;
        total += bonusVal;
        line += `;${valRaw}`;
      });
      line += `;${total.toFixed(2)}\n`;
      csv += line;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Premiacao_${currentMonth}.csv`;
    link.click();
  };

  const copyTableToClipboard = () => {
    const monthLabel = new Date(currentMonth + "-01").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    let text = `RELATÓRIO DE PREMIAÇÃO - ${monthLabel.toUpperCase()}\n\n`;
    text += "NOME\tPERFIL\tSALARIO\t" + Object.values(KPIType).map(t => KPI_LABELS[t]).join("\t") + "\tTOTAL\n";
    
    employees.forEach(emp => {
      const perf = currentMonthPerformance[emp.id] || {};
      let total = 0;
      let line = `${emp.name}\t${emp.role}\t${emp.baseSalary.toFixed(2)}`;
      Object.values(KPIType).forEach(type => {
        const pct = getBonusPercentage(type, perf[type] || 0, emp.role);
        const val = (emp.baseSalary * pct) / 100;
        total += val;
        line += `\t${val.toFixed(2)}`;
      });
      line += `\t${total.toFixed(2)}\n`;
      text += line;
    });

    navigator.clipboard.writeText(text);
    alert("Dados copiados! Agora você pode colar direto no Excel.");
  };

  const exportBackup = () => {
    const data = { employees, history };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `backup_premiacoes_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const importBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.employees && data.history) {
          if (confirm("Isso substituirá todos os seus dados atuais. Continuar?")) {
            setEmployees(data.employees);
            setHistory(data.history);
            alert("Backup restaurado com sucesso!");
          }
        }
      } catch (err) {
        alert("Erro ao ler o arquivo de backup.");
      }
    };
    reader.readAsText(file);
  };

  const totalBonusForSelected = currentSelectedResults.reduce((acc, curr) => acc + curr.bonusValue, 0);

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
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
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-blue-200 shadow-lg cursor-pointer transition-transform hover:scale-110 active:scale-95" onClick={exportBackup} title="Clique para baixar backup geral">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </div>
            <div className="border-r border-gray-100 pr-4 mr-2">
              <h1 className="text-xl font-black text-gray-900 tracking-tight">Cálculo de Premiação</h1>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Painel de Gestão Mensal</p>
            </div>
            
            <div className="flex flex-col">
              <label className="text-[10px] font-black text-blue-600 uppercase mb-1">Mês de Referência</label>
              <select 
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="bg-blue-50 text-blue-700 font-bold py-1.5 px-3 rounded-lg border-none focus:ring-2 focus:ring-blue-200 outline-none text-sm cursor-pointer"
              >
                {monthOptions.map(m => (
                  <option key={m.val} value={m.val}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <label className="cursor-pointer px-4 py-2.5 bg-gray-50 text-gray-400 hover:text-blue-600 rounded-xl text-sm font-bold transition-all border border-transparent hover:border-blue-200 flex items-center gap-2" title="Subir Planilha CSV (Nome;Perfil;Salario;BSC;Gerencial;MAT;Especial)">
              <input ref={csvInputRef} type="file" className="hidden" accept=".csv" onChange={handleCSVImport} />
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Importar CSV
            </label>
            <button onClick={() => setShowRHModal(true)} className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Lista p/ RH
            </button>
            <button onClick={() => setShowAddModal(true)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-100 transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Novo Perfil
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1">
          <div className="sticky top-28 space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Equipe Cadastrada</h2>
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-2 custom-scrollbar space-y-3">
              {employees.map(emp => (
                <EmployeeCard 
                  key={emp.id} 
                  employee={emp} 
                  isSelected={selectedId === emp.id} 
                  onSelect={(e) => setSelectedId(e.id)} 
                  onDelete={handleDeleteEmployee} 
                />
              ))}
              {employees.length === 0 && (
                <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-gray-100 text-center text-gray-300 text-sm italic">
                  Use o botão "Importar CSV" ou "Novo Perfil".
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="lg:col-span-3">
          {selectedEmployee ? (
            <div className="animate-fade-in space-y-6">
              <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 opacity-50"></div>
                <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">{selectedEmployee.name}</h2>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        selectedEmployee.role === EmployeeRole.GERENTE ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {selectedEmployee.role}
                      </span>
                    </div>
                    <p className="text-gray-500 font-medium">
                      Salário Base: <span className="text-gray-900 font-bold">{formatCurrency(selectedEmployee.baseSalary)}</span> 
                      <span className="mx-3 text-gray-200">|</span> 
                      Mês: <span className="text-blue-600 font-bold uppercase">{monthOptions.find(m => m.val === currentMonth)?.label}</span>
                    </p>
                  </div>
                  <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-xl shadow-blue-100 min-w-[260px] transform hover:scale-105 transition-transform">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Prêmio do Mês</p>
                    <p className="text-4xl font-black">{formatCurrency(totalBonusForSelected)}</p>
                  </div>
                </div>
              </div>

              <KPICalculator 
                employee={selectedEmployee} 
                performance={currentMonthPerformance[selectedId!] || {}}
                onPerformanceChange={handlePerformanceChange}
                onCalculatedResults={setCurrentSelectedResults}
              />
            </div>
          ) : (
            <div className="h-[600px] flex flex-col items-center justify-center border-4 border-dashed border-gray-100 rounded-[48px] bg-white/50 p-12 text-center">
              <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-8 animate-bounce">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-4 tracking-tight uppercase">Carga em Lote Disponível!</h2>
              <p className="text-gray-500 max-w-md mx-auto font-medium mb-10">Você pode subir sua planilha do Excel de uma vez só:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black mb-4">A</div>
                  <p className="font-black text-xs text-gray-900 uppercase mb-1">Planilha Excel</p>
                  <p className="text-xs text-gray-400 font-medium">Crie as colunas: Nome, Perfil, Salário, BSC, Gerencial, MAT e Especial.</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black mb-4">B</div>
                  <p className="font-black text-xs text-gray-900 uppercase mb-1">Salvar como CSV</p>
                  <p className="text-xs text-gray-400 font-medium">No Excel, use "Salvar Como" e escolha o formato CSV (separado por vírgula).</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black mb-4">C</div>
                  <p className="font-black text-xs text-gray-900 uppercase mb-1">Importar</p>
                  <p className="text-xs text-gray-400 font-medium">Clique em "Importar CSV" no topo e pronto! Tudo preenchido.</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* RH Modal Detalhado */}
      {showRHModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[40px] w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-10 border-b flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-3xl font-black text-gray-900 mb-1">Folha de Prêmios</h2>
                <p className="text-gray-500 font-medium">{monthOptions.find(m => m.val === currentMonth)?.label} - Detalhamento por KPI</p>
              </div>
              <div className="flex gap-3">
                <button onClick={copyTableToClipboard} className="bg-blue-50 text-blue-700 px-6 py-4 rounded-2xl text-sm font-black hover:bg-blue-100 transition-all flex items-center gap-2">
                   Copiar p/ Excel
                </button>
                <button onClick={exportToCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl text-sm font-black shadow-lg shadow-emerald-100 transition-all flex items-center gap-2">
                   Baixar CSV
                </button>
                <button onClick={() => setShowRHModal(false)} className="bg-white text-gray-400 p-4 rounded-2xl border border-gray-200 transition-transform hover:scale-105">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-10 custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b">
                    <th className="py-5 pr-4">Colaborador</th>
                    <th className="py-5 px-4 text-right">Base</th>
                    {Object.values(KPIType).map(t => (
                      <th key={t} className="py-5 px-4 text-center text-blue-600/60 font-black">{KPI_LABELS[t].split('-')[1]}</th>
                    ))}
                    <th className="py-5 pl-4 text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {employees.map(emp => {
                    const perf = currentMonthPerformance[emp.id] || {};
                    let totalEmpPrize = 0;
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-5 pr-4">
                          <p className="font-black text-gray-900 uppercase leading-none mb-1">{emp.name}</p>
                          <span className="text-[9px] font-black text-gray-400 uppercase">{emp.role}</span>
                        </td>
                        <td className="py-5 px-4 text-right font-bold text-gray-400">{formatCurrency(emp.baseSalary)}</td>
                        {Object.values(KPIType).map(type => {
                          const pct = getBonusPercentage(type, perf[type] || 0, emp.role);
                          const val = (emp.baseSalary * pct) / 100;
                          totalEmpPrize += val;
                          return (
                            <td key={type} className="py-5 px-4 text-center font-bold">
                              <p className={val > 0 ? "text-blue-600" : "text-gray-200"}>{val > 0 ? formatCurrency(val) : '-'}</p>
                            </td>
                          );
                        })}
                        <td className="py-5 pl-4 text-right">
                           <span className="font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                             {formatCurrency(totalEmpPrize)}
                           </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {employees.length === 0 && <div className="py-20 text-center text-gray-300 font-black uppercase">Sem dados para este mês.</div>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[40px] w-full max-w-md p-10 shadow-2xl">
            <h2 className="text-3xl font-black text-gray-900 mb-6">Novo Colaborador</h2>
            <form onSubmit={handleAddEmployee} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nome Completo</label>
                <input 
                  autoFocus required 
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold uppercase transition-all"
                  value={newEmployee.name} 
                  onChange={(e) => setNewEmployee(p => ({ ...p, name: e.target.value }))} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Perfil</label>
                  <select 
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold cursor-pointer"
                    value={newEmployee.role} 
                    onChange={(e) => setNewEmployee(p => ({ ...p, role: e.target.value as EmployeeRole }))}
                  >
                    <option value={EmployeeRole.EQUIPE}>Equipe</option>
                    <option value={EmployeeRole.GERENTE}>Gerente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Salário (R$)</label>
                  <input 
                    type="number" step="0.01" required 
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold transition-all"
                    value={newEmployee.baseSalary} 
                    onChange={(e) => setNewEmployee(p => ({ ...p, baseSalary: e.target.value }))} 
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 text-gray-500 font-black uppercase text-xs">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
