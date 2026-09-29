// Funcion serverless (Vercel) que consulta a Claude como enologo.
// La API key vive SOLO aqui, en el servidor (variable de entorno ANTHROPIC_API_KEY),
// nunca se envia al navegador ni queda en el codigo publicado.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo no permitido" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Falta configurar ANTHROPIC_API_KEY en Vercel" });
  }

  try {
    const { contexto, pregunta, historial, fase, modo } = req.body || {};
    if (!contexto) return res.status(400).json({ error: "Falta el contexto del deposito" });

    // MODO INFORME: balance de un lote terminado, o de la campaña entera
    if (modo === "informe" || modo === "informe_campana") {
      const esCampana = modo === "informe_campana";
      const prompt = `Eres un enologo experto asesorando a Bodegas Araico (Rioja Alavesa).
${esCampana
  ? "Escribe el BALANCE DE LA CAMPAÑA a partir de los datos de todos los depositos que han elaborado este año."
  : "Escribe el BALANCE FINAL de este lote, ahora que su elaboracion ha terminado."}

DATOS:
${contexto}

${esCampana
  ? `Compara los depositos entre si: cuales fueron mejor y cuales peor, y por que. Fijate en los
tiempos de fermentacion, las temperaturas, las paradas, las desviaciones respecto a la curva
prevista, el cumplimiento del protocolo de adiciones y como quedaron los analisis.`
  : `Repasa como fue la fermentacion de principio a fin: ritmo, temperaturas, desviaciones respecto
a la curva prevista, protocolo de adiciones (que se echo, cuando, y que se quedo sin echar) y como
quedaron los analisis.`}

Responde SOLO con un JSON valido, sin texto alrededor ni markdown:
{
  "resumen": "3-5 frases con el balance general, en español",
  "bien": ["lo que salio bien, frases cortas"],
  "incidencias": [{"titulo": "menos de 60 caracteres", "detalle": "que paso y que efecto tuvo, max 2 frases"}],
  "mejoras": [{"titulo": "menos de 60 caracteres", "detalle": "que hacer distinto la proxima vez y por que, max 2 frases"}]
}

Reglas:
- Basate SOLO en los datos aportados. No inventes lecturas, analisis ni valores.
- Si falta informacion para juzgar algo, dilo en la mejora correspondiente ("registrar X para poder valorarlo").
- Las mejoras deben ser accionables y concretas para esta bodega, no consejos genericos de manual.
- Ordena incidencias y mejoras de mas a menos importante. Como mucho 6 de cada.
- Se prudente y honesto: si algo salio bien, dilo; si algo salio mal, senalalo sin dramatizar.`;

      const ri = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 3000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!ri.ok) {
        const txt = await ri.text();
        return res.status(502).json({ error: "Error de la API: " + txt.slice(0, 200) });
      }
      const di = await ri.json();
      const ti = (di.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
      const li = ti.replace(/```json|```/g, "").trim();
      let pi;
      try { pi = JSON.parse(li); }
      catch { return res.status(502).json({ error: "Respuesta no interpretable", crudo: li.slice(0, 300) }); }
      return res.status(200).json(pi);
    }

    // MODO CHAT: el usuario pregunta algo concreto sobre este deposito
    if (pregunta) {
      const sistema = `Eres un enologo experto asesorando a Bodegas Araico (Rioja Alavesa).
Respondes preguntas sobre un deposito concreto, con sus datos reales delante.

DATOS ACTUALES DEL DEPOSITO:
${contexto}

Instrucciones:
- Responde en español, de forma directa y concreta, sin rodeos.
- Basate SOLO en los datos anteriores. Si falta un dato para responder bien, dilo y pide ese dato.
- Nunca inventes lecturas, analisis ni valores que no esten en el contexto.
- Cuando propongas dosis o correcciones, da cifras concretas calculadas sobre los litros o kg reales del deposito.
- Se prudente: la decision final es del bodeguero. Señala riesgos si los ves.
- Habla del momento ACTUAL. Si un dato es de hace dias, dilo y no propongas acciones cuyo momento ya paso.
- Respuestas breves (2-5 frases salvo que pida detalle). Sin markdown ni listas largas.`;

      const mensajes = [];
      (historial || []).slice(-8).forEach(m => {
        if (m && m.rol && m.texto) mensajes.push({ role: m.rol === "user" ? "user" : "assistant", content: m.texto });
      });
      mensajes.push({ role: "user", content: pregunta });

      const rc = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          system: sistema,
          messages: mensajes,
        }),
      });

      if (!rc.ok) {
        const txt = await rc.text();
        return res.status(502).json({ error: "Error de la API: " + txt.slice(0, 200) });
      }
      const dc = await rc.json();
      const respuesta = (dc.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
      return res.status(200).json({ respuesta });
    }

    const prompt = `Eres un enologo experto asesorando a una bodega de Rioja Alavesa (Bodegas Araico).
Analiza los datos de seguimiento de este deposito y detecta SOLO incidencias reales que merezcan atencion.

DATOS DEL DEPOSITO:
${contexto}

Busca especificamente:
${fase === "malolactica" ? `- Malolactica parada: el malico no baja entre analisis consecutivos
- Acidez volatil que sube (por encima de 0,6 g/L es señal de alarma; el ritmo de subida importa tanto como el valor)
- pH que sube demasiado al degradarse el malico (por encima de 3,8 en tinto conviene avisar)
- Malolactica muy larga sin proteccion de SO2, con riesgo microbiologico
- Malico ya por debajo de 0,2 g/L: la malolactica esta hecha y toca sulfitar y cerrarla
- Falta de analisis reciente para poder seguirla
NO comentes densidad ni temperatura de fermentacion: esa fase ya termino.` : `- Fermentacion parada o muy ralentizada (densidad que no baja entre lecturas consecutivas)
- Temperatura fuera de rango para el tipo de vino (tinto 24-30°C, blanco 14-18°C)
- Desviacion importante respecto a la curva teorica esperada
- Riesgo de parada por falta de nutriente segun el momento de la fermentacion
- Valores de analisis preocupantes (acidez volatil alta, pH alto, malico sin degradar cuando toca)
- Falta de algun producto del protocolo en el momento en que tocaria`}

MUY IMPORTANTE — avisos utiles HOY:
- Juzga la situacion en la fecha de hoy que aparece en el contexto, no en la fecha de las lecturas.
- No avises de algo cuyo momento de actuar ya paso y no tiene arreglo ("la temperatura subio hace cinco dias"),
  salvo que siga teniendo consecuencias sobre las que se pueda hacer algo ahora. En ese caso, di que hacer AHORA.
- Si los datos son viejos, el aviso util es justamente ese: que faltan lecturas o analisis recientes.
- Mejor tres avisos accionables que ocho descriptivos. Si no hay nada que hacer, devuelve la lista vacia.

Responde SOLO con un JSON valido, sin texto adicional ni markdown:
{
  "avisos": [
    {
      "nivel": "alto" | "medio" | "info",
      "titulo": "resumen en menos de 60 caracteres",
      "detalle": "explicacion breve (max 2 frases) de que ocurre y que conviene hacer"
    }
  ]
}

Si todo va correcto, devuelve {"avisos": []}. No inventes datos que no esten en el contexto.
Se prudente: señala lo que ves y sugiere, la decision final es del bodeguero.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(502).json({ error: "Error de la API: " + txt.slice(0, 200) });
    }

    const data = await r.json();
    const texto = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    const limpio = texto.replace(/```json|```/g, "").trim();

    let parsed;
    try { parsed = JSON.parse(limpio); }
    catch { return res.status(502).json({ error: "Respuesta no interpretable", crudo: limpio.slice(0, 300) }); }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
}
