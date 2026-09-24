import{c as L,u as P,s as q}from"./index-CjkhNnYj.js";import{a as R}from"./vendor-query-DwxWvQ0t.js";const W=[["path",{d:"M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978",key:"1n3hpd"}],["path",{d:"M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978",key:"rfe1zi"}],["path",{d:"M18 9h1.5a1 1 0 0 0 0-5H18",key:"7xy6bh"}],["path",{d:"M4 22h16",key:"57wxv0"}],["path",{d:"M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z",key:"1mhfuq"}],["path",{d:"M6 9H4.5a1 1 0 0 1 0-5H6",key:"tex48p"}]],O=L("trophy",W),d=200,$=()=>{const{profile:n}=P(),r=R({queryKey:["technician_progress",n?.id,n?.role],queryFn:async()=>{if(!n)return null;const{data:M}=await q.from("staff").select("id, name, profile_id, active").order("name"),T=M?.find(s=>s.profile_id===n.id),w=n.role==="technician";let p=q.from("job_cards").select(`
          id,
          status,
          estimated_hours,
          total_labor_time,
          completed_at,
          created_at,
          description,
          assigned_staff_id,
          assigned_technician_id,
          vehicles (
            license_plate,
            make,
            model
          ),
          job_labor (
            id,
            description,
            hours
          )
        `);w&&(T?.id?p=p.or(`assigned_staff_id.eq.${T.id},assigned_technician_id.eq.${n.id}`):p=p.eq("assigned_technician_id",n.id));const{data:_,error:x}=await p;if(x)return console.error("Error fetching technician jobs:",x),null;const f=new Date,b=f.getFullYear(),y=f.getMonth(),k=new Date(b,y,1),N=new Date(b,y+1,0,23,59,59,999),v=new Date(b,y+1,0).getDate(),J=f.getDate(),D=Math.max(0,v-J),F=f.toLocaleString("default",{month:"long"}),H=s=>{const i=(s.job_labor||[]).reduce((l,c)=>l+(Number(c.hours)||0),0),t=Number(s.estimated_hours)||0;return i>0?i:t>0?t:0};if(w){const s=(_||[]).filter(e=>{if(e.status!=="completed"||!e.completed_at)return!1;const o=new Date(e.completed_at);return o>=k&&o<=N}).map(e=>({...e,creditedHours:H(e)})).sort((e,o)=>new Date(o.completed_at).getTime()-new Date(e.completed_at).getTime()),i=(_||[]).filter(e=>e.status!=="completed"&&e.status!=="cancelled").map(e=>({...e,creditedHours:H(e)})),t=Number(s.reduce((e,o)=>e+o.creditedHours,0).toFixed(1)),l=Number(i.reduce((e,o)=>e+o.creditedHours,0).toFixed(1)),c=Math.min(100,Math.round(t/d*100)),g=Math.max(0,Number((d-t).toFixed(1))),a=s.length>0?(t/s.length).toFixed(1):"0",h=D>0?(g/D).toFixed(1):"0",u=[{label:"Week 1",range:"Day 1–7",hours:0,jobs:0},{label:"Week 2",range:"Day 8–14",hours:0,jobs:0},{label:"Week 3",range:"Day 15–21",hours:0,jobs:0},{label:"Week 4",range:`Day 22–${v}`,hours:0,jobs:0}];return s.forEach(e=>{const o=new Date(e.completed_at).getDate();let m=3;o<=7?m=0:o<=14?m=1:o<=21&&(m=2),u[m].hours=Number((u[m].hours+e.creditedHours).toFixed(1)),u[m].jobs+=1}),{isTech:!0,targetHours:d,totalHoursCompleted:t,pipelineHours:l,progressPercent:c,hoursRemaining:g,completedCount:s.length,activeCount:i.length,avgHoursPerJob:a,paceNeeded:h,daysLeft:D,monthName:F,weeklyStats:u,completedJobs:s,activeJobs:i}}else{const i=(M||[]).filter(t=>t.active).map(t=>{const l=(_||[]).filter(a=>{if(!(a.assigned_staff_id===t.id||t.profile_id&&a.assigned_technician_id===t.profile_id)||a.status!=="completed"||!a.completed_at)return!1;const u=new Date(a.completed_at);return u>=k&&u<=N}).map(a=>({...a,creditedHours:H(a)})).sort((a,h)=>new Date(h.completed_at).getTime()-new Date(a.completed_at).getTime()),c=Number(l.reduce((a,h)=>a+h.creditedHours,0).toFixed(1)),g=Math.min(100,Math.round(c/d*100));return{staffId:t.id,name:t.name,totalHours:c,completedCount:l.length,targetHours:d,progressPercent:g,hoursRemaining:Math.max(0,Number((d-c).toFixed(1))),isTargetMet:c>=d,completedJobs:l}}).filter(t=>t.totalHours>0||t.completedCount>0);return{isTech:!1,monthName:F,targetHours:d,techSummaries:i}}},enabled:!!n,staleTime:3e4}),A=n?.role==="technician",C=r.data&&r.data.isTech?r.data:null,S=r.data&&!r.data.isTech?r.data:null;return{...r,techStatsData:r.data,isTechnician:A,techData:C,adminTechData:S}};export{O as T,d as a,$ as u};
//# sourceMappingURL=useTechnicianProgress-CQmGxjOY.js.map
