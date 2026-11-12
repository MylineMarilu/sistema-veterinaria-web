import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { supabaseAlterno } from './supabaseAlterno'

const vacioCliente = { nombre: '', dni: '', telefono: '', email: '', direccion: '' }
const vacioMascota = { nombre: '', especie: 'perro', raza: '', sexo: 'macho', fecha_nacimiento: '' }
const hoy = () => new Date().toLocaleDateString('en-CA')

export default function Clientes({ puedeEliminar = false }) {
  const [clientes, setClientes] = useState([])
  const [buscar, setBuscar] = useState('')
  const [form, setForm] = useState(vacioCliente)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(null)
  const [formMascota, setFormMascota] = useState(vacioMascota)
  const [errMascota, setErrMascota] = useState('')
  const [aviso, setAviso] = useState(null)
  const [acceso, setAcceso] = useState(null)
  const [clave, setClave] = useState('')
  const [errAcceso, setErrAcceso] = useState('')
  const [okAcceso, setOkAcceso] = useState('')
  const [guardando, setGuardando] = useState(false)
  const enviando = useRef(false)

  async function cargar() {
    const { data, error } = await supabase
      .from('clientes').select('*, mascotas(*)').order('creado_en', { ascending: false })
    if (error) setError('No se pudieron cargar los clientes.')
    else setClientes(data)
  }

  useEffect(() => { cargar() }, [])

  async function guardarCliente(e) {
    e.preventDefault()
    setError(''); setOkAcceso(''); setAviso(null)
    if (!/^\d{8}$/.test(form.dni)) {
      return setError('El DNI debe tener exactamente 8 números.')
    }
    if (!form.nombre.trim() || !form.direccion.trim()) {
      return setError('Completa todos los datos del cliente.')
    }

    const { error } = await supabase.from('clientes').insert({
      nombre: form.nombre.trim(),
      dni: form.dni.trim(),
      telefono: form.telefono.trim(),
      email: form.email.trim(),
      direccion: form.direccion.trim(),
    })
    if (error) {
      console.error(error)
      return setError(
        error.code === '23505'
          ? 'Ya hay un cliente registrado con ese DNI.'
          : 'No se pudo guardar el cliente. Revisa los datos e inténtalo otra vez.'
      )
    }
    setForm(vacioCliente)
    setOkAcceso('Cliente registrado correctamente.')
    cargar()
  }

  async function guardarMascota(e, clienteId) {
    e.preventDefault()
    if (enviando.current) return
    enviando.current = true
    setErrMascota('')

    try {
      const nombre = formMascota.nombre.trim()
      const raza = formMascota.raza.trim()
      if (!nombre || !raza || !formMascota.fecha_nacimiento) {
        setErrMascota('Completa todos los datos de la mascota.')
        return
      }

      const cliente = clientes.find(c => c.id === clienteId)
      const repetida = cliente?.mascotas.some(
        m => m.nombre.trim().toLowerCase() === nombre.toLowerCase() && m.especie === formMascota.especie
      )
      if (repetida) {
        setErrMascota(`${cliente.nombre} ya tiene registrada a ${nombre} (${formMascota.especie}). Si es otra mascota, cambia el nombre o la especie.`)
        return
      }

      setGuardando(true)
      const { error } = await supabase.from('mascotas').insert({
        cliente_id: clienteId,
        nombre,
        especie: formMascota.especie,
        raza,
        sexo: formMascota.sexo,
        fecha_nacimiento: formMascota.fecha_nacimiento,
      })
      if (error) {
        console.error(error)
        setErrMascota(
          error.code === '23505'
            ? 'Ese cliente ya tiene una mascota con ese nombre y especie. Si es otra, cambia el nombre o la especie.'
            : 'No se pudo guardar la mascota. Inténtalo otra vez.'
        )
        return
      }

      setFormMascota(vacioMascota)
      setAbierto(null)
      await cargar()
    } finally {
      enviando.current = false
      setGuardando(false)
    }
  }

  async function eliminarMascota(m, c) {
    if (!confirm(`¿Eliminar a ${m.nombre}? Esta acción no se puede deshacer.`)) return
    setAviso(null); setOkAcceso('')

    const { error } = await supabase.from('mascotas').delete().eq('id', m.id)
    if (error) {
      console.error(error)
      return setAviso({
        id: c.id,
        texto: error.code === '23503'
          ? `No se puede eliminar a ${m.nombre} porque ya tiene citas, historial o seguimiento registrados.`
          : 'No se pudo eliminar la mascota. Inténtalo otra vez.',
      })
    }
    setOkAcceso(`Mascota ${m.nombre} eliminada.`)
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

  async function eliminarCliente(c) {
    if (!confirm(`¿Eliminar al cliente ${c.nombre} y sus mascotas? Esta acción no se puede deshacer.`)) return
    setError(''); setOkAcceso(''); setAviso(null)

    const { error } = await supabase.from('clientes').delete().eq('id', c.id)
    if (error) {
      return setAviso({
        id: c.id,
        texto: error.code === '23503'
          ? 'No se puede eliminar: sus mascotas tienen citas, historial o seguimiento registrados.'
          : 'No se pudo eliminar el cliente.',
      })
    }

    if (c.user_id) {
      const { error: e2 } = await supabase.rpc('eliminar_usuario', { uid: c.user_id })
      if (e2) {
        cargar()
        return setError('Cliente eliminado, pero su cuenta de acceso sigue activa. Bórrala en Supabase > Authentication > Users.')
      }
    }
    setOkAcceso(`Cliente ${c.nombre} eliminado.`)
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
            <input required inputMode="numeric" maxLength={8} pattern="[0-9]{8}" title="El DNI debe tener 8 números" placeholder="DNI (8 números)" value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value.replace(/\D/g, '') })} />
            <input required inputMode="numeric" maxLength={9} pattern="[0-9]{9}" title="El teléfono debe tener 9 números" placeholder="Teléfono (9 números)" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value.replace(/\D/g, '') })} />
            <input required type="email" placeholder="Correo" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input required placeholder="Dirección" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
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
            <div className="mascota" key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>{m.nombre} · {m.especie}{m.raza ? ` (${m.raza})` : ''} · {m.sexo}</span>
              {puedeEliminar && (
                <button type="button" className="sec" onClick={() => eliminarMascota(m, c)}>Eliminar</button>
              )}
            </div>
          ))}

          {aviso?.id === c.id && (
            <div className="alerta">
              <span className="icono">🐾</span>
              <div>
                <b>No se pudo eliminar</b>
                {aviso.texto}
              </div>
            </div>
          )}

          {abierto === c.id ? (
            <form onSubmit={e => guardarMascota(e, c.id)} style={{ marginTop: 10 }}>
              <div className="fila">
                <input required placeholder="Nombre de la mascota" value={formMascota.nombre} onChange={e => setFormMascota({ ...formMascota, nombre: e.target.value })} />
                <select required value={formMascota.especie} onChange={e => setFormMascota({ ...formMascota, especie: e.target.value })}>
                  <option value="perro">Perro</option>
                  <option value="gato">Gato</option>
                  <option value="otro">Otro</option>
                </select>
                <input required placeholder="Raza" value={formMascota.raza} onChange={e => setFormMascota({ ...formMascota, raza: e.target.value })} />
                <select required value={formMascota.sexo} onChange={e => setFormMascota({ ...formMascota, sexo: e.target.value })}>
                  <option value="macho">Macho</option>
                  <option value="hembra">Hembra</option>
                </select>
                <input required type="date" max={hoy()} title="Fecha de nacimiento" value={formMascota.fecha_nacimiento} onChange={e => setFormMascota({ ...formMascota, fecha_nacimiento: e.target.value })} />
              </div>
              {errMascota && (
                <div className="alerta">
                  <span className="icono">🐾</span>
                  <div>
                    <b>¡Un momento!</b>
                    {errMascota}
                  </div>
                </div>
              )}
              <div className="acciones">
                <button type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar mascota'}</button>
                <button type="button" className="sec" onClick={() => { setAbierto(null); setErrMascota('') }}>Cancelar</button>
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
              <button className="sec" onClick={() => { setAbierto(c.id); setFormMascota(vacioMascota); setErrMascota(''); setOkAcceso(''); setAviso(null) }}>+ Agregar mascota</button>
              {!c.user_id && c.email && (
                <button className="sec" onClick={() => { setAcceso(c.id); setClave(''); setErrAcceso(''); setOkAcceso('') }}>Crear acceso a la app</button>
              )}
              {!c.user_id && !c.email && <small style={{ color: '#64748b', alignSelf: 'center' }}>Sin correo: no se puede crear acceso</small>}
              {puedeEliminar && (
                <button className="sec" onClick={() => eliminarCliente(c)}>Eliminar cliente</button>
              )}
            </div>
          )}
        </div>
      ))}
      {filtrados.length === 0 && <p>No hay clientes que mostrar.</p>}
    </div>
  )
}
