import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  LayoutDashboard, FileText, Calendar, Users, Plus, TrendingUp, 
  CheckCircle2, Clock, ChevronRight, X, Building2, User, Lock, LogOut, Eye, EyeOff, ShieldCheck, Edit3, Trash2, Download, Activity, PieChart as PieChartIcon, Target
} from 'lucide-react';

// --- 1. CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "AIzaSyD92CDTTcEh_BJ53q8q0TXtFtO0Fj29u2w",
      authDomain: "gestion-comercial-taptap.firebaseapp.com",
      projectId: "gestion-comercial-taptap",
      storageBucket: "gestion-comercial-taptap.firebasestorage.app",
      messagingSenderId: "1001662665656",
      appId: "1:1001662665656:web:4391d323fa90e3d10e354d"
    };

let app, auth, db;
try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) { console.error("Error inicializando Firebase:", error); }

const appId = typeof __app_id !== 'undefined' ? __app_id : "1";

// --- 2. CONSTANTES DEL EQUIPO ---
const COMERCIALES = ['Alexander Mena', 'Berenisse López', 'David Vanegas'];
const VENDEDOR_COLORS = { 'Alexander': '#3b82f6', 'Berenisse': '#ec4899', 'David': '#10b981' };
const PALETA_ESTATUS = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#0ea5e9', '#d946ef'];

// --- 3. UTILIDADES ---
const mapManagerToVendedor = (vRaw) => {
  if (!vRaw) return 'Sin Asignar';
  const n = String(vRaw).toLowerCase();
  if (n.includes('monse') || n.includes('mont')) return 'Alexander Mena';
  if (n.includes('estefania') || n.includes('estef')) return 'Berenisse López';
  if (n.includes('dania') || n.includes('topete')) return 'David Vanegas';
  return String(vRaw); 
};

const formatCurrency = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(val) || 0);
const parseMonto = (v) => v ? (typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.-]+/g, "")) || 0) : 0;

