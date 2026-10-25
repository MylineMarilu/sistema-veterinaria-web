import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const iso = d => d.toLocaleDateString('en-CA')

function contar(lista) {
  const mapa = {}
  lista.forEach(x => {
    const k = (x || 'Sin dato').toString().trim() || 'Sin dato'
    mapa[k] = (mapa[k] || 0) + 1
  })
  return Object.entries(mapa)
    .map(([etiqueta, valor]) => ({ etiqueta, valor }))
    .sort((a, b) => b.valor - a.valor)
}

function Barras({ datos, color = '#2E75B6' }) {
  if (datos.length === 0) return <p style={{ color: '#64748b' }}>Sin datos en este rango.</p>
  const max = Math.max(1, ...datos.map(d => d.valor))
  return (
    <>
      {datos.map(d => (
        <div className="barra-fila" key={d.etiqueta}>
          <span className="etq">{d.etiqueta}</span>
          <div className="relleno" style={{ width: `${(d.valor / max) * 55}%`, background: color }} />
          <b>{d.valor}</b>
        </div>
      ))}
    </>
  )
}

export default function Reportes() {
  const hoy = new Date()
  const hace30 = new Date()
  hace30.setDate(hoy.getDate() - 30)

  const [desde, setDesde] = useState(iso(hace30))
  const [hasta, setHasta] = useState(iso(hoy))
  const [citas, setCitas] = useState([])
  const [atenciones, setAtenciones] = useState([])
  const [totales, setTotales] = useState({ clientes: 0, mascotas: 0 })
  const [especies, setEspecies] = useState([])
  const [error, setError] = useState('')

  async function cargar() {
    if (!desde || !hasta) return
    setError('')
    const ini = new Date(desde + 'T00:00:00').toISOString()
    const fin = new Date(hasta + 'T23:59:59').toISOString()

    const [c, a, cl, m] = await Promise.all([
      supabase.from('citas')
        .select('estado, veterinario:perfiles!veterinario_id(nombre)')
        .gte('fecha_hora', ini).lte('fecha_hora', fin),
      supabase.from('atenciones')
        .select('fecha, diagnostico, veterinario:perfiles!veterinario_id(nombre)')
        .gte('fecha', ini).lte('fecha', fin),
      supabase.from('clientes').select('id', { count: 'exact', head: true }),
      supabase.from('mascotas').select('especie'),
    ])

    const fallo = c.error || a.error || cl.error || m.error
    if (fallo) return setError(fallo.message)

    setCitas(c.data)
    setAtenciones(a.data)
    setTotales({ clientes: cl.count ?? 0, mascotas: m.data.length })
    setEspecies(contar(m.data.map(x => x.especie)))
  }

  useEffect(() => { cargar() }, [desde, hasta])

  const porEstado = contar(citas.map(c => c.estado.replace('_', ' ')))
  const citasVet = contar(citas.map(c => c.veterinario?.nombre))
  const atencionesVet = contar(atenciones.map(a => a.veterinario?.nombre))
  const diagnosticos = contar(
    atenciones.filter(a => a.diagnostico).map(a => a.diagnostico.toLowerCase())
  ).slice(0, 5)

  return (
    <div>
      <div className="tarjeta">
        <div className="fila" style={{ alignItems: 'center' }}>
          <label>Desde: <input type="date" value={desde} onChange={e => setDesde(e.target.value)} /></label>
          <label>Hasta: <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></label>
          <button className="noprint" onClick={() => window.print()}>Imprimir / guardar PDF</button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="kpis">
        <div className="kpi"><b>{citas.length}</b><span>Citas en el rango</span></div>
        <div className="kpi"><b>{atenciones.length}</b><span>Atenciones realizadas</span></div>
        <div className="kpi"><b>{totales.clientes}</b><span>Clientes registrados</span></div>
        <div className="kpi"><b>{totales.mascotas}</b><span>Mascotas registradas</span></div>
      </div>

      <div className="tarjeta">
        <h3>Citas por estado</h3>
        <Barras datos={porEstado} />
      </div>

      <div className="tarjeta">
        <h3>Citas por veterinario</h3>
        <Barras datos={citasVet} color="#16a34a" />
      </div>

      <div className="tarjeta">
        <h3>Atenciones por veterinario</h3>
        <Barras datos={atencionesVet} color="#d97706" />
      </div>

      <div className="tarjeta">
        <h3>Mascotas por especie</h3>
        <Barras datos={especies} color="#7c3aed" />
      </div>

      <div className="tarjeta">
        <h3>Diagnósticos más frecuentes</h3>
        <Barras datos={diagnosticos} color="#b91c1c" />
      </div>
    </div>
  )
}
