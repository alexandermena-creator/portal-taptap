import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart3, Briefcase, Calendar, Plus, DollarSign, Users, Target,
  CheckCircle2, XCircle, Clock, Edit2, Download, UserCircle, ShieldAlert,
  LogOut, Mail, Lock, Settings, UserPlus, Trash2, Key, Eye, EyeOff, User
} from 'lucide-react';

// --- 1. CONEXIÓN A FIREBASE ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD92CDTTcEh_BJ53q8q0TXtFtO0Fj29u2w",
  authDomain: "gestion-comercial-taptap.firebaseapp.com",
  projectId: "gestion-comercial-taptap",
  storageBucket: "gestion-comercial-taptap.firebasestorage.app",
  messagingSenderId: "1001662665656",
  appId: "1:1001662665656:web:4391d323fa90e3d10e354d",
  measurementId: "G-YN82X8O8ZK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- 2. DATOS INICIALES (Agencias Personalizadas) ---
const ESTATUS = ['Enviada', 'Cerrada', 'Perdida'];

const USUARIOS_INICIALES = [
  { email: 'berenisse.lopez@taptapdigital.com', rol: 'comercial', nombre: 'Berenisse López', password: 'TapTap2026', agencias: ['Publicis', 'WPP', 'Mid Market'] },
  { email: 'david.vanegas@taptapdigital.com', rol: 'comercial', nombre: 'David Vanegas', password: 'TapTap2026', agencias: ['OMG', 'IPG', 'Mid Market'] },
  { email: 'alberto.bautista@taptapdigital.com', rol: 'jefe', nombre: 'Alberto Bautista', password: 'TapTap2026', agencias: ['Dentsu', 'Havas', 'Publicis', 'WPP', 'OMG', 'IPG', 'Mid Market'] },
  { email: 'javier.velazquez@taptapdigital.com', rol: 'jefe', nombre: 'Javier Velázquez', password: 'TapTap2026', agencias: ['Dentsu', 'Havas', 'Publicis', 'WPP', 'OMG', 'IPG', 'Mid Market'] },
  { email: 'javier.ormazabal@taptapdigital.com', rol: 'jefe', nombre: 'Javier Ormazabal', password: 'TapTap2026', agencias: ['Dentsu', 'Havas', 'Publicis', 'WPP', 'OMG', 'IPG', 'Mid Market'] },
  { email: 'alexander.mena@taptapdigital.com', rol: 'admin', nombre: 'Alexander Mena', password: 'TapTap2026', agencias: ['Dentsu', 'Havas', 'Mid Market'] }
];

const obtenerRangoSemana = (fechaString) => {
  if (!fechaString) return '';
  const [year, month, day] = fechaString.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const diaSemana = d.getDay(); 
  const diferenciaLunes = d.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
  const lunes = new Date(new Date(d).setDate(diferenciaLunes));
  const viernes = new Date(new Date(lunes).setDate(lunes.getDate() + 4));
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  if (meses[lunes.getMonth()] === meses[viernes.getMonth()]) {
    return `${lunes.getDate()} al ${viernes.getDate()} de ${meses[lunes.getMonth()]}`;
  } else {
    return `${lunes.getDate()} de ${meses[lunes.getMonth()]} al ${viernes.getDate()} de ${meses[viernes.getMonth()]}`;
  }
};

