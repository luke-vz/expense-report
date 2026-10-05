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

export interface ExpenseCreate {
  title: string;
  amount: number;
  categoryId: string;
  date: string;
  currency?: string;
  note?: string | null;
  receiptUrl?: string | null;
}

export interface ExpenseFilter {
  categoryId?: string;
  from?: string;
  to?: string;
}

const API_BASE = "/api/expenses";

/**
 * List all expenses with optional filters
 */
export async function fetchExpenses(filter?: ExpenseFilter): Promise<Expense[]> {
  const params = new URLSearchParams();
  if (filter?.categoryId) params.append("categoryId", filter.categoryId);
  if (filter?.from) params.append("from", filter.from);
  if (filter?.to) params.append("to", filter.to);

  const res = await fetch(`${API_BASE}?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch expenses");
  return res.json();
}

/**
 * Create a new expense
 */
export async function createExpense(data: ExpenseCreate): Promise<Expense> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create expense");
  return res.json();
}

/**
 * Get a single expense by ID
 */
export async function getExpense(id: string): Promise<Expense> {
  const res = await fetch(`${API_BASE}/${id}`);
  if (!res.ok) throw new Error("Expense not found");
  return res.json();
}

/**
 * Update an expense
 */
export async function updateExpense(id: string, data: Partial<ExpenseCreate>): Promise<Expense> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update expense");
  return res.json();
}

/**
 * Delete an expense
 */
export async function deleteExpense(id: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete expense");
  return res.json();
}
