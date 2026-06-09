import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CalendarDays, Clock3, Edit3, LogOut, MapPin, Phone, Plus, Save, Search, Settings, Sun, Trash2, UsersRound, History, ChevronLeft, ChevronRight, Download, Printer, X } from 'lucide-react'
import { hasSupabase, supabase } from './supabaseClient'
import './styles.css'

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || 'asd123'

const seedPatients = []

const today = new Date()
const isoToday = toISODate(today)
const seedAppointments = []
const defaultSettings = { id: 'main', clinic_name: 'Lena Neuropsicóloga', start_time: '08:00', end_time: '18:00', default_duration: 50, default_price: 200 }

function toISODate(date) {
  const d = new Date(date)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
function niceDate(date) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(date + 'T12:00:00')).replace(/^./, c => c.toUpperCase()).replace('-feira', '-Feira')
}
function monthTitle(date) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date).replace(/^./, c => c.toUpperCase())
}
function uid(prefix='id') { return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}` }
function loadLocal(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback } catch { return fallback } }
function saveLocal(key, data) { localStorage.setItem(key, JSON.stringify(data)) }

function App() {
  const [logged, setLogged] = useState(localStorage.getItem('lena_logged') === 'yes')
  if (!logged) return <Login onOk={() => { localStorage.setItem('lena_logged','yes'); setLogged(true) }} />
  return <AgendaApp onLogout={() => { localStorage.removeItem('lena_logged'); setLogged(false) }} />
}

function Login({ onOk }) {
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  function submit(e) {
    e.preventDefault()
    if (pass === APP_PASSWORD) onOk()
    else setErr('Senha incorreta')
  }
  return <main className="login-screen">
    <form className="login-card" onSubmit={submit}>
      <div className="brand-login">AGENDA LENA<br/>NEUROPSICÓLOGA</div>
      <p>Acesse sua agenda</p>
      <input autoFocus type="password" placeholder="Digite a senha" value={pass} onChange={e=>setPass(e.target.value)} />
      {err && <span className="error">{err}</span>}
      <button>Entrar</button>
    </form>
  </main>
}

function AgendaApp({ onLogout }) {
  const [tab, setTab] = useState('hoje')
  const [patients, setPatients] = useState(seedPatients)
  const [appointments, setAppointments] = useState(seedAppointments)
  const [settings, setSettings] = useState(defaultSettings)
  const [selectedDate, setSelectedDate] = useState(isoToday)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    if (hasSupabase) {
      const [p, a, s] = await Promise.all([
        supabase.from('lena_neuro_2026_patients').select('*').order('created_at', { ascending: true }),
        supabase.from('lena_neuro_2026_appointments').select('*').order('appointment_date', { ascending: true }).order('appointment_time', { ascending: true }),
        supabase.from('lena_neuro_2026_settings').select('*').eq('id','main').maybeSingle()
      ])
      if (p.error) { console.error('Erro ao carregar pacientes:', p.error); setPatients(loadLocal('lena_patients', seedPatients)) }
      else setPatients(p.data || [])
      if (a.error) { console.error('Erro ao carregar consultas:', a.error); setAppointments(loadLocal('lena_appointments', seedAppointments)) }
      else setAppointments(a.data || [])
      if (!s.error && s.data) setSettings(s.data)
      else setSettings(loadLocal('lena_settings', defaultSettings))
    } else {
      setPatients(loadLocal('lena_patients', seedPatients))
      setAppointments(loadLocal('lena_appointments', seedAppointments))
      setSettings(loadLocal('lena_settings', defaultSettings))
    }
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  async function savePatient(data) {
    const record = { ...data, full_name: data.full_name.trim(), status: data.status || 'ativo' }
    if (!record.full_name) return
    if (hasSupabase) {
      if (record.id) await supabase.from('lena_neuro_2026_patients').update(record).eq('id', record.id)
      else await supabase.from('lena_neuro_2026_patients').insert(record)
      await refresh()
    } else {
      let list = [...patients]
      if (record.id) list = list.map(p => p.id === record.id ? record : p)
      else list.push({ ...record, id: uid('p') })
      setPatients(list); saveLocal('lena_patients', list)
    }
    setModal(null)
  }
  async function deletePatient(id) {
    if (!confirm('Excluir paciente?')) return
    if (hasSupabase) {
      const { error } = await supabase.from('lena_neuro_2026_patients').delete().eq('id', id)
      if (error) { alert('Não foi possível excluir o paciente: ' + error.message); console.error(error); return }
      await refresh()
    }
    else { const list = patients.filter(p=>p.id!==id); setPatients(list); saveLocal('lena_patients', list) }
  }
  async function saveAppointment(data) {
    const patient = patients.find(p => p.id === data.patient_id)
    const record = { ...data, patient_name: patient?.full_name || data.patient_name, patient_phone: patient?.phone || data.patient_phone, price: Number(data.price || 0), duration_minutes: Number(data.duration_minutes || 50) }
    if (hasSupabase) {
      if (record.id) await supabase.from('lena_neuro_2026_appointments').update(record).eq('id', record.id)
      else await supabase.from('lena_neuro_2026_appointments').insert(record)
      await refresh()
    } else {
      let list = [...appointments]
      if (record.id) list = list.map(a => a.id === record.id ? record : a)
      else list.push({ ...record, id: uid('a') })
      setAppointments(list); saveLocal('lena_appointments', list)
    }
    setModal(null)
  }
  async function deleteAppointment(id) {
    if (!confirm('Excluir consulta?')) return
    if (hasSupabase) {
      const { error } = await supabase.from('lena_neuro_2026_appointments').delete().eq('id', id)
      if (error) { alert('Não foi possível excluir a consulta: ' + error.message); console.error(error); return }
      await refresh()
    }
    else { const list = appointments.filter(a=>a.id!==id); setAppointments(list); saveLocal('lena_appointments', list) }
  }
  async function saveSettings(data) {
    const record = { ...settings, ...data, default_duration: Number(data.default_duration), default_price: Number(data.default_price) }
    if (hasSupabase) { await supabase.from('lena_neuro_2026_settings').upsert(record); await refresh() }
    else { setSettings(record); saveLocal('lena_settings', record) }
    alert('Configurações salvas')
  }

  const dayAppointments = appointments.filter(a => a.appointment_date === selectedDate).sort((a,b)=>a.appointment_time.localeCompare(b.appointment_time))
  const todayAppointments = appointments.filter(a => a.appointment_date === isoToday).sort((a,b)=>a.appointment_time.localeCompare(b.appointment_time))

  return <div className="phone-app">
    <header className="topbar">
      <h1>AGENDA LENA<br/>NEUROPSICÓLOGA</h1>
      <button className="icon-only" onClick={onLogout}><LogOut size={24}/></button>
    </header>

    {loading && <div className="loading">Carregando...</div>}

    {!loading && tab === 'hoje' && <TodayScreen selectedDate={isoToday} appointments={todayAppointments} settings={settings} onNew={()=>{setSelectedDate(isoToday); setModal({type:'appointment'})}} onEdit={(a)=>setModal({type:'appointment', item:a})} onDelete={deleteAppointment} />}
    {!loading && tab === 'agenda' && <CalendarScreen calendarMonth={calendarMonth} setCalendarMonth={setCalendarMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} appointments={appointments} dayAppointments={dayAppointments} onNew={()=>setModal({type:'appointment'})} onEdit={(a)=>setModal({type:'appointment', item:a})} onDelete={deleteAppointment} />}
    {!loading && tab === 'pacientes' && <PatientsScreen patients={patients} appointments={appointments} onNew={()=>setModal({type:'patient'})} onEdit={(p)=>setModal({type:'patient', item:p})} onDelete={deletePatient} />}
    {!loading && tab === 'ajustes' && <SettingsScreen settings={settings} onSave={saveSettings} patients={patients} appointments={appointments} />}

    <nav className="bottom-nav">
      <button className={tab==='hoje'?'active':''} onClick={()=>setTab('hoje')}><Sun/><span>Hoje</span></button>
      <button className={tab==='agenda'?'active':''} onClick={()=>setTab('agenda')}><CalendarDays/><span>Agenda</span></button>
      <button className={tab==='pacientes'?'active':''} onClick={()=>setTab('pacientes')}><UsersRound/><span>Pacientes</span></button>
      <button className={tab==='ajustes'?'active':''} onClick={()=>setTab('ajustes')}><Settings/><span>Ajustes</span></button>
    </nav>

    {modal?.type === 'patient' && <PatientModal item={modal.item} onClose={()=>setModal(null)} onSave={savePatient} />}
    {modal?.type === 'appointment' && <AppointmentModal item={modal.item} patients={patients} selectedDate={selectedDate} settings={settings} onClose={()=>setModal(null)} onSave={saveAppointment} onCreatePatient={()=>setModal({type:'patient'})} />}
  </div>
}

function PageTitle({kicker,title,action}) { return <section className="page-title"><span>{kicker}</span><div><h2>{title}</h2>{action}</div></section> }

function TodayScreen({ selectedDate, appointments, onNew, onEdit, onDelete }) {
  return <main className="screen">
    <PageTitle kicker="HOJE" title={niceDate(selectedDate)} />
    <button className="primary wide" onClick={onNew}><Plus/> Nova Consulta</button>
    <div className="cards-list">
      {appointments.length ? appointments.map(a => <AppointmentCard key={a.id} a={a} onEdit={()=>onEdit(a)} onDelete={()=>onDelete(a.id)} />) : <Empty text="Nenhuma consulta hoje." />}
    </div>
  </main>
}
function AppointmentCard({a,onEdit,onDelete}) {
  return <article className="appointment-card">
    <div className="card-actions"><button onClick={onEdit}><Edit3/></button><button onClick={onDelete}><Trash2/></button></div>
    <div className="time-row"><strong>{a.appointment_time?.slice(0,5)}</strong><span><Clock3 size={18}/> {a.duration_minutes} min</span></div>
    <h3>{a.patient_name}</h3>
    <div className="meta"><span><Phone size={18}/> {a.patient_phone || 'Sem telefone'}</span><span><MapPin size={18}/> {a.room || 'Sala 1'}</span><span>{a.service_type}</span></div>
    <div className="badges"><Badge type={a.status}>{labelStatus(a.status)}</Badge><Badge type={a.payment_status}>{labelPay(a.payment_status)}</Badge><span className="price">R$ {Number(a.price||0).toFixed(2)}</span></div>
    {a.notes && <p>{a.notes}</p>}
  </article>
}
function CalendarScreen({ calendarMonth, setCalendarMonth, selectedDate, setSelectedDate, appointments, dayAppointments, onNew, onEdit, onDelete }) {
  return <main className="screen">
    <div className="month-head"><button onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()-1, 1))}><ChevronLeft/></button><h2>{monthTitle(calendarMonth)}</h2><button onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()+1, 1))}><ChevronRight/></button></div>
    <CalendarGrid month={calendarMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} appointments={appointments} />
    <div className="day-head"><h2>{niceDate(selectedDate)}</h2><button className="primary small" onClick={onNew}><Plus/> Nova Consulta</button></div>
    <div className="cards-list agenda-day">
      {dayAppointments.length ? dayAppointments.map(a => <AppointmentCard key={a.id} a={a} onEdit={()=>onEdit(a)} onDelete={()=>onDelete(a.id)} />) : <Empty text="Nenhuma consulta neste dia." />}
    </div>
  </main>
}
function CalendarGrid({month, selectedDate, setSelectedDate, appointments}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(first); start.setDate(start.getDate() - start.getDay())
  const days = Array.from({length: 35}, (_,i)=> { const d=new Date(start); d.setDate(start.getDate()+i); return d })
  const week = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB']
  return <div className="calendar-card">
    {week.map(w=><b key={w}>{w}</b>)}
    {days.map(d => {
      const iso = toISODate(d), inMonth = d.getMonth() === month.getMonth(), count = appointments.filter(a=>a.appointment_date===iso).length
      return <button key={iso} className={`${iso===selectedDate?'selected':''} ${!inMonth?'muted':''}`} onClick={()=>setSelectedDate(iso)}><span>{d.getDate()}</span>{count>0 && <i>{Array.from({length: Math.min(count,3)}).map((_,i)=><em key={i}/>)}</i>}</button>
    })}
  </div>
}
function PatientsScreen({patients, appointments, onNew, onEdit, onDelete}) {
  const [q,setQ]=useState('')
  const filtered = patients.filter(p => `${p.full_name} ${p.phone}`.toLowerCase().includes(q.toLowerCase()))
  return <main className="screen">
    <PageTitle kicker="PACIENTES" title="Meus Pacientes" />
    <div className="search-row"><label><Search/><input placeholder="Buscar por nome ou telefone..." value={q} onChange={e=>setQ(e.target.value)} /></label><button className="square" onClick={onNew}><Plus/></button></div>
    <div className="cards-list">
      {filtered.map(p => <article className="patient-card" key={p.id}>
        <div className="patient-main"><h3>{p.full_name}</h3><Badge type={p.status}>{labelPatient(p.status)}</Badge></div>
        <div className="patient-actions"><button title="Histórico"><History/></button><button onClick={()=>onEdit(p)}><Edit3/></button><button onClick={()=>onDelete(p.id)}><Trash2/></button></div>
        <span className="phone-line"><Phone size={18}/> {p.phone}</span>
        {p.guardian_name && <p>Resp: {p.guardian_name}</p>}
        {p.notes && <em>{p.notes}</em>}
        <small>{appointments.filter(a=>a.patient_id===p.id).length} consulta(s)</small>
      </article>)}
    </div>
  </main>
}
function SettingsScreen({settings, onSave, patients, appointments}) {
  const [form,setForm] = useState(settings)
  useEffect(()=>setForm(settings),[settings])
  function update(k,v){ setForm({...form,[k]:v}) }
  function exportData(){
    const blob = new Blob([JSON.stringify({patients,appointments,settings}, null, 2)], {type:'application/json'})
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='backup-agenda-lena.json'; a.click()
  }
  return <main className="screen">
    <PageTitle kicker="CONFIGURAÇÕES" title="Ajustes" />
    <section className="settings-card"><h2>Dados da Clínica</h2>
      <label>Nome da clínica / profissional<input value={form.clinic_name||''} onChange={e=>update('clinic_name',e.target.value)} /></label>
      <div className="two"><label>Horário de início<select value={form.start_time} onChange={e=>update('start_time',e.target.value)}>{timeOpts().map(t=><option key={t}>{t}</option>)}</select></label><label>Horário de término<select value={form.end_time} onChange={e=>update('end_time',e.target.value)}>{timeOpts().map(t=><option key={t}>{t}</option>)}</select></label></div>
      <div className="two"><label>Duração padrão (min)<input type="number" value={form.default_duration||50} onChange={e=>update('default_duration',e.target.value)} /></label><label>Valor padrão (R$)<input type="number" value={form.default_price||200} onChange={e=>update('default_price',e.target.value)} /></label></div>
      <button className="primary wide" onClick={()=>onSave(form)}><Save/> Salvar Configurações</button>
    </section>
    <section className="settings-card tools"><h2>Ferramentas</h2><button onClick={exportData}><Download/> Exportar backup</button><button onClick={()=>window.print()}><Printer/> Imprimir agenda</button></section>
  </main>
}
function PatientModal({item,onClose,onSave}) {
  const [f,setF]=useState(item || {full_name:'',phone:'',guardian_name:'',email:'',age:'',notes:'',status:'ativo'})
  const u=(k,v)=>setF({...f,[k]:v})
  return <Modal title={item?'Editar Paciente':'Novo Paciente'} onClose={onClose}><label>Nome completo<input value={f.full_name||''} onChange={e=>u('full_name',e.target.value)} /></label><label>Telefone/WhatsApp<input value={f.phone||''} onChange={e=>u('phone',e.target.value)} /></label><label>Idade ou nascimento<input value={f.age||''} onChange={e=>u('age',e.target.value)} /></label><label>Responsável<input value={f.guardian_name||''} onChange={e=>u('guardian_name',e.target.value)} /></label><label>E-mail<input value={f.email||''} onChange={e=>u('email',e.target.value)} /></label><label>Status<select value={f.status||'ativo'} onChange={e=>u('status',e.target.value)}><option value="ativo">Ativo</option><option value="em_avaliacao">Em avaliação</option><option value="finalizado">Finalizado</option></select></label><label>Observações<textarea value={f.notes||''} onChange={e=>u('notes',e.target.value)} /></label><button className="primary wide" onClick={()=>onSave(f)}><Save/> Salvar</button></Modal>
}
function AppointmentModal({item,patients,selectedDate,settings,onClose,onSave,onCreatePatient}) {
  const [f,setF]=useState(item || {patient_id: patients[0]?.id || '', patient_name:'', patient_phone:'', appointment_date:selectedDate, appointment_time:'09:00', duration_minutes:settings.default_duration, service_type:'Avaliação', status:'agendada', payment_status:'pendente', price:settings.default_price, room:'Sala 1', notes:''})
  const u=(k,v)=>setF({...f,[k]:v})
  return <Modal title={item?'Editar Consulta':'Nova Consulta'} onClose={onClose}><label>Paciente<select value={f.patient_id||''} onChange={e=>u('patient_id',e.target.value)}><option value="">Selecionar paciente</option>{patients.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label><button className="ghost" onClick={onCreatePatient}><Plus/> Cadastrar novo paciente</button><div className="two"><label>Data<input type="date" value={f.appointment_date} onChange={e=>u('appointment_date',e.target.value)} /></label><label>Horário<input type="time" value={f.appointment_time?.slice(0,5)} onChange={e=>u('appointment_time',e.target.value)} /></label></div><div className="two"><label>Duração<input type="number" value={f.duration_minutes} onChange={e=>u('duration_minutes',e.target.value)} /></label><label>Valor<input type="number" value={f.price} onChange={e=>u('price',e.target.value)} /></label></div><label>Tipo<input value={f.service_type||''} onChange={e=>u('service_type',e.target.value)} /></label><div className="two"><label>Status<select value={f.status} onChange={e=>u('status',e.target.value)}><option value="agendada">Agendada</option><option value="confirmada">Confirmada</option><option value="realizada">Realizada</option><option value="faltou">Faltou</option><option value="cancelada">Cancelada</option></select></label><label>Pagamento<select value={f.payment_status} onChange={e=>u('payment_status',e.target.value)}><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="cortesia">Cortesia</option></select></label></div><label>Sala/local<input value={f.room||''} onChange={e=>u('room',e.target.value)} /></label><label>Observações<textarea value={f.notes||''} onChange={e=>u('notes',e.target.value)} /></label><button className="primary wide" onClick={()=>onSave(f)}><Save/> Salvar Consulta</button></Modal>
}
function Modal({title,children,onClose}) { return <div className="overlay"><section className="modal"><div className="modal-head"><h2>{title}</h2><button onClick={onClose}><X/></button></div>{children}</section></div> }
function Badge({type,children}) { return <span className={`badge ${type}`}>{children}</span> }
function Empty({text}) { return <div className="empty">{text}</div> }
function labelStatus(s){return {agendada:'Agendada',confirmada:'Confirmada',realizada:'Realizada',faltou:'Faltou',cancelada:'Cancelada'}[s]||s}
function labelPay(s){return {pago:'Pago',pendente:'Pendente',cortesia:'Cortesia'}[s]||s}
function labelPatient(s){return {ativo:'Ativo',em_avaliacao:'Em avaliação',finalizado:'Finalizado'}[s]||s}
function timeOpts(){ const arr=[]; for(let h=6;h<=22;h++) arr.push(`${String(h).padStart(2,'0')}:00`); return arr }

createRoot(document.getElementById('root')).render(<App />)
