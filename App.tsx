
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
      const monthData = { ...(newHistory[currentMonth] || {}) };

      // Pular cabeçalho (Linha 1)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Suporta vírgula ou ponto-e-vírgula (padrão Excel BR)
        const parts = line.includes(';') ? line.split(';') : line.split(',');
        if (parts.length < 3) continue;

        // Formato esperado: Nome; Perfil; Salário; BSC; Gerencial; MAT; Especial
        const [name, roleStr, salaryStr, bsc, gerencial, mat, special] = parts.map(p => p?.trim() || "0");
        
        const nameUpper = name.toUpperCase();
        // Trata números brasileiros: 1.500,00 -> 1500.00
        const parseNum = (val: string) => parseFloat(val.replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0;
        
        const baseSalary = parseNum(salaryStr);
        const role = roleStr.toUpperCase().includes('GERENTE') ? EmployeeRole.GERENTE : EmployeeRole.EQUIPE;

        // 1. Verificar se colaborador já existe pelo nome
        let emp = newEmployeesList.find(e => e.name === nameUpper);
        if (!emp) {
          emp = { id: (Date.now() + i).toString(), name: nameUpper, baseSalary, role };
          newEmployeesList.push(emp);
        } else {
          // Se já existe, atualiza apenas o salário e perfil caso tenham mudado na planilha
          emp.baseSalary = baseSalary;
          emp.role = role;
        }

        // 2. Lançar performances para o mês atual
        monthData[emp.id] = {
          [KPIType.MONTHLY_BSC]: parseNum(bsc),
          [KPIType.QUARTERLY_GERENCIAL]: parseNum(gerencial),
          [KPIType.MONTHLY_MAT]: parseNum(mat),
          [KPIType.QUARTERLY_SPECIAL]: parseNum(special),
        };
      }

      setEmployees(newEmployeesList);
      setHistory({ ...newHistory, [currentMonth]: monthData });
      alert("Sucesso! A planilha foi processada e os valores foram atualizados para este mês.");
      if (csvInputRef.current) csvInputRef.current.value = '';
    };
    // Encoding ISO-8859-1 para evitar erros de acentuação do Excel em Português
    reader.readAsText(file, 'ISO-8859-1');
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
    let csv = `\uFEFFNome;Perfil;Salário;Vendas BSC;Orçamento Gerencial;Gerencial MAT;Especial;Total Premiação\n`;
    employees.forEach(emp => {
      const perf = currentMonthPerformance[emp.id] || {};
      let total = 0;
      let line = `${emp.name};${emp.role};${emp.baseSalary.toFixed(2)}`;
      Object.values(KPIType).forEach(type => {
        const val = perf[type] || 0;
        const bonusPct = getBonusPercentage(type, val, emp.role);
        total += (emp.baseSalary * bonusPct) / 100;
        line += `;${val}`;
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
            <div className="bg-blue-600 p-2.5 rounded-xl text-white">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2"/></svg>
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">Cálculo de Premiação</h1>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Painel de Gestão</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <label className="text-[10px] font-black text-blue-600 uppercase mb-1">Mês de Referência</label>
              <select 
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="bg-blue-50 text-blue-700 font-bold py-1.5 px-3 rounded-lg border-none outline-none text-sm"
              >
                {monthOptions.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
              </select>
            </div>

            <div className="h-8 w-px bg-gray-100 mx-2"></div>

            <div className="flex gap-2">
              <label className="cursor-pointer px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border border-emerald-100 shadow-sm">
                <input ref={csvInputRef} type="file" className="hidden" accept=".csv" onChange={handleCSVImport} />
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 8l-4-4m0 0L8 8m4-4v12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Importar Planilha
              </label>
              <button onClick={() => setShowRHModal(true)} className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm">
                Lista p/ RH
              </button>
              <button onClick={() => setShowAddModal(true)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-100 transition-all flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2"/></svg>
                Novo Perfil
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1">
          <div className="sticky top-28 space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Equipe Cadastrada</h2>
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-2 custom-scrollbar space-y-3">
              {employees.map(emp => (
                <EmployeeCard key={emp.id} employee={emp} isSelected={selectedId === emp.id} onSelect={(e) => setSelectedId(e.id)} onDelete={handleDeleteEmployee} />
              ))}
              {employees.length === 0 && (
                <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-gray-100 text-center text-gray-300 text-sm italic">
                  Vazio. Use "Importar Planilha".
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="lg:col-span-3">
          {selectedEmployee ? (
            <div className="animate-fade-in space-y-6">
              <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">{selectedEmployee.name}</h2>
                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{selectedEmployee.role}</span>
                  </div>
                  <p className="text-gray-500 font-medium">Salário Base: <span className="text-gray-900 font-bold">{formatCurrency(selectedEmployee.baseSalary)}</span></p>
                </div>
                <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-xl shadow-blue-100 min-w-[260px]">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Prêmio Total do Mês</p>
                  <p className="text-4xl font-black">{formatCurrency(totalBonusForSelected)}</p>
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
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2"/></svg>
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2 uppercase">Pronto para importar!</h2>
              <p className="text-gray-500 mb-8 max-w-sm font-medium">Você pode carregar todos os seus colaboradores e seus resultados de uma vez só usando uma planilha Excel.</p>
              
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-left w-full max-w-lg">
                <p className="text-[10px] font-black text-blue-600 uppercase mb-4 tracking-widest">Colunas necessárias no seu CSV:</p>
                <code className="block bg-gray-50 p-4 rounded-xl text-xs text-gray-600 font-mono break-all leading-relaxed">
                  Nome; Perfil; Salário; BSC; Gerencial; MAT; Especial
                </code>
                <p className="mt-4 text-[10px] text-gray-400 italic font-medium">* Salve seu Excel como "CSV Separado por Vírgulas" antes de importar.</p>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* RH Modal */}
      {showRHModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-md">
          <div className="bg-white rounded-[40px] w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-8 border-b flex justify-between items-center bg-gray-50/50">
              <h2 className="text-2xl font-black text-gray-900">Resumo de Pagamento</h2>
              <div className="flex gap-3">
                <button onClick={exportToCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl text-sm font-black transition-all">Baixar Planilha</button>
                <button onClick={() => setShowRHModal(false)} className="bg-white text-gray-400 p-3 rounded-2xl border border-gray-200">X</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-8">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black uppercase text-gray-400 border-b">
                    <th className="pb-4">Colaborador</th>
                    <th className="pb-4 text-right">Salário Base</th>
                    <th className="pb-4 text-right">Total Prêmio</th>
                    <th className="pb-4 text-right">Total Geral</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {employees.map(emp => {
                    const perf = currentMonthPerformance[emp.id] || {};
                    let totalBonus = 0;
                    Object.values(KPIType).forEach(type => {
                      const pct = getBonusPercentage(type, perf[type] || 0, emp.role);
                      totalBonus += (emp.baseSalary * pct) / 100;
                    });
                    return (
                      <tr key={emp.id}>
                        <td className="py-4">
                          <p className="font-bold text-gray-900 uppercase">{emp.name}</p>
                          <p className="text-[10px] text-gray-400 font-black">{emp.role}</p>
                        </td>
                        <td className="py-4 text-right font-medium text-gray-500">{formatCurrency(emp.baseSalary)}</td>
                        <td className="py-4 text-right font-black text-blue-600">{formatCurrency(totalBonus)}</td>
                        <td className="py-4 text-right font-black text-gray-900">{formatCurrency(emp.baseSalary + totalBonus)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro Manual */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] w-full max-w-md p-10 shadow-2xl">
            <h2 className="text-2xl font-black text-gray-900 mb-6 uppercase tracking-tight">Novo Colaborador</h2>
            <form onSubmit={handleAddEmployee} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nome Completo</label>
                <input autoFocus required className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none font-bold uppercase transition-all" value={newEmployee.name} onChange={(e) => setNewEmployee(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Perfil</label>
                  <select className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold cursor-pointer" value={newEmployee.role} onChange={(e) => setNewEmployee(p => ({ ...p, role: e.target.value as EmployeeRole }))}>
                    <option value={EmployeeRole.EQUIPE}>Equipe</option>
                    <option value={EmployeeRole.GERENTE}>Gerente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Salário Base</label>
                  <input type="number" step="0.01" required className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold" value={newEmployee.baseSalary} onChange={(e) => setNewEmployee(p => ({ ...p, baseSalary: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 text-gray-400 font-black uppercase text-xs">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-blue-100">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

};

export default App;
