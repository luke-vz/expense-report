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
  createdBy?: string | null;
  createdByName?: string | null;
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
  aiStatus: "reading" | "done" | "failed" | null;
  /** What the AI read from the photo (aiStatus "done"); values may be null if unreadable */
  suggestion: {
    amount: number | null;
    currency: string;
    title: string | null;
    categoryId: string | null;
    date: string | null;
    installments: number | null;
  } | null;
}

/** A title already used, with how often and the category used last time (GET /api/suggestions). */
export interface Suggestion {
  title: string;
  categoryId: string;
  count: number;
  lastDate: string;
}
