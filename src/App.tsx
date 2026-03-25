import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, setDoc, query, getDocs } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { 
  LayoutDashboard, FileText, Calendar, Users, Plus, TrendingUp, 
  CheckCircle2, Clock, ChevronRight, X, Building2, User, Lock, LogOut, Eye, EyeOff, ShieldCheck, Edit3, Trash2, Briefcase
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- TRADUCTOR DE MANAGERS (DRIVE -> PORTAL) ---
const mapManagerToVendedor = (vendedorRaw) => {
  if (!vendedorRaw) return 'Sin Asignar';
  const name = String(vendedorRaw).toLowerCase();
  if (name.includes('monserrat') || name.includes('mont') || name.includes('cortina')) return 'Alexander Mena';
  if (name.includes('estefania') || name.includes('estef') || name.includes('cordoba')) return 'Berenisse López';
  if (name.includes('dania') || name.includes('topete')) return 'David Vanegas';
  if (name.includes('alberto') || name.includes('bautista')) return 'Alberto Bautista';
  if (name.includes('orma') || name.includes('ormazabal')) return 'Javier Ormazabal';
  if (name.includes('velazquez') || name.includes('velázquez')) return 'Javier Velazquez';
  return vendedorRaw; 
};

const formatCurrency = (val) => {
  const num = parseFloat(val) || 0;
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); 
  const [usuarios, setUsuarios] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [propuestas, setPropuestas] = useState([]);
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('team'); // 'team' o 'personal' para Admins

  // Modales
  const [showModalCita, setShowModalCita] = useState(false);
  const [showModalUser, setShowModalUser] = useState(false);
  
  // Login State
  const [showPassword, setShowPassword] = useState(false);
  const [loginForm, setLoginForm] = useState({ user: '', pass: '' });
  const [loginError, setLoginError] = useState('');
  const [userAuth, setUserAuth] = useState(null);

  // Formulario Usuarios
  const [editingUser, setEditingUser] = useState(null);
  const [formUser, setFormUser] = useState({ nombre: '', pass: '', role: 'comercial', cargo: '', agencias: '' });

  // Formulario Citas
  const [nuevaCita, setNuevaCita] = useState({ agencia: '', vendedor: '', fechaCruda: '', semana: '', persona: '', cuenta: '' });

  // 1. Inicialización de Autenticación
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error("Error de Auth:", e); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUserAuth);
    return () => unsubscribe();
  }, []);

  // 2. Carga de Datos y Semilla del Equipo Completo
  useEffect(() => {
    if (!userAuth) return;

    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'usuarios'), (snap) => {
      if (snap.empty) {
        // SEMILLA MAESTRA DEL EQUIPO
        const equipoInicial = [
          { nombre: "Alexander Mena", pass: "alex2026", role: "admin", cargo: "Admin & Comercial", agencias: "Dentsu, Havas, Mid Market" },
          { nombre: "Berenisse López", pass: "bere2026", role: "comercial", cargo: "Comercial", agencias: "Publicis, WPP, Mid Market" },
          { nombre: "David Vanegas", pass: "david2026", role: "comercial", cargo: "Comercial", agencias: "OMG, IPG, Mid Market" },
          { nombre: "Alberto Bautista", pass: "alberto2026", role: "admin", cargo: "VP Revenue México", agencias: "Estrategia Nacional" },
          { nombre: "Javier Ormazabal", pass: "javiorma2026", role: "comercial", cargo: "SVP REVENUE LATAM", agencias: "Cuentas Regionales" },
          { nombre: "Javier Velazquez", pass: "javiv2026", role: "comercial", cargo: "SVP GLOBAL BUSINESS SOLUTIONS", agencias: "Global Partners" }
        ];
        equipoInicial.forEach(u => addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'usuarios'), u));
      }
      setUsuarios(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubProp = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'propuestas'), (snap) => {
      setPropuestas(snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          vendedor: mapManagerToVendedor(d.vendedor),
          montoEnviado: parseFloat(d.montoEnviado) || 0,
          montoCerrado: parseFloat(d.montoCerrado) || 0
        };
      }));
    });

    const unsubCitas = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'citas'), (snap) => {
      setCitas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setLoading(false);
    });

    return () => { unsubUsers(); unsubProp(); unsubCitas(); };
  }, [userAuth]);

  const handleLogin = (e) => {
    e.preventDefault();
    const found = usuarios.find(u => u.nombre === loginForm.user && u.pass === loginForm.pass);
    if (found) {
      setCurrentUser(found);
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Usuario o contraseña incorrectos');
    }
  };

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
    } catch (err) { console.error(err); }
  };

  const deleteUser = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este acceso?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'usuarios', id));
    }
  };

  const guardarCita = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'citas'), {
        ...nuevaCita,
        vendedor: currentUser.nombre,
        createdAt: Date.now()
      });
      setShowModalCita(false);
      setNuevaCita({ agencia: '', vendedor: '', fechaCruda: '', semana: '', persona: '', cuenta: '' });
    } catch (err) { console.error(err); }
  };

  const stats = useMemo(() => {
    const isMaster = currentUser?.role === 'admin' && viewMode === 'team';
    const dataFiltrada = isMaster ? propuestas : propuestas.filter(p => p.vendedor === currentUser.nombre);

    const totalEnviado = dataFiltrada.reduce((acc, p) => acc + p.montoEnviado, 0);
    const totalCerrado = dataFiltrada.reduce((acc, p) => acc + p.montoCerrado, 0);
    
    const chartData = usuarios
      .map(u => ({
        name: u.nombre.split(' ')[0],
        propuestas: propuestas.filter(p => p.vendedor === u.nombre).reduce((acc, p) => acc + p.montoEnviado, 0),
        citas: citas.filter(c => c.vendedor === u.nombre).length
      }));

    return { totalEnviado, totalCerrado, countCitas: citas.filter(c => isMaster || c.vendedor === currentUser.nombre).length, chartData };
  }, [propuestas, citas, currentUser, usuarios, viewMode]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans text-center">
        <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-10 space-y-8 animate-in zoom-in duration-300">
          <div>
            <img src="https://taptapdigital.com/wp-content/uploads/2021/04/logo_taptap.png" alt="TapTap Logo" className="h-10 mx-auto mb-6" />
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Portal Comercial</h1>
            <p className="text-slate-400 font-medium">Equipo de Ingresos TapTap</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Colaborador</label>
              <select className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                      value={loginForm.user} onChange={e => setLoginForm({...loginForm, user: e.target.value})} required>
                <option value="">Selecciona tu perfil...</option>
                {usuarios.sort((a,b) => a.nombre.localeCompare(b.nombre)).map(u => <option key={u.id} value={u.nombre}>{u.nombre}</option>)}
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-950 text-white p-6 flex flex-col shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-blue-600 p-2 rounded-xl"><TrendingUp size={20} /></div>
          <h1 className="text-xl font-bold tracking-tight italic">TapTap <span className="text-blue-500">Hub</span></h1>
        </div>

        <nav className="space-y-2 flex-1">
          <SidebarBtn id="dashboard" icon={LayoutDashboard} label="Dashboard" active={activeTab} onClick={setActiveTab} />
          <SidebarBtn id="pipe" icon={FileText} label="Pipe (Drive)" active={activeTab} onClick={setActiveTab} />
          <SidebarBtn id="citas" icon={Calendar} label="Agenda Citas" active={activeTab} onClick={setActiveTab} />
          {currentUser.role === 'admin' && (
            <SidebarBtn id="admin" icon={ShieldCheck} label="Control Maestro" active={activeTab} onClick={setActiveTab} />
          )}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
          <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-2xl">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-black text-xs">{currentUser.nombre.charAt(0)}</div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate leading-none mb-1">{currentUser.nombre}</p>
              <p className="text-[8px] text-blue-400 font-black uppercase tracking-widest truncate">{currentUser.cargo}</p>
            </div>
          </div>
          <button onClick={() => setIsLoggedIn(false)} className="flex items-center gap-2 text-xs font-black text-rose-400 hover:text-rose-300 transition-colors">
            <LogOut size={14} /> CERRAR SESIÓN
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto bg-slate-50">
        
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-3xl font-black tracking-tight">Hola, {currentUser.nombre.split(' ')[0]}</h2>
                <p className="text-slate-500 font-medium">Asignación: <span className="text-blue-600 font-bold">{currentUser.agencias}</span></p>
              </div>
              {currentUser.role === 'admin' && (
                <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-200 flex">
                  <button onClick={() => setViewMode('team')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all ${viewMode === 'team' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}>Equipo</button>
                  <button onClick={() => setViewMode('personal')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight transition-all ${viewMode === 'personal' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}>Mi Pipe</button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KpiCard icon={Clock} color="blue" label="Revenue Pipe" value={formatCurrency(stats.totalEnviado)} />
              <KpiCard icon={CheckCircle2} color="green" label="Total Cerrado" value={formatCurrency(stats.totalCerrado)} />
              <KpiCard icon={Calendar} color="amber" label="Citas Activas" value={stats.countCitas} />
            </div>

            {currentUser.role === 'admin' && viewMode === 'team' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-900 mb-6">💰 Revenue por Comercial</h3>
                  <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} /><Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none'}} /><Bar dataKey="propuestas" fill="#3b82f6" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-900 mb-6">🗓️ Citas Semanales</h3>
                  <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} /><Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none'}} /><Bar dataKey="citas" fill="#f59e0b" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <header className="flex justify-between items-center">
              <div><h2 className="text-3xl font-black italic tracking-tight text-slate-900 uppercase">Control Maestro</h2><p className="text-slate-500 font-medium font-sans">Gestión de cargos y asignación de agencias.</p></div>
              <button onClick={() => { setEditingUser(null); setFormUser({ nombre: '', pass: '', role: 'comercial', cargo: '', agencias: '' }); setShowModalUser(true); }} className="bg-blue-600 text-white font-black px-6 py-4 rounded-2xl flex items-center gap-2 shadow-xl hover:scale-105 transition-all"><Plus size={20} /> Nuevo Perfil</button>
            </header>
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    <th className="p-5">Colaborador / Cargo</th>
                    <th className="p-5">Asignación</th>
                    <th className="p-5">Pass</th>
                    <th className="p-5">Rol</th>
                    <th className="p-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuarios.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-5">
                        <div className="font-bold text-slate-900">{u.nombre}</div>
                        <div className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">{u.cargo}</div>
                      </td>
                      <td className="p-5 text-xs text-slate-500 font-medium">{u.agencias}</td>
                      <td className="p-5 font-mono text-slate-400 text-[10px] tracking-widest">{u.pass}</td>
                      <td className="p-5"><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${u.role === 'admin' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>{u.role}</span></td>
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

        {activeTab === 'citas' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-3xl font-black italic tracking-tight">Agenda Semanal</h2>
              <button onClick={() => setShowModalCita(true)} className="bg-blue-600 text-white font-black px-6 py-4 rounded-2xl flex items-center gap-2 shadow-xl hover:scale-105 transition-all font-sans">
                <Plus size={20} /> Registrar Cita
              </button>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {citas.filter(c => (currentUser.role === 'admin' && viewMode === 'team') || c.vendedor === currentUser.nombre).map(c => (
                <div key={c.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 hover:border-blue-400 transition-all group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="bg-slate-50 p-4 rounded-3xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all"><Building2 size={24} /></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">{c.semana}</span>
                  </div>
                  <h4 className="text-xl font-black text-slate-900 leading-tight mb-2">{c.agencia}</h4>
                  <p className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-tighter leading-none">{c.cuenta}</p>
                  <div className="pt-6 border-t border-slate-50 space-y-4">
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-600"><User size={14} className="text-blue-500" /> {c.vendedor}</div>
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-600"><Calendar size={14} className="text-slate-400" /> {c.fechaCruda}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'pipe' && (
          <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
            <h2 className="text-3xl font-black italic tracking-tight uppercase">Pipe de Drive</h2>
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  <tr><th className="p-5">Fecha</th><th className="p-5">Campaña</th><th className="p-5">Manager</th><th className="p-5 text-right">Monto</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {propuestas.filter(p => (currentUser.role === 'admin' && viewMode === 'team') || p.vendedor === currentUser.nombre).map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-5 text-slate-400 font-medium">{p.fechaCruda}</td>
                      <td className="p-5 font-bold text-slate-800">{p.nombre}</td>
                      <td className="p-5"><span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-tighter">{p.vendedor}</span></td>
                      <td className="p-5 font-black text-slate-900 text-right">{formatCurrency(p.montoEnviado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: CONTROL MAESTRO */}
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
              <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Nivel Acceso</label><select className="w-full bg-slate-50 rounded-2xl p-4 font-bold text-sm outline-none" value={formUser.role} onChange={e => setFormUser({...formUser, role: e.target.value})}><option value="comercial">Comercial</option><option value="admin">Administrador</option></select></div>
              <button type="submit" className="w-full bg-slate-900 text-white font-black p-5 rounded-2xl shadow-xl mt-4 hover:bg-blue-600 transition-all uppercase tracking-widest text-xs">Guardar</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CITAS */}
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
              <button type="submit" className="w-full bg-slate-900 text-white font-black p-5 rounded-2xl shadow-xl mt-4 hover:bg-blue-600 transition-all uppercase tracking-widest text-xs">Guardar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

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