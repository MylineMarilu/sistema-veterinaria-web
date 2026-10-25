import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const vacio = {
  sintomas: '', antecedentes: '', temperatura_c: '', frecuencia_cardiaca: '',
  frecuencia_respiratoria: '', peso_kg: '', diagnostico: '', tratamiento: '',
  indicaciones: '', vigente_hasta: '',
}
const itemVacio = { medicamento: '', dosis: '', frecuencia: '', duracion: '' }
const num = v => (v === '' ? null : Number(v))

export default function Atencion({ userId, rol }) {
  const [citas, setCitas] = useState([])
  const [sel, setSel] = useState(null)
  const [form, setForm] = useState(vacio)
  const [items, setItems] = useState([{ ...itemVacio }])
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    let q = supabase
      .from('citas')
      .select('*, mascotas(id, nombre, peso_kg, clientes(nombre))')
      .in('estado', ['programada', 'en_atencion'])
      .order('fecha_hora', { ascending: true })
    if (rol === 'veterinario') q = q.eq('veterinario_id', userId)
    const { data, error } = await q
    if (error) setError(error.message)
    else setCitas(data)
  }

  useEffect(() => { cargar() }, [])

  async function atender(c) {
    setError(''); setOk('')
    if (c.estado === 'programada') {
      await supabase.from('citas').update({ estado: 'en_atencion' }).eq('id', c.id)
      await supabase.from('seguimiento').insert({
        mascota_id: c.mascota_id, estado: 'en_consulta', actualizado_por: userId,
      })
    }
    setForm({ ...vacio, peso_kg: c.mascotas?.peso_kg ?? '' })
    setItems([{ ...itemVacio }])
    setSel(c)
  }

  function cambiarItem(i, campo, valor) {
    setItems(items.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)))
  }

  async function guardar(e) {
    e.preventDefault()
    if (guardando) return
    setError('')

    const meds = items.filter(it => it.medicamento.trim() !== '')
    if (meds.some(it => !it.dosis.trim() || !it.frecuencia.trim())) {
      return setError('Cada medicamento necesita dosis y frecuencia.')
    }

    setGuardando(true)
    const { data: at, error: e1 } = await supabase.from('atenciones').insert({
      cita_id: sel.id,
      mascota_id: sel.mascota_id,
      veterinario_id: sel.veterinario_id,
      sintomas: form.sintomas || null,
      antecedentes: form.antecedentes || null,
      temperatura_c: num(form.temperatura_c),
      frecuencia_cardiaca: num(form.frecuencia_cardiaca),
      frecuencia_respiratoria: num(form.frecuencia_respiratoria),
      peso_kg: num(form.peso_kg),
      diagnostico: form.diagnostico || null,
      tratamiento: form.tratamiento || null,
    }).select().single()

    if (e1) {
      setGuardando(false)
      if (e1.code === '23505') {
        await supabase.from('citas').update({ estado: 'atendida' }).eq('id', sel.id)
        setSel(null)
        cargar()
        return setError('Esta cita ya tenía una atención guardada. Revísala en el Historial.')
      }
      return setError(e1.message)
    }

    if (meds.length > 0) {
      const { data: rec, error: e2 } = await supabase.from('recetas').insert({
        atencion_id: at.id,
        indicaciones: form.indicaciones || null,
        vigente_hasta: form.vigente_hasta || null,
      }).select().single()
      if (e2) { setGuardando(false); return setError('La atención se guardó, pero falló la receta: ' + e2.message) }

      const { error: e3 } = await supabase.from('receta_items').insert(
        meds.map(m => ({
          receta_id: rec.id,
          medicamento: m.medicamento,
          dosis: m.dosis,
          frecuencia: m.frecuencia,
          duracion: m.duracion || null,
        }))
      )
      if (e3) { setGuardando(false); return setError('La atención se guardó, pero fallaron los medicamentos: ' + e3.message) }
    }

    if (form.peso_kg !== '') {
      await supabase.from('mascotas').update({ peso_kg: num(form.peso_kg) }).eq('id', sel.mascota_id)
    }
    await supabase.from('citas').update({ estado: 'atendida' }).eq('id', sel.id)

    setGuardando(false)
    setOk(`Atención guardada para ${sel.mascotas?.nombre}.`)
    setSel(null)
    cargar()
  }

  if (sel) {
    return (
      <form className="tarjeta" onSubmit={guardar}>
        <h3>Atención: {sel.mascotas?.nombre} <small>(dueño: {sel.mascotas?.clientes?.nombre})</small></h3>
        {sel.motivo && <p>Motivo de la cita: {sel.motivo}</p>}

        <textarea rows="2" placeholder="Síntomas" value={form.sintomas} onChange={e => setForm({ ...form, sintomas: e.target.value })} />
        <textarea rows="2" placeholder="Antecedentes" value={form.antecedentes} onChange={e => setForm({ ...form, antecedentes: e.target.value })} />

        <div className="fila">
          <input type="number" step="0.1" placeholder="Temperatura °C" value={form.temperatura_c} onChange={e => setForm({ ...form, temperatura_c: e.target.value })} />
          <input type="number" placeholder="Frec. cardiaca" value={form.frecuencia_cardiaca} onChange={e => setForm({ ...form, frecuencia_cardiaca: e.target.value })} />
          <input type="number" placeholder="Frec. respiratoria" value={form.frecuencia_respiratoria} onChange={e => setForm({ ...form, frecuencia_respiratoria: e.target.value })} />
          <input type="number" step="0.01" placeholder="Peso kg" value={form.peso_kg} onChange={e => setForm({ ...form, peso_kg: e.target.value })} />
        </div>

        <textarea rows="2" placeholder="Diagnóstico" value={form.diagnostico} onChange={e => setForm({ ...form, diagnostico: e.target.value })} />
        <textarea rows="2" placeholder="Tratamiento" value={form.tratamiento} onChange={e => setForm({ ...form, tratamiento: e.target.value })} />

        <h4>Receta (opcional)</h4>
        {items.map((it, i) => (
          <div className="item" key={i}>
            <div className="fila">
              <input placeholder="Medicamento" value={it.medicamento} onChange={e => cambiarItem(i, 'medicamento', e.target.value)} />
              <input placeholder="Dosis (ej. 1 tableta)" value={it.dosis} onChange={e => cambiarItem(i, 'dosis', e.target.value)} />
              <input placeholder="Frecuencia (ej. cada 8 h)" value={it.frecuencia} onChange={e => cambiarItem(i, 'frecuencia', e.target.value)} />
              <input placeholder="Duración (ej. 5 días)" value={it.duracion} onChange={e => cambiarItem(i, 'duracion', e.target.value)} />
            </div>
          </div>
        ))}
        <button type="button" className="sec" onClick={() => setItems([...items, { ...itemVacio }])}>+ Otro medicamento</button>

        <div className="fila" style={{ marginTop: 10 }}>
          <input placeholder="Indicaciones generales" value={form.indicaciones} onChange={e => setForm({ ...form, indicaciones: e.target.value })} />
          <label>Vigente hasta: <input type="date" value={form.vigente_hasta} onChange={e => setForm({ ...form, vigente_hasta: e.target.value })} /></label>
        </div>

        {error && <div className="error">{error}</div>}
        <div className="acciones">
          <button type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar atención'}</button>
          <button type="button" className="sec" disabled={guardando} onClick={() => { setSel(null); cargar() }}>Volver sin guardar</button>
        </div>
      </form>
    )
  }

  return (
    <div>
      {ok && <div className="ok">{ok}</div>}
      {error && <div className="error">{error}</div>}
      <h3>Citas pendientes de atención</h3>
      {citas.map(c => (
        <div className="tarjeta" key={c.id}>
          <strong>{new Date(c.fecha_hora).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}</strong>
          {' '}<span className={'estado ' + c.estado}>{c.estado.replace('_', ' ')}</span>
          <div>{c.mascotas?.nombre} · dueño: {c.mascotas?.clientes?.nombre}{c.motivo ? ` · ${c.motivo}` : ''}</div>
          <div className="acciones">
            <button onClick={() => atender(c)}>{c.estado === 'en_atencion' ? 'Continuar atención' : 'Atender'}</button>
          </div>
        </div>
      ))}
      {citas.length === 0 && <p>No hay citas pendientes.</p>}
    </div>
  )
}
