"use client";

import { useCallback, useEffect, useState } from "react";
import type { Category } from "@/lib/expenses";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  const reload = useCallback(async () => {
    const res = await fetch("/api/categories");
    if (res.ok) setCategories(await res.json());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { categories, reload };
}
