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
  createdAt: string;
  updatedAt: string;
}
