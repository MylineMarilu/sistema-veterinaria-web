import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { supabaseAlterno } from './supabaseAlterno'

const ROLES = ['admin', 'recepcionista', 'veterinario']
const vacio = { nombre: '', email: '', password: '', rol: 'recepcionista' }

export default function Usuarios({ userId }) {
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(vacio)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    const { data, error } = await supabase
      .from('perfiles').select('*').neq('rol', 'cliente').order('creado_en')
    if (error) setError(error.message)
    else setLista(data)
  }

  useEffect(() => { cargar() }, [])

  async function crear(e) {
    e.preventDefault()
    if (guardando) return
    setError(''); setOk('')
    if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    setGuardando(true)

    const { data, error } = await supabaseAlterno.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { nombre: form.nombre.trim() } },
    })
    if (error) { setGuardando(false); return setError(error.message) }

    const nuevo = data.user
    if (!nuevo || (nuevo.identities && nuevo.identities.length === 0)) {
      setGuardando(false)
      return setError('Ese correo ya está registrado.')
    }

    const { error: e2 } = await supabase.from('perfiles')
      .update({ nombre: form.nombre.trim(), rol: form.rol, email: form.email.trim() })
      .eq('id', nuevo.id)
    setGuardando(false)
    if (e2) return setError('La cuenta se creó, pero no se pudo asignar el rol: ' + e2.message)

    setOk(`Usuario creado: ${form.email} (${form.rol}).`)
    setForm(vacio)
    cargar()
  }

  async function cambiarRol(id, rol) {
    setError('')
    const { error } = await supabase.from('perfiles').update({ rol }).eq('id', id)
    if (error) setError(error.message)
    cargar()
  }

  async function alternar(p) {
    setError('')
    const { error } = await supabase.from('perfiles').update({ activo: !p.activo }).eq('id', p.id)
    if (error) setError(error.message)
    cargar()
  }

    async function eliminar(p) {
    if (!confirm(`¿Eliminar a ${p.nombre}? Esta acción no se puede deshacer.`)) return
    setError(''); setOk('')
    const { error } = await supabase.rpc('eliminar_usuario', { uid: p.id })
    if (error) {
      return setError(
        error.code === '23503'
          ? 'No se puede eliminar: este usuario tiene citas o atenciones registradas. Usa Desactivar.'
          : 'No se pudo eliminar: ' + error.message
      )
    }
    setOk(`Usuario ${p.nombre} eliminado.`)
    cargar()
  }
  return (
    <div>
      <div className="tarjeta">
        <h3>Crear usuario del personal</h3>
        <form onSubmit={crear}>
          <div className="fila">
            <input required placeholder="Nombre completo" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            <input required type="email" placeholder="Correo" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input required type="password" placeholder="Contraseña (mín. 6)" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button type="submit" disabled={guardando}>{guardando ? 'Creando...' : 'Crear usuario'}</button>
        </form>
        {ok && <div className="ok">{ok}</div>}
        {error && <div className="error">{error}</div>}
      </div>

      <h3>Usuarios del personal</h3>
      {lista.map(p => (
        <div className="tarjeta" key={p.id}>
          <strong>{p.nombre}</strong> {p.id === userId && <small>(tú)</small>}
          <div style={{ fontSize: 14, color: '#64748b' }}>{p.email}</div>
          <div className="fila" style={{ alignItems: 'center', marginTop: 8 }}>
            <select value={p.rol} disabled={p.id === userId} onChange={e => cambiarRol(p.id, e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <span className={'estado ' + (p.activo ? 'atendida' : 'cancelada')}>{p.activo ? 'activo' : 'desactivado'}</span>
            <button className="sec" disabled={p.id === userId} onClick={() => alternar(p)}>
              {p.activo ? 'Desactivar' : 'Activar'}
            </button>
            <button className="sec" disabled={p.id === userId} onClick={() => eliminar(p)}>Eliminar</button>
          </div>
        </div>
      ))}
    </div>
  )
}
