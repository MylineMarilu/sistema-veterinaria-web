import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Usuarios from './Usuarios'
import Reportes from './Reportes'
import AdminClientes from './AdminClientes'
import Clientes from './Clientes'
import Citas from './Citas'
import Atencion from './Atencion'
import Historial from './Historial'
import Seguimiento from './Seguimiento'

const TABS = [
  { id: 'usuarios', texto: 'Usuarios', roles: ['admin'] },
  { id: 'reportes', texto: 'Reportes', roles: ['admin'] },
  { id: 'adminclientes', texto: 'Clientes', roles: ['admin'] },
  { id: 'clientes', texto: 'Clientes y mascotas', roles: ['recepcionista'] },
  { id: 'citas', texto: 'Citas', roles: ['recepcionista', 'veterinario'] },
  { id: 'atencion', texto: 'Atención', roles: ['veterinario'] },
  { id: 'historial', texto: 'Historial', roles: ['admin', 'recepcionista', 'veterinario'] },
  { id: 'seguimiento', texto: 'Seguimiento', roles: ['recepcionista', 'veterinario'] },
]

export default function App() {
  const [user, setUser] = useState(undefined)
  const [perfil, setPerfil] = useState(null)
  const [pestana, setPestana] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) { setPerfil(null); return }
    supabase.from('perfiles').select('nombre, rol, activo').eq('id', user.id).single()
      .then(({ data }) => {
        if (data && data.activo === false) {
          supabase.auth.signOut()
          alert('Tu cuenta está desactivada. Habla con el administrador.')
        } else {
          setPerfil(data)
        }
      })
  }, [user])

  if (user === undefined) return <p style={{ padding: 20 }}>Cargando...</p>
  if (user === null) return <Login />
  if (!perfil) return <p style={{ padding: 20 }}>Cargando...</p>

  const visibles = TABS.filter(t => t.roles.includes(perfil.rol))
  const actual = visibles.find(t => t.id === pestana) ? pestana : visibles[0]?.id

  return (
    <div>
      <div className="barra">
        <strong>Sistema Veterinario</strong>
        <span>{perfil.nombre} ({perfil.rol}) &nbsp;
          <button onClick={() => supabase.auth.signOut()}>Salir</button>
        </span>
      </div>
      <div className="contenido">
        {perfil.rol === 'cliente' ? (
          <div className="tarjeta">Los clientes usan la app móvil. Esta web es para el personal de la clínica.</div>
        ) : (
          <>
            <div className="tabs">
              {visibles.map(t => (
                <button key={t.id} className={actual === t.id ? 'activa' : ''} onClick={() => setPestana(t.id)}>
                  {t.texto}
                </button>
              ))}
            </div>
            {actual === 'usuarios' && <Usuarios userId={user.id} />}
            {actual === 'reportes' && <Reportes />}
            {actual === 'adminclientes' && <AdminClientes />}
            {actual === 'clientes' && <Clientes puedeEliminar={perfil.rol === 'admin'} />}
            {actual === 'citas' && <Citas userId={user.id} />}
            {actual === 'atencion' && <Atencion userId={user.id} rol={perfil.rol} />}
            {actual === 'historial' && <Historial rol={perfil.rol} />}
            {actual === 'seguimiento' && <Seguimiento userId={user.id} />}
          </>
        )}
      </div>
    </div>
  )
}
