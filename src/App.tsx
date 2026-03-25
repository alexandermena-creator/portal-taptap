import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  LayoutDashboard, FileText, Calendar, Users, Plus, TrendingUp, 
  CheckCircle2, Clock, ChevronRight, X, Building2, User, Lock, LogOut, Eye, EyeOff, ShieldCheck, Edit3, Trash2, Download
} from 'lucide-react';

// --- 1. CONFIGURACIÓN DE FIREBASE (Con Protección Anti-Crashes) ---
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

// Inicialización segura para evitar "doble init" en Vite
let app, auth, db;
try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Error inicializando Firebase:", error);
}

const appId = typeof __app_id !== 'undefined' ? __app_id : "1";

// --- 2. TRADUCTOR DE MANAGERS (DRIVE -> PORTAL) ---
const mapManagerToVendedor = (vendedorRaw) => {
  if (!vendedorRaw) return 'Sin Asignar';
  const name = String(vendedorRaw).toLowerCase();
  
  // Captura todas las variantes posibles de los nombres en el Drive
  if (name.includes('monse') || name.includes('mont') || name.includes('cortina')) return 'Alexander Mena';
  if (name.includes('estefania') || name.includes('estef') || name.includes('cordoba')) return 'Berenisse López';
  if (name.includes('dania') || name.includes('topete')) return 'David Vanegas';
  if (name.includes('alberto') || name.includes('bautista')) return 'Alberto Bautista';
  if (name.includes('orma') || name.includes('ormazabal') || name.includes('javi o')) return 'Javier Ormazabal';
  if (name.includes('velazquez') || name.includes('velázquez') || name.includes('javi v')) return 'Javier Velazquez';
  
  return String(vendedorRaw); 
};

const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
};

