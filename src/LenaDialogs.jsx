import React, { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

export function showNotice(message, title = 'Agenda Lena') {
  window.dispatchEvent(new CustomEvent('lena:dialog', { detail: { kind: 'notice', title, message } }))
}
export function askConfirmation(message, title = 'Confirmar ação') {
  return new Promise(resolve => window.dispatchEvent(new CustomEvent('lena:dialog', { detail: { kind: 'confirm', title, message, resolve } })))
}
export function askChoice(message, options, title = 'Escolha uma opção') {
  return new Promise(resolve => window.dispatchEvent(new CustomEvent('lena:dialog', { detail: { kind: 'choice', title, message, options, resolve } })))
}
export function LenaDialogHost() {
  const [dialog, setDialog] = useState(null)
  useEffect(() => {
    const listener = event => setDialog(current => { if (current?.resolve) current.resolve(null); return event.detail })
    window.addEventListener('lena:dialog', listener)
    return () => window.removeEventListener('lena:dialog', listener)
  }, [])
  if (!dialog) return null
  const finish = value => {
    const resolver = dialog.resolve
    setDialog(null)
    resolver?.(value)
  }
  return <div className="lena-popup-backdrop">
    <style>{`
      .lena-popup-backdrop{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(36,29,25,.55);backdrop-filter:blur(5px)}
      .lena-popup-box{width:min(430px,100%);max-height:88vh;overflow-y:auto;background:#fffcf8;border:1px solid #e8ded3;border-radius:22px;padding:27px 23px;box-shadow:0 24px 75px rgba(35,23,15,.22);text-align:center;animation:lena-popup-in .18s ease-out}
      .lena-popup-icon{width:52px;height:52px;margin:0 auto 14px;border-radius:16px;display:grid;place-items:center;background:#f1e8dd;color:#846b56}
      .lena-popup-box h2{font-size:19px;line-height:1.3;color:#41362d;margin:0 0 10px;font-weight:800}
      .lena-popup-box p{font-size:13px;color:#76695e;line-height:1.6;white-space:pre-line;margin:0 0 23px}
      .lena-popup-buttons{display:flex;flex-wrap:wrap;gap:9px}
      .lena-popup-buttons button{min-height:44px;border:0;border-radius:12px;font-size:12px;font-weight:800;padding:12px 16px;cursor:pointer;flex:1}
      .lena-popup-main{background:#806650;color:white}
      .lena-popup-secondary{background:#f2ece5;color:#5c4a3e}
      .lena-popup-choice{flex-basis:100%!important;text-align:left;background:#f1e9df;color:#594739}
      @keyframes lena-popup-in{from{transform:translateY(10px) scale(.98);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
    `}</style>
    <section className="lena-popup-box" role="dialog" aria-modal="true" aria-labelledby="lena-popup-title">
      <div className="lena-popup-icon">{dialog.kind === 'notice' ? <CheckCircle2 size={23}/> : <AlertTriangle size={23}/>}</div>
      <h2 id="lena-popup-title">{dialog.title}</h2>
      <p>{dialog.message}</p>
      <div className="lena-popup-buttons">
        {dialog.kind === 'choice' ? <>
          {dialog.options.map(option => <button key={option.value} className="lena-popup-choice" onClick={() => finish(option.value)}>{option.label}</button>)}
          <button className="lena-popup-secondary" onClick={() => finish(null)}>Cancelar</button>
        </> : dialog.kind === 'confirm' ? <>
          <button className="lena-popup-secondary" onClick={() => finish(false)}>Cancelar</button>
          <button className="lena-popup-main" onClick={() => finish(true)}>Confirmar</button>
        </> : <button className="lena-popup-main" onClick={() => finish(true)}>Entendi</button>}
      </div>
    </section>
  </div>
}
