import { useState, useEffect, useRef } from "react";

// ── Claude API para leer PDFs ─────────────────────────────────────────────────
const leerAnalisisPDF = async (base64, mediaType) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: `Extrae los datos de analisis de este boletin de laboratorio enologico. 
Devuelve SOLO un JSON valido con este formato exacto, sin texto adicional:
{
  "fecha": "YYYY-MM-DD",
  "nPedido": "string",
  "muestras": [
    {
      "nMuestra": "string",
      "identificador": "string",
      "producto": "string",
      "gradoAlcohol": number or null,
      "acidezTotal": number or null,
      "pH": number or null,
      "acidezVolatil": number or null,
      "so2Libre": number or null,
      "so2Total": number or null,
      "azucares": number or null,
      "acidoMalico": number or null
    }
  ]
}` }
        ]
      }]
    })
  });
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
};

const SUPA_URL = "https://vjwmtltknosrrhligoha.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqd210bHRrbm9zcnJobGlnb2hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDQ4MTksImV4cCI6MjA5MjI4MDgxOX0.k7N_QH_p5C1OdGLzPTHRL5Ru2nGHDk4KhXLfTQIFJgE";
const BODEGA_ID = "araico_bodega";

const supaFetch = async (method, path, body) => {
  const res = await fetch(SUPA_URL+"/rest/v1/"+path, {
    method,
    headers: {
      "apikey": SUPA_KEY,
      "Authorization": "Bearer "+SUPA_KEY,
      "Content-Type": "application/json",
      "Prefer": method==="POST" ? "resolution=merge-duplicates" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if(!res.ok){ const t=await res.text(); throw new Error(t); }
  if(res.status===204) return null;
  return res.json();
};

const cargarBodega = async () => {
  try {
    const rows = await supaFetch("GET","bodega_datos?bodega_id=eq."+BODEGA_ID+"&select=clave,valor");
    const map = {}; (rows||[]).forEach(r=>{ map[r.clave]=r.valor; });
    return {
      depositos:   map.depositos   ? JSON.parse(map.depositos)   : null,
      barricas:    map.barricas    ? JSON.parse(map.barricas)    : null,
      operaciones: map.operaciones ? JSON.parse(map.operaciones) : null,
      cervezas:    map.cervezas    ? JSON.parse(map.cervezas)    : null,
      materiales:  map.materiales  ? JSON.parse(map.materiales)  : null,
    };
  } catch(e){ console.error(e); return {depositos:null,barricas:null,operaciones:null}; }
};

const guardarBodega = async (dep,bar,ops,cerv,mat) => {
  try {
    await supaFetch("POST","bodega_datos",[
      {bodega_id:BODEGA_ID,clave:"depositos",   valor:JSON.stringify(dep)},
      {bodega_id:BODEGA_ID,clave:"barricas",    valor:JSON.stringify(bar)},
      {bodega_id:BODEGA_ID,clave:"operaciones", valor:JSON.stringify(ops)},
      {bodega_id:BODEGA_ID,clave:"cervezas",    valor:JSON.stringify(cerv)},
      {bodega_id:BODEGA_ID,clave:"materiales",  valor:JSON.stringify(mat)},
    ]);
  } catch(e){ console.error(e); }
};

const fmt  = n => isNaN(n)?"-":Number(n).toLocaleString("es-ES",{maximumFractionDigits:0});
const fmtL = n => fmt(n)+" L";
const fmtK = n => fmt(n)+" Kg";
const hoy  = () => new Date().toISOString().split("T")[0];
const fmtF = d => { if(!d) return "-"; const [y,m,dd]=d.split("-"); return dd+"/"+m+"/"+y; };
const hexToRgb = hex => { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return r+","+g+","+b; };

const DEPOSITOS_DEFAULT = [
  {id:"D1", nombre:"D1",  tipo:"inox", capacidad:30000, siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D2", nombre:"D2",  tipo:"inox", capacidad:30000, siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D3", nombre:"D3",  tipo:"inox", capacidad:30000, siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D6", nombre:"D6",  tipo:"inox", capacidad:16000, siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D7", nombre:"D7",  tipo:"inox", capacidad:20000, siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D8", nombre:"D8",  tipo:"inox", capacidad:20000, siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D9", nombre:"D9",  tipo:"inox", capacidad:10000, siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D10",nombre:"D10", tipo:"inox", capacidad:10000, siempreLleno:false, activo:true, tipoVino:"tinto", anada:"2025", etiqueta:"Araico Tinto"},
  {id:"D11",nombre:"D11", tipo:"inox", capacidad:5000,  siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D12",nombre:"D12", tipo:"inox", capacidad:5000,  siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D13",nombre:"D13", tipo:"inox", capacidad:5000,  siempreLleno:true,  activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D14",nombre:"D14", tipo:"inox", capacidad:5000,  siempreLleno:false, activo:true, tipoVino:"tinto", anada:"2025", etiqueta:"Araico Tinto"},
  {id:"D15",nombre:"D15", tipo:"inox", capacidad:2000,  siempreLleno:false, activo:true, tipoVino:"tinto", anada:"2023", etiqueta:"Crianza"},
  {id:"D16",nombre:"D16", tipo:"inox", capacidad:3000,  siempreLleno:false, activo:true, tipoVino:"tinto", anada:"2025", etiqueta:"Araico Tinto"},
  {id:"D19",nombre:"D19", tipo:"externo",capacidad:0,   siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D20",nombre:"D20", tipo:"inox", capacidad:3000,  siempreLleno:false, activo:true, tipoVino:"blanco",anada:"2025", etiqueta:"Araico Blanco"},
  {id:"D21",nombre:"D21", tipo:"inox", capacidad:3000,  siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D22",nombre:"D22", tipo:"inox", capacidad:20000, siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D24",nombre:"D24", tipo:"inox", capacidad:1000,  siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D25",nombre:"D25", tipo:"inox", capacidad:2000,  siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D26",nombre:"D26", tipo:"inox", capacidad:500,   siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D27",nombre:"D27", tipo:"inox", capacidad:500,   siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
  {id:"D28",nombre:"D28", tipo:"inox", capacidad:100,   siempreLleno:false, activo:true, tipoVino:"",      anada:"",     etiqueta:""},
];

const BARRICAS_DEFAULT = [
  // Francesas (8) - BF01 a BF08
  ...Array.from({length:4}, (_,i)=>({id:"BF"+(i+1).toString().padStart(2,"0"), nombre:"BF"+(i+1).toString().padStart(2,"0"), tipo:"frances", capacidad:225, activo:true, tipoVino:"tinto",  anada:"2025", etiqueta:"Tinto 2025"})),
  ...Array.from({length:4}, (_,i)=>({id:"BF"+(i+5).toString().padStart(2,"0"), nombre:"BF"+(i+5).toString().padStart(2,"0"), tipo:"frances", capacidad:225, activo:true, tipoVino:"tinto",  anada:"2023", etiqueta:"Orgullo"})),
  // Americanas (49) - BA01 a BA49
  ...Array.from({length:29},(_,i)=>({id:"BA"+(i+1).toString().padStart(2,"0"),  nombre:"BA"+(i+1).toString().padStart(2,"0"),  tipo:"americano",capacidad:225, activo:true, tipoVino:"tinto",  anada:"2025", etiqueta:"Tinto 2025"})),
  ...Array.from({length:12},(_,i)=>({id:"BA"+(i+30).toString().padStart(2,"0"), nombre:"BA"+(i+30).toString().padStart(2,"0"), tipo:"americano",capacidad:225, activo:true, tipoVino:"tinto",  anada:"2024", etiqueta:"Tinto 2024"})),
  {id:"BA42", nombre:"BA42", tipo:"americano", capacidad:225, activo:true, tipoVino:"tinto",  anada:"2023", etiqueta:"Orgullo"},
  ...Array.from({length:7}, (_,i)=>({id:"BA"+(i+43).toString().padStart(2,"0"), nombre:"BA"+(i+43).toString().padStart(2,"0"), tipo:"americano",capacidad:225, activo:true, tipoVino:"blanco", anada:"2024", etiqueta:"Blanco 2024"})),
];

const TIPOS_OP = [
  {id:"vendimia",      label:"Entrada vendimia"},
  {id:"fermentacion",  label:"Fermentacion"},
  {id:"entrada_granel",label:"Entrada granel"},
  {id:"llenado",       label:"Llenado"},
  {id:"trasiego",      label:"Trasiego"},
  {id:"sulfitado",     label:"Sulfitado"},
  {id:"clarificacion", label:"Clarificacion"},
  {id:"filtracion",    label:"Filtracion"},
  {id:"acidez",        label:"Correccion acidez"},
  {id:"azucar",        label:"Correccion azucar"},
  {id:"temperatura",   label:"Control temperatura"},
  {id:"analisis",      label:"Analisis"},
  {id:"embotellado",   label:"Embotellado"},
  {id:"etiquetado",    label:"Etiquetado"},
  {id:"salida_granel", label:"Salida granel"},
  {id:"otro",          label:"Otro"},
];

const C = {
  bg:"#0F1923", card:"#1A2535", border:"#2A3A4E",
  accent:"#4A9B7F", wine:"#7B1C2E", gold:"#C8A96E",
  text:"#E8EDF2", muted:"#7A8A9A", danger:"#CC3333",
};

const S = {
  app:    {fontFamily:"Georgia,serif",background:C.bg,minHeight:"100vh",color:C.text,maxWidth:480,margin:"0 auto"},
  header: {background:C.card,borderBottom:"1px solid "+C.border,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10},
  htitle: {fontSize:18,fontWeight:700,color:C.gold,letterSpacing:"0.05em"},
  hsub:   {fontSize:11,color:C.muted,marginTop:2},
  body:   {padding:"12px 14px",paddingBottom:80},
  card:   {background:C.card,borderRadius:10,padding:"12px 14px",marginBottom:10,border:"1px solid "+C.border},
  sec:    {fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8,marginTop:16},
  input:  {width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid "+C.border,background:"#0A1218",color:C.text,fontFamily:"Georgia,serif",fontSize:14,marginBottom:8},
  label:  {fontSize:11,color:C.muted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.07em"},
  back:   {background:"none",border:"none",color:C.gold,fontSize:24,cursor:"pointer",padding:"0 8px 0 0",lineHeight:1},
};

const Btn = ({children,onClick,variant="primary",small=false,full=false}) => {
  const v = {
    primary:{background:C.accent,color:"#fff"},
    gold:   {background:C.gold,color:"#0F1923"},
    ghost:  {background:"transparent",color:C.muted,border:"1px solid "+C.border},
    danger: {background:C.danger,color:"#fff"},
    wine:   {background:C.wine,color:"#fff"},
  };
  return <button onClick={onClick} style={{fontFamily:"Georgia,serif",cursor:"pointer",borderRadius:8,fontWeight:600,border:"none",
    padding:small?"5px 12px":"10px 18px",fontSize:small?12:14,width:full?"100%":"auto",...v[variant]}}>{children}</button>;
};

const TabBar = ({tab,setTab}) => (
  <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,
    background:C.card,borderTop:"1px solid "+C.border,display:"flex",zIndex:20}}>
    {[{id:"depositos",label:"Depositos"},{id:"barricas",label:"Barricas"},{id:"ops",label:"Operaciones"},{id:"stock",label:"Stock"},{id:"materiales",label:"Materiales"}].map(t=>(
      <button key={t.id} onClick={()=>setTab(t.id)}
        style={{flex:1,padding:"10px 2px 8px",background:"none",border:"none",cursor:"pointer",
          color:tab===t.id?C.gold:C.muted,fontFamily:"Georgia,serif",fontSize:10,fontWeight:tab===t.id?700:400}}>
        {t.label}
      </button>
    ))}
  </div>
);

// Colores por tipo de vino
const COLOR_TIPO = {
  tinto:  {liq:"#8B1A2A", borde:"#C23050", texto:"#F0A0B0"},
  blanco: {liq:"#A08020", borde:"#D4B840", texto:"#F0DCA0"},
  rosado: {liq:"#C05060", borde:"#E07080", texto:"#F8C0C8"},
  mosto:  {liq:"#5A7A30", borde:"#80B040", texto:"#C0E080"},
  vacio:  {liq:"#2A3A4E", borde:"#4A6080", texto:"#8AABCC"},
};

const infoVino = (dep, operaciones) => {
  // Busca la ultima operacion de entrada para saber que hay dentro
  const ops = operaciones.filter(o=>o.depId===dep.id&&["vendimia","llenado","trasiego"].includes(o.tipo))
    .sort((a,b)=>b.fecha.localeCompare(a.fecha));
  if(ops.length===0) return null;
  return {
    tipo:    dep.tipoVino || null,
    anada:   dep.anada    || null,
    etiqueta:dep.etiqueta || null,
  };
};

// ── Tanque visual ─────────────────────────────────────────────────────────────
const Tanque = ({dep, litros, resaltado=true, onClick}) => {
  const info    = {tipo:dep.tipoVino, anada:dep.anada, etiqueta:dep.etiqueta};
  const colores = (info.tipo && COLOR_TIPO[info.tipo]) ? COLOR_TIPO[info.tipo] : COLOR_TIPO.vacio;
  const pct     = dep.capacidad>0 ? Math.min(100, Math.round((litros/dep.capacidad)*100)) : 0;
  const nivel   = dep.siempreLleno ? 100 : pct;
  const tieneContenido = nivel>0;
  const tanqueH = 72, tanqueW = 52;
  const opacidad = resaltado ? 1 : 0.3;

  // Texto dentro del tanque: mostrar litros
  const litrosTxt = dep.siempreLleno
    ? fmtL(dep.capacidad)
    : tieneContenido ? fmtL(litros) : "Vacio";
  const fontSize = litros>=10000?8:litros>=1000?9:10;

  return (
    <div onClick={onClick} style={{display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",
      padding:"6px 4px", opacity:opacidad, transition:"opacity 0.2s"}}>
      {/* Tanque */}
      <div style={{position:"relative",width:tanqueW,height:tanqueH,borderRadius:"4px 4px 3px 3px",
        border:"2px solid "+(tieneContenido?colores.borde:C.border),
        background:"#0A1218",overflow:"hidden"}}>
        {/* Liquido */}
        {nivel>0&&<div style={{position:"absolute",bottom:0,left:0,right:0,
          height:nivel+"%",background:colores.liq,opacity:0.9,transition:"height 0.4s ease"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"rgba(255,255,255,0.25)"}}/>
        </div>}
        {/* Litros dentro */}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
          fontSize:fontSize,fontWeight:700,zIndex:2,textAlign:"center",lineHeight:1.2,
          color:nivel>55?"rgba(255,255,255,0.9)":tieneContenido?colores.texto:C.muted,
          textShadow:nivel>55?"0 1px 2px rgba(0,0,0,0.6)":"none",
          width:tanqueW-6,wordBreak:"break-all"}}>
          {litrosTxt}
        </div>
        {/* Lineas de nivel */}
        {[25,50,75].map(l=>(
          <div key={l} style={{position:"absolute",left:0,right:0,bottom:l+"%",
            borderTop:"1px dashed rgba(255,255,255,0.08)",zIndex:1}}/>
        ))}
      </div>
      {/* Nombre */}
      <div style={{fontSize:11,fontWeight:700,marginTop:4,textAlign:"center",
        color:tieneContenido?colores.texto:C.muted}}>{dep.nombre}</div>
      {/* Tipo + anada */}
      {(info.tipo||info.anada)&&<div style={{fontSize:8,color:C.muted,textAlign:"center",lineHeight:1.2}}>
        {[info.tipo,info.anada].filter(Boolean).join(" ")}
      </div>}
      {/* Etiqueta producto */}
      {info.etiqueta&&<div style={{fontSize:8,color:colores.texto,textAlign:"center",lineHeight:1.2,
        maxWidth:56,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{info.etiqueta}</div>}
    </div>
  );
};

const OPS_EJEMPLO = [
  {id:1, depId:"D10", tipo:"llenado", fecha:"2026-08-06", litros:10000, notas:"Estado actual"},
  {id:2, depId:"D14", tipo:"llenado", fecha:"2026-08-06", litros:400,   notas:"Estado actual"},
  {id:3, depId:"D15", tipo:"llenado", fecha:"2026-08-06", litros:400,   notas:"Estado actual"},
  {id:4, depId:"D16", tipo:"llenado", fecha:"2026-08-06", litros:600,   notas:"Estado actual"},
  {id:5, depId:"D20", tipo:"llenado", fecha:"2026-08-06", litros:1000,  notas:"Estado actual"},
];

export default function BodegaApp() {
  const [tab,          setTab]          = useState("depositos");
  const [depositos,    setDepositos]    = useState(DEPOSITOS_DEFAULT);
  const [barricas,     setBarricas]     = useState(BARRICAS_DEFAULT);
  const [operaciones,  setOperaciones]  = useState([]);
  const [cargando,     setCargando]     = useState(true);
  const [guardando,    setGuardando]    = useState(false);
  const [vista,        setVista]        = useState("lista");
  const [selId,        setSelId]        = useState(null);
  const [formOp,       setFormOp]       = useState({});
  const [filtroTipo,   setFiltroTipo]   = useState("todos");
  const [filtroAnada,  setFiltroAnada]  = useState("todas");
  const [filtroTipoB,  setFiltroTipoB]  = useState("todos");
  const [analisisPDF,  setAnalisisPDF]  = useState(null);  // muestras extraidas del PDF
  const [leyendoPDF,   setLeyendoPDF]   = useState(false);
  const [cervezas,     setCervezas]     = useState({grape:0, negra:0});
  const [formCerveza,  setFormCerveza]  = useState(null);
  const [materiales,   setMateriales]   = useState({
    botellas: [
      {id:"bj",  nombre:"Bordelesa Joven",    stock:0, lotes:[]},
      {id:"bc",  nombre:"Bordelesa Crianza",  stock:0, lotes:[]},
      {id:"borg",nombre:"Borgona",            stock:0, lotes:[]},
      {id:"rhin",nombre:"Rhin",               stock:0, lotes:[]},
    ],
    corchos: [
      {id:"cn",  nombre:"Corcho Normal",      stock:0, lotes:[]},
      {id:"cc",  nombre:"Corcho Crianza",     stock:0, lotes:[]},
    ],
    precintas: [], // series: {id, serie, inicio, fin, total, usadas}
  });
  const [vistaMat,     setVistaMat]     = useState("lista"); // lista | nueva_entrada | nueva_precinta
  const [formMat,      setFormMat]      = useState({});
  const pdfRef = useRef(null);
  const saveRef = useRef(null);

  useEffect(()=>{
    cargarBodega().then(({depositos:d,barricas:b,operaciones:o,cervezas:cerv,materiales:mat})=>{
      if(d) setDepositos(d);    else setDepositos(DEPOSITOS_DEFAULT);
      if(b) setBarricas(b);     else setBarricas(BARRICAS_DEFAULT);
      if(o) setOperaciones(o);  else setOperaciones(OPS_EJEMPLO);
      if(cerv) setCervezas(cerv); else setCervezas({grape:0,negra:0});
      if(mat)  setMateriales(mat);
      setCargando(false);
    });
  },[]);

  useEffect(()=>{
    if(cargando) return;
    if(saveRef.current) clearTimeout(saveRef.current);
    setGuardando(true);
    saveRef.current = setTimeout(async()=>{
      await guardarBodega(depositos,barricas,operaciones,cervezas,materiales);
      setGuardando(false);
    },1200);
  },[depositos,barricas,operaciones,cervezas,materiales]);

  const litrosActuales = (id) => {
    let l = 0;
    operaciones.filter(o=>o.depId===id||o.depDestino===id)
      .sort((a,b)=>a.fecha.localeCompare(b.fecha))
      .forEach(op=>{
        if(["vendimia","llenado","entrada_granel"].includes(op.tipo)&&op.depId===id) l+=parseFloat(op.litros||0);
        if(op.tipo==="trasiego"&&op.depDestino===id)                          l+=parseFloat(op.litros||0);
        if(op.tipo==="trasiego"&&op.depId===id)                               l-=parseFloat(op.litros||0);
        if(["embotellado","salida_granel"].includes(op.tipo)&&op.depId===id)  l-=parseFloat(op.litros||0);
      });
    return Math.max(0,l);
  };

  const histDep = (id) => operaciones.filter(o=>o.depId===id||o.depDestino===id)
    .sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.id-a.id);

  const todosContenedores = [...depositos,...barricas];

  if(cargando) return (
    <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:C.muted}}>Cargando...</div>
    </div>
  );

  // ── VISTA IMPORTAR ANALISIS PDF ───────────────────────────────────────────
  if(vista==="importar_analisis") {
    const todosContenedoresIds = [...depositos,...barricas].filter(d=>d.activo).map(d=>d.id);

    const subirPDF = async (e) => {
      const file = e.target.files[0];
      if(!file) return;
      setLeyendoPDF(true);
      try {
        const base64 = await new Promise((res,rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result.split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        const resultado = await leerAnalisisPDF(base64, file.type);
        // Intentar asignar deposito automaticamente
        const muestrasConDep = resultado.muestras.map(m => {
          const idLimpio = m.identificador.replace(/[-\s]/g,"").toUpperCase();
          const depMatch = [...depositos,...barricas].find(d => 
            d.id.replace(/[-\s]/g,"").toUpperCase() === idLimpio ||
            d.nombre.replace(/[-\s]/g,"").toUpperCase() === idLimpio
          );
          return { ...m, depAsignado: depMatch?.id || "", ignorar: false, fecha: resultado.fecha };
        });
        setAnalisisPDF({ ...resultado, muestras: muestrasConDep });
      } catch(err) {
        alert("Error al leer el PDF. Intentalo de nuevo.");
        console.error(err);
      }
      setLeyendoPDF(false);
      e.target.value = "";
    };

    const confirmarAnalisis = () => {
      const nuevasOps = analisisPDF.muestras
        .filter(m => !m.ignorar && m.depAsignado)
        .map(m => ({
          id: Date.now() + Math.random(),
          depId: m.depAsignado,
          tipo: "analisis",
          fecha: m.fecha || hoy(),
          ph: m.pH?.toString() || "",
          acidez: m.acidezTotal?.toString() || "",
          alcohol: m.gradoAlcohol?.toString() || "",
          acidezV: m.acidezVolatil?.toString() || "",
          so2libre: m.so2Libre?.toString() || "",
          so2total: m.so2Total?.toString() || "",
          azucares: m.azucares?.toString() || "",
          acidoMalico: m.acidoMalico?.toString() || "",
          notas: "Boletin "+analisisPDF.nPedido+" - Muestra "+m.nMuestra,
        }));
      setOperaciones(prev => [...nuevasOps, ...prev]);
      setAnalisisPDF(null);
      setVista("lista");
    };

    return (
      <div style={S.app}>
        <div style={S.header}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button style={S.back} onClick={()=>{setAnalisisPDF(null);setVista("lista");}}>&#8249;</button>
            <div style={S.htitle}>Importar analisis</div>
          </div>
          {analisisPDF&&<Btn variant="gold" onClick={confirmarAnalisis}>Confirmar</Btn>}
        </div>
        <div style={S.body}>

          {/* Subir PDF */}
          {!analisisPDF&&<>
            <div style={{...S.card,textAlign:"center",padding:"24px 16px"}}>
              <div style={{fontSize:32,marginBottom:12}}>📄</div>
              <div style={{fontSize:14,color:C.muted,marginBottom:16}}>Sube el PDF del boletin del laboratorio y la app extraera los analisis automaticamente</div>
              {leyendoPDF
                ? <div style={{color:C.gold,fontSize:14}}>Leyendo PDF...</div>
                : <Btn variant="gold" onClick={()=>pdfRef.current?.click()}>Subir PDF</Btn>
              }
              <input ref={pdfRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={subirPDF}/>
            </div>
            <div style={{...S.card,background:"rgba(200,169,110,0.1)",borderColor:C.gold,fontSize:13,color:C.muted}}>
              O si prefieres introducir el analisis manualmente, usa el boton + Operacion y selecciona "Analisis"
            </div>
          </>}

          {/* Revision de muestras */}
          {analisisPDF&&<>
            <div style={{...S.card,background:"#0A1520",borderColor:C.gold}}>
              <div style={{fontSize:11,color:C.muted,textTransform:"uppercase"}}>Boletin {analisisPDF.nPedido}</div>
              <div style={{fontSize:14,color:C.gold,marginTop:2}}>{fmtF(analisisPDF.fecha)} - {analisisPDF.muestras.length} muestras</div>
            </div>
            <div style={S.sec}>Revisa y confirma cada muestra</div>
            {analisisPDF.muestras.map((m,i)=>(
              <div key={i} style={{...S.card,marginBottom:8,opacity:m.ignorar?0.4:1,borderLeft:"3px solid "+(m.ignorar?C.border:m.depAsignado?C.accent:C.gold)}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.gold}}>Muestra {m.nMuestra}</div>
                    <div style={{fontSize:12,color:C.muted}}>{m.producto} - Identif: {m.identificador}</div>
                  </div>
                  <button onClick={()=>setAnalisisPDF(prev=>({...prev,muestras:prev.muestras.map((x,j)=>j===i?{...x,ignorar:!x.ignorar}:x)}))}
                    style={{background:"none",border:"1px solid "+C.border,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:11,color:m.ignorar?C.accent:C.danger}}>
                    {m.ignorar?"Incluir":"Ignorar"}
                  </button>
                </div>
                {!m.ignorar&&<>
                  {/* Datos extraidos */}
                  <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10,fontSize:11,color:C.muted}}>
                    {m.gradoAlcohol&&<span>Alc: <b style={{color:C.text}}>{m.gradoAlcohol}%</b></span>}
                    {m.acidezTotal&&<span>Acid.T: <b style={{color:C.text}}>{m.acidezTotal} g/L</b></span>}
                    {m.pH&&<span>pH: <b style={{color:C.text}}>{m.pH}</b></span>}
                    {m.acidezVolatil&&<span>Acid.V: <b style={{color:C.text}}>{m.acidezVolatil} g/L</b></span>}
                    {m.so2Libre&&<span>SO2L: <b style={{color:C.text}}>{m.so2Libre} mg/L</b></span>}
                    {m.azucares&&<span>Az: <b style={{color:C.text}}>{m.azucares} g/L</b></span>}
                  </div>
                  {/* Asignar deposito */}
                  <label style={S.label}>Asignar a deposito / barrica</label>
                  <select style={{...S.input,marginBottom:0,borderColor:m.depAsignado?C.accent:C.danger}}
                    value={m.depAsignado}
                    onChange={e=>setAnalisisPDF(prev=>({...prev,muestras:prev.muestras.map((x,j)=>j===i?{...x,depAsignado:e.target.value}:x)}))}>
                    <option value="">-- Sin asignar (no se importara) --</option>
                    <optgroup label="Depositos">
                      {depositos.filter(d=>d.activo).map(d=><option key={d.id} value={d.id}>{d.nombre} {d.tipoVino?("- "+d.tipoVino+" "+d.anada):""}</option>)}
                    </optgroup>
                    <optgroup label="Barricas francesas">
                      {barricas.filter(b=>b.tipo==="frances"&&b.activo).map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </optgroup>
                    <optgroup label="Barricas americanas">
                      {barricas.filter(b=>b.tipo==="americano"&&b.activo).map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </optgroup>
                  </select>
                  {!m.depAsignado&&<div style={{fontSize:11,color:C.danger,marginTop:4}}>Sin deposito asignado - esta muestra no se importara</div>}
                </>}
              </div>
            ))}
            <div style={{marginTop:8}}>
              <Btn variant="gold" onClick={confirmarAnalisis} full>Confirmar e importar</Btn>
            </div>
          </>}
        </div>
      </div>
    );
  }

  // ── VISTA FICHA CONTENEDOR ─────────────────────────────────────────────────
  if(vista==="ficha") {
    const dep = todosContenedores.find(d=>d.id===selId);
    if(!dep){setVista("lista");return null;}
    const esBarrica = barricas.some(b=>b.id===dep.id);
    const litros = dep.siempreLleno ? dep.capacidad : litrosActuales(dep.id);
    const pct = dep.capacidad>0?Math.round((litros/dep.capacidad)*100):0;
    const hist = histDep(dep.id);
    const col = (dep.tipoVino&&COLOR_TIPO[dep.tipoVino])?COLOR_TIPO[dep.tipoVino]:COLOR_TIPO.vacio;

    return (
      <div style={S.app}>
        <div style={S.header}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button style={S.back} onClick={()=>setVista("lista")}>&#8249;</button>
            <div>
              <div style={S.htitle}>{dep.nombre}</div>
              <div style={S.hsub}>{dep.tipo==="externo"?"Externo":dep.tipo==="frances"?"Barrica francesa":dep.tipo==="americano"?"Barrica americana":"Inox"} {dep.capacidad?fmtL(dep.capacidad):""}</div>
            </div>
          </div>
          <Btn variant="gold" small onClick={()=>{
            setFormOp({depId:dep.id,fecha:hoy(),tipo:"",litros:"",notas:""});
            setVista("nueva_op");
          }}>+ Op.</Btn>
        </div>
        <div style={S.body}>
          {/* Estado actual */}
          <div style={{...S.card,display:"flex",alignItems:"center",gap:16}}>
            <Tanque dep={dep} litros={litros} onClick={()=>{}}/>
            <div>
              <div style={{fontSize:11,color:C.muted}}>Contenido actual</div>
              <div style={{fontSize:24,fontWeight:700,color:C.gold}}>{dep.siempreLleno?"Lleno":fmtL(litros)}</div>
              {dep.capacidad>0&&!dep.siempreLleno&&<div style={{fontSize:12,color:C.muted}}>{pct}% de {fmtL(dep.capacidad)}</div>}
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>{hist.length} operaciones</div>
            </div>
          </div>

          {/* Etiquetado - deposito o barrica */}
          <div style={S.sec}>Contenido</div>
          <div style={S.card}>
            <label style={S.label}>Tipo de vino</label>
            <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
              {[["","Sin asignar"],["tinto","Tinto"],["blanco","Blanco"],["rosado","Rosado"],["mosto","Mosto"]].map(([v,l])=>{
                const sel = (dep.tipoVino||"")===v;
                const col = COLOR_TIPO[v]||COLOR_TIPO.vacio;
                return (
                  <button key={v} onClick={()=>{
                    const isBarrica = barricas.some(b=>b.id===dep.id);
                    if(isBarrica) setBarricas(prev=>prev.map(b=>b.id===dep.id?{...b,tipoVino:v}:b));
                    else setDepositos(prev=>prev.map(d=>d.id===dep.id?{...d,tipoVino:v}:d));
                  }}
                    style={{padding:"5px 12px",borderRadius:20,cursor:"pointer",fontFamily:"Georgia,serif",fontSize:12,
                      border:"2px solid "+(sel?col.borde:C.border),
                      background:sel?"#1A2535":"transparent",
                      color:sel?col.texto:C.muted}}>
                    {l}
                  </button>
                );
              })}
            </div>
            <label style={S.label}>Anada</label>
            <input type="text" style={{...S.input,marginBottom:10}} placeholder="ej. 2025" value={dep.anada||""}
              onChange={e=>{
                const isBarrica = barricas.some(b=>b.id===dep.id);
                if(isBarrica) setBarricas(prev=>prev.map(b=>b.id===dep.id?{...b,anada:e.target.value}:b));
                else setDepositos(prev=>prev.map(d=>d.id===dep.id?{...d,anada:e.target.value}:d));
              }}/>
            <label style={S.label}>Producto / Etiqueta</label>
            <input type="text" style={S.input} placeholder="ej. Autor, Crianza, Reserva..." value={dep.etiqueta||""}
              onChange={e=>{
                const isBarrica = barricas.some(b=>b.id===dep.id);
                if(isBarrica) setBarricas(prev=>prev.map(b=>b.id===dep.id?{...b,etiqueta:e.target.value}:b));
                else setDepositos(prev=>prev.map(d=>d.id===dep.id?{...d,etiqueta:e.target.value}:d));
              }}/>
          </div>

          {/* Historial */}
          <div style={S.sec}>Historial</div>
          {hist.length===0&&<div style={{...S.card,color:C.muted,fontSize:13,textAlign:"center",padding:"24px"}}>Sin operaciones</div>}
          {hist.map(op=>{
            const t = TIPOS_OP.find(x=>x.id===op.tipo);
            const esEntrada = ["vendimia","llenado"].includes(op.tipo)||(op.tipo==="trasiego"&&op.depDestino===dep.id);
            const esSalida  = ["embotellado","salida_granel"].includes(op.tipo)||(op.tipo==="trasiego"&&op.depId===dep.id&&op.depDestino);
            const col = esEntrada?C.accent:esSalida?C.danger:C.gold;
            return (
              <div key={op.id} style={{...S.card,borderLeft:"3px solid "+col,marginBottom:6,padding:"10px 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:12,fontWeight:700,color:col}}>{t?.label||op.tipo}</span>
                  <span style={{fontSize:11,color:C.muted}}>{fmtF(op.fecha)}</span>
                </div>
                {op.tipo==="fermentacion"&&<div style={{display:"flex",gap:16,marginTop:4}}>
                  {op.densidad&&<div style={{textAlign:"center"}}>
                    <div style={{fontSize:10,color:C.muted,textTransform:"uppercase"}}>Densidad</div>
                    <div style={{fontSize:18,fontWeight:700,color:C.accent}}>{op.densidad}</div>
                    <div style={{fontSize:10,color:C.muted}}>g/L</div>
                  </div>}
                  {op.temperatura&&<div style={{textAlign:"center"}}>
                    <div style={{fontSize:10,color:C.muted,textTransform:"uppercase"}}>Temp.</div>
                    <div style={{fontSize:18,fontWeight:700,color:C.gold}}>{op.temperatura}</div>
                    <div style={{fontSize:10,color:C.muted}}>C</div>
                  </div>}
                  {op.hora&&<div style={{textAlign:"center"}}>
                    <div style={{fontSize:10,color:C.muted,textTransform:"uppercase"}}>Hora</div>
                    <div style={{fontSize:14,fontWeight:700,color:C.text}}>{op.hora}</div>
                  </div>}
                </div>}
                {op.litros&&<div style={{fontSize:13,color:C.text}}>{fmtL(op.litros)}{op.kg?" / "+fmtK(op.kg):""}</div>}
                {op.variedad&&<div style={{fontSize:12,color:C.muted}}>{op.variedad}{op.campana?" - "+op.campana:""}{op.grado?" - "+op.grado+" Gr":""}</div>}
                {op.producto&&<div style={{fontSize:12,color:C.muted}}>{op.producto}{op.dosis?" - "+op.dosis:""}</div>}
                {op.temperatura&&<div style={{fontSize:12,color:C.muted}}>Temp: {op.temperatura} C</div>}
                {op.depDestino&&op.tipo==="trasiego"&&op.depId===dep.id&&<div style={{fontSize:12,color:C.muted}}>Destino: {op.depDestino}</div>}
                {op.depId&&op.tipo==="trasiego"&&op.depDestino===dep.id&&<div style={{fontSize:12,color:C.muted}}>Origen: {op.depId}</div>}
                {(op.ph||op.acidez||op.alcohol)&&<div style={{fontSize:11,color:C.muted}}>
                  {op.ph?"pH: "+op.ph:""}  {op.acidez?"Acid: "+op.acidez+" g/L":""} {op.alcohol?"Alc: "+op.alcohol+"%":""} {op.acidezV?"AV: "+op.acidezV:""} {op.so2libre?"SO2L: "+op.so2libre+" mg/L":""} {op.azucares?"Az: "+op.azucares+" g/L":""}
                </div>}
                {op.etiqueta&&<div style={{fontSize:12,color:C.gold}}>
                  {op.etiqueta}{op.anada?" "+op.anada:""} - {op.botellas} {op.formato==="bib5"?"BiB 5L":op.formato==="bib10"?"BiB 10L":op.formato==="bib15"?"BiB 15L":op.formato==="garrafa"?"Garrafas 20L":op.formato==="otro"?(op.capacidadEnvase+"L"):"bot."}
                </div>}
                {op.notas&&<div style={{fontSize:11,color:C.muted,fontStyle:"italic",marginTop:3}}>{op.notas}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── NUEVA OPERACION ────────────────────────────────────────────────────────
  if(vista==="nueva_op") {
    const f = formOp;
    const set = (k,v) => setFormOp(p=>({...p,[k]:v}));
    const esVendimia    = f.tipo==="vendimia";
    const esFermentacion= f.tipo==="fermentacion";
    const esEntradaGran = f.tipo==="entrada_granel";
    const esTrasiego    = f.tipo==="trasiego";
    const esTrat     = ["sulfitado","clarificacion","filtracion","acidez","azucar"].includes(f.tipo);
    const esAnalisis = f.tipo==="analisis";
    const esEmbotell = f.tipo==="embotellado";
    const esTemp     = f.tipo==="temperatura";
    const conLitros  = ["vendimia","llenado","trasiego","embotellado","salida_granel","entrada_granel"].includes(f.tipo);

    const guardar = () => {
      if(!f.tipo||!f.fecha||!f.depId) return;

      const litrosNuevos = parseFloat(f.litros||0);

      // Validar capacidad del deposito destino (en trasiego) o del propio deposito (en entradas)
      const esEntrada = ["vendimia","llenado","entrada_granel"].includes(f.tipo);
      const depDestId = f.tipo==="trasiego" ? f.depDestino : esEntrada ? f.depId : null;

      if(depDestId && litrosNuevos>0) {
        const depDest = [...depositos,...barricas].find(d=>d.id===depDestId);
        if(depDest && depDest.capacidad>0) {
          const litrosActualesDest = litrosActuales(depDestId);
          const litrosTras = f.tipo==="trasiego" ? litrosNuevos : litrosNuevos;
          if(litrosActualesDest + litrosTras > depDest.capacidad) {
            const disponible = depDest.capacidad - litrosActualesDest;
            alert("AVISO: " + depDest.nombre + " solo tiene " + disponible.toLocaleString("es-ES") + " L disponibles (capacidad " + depDest.capacidad.toLocaleString("es-ES") + " L, ya tiene " + litrosActualesDest.toLocaleString("es-ES") + " L). No se puede meter " + litrosNuevos.toLocaleString("es-ES") + " L.");
            return;
          }
        }
      }

      // Validar que hay suficientes litros en el origen (salidas y trasiegos)
      const esSalida = ["embotellado","salida_granel"].includes(f.tipo);
      const depOrigId = (f.tipo==="trasiego"||esSalida) ? f.depId : null;
      if(depOrigId && litrosNuevos>0) {
        const depOrig = depositos.find(d=>d.id===depOrigId);
        if(depOrig && !depOrig.siempreLleno) {
          const litrosOrig = litrosActuales(depOrigId);
          if(litrosNuevos > litrosOrig) {
            alert("AVISO: " + depOrig.nombre + " solo tiene " + litrosOrig.toLocaleString("es-ES") + " L. No puedes sacar " + litrosNuevos.toLocaleString("es-ES") + " L.");
            return;
          }
        }
      }

      setOperaciones(prev=>[{...f,id:Date.now()},...prev]);

      // Descontar materiales si es embotellado
      if(f.tipo==="embotellado") {
        const cant = parseFloat(f.botellas||0);
        if(cant>0) {
          setMateriales(prev=>({
            ...prev,
            botellas: prev.botellas.map(b=>b.id===f.tipoBottella?{...b,stock:Math.max(0,b.stock-cant)}:b),
            corchos:  prev.corchos.map(c=>c.id===f.tipoCorcho?{...c,stock:Math.max(0,c.stock-cant)}:c),
            precintas:prev.precintas.map(p=>p.id===f.seriePrecinta?{...p,usadas:p.usadas+cant}:p),
          }));
        }
      }

      setVista(selId?"ficha":"lista");
    };

    return (
      <div style={S.app}>
        <div style={S.header}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button style={S.back} onClick={()=>setVista(selId?"ficha":"lista")}>&#8249;</button>
            <div style={S.htitle}>Nueva operacion</div>
          </div>
          <Btn variant="gold" onClick={guardar}>Guardar</Btn>
        </div>
        <div style={S.body}>

          {/* Tipo */}
          <div style={S.sec}>Tipo de operacion</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
            {TIPOS_OP.map(t=>(
              <button key={t.id} onClick={()=>set("tipo",t.id)}
                style={{padding:"6px 11px",borderRadius:20,cursor:"pointer",fontFamily:"Georgia,serif",fontSize:12,
                  border:"2px solid "+(f.tipo===t.id?C.gold:C.border),
                  background:f.tipo===t.id?"#1A2535":"transparent",
                  color:f.tipo===t.id?C.gold:C.muted}}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Contenedor */}
          <label style={S.label}>Deposito / Barrica</label>
          <select style={S.input} value={f.depId||""} onChange={e=>set("depId",e.target.value)}>
            <option value="">-- Selecciona --</option>
            <optgroup label="Depositos">
              {depositos.filter(d=>d.activo).map(d=><option key={d.id} value={d.id}>{d.nombre} {d.capacidad?fmtL(d.capacidad):""}</option>)}
            </optgroup>
            <optgroup label="Barricas francesas">
              {barricas.filter(b=>b.tipo==="frances"&&b.activo).map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}
            </optgroup>
            <optgroup label="Barricas americanas">
              {barricas.filter(b=>b.tipo==="americano"&&b.activo).map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}
            </optgroup>
          </select>

          {/* Fecha */}
          <label style={S.label}>Fecha</label>
          <input type="date" style={S.input} value={f.fecha||""} onChange={e=>set("fecha",e.target.value)}/>

          {/* Fermentacion */}
          {esFermentacion&&<>
            <div style={{...S.card,background:"rgba(74,155,127,0.1)",borderColor:C.accent,fontSize:13,color:C.accent,marginBottom:10}}>
              Seguimiento de fermentacion — puedes registrarlo varias veces al dia
            </div>
            <label style={S.label}>Hora (opcional)</label>
            <input type="time" style={S.input} value={f.hora||""} onChange={e=>set("hora",e.target.value)}/>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}>
                <label style={S.label}>Densidad (g/L)</label>
                <input type="number" step="0.001" style={S.input} placeholder="ej. 1.080" value={f.densidad||""} onChange={e=>set("densidad",e.target.value)}/>
              </div>
              <div style={{flex:1}}>
                <label style={S.label}>Temperatura (C)</label>
                <input type="number" step="0.1" style={S.input} placeholder="ej. 22.5" value={f.temperatura||""} onChange={e=>set("temperatura",e.target.value)}/>
              </div>
            </div>
          </>}

          {/* Vendimia */}
          {esVendimia&&<>
            <label style={S.label}>Campana</label>
            <input type="text" style={S.input} placeholder="2025" value={f.campana||""} onChange={e=>set("campana",e.target.value)}/>
            <label style={S.label}>Variedad</label>
            <select style={S.input} value={f.variedad||""} onChange={e=>set("variedad",e.target.value)}>
              <option value="">-- Variedad --</option>
              {["Tempranillo","Garnacha","Graciano","Mazuelo","Viura","Malvasia","Garnacha Blanca","Otro"].map(v=><option key={v}>{v}</option>)}
            </select>
            <label style={S.label}>Kilos de uva</label>
            <input type="number" style={S.input} placeholder="0" value={f.kg||""} onChange={e=>set("kg",e.target.value)}/>
            <label style={S.label}>Grado alcoholico</label>
            <input type="number" step="0.1" style={S.input} placeholder="13.5" value={f.grado||""} onChange={e=>set("grado",e.target.value)}/>
            <label style={S.label}>Origen (viticultor)</label>
            <input type="text" style={S.input} placeholder="Nombre del viticultor" value={f.origen||""} onChange={e=>set("origen",e.target.value)}/>
          </>}

          {/* Entrada granel */}
          {esEntradaGran&&<>
            <label style={S.label}>Procedencia (bodega origen)</label>
            <input type="text" style={S.input} placeholder="Nombre de la bodega" value={f.origen||""} onChange={e=>set("origen",e.target.value)}/>
            <label style={S.label}>Tipo de vino</label>
            <select style={S.input} value={f.tipoVino||""} onChange={e=>set("tipoVino",e.target.value)}>
              <option value="">-- Tipo --</option>
              {["Tinto","Blanco","Rosado","Mosto"].map(v=><option key={v}>{v}</option>)}
            </select>
            <label style={S.label}>Variedad</label>
            <input type="text" style={S.input} placeholder="ej. Tempranillo" value={f.variedad||""} onChange={e=>set("variedad",e.target.value)}/>
            <label style={S.label}>Anada</label>
            <input type="text" style={S.input} placeholder="ej. 2024" value={f.anada||""} onChange={e=>set("anada",e.target.value)}/>
            <label style={S.label}>Destino</label>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              {[["deposito","Deposito"],["botellero","Botellero"]].map(([v,l])=>(
                <button key={v} onClick={()=>set("destino",v)}
                  style={{flex:1,padding:"8px",borderRadius:8,cursor:"pointer",fontFamily:"Georgia,serif",fontSize:12,
                    border:"2px solid "+((f.destino||"deposito")===v?C.gold:C.border),
                    background:(f.destino||"deposito")===v?"#1A2535":"transparent",
                    color:(f.destino||"deposito")===v?C.gold:C.muted}}>
                  {l}
                </button>
              ))}
            </div>
            {(f.destino||"deposito")==="botellero"&&<>
              <label style={S.label}>Numero de botellas</label>
              <input type="number" style={S.input} placeholder="0" value={f.botellas||""} onChange={e=>set("botellas",e.target.value)}/>
              <label style={S.label}>Etiqueta / Producto</label>
              <input type="text" style={S.input} placeholder="ej. Araico Tinto 2024" value={f.etiqueta||""} onChange={e=>set("etiqueta",e.target.value)}/>
            </>}
          </>}

          {/* Litros */}
          {conLitros&&<>
            <label style={S.label}>Litros</label>
            {(()=>{
              const destId = f.tipo==="trasiego" ? f.depDestino : ["vendimia","llenado","entrada_granel"].includes(f.tipo) ? f.depId : null;
              const origId = ["trasiego","embotellado","salida_granel"].includes(f.tipo) ? f.depId : null;
              const depDest = destId ? [...depositos,...barricas].find(d=>d.id===destId) : null;
              const depOrig = origId ? depositos.find(d=>d.id===origId) : null;
              const disponDest = depDest&&depDest.capacidad>0 ? depDest.capacidad - litrosActuales(destId) : null;
              const disponOrig = depOrig&&!depOrig.siempreLleno ? litrosActuales(origId) : null;
              return (<>
                <input type="number" style={S.input} placeholder="0" value={f.litros||""} onChange={e=>set("litros",e.target.value)}/>
                {disponDest!==null&&<div style={{fontSize:11,color:disponDest>0?C.accent:C.danger,marginTop:-4,marginBottom:8}}>
                  Capacidad disponible en {depDest.nombre}: {fmtL(disponDest)}
                </div>}
                {disponOrig!==null&&<div style={{fontSize:11,color:disponOrig>0?C.gold:C.danger,marginTop:-4,marginBottom:8}}>
                  Disponible en {depOrig.nombre}: {fmtL(disponOrig)}
                </div>}
              </>);
            })()}
          </>}

          {/* Trasiego */}
          {esTrasiego&&<>
            <label style={S.label}>Deposito destino</label>
            <select style={S.input} value={f.depDestino||""} onChange={e=>set("depDestino",e.target.value)}>
              <option value="">-- Destino --</option>
              <optgroup label="Depositos">
                {depositos.filter(d=>d.activo&&d.id!==f.depId).map(d=><option key={d.id} value={d.id}>{d.nombre}</option>)}
              </optgroup>
              <optgroup label="Barricas francesas">
                {barricas.filter(b=>b.tipo==="frances"&&b.activo).map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}
              </optgroup>
              <optgroup label="Barricas americanas">
                {barricas.filter(b=>b.tipo==="americano"&&b.activo).map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}
              </optgroup>
            </select>
          </>}

          {/* Tratamiento */}
          {esTrat&&<>
            <label style={S.label}>Producto</label>
            <input type="text" style={S.input} placeholder="Nombre del producto" value={f.producto||""} onChange={e=>set("producto",e.target.value)}/>
            <label style={S.label}>Dosis</label>
            <input type="text" style={S.input} placeholder="ej. 5 g/hL" value={f.dosis||""} onChange={e=>set("dosis",e.target.value)}/>
          </>}

          {/* Temperatura */}
          {esTemp&&<>
            <label style={S.label}>Temperatura (C)</label>
            <input type="number" step="0.1" style={S.input} placeholder="18.0" value={f.temperatura||""} onChange={e=>set("temperatura",e.target.value)}/>
          </>}

          {/* Analisis */}
          {esAnalisis&&<>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}><label style={S.label}>pH</label><input type="number" step="0.01" style={S.input} placeholder="3.50" value={f.ph||""} onChange={e=>set("ph",e.target.value)}/></div>
              <div style={{flex:1}}><label style={S.label}>Acidez total</label><input type="number" step="0.1" style={S.input} placeholder="5.5" value={f.acidez||""} onChange={e=>set("acidez",e.target.value)}/></div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}><label style={S.label}>Alcohol %</label><input type="number" step="0.1" style={S.input} placeholder="13.5" value={f.alcohol||""} onChange={e=>set("alcohol",e.target.value)}/></div>
              <div style={{flex:1}}><label style={S.label}>Acid. volatil</label><input type="number" step="0.01" style={S.input} placeholder="0.45" value={f.acidezV||""} onChange={e=>set("acidezV",e.target.value)}/></div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}><label style={S.label}>SO2 libre</label><input type="number" style={S.input} placeholder="35" value={f.so2libre||""} onChange={e=>set("so2libre",e.target.value)}/></div>
              <div style={{flex:1}}><label style={S.label}>SO2 total</label><input type="number" style={S.input} placeholder="80" value={f.so2total||""} onChange={e=>set("so2total",e.target.value)}/></div>
            </div>
          </>}

          {/* Embotellado */}
          {esEmbotell&&<>
            <label style={S.label}>Destino</label>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              {[["almacen","Almacen (etiquetado)"],["botellero","Botellero (sin etiquetar)"]].map(([v,l])=>(
                <button key={v} onClick={()=>set("destino",v)}
                  style={{flex:1,padding:"8px",borderRadius:8,cursor:"pointer",fontFamily:"Georgia,serif",fontSize:12,
                    border:"2px solid "+((f.destino||"almacen")===v?C.gold:C.border),
                    background:(f.destino||"almacen")===v?"#1A2535":"transparent",
                    color:(f.destino||"almacen")===v?C.gold:C.muted}}>
                  {l}
                </button>
              ))}
            </div>
            <label style={S.label}>Etiqueta / Producto</label>
            <input type="text" style={S.input} placeholder="ej. Araico Tinto 2023" value={f.etiqueta||""} onChange={e=>set("etiqueta",e.target.value)}/>
            <label style={S.label}>Anada</label>
            <input type="text" style={S.input} placeholder="ej. 2023" value={f.anada||""} onChange={e=>set("anada",e.target.value)}/>
            <label style={S.label}>Formato de envase</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
              {[["botella","Botella 0,75L"],["bib5","BiB 5L"],["bib10","BiB 10L"],["bib15","BiB 15L"],["garrafa","Garrafa 20L"],["otro","Otro"]].map(([v,l])=>(
                <button key={v} onClick={()=>set("formato",v)}
                  style={{padding:"6px 12px",borderRadius:20,cursor:"pointer",fontFamily:"Georgia,serif",fontSize:11,
                    border:"2px solid "+((f.formato||"botella")===v?C.gold:C.border),
                    background:(f.formato||"botella")===v?"#1A2535":"transparent",
                    color:(f.formato||"botella")===v?C.gold:C.muted}}>
                  {l}
                </button>
              ))}
            </div>
            {f.formato==="otro"&&<>
              <label style={S.label}>Capacidad del envase (litros)</label>
              <input type="number" step="0.1" style={S.input} placeholder="ej. 3" value={f.capacidadEnvase||""} onChange={e=>set("capacidadEnvase",e.target.value)}/>
            </>}
            <label style={S.label}>Cantidad de envases</label>
            <input type="number" style={S.input} placeholder="0" value={f.botellas||""} onChange={e=>set("botellas",e.target.value)}/>
            {/* Calculo automatico de litros */}
            {f.botellas&&(()=>{
              const caps = {"botella":0.75,"bib5":5,"bib10":10,"bib15":15,"garrafa":20,"otro":parseFloat(f.capacidadEnvase||0)};
              const cap = caps[f.formato||"botella"];
              const litrosCalc = cap * parseFloat(f.botellas||0);
              return litrosCalc>0 ? <div style={{fontSize:12,color:C.accent,marginTop:-4,marginBottom:8}}>= {litrosCalc.toLocaleString("es-ES")} L totales</div> : null;
            })()}
            <label style={S.label}>Tipo de botella</label>
            <select style={S.input} value={f.tipoBottella||""} onChange={e=>set("tipoBottella",e.target.value)}>
              <option value="">-- Selecciona tipo --</option>
              {materiales.botellas.map(b=><option key={b.id} value={b.id}>{b.nombre} (stock: {fmt(b.stock)})</option>)}
            </select>
            <label style={S.label}>Tipo de corcho</label>
            <select style={S.input} value={f.tipoCorcho||""} onChange={e=>set("tipoCorcho",e.target.value)}>
              <option value="">-- Selecciona tipo --</option>
              {materiales.corchos.map(c=><option key={c.id} value={c.id}>{c.nombre} (stock: {fmt(c.stock)})</option>)}
            </select>
            <label style={S.label}>Serie de precintas</label>
            <select style={S.input} value={f.seriePrecinta||""} onChange={e=>set("seriePrecinta",e.target.value)}>
              <option value="">-- Selecciona serie --</option>
              {materiales.precintas.filter(p=>p.total-p.usadas>0).map(p=><option key={p.id} value={p.id}>{p.serie} ({fmt(p.total-p.usadas)} restantes)</option>)}
            </select>
            <label style={S.label}>Lote envases</label>
            <input type="text" style={S.input} placeholder="ej. L2025-001" value={f.loteBotellas||""} onChange={e=>set("loteBotellas",e.target.value)}/>
            <label style={S.label}>Lote corchos / tapones</label>
            <input type="text" style={S.input} placeholder="ej. C2025-001" value={f.loteCorchos||""} onChange={e=>set("loteCorchos",e.target.value)}/>
            <label style={S.label}>Lote etiquetas</label>
            <input type="text" style={S.input} placeholder="ej. E2025-001" value={f.loteEtiqueta||""} onChange={e=>set("loteEtiqueta",e.target.value)}/>
          </>}

          {/* Etiquetado desde botellero */}
          {f.tipo==="etiquetado"&&<>
            <div style={{...S.card,background:"rgba(200,160,80,0.1)",borderColor:"#C8A050",fontSize:13,color:"#C8A050",marginBottom:10}}>
              Botellas que pasan del botellero al almacen etiquetadas
            </div>
            <label style={S.label}>Producto</label>
            <input type="text" style={S.input} placeholder="ej. Araico Tinto 2023" value={f.etiqueta||""} onChange={e=>set("etiqueta",e.target.value)}/>
            <label style={S.label}>Anada</label>
            <input type="text" style={S.input} placeholder="ej. 2023" value={f.anada||""} onChange={e=>set("anada",e.target.value)}/>
            <label style={S.label}>Numero de botellas</label>
            <input type="number" style={S.input} placeholder="0" value={f.botellas||""} onChange={e=>set("botellas",e.target.value)}/>
          </>}

          {/* Notas */}
          <label style={S.label}>Notas</label>
          <textarea style={{...S.input,minHeight:70,resize:"vertical"}} placeholder="Observaciones..." value={f.notas||""} onChange={e=>set("notas",e.target.value)}/>

          <div style={{marginTop:8}}>
            <Btn variant="gold" onClick={guardar} full>Guardar operacion</Btn>
          </div>
        </div>
      </div>
    );
  }

  // ── TAB DEPOSITOS ──────────────────────────────────────────────────────────
  if(tab==="depositos") {
    const deps = depositos.filter(d=>d.activo);
    const totalL   = deps.reduce((s,d)=>s+(d.siempreLleno?d.capacidad:litrosActuales(d.id)),0);
    const totalCap = deps.reduce((s,d)=>s+d.capacidad,0);
    const pctTotal = totalCap>0?Math.round((totalL/totalCap)*100):0;

    // Anadas disponibles
    const anadasDisp = [...new Set(deps.map(d=>d.anada).filter(Boolean))].sort((a,b)=>b-a);

    // Totales por tipo
    const totalTinto  = deps.filter(d=>d.tipoVino==="tinto"). reduce((s,d)=>s+(d.siempreLleno?d.capacidad:litrosActuales(d.id)),0);
    const totalBlanco = deps.filter(d=>d.tipoVino==="blanco").reduce((s,d)=>s+(d.siempreLleno?d.capacidad:litrosActuales(d.id)),0);

    return (
      <div style={{...S.app,display:"flex",flexDirection:"column",minHeight:"100vh"}}>
        <div style={S.header}>
          <div>
            <div style={S.htitle}>Bodegas Araico</div>
            <div style={S.hsub}>{guardando?"Guardando...":"Guardado"}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <Btn variant="ghost" small onClick={()=>setVista("importar_analisis")}>PDF Lab.</Btn>
            <Btn variant="gold" small onClick={()=>{setFormOp({fecha:hoy(),tipo:"",litros:""});setSelId(null);setVista("nueva_op");}}>
              + Operacion
            </Btn>
          </div>
        </div>
        <div style={{...S.body,flex:1}}>

          {/* Resumen total */}
          <div style={{...S.card,background:"#0A1520",borderColor:C.gold,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div>
                <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.07em"}}>Total bodega</div>
                <div style={{fontSize:24,fontWeight:700,color:C.gold}}>{fmtL(totalL)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:C.muted,textTransform:"uppercase"}}>Capacidad</div>
                <div style={{fontSize:18,fontWeight:700,color:C.muted}}>{fmtL(totalCap)}</div>
                <div style={{fontSize:12,color:C.muted}}>{pctTotal}% ocupado</div>
              </div>
            </div>
            <div style={{height:6,background:C.border,borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:pctTotal+"%",background:C.gold,borderRadius:3}}/>
            </div>
            {/* Resumen tinto/blanco */}
            <div style={{display:"flex",gap:10,marginTop:10}}>
              {totalTinto>0&&<div style={{flex:1,background:"rgba(139,26,42,0.3)",border:"1px solid #C23050",borderRadius:8,padding:"6px 10px",textAlign:"center"}}>
                <div style={{fontSize:9,color:"#F0A0B0",textTransform:"uppercase"}}>Tinto</div>
                <div style={{fontSize:14,fontWeight:700,color:"#F0A0B0"}}>{fmtL(totalTinto)}</div>
              </div>}
              {totalBlanco>0&&<div style={{flex:1,background:"rgba(160,128,32,0.3)",border:"1px solid #D4B840",borderRadius:8,padding:"6px 10px",textAlign:"center"}}>
                <div style={{fontSize:9,color:"#F0DCA0",textTransform:"uppercase"}}>Blanco</div>
                <div style={{fontSize:14,fontWeight:700,color:"#F0DCA0"}}>{fmtL(totalBlanco)}</div>
              </div>}
            </div>
          </div>

          {/* Filtros */}
          <div style={{marginBottom:10}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
              {["todos","tinto","blanco","rosado","mosto"].map(t=>(
                <button key={t} onClick={()=>setFiltroTipo(t)}
                  style={{padding:"4px 12px",borderRadius:20,cursor:"pointer",fontFamily:"Georgia,serif",fontSize:11,border:"2px solid "+(filtroTipo===t?COLOR_TIPO[t]?.borde||C.gold:C.border),background:filtroTipo===t?"#1A2535":"transparent",color:filtroTipo===t?COLOR_TIPO[t]?.texto||C.gold:C.muted}}>
                  {t==="todos"?"Todos":t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>
            {anadasDisp.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <button onClick={()=>setFiltroAnada("todas")}
                style={{padding:"3px 10px",borderRadius:20,cursor:"pointer",fontFamily:"Georgia,serif",fontSize:11,border:"2px solid "+(filtroAnada==="todas"?C.gold:C.border),background:filtroAnada==="todas"?"#1A2535":"transparent",color:filtroAnada==="todas"?C.gold:C.muted}}>
                Todas las anadas
              </button>
              {anadasDisp.map(a=>(
                <button key={a} onClick={()=>setFiltroAnada(a)}
                  style={{padding:"3px 10px",borderRadius:20,cursor:"pointer",fontFamily:"Georgia,serif",fontSize:11,border:"2px solid "+(filtroAnada===a?C.gold:C.border),background:filtroAnada===a?"#1A2535":"transparent",color:filtroAnada===a?C.gold:C.muted}}>
                  {a}
                </button>
              ))}
            </div>}
          </div>

          {/* Cuadricula de tanques */}
          <div style={{display:"flex",flexWrap:"wrap",justifyContent:"flex-start"}}>
            {deps.map(dep=>{
              const litros = dep.siempreLleno ? dep.capacidad : litrosActuales(dep.id);
              const matchTipo  = filtroTipo==="todos"  || (dep.tipoVino||"")=== filtroTipo;
              const matchAnada = filtroAnada==="todas" || (dep.anada||"")=== filtroAnada;
              const resaltado  = (filtroTipo==="todos" && filtroAnada==="todas") ? true : matchTipo && matchAnada;
              return (
                <Tanque key={dep.id} dep={dep} litros={litros} resaltado={resaltado}
                  onClick={()=>{setSelId(dep.id);setVista("ficha");}}/>
              );
            })}
          </div>

          {/* Leyenda */}
          <div style={{display:"flex",gap:12,marginTop:12,fontSize:10,color:C.muted,justifyContent:"center",flexWrap:"wrap"}}>
            {[["tinto","Tinto"],["blanco","Blanco"],["rosado","Rosado"],["mosto","Mosto"]].map(([k,l])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:10,height:10,borderRadius:2,background:COLOR_TIPO[k].liq,border:"1px solid "+COLOR_TIPO[k].borde}}/>{l}
              </div>
            ))}
          </div>
        </div>
        <TabBar tab={tab} setTab={setTab}/>
      </div>
    );
  }

  // ── TAB BARRICAS ──────────────────────────────────────────────────────────
  if(tab==="barricas") {
    const barricasActivas = barricas.filter(b=>b.activo);
    const totalLitros = barricasActivas.length * 225;
    const franc = barricasActivas.filter(b=>b.tipo==="frances").length;
    const amer  = barricasActivas.filter(b=>b.tipo==="americano").length;

    // Agrupar por lote de vino
    const lotes = {};
    barricasActivas.forEach(b=>{
      const key = (b.etiqueta||"Sin asignar")+"__"+(b.anada||"");
      if(!lotes[key]) lotes[key]={etiqueta:b.etiqueta||"Sin asignar",anada:b.anada||"",tipoVino:b.tipoVino||"",frances:0,americano:0,total:0};
      lotes[key][b.tipo]++;
      lotes[key].total++;
    });

    return (
      <div style={{...S.app,display:"flex",flexDirection:"column",minHeight:"100vh"}}>
        <div style={S.header}>
          <div><div style={S.htitle}>Barricas</div><div style={S.hsub}>{barricasActivas.length} barricas - {fmtL(totalLitros)}</div></div>
          <Btn variant="gold" small onClick={()=>{setFormOp({fecha:hoy(),tipo:"",litros:""});setSelId(null);setVista("nueva_op");}}>+ Op.</Btn>
        </div>
        <div style={{...S.body,flex:1}}>

          {/* Resumen */}
          <div style={{...S.card,background:"#0A1520",borderColor:C.gold,marginBottom:12}}>
            <div style={{display:"flex",gap:10}}>
              <div style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:10,color:C.muted,textTransform:"uppercase"}}>Francesas</div>
                <div style={{fontSize:20,fontWeight:700,color:C.gold}}>{franc}</div>
                <div style={{fontSize:11,color:C.muted}}>{fmtL(franc*225)}</div>
              </div>
              <div style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:10,color:C.muted,textTransform:"uppercase"}}>Americanas</div>
                <div style={{fontSize:20,fontWeight:700,color:C.gold}}>{amer}</div>
                <div style={{fontSize:11,color:C.muted}}>{fmtL(amer*225)}</div>
              </div>
              <div style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:10,color:C.muted,textTransform:"uppercase"}}>Total</div>
                <div style={{fontSize:20,fontWeight:700,color:C.gold}}>{barricasActivas.length}</div>
                <div style={{fontSize:11,color:C.muted}}>{fmtL(totalLitros)}</div>
              </div>
            </div>
          </div>

          {/* Lotes de vino */}
          <div style={S.sec}>Por lote de vino</div>
          {Object.entries(lotes).sort((a,b)=>b[1].total-a[1].total).map(([key,d])=>{
            const col = (d.tipoVino&&COLOR_TIPO[d.tipoVino])?COLOR_TIPO[d.tipoVino]:COLOR_TIPO.vacio;
            return (
              <div key={key} style={{...S.card,borderLeft:"4px solid "+col.borde,marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:col.texto}}>{d.etiqueta}</div>
                    {d.anada&&<div style={{fontSize:12,color:C.muted}}>Anada {d.anada}</div>}
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>{fmtL(d.total*225)}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:28,fontWeight:700,color:col.texto}}>{d.total}</div>
                    <div style={{fontSize:10,color:C.muted}}>barricas</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  {d.frances>0&&<div style={{background:"rgba(200,169,110,0.15)",border:"1px solid "+C.gold,borderRadius:8,padding:"4px 10px",fontSize:11,color:C.gold}}>
                    {d.frances} francesa{d.frances>1?"s":""}
                  </div>}
                  {d.americano>0&&<div style={{background:"rgba(255,255,255,0.05)",border:"1px solid "+C.border,borderRadius:8,padding:"4px 10px",fontSize:11,color:C.muted}}>
                    {d.americano} americana{d.americano>1?"s":""}
                  </div>}
                </div>
              </div>
            );
          })}
        </div>
        <TabBar tab={tab} setTab={setTab}/>
      </div>
    );
  }

  // ── TAB OPERACIONES ────────────────────────────────────────────────────────
  if(tab==="ops") {
    const recientes = [...operaciones].sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.id-a.id).slice(0,50);
    return (
      <div style={{...S.app,display:"flex",flexDirection:"column",minHeight:"100vh"}}>
        <div style={S.header}>
          <div><div style={S.htitle}>Operaciones</div><div style={S.hsub}>{operaciones.length} registradas</div></div>
          <Btn variant="gold" small onClick={()=>{setFormOp({fecha:hoy(),tipo:"",litros:""});setSelId(null);setVista("nueva_op");}}>+ Op.</Btn>
        </div>
        <div style={{...S.body,flex:1}}>
          {operaciones.length===0&&(
            <div style={{...S.card,color:C.muted,textAlign:"center",padding:"40px 16px"}}>
              Sin operaciones registradas
            </div>
          )}
          {recientes.map(op=>{
            const dep = todosContenedores.find(d=>d.id===op.depId);
            const t   = TIPOS_OP.find(x=>x.id===op.tipo);
            const col = ["vendimia","llenado"].includes(op.tipo)?C.accent:["embotellado","salida_granel"].includes(op.tipo)?C.danger:C.gold;
            return (
              <div key={op.id} style={{...S.card,borderLeft:"3px solid "+col,marginBottom:6,padding:"10px 12px",cursor:"pointer"}}
                onClick={()=>{setSelId(op.depId);setVista("ficha");}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <div>
                    <span style={{fontSize:12,fontWeight:700,color:col}}>{t?.label||op.tipo}</span>
                    <span style={{fontSize:11,color:C.muted,marginLeft:8}}>{dep?.nombre||op.depId}</span>
                  </div>
                  <span style={{fontSize:11,color:C.muted}}>{fmtF(op.fecha)}</span>
                </div>
                {op.litros&&<div style={{fontSize:13}}>{fmtL(op.litros)}{op.kg?" / "+fmtK(op.kg):""}</div>}
                {op.variedad&&<div style={{fontSize:12,color:C.muted}}>{op.variedad}{op.campana?" "+op.campana:""}</div>}
                {op.notas&&<div style={{fontSize:11,color:C.muted,fontStyle:"italic"}}>{op.notas}</div>}
              </div>
            );
          })}
        </div>
        <TabBar tab={tab} setTab={setTab}/>
      </div>
    );
  }

  // ── TAB STOCK ─────────────────────────────────────────────────────────────
  if(tab==="stock") {
    // Botellero: embotellados con destino="botellero"
    // Almacen: embotellados con destino="almacen" + los que se etiquetaron desde botellero
    const botellero = {};
    const almacen   = {};

    operaciones.filter(o=>o.tipo==="embotellado"||o.tipo==="entrada_granel").forEach(op=>{
      const k = (op.etiqueta||"Sin etiquetar")+" "+(op.anada||"");
      const dest = op.destino||"almacen";
      const esBotellero = op.tipo==="entrada_granel" ? dest==="botellero" : dest==="botellero";
      if(esBotellero){
        if(!botellero[k]) botellero[k]={botellas:0,etiqueta:op.etiqueta||"Sin etiquetar",anada:op.anada||"",lotes:[],ops:[]};
        botellero[k].botellas += parseFloat(op.botellas||0);
        if(op.loteBotellas) botellero[k].lotes.push(op.loteBotellas);
        botellero[k].ops.push(op.id);
      } else {
        if(!almacen[k]) almacen[k]={botellas:0,etiqueta:op.etiqueta||"Sin etiquetar",anada:op.anada||"",lotes:[],ops:[]};
        almacen[k].botellas += parseFloat(op.botellas||0);
        if(op.loteBotellas) almacen[k].lotes.push(op.loteBotellas);
        almacen[k].ops.push(op.id);
      }
    });

    // Etiquetados desde botellero pasan a almacen
    operaciones.filter(o=>o.tipo==="etiquetado").forEach(op=>{
      const k = (op.etiqueta||"Sin etiquetar")+" "+(op.anada||"");
      const kOrig = (op.etiquetaOrig||op.etiqueta||"Sin etiquetar")+" "+(op.anada||"");
      // Resta del botellero
      if(botellero[kOrig]) botellero[kOrig].botellas -= parseFloat(op.botellas||0);
      // Suma al almacen
      if(!almacen[k]) almacen[k]={botellas:0,etiqueta:op.etiqueta||"",anada:op.anada||"",lotes:[],ops:[]};
      almacen[k].botellas += parseFloat(op.botellas||0);
    });

    const totalBotellero = Object.values(botellero).reduce((s,v)=>s+v.botellas,0);
    const totalAlmacen   = Object.values(almacen).reduce((s,v)=>s+v.botellas,0);
    const graneles = operaciones.filter(o=>o.tipo==="salida_granel");

    const abrirEtiquetado = (k, datos) => {
      setFormOp({tipo:"etiquetado", fecha:hoy(), etiquetaOrig:datos.etiqueta, anada:datos.anada,
        etiqueta:datos.etiqueta, botellas:"", notas:""});
      setVista("nueva_op");
    };

    return (
      <div style={{...S.app,display:"flex",flexDirection:"column",minHeight:"100vh"}}>
        <div style={S.header}>
          <div><div style={S.htitle}>Stock</div><div style={S.hsub}>{fmt(totalBotellero+totalAlmacen)} botellas en total</div></div>
        </div>
        <div style={{...S.body,flex:1}}>

          {/* Resumen */}
          <div style={{display:"flex",gap:10,marginBottom:12}}>
            <div style={{...S.card,flex:1,textAlign:"center",margin:0,borderColor:"#8B6020"}}>
              <div style={{fontSize:10,color:"#C8A050",textTransform:"uppercase"}}>Botellero</div>
              <div style={{fontSize:26,fontWeight:700,color:"#C8A050"}}>{fmt(totalBotellero)}</div>
              <div style={{fontSize:11,color:C.muted}}>sin etiquetar</div>
            </div>
            <div style={{...S.card,flex:1,textAlign:"center",margin:0,borderColor:C.accent}}>
              <div style={{fontSize:10,color:C.accent,textTransform:"uppercase"}}>Almacen</div>
              <div style={{fontSize:26,fontWeight:700,color:C.accent}}>{fmt(totalAlmacen)}</div>
              <div style={{fontSize:11,color:C.muted}}>disponibles</div>
            </div>
          </div>

          {/* Botellero */}
          <div style={S.sec}>Botellero (sin etiquetar)</div>
          {Object.keys(botellero).filter(k=>botellero[k].botellas>0).length===0
            ? <div style={{...S.card,color:C.muted,fontSize:13,textAlign:"center",padding:"20px"}}>Botellero vacio</div>
            : Object.entries(botellero).filter(([,d])=>d.botellas>0).map(([k,d])=>(
              <div key={k} style={{...S.card,borderLeft:"3px solid #C8A050",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:"#C8A050"}}>{d.etiqueta||"Sin etiquetar"}</div>
                    {d.anada&&<div style={{fontSize:12,color:C.muted}}>Anada {d.anada}</div>}
                    {d.lotes.length>0&&<div style={{fontSize:11,color:C.muted}}>Lote: {d.lotes.join(", ")}</div>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:22,fontWeight:700,color:"#C8A050"}}>{fmt(d.botellas)}</div>
                    <div style={{fontSize:11,color:C.muted}}>botellas</div>
                  </div>
                </div>
                <div style={{marginTop:10}}>
                  <Btn variant="gold" small onClick={()=>abrirEtiquetado(k,d)}>Pasar a almacen</Btn>
                </div>
              </div>
            ))
          }

          {/* Almacen */}
          <div style={S.sec}>Almacen (disponibles para venta)</div>
          {Object.keys(almacen).filter(k=>almacen[k].botellas>0).length===0
            ? <div style={{...S.card,color:C.muted,fontSize:13,textAlign:"center",padding:"20px"}}>Almacen vacio</div>
            : Object.entries(almacen).filter(([,d])=>d.botellas>0).sort((a,b)=>b[1].botellas-a[1].botellas).map(([k,d])=>(
              <div key={k} style={{...S.card,borderLeft:"3px solid "+C.accent,marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.accent}}>{d.etiqueta}</div>
                    {d.anada&&<div style={{fontSize:12,color:C.muted}}>Anada {d.anada}</div>}
                    {d.lotes.length>0&&<div style={{fontSize:11,color:C.muted}}>Lote: {d.lotes.join(", ")}</div>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:22,fontWeight:700,color:C.accent}}>{fmt(d.botellas)}</div>
                    <div style={{fontSize:11,color:C.muted}}>botellas</div>
                  </div>
                </div>
              </div>
            ))
          }

          {/* Granel */}
          {graneles.length>0&&<>
            <div style={S.sec}>Salidas a granel</div>
            {graneles.sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(op=>(
              <div key={op.id} style={{...S.card,marginBottom:6,borderLeft:"3px solid "+C.danger}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:14,fontWeight:700}}>{fmtL(op.litros)}</span>
                  <span style={{fontSize:12,color:C.muted}}>{fmtF(op.fecha)}</span>
                </div>
                {op.depId&&<div style={{fontSize:11,color:C.muted}}>Desde: {op.depId}</div>}
                {op.notas&&<div style={{fontSize:11,color:C.muted,fontStyle:"italic"}}>{op.notas}</div>}
              </div>
            ))}
          </>}

          {/* Cervezas */}
          <div style={S.sec}>Cervezas</div>
          {[["grape","Cerveza Grape","#E8A020"],["negra","Cerveza Negra","#3A2A1A"]].map(([tipo,nombre,color])=>(
            <div key={tipo} style={{...S.card,borderLeft:"3px solid "+color,marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:color}}>{nombre}</div>
                  <div style={{fontSize:11,color:C.muted}}>Latas 33cl - Cajas de 12</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:26,fontWeight:700,color:color}}>{cervezas[tipo]}</div>
                  <div style={{fontSize:11,color:C.muted}}>latas</div>
                  <div style={{fontSize:11,color:C.muted}}>{Math.floor(cervezas[tipo]/12)} cajas + {cervezas[tipo]%12} sueltas</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn variant="ghost" small onClick={()=>setFormCerveza({tipo,nombre,accion:"entrada",unidad:"caja",cantidad:""})}>+ Entrada</Btn>
                <Btn variant="ghost" small onClick={()=>setFormCerveza({tipo,nombre,accion:"salida",unidad:"lata",cantidad:""})}>- Salida</Btn>
              </div>
            </div>
          ))}

          {/* Modal entrada/salida cerveza */}
          {formCerveza&&(
            <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
              <div style={{...S.card,width:"100%",maxWidth:360}}>
                <div style={{fontSize:15,fontWeight:700,color:C.gold,marginBottom:12}}>
                  {formCerveza.accion==="entrada"?"Entrada":"Salida"} - {formCerveza.nombre}
                </div>
                <label style={S.label}>Unidad</label>
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  {[["caja","Caja (12 latas)"],["lata","Lata suelta"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setFormCerveza(p=>({...p,unidad:v}))}
                      style={{flex:1,padding:"8px",borderRadius:8,cursor:"pointer",fontFamily:"Georgia,serif",fontSize:12,
                        border:"2px solid "+(formCerveza.unidad===v?C.gold:C.border),
                        background:formCerveza.unidad===v?"#1A2535":"transparent",
                        color:formCerveza.unidad===v?C.gold:C.muted}}>
                      {l}
                    </button>
                  ))}
                </div>
                <label style={S.label}>Cantidad</label>
                <input type="number" style={S.input} placeholder="0" value={formCerveza.cantidad}
                  onChange={e=>setFormCerveza(p=>({...p,cantidad:e.target.value}))}/>
                {formCerveza.cantidad&&<div style={{fontSize:12,color:C.accent,marginTop:-4,marginBottom:8}}>
                  = {formCerveza.unidad==="caja" ? parseFloat(formCerveza.cantidad)*12 : parseFloat(formCerveza.cantidad)} latas
                </div>}
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <Btn variant="ghost" onClick={()=>setFormCerveza(null)} full>Cancelar</Btn>
                  <Btn variant="gold" onClick={()=>{
                    const latas = formCerveza.unidad==="caja" ? parseFloat(formCerveza.cantidad||0)*12 : parseFloat(formCerveza.cantidad||0);
                    if(!latas) return;
                    setCervezas(prev=>({...prev,
                      [formCerveza.tipo]: Math.max(0, prev[formCerveza.tipo] + (formCerveza.accion==="entrada"?latas:-latas))
                    }));
                    setFormCerveza(null);
                  }} full>Confirmar</Btn>
                </div>
              </div>
            </div>
          )}
        </div>
        <TabBar tab={tab} setTab={setTab}/>
      </div>
    );
  }

  // ── TAB MATERIALES ────────────────────────────────────────────────────────
  if(tab==="materiales") {
    const SeccionMaterial = ({titulo, items, categoria}) => (
      <>
        <div style={S.sec}>{titulo}</div>
        {items.map(item=>(
          <div key={item.id} style={{...S.card,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:14,fontWeight:700,color:C.gold}}>{item.nombre}</div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:22,fontWeight:700,color:item.stock>0?C.accent:C.muted}}>{fmt(item.stock)}</div>
                <div style={{fontSize:10,color:C.muted}}>unidades</div>
              </div>
            </div>
            {item.lotes.length>0&&<div style={{fontSize:11,color:C.muted,marginBottom:8}}>
              Lotes: {item.lotes.map(l=>l.ref).join(", ")}
            </div>}
            <Btn variant="ghost" small onClick={()=>setFormMat({categoria,id:item.id,nombre:item.nombre,tipo:"entrada",cantidad:"",ref:""})}>
              + Entrada
            </Btn>
          </div>
        ))}
      </>
    );

    return (
      <div style={{...S.app,display:"flex",flexDirection:"column",minHeight:"100vh"}}>
        <div style={S.header}>
          <div><div style={S.htitle}>Materiales</div><div style={S.hsub}>Botellas, corchos y precintas</div></div>
          <Btn variant="gold" small onClick={()=>setFormMat({categoria:"precintas",tipo:"nueva_serie",serie:"",inicio:"",fin:""})}>+ Precinta</Btn>
        </div>
        <div style={{...S.body,flex:1}}>

          <SeccionMaterial titulo="Botellas" items={materiales.botellas} categoria="botellas"/>
          <SeccionMaterial titulo="Corchos"  items={materiales.corchos}  categoria="corchos"/>

          {/* Precintas */}
          <div style={S.sec}>Precintas</div>
          {materiales.precintas.length===0
            ? <div style={{...S.card,color:C.muted,fontSize:13,textAlign:"center",padding:"20px"}}>Sin series de precintas registradas</div>
            : materiales.precintas.map(p=>{
              const restantes = p.total - p.usadas;
              const pct = Math.round((p.usadas/p.total)*100);
              return (
                <div key={p.id} style={{...S.card,marginBottom:8,borderLeft:"3px solid "+(restantes>0?C.gold:C.muted)}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:C.gold}}>{p.serie}</div>
                      <div style={{fontSize:11,color:C.muted}}>{fmt(p.inicio)} - {fmt(p.fin)}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:18,fontWeight:700,color:restantes>0?C.accent:C.muted}}>{fmt(restantes)}</div>
                      <div style={{fontSize:10,color:C.muted}}>restantes de {fmt(p.total)}</div>
                    </div>
                  </div>
                  <div style={{height:4,background:C.border,borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:pct+"%",background:C.gold,borderRadius:2}}/>
                  </div>
                  <div style={{fontSize:10,color:C.muted,marginTop:3}}>{pct}% usado</div>
                </div>
              );
            })
          }
        </div>

        {/* Modal entrada material o nueva serie precinta */}
        {formMat&&formMat.tipo==="entrada"&&(
          <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
            <div style={{...S.card,width:"100%",maxWidth:360}}>
              <div style={{fontSize:15,fontWeight:700,color:C.gold,marginBottom:12}}>Entrada - {formMat.nombre}</div>
              <label style={S.label}>Referencia / Lote</label>
              <input type="text" style={S.input} placeholder="ej. LB-2025-001" value={formMat.ref||""}
                onChange={e=>setFormMat(p=>({...p,ref:e.target.value}))}/>
              <label style={S.label}>Cantidad</label>
              <input type="number" style={S.input} placeholder="0" value={formMat.cantidad||""}
                onChange={e=>setFormMat(p=>({...p,cantidad:e.target.value}))}/>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <Btn variant="ghost" onClick={()=>setFormMat(null)} full>Cancelar</Btn>
                <Btn variant="gold" onClick={()=>{
                  const cant = parseFloat(formMat.cantidad||0);
                  if(!cant) return;
                  setMateriales(prev=>({...prev,
                    [formMat.categoria]: prev[formMat.categoria].map(item=>
                      item.id===formMat.id ? {
                        ...item,
                        stock: item.stock + cant,
                        lotes: formMat.ref ? [...item.lotes, {ref:formMat.ref, cantidad:cant, fecha:hoy()}] : item.lotes
                      } : item
                    )
                  }));
                  setFormMat(null);
                }} full>Confirmar</Btn>
              </div>
            </div>
          </div>
        )}

        {/* Modal nueva serie de precintas */}
        {formMat&&formMat.tipo==="nueva_serie"&&(
          <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
            <div style={{...S.card,width:"100%",maxWidth:360}}>
              <div style={{fontSize:15,fontWeight:700,color:C.gold,marginBottom:12}}>Nueva serie de precintas</div>
              <label style={S.label}>Nombre de serie</label>
              <input type="text" style={S.input} placeholder="ej. AS" value={formMat.serie||""}
                onChange={e=>setFormMat(p=>({...p,serie:e.target.value}))}/>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1}}>
                  <label style={S.label}>Numero inicio</label>
                  <input type="number" style={S.input} placeholder="ej. 900001" value={formMat.inicio||""}
                    onChange={e=>setFormMat(p=>({...p,inicio:e.target.value}))}/>
                </div>
                <div style={{flex:1}}>
                  <label style={S.label}>Numero fin</label>
                  <input type="number" style={S.input} placeholder="ej. 910000" value={formMat.fin||""}
                    onChange={e=>setFormMat(p=>({...p,fin:e.target.value}))}/>
                </div>
              </div>
              {formMat.inicio&&formMat.fin&&<div style={{fontSize:12,color:C.accent,marginBottom:8}}>
                Total: {fmt(parseFloat(formMat.fin)-parseFloat(formMat.inicio)+1)} precintas
              </div>}
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <Btn variant="ghost" onClick={()=>setFormMat(null)} full>Cancelar</Btn>
                <Btn variant="gold" onClick={()=>{
                  const inicio = parseFloat(formMat.inicio||0);
                  const fin    = parseFloat(formMat.fin||0);
                  if(!formMat.serie||!inicio||!fin||fin<=inicio) return;
                  setMateriales(prev=>({...prev,
                    precintas:[...prev.precintas,{
                      id:Date.now(), serie:formMat.serie,
                      inicio, fin, total:fin-inicio+1, usadas:0, fecha:hoy()
                    }]
                  }));
                  setFormMat(null);
                }} full>Guardar</Btn>
              </div>
            </div>
          </div>
        )}

        <TabBar tab={tab} setTab={setTab}/>
      </div>
    );
  }

  return null;
}
