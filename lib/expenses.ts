// lib/expenses.ts
export interface Category {
  id: string;
  name: string;
  expenseCount?: number;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  categoryId: string;
  category: Category;
  date: string; // ISO string
  currency?: string;
  note?: string | null;
  receiptUrl?: string | null;
  installmentGroupId?: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PendingExpense {
  id: string;
  amount: number | null;
  note: string | null;
  photoUrl: string | null;
  createdBy: string | null;
  createdAt: string; // ISO timestamp of the capture
}
