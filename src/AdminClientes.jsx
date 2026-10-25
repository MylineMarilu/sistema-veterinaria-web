import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export default function AdminClientes() {
  const [clientes, setClientes] = useState([])
  const [buscar, setBuscar] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  async function cargar() {
    const { data, error } = await supabase
      .from('clientes').select('*, mascotas(id, nombre)').order('nombre')
    if (error) setError(error.message)
    else setClientes(data)
  }

  useEffect(() => { cargar() }, [])

  async function eliminar(c) {
    if (!confirm(`¿Eliminar al cliente ${c.nombre} y sus mascotas? Esta acción no se puede deshacer.`)) return
    setError(''); setOk('')

    const { error } = await supabase.from('clientes').delete().eq('id', c.id)
    if (error) {
      return setError(
        error.code === '23503'
          ? 'No se puede eliminar: sus mascotas tienen citas, historial o seguimiento registrados.'
          : 'No se pudo eliminar: ' + error.message
      )
    }

    if (c.user_id) {
      const { error: e2 } = await supabase.rpc('eliminar_usuario', { uid: c.user_id })
      if (e2) {
        cargar()
        return setError('Cliente eliminado, pero su cuenta de acceso sigue activa. Bórrala en Supabase > Authentication > Users.')
      }
    }
    setOk(`Cliente ${c.nombre} eliminado.`)
    cargar()
  }

  const filtrados = clientes.filter(c =>
    (c.nombre + ' ' + (c.dni || '')).toLowerCase().includes(buscar.toLowerCase())
  )

  return (
    <div>
      <h3>Clientes registrados</h3>
      {ok && <div className="ok">{ok}</div>}
      {error && <div className="error">{error}</div>}
      <input placeholder="Buscar por nombre o DNI..." value={buscar} onChange={e => setBuscar(e.target.value)} />

      {filtrados.map(c => (
        <div className="tarjeta" key={c.id}>
          <strong>{c.nombre}</strong> {c.dni && <span>· DNI {c.dni}</span>}
          {c.user_id && <> <span className="estado atendida">Tiene acceso a la app</span></>}
          <div style={{ fontSize: 14, color: '#64748b' }}>{c.telefono} {c.email}</div>
          <div style={{ fontSize: 14 }}>
            Mascotas: {c.mascotas.length > 0 ? c.mascotas.map(m => m.nombre).join(', ') : 'ninguna'}
          </div>
          <div className="acciones">
            <button className="sec" onClick={() => eliminar(c)}>Eliminar cliente</button>
          </div>
        </div>
      ))}
      {filtrados.length === 0 && <p>No hay clientes que mostrar.</p>}
    </div>
  )
}
