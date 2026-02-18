const u=(t,o)=>{if(!t||!t.length){alert("Aucune donnée à exporter");return}const c=Object.keys(t[0]),r=[c.join(";"),...t.map(l=>c.map(i=>{let e=l[i]??"";return typeof e=="string"&&(e.includes(";")||e.includes('"')||e.includes(`
`))&&(e=`"${e.replace(/"/g,'""')}"`),e}).join(";"))].join(`
`),s=new Blob(["\uFEFF"+r],{type:"text/csv;charset=utf-8;"}),n=document.createElement("a");n.href=URL.createObjectURL(s),n.download=`${o}_${new Date().toISOString().split("T")[0]}.csv`,n.click(),URL.revokeObjectURL(n.href)};export{u as e};
