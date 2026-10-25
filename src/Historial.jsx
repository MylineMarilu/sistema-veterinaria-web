import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const MAX_MB = 10
const TIPOS = ['application/pdf', 'image/jpeg', 'image/png']

function Adjuntar({ atencion, onListo }) {
  const [nombre, setNombre] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [clave, setClave] = useState(0)

  async function subir(e) {
    e.preventDefault()
    if (subiendo) return
    setError('')
    if (!archivo) return setError('Elige un archivo.')
    if (!TIPOS.includes(archivo.type)) return setError('Solo se permiten PDF, JPG o PNG.')
    if (archivo.size > MAX_MB * 1024 * 1024) return setError(`El archivo supera ${MAX_MB} MB.`)

    setSubiendo(true)
    const limpio = archivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const ruta = `${atencion.mascota_id}/${atencion.id}/${Date.now()}-${limpio}`

    const { error: e1 } = await supabase.storage
      .from('examenes').upload(ruta, archivo, { contentType: archivo.type })
    if (e1) { setSubiendo(false); return setError('No se pudo subir: ' + e1.message) }

    const { error: e2 } = await supabase.from('examenes').insert({
      atencion_id: atencion.id,
      nombre: nombre.trim() || archivo.name,
      archivo_url: ruta,
    })
    if (e2) {
      await supabase.storage.from('examenes').remove([ruta])
      setSubiendo(false)
      return setError('No se pudo registrar el examen: ' + e2.message)
    }

    setSubiendo(false)
    setNombre(''); setArchivo(null); setClave(c => c + 1)
    onListo()
  }

  return (
    <form onSubmit={subir} className="item" style={{ marginTop: 8 }}>
      <b>Adjuntar examen</b>
      <div className="fila" style={{ marginTop: 6 }}>
        <input placeholder="Nombre (ej. Hemograma)" value={nombre} onChange={e => setNombre(e.target.value)} />
        <input key={clave} type="file" accept=".pdf,image/jpeg,image/png" onChange={e => setArchivo(e.target.files[0] || null)} />
      </div>
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={subiendo}>{subiendo ? 'Subiendo...' : 'Subir examen'}</button>
    </form>
  )
}

export default function Historial({ rol }) {
  const [mascotas, setMascotas] = useState([])
  const [mascotaId, setMascotaId] = useState('')
  const [atenciones, setAtenciones] = useState([])
  const [error, setError] = useState('')
  const puedeSubir = rol === 'veterinario'

  useEffect(() => {
    supabase.from('mascotas').select('id, nombre, especie, clientes(nombre)').order('nombre')
      .then(({ data }) => setMascotas(data || []))
  }, [])

  async function cargarAtenciones(id) {
    if (!id) { setAtenciones([]); return }
    const { data, error } = await supabase
      .from('atenciones')
      .select('*, veterinario:perfiles!veterinario_id(nombre), recetas(*, receta_items(*)), examenes(*)')
      .eq('mascota_id', id)
      .order('fecha', { ascending: false })
    if (error) setError(error.message)
    else setAtenciones(data)
  }

  useEffect(() => { cargarAtenciones(mascotaId) }, [mascotaId])

  async function ver(ex) {
    setError('')
    const w = window.open('', '_blank')
    if (!w) return setError('Permite las ventanas emergentes para abrir el examen.')
    const { data, error } = await supabase.storage.from('examenes').createSignedUrl(ex.archivo_url, 120)
    if (error) { w.close(); return setError('No se pudo abrir: ' + error.message) }
    w.location.href = data.signedUrl
  }

  async function quitar(ex) {
    if (!confirm(`¿Eliminar el examen "${ex.nombre}"?`)) return
    setError('')
    await supabase.storage.from('examenes').remove([ex.archivo_url])
    const { error } = await supabase.from('examenes').delete().eq('id', ex.id)
    if (error) return setError(error.message)
    cargarAtenciones(mascotaId)
  }

  return (
    <div>
      <div className="tarjeta">
        <h3>Historial clínico</h3>
        <select value={mascotaId} onChange={e => setMascotaId(e.target.value)}>
          <option value="">Elige una mascota...</option>
          {mascotas.map(m => (
            <option key={m.id} value={m.id}>{m.nombre} - {m.especie} (dueño: {m.clientes?.nombre})</option>
          ))}
        </select>
        {error && <div className="error">{error}</div>}
      </div>

      {atenciones.map(a => (
        <div className="tarjeta" key={a.id}>
          <strong>{new Date(a.fecha).toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' })}</strong>
          <span style={{ color: '#64748b' }}> · {a.veterinario?.nombre}</span>
          {a.sintomas && <p><b>Síntomas:</b> {a.sintomas}</p>}
          {a.antecedentes && <p><b>Antecedentes:</b> {a.antecedentes}</p>}
          <p style={{ fontSize: 14 }}>
            {a.temperatura_c != null && <>Temp: {a.temperatura_c} °C · </>}
            {a.frecuencia_cardiaca != null && <>FC: {a.frecuencia_cardiaca} · </>}
            {a.frecuencia_respiratoria != null && <>FR: {a.frecuencia_respiratoria} · </>}
            {a.peso_kg != null && <>Peso: {a.peso_kg} kg</>}
          </p>
          {a.diagnostico && <p><b>Diagnóstico:</b> {a.diagnostico}</p>}
          {a.tratamiento && <p><b>Tratamiento:</b> {a.tratamiento}</p>}

          {a.recetas?.map(r => (
            <div className="item" key={r.id}>
              <b>Receta</b>{r.vigente_hasta && <> (vigente hasta {r.vigente_hasta})</>}
              {r.receta_items?.map(i => (
                <div key={i.id}>• {i.medicamento} — {i.dosis}, {i.frecuencia}{i.duracion ? `, ${i.duracion}` : ''}</div>
              ))}
              {r.indicaciones && <div><i>{r.indicaciones}</i></div>}
            </div>
          ))}

          {a.examenes?.length > 0 && (
            <div className="item">
              <b>Exámenes adjuntos</b>
              {a.examenes.map(ex => (
                <div key={ex.id} className="acciones" style={{ alignItems: 'center' }}>
                  <span>📎 {ex.nombre}</span>
                  <button className="sec" onClick={() => ver(ex)}>Ver</button>
                  {puedeSubir && <button className="sec" onClick={() => quitar(ex)}>Eliminar</button>}
                </div>
              ))}
            </div>
          )}

          {puedeSubir && <Adjuntar atencion={a} onListo={() => cargarAtenciones(mascotaId)} />}
        </div>
      ))}
      {mascotaId && atenciones.length === 0 && <p>Esta mascota aún no tiene atenciones.</p>}
    </div>
  )
}
