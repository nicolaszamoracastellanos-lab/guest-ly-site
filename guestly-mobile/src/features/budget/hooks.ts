// Budget data hooks. The couple and the planner read the same surface from
// their own route prefix; the server owns the write gate.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, del } from "@/lib/api";
import { useUserSession } from "@/lib/session";

export type ItemStatus = "quoted" | "confirmed" | "pending" | "cancelled";
export type PaymentKind = "paid" | "planned";

export type BudgetRow = {
  id: string;
  name: string;
  currency: string;
  alt_currency: string | null;
  fx_rate: number;
  guest_count: number | null;
  notes: string;
  archived_at: string | null;
};
export type CategoryRow = { id: string; budget_id: string; name: string; sort_order: number };
export type CommentRow = { id: string; author_email: string; author_role: string; body: string; mentions: string[]; created_at: string };
export type ItemRow = {
  id: string;
  budget_id: string;
  category_id: string | null;
  parent_id: string | null;
  title: string;
  qty: number | null;
  unit_price: number | null;
  unit_label: string;
  amount_override: number | null;
  currency: string | null;
  status: ItemStatus;
  vendor: string;
  vendor_id?: string | null;
  note: string;
  comments: CommentRow[];
  sort_order: number;
  created_at: string;
};
export type PaymentRow = {
  id: string;
  item_id: string;
  amount: number;
  currency: string | null;
  paid_on: string;
  kind: PaymentKind;
  method: string;
  paid_by: string;
  reimbursable: boolean;
  note: string;
};
export type ComputedItem = {
  row: ItemRow;
  children: ComputedItem[];
  payments: PaymentRow[];
  subtotalBase: number | null;
  totalBase: number | null;
  paidBase: number;
  plannedBase: number;
  balanceBase: number | null;
  unpriced: boolean;
  hasForeignCurrency: boolean;
};
export type ComputedGroup = {
  category: CategoryRow | null;
  items: ComputedItem[];
  totalBase: number;
  paidBase: number;
  plannedBase: number;
  balanceBase: number;
  unpricedCount: number;
};
export type Totals = {
  totalBase: number;
  paidBase: number;
  plannedBase: number;
  balanceBase: number;
  unpricedCount: number;
  itemCount: number;
  perGuestBase: number | null;
  paidFraction: number;
  reimbursableBase: number;
  byStatus: Record<ItemStatus, number>;
};
export type Computed = {
  budget: BudgetRow;
  groups: ComputedGroup[];
  totals: Totals;
  months: { key: string; paidBase: number; plannedBase: number }[];
  hasForeignCurrency: boolean;
};
export type BudgetSurface = {
  pending: boolean;
  can_edit: boolean;
  budgets: BudgetRow[];
  active: { budget: BudgetRow; categories: CategoryRow[]; items: ItemRow[]; payments: PaymentRow[]; computed: Computed } | null;
  members: { email: string; role: string }[];
  limits: { budgets: number; categories: number; items: number; payments: number };
};

export type ExtractedPayment = { amount: number; paid_on: string; kind: PaymentKind; paid_by: string };
export type ExtractedItem = {
  key: string;
  title: string;
  category: string | null;
  parentKey: string | null;
  vendor: string;
  qty: number | null;
  unit_price: number | null;
  unit_label: string;
  amount_override: number | null;
  currency: string | null;
  status: ItemStatus;
  note: string;
  payments: ExtractedPayment[];
};
export type ExtractedBudget = {
  budget_name: string;
  base_currency: string;
  alt_currency: string | null;
  fx_rate: number;
  guest_count: number | null;
  categories: string[];
  items: ExtractedItem[];
  warnings: string[];
};

/** "/couple/budget" or "/planner/budget", from the signed-in surface. */
export function useBudgetBase(): string {
  const user = useUserSession();
  return user?.me.surface === "planner" ? "/planner/budget" : "/couple/budget";
}

export const BUDGET_KEY = "budget";

export function useBudgetSurface(budgetId?: string | null) {
  const base = useBudgetBase();
  return useQuery({
    queryKey: [BUDGET_KEY, base, budgetId ?? ""],
    queryFn: () => get<BudgetSurface>(budgetId ? `${base}?b=${encodeURIComponent(budgetId)}` : base),
    staleTime: 15_000,
  });
}

/** Thin write helpers; every call invalidates the budget queries. */
export function useBudgetWrites() {
  const base = useBudgetBase();
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: [BUDGET_KEY] });
  const run = async <T>(p: Promise<T>): Promise<T> => {
    const r = await p;
    await done();
    return r;
  };
  return {
    createBudget: (body: Record<string, unknown>) => run(post<{ id: string }>(base, body)),
    updateBudget: (id: string, body: Record<string, unknown>) => run(post<{ id: string }>(`${base}/${id}`, body)),
    archiveBudget: (id: string) => run(post<{ id: string }>(`${base}/${id}/archive`, {})),
    createCategory: (budget_id: string, name: string) => run(post<{ id: string }>(`${base}/categories`, { budget_id, name })),
    renameCategory: (id: string, name: string) => run(post<{ id: string }>(`${base}/categories/${id}`, { name })),
    deleteCategory: (id: string) => run(del<{ id: string }>(`${base}/categories/${id}`)),
    createItem: (body: Record<string, unknown>) => run(post<{ id: string }>(`${base}/items`, body)),
    updateItem: (id: string, body: Record<string, unknown>) => run(post<{ id: string }>(`${base}/items/${id}`, body)),
    deleteItem: (id: string) => run(del<{ id: string }>(`${base}/items/${id}`)),
    reorderItems: (budget_id: string, ordered_ids: string[]) => run(post<{ reordered: true }>(`${base}/items/reorder`, { budget_id, ordered_ids })),
    createPayment: (body: Record<string, unknown>) => run(post<{ id: string }>(`${base}/payments`, body)),
    deletePayment: (id: string) => run(del<{ id: string }>(`${base}/payments/${id}`)),
    addComment: (item_id: string, body: string, mentions: string[]) => run(post<{ item_id: string }>(`${base}/comments`, { item_id, body, mentions })),
    extract: (body: { text?: string; file_base64?: string; filename?: string; mime?: string }) => post<{ extracted: ExtractedBudget }>(`${base}/import/extract`, body),
    commit: (extracted: ExtractedBudget, target_budget_id: string | null) => run(post<{ budgetId: string; items: number; payments: number }>(`${base}/import/commit`, { extracted, target_budget_id })),
  };
}

/** Finds an item anywhere in the computed tree. */
export function findComputedItem(computed: Computed | undefined, id: string): { item: ComputedItem; group: ComputedGroup } | null {
  if (!computed) return null;
  for (const group of computed.groups) {
    const stack = [...group.items];
    while (stack.length) {
      const it = stack.pop()!;
      if (it.row.id === id) return { item: it, group };
      stack.push(...it.children);
    }
  }
  return null;
}
