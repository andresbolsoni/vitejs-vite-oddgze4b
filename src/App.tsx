import React from 'react';
import { Employee, EmployeeRole } from '../types';
import { formatCurrency } from '../services/calculator';

interface Props {
  employee: Employee;
  isSelected: boolean;
  onSelect: (employee: Employee) => void;
  onDelete: (id: string) => void;
}

const EmployeeCard: React.FC<Props> = ({ employee, isSelected, onSelect, onDelete }) => {
  return (
    <div 
      onClick={() => onSelect(employee)}
      className={`relative cursor-pointer p-4 rounded-xl border transition-all duration-200 ${
        isSelected 
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 shadow-sm' 
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-gray-900 truncate">{employee.name}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
              employee.role === EmployeeRole.GERENTE ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
            }`}>
              {employee.role}
            </span>
          </div>
          <p className="text-sm text-gray-500">Base: {formatCurrency(employee.baseSalary)}</p>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(employee.id); }}
          className="text-gray-300 hover:text-red-500 p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default EmployeeCard;