const parseDateStringToTime = (dateStr) => {
  if (!dateStr) return 0;
  let d = new Date(dateStr);
  if (!isNaN(d.getTime()) && String(dateStr).includes('-')) d = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

const obtenerRangoSemana = (fechaStr) => {
  let d = new Date(fechaStr);
  if (isNaN(d.getTime())) return 'Sin fecha';
  const dia = d.getDay(); 
  const diffLunes = d.getDate() - dia + (dia === 0 ? -6 : 1);
  const lunes = new Date(new Date(d).setDate(diffLunes));
  const viernes = new Date(new Date(lunes).setDate(lunes.getDate() + 4));
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${lunes.getDate()} al ${viernes.getDate()} de ${meses[lunes.getMonth()]}`;
};

const formatearFechaCorta = (f) => {
  if (!f) return '';
  const p = f.split('-'); if (p.length !== 3) return f;
  return `${p[2]} ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(p[1])-1]}`;
};

const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
  const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
  return percent > 0.05 ? <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">{`${(percent * 100).toFixed(0)}%`}</text> : null;
};

// --- 4. COMPONENTE PRINCIPAL ---
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); 
  const [usuarios, setUsuarios] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [propuestas, setPropuestas] = useState([]);
  const [citas, setCitas] = useState([]);
  const [filtroVendedor, setFiltroVendedor] = useState('Todos');
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [showModalCita, setShowModalCita] = useState(false);
  const [showModalUser, setShowModalUser] = useState(false);
  const [editingCitaId, setEditingCitaId] = useState(null);
  const [isCustomAgencia, setIsCustomAgencia] = useState(false);
  const [loginForm, setLoginForm] = useState({ user: '', pass: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [userAuth, setUserAuth] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [formUser, setFormUser] = useState({ nombre: '', pass: '', role: 'comercial', cargo: '', agencias: '' });
  const [nuevaCita, setNuevaCita] = useState({ agencia: '', vendedor: '', fechaCruda: '', semana: '', persona: '', cuenta: '' });
  const [nuevaContra, setNuevaContra] = useState('');
  const [mensajePerfil, setMensajePerfil] = useState({ tipo: '', texto: '' });

  useEffect(() => {
    const init = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
      } catch (e) { console.error(e); }
    };
    init();
    return onAuthStateChanged(auth, setUserAuth);
  }, []);

  useEffect(() => {
    if (!userAuth || !db) return;
    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'usuarios'), (snap) => {
      if (snap.empty) {
        const eq = [
          { nombre: "Alexander Mena", pass: "alex2026", role: "admin", cargo: "Admin & Comercial", agencias: "Dentsu, Havas, Mid Market" },
          { nombre: "Berenisse López", pass: "bere2026", role: "comercial", cargo: "Comercial", agencias: "Publicis, WPP, Mid Market" },
          { nombre: "David Vanegas", pass: "david2026", role: "comercial", cargo: "Comercial", agencias: "OMG, IPG, Mid Market" },
          { nombre: "Alberto Bautista", pass: "alberto2026", role: "manager", cargo: "VP Revenue México", agencias: "Estrategia Nacional" },
          { nombre: "Javier Ormazabal", pass: "javiorma2026", role: "manager", cargo: "SVP REVENUE LATAM", agencias: "Cuentas Regionales" },
          { nombre: "Javier Velazquez", pass: "javiv2026", role: "manager", cargo: "SVP GLOBAL BUSINESS SOLUTIONS", agencias: "Global Partners" }
        ];
        eq.forEach(u => addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'usuarios'), u));
      }
      setUsuarios(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubProp = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'propuestas'), (snap) => {
      setPropuestas(snap.docs.map(doc => {
        const d = doc.data();
        return { id: doc.id, ...d, vendedor: mapManagerToVendedor(d.vendedor), montoEnviado: parseMonto(d.montoEnviado), montoCerrado: parseMonto(d.montoCerrado), semana: d.semana || obtenerRangoSemana(d.fechaCruda) };
      }));
    });
    const unsubCitas = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'citas'), (snap) => {
      setCitas(snap.docs.map(doc => ({ id: doc.id, ...doc.data(), semana: doc.data().semana || obtenerRangoSemana(doc.data().fechaCruda) })).sort((a,b) => b.createdAt - a.createdAt));
    });
    return () => { unsubUsers(); unsubProp(); unsubCitas(); };
  }, [userAuth]);

  const handleLogin = (e) => {
    e.preventDefault();
    const found = usuarios.find(u => u.nombre === loginForm.user && u.pass === loginForm.pass);
    if (found) { setCurrentUser(found); setIsLoggedIn(true); setLoginError(''); setFiltroVendedor(found.role === 'comercial' ? found.nombre : 'Todos'); }
    else setLoginError('Usuario o contraseña incorrectos');
  };

  const saveUser = async (e) => {
    e.preventDefault();
    if (editingUser) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'usuarios', editingUser.id), formUser);
    else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'usuarios'), formUser);
    setShowModalUser(false); setEditingUser(null); setFormUser({ nombre: '', pass: '', role: 'comercial', cargo: '', agencias: '' });
  };

  const deleteUser = async (id) => window.confirm('¿Eliminar acceso?') && await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'usuarios', id));

  const guardarCita = async (e) => {
    e.preventDefault();
    if (editingCitaId) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'citas', editingCitaId), nuevaCita);
    else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'citas'), { ...nuevaCita, vendedor: currentUser.nombre, createdAt: Date.now() });
    setShowModalCita(false); setEditingCitaId(null); setIsCustomAgencia(false); setNuevaCita({ agencia:'', vendedor:'', fechaCruda:'', semana:'', persona:'', cuenta:'' });
  };

  const deleteCita = async (id) => window.confirm('¿Borrar cita de agenda?') && await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'citas', id));

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (nuevaContra.length < 6) return setMensajePerfil({ tipo:'error', texto:'Mínimo 6 caracteres' });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'usuarios', currentUser.id), { pass: nuevaContra });
    setMensajePerfil({ tipo:'exito', texto:'¡Actualizada!' }); setCurrentUser({...currentUser, pass: nuevaContra}); setNuevaContra('');
    setTimeout(() => setMensajePerfil({ tipo:'', texto:'' }), 3000);
  };

  const isMaster = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const misAgencias = currentUser?.agencias ? String(currentUser.agencias).split(',').map(a => a.trim()) : [];

  const pFiltradas = useMemo(() => {
    let f = isMaster ? (filtroVendedor === 'Todos' ? propuestas : propuestas.filter(p => p.vendedor === filtroVendedor)) : propuestas.filter(p => p.vendedor === currentUser.nombre);
    if (filtroFechaInicio || filtroFechaFin) {
      const s = parseDateStringToTime(filtroFechaInicio), e = filtroFechaFin ? parseDateStringToTime(filtroFechaFin) + 86399999 : Infinity;
      f = f.filter(p => { const t = parseDateStringToTime(p.fechaCruda); return t >= s && t <= e; });
    }
    return f;
  }, [propuestas, currentUser, isMaster, filtroVendedor, filtroFechaInicio, filtroFechaFin]);

  const cFiltradas = useMemo(() => {
    let f = isMaster ? (filtroVendedor === 'Todos' ? citas : citas.filter(c => c.vendedor === filtroVendedor)) : citas.filter(c => c.vendedor === currentUser.nombre);
    if (filtroFechaInicio || filtroFechaFin) {
      const s = parseDateStringToTime(filtroFechaInicio), e = filtroFechaFin ? parseDateStringToTime(filtroFechaFin) + 86399999 : Infinity;
      f = f.filter(c => { const t = parseDateStringToTime(c.fechaCruda); return t >= s && t <= e; });
    }
    return f;
  }, [citas, currentUser, isMaster, filtroVendedor, filtroFechaInicio, filtroFechaFin]);

  const stats = useMemo(() => {
    const tEnv = pFiltradas.reduce((s, p) => s + p.montoEnviado, 0);
    const tWon = pFiltradas.reduce((s, p) => (p.estatus?.toUpperCase().includes('WON') || p.estatus?.toUpperCase() === 'CERRADA') ? s + (p.montoCerrado || p.montoEnviado) : s, 0);
    const tCom = pFiltradas.reduce((s, p) => p.estatus?.toUpperCase().includes('COMMITTED') ? s + p.montoEnviado : s, 0);
    const estMap = pFiltradas.reduce((acc, p) => { const e = (p.estatus || 'Sin Estatus').toUpperCase(); acc[e] = (acc[e] || 0) + p.montoEnviado; return acc; }, {});
    const pieD = Object.keys(estMap).map((k, i) => ({ name: k, value: estMap[k], color: PALETA_ESTATUS[i % PALETA_ESTATUS.length] }));
    const target = filtroVendedor === 'Todos' ? COMERCIALES : [filtroVendedor];
    const cData = target.map(n => ({
      name: n.split(' ')[0],
      monto: pFiltradas.filter(p => p.vendedor === n).reduce((s, p) => s + p.montoEnviado, 0),
      cant: pFiltradas.filter(p => p.vendedor === n).length,
      citas: cFiltradas.filter(c => c.vendedor === n).length
    }));
    return { tEnv, tWon, tCom, bateo: tEnv > 0 ? ((tWon / tEnv) * 100).toFixed(1) : 0, pieD, cData };
  }, [pFiltradas, cFiltradas, filtroVendedor]);

  const downloadCSV = (data, name) => {
    const headers = Object.keys(data[0] || {}).filter(k => !['id', 'createdAt'].includes(k));
    let csv = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(',') + "\n";
    data.forEach(r => csv += headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(',') + "\n");
    const link = document.createElement('a'); link.href = encodeURI(csv); link.download = `${name}.csv`; link.click();
  };

  // --- VISTAS ---
  if (!isLoggedIn) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-10 animate-in zoom-in duration-300">
        <img src="/logo.png" alt="TapTap" className="h-24 mx-auto mb-8 object-contain" />
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Portal Comercial</h1>
        <p className="text-slate-500 font-medium mb-8">Equipo de Ingresos TapTap</p>
        <form onSubmit={handleLogin} className="space-y-5 text-left">
          <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Colaborador</label><select className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" value={loginForm.user} onChange={e => setLoginForm({...loginForm, user: e.target.value})} required><option value="">Selecciona perfil...</option>{usuarios.sort((a,b) => a.nombre.localeCompare(b.nombre)).map(u => <option key={u.id} value={u.nombre}>{u.nombre}</option>)}</select></div>
          <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Contraseña</label><div className="relative"><input type={showPassword ? "text" : "password"} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 pl-12" value={loginForm.pass} onChange={e => setLoginForm({...loginForm, pass: e.target.value})} required /><Lock className="absolute left-4 top-4 text-slate-400" size={20} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-slate-300 hover:text-slate-700">{showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}</button></div></div>
          {loginError && <div className="p-3 bg-rose-50 text-rose-500 text-xs font-bold rounded-xl text-center">{loginError}</div>}
          <button type="submit" className="w-full bg-blue-600 text-white font-black p-4 rounded-2xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-3">Entrar al Portal <ChevronRight size={20} /></button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-hidden">
      <aside className="w-full md:w-72 bg-slate-950 text-white p-6 flex flex-col shrink-0 border-r border-slate-800">
        <div className="flex items-center justify-center md:justify-start mb-12 mt-4"><img src="/logo.png" alt="TapTap" className="h-16 object-contain invert brightness-0 transition-all" style={{ filter: 'brightness(0) invert(1)' }} /></div>
        <nav className="space-y-2 flex-1">
          <SidebarBtn id="dashboard" icon={LayoutDashboard} label="Dashboard" active={activeTab} onClick={setActiveTab} />
          <SidebarBtn id="pipe" icon={FileText} label="Pipe (Drive)" active={activeTab} onClick={setActiveTab} />
          <SidebarBtn id="citas" icon={Calendar} label="Agenda Citas" active={activeTab} onClick={setActiveTab} />
          <SidebarBtn id="perfil" icon={User} label="Mi Perfil" active={activeTab} onClick={setActiveTab} />
          {currentUser?.role === 'admin' && <SidebarBtn id="admin" icon={ShieldCheck} label="Control Maestro" active={activeTab} onClick={setActiveTab} />}
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
          <div className="flex items-center gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800"><div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-black text-sm text-white shrink-0">{String(currentUser?.nombre || '?').charAt(0)}</div><div className="overflow-hidden text-left"><p className="text-xs font-bold text-white truncate">{currentUser?.nombre}</p><p className="text-[9px] text-slate-400 font-black uppercase tracking-widest truncate">{currentUser?.cargo}</p></div></div>
          <button onClick={() => setIsLoggedIn(false)} className="flex items-center justify-center gap-2 text-xs font-black text-rose-400 hover:text-rose-300 w-full p-3 rounded-xl hover:bg-rose-950/30 transition-all border border-transparent hover:border-rose-900/50"><LogOut size={14} /> SALIR</button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto bg-slate-50">
        <header className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="text-left"><h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 mb-2">Hola, {currentUser?.nombre.split(' ')[0]} 👋</h2><p className="text-slate-500 text-sm font-medium">Asignación: <span className="text-blue-600 font-bold">{currentUser?.agencias}</span></p></div>
          <div className="w-full md:w-auto flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
            <div className="relative w-full sm:w-auto">
              <button onClick={() => setIsDatePickerOpen(!isDatePickerOpen)} className="flex items-center justify-center gap-2 w-full sm:w-auto bg-white border border-slate-200 text-slate-700 px-6 py-4 rounded-2xl shadow-sm hover:bg-blue-50 hover:border-blue-200 transition-all font-bold text-sm outline-none">
                <Calendar size={16} className={filtroFechaInicio || filtroFechaFin ? "text-blue-600" : "text-slate-400"} />
                {filtroFechaInicio && filtroFechaFin ? `${formatearFechaCorta(filtroFechaInicio)} - ${formatearFechaCorta(filtroFechaFin)}` : filtroFechaInicio ? `Desde: ${formatearFechaCorta(filtroFechaInicio)}` : filtroFechaFin ? `Hasta: ${formatearFechaCorta(filtroFechaFin)}` : 'Filtrar Fechas'}
              </button>
              {isDatePickerOpen && (
                <div className="absolute top-full right-0 lg:left-0 mt-2 p-6 bg-white border border-slate-100 rounded-[2rem] shadow-2xl z-50 w-full sm:w-80 animate-in slide-in-from-top-2">
                  <div className="flex justify-between items-center mb-5"><h4 className="font-black text-slate-900">Rango de Fechas</h4><button onClick={() => setIsDatePickerOpen(false)} className="text-slate-400 hover:text-rose-500 p-2 rounded-full transition-colors"><X size={16}/></button></div>
                  <div className="space-y-4">
                    <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Inicio</label><input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm text-slate-700 outline-none [color-scheme:light] cursor-pointer" value={filtroFechaInicio} onChange={e => setFiltroFechaInicio(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} /></div>
                    <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Fin</label><input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm text-slate-700 outline-none [color-scheme:light] cursor-pointer" value={filtroFechaFin} onChange={e => setFiltroFechaFin(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} /></div>
                    {(filtroFechaInicio || filtroFechaFin) && <button onClick={() => {setFiltroFechaInicio(''); setFiltroFechaFin(''); setIsDatePickerOpen(false);}} className="w-full mt-4 text-rose-600 bg-rose-50 border border-rose-100 font-bold text-sm py-3 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm">Limpiar</button>}
                  </div>
                </div>
              )}
            </div>
            {isMaster && (
              <select className="w-full sm:w-auto bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 hover:bg-blue-50 appearance-none cursor-pointer" value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}>
                <option value="Todos">🚀 Todo el Equipo</option>{COMERCIALES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-wrap gap-6 items-stretch">
              <KpiCard icon={Clock} color="blue" label="Revenue Pipe" value={formatCurrency(stats.tEnv)} />
              <KpiCard icon={Target} color="indigo" label="Committed" value={formatCurrency(stats.tCom)} />
              <KpiCard icon={CheckCircle2} color="green" label="Total WON" value={formatCurrency(stats.tWon)} />
              <KpiCard icon={Activity} color="purple" label="Tasa Bateo" value={`${stats.bateo}%`} />
              <KpiCard icon={Calendar} color="amber" label="Citas Activas" value={stats.countCitas} />
            </div>
            <div className={`grid grid-cols-1 ${isMaster ? 'xl:grid-cols-2' : 'grid-cols-1'} gap-8`}>
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center">
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2 w-full"><PieChartIcon size={18} className="text-purple-500"/> Estatus del Pipe</h3>
                <div className="w-full flex-1 min-h-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.pieD} innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={renderPieLabel} labelLine={false}>{stats.pieD.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{borderRadius: '16px', border: 'none', fontWeight: 'bold'}} /><Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: 'bold'}} /></PieChart></ResponsiveContainer></div>
              </div>
              {isMaster && (
                <>
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2"><TrendingUp size={18} className="text-blue-500"/> Revenue por Comercial</h3>
                    <div className="flex-1 min-h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.cData} margin={{top: 10, right: 10, left: 0, bottom: 0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} tickFormatter={(v) => `$${v >= 1000000 ? v/1000000 + 'M' : v/1000 + 'k'}`} width={60} /><Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', fontWeight: 'bold'}} formatter={(v) => formatCurrency(v)} /><Bar dataKey="monto" radius={[6, 6, 0, 0]} maxBarSize={60}>{stats.cData.map((e, i) => <Cell key={`cell-${i}`} fill={VENDEDOR_COLORS[e.name] || '#94a3b8'} />)}</Bar></BarChart></ResponsiveContainer></div>
                  </div>
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2"><FileText size={18} className="text-emerald-500"/> Volumen de Propuestas</h3>
                    <div className="flex-1 min-h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.cData} margin={{top: 10, right: 10, left: 0, bottom: 0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} allowDecimals={false} width={30} /><Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', fontWeight: 'bold'}} /><Bar dataKey="cant" radius={[6, 6, 0, 0]} maxBarSize={60}>{stats.cData.map((e, i) => <Cell key={`cell-${i}`} fill={VENDEDOR_COLORS[e.name] || '#94a3b8'} />)}</Bar></BarChart></ResponsiveContainer></div>
                  </div>
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2"><Calendar size={18} className="text-amber-500"/> Citas Registradas</h3>
                    <div className="flex-1 min-h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.cData} margin={{top: 10, right: 10, left: 0, bottom: 0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} allowDecimals={false} width={30} /><Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', fontWeight: 'bold'}} /><Bar dataKey="citas" radius={[6, 6, 0, 0]} maxBarSize={60}>{stats.cData.map((e, i) => <Cell key={`cell-${i}`} fill={VENDEDOR_COLORS[e.name] || '#94a3b8'} />)}</Bar></BarChart></ResponsiveContainer></div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'pipe' && (
          <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"><h2 className="text-3xl font-black text-slate-900 tracking-tight">Pipe de Drive</h2><button onClick={() => downloadCSV(pFiltradas, 'Pipe_Propuestas')} className="bg-white border border-slate-200 text-slate-700 font-bold px-5 py-3 rounded-xl flex items-center gap-2 shadow-sm hover:bg-slate-50 transition-all text-sm"><Download size={16} /> Descargar CSV</button></div>
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden relative"><div className="max-h-[600px] overflow-auto w-full relative"><table className="w-full text-left min-w-[800px]"><thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-widest sticky top-0 z-10"><tr><th className="p-5">Fecha / Sem.</th><th className="p-5">Campaña</th><th className="p-5">Manager</th><th className="p-5 text-center">Estatus</th><th className="p-5 text-right">Monto</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{pFiltradas.map(p => (<tr key={p.id} className="hover:bg-slate-50/50 transition"><td className="p-5"><div className="text-slate-500 font-medium">{p.fechaCruda}</div><div className="text-[10px] text-slate-400 font-bold uppercase mt-1">{p.semana}</div></td><td className="p-5 font-bold text-slate-800">{p.nombre}</td><td className="p-5"><span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100">{p.vendedor}</span></td><td className="p-5 text-center"><span className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${String(p.estatus || '').toUpperCase().includes('WON') ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : String(p.estatus || '').toUpperCase().includes('COMMITTED') ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : String(p.estatus || '').toUpperCase().includes('LOST') ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>{p.estatus || 'Enviada'}</span></td><td className="p-5 font-black text-slate-900 text-right">{formatCurrency(p.montoEnviado)}</td></tr>))}</tbody></table></div></div>
          </div>
        )}

        {activeTab === 'citas' && (
          <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4"><h2 className="text-3xl font-black text-slate-900 tracking-tight italic">Agenda Semanal</h2><div className="flex gap-3 w-full md:w-auto"><button onClick={() => downloadCSV(cFiltradas, 'Agenda_Citas')} className="bg-white border border-slate-200 text-slate-700 font-bold px-6 py-4 rounded-2xl flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 transition-all text-sm w-full md:w-auto"><Download size={16} /> CSV</button><button onClick={() => {setEditingCitaId(null); setNuevaCita({ agencia: '', vendedor: '', fechaCruda: '', semana: '', persona: '', cuenta: '' }); setIsCustomAgencia(false); setShowModalCita(true);}} className="bg-blue-600 text-white font-black px-6 py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20 hover:scale-105 transition-all w-full md:w-auto"><Plus size={20} /> Registrar Cita</button></div></header>
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden relative"><div className="max-h-[600px] overflow-auto w-full relative"><table className="w-full text-left min-w-[900px]"><thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-widest sticky top-0 z-10"><tr><th className="p-5">Semana</th><th className="p-5">Agencia</th><th className="p-5">Cuenta / Marca</th><th className="p-5">Manager</th><th className="p-5">Contacto</th><th className="p-5">Fecha</th><th className="p-5 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100 text-sm">{cFiltradas.map(c => (<tr key={c.id} className="hover:bg-slate-50 transition-colors"><td className="p-5"><span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase">{c.semana}</span></td><td className="p-5 font-bold text-slate-900">{c.agencia}</td><td className="p-5 font-medium text-slate-600">{c.cuenta}</td><td className="p-5"><span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black">{c.vendedor}</span></td><td className="p-5 text-slate-500">{c.persona}</td><td className="p-5 text-slate-400 font-medium">{c.fechaCruda}</td><td className="p-5 text-right"><div className="flex justify-end gap-2">{(currentUser?.role === 'admin' || currentUser?.nombre === c.vendedor) && <><button onClick={() => openEditCita(c)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit3 size={16}/></button><button onClick={() => deleteCita(c.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={16}/></button></>}</div></td></tr>))}</tbody></table></div></div>
          </div>
        )}

        {activeTab === 'perfil' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
            <header className="mb-2"><h2 className="text-3xl font-black text-slate-900 tracking-tight">Mi Perfil</h2><p className="text-slate-500 font-medium mt-1">Gestiona tu información personal y seguridad.</p></header>
            <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-10 pb-10 border-b border-slate-100"><div className="w-24 h-24 rounded-[2rem] bg-blue-50 text-blue-600 flex items-center justify-center font-black text-4xl shrink-0">{currentUser?.nombre.charAt(0)}</div><div><h3 className="text-3xl font-black text-slate-900">{currentUser?.nombre}</h3><p className="text-blue-600 font-bold uppercase tracking-widest text-sm mt-1">{currentUser?.cargo}</p><span className={`inline-block mt-3 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${currentUser?.role === 'admin' ? 'bg-rose-50 text-rose-700 border-rose-100' : currentUser?.role === 'manager' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>Nivel: {currentUser?.role}</span></div></div>
              <div className="space-y-10">
                <div><h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest block mb-4 flex items-center gap-2"><Building2 size={14}/> Agencias</h4><div className="flex flex-wrap gap-2">{misAgencias.map(a => <span key={a} className="bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm">{a}</span>)}</div></div>
                <div className="pt-10 border-t border-slate-100"><h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest block mb-4 flex items-center gap-2"><Lock size={14}/> Actualizar Contraseña</h4><form onSubmit={handleUpdatePassword} className="flex flex-col sm:flex-row gap-4"><input type="text" required placeholder="Nueva contraseña (mín. 6)" value={nuevaContra} onChange={e => setNuevaContra(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" /><button type="submit" className="w-full sm:w-auto bg-slate-900 text-white font-black px-8 py-4 rounded-2xl shadow-lg hover:bg-blue-600 transition-all uppercase tracking-widest text-xs">Guardar</button></form>{mensajePerfil.texto && <div className={`mt-4 p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${mensajePerfil.tipo === 'exito' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>{mensajePerfil.tipo === 'exito' ? <CheckCircle2 size={16}/> : <X size={16}/>}{mensajePerfil.texto}</div>}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admin' && currentUser?.role === 'admin' && (
          <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"><div><h2 className="text-3xl font-black text-slate-900 tracking-tight">Control Maestro</h2><p className="text-slate-500 font-medium mt-1">Gestión de cargos, roles y accesos.</p></div><button onClick={() => { setEditingUser(null); setFormUser({ nombre: '', pass: '', role: 'comercial', cargo: '', agencias: '' }); setShowModalUser(true); }} className="bg-slate-900 text-white font-black px-6 py-4 rounded-2xl flex items-center gap-2 shadow-xl hover:scale-105 transition-all"><Plus size={20} /> Nuevo Perfil</button></header>
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden relative"><div className="overflow-x-auto w-full"><table className="w-full text-left min-w-[800px] whitespace-nowrap md:whitespace-normal"><thead className="bg-slate-50 border-b border-slate-100"><tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest"><th className="p-5">Colaborador / Cargo</th><th className="p-5">Asignación</th><th className="p-5">Pass</th><th className="p-5">Rol / Nivel</th><th className="p-5 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{usuarios.map(u => (<tr key={u.id} className="hover:bg-slate-50/50 transition"><td className="p-5"><div className="font-bold text-slate-900">{u.nombre}</div><div className="text-[10px] font-black text-blue-500 uppercase tracking-tighter mt-1">{u.cargo}</div></td><td className="p-5 text-xs text-slate-500 font-medium">{u.agencias}</td><td className="p-5 font-mono text-slate-400 text-[10px] tracking-widest bg-slate-50 rounded p-1 mx-2">{u.pass}</td><td className="p-5"><span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${u.role === 'admin' ? 'bg-rose-50 text-rose-700 border-rose-100' : u.role === 'manager' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{u.role}</span></td><td className="p-5 text-right space-x-2"><button onClick={() => { setEditingUser(u); setFormUser(u); setShowModalUser(true); }} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 shadow-sm transition-all"><Edit3 size={16}/></button><button onClick={() => deleteUser(u.id)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-rose-600 shadow-sm transition-all"><Trash2 size={16}/></button></td></tr>))}</tbody></table></div></div>
          </div>
        )}
      </main>

      {/* MODALES */}
      {showModalUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"><div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 border border-slate-100"><div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-black text-slate-900 tracking-tight">{editingUser ? 'Editar Perfil' : 'Nuevo Colaborador'}</h3><button onClick={() => setShowModalUser(false)} className="text-slate-400 bg-slate-50 hover:bg-rose-50 hover:text-rose-500 p-2 rounded-full transition-colors"><X size={20}/></button></div><form onSubmit={saveUser} className="space-y-5"><InputGroup label="Nombre" value={formUser.nombre} onChange={v => setFormUser({...formUser, nombre: v})} /><InputGroup label="Cargo" value={formUser.cargo} onChange={v => setFormUser({...formUser, cargo: v})} /><InputGroup label="Agencias (Separar por coma)" value={formUser.agencias} onChange={v => setFormUser({...formUser, agencias: v})} /><InputGroup label="Contraseña" value={formUser.pass} onChange={v => setFormUser({...formUser, pass: v})} /><div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-2 block mb-1">Rol</label><select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-sm" value={formUser.role} onChange={e => setFormUser({...formUser, role: e.target.value})}><option value="comercial">Comercial</option><option value="manager">Manager</option><option value="admin">Admin</option></select></div><button type="submit" className="w-full bg-slate-900 text-white font-black p-4 rounded-xl shadow-lg mt-6 hover:bg-blue-600 transition-all uppercase tracking-widest text-xs">Guardar</button></form></div></div>
      )}
      {showModalCita && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"><div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 border border-slate-100"><div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-black text-slate-900 tracking-tight">{editingCitaId ? 'Editar Cita' : 'Agendar Cita'}</h3><button onClick={() => {setShowModalCita(false); setEditingCitaId(null);}} className="text-slate-400 bg-slate-50 hover:bg-rose-50 hover:text-rose-500 p-2 rounded-full transition-colors"><X size={20}/></button></div><form onSubmit={guardarCita} className="space-y-5">
          <div className="space-y-1 text-left"><label className="text-[10px] font-black uppercase text-slate-400 ml-2 block mb-1">Agencia</label>{!isCustomAgencia ? (<select required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-sm" value={nuevaCita.agencia} onChange={e => e.target.value === 'otra' ? setIsCustomAgencia(true) : setNuevaCita({...nuevaCita, agencia: e.target.value})}><option value="">Selecciona...</option>{misAgencias.map(a => <option key={a} value={a}>{a}</option>)}<option value="otra">+ Otra...</option></select>) : (<div className="flex gap-2"><input required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-sm" value={nuevaCita.agencia} onChange={e => setNuevaCita({...nuevaCita, agencia: e.target.value})} /><button type="button" onClick={() => setIsCustomAgencia(false)} className="bg-rose-50 text-rose-500 px-4 rounded-xl font-bold"><X size={16}/></button></div>)}</div>
          <InputGroup label="Cuenta" value={nuevaCita.cuenta} onChange={v => setNuevaCita({...nuevaCita, cuenta: v})} /><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Día</label><input type="date" required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-sm [color-scheme:light]" value={nuevaCita.fechaCruda} onChange={e => setNuevaCita({...nuevaCita, fechaCruda: e.target.value, semana: obtenerRangoSemana(e.target.value)})} onClick={(e) => e.target.showPicker && e.target.showPicker()} /></div><div><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Semana</label><input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-[10px] text-slate-400 outline-none" value={nuevaCita.semana} readOnly required /></div></div><InputGroup label="Contacto" value={nuevaCita.persona} onChange={v => setNuevaCita({...nuevaCita, persona: v})} /><button type="submit" className="w-full bg-blue-600 text-white font-black p-4 rounded-xl shadow-lg mt-6 hover:bg-blue-700 transition-all uppercase tracking-widest text-xs">Guardar</button></form></div></div>
      )}
    </div>
  );
}

function SidebarBtn({ id, icon: Icon, label, active, onClick }) {
  const isAct = active === id;
  return (<button onClick={() => onClick(id)} className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all ${isAct ? 'bg-blue-600 text-white shadow-md font-bold' : 'text-slate-400 hover:bg-slate-900 hover:text-white font-medium'}`}><Icon size={18} className={isAct ? 'text-blue-200' : 'text-slate-500'} /> {label}</button>);
}

function KpiCard({ icon: Icon, color, label, value }) {
  const c = { blue: "bg-blue-50 text-blue-600 border-blue-100", green: "bg-green-50 text-green-600 border-green-100", amber: "bg-amber-50 text-amber-600 border-amber-100", purple: "bg-purple-50 text-purple-600 border-purple-100", indigo: "bg-indigo-50 text-indigo-600 border-indigo-100" };
  return (
    <div className="flex-1 min-w-[250px] xl:min-w-[210px] bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3"><div className={`p-3 rounded-2xl border ${c[color]}`}><Icon size={20} /></div><span className="text-slate-400 font-bold text-[10px] md:text-xs uppercase tracking-widest whitespace-nowrap">{label}</span></div>
      <div className="text-2xl md:text-[23px] lg:text-[25px] xl:text-[28px] font-black text-slate-900 tracking-tighter whitespace-nowrap overflow-hidden">{value}</div>
    </div>
  );
}

function InputGroup({ label, value, onChange, placeholder = "" }) {
  return (<div className="space-y-1 text-left"><label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest block mb-1">{label}</label><input required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} /></div>);
}