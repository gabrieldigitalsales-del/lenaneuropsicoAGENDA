import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { CalendarDays, Clock3, Edit3, LogOut, MapPin, Phone, Plus, Save, Search, Settings, Sun, Trash2, UsersRound, History, ChevronLeft, ChevronRight, Download, Printer, X, MessageCircle, AlertTriangle, WalletCards, Repeat2, CheckCircle2 } from 'lucide-react'
import { hasSupabase, supabase } from './supabaseClient'
import './styles.css'

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || 'asd123'
const today = new Date()
const isoToday = toISODate(today)
const seedPatients = []
const seedAppointments = []
const defaultSettings = { id: 'main', clinic_name: 'AGENDA LENA NEUROPSICÓLOGA', start_time: '08:00', end_time: '18:00', default_duration: 50, default_price: '' }

function toISODate(date) {
  const d = new Date(date)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
function dateFromISO(iso){ return new Date(`${iso}T12:00:00`) }
function niceDate(date) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(dateFromISO(date)).replace(/^./, c => c.toUpperCase()).replace('-feira', '-Feira')
}
function monthTitle(date) { return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date).replace(/^./, c => c.toUpperCase()) }
function uid(prefix='id') { return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}` }
function loadLocal(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback } catch { return fallback } }
function saveLocal(key, data) { localStorage.setItem(key, JSON.stringify(data)) }
function normalizePhone(phone='') { return String(phone).replace(/\D/g, '') }
function whatsappUrl(phone, appointment = null, fallbackName = 'paciente') {
  const digits = normalizePhone(phone)
  if (!digits) return null
  const br = digits.startsWith('55') ? digits : `55${digits}`
  const patientName = appointment?.patient_name || appointment?.patient_name_snapshot || fallbackName || 'paciente'
  const dateText = appointment?.appointment_date ? formatDateBR(appointment.appointment_date) : ''
  const timeText = appointment?.appointment_time ? ` às ${String(appointment.appointment_time).slice(0,5)}` : ''
  const text = appointment
    ? `Olá *${patientName}*, passando para confirmar sua consulta com Lena Neuropsicóloga no dia *${dateText}${timeText}*.`
    : `Olá *${patientName}*, tudo bem?`
  return `https://wa.me/${br}?text=${encodeURIComponent(text)}`
}
function formatDateBR(iso){ return new Intl.DateTimeFormat('pt-BR').format(dateFromISO(iso)) }
function cleanForSupabase(record) {
  const clean = { ...record }
  delete clean.created_at
  delete clean.updated_at
  Object.keys(clean).forEach((key) => { if (clean[key] === '') clean[key] = null })
  return clean
}
function toNumberZero(value) {
  if (value === '' || value === null || value === undefined) return 0
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
function nullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
function addRecurrenceDate(iso, frequency, index) {
  const d = dateFromISO(iso)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7 * index)
  if (frequency === 'biweekly') d.setDate(d.getDate() + 14 * index)
  if (frequency === 'monthly') d.setMonth(d.getMonth() + index)
  return toISODate(d)
}
function makeRecurringAppointments(record, opts) {
  const repeat = opts?.repeat || 'none'
  const count = Math.max(1, toNumberZero(opts?.count || 1))
  if (repeat === 'none' || count <= 1 || record.id) return [record]
  const groupId = uid('rec')
  return Array.from({ length: count }, (_, i) => ({
    ...record,
    id: undefined,
    appointment_date: addRecurrenceDate(record.appointment_date, repeat, i),
    recurrence_group_id: groupId,
    recurrence_frequency: repeat,
    recurrence_index: i + 1,
    recurrence_total: count,
    recurrence_original_date: record.appointment_date
  }))
}
function showSupabaseError(action, error) { console.error(action, error); alert(`${action}: ${error?.message || 'erro desconhecido'}`) }

