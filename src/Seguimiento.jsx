import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const ESTADOS = [
  ['en_espera', 'En espera'],
  ['en_consulta', 'En consulta'],
  ['en_cirugia', 'En cirugía'],
  ['en_bano', 'En baño'],
  ['lista_para_recoger', 'Lista para recoger'],
  ['entregada', 'Entregada'],
]

const fecha = f => new Date(f).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

export default function Seguimiento({ userId }) {
  const [mascotas, setMascotas] = useState([])
  const [mascotaId, setMascotaId] = useState('')
  const [registros, setRegistros] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('mascotas').select('id, nombre, clientes(nombre)').order('nombre')
      .then(({ data }) => setMascotas(data || []))
  }, [])

  async function cargar(id) {
    if (!id) return setRegistros([])
    const { data } = await supabase
      .from('seguimiento').select('*').eq('mascota_id', id)
      .order('creado_en', { ascending: false }).limit(10)
    setRegistros(data || [])
  }

  useEffect(() => { cargar(mascotaId) }, [mascotaId])

  const actual = registros[0]?.estado

  async function cambiar(estado) {
    if (estado === actual) return
    setError('')
    const { error } = await supabase.from('seguimiento').insert({
      mascota_id: mascotaId, estado, actualizado_por: userId,
    })
    if (error) return setError(error.message)
    cargar(mascotaId)
  }

  return (
    <div>
      <div className="tarjeta">
        <h3>Estado de la mascota</h3>
        <select value={mascotaId} onChange={e => setMascotaId(e.target.value)}>
          <option value="">Elige una mascota...</option>
          {mascotas.map(m => (
            <option key={m.id} value={m.id}>{m.nombre} (dueño: {m.clientes?.nombre})</option>
          ))}
        </select>

        {mascotaId && (
          <div className="acciones" style={{ flexWrap: 'wrap' }}>
            {ESTADOS.map(([valor, texto]) => (
              <button
                key={valor}
                className={valor === 'lista_para_recoger' ? '' : 'sec'}
                disabled={valor === actual}
                onClick={() => cambiar(valor)}
              >
                {texto}
              </button>
            ))}
          </div>
        )}
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
    </div>
  )
}
