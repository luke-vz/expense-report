// app/categories/page.tsx
"use client";

import { useState } from "react";
import { useCategories } from "@/lib/useCategories";

export default function CategoriesPage() {
  const { categories, reload } = useCategories();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [error, setError] = useState("");

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (!res.ok) {
      setError("Ya existe una categoría con ese nombre.");
      return;
    }
    setError("");
    setNewName("");
    reload();
  };

  const renameCategory = async (id: string) => {
    if (!editingName.trim()) return;

    const res = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName }),
    });
    if (!res.ok) {
      setError("No se pudo renombrar. ¿Ya existe una categoría con ese nombre?");
      return;
    }
    setError("");
    setEditingId(null);
    reload();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("¿Seguro que querés eliminar esta categoría?")) return;

    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("No se pudo eliminar la categoría.");
      return;
    }
    setError("");
    reload();
  };

  const mergeCategory = async (id: string) => {
    const source = categories.find((c) => c.id === id);
    const target = categories.find((c) => c.id === mergeTargetId);
    if (!source || !target) return;
    if (!confirm(`Se van a pasar ${source.expenseCount} gastos de "${source.name}" a "${target.name}" y se va a eliminar "${source.name}". ¿Seguís?`)) return;

    const res = await fetch(`/api/categories/${id}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: mergeTargetId }),
    });
    if (!res.ok) {
      setError("No se pudieron unir las categorías.");
      return;
    }
    setError("");
    setMergingId(null);
    reload();
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Categorías</h1>

      <form onSubmit={addCategory} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nueva categoría"
          className="bg-input flex-1 rounded-md p-2"
        />
        <button type="submit" className="bg-boton px-4 py-2 rounded-md">
          Agregar
        </button>
      </form>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <ul className="bg-secundario border-card shadow rounded-md divide-y divide-gray-600">
        {categories.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 p-3">
            {editingId === c.id ? (
              <>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="bg-input flex-1 rounded-md p-1"
                  autoFocus
                />
                <button onClick={() => renameCategory(c.id)} className="text-blue-400 hover:underline">
                  Guardar
                </button>
                <button onClick={() => setEditingId(null)} className="text-gray-400 hover:underline">
                  Cancelar
                </button>
              </>
            ) : mergingId === c.id ? (
              <>
                <span className="flex-1">{c.name} →</span>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="bg-input rounded-md p-1"
                >
                  <option value="">Unir con...</option>
                  {categories
                    .filter((other) => other.id !== c.id)
                    .map((other) => (
                      <option key={other.id} value={other.id}>{other.name}</option>
                    ))}
                </select>
                <button
                  onClick={() => mergeCategory(c.id)}
                  disabled={!mergeTargetId}
                  className="text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  Unir
                </button>
                <button onClick={() => setMergingId(null)} className="text-gray-400 hover:underline">
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <span className="flex-1">{c.name}</span>
                <span className="text-sm text-gray-500">{c.expenseCount} gastos</span>
                <div className="flex gap-3 w-full justify-end sm:w-auto">
                  <button
                    onClick={() => {
                      setEditingId(c.id);
                      setEditingName(c.name);
                    }}
                    className="text-blue-400 hover:underline"
                  >
                    Renombrar
                  </button>
                  {categories.length > 1 && (
                    <button
                      onClick={() => {
                        setMergingId(c.id);
                        setMergeTargetId("");
                      }}
                      className="text-blue-400 hover:underline"
                    >
                      Unir con…
                    </button>
                  )}
                  {c.expenseCount === 0 && (
                    <button onClick={() => deleteCategory(c.id)} className="text-red-400 hover:underline">
                      Eliminar
                    </button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