// --- 3. APLICACIÓN PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [perfil, setPerfil] = useState(null); 
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  const [solicitandoAcceso, setSolicitandoAcceso] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [filtroSemana, setFiltroSemana] = useState('Todas');
  const [filtroVendedor, setFiltroVendedor] = useState('Todos');

  const [propuestasGlobales, setPropuestasGlobales] = useState([]);
  const [citasGlobales, setCitasGlobales] = useState([]);
  const [usuariosGlobales, setUsuariosGlobales] = useState([]);
  const [solicitudesGlobales, setSolicitudesGlobales] = useState([]);

  const [fechaPropuesta, setFechaPropuesta] = useState('');
  const [fechaCita, setFechaCita] = useState('');
  const [formPropuesta, setFormPropuesta] = useState({ semana: '', agencia: '', nombre: '', montoEnviado: '', estatus: 'Enviada', montoCerrado: '' });
  const [formCita, setFormCita] = useState({ semana: '', agencia: '', persona: '', cuenta: '' });
  const [editingPropuestaId, setEditingPropuestaId] = useState(null);
  
  const [formUsuario, setFormUsuario] = useState({ email: '', nombre: '', rol: 'comercial', password: '', agencias: '' });
  const [nuevaContra, setNuevaContra] = useState('');

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubPropuestas = onSnapshot(collection(db, 'propuestas'), snapshot => setPropuestasGlobales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.createdAt - a.createdAt)));
    const unsubCitas = onSnapshot(collection(db, 'citas'), snapshot => setCitasGlobales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.createdAt - a.createdAt)));
    const unsubUsuarios = onSnapshot(collection(db, 'usuarios'), snapshot => setUsuariosGlobales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubSolicitudes = onSnapshot(collection(db, 'solicitudes'), snapshot => setSolicitudesGlobales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

    return () => { unsubPropuestas(); unsubCitas(); unsubUsuarios(); unsubSolicitudes(); };
  }, [user]);

  const misPropuestas = useMemo(() => ['jefe', 'admin'].includes(perfil) ? propuestasGlobales : propuestasGlobales.filter(p => p.vendedor === nombreUsuario), [propuestasGlobales, perfil, nombreUsuario]);
  const misCitas = useMemo(() => ['jefe', 'admin'].includes(perfil) ? citasGlobales : citasGlobales.filter(c => c.vendedor === nombreUsuario), [citasGlobales, perfil, nombreUsuario]);
  const semanasDisponibles = useMemo(() => [...new Set([...misPropuestas.map(p => p.semana), ...misCitas.map(c => c.semana)])].filter(Boolean), [misPropuestas, misCitas]);
  const vendedoresDisponibles = useMemo(() => ['jefe', 'admin'].includes(perfil) ? [...new Set([...propuestasGlobales.map(p => p.vendedor), ...citasGlobales.map(c => c.vendedor)])].filter(Boolean) : [], [propuestasGlobales, citasGlobales, perfil]);
  
  // Extraer las agencias dinámicamente
  const currentUserData = useMemo(() => usuariosGlobales.find(u => u.email === currentEmail), [usuariosGlobales, currentEmail]);
  const agenciasDelUsuario = useMemo(() => currentUserData?.agencias || [], [currentUserData]);
  const todasLasAgencias = useMemo(() => [...new Set(usuariosGlobales.flatMap(u => u.agencias || []))], [usuariosGlobales]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(''); setMensajeExito('');
    const correoLimpiado = emailInput.trim().toLowerCase();
    if (!correoLimpiado.endsWith('@taptapdigital.com')) return setLoginError('Solo correos @taptapdigital.com permitidos.');

    if (correoLimpiado === 'alexander.mena@taptapdigital.com' && usuariosGlobales.length === 0) {
      try {
        for (const u of USUARIOS_INICIALES) await setDoc(doc(db, 'usuarios', u.email), u);
        setPerfil('admin'); setNombreUsuario('Alexander Mena'); setCurrentEmail(correoLimpiado);
        return;
      } catch (error) { console.error("Error BD:", error); }
    }

    const usuarioAutorizado = usuariosGlobales.find(u => u.email === correoLimpiado);
    if (usuarioAutorizado) {
      if (usuarioAutorizado.password === passwordInput) {
        setPerfil(usuarioAutorizado.rol); setNombreUsuario(usuarioAutorizado.nombre); setCurrentEmail(correoLimpiado);
        setSolicitandoAcceso(false); setPasswordInput('');
      } else { setLoginError('Contraseña incorrecta.'); }
    } else {
      setLoginError('Correo no registrado.'); setSolicitandoAcceso(true);
    }
  };

  const handleSolicitarAcceso = async () => {
    try {
      if (solicitudesGlobales.some(s => s.email === emailInput.trim().toLowerCase())) return setLoginError('Solicitud ya enviada.');
      await addDoc(collection(db, 'solicitudes'), { email: emailInput.trim().toLowerCase(), fecha: Date.now() });
      setMensajeExito('Solicitud enviada.'); setSolicitandoAcceso(false); setLoginError('');
    } catch (error) { console.error("Error:", error); }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (formUsuario.password.length < 6) return alert('La contraseña debe tener 6 caracteres');
    const arregloAgencias = formUsuario.agencias.split(',').map(a => a.trim()).filter(Boolean);
    try {
      await setDoc(doc(db, 'usuarios', formUsuario.email.trim().toLowerCase()), { ...formUsuario, email: formUsuario.email.trim().toLowerCase(), agencias: arregloAgencias });
      setFormUsuario({ email: '', nombre: '', rol: 'comercial', password: '', agencias: '' });
      alert('Usuario guardado.');
    } catch (error) { console.error(error); }
  };

  const handleAprobarSolicitud = async (solicitud) => {
    setFormUsuario({ email: solicitud.email, nombre: '', rol: 'comercial', password: '', agencias: '' });
    await deleteDoc(doc(db, 'solicitudes', solicitud.id));
    alert("Procesando... Asigna Nombre, Rol, Agencias y Contraseña.");
  };

  const handleCambiarContra = async (e) => {
    e.preventDefault();
    if(nuevaContra.length < 6) return alert('Debe tener al menos 6 caracteres.');
    try {
      await updateDoc(doc(db, 'usuarios', currentEmail), { password: nuevaContra });
      setNuevaContra('');
      alert('Contraseña actualizada con éxito.');
    } catch(err) { console.error(err); }
  };

  const handleSubmitPropuesta = async (e) => {
    e.preventDefault();
    const data = { ...formPropuesta, fechaCruda: fechaPropuesta, vendedor: nombreUsuario, createdAt: Date.now(), agencia: formPropuesta.agencia || agenciasDelUsuario[0] };
    if (editingPropuestaId) { await updateDoc(doc(db, 'propuestas', editingPropuestaId), data); setEditingPropuestaId(null); } 
    else { await addDoc(collection(db, 'propuestas'), data); }
    setFormPropuesta({ semana: '', agencia: agenciasDelUsuario[0], nombre: '', montoEnviado: '', estatus: 'Enviada', montoCerrado: '' }); setFechaPropuesta('');
  };

  const handleAddCita = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'citas'), { ...formCita, fechaCruda: fechaCita, vendedor: nombreUsuario, createdAt: Date.now(), agencia: formCita.agencia || agenciasDelUsuario[0] });
    setFormCita({ semana: '', agencia: agenciasDelUsuario[0], persona: '', cuenta: '' }); setFechaCita('');
  };

  const handleExportCSV = () => {
    let csv = "data:text/csv;charset=utf-8,\uFEFF";
    csv += "--- PROPUESTAS ---\r\n" + (['jefe', 'admin'].includes(perfil) ? "Semana,Fecha,Vendedor,Agencia,Proyecto,Enviado,Estatus,Cerrado\r\n" : "Semana,Fecha,Agencia,Proyecto,Enviado,Estatus,Cerrado\r\n");
    misPropuestas.filter(p => (filtroSemana === 'Todas' || p.semana === filtroSemana) && (['comercial'].includes(perfil) || filtroVendedor === 'Todos' || p.vendedor === filtroVendedor)).forEach(p => {
      csv += ['jefe', 'admin'].includes(perfil) ? `"${p.semana}","${p.fechaCruda||''}","${p.vendedor}","${p.agencia}","${p.nombre}",${p.montoEnviado},"${p.estatus}",${p.montoCerrado||0}\r\n` : `"${p.semana}","${p.fechaCruda||''}","${p.agencia}","${p.nombre}",${p.montoEnviado},"${p.estatus}",${p.montoCerrado||0}\r\n`;
    });
    csv += "\r\n--- REUNIONES ---\r\n" + (['jefe', 'admin'].includes(perfil) ? "Semana,Fecha,Vendedor,Agencia,Contacto,Cuenta\r\n" : "Semana,Fecha,Agencia,Contacto,Cuenta\r\n");
    misCitas.filter(c => (filtroSemana === 'Todas' || c.semana === filtroSemana) && (['comercial'].includes(perfil) || filtroVendedor === 'Todos' || c.vendedor === filtroVendedor)).forEach(c => {
      csv += ['jefe', 'admin'].includes(perfil) ? `"${c.semana}","${c.fechaCruda||''}","${c.vendedor}","${c.agencia}","${c.persona}","${c.cuenta}"\r\n` : `"${c.semana}","${c.fechaCruda||''}","${c.agencia}","${c.persona}","${c.cuenta}"\r\n`;
    });
    const link = document.createElement("a"); link.href = encodeURI(csv); link.download = `Reporte_${new Date().toISOString().split('T')[0]}.csv`; link.click();
  };

  const metricas = useMemo(() => {
    let p = misPropuestas.filter(x => filtroSemana === 'Todas' || x.semana === filtroSemana);
    let c = misCitas.filter(x => filtroSemana === 'Todas' || x.semana === filtroSemana);
    if (['jefe', 'admin'].includes(perfil) && filtroVendedor !== 'Todos') { p = p.filter(x => x.vendedor === filtroVendedor); c = c.filter(x => x.vendedor === filtroVendedor); }
    const resumen = todasLasAgencias.map(ag => ({ agencia: ag, enviado: p.filter(x=>x.agencia===ag).reduce((s,x)=>s+Number(x.montoEnviado),0), cerrado: p.filter(x=>x.agencia===ag).reduce((s,x)=>s+Number(x.montoCerrado||0),0), citas: c.filter(x=>x.agencia===ag).length })).filter(r => r.enviado > 0 || r.cerrado > 0 || r.citas > 0 || agenciasDelUsuario.includes(r.agencia));
    const tEnv = resumen.reduce((s,r)=>s+r.enviado,0), tCer = resumen.reduce((s,r)=>s+r.cerrado,0);
    return { resumen, totalEnviado: tEnv, totalCerrado: tCer, totalCitas: resumen.reduce((s,r)=>s+r.citas,0), tasaBateo: tEnv>0 ? ((tCer/tEnv)*100).toFixed(1) : 0 };
  }, [misPropuestas, misCitas, filtroSemana, filtroVendedor, perfil, todasLasAgencias, agenciasDelUsuario]);

  const fMoney = m => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(m);

  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-medium">Conectando a TapTap...</div>;

  if (!perfil) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 border-t-4 border-blue-600 text-center">
        <Lock size={32} className="mx-auto text-blue-600 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Portal Comercial</h1>
        <p className="text-gray-500 mb-6 text-sm">Ingresa con tu correo de TapTap Digital.</p>
        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div><label className="text-sm font-medium text-gray-700">Correo</label><input type="email" value={emailInput} onChange={e=>setEmailInput(e.target.value)} className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" /></div>
          <div><label className="text-sm font-medium text-gray-700">Contraseña</label><div className="relative"><input type={showPassword?"text":"password"} value={passwordInput} onChange={e=>setPasswordInput(e.target.value)} className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-lg mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" /><button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-4 text-gray-400">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>
          {loginError && <p className="text-red-600 text-sm bg-red-50 p-2 rounded">{loginError}</p>}
          {mensajeExito && <p className="text-green-600 text-sm bg-green-50 p-2 rounded">{mensajeExito}</p>}
          <button type="submit" className="w-full py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium transition-colors">Iniciar Sesión</button>
          {solicitandoAcceso && <button type="button" onClick={handleSolicitarAcceso} className="w-full py-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 font-medium">Solicitar Acceso</button>}
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-slate-900 text-white p-4 flex flex-col justify-between">
        <div>
          <h1 className="text-xl font-bold text-blue-400 mb-2">TapTap Comercial</h1>
          <div className="bg-slate-800 p-2 rounded text-xs mb-6 text-center">{perfil.toUpperCase()}: {nombreUsuario}</div>
          <nav className="flex flex-col gap-2">
            <button onClick={()=>setActiveTab('dashboard')} className={`p-3 rounded flex gap-3 ${activeTab==='dashboard'?'bg-blue-600':'hover:bg-slate-800'}`}><BarChart3 size={20}/>Dashboard</button>
            <button onClick={()=>setActiveTab('propuestas')} className={`p-3 rounded flex gap-3 ${activeTab==='propuestas'?'bg-blue-600':'hover:bg-slate-800'}`}><Briefcase size={20}/>Propuestas</button>
            <button onClick={()=>setActiveTab('citas')} className={`p-3 rounded flex gap-3 ${activeTab==='citas'?'bg-blue-600':'hover:bg-slate-800'}`}><Calendar size={20}/>Reuniones</button>
            {perfil === 'admin' && <button onClick={()=>setActiveTab('usuarios')} className={`p-3 rounded flex gap-3 ${activeTab==='usuarios'?'bg-purple-600':'hover:bg-slate-800'}`}><Users size={20}/>Usuarios</button>}
          </nav>
        </div>
        <div className="mt-8 space-y-3">
          <button onClick={()=>setActiveTab('perfil')} className={`w-full p-2 flex justify-center gap-2 rounded font-medium ${activeTab==='perfil'?'bg-slate-700 text-white':'text-slate-400 hover:text-white hover:bg-slate-800'}`}><User size={16}/>Mi Perfil</button>
          <button onClick={handleExportCSV} className="w-full p-3 bg-emerald-600 rounded flex justify-center gap-2 hover:bg-emerald-500 font-medium"><Download size={18}/>Descargar CSV</button>
          <button onClick={()=>{setPerfil(null);setEmailInput('');setPasswordInput('');}} className="w-full p-2 text-slate-400 hover:text-white flex justify-center gap-2 hover:bg-slate-800 rounded font-medium"><LogOut size={16}/>Salir</button>
        </div>
      </aside>
      
      <main className="flex-1 p-6 overflow-y-auto text-gray-800">
        {activeTab === 'perfil' && (
          <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-10">
            <h2 className="text-2xl font-bold mb-6 text-center">Mi Perfil</h2>
            <div className="space-y-4 mb-8">
              <div><p className="text-sm text-gray-500">Nombre</p><p className="font-medium text-lg">{nombreUsuario}</p></div>
              <div><p className="text-sm text-gray-500">Correo</p><p className="font-medium">{currentEmail}</p></div>
              <div><p className="text-sm text-gray-500">Rol en el sistema</p><p className="font-medium uppercase text-blue-600">{perfil}</p></div>
              <div><p className="text-sm text-gray-500">Tus Agencias Asignadas</p><div className="flex flex-wrap gap-2 mt-1">{agenciasDelUsuario.map(a=><span key={a} className="bg-gray-100 px-3 py-1 rounded-full text-sm">{a}</span>)}</div></div>
            </div>
            <div className="border-t pt-6">
              <h3 className="font-bold mb-4 text-gray-700">Cambiar mi Contraseña</h3>
              <form onSubmit={handleCambiarContra} className="flex gap-2">
                <input required type="text" placeholder="Nueva contraseña" value={nuevaContra} onChange={e=>setNuevaContra(e.target.value)} className="flex-1 bg-white text-gray-900 border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500" />
                <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded font-medium hover:bg-slate-800">Actualizar</button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Panel de Control</h2>
              <div className="flex gap-2">
                {['jefe','admin'].includes(perfil) && <select className="p-2 bg-white text-gray-900 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500" value={filtroVendedor} onChange={e=>setFiltroVendedor(e.target.value)}><option value="Todos">Todos</option>{vendedoresDisponibles.map(v=><option key={v}>{v}</option>)}</select>}
                <select className="p-2 bg-white text-gray-900 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500" value={filtroSemana} onChange={e=>setFiltroSemana(e.target.value)}><option value="Todas">Todas las Semanas</option>{semanasDisponibles.map(s=><option key={s}>{s}</option>)}</select>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded shadow"><p className="text-sm text-gray-500">Enviado</p><p className="text-xl font-bold">{fMoney(metricas.totalEnviado)}</p></div>
              <div className="bg-white p-4 rounded shadow border-b-4 border-green-500"><p className="text-sm text-gray-500">Cerrado</p><p className="text-xl font-bold text-green-700">{fMoney(metricas.totalCerrado)}</p></div>
              <div className="bg-white p-4 rounded shadow border-b-4 border-purple-500"><p className="text-sm text-gray-500">Citas</p><p className="text-xl font-bold text-purple-700">{metricas.totalCitas}</p></div>
              <div className="bg-white p-4 rounded shadow border-b-4 border-orange-500"><p className="text-sm text-gray-500">Tasa Cierre</p><p className="text-xl font-bold text-orange-700">{metricas.tasaBateo}%</p></div>
            </div>
            <div className="bg-white rounded shadow p-4">
              <h3 className="font-bold mb-4">Por Agencia</h3>
              <table className="w-full text-sm"><thead className="bg-gray-100 text-gray-700 uppercase"><tr><th className="p-2 text-left">Agencia</th><th className="p-2 text-right">Enviado</th><th className="p-2 text-right">Cerrado</th><th className="p-2 text-center">Citas</th></tr></thead>
              <tbody>{metricas.resumen.map(r=><tr key={r.agencia} className="border-b"><td className="p-2 font-medium text-gray-900">{r.agencia}</td><td className="p-2 text-right text-gray-600">{fMoney(r.enviado)}</td><td className="p-2 text-right text-green-600 font-bold">{fMoney(r.cerrado)}</td><td className="p-2 text-center">{r.citas}</td></tr>)}</tbody></table>
            </div>
          </div>
        )}

        {activeTab === 'propuestas' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded shadow"><h3 className="font-bold mb-4 text-lg">Nueva Propuesta</h3>
              <form onSubmit={handleSubmitPropuesta} className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <input required type="date" value={fechaPropuesta} onChange={e=>{setFechaPropuesta(e.target.value);setFormPropuesta({...formPropuesta, semana: obtenerRangoSemana(e.target.value)})}} className="bg-white text-gray-900 border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500"/>
                <select value={formPropuesta.agencia} onChange={e=>setFormPropuesta({...formPropuesta, agencia: e.target.value})} className="bg-white text-gray-900 border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500">
                  {agenciasDelUsuario.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
                <input required placeholder="Proyecto" value={formPropuesta.nombre} onChange={e=>setFormPropuesta({...formPropuesta, nombre: e.target.value})} className="bg-white text-gray-900 border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500"/>
                <input required type="number" placeholder="Monto Enviado $" value={formPropuesta.montoEnviado} onChange={e=>setFormPropuesta({...formPropuesta, montoEnviado: e.target.value})} className="bg-white text-gray-900 border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500"/>
                <select value={formPropuesta.estatus} onChange={e=>setFormPropuesta({...formPropuesta, estatus: e.target.value})} className="bg-white text-gray-900 border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500">{ESTATUS.map(a=><option key={a} value={a}>{a}</option>)}</select>
                <input type="number" placeholder="Monto Cerrado $" disabled={formPropuesta.estatus!=='Cerrada'} value={formPropuesta.montoCerrado} onChange={e=>setFormPropuesta({...formPropuesta, montoCerrado: e.target.value})} className="bg-white text-gray-900 border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500"/>
                <div className="col-span-full text-right"><button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700">Guardar</button></div>
              </form>
            </div>
            <div className="bg-white p-4 rounded shadow overflow-x-auto"><h3 className="font-bold mb-4 text-lg">Historial</h3>
              <table className="w-full text-sm whitespace-nowrap"><thead className="bg-gray-100 text-gray-700 uppercase"><tr><th className="p-2 text-left">Semana</th>{['jefe','admin'].includes(perfil)&&<th className="p-2 text-left text-purple-700">Vendedor</th>}<th className="p-2 text-left">Agencia</th><th className="p-2 text-left">Proyecto</th><th className="p-2 text-left">Estatus</th><th className="p-2 text-right">Cerrado</th><th className="p-2 text-center">Edit</th></tr></thead>
              <tbody>{misPropuestas.map(p=><tr key={p.id} className="border-b"><td className="p-2 text-gray-600">{p.semana}</td>{['jefe','admin'].includes(perfil)&&<td className="p-2 text-purple-700 font-semibold">{p.vendedor}</td>}<td className="p-2 font-medium text-gray-900">{p.agencia}</td><td className="p-2 text-gray-700">{p.nombre}</td><td className="p-2">{p.estatus}</td><td className="p-2 text-green-600 font-bold text-right">{p.estatus==='Cerrada'?fMoney(p.montoCerrado):'-'}</td><td className="p-2 text-center"><button onClick={()=>{setEditingPropuestaId(p.id);setFormPropuesta(p);setFechaPropuesta(p.fechaCruda||'')}} className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition-colors"><Edit2 size={16}/></button></td></tr>)}</tbody></table>
            </div>
          </div>
        )}

        {activeTab === 'citas' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded shadow"><h3 className="font-bold mb-4 text-lg">Nueva Cita</h3>
              <form onSubmit={handleAddCita} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <input required type="date" value={fechaCita} onChange={e=>{setFechaCita(e.target.value);setFormCita({...formCita, semana: obtenerRangoSemana(e.target.value)})}} className="bg-white text-gray-900 border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500"/>
                <select value={formCita.agencia} onChange={e=>setFormCita({...formCita, agencia: e.target.value})} className="bg-white text-gray-900 border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500">
                  {agenciasDelUsuario.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
                <input required placeholder="Persona" value={formCita.persona} onChange={e=>setFormCita({...formCita, persona: e.target.value})} className="bg-white text-gray-900 border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500"/>
                <input required placeholder="Cuenta (ej. Netflix)" value={formCita.cuenta} onChange={e=>setFormCita({...formCita, cuenta: e.target.value})} className="bg-white text-gray-900 border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500"/>
                <div className="col-span-full text-right"><button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded font-medium hover:bg-purple-700">Guardar</button></div>
              </form>
            </div>
            <div className="bg-white p-4 rounded shadow overflow-x-auto"><h3 className="font-bold mb-4 text-lg">Historial</h3>
              <table className="w-full text-sm whitespace-nowrap"><thead className="bg-gray-100 text-gray-700 uppercase"><tr><th className="p-2 text-left">Semana</th>{['jefe','admin'].includes(perfil)&&<th className="p-2 text-left text-purple-700">Vendedor</th>}<th className="p-2 text-left">Agencia</th><th className="p-2 text-left">Persona</th><th className="p-2 text-left">Cuenta</th></tr></thead>
              <tbody>{misCitas.map(c=><tr key={c.id} className="border-b"><td className="p-2 text-gray-600">{c.semana}</td>{['jefe','admin'].includes(perfil)&&<td className="p-2 text-purple-700 font-semibold">{c.vendedor}</td>}<td className="p-2 font-medium text-gray-900">{c.agencia}</td><td className="p-2 text-gray-700">{c.persona}</td><td className="p-2"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-semibold">{c.cuenta}</span></td></tr>)}</tbody></table>
            </div>
          </div>
        )}

        {activeTab === 'usuarios' && perfil === 'admin' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded shadow"><h3 className="font-bold mb-4 text-lg">Nuevo Usuario</h3>
              <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input required type="email" placeholder="Correo (@taptapdigital.com)" value={formUsuario.email} onChange={e=>setFormUsuario({...formUsuario, email:e.target.value})} className="bg-white text-gray-900 border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500"/>
                <input required placeholder="Nombre Completo" value={formUsuario.nombre} onChange={e=>setFormUsuario({...formUsuario, nombre:e.target.value})} className="bg-white text-gray-900 border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500"/>
                <select value={formUsuario.rol} onChange={e=>setFormUsuario({...formUsuario, rol:e.target.value})} className="bg-white text-gray-900 border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500"><option value="comercial">Comercial</option><option value="jefe">Jefe</option><option value="admin">Admin</option></select>
                <input required placeholder="Contraseña (mín 6)" value={formUsuario.password} onChange={e=>setFormUsuario({...formUsuario, password:e.target.value})} className="bg-white text-gray-900 border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500"/>
                <div className="md:col-span-4"><input required placeholder="Agencias separadas por coma (Ej. Dentsu, Havas)" value={formUsuario.agencias} onChange={e=>setFormUsuario({...formUsuario, agencias:e.target.value})} className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded focus:ring-blue-500 focus:border-blue-500"/></div>
                <div className="md:col-span-4 text-right"><button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700">Crear Usuario</button></div>
              </form>
            </div>
            {solicitudesGlobales.length > 0 && (
              <div className="bg-yellow-50 p-4 rounded shadow border border-yellow-200"><h3 className="font-bold text-yellow-800 mb-2">Solicitudes Pendientes</h3>
                {solicitudesGlobales.map(s => <div key={s.id} className="flex justify-between border-b border-yellow-200 py-2 items-center gap-2"><span>{s.email}</span><button onClick={()=>handleAprobarSolicitud(s)} className="text-white bg-green-600 px-3 py-1 rounded font-medium hover:bg-green-700 text-sm whitespace-nowrap">Aprobar</button></div>)}
              </div>
            )}
            <div className="bg-white p-4 rounded shadow overflow-x-auto"><h3 className="font-bold mb-4 text-lg">Directorio</h3>
              <table className="w-full text-sm whitespace-nowrap"><thead className="bg-gray-100 text-gray-700 uppercase"><tr><th className="p-2 text-left">Nombre</th><th className="p-2 text-left">Correo</th><th className="p-2 text-left">Contraseña</th><th className="p-2 text-left">Agencias</th><th className="p-2 text-left">Rol</th><th className="p-2 text-center">Borrar</th></tr></thead>
              <tbody>{usuariosGlobales.map(u=><tr key={u.email} className="border-b"><td className="p-2 font-medium text-gray-900">{u.nombre}</td><td className="p-2 text-gray-600">{u.email}</td><td className="p-2 font-mono text-xs text-gray-500">{u.password}</td><td className="p-2 text-xs text-gray-500 max-w-xs truncate" title={u.agencias?.join(', ')}>{u.agencias?.join(', ')}</td><td className="p-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.rol === 'admin' ? 'bg-purple-100 text-purple-800' : u.rol === 'jefe' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{u.rol.toUpperCase()}</span></td><td className="p-2 text-center"><button onClick={async()=>window.confirm(`¿Seguro que quieres borrar a ${u.nombre}?`) && await deleteDoc(doc(db,'usuarios',u.email))} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"><Trash2 size={16}/></button></td></tr>)}</tbody></table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}