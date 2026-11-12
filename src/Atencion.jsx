import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const vacio = {
  sintomas: '', antecedentes: '', temperatura_c: '', frecuencia_cardiaca: '',
  frecuencia_respiratoria: '', peso_kg: '', diagnostico: '', tratamiento: '',
  indicaciones: '', vigente_hasta: '',
}
const itemVacio = { medicamento: '', dosis: '', frecuencia: '', duracion: '' }
const num = v => (v === '' || v === null ? null : Number(v))
const hoy = () => new Date().toLocaleDateString('en-CA')

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
    if (error) setError('No se pudieron cargar las citas.')
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

    const sintomas = form.sintomas.trim()
    const diagnostico = form.diagnostico.trim()
    const tratamiento = form.tratamiento.trim()

    if (!sintomas && !diagnostico && !tratamiento) {
      return setError('No se puede guardar una atención vacía. Llena al menos uno de estos campos: síntomas, diagnóstico o tratamiento / servicio realizado.')
    }

    const incompleta = items.some(it => {
      const llenos = [it.medicamento, it.dosis, it.frecuencia, it.duracion].filter(v => v.trim() !== '').length
      return llenos > 0 && llenos < 4
    })
    if (incompleta) {
      return setError('Completa todos los datos de cada medicamento: nombre, dosis, frecuencia y duración.')
    }

    const meds = items.filter(it => it.medicamento.trim() !== '')
    if (meds.length > 0 && (!form.indicaciones.trim() || !form.vigente_hasta)) {
      return setError('Completa las indicaciones y la fecha de vigencia de la receta.')
    }

    setGuardando(true)
    const { data: at, error: e1 } = await supabase.from('atenciones').insert({
      cita_id: sel.id,
      mascota_id: sel.mascota_id,
      veterinario_id: sel.veterinario_id,
      sintomas: sintomas || null,
      antecedentes: form.antecedentes.trim() || null,
      temperatura_c: num(form.temperatura_c),
      frecuencia_cardiaca: num(form.frecuencia_cardiaca),
      frecuencia_respiratoria: num(form.frecuencia_respiratoria),
      peso_kg: num(form.peso_kg),
      diagnostico: diagnostico || null,
      tratamiento: tratamiento || null,
    }).select().single()

    if (e1) {
      setGuardando(false)
      if (e1.code === '23505') {
        await supabase.from('citas').update({ estado: 'atendida' }).eq('id', sel.id)
        setSel(null)
        cargar()
        return setError('Esta cita ya tenía una atención guardada. Revísala en el Historial.')
      }
      if (e1.code === '23514') {
        return setError('La atención no puede estar vacía. Llena al menos síntomas, diagnóstico o tratamiento / servicio realizado.')
      }
      console.error(e1)
      return setError('No se pudo guardar la atención. Inténtalo otra vez.')
    }

    if (meds.length > 0) {
      const { data: rec, error: e2 } = await supabase.from('recetas').insert({
        atencion_id: at.id,
        indicaciones: form.indicaciones.trim(),
        vigente_hasta: form.vigente_hasta,
      }).select().single()
      if (e2) { setGuardando(false); return setError('La atención se guardó, pero falló la receta.') }

      const { error: e3 } = await supabase.from('receta_items').insert(
        meds.map(m => ({
          receta_id: rec.id,
          medicamento: m.medicamento.trim(),
          dosis: m.dosis.trim(),
          frecuencia: m.frecuencia.trim(),
          duracion: m.duracion.trim(),
        }))
      )
      if (e3) { setGuardando(false); return setError('La atención se guardó, pero fallaron los medicamentos.') }
    }

    if (form.peso_kg !== '' && form.peso_kg !== null) {
      await supabase.from('mascotas').update({ peso_kg: num(form.peso_kg) }).eq('id', sel.mascota_id)
    }
    await supabase.from('citas').update({ estado: 'atendida' }).eq('id', sel.id)

    setGuardando(false)
    setOk(`Atención guardada para ${sel.mascotas?.nombre}.`)
    setSel(null)
    cargar()
  }

  if (sel) {
    const hayReceta = items.some(it => it.medicamento.trim() !== '')
    return (
      <form className="tarjeta" onSubmit={guardar}>
        <h3>Atención: {sel.mascotas?.nombre} <small>(dueño: {sel.mascotas?.clientes?.nombre})</small></h3>
        {sel.motivo && <p>Motivo de la cita: {sel.motivo}</p>}

        <div className="alerta" style={{ marginTop: 0 }}>
          <span className="icono">📝</span>
          <div>
            <b>Llena al menos uno</b>
            Síntomas, diagnóstico o tratamiento / servicio realizado. Si solo vino por un baño o peluquería, escribe el servicio en «Tratamiento / servicio realizado».
          </div>
        </div>

        <textarea rows="2" placeholder="Síntomas" value={form.sintomas} onChange={e => setForm({ ...form, sintomas: e.target.value })} />
        <textarea rows="2" placeholder="Antecedentes (opcional)" value={form.antecedentes} onChange={e => setForm({ ...form, antecedentes: e.target.value })} />

        <div className="fila">
          <input type="number" step="0.1" min="30" max="45" placeholder="Temperatura °C" value={form.temperatura_c} onChange={e => setForm({ ...form, temperatura_c: e.target.value })} />
          <input type="number" min="20" max="400" placeholder="Frec. cardiaca" value={form.frecuencia_cardiaca} onChange={e => setForm({ ...form, frecuencia_cardiaca: e.target.value })} />
          <input type="number" min="5" max="200" placeholder="Frec. respiratoria" value={form.frecuencia_respiratoria} onChange={e => setForm({ ...form, frecuencia_respiratoria: e.target.value })} />
          <input type="number" step="0.01" min="0.01" max="200" placeholder="Peso kg" value={form.peso_kg} onChange={e => setForm({ ...form, peso_kg: e.target.value })} />
        </div>

        <textarea rows="2" placeholder="Diagnóstico" value={form.diagnostico} onChange={e => setForm({ ...form, diagnostico: e.target.value })} />
        <textarea rows="2" placeholder="Tratamiento / servicio realizado (ej. baño)" value={form.tratamiento} onChange={e => setForm({ ...form, tratamiento: e.target.value })} />

        <h4>Receta (opcional)</h4>
        <p style={{ fontSize: 14, color: '#64748b', marginTop: 0 }}>Si agregas un medicamento, completa todos sus datos.</p>
        {items.map((it, i) => (
          <div className="item" key={i}>
            <div className="fila">
              <input placeholder="Medicamento" value={it.medicamento} onChange={e => cambiarItem(i, 'medicamento', e.target.value)} />
              <input required={it.medicamento.trim() !== ''} placeholder="Dosis (ej. 1 tableta)" value={it.dosis} onChange={e => cambiarItem(i, 'dosis', e.target.value)} />
              <input required={it.medicamento.trim() !== ''} placeholder="Frecuencia (ej. cada 8 h)" value={it.frecuencia} onChange={e => cambiarItem(i, 'frecuencia', e.target.value)} />
              <input required={it.medicamento.trim() !== ''} placeholder="Duración (ej. 5 días)" value={it.duracion} onChange={e => cambiarItem(i, 'duracion', e.target.value)} />
            </div>
          </div>
        ))}
        <button type="button" className="sec" onClick={() => setItems([...items, { ...itemVacio }])}>+ Otro medicamento</button>

        <div className="fila" style={{ marginTop: 10 }}>
          <input required={hayReceta} placeholder="Indicaciones generales" value={form.indicaciones} onChange={e => setForm({ ...form, indicaciones: e.target.value })} />
          <label>Vigente hasta: <input required={hayReceta} type="date" min={hoy()} value={form.vigente_hasta} onChange={e => setForm({ ...form, vigente_hasta: e.target.value })} /></label>
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
