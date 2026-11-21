// Capa de datos FootFisio <-> NocoDB (API v3), usando las tablas reales:
// Usuarios, Pacientes, Citas, Pagos, Historial clínico, Secuencias.
// Todas las correspondencias entre campos de la app y columnas de NocoDB están en MAPAS (abajo).
import { NOCODB_URL, NOCODB_BASE_ID, NOCODB_API_TOKEN, NOCODB_TABLAS } from '../nocodb.config'

export type Modulo = 'users' | 'patients' | 'appointments' | 'payments' | 'history' | 'sequences'
type Item = { id: number; [k: string]: any }
type Fields = Record<string, any>

// El token es secreto y vive en Cloudflare Pages Functions; en cliente basta el Base ID.
export const NOCODB_CONFIGURADO = Boolean(NOCODB_BASE_ID)

const TABLAS: Record<Modulo, string> = {
  users: 'Usuarios', patients: 'Pacientes', appointments: 'Citas',
  payments: 'Pagos', history: 'Historial clínico', sequences: 'Secuencias',
}
const COLORES = ['#d1fae5', '#dbeafe', '#ede9fe', '#fce7f3', '#fef3c7', '#e0f2fe', '#fce4d6', '#f0fdf4']

// ─── Utilidades ─────────────────────────────────────────────────────────────
const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^\s*dra?\.?\s+/i, '').trim().toLowerCase()
const iniciales = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
const color = (id: number) => COLORES[Math.abs(id) % COLORES.length]
const vacioANull = (v: any) => (v === '' || v === undefined ? null : v)
const hoyISO = () => new Date().toISOString().slice(0, 10)

function dmyAIso(d: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((d || '').trim())
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return /^\d{4}-\d{2}-\d{2}/.test(d || '') ? d.slice(0, 10) : hoyISO()
}
function isoADmy(iso: any): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}
function edad(dob: any): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dob || ''))
  if (!m) return 0
  const hoy = new Date()
  let e = hoy.getFullYear() - +m[1]
  if (hoy.getMonth() + 1 < +m[2] || (hoy.getMonth() + 1 === +m[2] && hoy.getDate() < +m[3])) e--
  return Math.max(e, 0)
}
function idVinculo(v: any): number | undefined {
  const o = Array.isArray(v) ? v[0] : v
  if (o == null) return undefined
  if (typeof o === 'number') return o
  const id = o.id ?? o.Id
  return id == null ? undefined : Number(id)
}
const segundosAMin = (v: any): number => {
  if (typeof v === 'number') return Math.round(v / 60)
  const m = /^(\d+):(\d{2})/.exec(String(v || ''))
  return m ? +m[1] * 60 + +m[2] : 0
}

// ─── Estado interno ─────────────────────────────────────────────────────────
let etiquetasDoctor: string[] = []
export function registrarEtiquetasDoctor(nombres: string[]) { etiquetasDoctor = nombres }
const etiquetaDoctor = (nombre: string) => etiquetasDoctor.find(e => norm(e) === norm(nombre)) || nombre

const idsTabla: Partial<Record<Modulo, string>> = Object.fromEntries(Object.entries(NOCODB_TABLAS).filter(([, v]) => v)) as Partial<Record<Modulo, string>>
const pacPorNombre = new Map<string, number>(); const pacNombre = new Map<number, string>()
const usrPorNombre = new Map<string, number>(); const usrNombre = new Map<number, string>()
const remoto: Record<Modulo, Map<number, { hash: string; fields: Fields }>> = {
  users: new Map(), patients: new Map(), appointments: new Map(),
  payments: new Map(), history: new Map(), sequences: new Map(),
}
const alias: Record<Modulo, Map<number, number>> = {
  users: new Map(), patients: new Map(), appointments: new Map(),
  payments: new Map(), history: new Map(), sequences: new Map(),
}

function reconstruirMapas(pacs: Item[], usrs: Item[]) {
  pacPorNombre.clear(); pacNombre.clear(); usrPorNombre.clear(); usrNombre.clear()
  for (const p of pacs) { pacPorNombre.set(norm(p.name), p.id); pacNombre.set(p.id, p.name) }
  for (const u of usrs) { usrPorNombre.set(norm(u.name), u.id); usrNombre.set(u.id, u.name) }
}

