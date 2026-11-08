import{M as $,S as q}from"./index-DYg-mHO1.js";import{A as L}from"./AppShell-BTqeME0G.js";function B(C){const b=String(C||"").toLowerCase().trim(),k=(($[b]||{}).features||[]).filter(o=>!o.isExclusive),m=L.filter(o=>String(o.moduleKey||"").toLowerCase()===b),c=new Map;k.forEach(o=>c.set(o.key,o));const h=[],r=new Set;for(const o of m){const e=[];for(const t of o.features||[]){if(r.has(t))continue;const d=c.get(t)||{key:t,label:t.replace(/-/g," ").replace(/\b\w/g,y=>y.toUpperCase())};e.push(d),r.add(t)}e.length>0&&h.push({title:o.title||"General",icon:o.icon||"📁",features:e})}const i=k.filter(o=>!r.has(o.key));return i.length>0&&h.push({title:h.length>0?"Additional Pages":"Module Pages",icon:"⚙️",features:i}),h}async function T({modCode:C,modName:b,currentlySelectedPages:w=[],allPagesDefault:k=!0}){const m=String(C||"").toLowerCase().trim(),c=B(m),h=c.reduce((e,t)=>e+t.features.length,0);if(h===0)return{isConfirmed:!0,selectedKeys:[]};const r=new Set(w&&w.length>0?w:k?c.flatMap(e=>e.features.map(t=>t.key)):[]);let i=`
    <div style="text-align: left; font-family: inherit;">
      <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
        <input 
          id="swal-page-search" 
          type="text" 
          placeholder="Search section or page..." 
          style="flex: 1; min-width: 200px; padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; outline: none;"
        />
        <div style="display: flex; gap: 6px;">
          <button type="button" id="swal-select-all-btn" style="padding: 5px 10px; font-size: 12px; font-weight: 600; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 6px; cursor: pointer;">
            Select All
          </button>
          <button type="button" id="swal-deselect-all-btn" style="padding: 5px 10px; font-size: 12px; font-weight: 600; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;">
            Deselect All
          </button>
        </div>
      </div>
      <div id="swal-sections-container" style="max-height: 55vh; overflow-y: auto; padding-right: 6px;">
  `;c.forEach((e,t)=>{const d=e.features,y=d.every(a=>r.has(a.key));i+=`
      <div class="swal-section-block" data-section-idx="${t}" style="margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #ffffff;">
        <div style="background: #f8fafc; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
          <label style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px; color: #1e293b; cursor: pointer; margin: 0;">
            <input 
              type="checkbox" 
              class="swal-section-checkbox" 
              data-section-idx="${t}"
              ${y?"checked":""}
              style="cursor: pointer; width: 15px; height: 15px;"
            />
            <span>${e.icon} ${e.title}</span>
          </label>
          <span style="font-size: 11px; color: #64748b; font-weight: 500;">
            <span class="swal-section-count" data-section-idx="${t}">
              ${d.filter(a=>r.has(a.key)).length}
            </span>/${d.length} pages
          </span>
        </div>
        <div style="padding: 10px; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 8px;">
    `,d.forEach(a=>{const g=r.has(a.key);i+=`
        <label class="swal-page-item" data-page-key="${a.key}" style="display: flex; align-items: flex-start; gap: 6px; font-size: 12px; color: #334155; cursor: pointer; padding: 4px 6px; border-radius: 4px; background: #f8fafc; border: 1px solid #f1f5f9; margin: 0;">
          <input 
            type="checkbox" 
            class="swal-page-checkbox" 
            data-section-idx="${t}" 
            value="${a.key}" 
            ${g?"checked":""}
            style="cursor: pointer; margin-top: 2px; width: 14px; height: 14px;"
          />
          <span class="swal-page-label" style="line-height: 1.3;">${a.label}</span>
        </label>
      `}),i+=`
        </div>
      </div>
    `}),i+=`
      </div>
      <div style="margin-top: 8px; font-size: 11px; color: #64748b; text-align: right;">
        Total selected: <strong id="swal-total-selected-count">${r.size}</strong> of ${h} pages
      </div>
    </div>
  `;const o=await q.fire({title:`<span style="font-size: 18px; font-weight: 700; color: #0f172a;">${b||m.toUpperCase()} &mdash; Licensed Sections & Pages</span>`,html:i,width:"780px",showCancelButton:!0,confirmButtonText:"Confirm & Apply",cancelButtonText:"Cancel",confirmButtonColor:"#0284c7",cancelButtonColor:"#64748b",didOpen:e=>{const t=e.querySelector("#swal-page-search"),d=e.querySelector("#swal-select-all-btn"),y=e.querySelector("#swal-deselect-all-btn"),a=e.querySelector("#swal-total-selected-count"),g=()=>{const l=Array.from(e.querySelectorAll(".swal-page-checkbox")).filter(x=>x.checked).length;a&&(a.textContent=String(l)),c.forEach((x,p)=>{const n=Array.from(e.querySelectorAll(`.swal-page-checkbox[data-section-idx="${p}"]`)),f=n.filter(v=>v.checked).length,S=e.querySelector(`.swal-section-count[data-section-idx="${p}"]`);S&&(S.textContent=String(f));const u=e.querySelector(`.swal-section-checkbox[data-section-idx="${p}"]`);u&&(u.checked=f>0&&f===n.length,u.indeterminate=f>0&&f<n.length)})};e.querySelectorAll(".swal-page-checkbox").forEach(s=>{s.addEventListener("change",g)}),e.querySelectorAll(".swal-section-checkbox").forEach(s=>{s.addEventListener("change",l=>{const x=l.target.getAttribute("data-section-idx"),p=l.target.checked;e.querySelectorAll(`.swal-page-checkbox[data-section-idx="${x}"]`).forEach(n=>{n.checked=p}),g()})}),d?.addEventListener("click",()=>{e.querySelectorAll(".swal-page-checkbox").forEach(s=>s.checked=!0),e.querySelectorAll(".swal-section-checkbox").forEach(s=>{s.checked=!0,s.indeterminate=!1}),g()}),y?.addEventListener("click",()=>{e.querySelectorAll(".swal-page-checkbox").forEach(s=>s.checked=!1),e.querySelectorAll(".swal-section-checkbox").forEach(s=>{s.checked=!1,s.indeterminate=!1}),g()}),t?.addEventListener("input",s=>{const l=String(s.target.value||"").toLowerCase().trim();c.forEach((x,p)=>{const n=e.querySelector(`.swal-section-block[data-section-idx="${p}"]`);if(!n)return;let f=!1;const S=x.title.toLowerCase().includes(l);n.querySelectorAll(".swal-page-item").forEach(u=>{const v=(u.querySelector(".swal-page-label")?.textContent||"").toLowerCase(),E=(u.getAttribute("data-page-key")||"").toLowerCase(),A=!l||S||v.includes(l)||E.includes(l);u.style.display=A?"flex":"none",A&&(f=!0)}),n.style.display=f?"block":"none"})}),g()},preConfirm:()=>Array.from(document.querySelectorAll(".swal-page-checkbox:checked")).map(t=>t.value)});return{isConfirmed:!!o.isConfirmed,selectedKeys:o.isConfirmed?o.value||[]:[]}}export{B as g,T as s};
