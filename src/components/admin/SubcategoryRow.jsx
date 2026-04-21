export default function SubcategoryRow({ subcategory, onUpdateSub, onDeleteSub }) {
  return (
    <div style={{ padding: '6px 14px', color: 'var(--text-sec)', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
      {subcategory.name} — <em style={{ color: 'var(--text-dim)' }}>full edit coming in Task 19</em>
    </div>
  );
}
