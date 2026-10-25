import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { supabaseAlterno } from './supabaseAlterno'

const vacioCliente = { nombre: '', dni: '', telefono: '', email: '', direccion: '' }
const vacioMascota = { nombre: '', especie: 'perro', raza: '', sexo: 'macho', fecha_nacimiento: '' }

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [buscar, setBuscar] = useState('')
  const [form, setForm] = useState(vacioCliente)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(null)
  const [formMascota, setFormMascota] = useState(vacioMascota)
  const [acceso, setAcceso] = useState(null)
  const [clave, setClave] = useState('')
  const [errAcceso, setErrAcceso] = useState('')
  const [okAcceso, setOkAcceso] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    const { data, error } = await supabase
      .from('clientes').select('*, mascotas(*)').order('creado_en', { ascending: false })
    if (error) setError(error.message)
    else setClientes(data)
  }

  useEffect(() => { cargar() }, [])

  async function guardarCliente(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('clientes').insert({
      nombre: form.nombre,
      dni: form.dni || null,
      telefono: form.telefono || null,
      email: form.email || null,
      direccion: form.direccion || null,
    })
    if (error) return setError(error.message.includes('dni') ? 'Ya existe un cliente con ese DNI' : error.message)
    setForm(vacioCliente)
    cargar()
  }

  async function guardarMascota(e, clienteId) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('mascotas').insert({
      cliente_id: clienteId,
      nombre: formMascota.nombre,
      especie: formMascota.especie,
      raza: formMascota.raza || null,
      sexo: formMascota.sexo,
      fecha_nacimiento: formMascota.fecha_nacimiento || null,
    })
    if (error) return setError(error.message)
    setFormMascota(vacioMascota)
    setAbierto(null)
    cargar()
  }

  async function crearAcceso(e, c) {
    e.preventDefault()
    if (guardando) return
    setErrAcceso(''); setOkAcceso('')
    if (clave.length < 6) return setErrAcceso('La contraseña debe tener al menos 6 caracteres.')
    setGuardando(true)

    const { data, error } = await supabaseAlterno.auth.signUp({
      email: c.email.trim(),
      password: clave,
      options: { data: { nombre: c.nombre } },
    })
    if (error) { setGuardando(false); return setErrAcceso(error.message) }

    const nuevo = data.user
    if (!nuevo || (nuevo.identities && nuevo.identities.length === 0)) {
      setGuardando(false)
      return setErrAcceso('Ese correo ya tiene una cuenta.')
    }

    const { error: e2 } = await supabase.from('clientes').update({ user_id: nuevo.id }).eq('id', c.id)
    setGuardando(false)
    if (e2) return setErrAcceso('La cuenta se creó, pero no se pudo enlazar: ' + e2.message)

    setOkAcceso(`Acceso creado para ${c.nombre}. Correo: ${c.email}`)
    setAcceso(null)
    setClave('')
    cargar()
  }

  const filtrados = clientes.filter(c =>
    (c.nombre + ' ' + (c.dni || '')).toLowerCase().includes(buscar.toLowerCase())
  )

  return (
    <div>
      <div className="tarjeta">
        <h3>Registrar cliente</h3>
        <form onSubmit={guardarCliente}>
          <div className="fila">
            <input required placeholder="Nombre completo" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            <input placeholder="DNI" value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} />
            <input placeholder="Teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
            <input placeholder="Correo" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input placeholder="Dirección" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
          </div>
          <button type="submit">Guardar cliente</button>
        </form>
        {error && <div className="error">{error}</div>}
      </div>

      {okAcceso && <div className="ok">{okAcceso}</div>}

      <input placeholder="Buscar por nombre o DNI..." value={buscar} onChange={e => setBuscar(e.target.value)} />

      {filtrados.map(c => (
        <div className="tarjeta" key={c.id}>
          <strong>{c.nombre}</strong> {c.dni && <span>· DNI {c.dni}</span>}
          {c.user_id && <> <span className="estado atendida">Tiene acceso a la app</span></>}
          <div style={{ fontSize: 14, color: '#64748b' }}>{c.telefono} {c.email}</div>

          {c.mascotas.map(m => (
            <div className="mascota" key={m.id}>
              {m.nombre} · {m.especie}{m.raza ? ` (${m.raza})` : ''} · {m.sexo}
            </div>
          ))}

          {abierto === c.id ? (
            <form onSubmit={e => guardarMascota(e, c.id)} style={{ marginTop: 10 }}>
              <div className="fila">
                <input required placeholder="Nombre de la mascota" value={formMascota.nombre} onChange={e => setFormMascota({ ...formMascota, nombre: e.target.value })} />
                <select value={formMascota.especie} onChange={e => setFormMascota({ ...formMascota, especie: e.target.value })}>
                  <option value="perro">Perro</option>
                  <option value="gato">Gato</option>
                  <option value="ave">Ave</option>
                  <option value="otro">Otro</option>
                </select>
                <input placeholder="Raza" value={formMascota.raza} onChange={e => setFormMascota({ ...formMascota, raza: e.target.value })} />
                <select value={formMascota.sexo} onChange={e => setFormMascota({ ...formMascota, sexo: e.target.value })}>
                  <option value="macho">Macho</option>
                  <option value="hembra">Hembra</option>
                </select>
                <input type="date" value={formMascota.fecha_nacimiento} onChange={e => setFormMascota({ ...formMascota, fecha_nacimiento: e.target.value })} />
              </div>
              <div className="acciones">
                <button type="submit">Guardar mascota</button>
                <button type="button" className="sec" onClick={() => setAbierto(null)}>Cancelar</button>
              </div>
            </form>
          ) : acceso === c.id ? (
            <form onSubmit={e => crearAcceso(e, c)} style={{ marginTop: 10 }}>
              <p style={{ fontSize: 14 }}>Se creará la cuenta con el correo <b>{c.email}</b>. Define una contraseña y entrégasela al cliente.</p>
              <input type="password" required placeholder="Contraseña (mín. 6)" value={clave} onChange={e => setClave(e.target.value)} />
              {errAcceso && <div className="error">{errAcceso}</div>}
              <div className="acciones">
                <button type="submit" disabled={guardando}>{guardando ? 'Creando...' : 'Crear acceso'}</button>
                <button type="button" className="sec" onClick={() => { setAcceso(null); setClave(''); setErrAcceso('') }}>Cancelar</button>
              </div>
            </form>
          ) : (
            <div className="acciones">
              <button className="sec" onClick={() => { setAbierto(c.id); setFormMascota(vacioMascota); setOkAcceso('') }}>+ Agregar mascota</button>
              {!c.user_id && c.email && (
                <button className="sec" onClick={() => { setAcceso(c.id); setClave(''); setErrAcceso(''); setOkAcceso('') }}>Crear acceso a la app</button>
              )}
              {!c.user_id && !c.email && <small style={{ color: '#64748b', alignSelf: 'center' }}>Sin correo: no se puede crear acceso</small>}
            </div>
          )}
        </div>
      ))}
      {filtrados.length === 0 && <p>No hay clientes que mostrar.</p>}
    </div>
  )
}
