import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const hoy = () => new Date().toLocaleDateString('en-CA')
const vacio = { mascota_id: '', veterinario_id: '', fecha_hora: '', motivo: '' }

export default function Citas({ userId }) {
  const [citas, setCitas] = useState([])
  const [mascotas, setMascotas] = useState([])
  const [vets, setVets] = useState([])
  const [form, setForm] = useState(vacio)
  const [dia, setDia] = useState(hoy())
  const [error, setError] = useState('')

  async function cargar() {
    const { data, error } = await supabase
      .from('citas')
      .select('*, mascotas(nombre, clientes(nombre)), veterinario:perfiles!veterinario_id(nombre)')
      .order('fecha_hora', { ascending: true })
    if (error) setError(error.message)
    else setCitas(data)
  }

  useEffect(() => {
    cargar()
    supabase.from('mascotas').select('id, nombre, clientes(nombre)').order('nombre')
      .then(({ data }) => setMascotas(data || []))
    supabase.from('perfiles').select('id, nombre').eq('rol', 'veterinario').eq('activo', true)
      .then(({ data }) => setVets(data || []))
  }, [])

  async function agendar(e) {
    e.preventDefault()
    setError('')
    const fecha = new Date(form.fecha_hora).toISOString()

    const { data: choque } = await supabase
      .from('citas').select('id')
      .eq('veterinario_id', form.veterinario_id)
      .eq('fecha_hora', fecha)
      .neq('estado', 'cancelada')
    if (choque && choque.length > 0) {
      return setError('Ese veterinario ya tiene una cita a esa hora. Elige otra hora.')
    }

    const { error } = await supabase.from('citas').insert({
      mascota_id: form.mascota_id,
      veterinario_id: form.veterinario_id,
      fecha_hora: fecha,
      motivo: form.motivo || null,
      creado_por: userId,
    })
    if (error) return setError(error.message)
    setForm(vacio)
    cargar()
  }

  async function cancelar(id) {
    if (!confirm('¿Cancelar esta cita?')) return
    await supabase.from('citas').update({ estado: 'cancelada' }).eq('id', id)
    cargar()
  }

  const visibles = citas.filter(c =>
    !dia || new Date(c.fecha_hora).toLocaleDateString('en-CA') === dia
  )

  return (
    <div>
      <div className="tarjeta">
        <h3>Agendar cita</h3>
        <form onSubmit={agendar}>
          <div className="fila">
            <select required value={form.mascota_id} onChange={e => setForm({ ...form, mascota_id: e.target.value })}>
              <option value="">Mascota...</option>
              {mascotas.map(m => (
                <option key={m.id} value={m.id}>{m.nombre} ({m.clientes?.nombre})</option>
              ))}
            </select>
            <select required value={form.veterinario_id} onChange={e => setForm({ ...form, veterinario_id: e.target.value })}>
              <option value="">Veterinario...</option>
              {vets.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
            <input required type="datetime-local" value={form.fecha_hora} onChange={e => setForm({ ...form, fecha_hora: e.target.value })} />
            <input placeholder="Motivo" value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} />
          </div>
          <button type="submit">Agendar</button>
        </form>
        {mascotas.length === 0 && <p>Primero registra un cliente con una mascota.</p>}
        {error && <div className="error">{error}</div>}
      </div>

      <div className="tarjeta">
        <div className="fila" style={{ alignItems: 'center' }}>
          <label>Ver día: <input type="date" value={dia} onChange={e => setDia(e.target.value)} /></label>
          <div className="acciones">
            <button className="sec" onClick={() => setDia(hoy())}>Hoy</button>
            <button className="sec" onClick={() => setDia('')}>Ver todas</button>
          </div>
        </div>
      </div>

      {visibles.map(c => (
        <div className="tarjeta" key={c.id}>
          <strong>{new Date(c.fecha_hora).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}</strong>
          {' '}<span className={'estado ' + c.estado}>{c.estado.replace('_', ' ')}</span>
          <div>{c.mascotas?.nombre} · dueño: {c.mascotas?.clientes?.nombre}</div>
          <div style={{ fontSize: 14, color: '#64748b' }}>Atiende: {c.veterinario?.nombre}{c.motivo ? ` · ${c.motivo}` : ''}</div>
          {c.estado === 'programada' && (
            <div className="acciones">
              <button className="sec" onClick={() => cancelar(c.id)}>Cancelar cita</button>
            </div>
          )}
        </div>
      ))}
      {visibles.length === 0 && <p>No hay citas para mostrar.</p>}
    </div>
  )
}
