import React, { useState } from "react";
import { Plus, Trash2, ChevronRight, ChevronDown, Edit2, Check, X, FolderOpen, Folder } from "lucide-react";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";

/* ─── Inline Add Modal ─────────────────────────────────────────── */
function AddModal({ title, onConfirm, onClose }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onConfirm(name.trim());
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded p-1">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label mb-1">Name <span className="text-red-500">*</span></label>
            <input
              className="input w-full"
              placeholder="Enter name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
              {saving ? "Saving..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Group Item ────────────────────────────────────────────────── */
function GroupItem({ group, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.item_name);

  const save = async () => {
    if (!name.trim()) return;
    await onEdit("groups", group.id, name.trim(), group);
    setEditing(false);
  };

  return (
    <div className="ml-8 border-l-2 border-dashed border-slate-200 dark:border-slate-700 pl-4 py-1.5">
      <div className="flex items-center gap-2 group/item">
        <span className="w-2 h-px bg-slate-300 dark:bg-slate-600 inline-block flex-shrink-0" />
        <span className="text-slate-400 dark:text-slate-500 text-xs">●</span>
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              className="input py-0.5 text-sm h-7 flex-1 max-w-xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            />
            <button type="button" onClick={save} className="text-green-500 hover:text-green-600"><Check size={14} /></button>
            <button type="button" onClick={() => { setEditing(false); setName(group.item_name); }} className="text-slate-400"><X size={14} /></button>
          </div>
        ) : (
          <span className="text-slate-600 dark:text-slate-300 text-sm flex-1">{group.item_name}</span>
        )}
        {!editing && (
          <div className="opacity-0 group-hover/item:opacity-100 flex items-center gap-1 transition-opacity">
            <button type="button" onClick={() => { setName(group.item_name); setEditing(true); }} className="text-slate-400 hover:text-brand p-0.5 rounded" title="Edit">
              <Edit2 size={12} />
            </button>
            <button type="button" onClick={() => onDelete("groups", group.id)} className="text-slate-400 hover:text-red-500 p-0.5 rounded" title="Delete">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Category Item ─────────────────────────────────────────────── */
function CategoryItem({ category, groups, onEdit, onDelete, onAdd }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.item_name);
  const [showAddGroup, setShowAddGroup] = useState(false);

  const childGroups = groups.filter((g) => g.parent_id === category.id);

  const save = async () => {
    if (!name.trim()) return;
    await onEdit("categories", category.id, name.trim(), category);
    setEditing(false);
  };

  return (
    <div className="ml-5 border-l-2 border-slate-200 dark:border-slate-700 pl-4 py-1.5">
      {showAddGroup && (
        <AddModal
          title="Add Group"
          onConfirm={async (n) => { await onAdd("groups", category.id, n); setShowAddGroup(false); setExpanded(true); }}
          onClose={() => setShowAddGroup(false)}
        />
      )}
      <div className="flex items-center gap-2 group/cat">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-slate-400 hover:text-brand w-4 flex-shrink-0"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              className="input py-0.5 text-sm h-7 flex-1 max-w-xs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            />
            <button type="button" onClick={save} className="text-green-500 hover:text-green-600"><Check size={14} /></button>
            <button type="button" onClick={() => { setEditing(false); setName(category.item_name); }} className="text-slate-400"><X size={14} /></button>
          </div>
        ) : (
          <span className="text-slate-700 dark:text-slate-200 text-sm font-medium flex-1">{category.item_name}</span>
        )}
        {!editing && (
          <div className="opacity-0 group-hover/cat:opacity-100 flex items-center gap-1 transition-opacity">
            <button type="button" onClick={() => { setName(category.item_name); setEditing(true); }} className="text-slate-400 hover:text-brand p-0.5 rounded" title="Edit">
              <Edit2 size={12} />
            </button>
            <button
              type="button"
              onClick={() => setShowAddGroup(true)}
              className="text-slate-400 hover:text-green-600 p-0.5 rounded"
              title="Add Group"
            >
              <Plus size={12} />
            </button>
            <button type="button" onClick={() => onDelete("categories", category.id)} className="text-slate-400 hover:text-red-500 p-0.5 rounded" title="Delete">
              <Trash2 size={12} />
            </button>
          </div>
        )}
        {childGroups.length > 0 && (
          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full flex-shrink-0">
            {childGroups.length} group{childGroups.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {expanded && (
        <div className="mt-1">
          {childGroups.length === 0 ? (
            <div className="ml-8 text-xs text-slate-400 italic py-1.5 flex items-center gap-1.5">
              <span>No groups yet</span>
              <button type="button" onClick={() => setShowAddGroup(true)} className="text-brand hover:underline text-xs font-medium">
                + Add group
              </button>
            </div>
          ) : (
            childGroups.map((g) => (
              <GroupItem key={g.id} group={g} onEdit={onEdit} onDelete={onDelete} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Classification Item ───────────────────────────────────────── */
function ClassificationItem({ classification, categories, groups, onEdit, onDelete, onAdd }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(classification.item_name);
  const [showAddCat, setShowAddCat] = useState(false);

  const childCategories = categories.filter((c) => c.parent_id === classification.id);

  const save = async () => {
    if (!name.trim()) return;
    await onEdit("classifications", classification.id, name.trim(), classification);
    setEditing(false);
  };

  return (
    <div className="border border-slate-100 dark:border-slate-800 rounded-lg mb-3 overflow-hidden">
      {showAddCat && (
        <AddModal
          title="Add Category"
          onConfirm={async (n) => { await onAdd("categories", classification.id, n); setShowAddCat(false); setExpanded(true); }}
          onClose={() => setShowAddCat(false)}
        />
      )}
      <div className="flex items-center gap-2 group/cls px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-slate-500 hover:text-brand w-5 flex-shrink-0"
        >
          {expanded ? <FolderOpen size={16} className="text-amber-400" /> : <Folder size={16} className="text-amber-400" />}
        </button>
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              className="input py-1 text-sm h-8 flex-1 max-w-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            />
            <button type="button" onClick={save} className="text-green-500 hover:text-green-600"><Check size={15} /></button>
            <button type="button" onClick={() => { setEditing(false); setName(classification.item_name); }} className="text-slate-400"><X size={15} /></button>
          </div>
        ) : (
          <span className="text-slate-800 dark:text-slate-100 font-semibold flex-1">{classification.item_name}</span>
        )}
        {!editing && (
          <div className="opacity-0 group-hover/cls:opacity-100 flex items-center gap-1.5 transition-opacity">
            <button type="button" onClick={() => { setName(classification.item_name); setEditing(true); }} className="text-slate-400 hover:text-brand p-1 rounded" title="Edit Classification">
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => setShowAddCat(true)}
              className="text-slate-400 hover:text-green-600 p-1 rounded"
              title="Add Category"
            >
              <Plus size={13} />
            </button>
            <button type="button" onClick={() => onDelete("classifications", classification.id)} className="text-slate-400 hover:text-red-500 p-1 rounded" title="Delete Classification">
              <Trash2 size={13} />
            </button>
          </div>
        )}
        {childCategories.length > 0 && (
          <span className="text-[10px] text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full flex-shrink-0">
            {childCategories.length} {childCategories.length === 1 ? "category" : "categories"}
          </span>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-slate-400 hover:text-brand ml-1 flex-shrink-0"
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
      </div>
      {expanded && (
        <div className="py-2 bg-white dark:bg-slate-900 min-h-8">
          {childCategories.length === 0 ? (
            <div className="ml-6 text-sm text-slate-400 italic py-2 flex items-center gap-2">
              <span>No categories yet</span>
              <button type="button" onClick={() => setShowAddCat(true)} className="text-brand hover:underline text-sm font-medium">
                + Add category
              </button>
            </div>
          ) : (
            childCategories.map((cat) => (
              <CategoryItem
                key={cat.id}
                category={cat}
                groups={groups}
                onEdit={onEdit}
                onDelete={onDelete}
                onAdd={onAdd}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main HierarchyEditor ──────────────────────────────────────── */
export default function HierarchyEditor({ catalogs, reloadSetup }) {
  const classifications = catalogs?.classifications || [];
  const categories = catalogs?.categories || [];
  const groups = catalogs?.groups || [];

  const [showAddClassification, setShowAddClassification] = useState(false);

  const handleAdd = async (kind, parentId = null, providedName = null) => {
    const name = providedName; // always comes from modal now
    if (!name?.trim()) return;
    try {
      await api.post(`/maintenance/setup/catalog/${kind}`, {
        item_name: name.trim(),
        parent_id: parentId || null,
        is_active: true,
        sort_order: 0,
      });
      const kindLabel = kind === "classifications" ? "Classification" : kind === "categories" ? "Category" : "Group";
      toast.success(`${kindLabel} added`);
      reloadSetup();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to add item");
    }
  };

  const handleEdit = async (kind, id, newName, item) => {
    try {
      await api.put(`/maintenance/setup/catalog/${kind}/${id}`, {
        ...item,
        item_name: newName,
      });
      reloadSetup();
      toast.success("Updated successfully");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update");
    }
  };

  const handleDelete = async (kind, id) => {
    if (!window.confirm("Delete this item? Any children will be removed from view.")) return;
    try {
      await api.delete(`/maintenance/setup/catalog/${kind}/${id}`);
      reloadSetup();
      toast.success("Deleted successfully");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete");
    }
  };

  return (
    <>
      {showAddClassification && (
        <AddModal
          title="Add Classification"
          onConfirm={async (n) => { await handleAdd("classifications", null, n); setShowAddClassification(false); }}
          onClose={() => setShowAddClassification(false)}
        />
      )}

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Equipment Classification &amp; Grouping
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hierarchy: <span className="font-medium text-amber-600">Classification</span> → <span className="font-medium text-blue-600">Category</span> → <span className="font-medium text-green-600">Group</span>. Hover any row for controls.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary flex items-center gap-2 text-sm"
            onClick={() => setShowAddClassification(true)}
          >
            <Plus size={15} /> Add Classification
          </button>
        </div>

        <div className="p-4">
          {classifications.length === 0 ? (
            <div className="text-center py-14 text-slate-400">
              <div className="text-5xl mb-3">🗂️</div>
              <div className="font-semibold text-slate-500">No classifications yet</div>
              <div className="text-sm mt-1">Click "Add Classification" to get started</div>
            </div>
          ) : (
            classifications.map((cls) => (
              <ClassificationItem
                key={cls.id}
                classification={cls}
                categories={categories}
                groups={groups}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAdd={handleAdd}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