function App() {
  const [logged, setLogged] = useState(localStorage.getItem('lena_logged') === 'yes')
  if (!logged) return <Login onOk={() => { localStorage.setItem('lena_logged','yes'); setLogged(true) }} />
  return <AgendaApp onLogout={() => { localStorage.removeItem('lena_logged'); setLogged(false) }} />
}
function Login({ onOk }) {
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  function submit(e) { e.preventDefault(); if (pass === APP_PASSWORD) onOk(); else setErr('Senha incorreta') }
  return <main className="login-screen"><form className="login-card" onSubmit={submit}><div className="brand-login">AGENDA LENA<br/>NEUROPSICÓLOGA</div><p>Acesse sua agenda</p><input autoFocus type="password" placeholder="Digite a senha" value={pass} onChange={e=>setPass(e.target.value)} />{err && <span className="error">{err}</span>}<button>Entrar</button></form></main>
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
      if (p.error) { console.error('Erro ao carregar pacientes:', p.error); setPatients(loadLocal('lena_patients', seedPatients)) } else setPatients(p.data || [])
      if (a.error) { console.error('Erro ao carregar consultas:', a.error); setAppointments(loadLocal('lena_appointments', seedAppointments)) } else setAppointments(a.data || [])
      if (!s.error && s.data) setSettings(s.data); else setSettings(loadLocal('lena_settings', defaultSettings))
    } else {
      setPatients(loadLocal('lena_patients', seedPatients)); setAppointments(loadLocal('lena_appointments', seedAppointments)); setSettings(loadLocal('lena_settings', defaultSettings))
    }
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  async function savePatient(data) {
    const record = { ...data, full_name: (data.full_name || '').trim(), status: data.status || 'ativo' }
    if (!record.full_name) { alert('Digite o nome do paciente.'); return }
    if (hasSupabase) {
      const payload = cleanForSupabase(record)
      let result
      if (payload.id) { const { id, ...updatePayload } = payload; result = await supabase.from('lena_neuro_2026_patients').update(updatePayload).eq('id', id).select().single() }
      else result = await supabase.from('lena_neuro_2026_patients').insert(payload).select().single()
      if (result.error) { showSupabaseError('Não foi possível salvar o paciente no Supabase', result.error); return }
      await refresh()
    } else {
      let list = [...patients]; if (record.id) list = list.map(p => p.id === record.id ? record : p); else list.push({ ...record, id: uid('p') })
      setPatients(list); saveLocal('lena_patients', list)
    }
    setModal(null)
  }
  async function deletePatient(id) {
    if (!confirm('Excluir paciente? As consultas dele serão mantidas sem vínculo.')) return
    if (hasSupabase) { const { error } = await supabase.from('lena_neuro_2026_patients').delete().eq('id', id); if (error) { alert('Não foi possível excluir o paciente: ' + error.message); return }; await refresh() }
    else { const list = patients.filter(p=>p.id!==id); const listA = appointments.map(a=>a.patient_id===id?{...a,patient_id:null}:a); setPatients(list); setAppointments(listA); saveLocal('lena_patients', list); saveLocal('lena_appointments', listA) }
  }
  function detectConflicts(records) {
    return records.filter(r => appointments.some(a => a.id !== r.id && a.appointment_date === r.appointment_date && String(a.appointment_time).slice(0,5) === String(r.appointment_time).slice(0,5) && !['cancelada'].includes(a.status)))
  }
  async function saveAppointment(data, recurrenceOpts={repeat:'none', count:1}) {
    const patient = patients.find(p => p.id === data.patient_id)
    const record = {
      ...data,
      patient_id: data.patient_id || null,
      patient_name: patient?.full_name || data.patient_name || '',
      patient_phone: patient?.phone || data.patient_phone || '',
      patient_name_snapshot: patient?.full_name || data.patient_name || '',
      patient_phone_snapshot: patient?.phone || data.patient_phone || '',
      price: nullableNumber(data.price),
      duration_minutes: toNumberZero(data.duration_minutes),
      status: data.status || 'agendada',
      payment_status: data.payment_status || 'pendente',
      service_type: data.service_type || 'Avaliação'
    }
    if (!record.patient_name) { alert('Selecione ou cadastre um paciente antes de salvar a consulta.'); return }
    if (!record.appointment_date || !record.appointment_time) { alert('Informe data e horário da consulta.'); return }
    const records = makeRecurringAppointments(record, recurrenceOpts)
    const conflicts = detectConflicts(records)
    if (conflicts.length) {
      const msg = conflicts.slice(0,5).map(c => `${formatDateBR(c.appointment_date)} às ${String(c.appointment_time).slice(0,5)}`).join('\n')
      if (!confirm(`Já existe consulta nesse(s) horário(s):\n${msg}\n\nDeseja salvar mesmo assim?`)) return
    }
    if (hasSupabase) {
      const payloads = records.map(cleanForSupabase)
      let result
      if (record.id) { const { id, ...updatePayload } = payloads[0]; result = await supabase.from('lena_neuro_2026_appointments').update(updatePayload).eq('id', id).select().single() }
      else result = await supabase.from('lena_neuro_2026_appointments').insert(payloads).select()
      if (result.error) { showSupabaseError('Não foi possível salvar a consulta no Supabase', result.error); return }
      await refresh()
    } else {
      let list = [...appointments]
      if (record.id) list = list.map(a => a.id === record.id ? record : a)
      else list.push(...records.map(r => ({ ...r, id: uid('a') })))
      setAppointments(list); saveLocal('lena_appointments', list)
    }
    setModal(null)
  }
  async function updateRecurringGroup(item, updateData, scope) {
    if (!item.recurrence_group_id || scope === 'one') return saveAppointment({ ...item, ...updateData })
    const targets = appointments.filter(a => a.recurrence_group_id === item.recurrence_group_id && (scope === 'future' ? a.appointment_date >= item.appointment_date : true))
    if (!targets.length) return saveAppointment({ ...item, ...updateData })
    if (!confirm(`Alterar ${targets.length} consulta(s) desta recorrência?`)) return
    const changedDate = updateData.appointment_date && updateData.appointment_date !== item.appointment_date
    const changedTime = updateData.appointment_time && updateData.appointment_time !== item.appointment_time
    const updates = targets.map(t => ({
      ...t,
      ...updateData,
      id: t.id,
      appointment_date: changedDate ? addRecurrenceDate(updateData.appointment_date, item.recurrence_frequency, Math.max(0, (t.recurrence_index || 1) - (item.recurrence_index || 1))) : t.appointment_date,
      appointment_time: changedTime ? updateData.appointment_time : t.appointment_time,
      patient_name_snapshot: updateData.patient_name || t.patient_name || t.patient_name_snapshot,
      patient_phone_snapshot: updateData.patient_phone || t.patient_phone || t.patient_phone_snapshot
    }))
    if (hasSupabase) {
      for (const rec of updates) { const { id, ...payload } = cleanForSupabase(rec); const { error } = await supabase.from('lena_neuro_2026_appointments').update(payload).eq('id', id); if (error) { showSupabaseError('Erro ao atualizar recorrência', error); return } }
      await refresh()
    } else {
      const ids = new Set(updates.map(u=>u.id)); const map = Object.fromEntries(updates.map(u=>[u.id,u])); const list = appointments.map(a=>ids.has(a.id)?map[a.id]:a); setAppointments(list); saveLocal('lena_appointments', list)
    }
    setModal(null)
  }
  async function deleteAppointment(item) {
    let ids = [item.id]
    if (item.recurrence_group_id) {
      const scope = prompt('Esta consulta faz parte de uma recorrência. Digite:\n1 = excluir apenas esta\n2 = esta e próximas\n3 = toda a sequência', '1')
      if (scope === '2') ids = appointments.filter(a=>a.recurrence_group_id===item.recurrence_group_id && a.appointment_date >= item.appointment_date).map(a=>a.id)
      if (scope === '3') ids = appointments.filter(a=>a.recurrence_group_id===item.recurrence_group_id).map(a=>a.id)
    }
    if (!confirm(`Excluir ${ids.length} consulta(s)?`)) return
    if (hasSupabase) { const { error } = await supabase.from('lena_neuro_2026_appointments').delete().in('id', ids); if (error) { alert('Não foi possível excluir a consulta: ' + error.message); return }; await refresh() }
    else { const set = new Set(ids); const list = appointments.filter(a=>!set.has(a.id)); setAppointments(list); saveLocal('lena_appointments', list) }
  }
  async function saveSettings(data) {
    const record = { ...settings, ...data, id: 'main', default_duration: toNumberZero(data.default_duration), default_price: nullableNumber(data.default_price) }
    if (hasSupabase) { const { error } = await supabase.from('lena_neuro_2026_settings').upsert(cleanForSupabase(record), { onConflict: 'id' }); if (error) { showSupabaseError('Não foi possível salvar as configurações no Supabase', error); return }; await refresh() }
    else { setSettings(record); saveLocal('lena_settings', record) }
    alert('Configurações salvas')
  }

  const dayAppointments = appointments.filter(a => a.appointment_date === selectedDate).sort((a,b)=>String(a.appointment_time).localeCompare(String(b.appointment_time)))
  const todayAppointments = appointments.filter(a => a.appointment_date === isoToday).sort((a,b)=>String(a.appointment_time).localeCompare(String(b.appointment_time)))
  const pendingPayments = appointments.filter(a => a.payment_status === 'pendente' && a.status !== 'cancelada')
  const nextAppointment = todayAppointments.find(a => a.status !== 'cancelada' && String(a.appointment_time).slice(0,5) >= new Date().toTimeString().slice(0,5))

  return <div className="phone-app">
    <header className="topbar"><h1>AGENDA LENA<br/>NEUROPSICÓLOGA</h1><button className="icon-only" onClick={onLogout}><LogOut size={24}/></button></header>
    <div className={`connection-pill ${hasSupabase ? 'online' : 'local'}`}>{hasSupabase ? 'Supabase conectado' : 'Modo local: configure o .env para salvar online'}</div>
    {loading && <div className="loading">Carregando...</div>}
    {!loading && tab === 'hoje' && <TodayScreen selectedDate={isoToday} appointments={todayAppointments} pendingPayments={pendingPayments} nextAppointment={nextAppointment} onNew={()=>{setSelectedDate(isoToday); setModal({type:'appointment'})}} onEdit={(a)=>setModal({type:'appointment', item:a})} onDelete={deleteAppointment} />}
    {!loading && tab === 'agenda' && <CalendarScreen calendarMonth={calendarMonth} setCalendarMonth={setCalendarMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} appointments={appointments} dayAppointments={dayAppointments} onNew={()=>setModal({type:'appointment'})} onEdit={(a)=>setModal({type:'appointment', item:a})} onDelete={deleteAppointment} />}
    {!loading && tab === 'pacientes' && <PatientsScreen patients={patients} appointments={appointments} onNew={()=>setModal({type:'patient'})} onEdit={(p)=>setModal({type:'patient', item:p})} onDelete={deletePatient} />}
    {!loading && tab === 'ajustes' && <SettingsScreen settings={settings} onSave={saveSettings} patients={patients} appointments={appointments} pendingPayments={pendingPayments} />}
    <nav className="bottom-nav"><button className={tab==='hoje'?'active':''} onClick={()=>setTab('hoje')}><Sun/><span>Hoje</span></button><button className={tab==='agenda'?'active':''} onClick={()=>setTab('agenda')}><CalendarDays/><span>Agenda</span></button><button className={tab==='pacientes'?'active':''} onClick={()=>setTab('pacientes')}><UsersRound/><span>Pacientes</span></button><button className={tab==='ajustes'?'active':''} onClick={()=>setTab('ajustes')}><Settings/><span>Ajustes</span></button></nav>
    {modal?.type === 'patient' && <PatientModal item={modal.item} onClose={()=>setModal(null)} onSave={savePatient} />}
    {modal?.type === 'appointment' && <AppointmentModal item={modal.item} patients={patients} selectedDate={selectedDate} settings={settings} onClose={()=>setModal(null)} onSave={saveAppointment} onUpdateGroup={updateRecurringGroup} />}
  </div>
}

