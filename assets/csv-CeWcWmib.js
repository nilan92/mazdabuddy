import{c as u}from"./index-B1FIkytB.js";const j=[["path",{d:"m21 21-4.34-4.34",key:"14j7rj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}]],m=u("search",j);function p(r,c){if(!c.length)return;const n=Object.keys(c[0]),s=[n.join(","),...c.map(i=>n.map(l=>{const d=i[l]??"",e=String(d).replace(/"/g,'""');return e.includes(",")||e.includes(`
`)||e.includes('"')?`"${e}"`:e}).join(","))],a=new Blob([s.join(`
`)],{type:"text/csv;charset=utf-8;"}),o=URL.createObjectURL(a),t=document.createElement("a");t.href=o,t.download=`${r}-${new Date().toISOString().slice(0,10)}.csv`,t.click(),URL.revokeObjectURL(o)}export{m as S,p as d};
//# sourceMappingURL=csv-CeWcWmib.js.map