const parseMonto = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // Elimina signos de pesos, comas y espacios. Deja solo números y puntos decimales.
  const limpiado = String(val).replace(/[^0-9.-]+/g, "");
  return Number(limpiado) || 0;
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); 
  const [usuarios, setUsuarios] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [propuestas, setPropuestas] = useState([]);
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtro Global
  const [filtroVendedor, setFiltroVendedor] = useState('Todos');

  // Modales
  const [showModalCita, setShowModalCita] = useState(false);
  const [showModalUser, setShowModalUser] = useState(false);
  
  // Login State
  const [showPassword, setShowPassword] = useState(false);
  const [loginForm, setLoginForm] = useState({ user: '', pass: '' });
  const [loginError, setLoginError] = useState('');
  const [userAuth, setUserAuth] = useState(null);

  // Formularios
  const [editingUser, setEditingUser] = useState(null);
  const [formUser, setFormUser] = useState({ nombre: '', pass: '', role: 'comercial', cargo: '', agencias: '' });
  const [nuevaCita, setNuevaCita] = useState({ agencia: '', vendedor: '', fechaCruda: '', semana: '', persona: '', cuenta: '' });

  // Inicialización de Autenticación
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { 
        console.error("Error de Auth:", e); 
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUserAuth);
    return () => unsubscribe();
  }, []);

  // Carga de Datos y Semilla del Equipo
  useEffect(() => {
    if (!userAuth || !db) return;

    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'usuarios'), (snap) => {
      if (snap.empty) {
        // SEMILLA MAESTRA DEL EQUIPO
        const equipoInicial = [
          { nombre: "Alexander Mena", pass: "alex2026", role: "admin", cargo: "Admin & Comercial", agencias: "Dentsu, Havas, Mid Market" },
          { nombre: "Berenisse López", pass: "bere2026", role: "comercial", cargo: "Comercial", agencias: "Publicis, WPP, Mid Market" },
          { nombre: "David Vanegas", pass: "david2026", role: "comercial", cargo: "Comercial", agencias: "OMG, IPG, Mid Market" },
          { nombre: "Alberto Bautista", pass: "alberto2026", role: "manager", cargo: "VP Revenue México", agencias: "Estrategia Nacional" },
          { nombre: "Javier Ormazabal", pass: "javiorma2026", role: "manager", cargo: "SVP REVENUE LATAM", agencias: "Cuentas Regionales" },
          { nombre: "Javier Velazquez", pass: "javiv2026", role: "manager", cargo: "SVP GLOBAL BUSINESS SOLUTIONS", agencias: "Global Partners" }
        ];
        equipoInicial.forEach(u => addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'usuarios'), u).catch(console.error));
      }
      setUsuarios(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => console.error("Error cargando usuarios:", error));

    const unsubProp = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'propuestas'), (snap) => {
      setPropuestas(snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          vendedor: mapManagerToVendedor(d.vendedor),
          montoEnviado: parseMonto(d.montoEnviado),
          montoCerrado: parseMonto(d.montoCerrado)
        };
      }));
    }, (error) => console.error("Error cargando propuestas:", error));

    const unsubCitas = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'citas'), (snap) => {
      setCitas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setLoading(false);
    }, (error) => console.error("Error cargando citas:", error));

    return () => { unsubUsers(); unsubProp(); unsubCitas(); };
  }, [userAuth]);

  // Manejo del Login
  const handleLogin = (e) => {
    e.preventDefault();
    const found = usuarios.find(u => u.nombre === loginForm.user && u.pass === loginForm.pass);
    if (found) {
      setCurrentUser(found);
      setIsLoggedIn(true);
      setLoginError('');
      if (found.role === 'comercial') {
        setFiltroVendedor(found.nombre);
      } else {
        setFiltroVendedor('Todos');
      }
    } else {
      setLoginError('Usuario o contraseña incorrectos');
    }
  };

  // Guardar Usuarios (Control Maestro)
  const saveUser = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'usuarios', editingUser.id), formUser);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'usuarios'), formUser);
      }
      setShowModalUser(false);
      setEditingUser(null);
      setFormUser({ nombre: '', pass: '', role: 'comercial', cargo: '', agencias: '' });
    } catch (err) { console.error("Error al guardar usuario:", err); }
  };

  const deleteUser = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este acceso?')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'usuarios', id));
      } catch (err) { console.error("Error al eliminar:", err); }
    }
  };

  const guardarCita = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'citas'), {
        ...nuevaCita,
        vendedor: currentUser?.nombre || 'Desconocido',
        createdAt: Date.now()
      });
      setShowModalCita(false);
      setNuevaCita({ agencia: '', vendedor: '', fechaCruda: '', semana: '', persona: '', cuenta: '' });
    } catch (err) { console.error("Error al guardar cita:", err); }
  };

  // --- LÓGICA DE FILTRADO SEGURO ---
  const isMaster = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const propuestasFiltradas = useMemo(() => {
    if (!isMaster) return propuestas.filter(p => p.vendedor === currentUser?.nombre);
    if (filtroVendedor === 'Todos') return propuestas;
    return propuestas.filter(p => p.vendedor === filtroVendedor);
  }, [propuestas, currentUser, isMaster, filtroVendedor]);

  const citasFiltradas = useMemo(() => {
    if (!isMaster) return citas.filter(c => c.vendedor === currentUser?.nombre);
    if (filtroVendedor === 'Todos') return citas;
    return citas.filter(c => c.vendedor === filtroVendedor);
  }, [citas, currentUser, isMaster, filtroVendedor]);

  const stats = useMemo(() => {
    const totalEnviado = propuestasFiltradas.reduce((acc, p) => acc + (Number(p.montoEnviado) || 0), 0);
    const totalCerrado = propuestasFiltradas.reduce((acc, p) => acc + (Number(p.montoCerrado) || 0), 0);
    
    const targetUsers = filtroVendedor === 'Todos' 
      ? usuarios.filter(u => u.role === 'comercial' || u.nombre === "Alexander Mena")
      : usuarios.filter(u => u.nombre === filtroVendedor);

    const chartData = targetUsers.map(u => ({
      name: String(u.nombre || '').split(' ')[0],
      propuestas: Number(propuestas.filter(p => p.vendedor === u.nombre).reduce((acc, p) => acc + (Number(p.montoEnviado) || 0), 0)),
      citas: Number(citas.filter(c => c.vendedor === u.nombre).length)
    }));

    return { 
      totalEnviado, 
      totalCerrado, 
      countCitas: citasFiltradas.length, 
      chartData 
    };
  }, [propuestasFiltradas, citasFiltradas, propuestas, citas, usuarios, filtroVendedor]);

  // --- EXPORTAR A CSV SEGURO ---
  const downloadCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]).filter(k => !['id', 'createdAt'].includes(k));
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header];
        const escaped = String(val || '').replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  // --- VISTA: LOGIN ---
  if (!isLoggedIn || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans text-center">
        <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-10 space-y-8 animate-in zoom-in duration-300">
          <div>
            <img src="/logo.png" alt="TapTap Logo" className="h-12 mx-auto mb-6 object-contain" />
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Portal Comercial</h1>
            <p className="text-slate-400 font-medium">Equipo de Ingresos TapTap</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Colaborador</label>
              <select className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                      value={loginForm.user} onChange={e => setLoginForm({...loginForm, user: e.target.value})} required>
                <option value="">Selecciona tu perfil...</option>
                {[...usuarios].sort((a,b) => String(a.nombre || '').localeCompare(String(b.nombre || ''))).map(u => <option key={u.id} value={u.nombre}>{u.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Contraseña</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all pl-12"
                       placeholder="••••••••" value={loginForm.pass} onChange={e => setLoginForm({...loginForm, pass: e.target.value})} required />
                <Lock className="absolute left-4 top-4 text-slate-300" size={20} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-slate-300 hover:text-slate-500">
                  {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                </button>
              </div>
            </div>
            {loginError && <div className="p-3 bg-rose-50 text-rose-500 text-xs font-bold rounded-xl">{loginError}</div>}
            <button type="submit" className="w-full bg-slate-900 text-white font-black p-5 rounded-2xl shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3">
              Entrar al Portal <ChevronRight size={20} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- VISTA: APLICACIÓN PRINCIPAL ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-950 text-white p-6 flex flex-col shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <img src="/logo.png" alt="TapTap" className="h-8 md:h-10 object-contain invert brightness-0" style={{ filter: 'brightness(0) invert(1)' }} />
        </div>

        <nav className="space-y-2 flex-1">
          <SidebarBtn id="dashboard" icon={LayoutDashboard} label="Dashboard" active={activeTab} onClick={setActiveTab} />
          <SidebarBtn id="pipe" icon={FileText} label="Pipe (Drive)" active={activeTab} onClick={setActiveTab} />
          <SidebarBtn id="citas" icon={Calendar} label="Agenda Citas" active={activeTab} onClick={setActiveTab} />
          
          {currentUser?.role === 'admin' && (
            <SidebarBtn id="admin" icon={ShieldCheck} label="Control Maestro" active={activeTab} onClick={setActiveTab} />
          )}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
          <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-black text-xs">{String(currentUser?.nombre || '?').charAt(0)}</div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate leading-none mb-1">{String(currentUser?.nombre || '')}</p>
              <p className="text-[8px] text-blue-400 font-black uppercase tracking-widest truncate">{String(currentUser?.cargo || '')}</p>
            </div>
          </div>
          <button onClick={() => { setIsLoggedIn(false); setCurrentUser(null); }} className="flex items-center gap-2 text-xs font-black text-rose-400 hover:text-rose-300 transition-colors w-full justify-center p-2 rounded-xl hover:bg-slate-900">
            <LogOut size={14} /> CERRAR SESIÓN
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto bg-slate-50">
        
        {/* Cabecera Inteligente */}
        <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div>
            <h2 className="text-3xl font-black tracking-tight leading-none mb-2">Hola, {String(currentUser?.nombre || '').split(' ')[0]} 👋</h2>
            <p className="text-slate-500 text-sm font-medium">Asignación: <span className="text-blue-600 font-bold">{String(currentUser?.agencias || '')}</span></p>
          </div>
          
          {isMaster && (
            <div className="w-full md:w-auto flex flex-col md:flex-row items-center gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Viendo métricas de:</span>
              <select 
                className="w-full md:w-64 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                value={filtroVendedor}
                onChange={e => setFiltroVendedor(e.target.value)}
              >
                <option value="Todos">🚀 Todo el Equipo</option>
                {usuarios.filter(u => u.role === 'comercial' || u.role === 'admin').map(u => (
                  <option key={u.id} value={String(u.nombre || '')}>{String(u.nombre || '')}</option>
                ))}
              </select>
            </div>
          )}
        </header>

        {/* TAB: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KpiCard icon={Clock} color="blue" label="Revenue Pipe" value={formatCurrency(stats.totalEnviado)} />
              <KpiCard icon={CheckCircle2} color="green" label="Total Cerrado" value={formatCurrency(stats.totalCerrado)} />
              <KpiCard icon={Calendar} color="amber" label="Citas Activas" value={stats.countCitas} />
            </div>

            {isMaster && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-900 mb-6">💰 Revenue por Comercial</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="propuestas" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-900 mb-6">🗓️ Citas Semanales</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="citas" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: PIPE DE DRIVE */}
        {activeTab === 'pipe' && (
          <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <h2 className="text-3xl font-black italic tracking-tight uppercase">Pipe de Drive</h2>
              <button 
                onClick={() => downloadCSV(propuestasFiltradas, 'Pipe_Propuestas')}
                className="bg-white border border-slate-200 text-slate-700 font-bold px-5 py-3 rounded-xl flex items-center gap-2 shadow-sm hover:bg-slate-50 transition-all text-sm"
              >
                <Download size={16} /> Descargar CSV
              </button>
            </div>
            
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  <tr><th className="p-5">Fecha</th><th className="p-5">Campaña</th><th className="p-5">Manager</th><th className="p-5 text-right">Monto</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {propuestasFiltradas.length === 0 ? (
                    <tr><td colSpan="4" className="p-10 text-center text-slate-400 font-bold">No hay propuestas registradas.</td></tr>
                  ) : propuestasFiltradas.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-5 text-slate-400 font-medium">{String(p.fechaCruda || '')}</td>
                      <td className="p-5 font-bold text-slate-800">{String(p.nombre || '')}</td>
                      <td className="p-5"><span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-tighter">{String(p.vendedor || '')}</span></td>
                      <td className="p-5 font-black text-slate-900 text-right">{formatCurrency(p.montoEnviado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: AGENDA CITAS */}
        {activeTab === 'citas' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-3xl font-black italic tracking-tight">Agenda Semanal</h2>
              <div className="flex gap-3 w-full md:w-auto">
                <button 
                  onClick={() => downloadCSV(citasFiltradas, 'Agenda_Citas')}
                  className="bg-white border border-slate-200 text-slate-700 font-bold px-5 py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 transition-all text-sm w-full md:w-auto"
                >
                  <Download size={16} /> CSV
                </button>
                <button onClick={() => setShowModalCita(true)} className="bg-blue-600 text-white font-black px-6 py-3 rounded-xl flex items-center justify-center gap-2 shadow-xl hover:scale-105 transition-all font-sans w-full md:w-auto">
                  <Plus size={20} /> Registrar Cita
                </button>
              </div>
            </header>
            
            {citasFiltradas.length === 0 ? (
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 text-center shadow-sm">
                <p className="text-slate-400 font-bold">No hay citas agendadas para el filtro actual.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {citasFiltradas.map(c => (
                  <div key={c.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:border-blue-400 transition-all group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="bg-slate-50 p-4 rounded-3xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all"><Building2 size={24} /></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">{String(c.semana || '')}</span>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 leading-tight mb-2">{String(c.agencia || '')}</h4>
                    <p className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-tighter leading-none">{String(c.cuenta || '')}</p>
                    <div className="pt-6 border-t border-slate-50 space-y-4">
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-600"><User size={14} className="text-blue-500" /> {String(c.vendedor || '')}</div>
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-600"><Calendar size={14} className="text-slate-400" /> {String(c.fechaCruda || '')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: CONTROL MAESTRO (Solo Admin) */}
        {activeTab === 'admin' && currentUser?.role === 'admin' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <header className="flex justify-between items-center">
              <div><h2 className="text-3xl font-black italic tracking-tight text-slate-900 uppercase">Control Maestro</h2><p className="text-slate-500 font-medium font-sans">Gestión de cargos, roles y accesos.</p></div>
              <button onClick={() => { setEditingUser(null); setFormUser({ nombre: '', pass: '', role: 'comercial', cargo: '', agencias: '' }); setShowModalUser(true); }} className="bg-blue-600 text-white font-black px-6 py-4 rounded-2xl flex items-center gap-2 shadow-xl hover:scale-105 transition-all"><Plus size={20} /> Nuevo Perfil</button>
            </header>
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    <th className="p-5">Colaborador / Cargo</th>
                    <th className="p-5">Asignación</th>
                    <th className="p-5">Pass</th>
                    <th className="p-5">Rol / Nivel</th>
                    <th className="p-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuarios.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-5">
                        <div className="font-bold text-slate-900">{String(u.nombre || '')}</div>
                        <div className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">{String(u.cargo || '')}</div>
                      </td>
                      <td className="p-5 text-xs text-slate-500 font-medium">{String(u.agencias || '')}</td>
                      <td className="p-5 font-mono text-slate-400 text-[10px] tracking-widest">{String(u.pass || '')}</td>
                      <td className="p-5">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          u.role === 'admin' ? 'bg-rose-100 text-rose-600' : 
                          u.role === 'manager' ? 'bg-amber-100 text-amber-600' : 
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {u.role === 'manager' ? 'Directivo' : String(u.role || '')}
                        </span>
                      </td>
                      <td className="p-5 text-right space-x-2">
                        <button onClick={() => { setEditingUser(u); setFormUser(u); setShowModalUser(true); }} className="p-2 text-slate-400 hover:text-blue-600"><Edit3 size={18}/></button>
                        <button onClick={() => deleteUser(u.id)} className="p-2 text-slate-400 hover:text-rose-600"><Trash2 size={18}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: CONTROL MAESTRO (EDITAR/CREAR USUARIO) */}
      {showModalUser && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden p-10">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black tracking-tight">{editingUser ? 'Editar Perfil' : 'Nuevo Colaborador'}</h3>
              <button onClick={() => setShowModalUser(false)} className="text-slate-300 hover:text-slate-900"><X size={24}/></button>
            </div>
            <form onSubmit={saveUser} className="space-y-4 font-sans">
              <InputGroup label="Nombre" value={formUser.nombre} onChange={v => setFormUser({...formUser, nombre: v})} />
              <InputGroup label="Cargo Oficial" value={formUser.cargo} onChange={v => setFormUser({...formUser, cargo: v})} placeholder="Ej. VP Revenue México" />
              <InputGroup label="Agencias Asignadas" value={formUser.agencias} onChange={v => setFormUser({...formUser, agencias: v})} placeholder="Ej. Publicis, WPP..." />
              <InputGroup label="Contraseña" value={formUser.pass} onChange={v => setFormUser({...formUser, pass: v})} />
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Nivel de Acceso (Rol)</label>
                <select className="w-full bg-slate-50 rounded-2xl p-4 font-bold text-sm outline-none" value={formUser.role} onChange={e => setFormUser({...formUser, role: e.target.value})}>
                  <option value="comercial">Comercial (Solo ve lo suyo)</option>
                  <option value="manager">Directivo / Manager (Ve todo el equipo)</option>
                  <option value="admin">Administrador (Control Total + Usuarios)</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white font-black p-5 rounded-2xl shadow-xl mt-4 hover:bg-blue-600 transition-all uppercase tracking-widest text-xs">Guardar Perfil</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR CITA */}
      {showModalCita && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden p-10">
            <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-black tracking-tight">Agendar Cita</h3><button onClick={() => setShowModalCita(false)} className="text-slate-300 hover:text-slate-900"><X size={24}/></button></div>
            <form onSubmit={guardarCita} className="space-y-4">
              <InputGroup label="Agencia / Partner" value={nuevaCita.agencia} onChange={v => setNuevaCita({...nuevaCita, agencia: v})} />
              <InputGroup label="Marca / Cuenta" value={nuevaCita.cuenta} onChange={v => setNuevaCita({...nuevaCita, cuenta: v})} />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-left"><label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Día</label><input type="date" required className="w-full bg-slate-50 rounded-2xl p-4 font-bold text-sm outline-none" value={nuevaCita.fechaCruda} onChange={e => setNuevaCita({...nuevaCita, fechaCruda: e.target.value})} /></div>
                <div className="space-y-1 text-left"><label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Semana</label><input className="w-full bg-slate-50 rounded-2xl p-4 font-bold text-sm outline-none" placeholder="23 al 27 Mar" value={nuevaCita.semana} onChange={e => setNuevaCita({...nuevaCita, semana: e.target.value})} required /></div>
              </div>
              <InputGroup label="Contacto" value={nuevaCita.persona} onChange={v => setNuevaCita({...nuevaCita, persona: v})} />
              <button type="submit" className="w-full bg-slate-900 text-white font-black p-5 rounded-2xl shadow-xl mt-4 hover:bg-blue-600 transition-all uppercase tracking-widest text-xs">Guardar en Agenda</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUBCOMPONENTES ---
function SidebarBtn({ id, icon: Icon, label, active, onClick }) {
  const isAct = active === id;
  return (
    <button onClick={() => onClick(id)} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${isAct ? 'bg-blue-600 shadow-lg shadow-blue-600/30 font-bold' : 'text-slate-500 hover:bg-slate-900 hover:text-white'}`}>
      <Icon size={18} /> {label}
    </button>
  );
}

function KpiCard({ icon: Icon, color, label, value }) {
  const colors = { blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600", amber: "bg-amber-50 text-amber-600" };
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center gap-3 justify-center md:justify-start">
        <div className={`p-3 rounded-2xl ${colors[color]}`}><Icon size={20} /></div>
        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-2xl font-black text-slate-900 tracking-tight text-center md:text-left">{value}</div>
    </div>
  );
}

function InputGroup({ label, value, onChange, placeholder = "" }) {
  return (
    <div className="space-y-1 text-left">
      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">{label}</label>
      <input required className="w-full bg-slate-50 rounded-2xl p-4 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-sans" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}