// ─── HTTP ───────────────────────────────────────────────────────────────────
async function request(url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { 'xc-token': NOCODB_API_TOKEN, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  const texto = await r.text()
  let body: any = {}
  try { body = texto ? JSON.parse(texto) : {} } catch { /* respuesta vacía */ }
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url.split('?')[0].replace(NOCODB_BASE_ID, 'BASE')}: ${body?.msg || body?.message || body?.error || texto.slice(0, 200)}`)
  return body
}
const urlTabla = (m: Modulo) =>
  `${NOCODB_URL}/api/v3/data/${NOCODB_BASE_ID}/${idsTabla[m] ?? encodeURIComponent(TABLAS[m])}/records`

async function resolverTablas() {
  try {
    const r = await request(`${NOCODB_URL}/api/v3/meta/bases/${NOCODB_BASE_ID}/tables`)
    const lista: any[] = r.list ?? r.tables ?? r.records ?? (Array.isArray(r) ? r : [])
    for (const m of Object.keys(TABLAS) as Modulo[]) {
      const t = lista.find(x => norm(x.title ?? x.name) === norm(TABLAS[m]))
      if (t?.id) idsTabla[m] = t.id
    }
  } catch (e) {
    console.warn('No se pudo leer el esquema (token sin permiso de lectura de tablas); se usarán los nombres de tabla.', e)
  }
}
async function listar(m: Modulo): Promise<any[]> {
  const todas: any[] = []
  let url: string | null = `${urlTabla(m)}?pageSize=100`
  for (let i = 0; url && i < 50; i++) {
    const r: any = await request(url)
    todas.push(...(r.records || []))
    url = r.next || null
  }
  return todas
}
async function crear(m: Modulo, fields: Fields): Promise<number> {
  const r = await request(urlTabla(m), { method: 'POST', body: JSON.stringify({ fields }) })
  const nuevo = Array.isArray(r?.records) ? r.records[0] : (r?.records ?? r)
  const id = nuevo?.id ?? nuevo?.Id ?? (Array.isArray(r) ? r[0]?.id : undefined)
  if (id == null) throw new Error(`No se obtuvo el Id al crear en ${TABLAS[m]}`)
  return Number(id)
}
const actualizar = (m: Modulo, id: number, fields: Fields) =>
  request(urlTabla(m), { method: 'PATCH', body: JSON.stringify({ id, fields }) })
const eliminar = (m: Modulo, id: number) =>
  request(`${urlTabla(m)}?records=${id}`, { method: 'DELETE' })

// ─── MAPAS: app -> columnas de NocoDB (aFila) y columnas -> app (deFila) ─────
function vinc(campo: string, id: number | undefined): Fields { return id ? { [campo]: [{ id }] } : {} }

const aFila: Record<Modulo, (i: Item, previo?: Fields) => Fields> = {
  users: u => ({ Nombre: u.name, Correo: vacioANull(u.email), 'Teléfono': vacioANull(u.phone), Rol: u.role, Estado: u.status }),
  patients: (p, previo) => {
    const t = String(p.name || '').trim().split(/\s+/)
    const n = t.length >= 4 ? 2 : 1
    const dobPrevio = previo?.['Fecha de nacimiento']
    const dob = dobPrevio && edad(dobPrevio) === p.age ? String(dobPrevio).slice(0, 10) : `${new Date().getFullYear() - (p.age || 0)}-01-01`
    return {
      Nombres: t.slice(0, n).join(' '), Apellidos: t.slice(n).join(' ') || null,
      'Teléfono': vacioANull(p.phone), Correo: vacioANull(p.email),
      'Fecha de nacimiento': dob, 'Condición': vacioANull(p.condition), Estado: p.status,
    }
  },
  appointments: a => {
    const min = parseInt(a.duration) || 50
    return {
      Motivo: a.treatment, 'Fecha y hora': `${a.date || hoyISO()}T${a.time || '09:00'}:00.000Z`,
      'Duración': min * 60, Estado: a.status,
      ...vinc('Paciente', pacPorNombre.get(norm(a.patient))),
      ...vinc('Especialista', usrPorNombre.get(norm(a.doctor))),
    }
  },
  payments: p => ({
    Concepto: p.concept, Monto: p.amount, Fecha: dmyAIso(p.date), 'Método de pago': p.method, Estado: p.status,
    ...vinc('Paciente', pacPorNombre.get(norm(p.patient))),
  }),
  history: h => ({
    'Diagnóstico': h.diagnosis, Observaciones: vacioANull(h.notes),
    Fecha: `${dmyAIso(h.date)}T00:00:00.000Z`, 'Plan y recomendaciones': vacioANull(h.treatment),
    ...vinc('Paciente', pacPorNombre.get(norm(h.patient))),
    ...vinc('Profesional', usrPorNombre.get(norm(h.doctor))),
  }),
  sequences: s => ({
    Secuencia: s.name, Tipo: s.category, Estado: s.status,
    'Descripción': `${s.sessions} sesiones · ${s.duration} · ${s.exercises} ejercicios`,
  }),
}

const deFila: Record<Modulo, (id: number, f: Fields) => Item> = {
  users: (id, f) => ({ id, name: f.Nombre ?? '', initials: iniciales(f.Nombre ?? ''), color: color(id), role: f.Rol ?? '', email: f.Correo ?? '', phone: f['Teléfono'] ?? '', status: f.Estado ?? 'Activo' }),
  patients: (id, f) => {
    const name = `${f.Nombres ?? ''} ${f.Apellidos ?? ''}`.trim()
    return { id, name, initials: iniciales(name), color: color(id), age: edad(f['Fecha de nacimiento']), phone: f['Teléfono'] ?? '', email: f.Correo ?? '', condition: f['Condición'] ?? '', doctor: '', status: f.Estado ?? 'Activo', lastVisit: '—' }
  },
  appointments: (id, f) => {
    const fh = String(f['Fecha y hora'] ?? '')
    const paciente = pacNombre.get(idVinculo(f.Paciente) ?? -1) ?? ''
    const esp = usrNombre.get(idVinculo(f.Especialista) ?? -1) ?? ''
    return { id, date: fh.slice(0, 10), time: fh.slice(11, 16) || '09:00', duration: `${segundosAMin(f['Duración']) || 50} min`, patient: paciente, initials: iniciales(paciente), color: color(idVinculo(f.Paciente) ?? id), treatment: f.Motivo ?? '', doctor: etiquetaDoctor(esp), status: f.Estado ?? 'Confirmada' }
  },
  payments: (id, f) => ({ id, patient: pacNombre.get(idVinculo(f.Paciente) ?? -1) ?? '', concept: f.Concepto ?? '', amount: Number(f.Monto) || 0, date: isoADmy(f.Fecha), status: f.Estado ?? 'Pendiente', method: f['Método de pago'] ?? '' }),
  history: (id, f) => ({ id, patient: pacNombre.get(idVinculo(f.Paciente) ?? -1) ?? '', date: isoADmy(f.Fecha), diagnosis: f['Diagnóstico'] ?? '', treatment: f['Plan y recomendaciones'] ?? '', doctor: etiquetaDoctor(usrNombre.get(idVinculo(f.Profesional) ?? -1) ?? ''), session: 1, notes: f.Observaciones ?? '' }),
  sequences: (id, f) => {
    const d = String(f['Descripción'] ?? '')
    return { id, name: f.Secuencia ?? '', category: f.Tipo ?? '', status: f.Estado ?? 'Activo', sessions: +(/(\d+)\s*sesiones/.exec(d)?.[1] ?? 8), duration: /·\s*([^·]+?)\s*·/.exec(d)?.[1] ?? '45 min', exercises: +(/(\d+)\s*ejercicios/.exec(d)?.[1] ?? 6) }
  },
}

// ─── Carga inicial ──────────────────────────────────────────────────────────
export async function cargarTodo(): Promise<Partial<Record<Modulo, Item[]>> & { maxId: number }> {
  if (!NOCODB_CONFIGURADO) return { maxId: 0 }
  await resolverTablas()
  const filas = {} as Record<Modulo, any[]>
  for (const m of Object.keys(TABLAS) as Modulo[]) {
    try { filas[m] = await listar(m) } catch (e: any) { throw new Error(`Tabla ${TABLAS[m]}: ${e.message}`) }
  }
  if ((Object.keys(filas) as Modulo[]).every(m => filas[m].length === 0)) return { maxId: 0 } // base nueva: se suben los datos de demostración

  const datos: Partial<Record<Modulo, Item[]>> = {}
  datos.users = filas.users.map(r => deFila.users(r.id, r.fields || {}))
  datos.patients = filas.patients.map(r => deFila.patients(r.id, r.fields || {}))
  reconstruirMapas(datos.patients, datos.users)
  for (const m of ['appointments', 'payments', 'history', 'sequences'] as Modulo[]) datos[m] = filas[m].map(r => deFila[m](r.id, r.fields || {}))

  if (filas.appointments.some(r => r.fields?.Paciente === undefined) && filas.appointments.length)
    console.warn('Citas: la API no devolvió el campo de vínculo "Paciente"; los nombres de paciente aparecerán vacíos.')

  // Campos derivados: sesión nº, última visita y especialista habitual
  const hist = datos.history!.slice().sort((a, b) => dmyAIso(a.date).localeCompare(dmyAIso(b.date)) || a.id - b.id)
  const contador = new Map<string, number>()
  for (const h of hist) { const k = norm(h.patient); contador.set(k, (contador.get(k) || 0) + 1); h.session = contador.get(k)! }
  for (const p of datos.patients!) {
    const k = norm(p.name)
    const ult = hist.filter(h => norm(h.patient) === k).pop()
    if (ult) p.lastVisit = ult.date
    const cita = datos.appointments!.filter(a => norm(a.patient) === k).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).pop()
    if (cita) p.doctor = cita.doctor
  }

  // Foto del estado remoto (para detectar cambios después)
  for (const m of Object.keys(TABLAS) as Modulo[]) {
    remoto[m].clear(); alias[m].clear()
    for (const it of datos[m]!) remoto[m].set(it.id, { hash: JSON.stringify(aFila[m](it)), fields: filas[m].find(r => r.id === it.id)?.fields || {} })
  }
  const maxId = Math.max(0, ...(Object.keys(TABLAS) as Modulo[]).flatMap(m => datos[m]!.map(i => i.id)))
  return { ...datos, maxId }
}

// ─── Sincronización (crear / actualizar / borrar) ───────────────────────────
let cola: Promise<unknown> = Promise.resolve()

export function sincronizar(modulo: Modulo, items: Item[]): Promise<Map<number, number>> {
  const tarea = cola.catch(() => undefined).then(async () => {
    const mapa = new Map<number, number>()
    const vistos = new Set<number>()
    const finales: Item[] = []
    for (const original of items) {
      const idActual = alias[modulo].get(original.id) ?? original.id
      const it = { ...original, id: idActual }
      const known = remoto[modulo].get(idActual)
      const fields = aFila[modulo](it, known?.fields)
      const hash = JSON.stringify(fields)
      try {
        if (!known) {
          const nuevoId = await crear(modulo, fields)
          remoto[modulo].set(nuevoId, { hash, fields })
          alias[modulo].set(original.id, nuevoId)
          mapa.set(original.id, nuevoId)
          vistos.add(nuevoId); finales.push({ ...it, id: nuevoId })
        } else {
          if (known.hash !== hash) { await actualizar(modulo, idActual, fields); remoto[modulo].set(idActual, { hash, fields: { ...known.fields, ...fields } }) }
          vistos.add(idActual); finales.push(it)
        }
      } catch (e: any) { throw new Error(`Tabla ${TABLAS[modulo]}: ${e.message}`) }
    }
    for (const id of [...remoto[modulo].keys()]) {
      if (!vistos.has(id)) {
        try { await eliminar(modulo, id) } catch (e: any) { throw new Error(`Tabla ${TABLAS[modulo]}: ${e.message}`) }
        remoto[modulo].delete(id)
      }
    }
    if (modulo === 'patients') { pacPorNombre.clear(); pacNombre.clear(); for (const p of finales) { pacPorNombre.set(norm(p.name), p.id); pacNombre.set(p.id, p.name) } }
    if (modulo === 'users') { usrPorNombre.clear(); usrNombre.clear(); for (const u of finales) { usrPorNombre.set(norm(u.name), u.id); usrNombre.set(u.id, u.name) } }
    return mapa
  })
  cola = tarea
  return tarea
}