function PageTitle({kicker,title,action}) { return <section className="page-title"><span>{kicker}</span><div><h2>{title}</h2>{action}</div></section> }
function StatsRow({appointments, pendingPayments, nextAppointment}) { return <section className="stats-row"><div><b>{appointments.length}</b><span>consultas hoje</span></div><div><b>{pendingPayments.length}</b><span>pendências</span></div><div><b>{nextAppointment ? String(nextAppointment.appointment_time).slice(0,5) : '--:--'}</b><span>próxima</span></div></section> }
function TodayScreen({ selectedDate, appointments, pendingPayments, nextAppointment, onNew, onEdit, onDelete }) {
  return <main className="screen today-screen"><PageTitle kicker="HOJE" title={niceDate(selectedDate)} />
    <section className="today-hero">
      <div><span>Resumo do dia</span><h3>{appointments.length ? `${appointments.length} consulta${appointments.length > 1 ? 's' : ''} hoje` : 'Agenda livre hoje'}</h3><p>{nextAppointment ? `Próxima: ${nextAppointment.patient_name} às ${String(nextAppointment.appointment_time).slice(0,5)}` : 'Nenhuma consulta marcada para hoje.'}</p></div>
      <button className="primary" onClick={onNew}><Plus/> Nova Consulta</button>
    </section>
    <StatsRow appointments={appointments} pendingPayments={pendingPayments} nextAppointment={nextAppointment}/>
    {nextAppointment && <div className="soft-alert"><AlertTriangle size={18}/> Próxima consulta: <b>{nextAppointment.patient_name}</b> às <b>{String(nextAppointment.appointment_time).slice(0,5)}</b></div>}
    <div className="section-label">Consultas de hoje</div>
    <div className="cards-list today-list">{appointments.length ? appointments.map(a => <AppointmentCard key={a.id} a={a} onEdit={()=>onEdit(a)} onDelete={()=>onDelete(a)} />) : <Empty text="Nenhuma consulta hoje." />}</div>
    {pendingPayments.length > 0 && <section className="settings-card pending-card"><h2><WalletCards size={18}/> Pagamentos pendentes</h2>{pendingPayments.slice(0,5).map(a=><p key={a.id} className="pending-line">{formatDateBR(a.appointment_date)} • {a.patient_name} • R$ {Number(a.price||0).toFixed(2)}</p>)}</section>}
  </main>
}
function AppointmentCard({a,onEdit,onDelete}) {
  const w = whatsappUrl(a.patient_phone || a.patient_phone_snapshot, a)
  return <article className="appointment-card"><div className="card-actions"><button onClick={onEdit}><Edit3/></button><button onClick={onDelete}><Trash2/></button></div><div className="time-row"><strong>{String(a.appointment_time||'').slice(0,5)}</strong><span><Clock3 size={18}/> {a.duration_minutes} min</span></div><h3>{a.patient_name || a.patient_name_snapshot}</h3><div className="meta"><span><Phone size={18}/> {a.patient_phone || a.patient_phone_snapshot || 'Sem telefone'}</span><span>{a.service_type}</span></div><div className="badges"><Badge type={a.status}>{labelStatus(a.status)}</Badge><Badge type={a.payment_status}>{labelPay(a.payment_status)}</Badge>{a.recurrence_group_id && <Badge type="recorrente"><Repeat2 size={13}/> {labelRepeat(a.recurrence_frequency)}</Badge>}<span className="price">R$ {Number(a.price||0).toFixed(2)}</span></div>{a.notes && <p>{a.notes}</p>}<div className="quick-row">{w && <a className="whatsapp-btn" href={w} target="_blank" rel="noreferrer"><MessageCircle size={16}/> WhatsApp</a>}</div></article>
}
function CalendarScreen({ calendarMonth, setCalendarMonth, selectedDate, setSelectedDate, appointments, dayAppointments, onNew, onEdit, onDelete }) {
  return <main className="screen"><div className="month-head"><button onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()-1, 1))}><ChevronLeft/></button><h2>{monthTitle(calendarMonth)}</h2><button onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()+1, 1))}><ChevronRight/></button></div><CalendarGrid month={calendarMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} appointments={appointments} /><div className="day-head"><h2>{niceDate(selectedDate)}</h2><button className="primary small" onClick={onNew}><Plus/> Nova Consulta</button></div><div className="cards-list agenda-day">{dayAppointments.length ? dayAppointments.map(a => <AppointmentCard key={a.id} a={a} onEdit={()=>onEdit(a)} onDelete={()=>onDelete(a)} />) : <Empty text="Nenhuma consulta neste dia." />}</div></main>
}
function CalendarGrid({month, selectedDate, setSelectedDate, appointments}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1); const start = new Date(first); start.setDate(start.getDate() - start.getDay())
  const days = Array.from({length: 42}, (_,i)=> { const d=new Date(start); d.setDate(start.getDate()+i); return d })
  const week = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB']
  return <div className="calendar-card">{week.map(w=><b key={w}>{w}</b>)}{days.map(d => { const iso = toISODate(d), inMonth = d.getMonth() === month.getMonth(), count = appointments.filter(a=>a.appointment_date===iso).length; return <button key={iso} className={`${iso===selectedDate?'selected':''} ${!inMonth?'muted':''}`} onClick={()=>setSelectedDate(iso)}><span>{d.getDate()}</span>{count>0 && <i>{Array.from({length: Math.min(count,3)}).map((_,i)=><em key={i}/>)}</i>}</button> })}</div>
}
function PatientsScreen({patients, appointments, onNew, onEdit, onDelete}) {
  const [q,setQ]=useState('')
  const filtered = patients.filter(p => `${p.full_name} ${p.phone} ${p.whatsapp}`.toLowerCase().includes(q.toLowerCase()))
  return <main className="screen"><PageTitle kicker="PACIENTES" title="Meus Pacientes" /><div className="search-row"><label><Search/><input placeholder="Buscar por nome ou telefone..." value={q} onChange={e=>setQ(e.target.value)} /></label><button className="square" onClick={onNew}><Plus/></button></div><div className="cards-list">{filtered.map(p => <PatientCard key={p.id} p={p} appointments={appointments.filter(a=>a.patient_id===p.id)} onEdit={()=>onEdit(p)} onDelete={()=>onDelete(p.id)} />)}</div></main>
}
function PatientCard({p, appointments, onEdit, onDelete}) {
  const next = appointments.filter(a=>a.appointment_date >= isoToday && a.status !== 'cancelada').sort((a,b)=>a.appointment_date.localeCompare(b.appointment_date))[0]
  const done = appointments.filter(a=>a.status==='realizada').length
  const missed = appointments.filter(a=>a.status==='faltou').length
  const pending = appointments.filter(a=>a.payment_status==='pendente' && a.status!=='cancelada').length
  const w = whatsappUrl(p.phone || p.whatsapp, null, p.full_name)
  return <article className="patient-card"><div className="patient-main"><h3>{p.full_name}</h3><Badge type={p.status}>{labelPatient(p.status)}</Badge></div><div className="patient-actions"><button onClick={onEdit}><Edit3/></button><button onClick={onDelete}><Trash2/></button></div><span className="phone-line"><Phone size={18}/> {p.phone || p.whatsapp || 'Sem telefone'}</span>{p.guardian_name && <p>Resp: {p.guardian_name}</p>}{p.notes && <em>{p.notes}</em>}<div className="history-grid"><span><b>{appointments.length}</b> total</span><span><b>{done}</b> realizadas</span><span><b>{missed}</b> faltas</span><span><b>{pending}</b> pendências</span></div>{next && <small>Próxima: {formatDateBR(next.appointment_date)} às {String(next.appointment_time).slice(0,5)}</small>}<div className="quick-row">{w && <a className="whatsapp-btn" href={w} target="_blank" rel="noreferrer"><MessageCircle size={16}/> WhatsApp</a>}</div></article>
}
function SettingsScreen({settings, onSave, patients, appointments, pendingPayments}) {
  const [form,setForm] = useState(settings); useEffect(()=>setForm(settings),[settings]); function update(k,v){ setForm({...form,[k]:v}) }
  function exportData(){ const blob = new Blob([JSON.stringify({patients,appointments,settings}, null, 2)], {type:'application/json'}); const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='backup-agenda-lena.json'; a.click() }
  return <main className="screen"><PageTitle kicker="CONFIGURAÇÕES" title="Ajustes" /><section className="settings-card"><h2>Resumo rápido</h2><div className="history-grid"><span><b>{patients.length}</b> pacientes</span><span><b>{appointments.length}</b> consultas</span><span><b>{pendingPayments.length}</b> pendentes</span><span><b>{appointments.filter(a=>a.recurrence_group_id).length}</b> recorrentes</span></div></section><section className="settings-card"><h2>Dados da Clínica</h2><label>Nome da clínica / profissional<input value={form.clinic_name||''} onChange={e=>update('clinic_name',e.target.value)} /></label><div className="two"><label>Horário de início<select value={form.start_time} onChange={e=>update('start_time',e.target.value)}>{timeOpts().map(t=><option key={t}>{t}</option>)}</select></label><label>Horário de término<select value={form.end_time} onChange={e=>update('end_time',e.target.value)}>{timeOpts().map(t=><option key={t}>{t}</option>)}</select></label></div><div className="two"><label>Duração padrão (min)<input type="number" min="0" step="1" placeholder="Ex: 50" value={form.default_duration ?? ''} onChange={e=>update('default_duration',e.target.value)} /></label><label>Valor padrão (R$)<input type="number" min="0" step="0.01" placeholder="Ex: 500" value={form.default_price ?? ''} onChange={e=>update('default_price',e.target.value)} /></label></div><button className="primary wide" onClick={()=>onSave(form)}><Save/> Salvar Configurações</button></section><section className="settings-card tools"><h2>Ferramentas</h2><button onClick={exportData}><Download/> Exportar backup</button><button onClick={()=>window.print()}><Printer/> Imprimir agenda</button></section></main>
}
function PatientModal({item,onClose,onSave}) { const [f,setF]=useState(item || {full_name:'',phone:'',guardian_name:'',email:'',age:'',notes:'',status:'ativo'}); const u=(k,v)=>setF({...f,[k]:v}); return <Modal title={item?'Editar Paciente':'Novo Paciente'} onClose={onClose}><label>Nome completo<input value={f.full_name||''} onChange={e=>u('full_name',e.target.value)} /></label><label>Telefone/WhatsApp<input value={f.phone||''} onChange={e=>u('phone',e.target.value)} /></label><label>Idade ou nascimento<input value={f.age||''} onChange={e=>u('age',e.target.value)} /></label><label>Responsável<input value={f.guardian_name||''} onChange={e=>u('guardian_name',e.target.value)} /></label><label>E-mail<input value={f.email||''} onChange={e=>u('email',e.target.value)} /></label><label>Status<select value={f.status||'ativo'} onChange={e=>u('status',e.target.value)}><option value="ativo">Ativo</option><option value="em_avaliacao">Em avaliação</option><option value="finalizado">Finalizado</option><option value="inativo">Inativo</option></select></label><label>Observações<textarea value={f.notes||''} onChange={e=>u('notes',e.target.value)} /></label><button className="primary wide" onClick={()=>onSave(f)}><Save/> Salvar</button></Modal> }
function AppointmentModal({item,patients,selectedDate,settings,onClose,onSave,onUpdateGroup}) {
  const [f,setF]=useState(item || {patient_id: patients[0]?.id || '', patient_name:'', patient_phone:'', appointment_date:selectedDate, appointment_time:'09:00', duration_minutes:settings.default_duration ?? 50, service_type:'Avaliação', status:'agendada', payment_status:'pendente', price:settings.default_price ?? '', room:'Sala 1', notes:''})
  const [repeat,setRepeat]=useState('none'); const [count,setCount]=useState(4); const [scope,setScope]=useState('one')
  const u=(k,v)=>setF({...f,[k]:v})
  const selectedPatient = patients.find(p=>p.id===f.patient_id)
  function save(){ if (item?.recurrence_group_id && scope !== 'one') { onUpdateGroup(item, {...f, patient_name:selectedPatient?.full_name || f.patient_name, patient_phone:selectedPatient?.phone || f.patient_phone}, scope); return } onSave(f, { repeat, count }) }
  return <Modal title={item?'Editar Consulta':'Nova Consulta'} onClose={onClose}><label>Paciente<select value={f.patient_id||''} onChange={e=>u('patient_id',e.target.value)}><option value="">Selecionar paciente</option>{patients.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label><p className="form-hint">Cadastre o paciente na aba Pacientes antes de marcar a consulta.</p><div className="two"><label>Data<input type="date" value={f.appointment_date} onChange={e=>u('appointment_date',e.target.value)} /></label><label>Horário<input type="time" value={String(f.appointment_time||'').slice(0,5)} onChange={e=>u('appointment_time',e.target.value)} /></label></div><div className="two"><label>Duração<input type="number" min="0" step="1" placeholder="Ex: 50" value={f.duration_minutes ?? ''} onChange={e=>u('duration_minutes',e.target.value)} /></label><label>Valor<input type="number" min="0" step="0.01" placeholder="Ex: 500" value={f.price ?? ''} onChange={e=>u('price',e.target.value)} /></label></div>{!item && <section className="recurrence-box"><h3><Repeat2 size={16}/> Repetir consulta</h3><label>Recorrência<select value={repeat} onChange={e=>setRepeat(e.target.value)}><option value="none">Não repetir</option><option value="weekly">Semanal</option><option value="biweekly">Quinzenal</option><option value="monthly">Mensal</option></select></label>{repeat !== 'none' && <label>Quantidade de sessões<input type="number" min="1" step="1" value={count} onChange={e=>setCount(e.target.value)} /></label>}</section>}{item?.recurrence_group_id && <section className="recurrence-box"><h3><Repeat2 size={16}/> Consulta recorrente</h3><label>Aplicar alteração em:<select value={scope} onChange={e=>setScope(e.target.value)}><option value="one">Apenas esta consulta</option><option value="future">Esta e próximas</option><option value="all">Toda a sequência</option></select></label></section>}<label>Tipo<input value={f.service_type||''} onChange={e=>u('service_type',e.target.value)} /></label><div className="two"><label>Status<select value={f.status} onChange={e=>u('status',e.target.value)}><option value="agendada">Agendada</option><option value="aguardando_confirmacao">Aguardando confirmação</option><option value="confirmada">Confirmada</option><option value="realizada">Realizada</option><option value="remarcada">Remarcada</option><option value="faltou">Faltou</option><option value="cancelada">Cancelada</option></select></label><label>Pagamento<select value={f.payment_status} onChange={e=>u('payment_status',e.target.value)}><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="cortesia">Cortesia</option></select></label></div><label>Observações<textarea value={f.notes||''} onChange={e=>u('notes',e.target.value)} /></label><button className="primary wide" onClick={save}><Save/> Salvar Consulta</button></Modal>
}
function Modal({title,children,onClose}) { return <div className="overlay"><section className="modal"><div className="modal-head"><h2>{title}</h2><button onClick={onClose}><X/></button></div>{children}</section></div> }
function Badge({type,children}) { return <span className={`badge ${type}`}>{children}</span> }
function Empty({text}) { return <div className="empty">{text}</div> }
function labelStatus(s){return {agendada:'Agendada',aguardando_confirmacao:'Aguardando confirmação',confirmada:'Confirmada',realizada:'Realizada',remarcada:'Remarcada',faltou:'Faltou',cancelada:'Cancelada'}[s]||s}
function labelPay(s){return {pago:'Pago',pendente:'Pendente',cortesia:'Cortesia'}[s]||s}
function labelPatient(s){return {ativo:'Ativo',em_avaliacao:'Em avaliação',finalizado:'Finalizado',inativo:'Inativo'}[s]||s}
function labelRepeat(s){return {weekly:'Semanal',biweekly:'Quinzenal',monthly:'Mensal'}[s]||'Recorrente'}
function timeOpts(){ const arr=[]; for(let h=6;h<=22;h++) arr.push(`${String(h).padStart(2,'0')}:00`); return arr }

createRoot(document.getElementById('root')).render(<App />)
