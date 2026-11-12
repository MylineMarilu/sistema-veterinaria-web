import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

const ESTADOS = [
  ['en_espera', 'En espera'],
  ['en_consulta', 'En consulta'],
  ['en_cirugia', 'En cirugía'],
  ['en_bano', 'En baño'],
  ['lista_para_recoger', 'Lista para recoger'],
  ['entregada', 'Entregada'],
]

const textoDe = v => ESTADOS.find(e => e[0] === v)?.[1] || v
const fecha = f => new Date(f).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

export default function Seguimiento({ userId }) {
  const [mascotas, setMascotas] = useState([])
  const [mascotaId, setMascotaId] = useState('')
  const [registros, setRegistros] = useState([])
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [pendiente, setPendiente] = useState(null)
  const enviando = useRef(false)

  useEffect(() => {
    supabase.from('mascotas').select('id, nombre, clientes(nombre)').order('nombre')
      .then(({ data }) => setMascotas(data || []))
  }, [])

  async function cargar(id) {
    if (!id) return setRegistros([])
    const { data } = await supabase
      .from('seguimiento').select('*').eq('mascota_id', id)
      .order('creado_en', { ascending: false }).limit(30)
    setRegistros(data || [])
  }

  useEffect(() => { cargar(mascotaId) }, [mascotaId])

  const nombreMascota = mascotas.find(m => m.id === mascotaId)?.nombre || 'la mascota'
  const actual = registros[0]?.estado

  function pedir(estado, texto) {
    if (enviando.current || estado === actual) return
    setError(''); setOk('')
    setPendiente({ estado, texto })
  }

  async function confirmar() {
    if (!pendiente || enviando.current) return
    const { estado, texto } = pendiente
    enviando.current = true
    setPendiente(null)
    try {
      const { error } = await supabase.from('seguimiento').insert({
        mascota_id: mascotaId, estado, actualizado_por: userId,
      })
      if (error) {
        console.error(error)
        return setError('No se pudo cambiar el estado. Inténtalo otra vez.')
      }
      setOk(`✅ Estado actualizado: ${nombreMascota} ahora está «${texto}».`)
      await cargar(mascotaId)
    } finally {
      enviando.current = false
    }
  }

  return (
    <div>
      <div className="tarjeta">
        <h3>Estado de la mascota</h3>
        <select
          value={mascotaId}
          onChange={e => { setMascotaId(e.target.value); setOk(''); setError(''); setPendiente(null) }}
        >
          <option value="">Elige una mascota...</option>
          {mascotas.map(m => (
            <option key={m.id} value={m.id}>{m.nombre} (dueño: {m.clientes?.nombre})</option>
          ))}
        </select>

        {mascotaId && (
          <>
            <div className="acciones" style={{ flexWrap: 'wrap' }}>
              {ESTADOS.map(([valor, texto]) => (
                <button
                  key={valor}
                  className={valor === 'lista_para_recoger' ? '' : 'sec'}
                  disabled={valor === actual}
                  title={valor === actual ? 'Es el estado actual' : ''}
                  onClick={() => pedir(valor, texto)}
                >
                  {texto}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 0 }}>
              Antes de cambiar el estado se te pedirá confirmación.
            </p>
          </>
        )}

        {ok && <div className="ok">{ok}</div>}
        {error && <div className="error">{error}</div>}
      </div>

      {mascotaId && (
        <div className="tarjeta">
          <h4>Estado actual</h4>
          {actual ? (
            <>
              <span className={'estado ' + actual}>{actual.replaceAll('_', ' ')}</span>
              <span style={{ fontSize: 14, color: '#64748b' }}> · desde {fecha(registros[0].creado_en)}</span>
            </>
          ) : (
            <p>Esta mascota aún no tiene un estado registrado.</p>
          )}

          {registros.length > 1 && (
            <details style={{ marginTop: 10 }}>
              <summary>Cambios anteriores ({registros.length - 1})</summary>
              {registros.slice(1).map(r => (
                <div key={r.id} style={{ fontSize: 14, marginTop: 6 }}>
                  <span className={'estado ' + r.estado}>{r.estado.replaceAll('_', ' ')}</span>
                  <span style={{ color: '#64748b' }}> · {fecha(r.creado_en)}</span>
                </div>
              ))}
            </details>
          )}
        </div>
      )}

      {pendiente && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 22, maxWidth: 420, width: '100%', boxShadow: '0 10px 30px #0004', borderTop: '6px solid #f97316' }}>
            <h3 style={{ marginTop: 0 }}>⚠️ Confirmar cambio de estado</h3>
            <p>
              Vas a cambiar el estado de <b>{nombreMascota}</b>
              {actual ? <> de «<b>{textoDe(actual)}</b>»</> : null} a «<b>{pendiente.texto}</b>».
            </p>
            {pendiente.estado === 'lista_para_recoger' && (
              <p style={{ color: '#9a3412' }}>🔔 Se avisará al cliente en su aplicación.</p>
            )}
            <p style={{ fontSize: 14, color: '#64748b' }}>Revisa que sea el estado correcto antes de continuar.</p>
            <div className="acciones" style={{ justifyContent: 'flex-end' }}>
              <button className="sec" onClick={() => setPendiente(null)}>Cancelar</button>
              <button onClick={confirmar}>Sí, cambiar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
