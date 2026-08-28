#!/usr/bin/env node
/**
 * PASO 2 — Redaccion en espanol de los "5 tips" con la API de Claude.
 * Toma los articulos en estado "pendiente" y produce:
 * titulo en espanol, sintesis, 5 tips accionables, aplicacion docente,
 * nivel de evidencia y la frase corta para la infografia.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pedirJSON, hayClave } from './lib/claude.mjs';
import { DIR_ARTICULOS, leerJSON, escribirJSON, log } from './lib/util.mjs';

const SISTEMA = `Eres editor cientifico de MEDICABILITY, un sitio en espanol dirigido a docentes de medicina y clinicos que ensenan razonamiento clinico en Latinoamerica.

Tu tarea: convertir el resumen de un articulo cientifico en material de difusion breve, riguroso y util.

Reglas irrompibles:
1. Escribe en espanol neutro latinoamericano, en segunda persona plural implicita (registro profesional, sin tuteo).
2. NUNCA inventes datos, cifras, poblaciones ni conclusiones que no esten en el resumen entregado. Si el resumen no da una cifra, no la des.
3. Distingue lo que el estudio demuestra de lo que sugiere. Usa verbos calibrados ("se asocia", "sugiere", "demuestra") segun el diseno del estudio.
4. Cada tip debe ser accionable para un docente clinico el proximo lunes: algo que pueda hacer en la ronda, el aula o la evaluacion.
5. Sin adjetivos publicitarios ("revolucionario", "impactante"), sin emojis, sin exclamaciones.
6. Evita jerga innecesaria; cuando uses un termino tecnico (p. ej. "guion de enfermedad"), acompanalo de su equivalente en ingles entre parentesis la primera vez.

Responde UNICAMENTE con un objeto JSON valido, sin texto adicional, con este esquema exacto:
{
  "tituloEs": "titulo en espanol, claro, maximo 110 caracteres, sin punto final",
  "sintesis": "2 a 3 oraciones (maximo 60 palabras) que expliquen que se estudio y que se encontro",
  "disenoEstudio": "una frase corta: diseno y poblacion, p. ej. 'Revision sistematica de 24 estudios en residentes'",
  "nivelEvidencia": "alto | moderado | bajo | exploratorio",
  "tips": [
    {"titulo": "3 a 6 palabras", "texto": "1 a 2 oraciones accionables, maximo 40 palabras"}
  ],
  "aplicacionDocente": "un parrafo de maximo 55 palabras: como llevar esto a la docencia clinica manana",
  "fraseInfografia": "frase de gancho para la infografia, maximo 90 caracteres, sin punto final",
  "etiquetas": ["3 a 5 etiquetas tematicas en espanol, en minuscula"],
  "advertencia": "limitacion metodologica principal en una oracion, o null si el resumen no permite juzgarla"
}
El arreglo "tips" debe tener EXACTAMENTE 5 elementos.`;

const archivos = fs.existsSync(DIR_ARTICULOS)
  ? fs.readdirSync(DIR_ARTICULOS).filter((f) => f.endsWith('.json'))
  : [];

const pendientes = archivos
  .map((f) => ({ archivo: path.join(DIR_ARTICULOS, f), datos: leerJSON(path.join(DIR_ARTICULOS, f)) }))
  .filter(({ datos }) => datos && datos.estado === 'pendiente');

log.titulo(`Redaccion de tips — ${pendientes.length} articulos pendientes`);

if (!pendientes.length) process.exit(0);

if (!hayClave()) {
  log.aviso('Sin ANTHROPIC_API_KEY: se usara un resumen extractivo de respaldo.');
}

for (const { archivo, datos } of pendientes) {
  const mensaje = [
    `Titulo original: ${datos.titulo}`,
    `Revista: ${datos.revista} (${datos.fechaPublicacion})`,
    `Tipo de publicacion: ${(datos.tiposPublicacion || []).join(', ') || 'no especificado'}`,
    `Terminos MeSH: ${(datos.mesh || []).join('; ') || 'no disponibles'}`,
    '',
    'Resumen original:',
    datos.resumenOriginal,
  ].join('\n');

  try {
    const salida = hayClave()
      ? await pedirJSON({ sistema: SISTEMA, mensaje })
      : respaldoExtractivo(datos);

    const tips = (salida.tips || []).slice(0, 5);
    if (tips.length !== 5) throw new Error(`se esperaban 5 tips, llegaron ${tips.length}`);

    escribirJSON(archivo, {
      ...datos,
      estado: 'resumido',
      tituloEs: salida.tituloEs || datos.titulo,
      sintesis: salida.sintesis || '',
      disenoEstudio: salida.disenoEstudio || '',
      nivelEvidencia: salida.nivelEvidencia || 'exploratorio',
      tips,
      aplicacionDocente: salida.aplicacionDocente || '',
      fraseInfografia: salida.fraseInfografia || (salida.tituloEs || datos.titulo).slice(0, 90),
      etiquetas: salida.etiquetas || datos.temas || [],
      advertencia: salida.advertencia ?? null,
      generadoPor: hayClave() ? (process.env.MODELO_IA || 'claude-sonnet-4-5') : 'respaldo-extractivo',
    });
    log.ok(salida.tituloEs || datos.titulo);
  } catch (e) {
    log.error(`${datos.pmid}: ${e.message}`);
  }
}

/** Respaldo sin IA: reparte las oraciones del resumen en 5 tips. */
function respaldoExtractivo(datos) {
  const oraciones = String(datos.resumenOriginal || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length > 6);
  const paso = Math.max(1, Math.floor(oraciones.length / 5));
  const tips = Array.from({ length: 5 }, (_, i) => ({
    titulo: `Punto clave ${i + 1}`,
    texto: oraciones[i * paso] || oraciones[oraciones.length - 1] || 'Consulte el resumen original.',
  }));
  return {
    tituloEs: datos.titulo,
    sintesis: oraciones.slice(0, 2).join(' '),
    disenoEstudio: (datos.tiposPublicacion || []).join(', '),
    nivelEvidencia: 'exploratorio',
    tips,
    aplicacionDocente: 'Resumen automatico sin revision editorial. Revise el articulo original antes de aplicarlo en docencia.',
    fraseInfografia: datos.titulo.slice(0, 90),
    etiquetas: datos.temas || [],
    advertencia: 'Resumen generado sin revision editorial.',
  };
}
