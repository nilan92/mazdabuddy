function u(s,n){if(!n.length)return;const c=Object.keys(n[0]),l=[c.join(","),...n.map(r=>c.map(i=>{const d=r[i]??"",e=String(d).replace(/"/g,'""');return e.includes(",")||e.includes(`
`)||e.includes('"')?`"${e}"`:e}).join(","))],a=new Blob([l.join(`
`)],{type:"text/csv;charset=utf-8;"}),o=URL.createObjectURL(a),t=document.createElement("a");t.href=o,t.download=`${s}-${new Date().toISOString().slice(0,10)}.csv`,t.click(),URL.revokeObjectURL(o)}export{u as d};
//# sourceMappingURL=csv-CJ8oQ_pl.js.map
