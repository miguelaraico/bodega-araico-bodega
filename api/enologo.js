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
    const { contexto, pregunta, historial } = req.body || {};
    if (!contexto) return res.status(400).json({ error: "Falta el contexto del deposito" });

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
- Fermentacion parada o muy ralentizada (densidad que no baja entre lecturas consecutivas)
- Temperatura fuera de rango para el tipo de vino (tinto 24-30°C, blanco 14-18°C)
- Desviacion importante respecto a la curva teorica esperada
- Riesgo de parada por falta de nutriente segun el momento de la fermentacion
- Valores de analisis preocupantes (acidez volatil alta, pH alto, malico sin degradar cuando toca)
- Falta de algun producto del protocolo en el momento en que tocaria

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
