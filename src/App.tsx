import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  LayoutDashboard, FileText, Calendar, Users, Plus, TrendingUp, 
  CheckCircle2, Clock, ChevronRight, X, Building2, User, Lock, LogOut, Eye, EyeOff, ShieldCheck, Edit3, Trash2, Download, Activity, PieChart as PieChartIcon
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
} catch (error) {
  console.error("Error inicializando Firebase:", error);
}

const appId = typeof __app_id !== 'undefined' ? __app_id : "1";

// --- 2. CONSTANTES Y COLORES DEL EQUIPO COMERCIAL ---
const COMERCIALES = ['Alexander Mena', 'Berenisse López', 'David Vanegas'];

// Colores únicos para cada vendedor en las gráficas
const VENDEDOR_COLORS = {
  'Alexander': '#3b82f6', // Azul TapTap
  'Berenisse': '#ec4899', // Rosa
  'David': '#10b981',     // Verde Esmeralda
};

// Paleta dinámica vibrante para cualquier estatus que venga del Drive
const PALETA_ESTATUS = ['#8b5cf6', '#0ea5e9', '#f59e0b', '#f43f5e', '#10b981', '#6366f1', '#d946ef'];

// --- 3. UTILIDADES Y CALCULADORAS ---
const mapManagerToVendedor = (vendedorRaw) => {
  if (!vendedorRaw) return 'Sin Asignar';
  const name = String(vendedorRaw).toLowerCase();
  
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
  const limpiado = String(val).replace(/[^0-9.-]+/g, "");
  return Number(limpiado) || 0;
};

const parseDateStringToTime = (dateStr) => {
  if (!dateStr) return 0;
  let d = new Date(dateStr);
  if (!isNaN(d.getTime()) && String(dateStr).includes('-')) {
     d = new Date(d.getTime() + d.getTimezoneOffset() * 60000); 
  }
  if (isNaN(d.getTime()) && String(dateStr).includes('/')) {
      const parts = String(dateStr).split('/');
      if (parts.length === 3) {
          const p1 = parseInt(parts[0], 10);
          const p2 = parseInt(parts[1], 10);
          const p3 = parseInt(parts[2], 10);
          if (p3 > 1000) { 
              d = new Date(p3, p2 - 1, p1); 
              if (isNaN(d.getTime()) || d.getMonth() !== p2 - 1) {
                  d = new Date(p3, p1 - 1, p2); 
              }
          }
      }
  }
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

const obtenerRangoSemana = (fechaString) => {
  if (!fechaString) return 'Sin fecha';
  let d = new Date(fechaString);
  if (!isNaN(d.getTime()) && fechaString.includes('-')) d = new Date(d.getTime() + d.getTimezoneOffset() * 60000); 
  if (isNaN(d.getTime())) {
      if(fechaString.includes('/')){
          const [part1, part2, part3] = fechaString.split('/');
          if(part3 && part3.length === 4) {
             d = new Date(part3, part1 - 1, part2); 
             if (isNaN(d.getTime())) d = new Date(part3, part2 - 1, part1); 
          }
      }
  }
  if (isNaN(d.getTime())) return 'Sin fecha';

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

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); 
  const [usuarios, setUsuarios] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [propuestas, setPropuestas] = useState([]);
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros Globales
  const [filtroVendedor, setFiltroVendedor] = useState('Todos');
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Modales y Estados de Edición
  const [showModalCita, setShowModalCita] = useState(false);
  const [showModalUser, setShowModalUser] = useState(false);
  const [editingCitaId, setEditingCitaId] = useState(null);
  const [isCustomAgencia, setIsCustomAgencia] = useState(false);
  
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

  // Carga de Datos
  useEffect(() => {
    if (!userAuth || !db) return;

    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'usuarios'), (snap) => {
      if (snap.empty) {
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
          montoCerrado: parseMonto(d.montoCerrado),
          semana: d.semana || obtenerRangoSemana(d.fechaCruda) // Calcula la semana si no la trae Make
        };
      }));
    }, (error) => console.error("Error cargando propuestas:", error));

    const unsubCitas = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'citas'), (snap) => {
      setCitas(snap.docs.map(doc => {
        const d = doc.data();
        return { 
          id: doc.id, 
          ...d,
          semana: d.semana || obtenerRangoSemana(d.fechaCruda) 
        };
      }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
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

  // Guardar, Editar y Eliminar Citas
  const guardarCita = async (e) => {
    e.preventDefault();
    try {
      if (editingCitaId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'citas', editingCitaId), { ...nuevaCita });
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'citas'), {
          ...nuevaCita,
          vendedor: currentUser?.nombre || 'Desconocido',
          createdAt: Date.now()
        });
      }
      setShowModalCita(false);
      setEditingCitaId(null);
      setIsCustomAgencia(false);
      setNuevaCita({ agencia: '', vendedor: '', fechaCruda: '', semana: '', persona: '', cuenta: '' });
    } catch (err) { console.error("Error al guardar cita:", err); }
  };

  const openEditCita = (cita) => {
    setNuevaCita({ ...cita });
    setEditingCitaId(cita.id);
    const misAgencias = currentUser?.agencias ? String(currentUser.agencias).split(',').map(a => a.trim()) : [];
    setIsCustomAgencia(!misAgencias.includes(cita.agencia));
    setShowModalCita(true);
  };

  const deleteCita = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar permanentemente esta cita de la agenda?')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'citas', id));
      } catch (err) { console.error("Error al eliminar cita:", err); }
    }
  };

  // --- LÓGICA DE FILTRADO (Vendedor + Rango de Fechas) ---
  const isMaster = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const propuestasFiltradas = useMemo(() => {
    let filtradas = propuestas;
    if (!isMaster) filtradas = filtradas.filter(p => p.vendedor === currentUser?.nombre);
    else if (filtroVendedor !== 'Todos') filtradas = filtradas.filter(p => p.vendedor === filtroVendedor);
    
    if (filtroFechaInicio || filtroFechaFin) {
      const start = filtroFechaInicio ? parseDateStringToTime(filtroFechaInicio) : 0;
      const end = filtroFechaFin ? parseDateStringToTime(filtroFechaFin) + 86399999 : Infinity; 
      filtradas = filtradas.filter(p => {
        const t = parseDateStringToTime(p.fechaCruda);
        return t >= start && t <= end;
      });
    }
    
    return filtradas;
  }, [propuestas, currentUser, isMaster, filtroVendedor, filtroFechaInicio, filtroFechaFin]);

  const citasFiltradas = useMemo(() => {
    let filtradas = citas;
    if (!isMaster) filtradas = filtradas.filter(c => c.vendedor === currentUser?.nombre);
    else if (filtroVendedor !== 'Todos') filtradas = filtradas.filter(c => c.vendedor === filtroVendedor);
    
    if (filtroFechaInicio || filtroFechaFin) {
      const start = filtroFechaInicio ? parseDateStringToTime(filtroFechaInicio) : 0;
      const end = filtroFechaFin ? parseDateStringToTime(filtroFechaFin) + 86399999 : Infinity; 
      filtradas = filtradas.filter(c => {
        const t = parseDateStringToTime(c.fechaCruda);
        return t >= start && t <= end;
      });
    }
    
    return filtradas;
  }, [citas, currentUser, isMaster, filtroVendedor, filtroFechaInicio, filtroFechaFin]);

  // Recálculo de métricas
  const stats = useMemo(() => {
    const totalEnviado = propuestasFiltradas.reduce((acc, p) => acc + (Number(p.montoEnviado) || 0), 0);
    const totalCerrado = propuestasFiltradas.reduce((acc, p) => acc + (Number(p.montoCerrado) || 0), 0);
    const tasaBateo = totalEnviado > 0 ? ((totalCerrado / totalEnviado) * 100).toFixed(1) : 0;
    
    // Distribución del Pipe Dinámica
    const estatusMap = propuestasFiltradas.reduce((acc, p) => {
        const e = String(p.estatus || 'Sin Estatus').toUpperCase();
        if (!acc[e]) acc[e] = 0;
        // Tomamos el valor de enviado para la dona, a menos que sea un estatus que debamos ignorar o cerrar
        acc[e] += (e === 'CERRADA' && Number(p.montoCerrado)) ? Number(p.montoCerrado) : (Number(p.montoEnviado) || 0);
        return acc;
    }, {});

    const pipeStatusData = Object.keys(estatusMap).map((key, index) => ({
        name: key,
        value: estatusMap[key],
        color: PALETA_ESTATUS[index % PALETA_ESTATUS.length]
    }));

    const targetUsers = filtroVendedor === 'Todos' ? COMERCIALES : [filtroVendedor];

    const chartData = targetUsers.map(nombre => ({
      name: nombre.split(' ')[0],
      propuestas: Number(propuestasFiltradas.filter(p => p.vendedor === nombre).reduce((acc, p) => acc + (Number(p.montoEnviado) || 0), 0)),
      citas: Number(citasFiltradas.filter(c => c.vendedor === nombre).length)
    }));

    return { 
      totalEnviado, 
      totalCerrado,
      tasaBateo,
      countCitas: citasFiltradas.length, 
      chartData,
      pipeStatusData
    };
  }, [propuestasFiltradas, citasFiltradas, filtroVendedor]);

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

  // Extraer las agencias del usuario para el selector
  const misAgencias = currentUser?.agencias ? String(currentUser.agencias).split(',').map(a => a.trim()) : [];

  // --- VISTA: LOGIN ---
  if (!isLoggedIn || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans text-center">
        <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-10 space-y-8 animate-in zoom-in duration-300">
          <div>
            <img src="/logo.png" alt="TapTap Logo" className="h-12 mx-auto mb-6 object-contain" />
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Portal Comercial</h1>
            <p className="text-slate-500 font-medium mt-2">Equipo de Ingresos TapTap</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Colaborador</label>
              <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                      value={loginForm.user} onChange={e => setLoginForm({...loginForm, user: e.target.value})} required>
                <option value="">Selecciona tu perfil...</option>
                {[...usuarios].sort((a,b) => String(a.nombre || '').localeCompare(String(b.nombre || ''))).map(u => <option key={u.id} value={u.nombre}>{u.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Contraseña</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all pl-12"
                       placeholder="••••••••" value={loginForm.pass} onChange={e => setLoginForm({...loginForm, pass: e.target.value})} required />
                <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-slate-300 hover:text-slate-700">
                  {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                </button>
              </div>
            </div>
            {loginError && <div className="p-3 bg-rose-50 text-rose-500 text-xs font-bold rounded-xl">{loginError}</div>}
            <button type="submit" className="w-full bg-blue-600 text-white font-black p-4 rounded-2xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-3">
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
      <aside className="w-full md:w-64 bg-slate-950 text-white p-6 flex flex-col shrink-0 border-r border-slate-800">
        <div className="flex items-center justify-center md:justify-start gap-3 mb-10">
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
          <div className="flex items-center gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800 shadow-inner">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-black text-sm text-white shrink-0 shadow-md">
              {String(currentUser?.nombre || '?').charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate leading-tight">{String(currentUser?.nombre || '')}</p>
              <p className="text-[9px] text-blue-400 font-black uppercase tracking-widest truncate mt-0.5">{String(currentUser?.cargo || '')}</p>
            </div>
          </div>
          <button onClick={() => { setIsLoggedIn(false); setCurrentUser(null); }} className="flex items-center justify-center gap-2 text-xs font-black text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-all w-full p-3 rounded-xl border border-transparent hover:border-rose-900/50">
            <LogOut size={14} /> CERRAR SESIÓN
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto bg-slate-50">
        
        {/* Cabecera Inteligente y Filtros Premium */}
        <header className="max-w-6xl mx-auto mb-8 bg-transparent md:bg-white md:p-8 md:rounded-[2rem] md:shadow-sm md:border border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-2">
              Hola, {String(currentUser?.nombre || '').split(' ')[0]} <span className="text-2xl">👋</span>
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              Asignación: <span className="text-blue-600 font-bold">{String(currentUser?.agencias || '')}</span>
            </p>
          </div>
          
          <div className="w-full lg:w-auto flex flex-col sm:flex-row items-center gap-3">
            
            {/* BOTÓN CALENDARIO DESPLEGABLE */}
            <div className="relative w-full sm:w-auto">
              <button 
                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                className="flex items-center justify-center gap-2 w-full sm:w-auto bg-white border border-slate-200 text-slate-700 px-5 py-3.5 rounded-2xl shadow-sm hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all font-bold text-sm outline-none"
              >
                <Calendar size={16} className={filtroFechaInicio || filtroFechaFin ? "text-blue-600" : "text-slate-400"} />
                {filtroFechaInicio && filtroFechaFin 
                  ? `${filtroFechaInicio} al ${filtroFechaFin}` 
                  : filtroFechaInicio ? `Desde: ${filtroFechaInicio}` 
                  : filtroFechaFin ? `Hasta: ${filtroFechaFin}`
                  : 'Filtrar Fechas'}
              </button>

              {isDatePickerOpen && (
                <div className="absolute top-full right-0 lg:left-0 mt-2 p-6 bg-white border border-slate-100 rounded-[2rem] shadow-2xl z-50 w-full sm:w-80 animate-in slide-in-from-top-2">
                  <div className="flex justify-between items-center mb-5">
                    <h4 className="font-black text-slate-900">Rango de Fechas</h4>
                    <button onClick={() => setIsDatePickerOpen(false)} className="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 p-2 rounded-full transition-colors"><X size={16}/></button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Fecha Inicial</label>
                      <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-text" value={filtroFechaInicio} onChange={e => setFiltroFechaInicio(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Fecha Final</label>
                      <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-text" value={filtroFechaFin} onChange={e => setFiltroFechaFin(e.target.value)} />
                    </div>
                    {(filtroFechaInicio || filtroFechaFin) && (
                      <button 
                        onClick={() => {setFiltroFechaInicio(''); setFiltroFechaFin(''); setIsDatePickerOpen(false);}}
                        className="w-full mt-4 text-rose-600 bg-rose-50 border border-rose-100 font-bold text-sm py-3 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                      >
                        Limpiar Filtro
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Filtro Vendedor (Solo visible para Admin/Manager) */}
            {isMaster && (
              <select 
                className="w-full sm:w-auto bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 hover:bg-blue-50 transition-all cursor-pointer appearance-none"
                value={filtroVendedor}
                onChange={e => setFiltroVendedor(e.target.value)}
              >
                <option value="Todos">🚀 Todo el Equipo</option>
                {COMERCIALES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>
        </header>

        {/* TAB: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* 4 KPIs con Tasa de Bateo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <KpiCard icon={Clock} color="blue" label="Revenue Pipe" value={formatCurrency(stats.totalEnviado)} />
              <KpiCard icon={CheckCircle2} color="green" label="Total Cerrado" value={formatCurrency(stats.totalCerrado)} />
              <KpiCard icon={Activity} color="purple" label="Tasa de Bateo" value={`${stats.tasaBateo}%`} />
              <KpiCard icon={Calendar} color="amber" label="Citas Activas" value={stats.countCitas} />
            </div>

            <div className={`grid grid-cols-1 ${isMaster ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-8`}>
              
              {/* Gráfica de Dona: Estatus del Pipe (Visible para TODOS) */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center">
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2 w-full"><PieChartIcon size={18} className="text-purple-500"/> Estatus del Pipe</h3>
                <div className="w-full flex-1 min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.pipeStatusData}
                        innerRadius={70}
                        outerRadius={95}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.pipeStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold', color: '#0f172a'}} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: 'bold'}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráficas BarChart (Solo para Admin/Managers) */}
              {isMaster && (
                <>
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2"><TrendingUp size={18} className="text-blue-500"/> Revenue por Comercial</h3>
                    <div className="flex-1 min-h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.chartData} margin={{top: 10, right: 10, left: 0, bottom: 0}}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} tickFormatter={(value) => `$${value >= 1000000 ? value/1000000 + 'M' : value/1000 + 'k'}`} width={60} />
                          <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold', color: '#0f172a'}} formatter={(value) => formatCurrency(value)} />
                          <Bar dataKey="propuestas" radius={[6, 6, 0, 0]} maxBarSize={60}>
                            {stats.chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={VENDEDOR_COLORS[entry.name] || '#94a3b8'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2"><Calendar size={18} className="text-amber-500"/> Citas Registradas</h3>
                    <div className="flex-1 min-h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.chartData} margin={{top: 10, right: 10, left: 0, bottom: 0}}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} allowDecimals={false} width={30} />
                          <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold', color: '#0f172a'}} />
                          <Bar dataKey="citas" radius={[6, 6, 0, 0]} maxBarSize={60}>
                             {stats.chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={VENDEDOR_COLORS[entry.name] || '#94a3b8'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB: PIPE DE DRIVE */}
        {activeTab === 'pipe' && (
          <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Pipe de Drive</h2>
              <button 
                onClick={() => downloadCSV(propuestasFiltradas, 'Pipe_Propuestas')}
                className="bg-white border border-slate-200 text-slate-700 font-bold px-5 py-3 rounded-xl flex items-center gap-2 shadow-sm hover:bg-slate-50 transition-all text-sm"
              >
                <Download size={16} /> Descargar CSV
              </button>
            </div>
            
            {/* Contenedor de la tabla con Scroll Interno para no alargar la página */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden relative">
              <div className="max-h-[600px] overflow-y-auto w-full relative">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-widest sticky top-0 z-10 shadow-sm">
                    <tr><th className="p-5">Fecha / Sem.</th><th className="p-5">Campaña</th><th className="p-5">Manager</th><th className="p-5 text-center">Estatus</th><th className="p-5 text-right">Monto</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {propuestasFiltradas.length === 0 ? (
                      <tr><td colSpan="5" className="p-10 text-center text-slate-400 font-bold">No hay propuestas en este rango de fechas.</td></tr>
                    ) : propuestasFiltradas.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-5">
                          <div className="text-slate-500 font-medium">{String(p.fechaCruda || '')}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">{String(p.semana || '')}</div>
                        </td>
                        <td className="p-5 font-bold text-slate-800">{String(p.nombre || '')}</td>
                        <td className="p-5"><span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100">{String(p.vendedor || '')}</span></td>
                        <td className="p-5 text-center">
                          <span className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                            p.estatus === 'Cerrada' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                            p.estatus === 'Perdida' ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {String(p.estatus || 'Enviada')}
                          </span>
                        </td>
                        <td className="p-5 font-black text-slate-900 text-right">{formatCurrency(p.montoEnviado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: AGENDA CITAS */}
        {activeTab === 'citas' && (
          <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Agenda Semanal</h2>
              <div className="flex gap-3 w-full md:w-auto">
                <button 
                  onClick={() => downloadCSV(citasFiltradas, 'Agenda_Citas')}
                  className="bg-white border border-slate-200 text-slate-700 font-bold px-5 py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 transition-all text-sm w-full md:w-auto"
                >
                  <Download size={16} /> CSV
                </button>
                <button onClick={() => {
                  setEditingCitaId(null);
                  setNuevaCita({ agencia: '', vendedor: '', fechaCruda: '', semana: '', persona: '', cuenta: '' });
                  setIsCustomAgencia(false);
                  setShowModalCita(true);
                }} className="bg-blue-600 text-white font-black px-6 py-3 rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20 hover:scale-105 transition-all font-sans w-full md:w-auto">
                  <Plus size={20} /> Registrar Cita
                </button>
              </div>
            </header>
            
            {citasFiltradas.length === 0 ? (
              <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 text-center shadow-sm">
                <p className="text-slate-400 font-bold">No hay citas agendadas en este rango de fechas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {citasFiltradas.map(c => (
                  <div key={c.id} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all group relative">
                    <div className="flex justify-between items-start mb-6">
                      <div className="bg-slate-50 p-4 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all"><Building2 size={24} /></div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">{String(c.semana || '')}</span>
                        
                        {/* Botones de Edición / Borrado */}
                        {(currentUser?.role === 'admin' || currentUser?.nombre === c.vendedor) && (
                          <div className="flex opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-sm border border-slate-100 rounded-lg overflow-hidden">
                            <button onClick={() => openEditCita(c)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-colors" title="Editar"><Edit3 size={14}/></button>
                            <button onClick={() => deleteCita(c.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-50 transition-colors" title="Borrar"><Trash2 size={14}/></button>
                          </div>
                        )}
                      </div>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 leading-tight mb-2">{String(c.agencia || '')}</h4>
                    <p className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-tighter leading-none">{String(c.cuenta || '')}</p>
                    <div className="pt-6 border-t border-slate-50 space-y-4">
                      <div className="flex items-center gap-3 text-sm font-bold text-slate-600"><User size={16} className="text-blue-500" /> {String(c.vendedor || '')}</div>
                      <div className="flex items-center gap-3 text-sm font-bold text-slate-600"><Calendar size={16} className="text-slate-400" /> {String(c.fechaCruda || '')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: CONTROL MAESTRO (Solo Admin) */}
        {activeTab === 'admin' && currentUser?.role === 'admin' && (
          <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Control Maestro</h2>
                <p className="text-slate-500 font-medium font-sans mt-1">Gestión de cargos, roles y accesos.</p>
              </div>
              <button onClick={() => { setEditingUser(null); setFormUser({ nombre: '', pass: '', role: 'comercial', cargo: '', agencias: '' }); setShowModalUser(true); }} className="bg-slate-900 text-white font-black px-6 py-4 rounded-2xl flex items-center gap-2 shadow-xl hover:scale-105 transition-all"><Plus size={20} /> Nuevo Perfil</button>
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
                        <div className="text-[10px] font-black text-blue-500 uppercase tracking-tighter mt-1">{String(u.cargo || '')}</div>
                      </td>
                      <td className="p-5 text-xs text-slate-500 font-medium">{String(u.agencias || '')}</td>
                      <td className="p-5 font-mono text-slate-400 text-[10px] tracking-widest bg-slate-50 rounded p-1 mx-2">{String(u.pass || '')}</td>
                      <td className="p-5">
                        <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                          u.role === 'admin' ? 'bg-rose-50 text-rose-700 border-rose-100' : 
                          u.role === 'manager' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                          'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                          {u.role === 'manager' ? 'Directivo' : String(u.role || '')}
                        </span>
                      </td>
                      <td className="p-5 text-right space-x-2">
                        <button onClick={() => { setEditingUser(u); setFormUser(u); setShowModalUser(true); }} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all"><Edit3 size={16}/></button>
                        <button onClick={() => deleteUser(u.id)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-rose-600 hover:border-rose-200 shadow-sm transition-all"><Trash2 size={16}/></button>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 border border-slate-100">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{editingUser ? 'Editar Perfil' : 'Nuevo Colaborador'}</h3>
              <button onClick={() => setShowModalUser(false)} className="text-slate-400 bg-slate-50 hover:bg-rose-50 hover:text-rose-500 p-2 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <form onSubmit={saveUser} className="space-y-5 font-sans">
              <InputGroup label="Nombre" value={formUser.nombre} onChange={v => setFormUser({...formUser, nombre: v})} />
              <InputGroup label="Cargo Oficial" value={formUser.cargo} onChange={v => setFormUser({...formUser, cargo: v})} placeholder="Ej. VP Revenue México" />
              <InputGroup label="Agencias Asignadas" value={formUser.agencias} onChange={v => setFormUser({...formUser, agencias: v})} placeholder="Ej. Publicis, WPP..." />
              <InputGroup label="Contraseña" value={formUser.pass} onChange={v => setFormUser({...formUser, pass: v})} />
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest block mb-1">Nivel de Acceso (Rol)</label>
                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-sans cursor-pointer" value={formUser.role} onChange={e => setFormUser({...formUser, role: e.target.value})}>
                  <option value="comercial">Comercial (Solo ve lo suyo)</option>
                  <option value="manager">Directivo / Manager (Ve todo el equipo)</option>
                  <option value="admin">Administrador (Control Total + Usuarios)</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white font-black p-4 rounded-xl shadow-lg mt-6 hover:bg-blue-600 transition-all uppercase tracking-widest text-xs">Guardar Perfil</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR / EDITAR CITA */}
      {showModalCita && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 border border-slate-100">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{editingCitaId ? 'Editar Cita' : 'Agendar Cita'}</h3>
              <button onClick={() => {setShowModalCita(false); setEditingCitaId(null); setIsCustomAgencia(false);}} className="text-slate-400 bg-slate-50 hover:bg-rose-50 hover:text-rose-500 p-2 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <form onSubmit={guardarCita} className="space-y-5">
              
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest block mb-1">Agencia / Partner</label>
                {!isCustomAgencia ? (
                  <select 
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-sans cursor-pointer"
                    value={nuevaCita.agencia}
                    onChange={e => {
                      if(e.target.value === 'otra') { setIsCustomAgencia(true); setNuevaCita({...nuevaCita, agencia: ''}); }
                      else { setNuevaCita({...nuevaCita, agencia: e.target.value}); }
                    }}
                  >
                    <option value="">Selecciona tu agencia...</option>
                    {misAgencias.map(a => <option key={a} value={a}>{a}</option>)}
                    <option value="otra">➕ Otra agencia nueva...</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-sans" placeholder="Escribe el nombre" value={nuevaCita.agencia} onChange={e => setNuevaCita({...nuevaCita, agencia: e.target.value})} />
                    <button type="button" onClick={() => {setIsCustomAgencia(false); setNuevaCita({...nuevaCita, agencia: ''})}} className="bg-rose-50 text-rose-500 px-4 rounded-xl hover:bg-rose-100 font-bold transition-colors"><X size={16}/></button>
                  </div>
                )}
              </div>

              <InputGroup label="Marca / Cuenta" value={nuevaCita.cuenta} onChange={v => setNuevaCita({...nuevaCita, cuenta: v})} placeholder="Ej. Netflix, Coca Cola" />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Día</label>
                  <input type="date" required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" value={nuevaCita.fechaCruda} onChange={e => {
                    const nuevaSemana = obtenerRangoSemana(e.target.value);
                    setNuevaCita({...nuevaCita, fechaCruda: e.target.value, semana: nuevaSemana});
                  }} />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Semana</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-[10px] text-slate-400 outline-none" placeholder="Automático" value={nuevaCita.semana} readOnly required />
                </div>
              </div>
              <InputGroup label="Contacto" value={nuevaCita.persona} onChange={v => setNuevaCita({...nuevaCita, persona: v})} placeholder="Nombre del cliente" />
              
              <button type="submit" className="w-full bg-blue-600 text-white font-black p-4 rounded-xl shadow-lg shadow-blue-600/20 mt-6 hover:bg-blue-700 transition-all uppercase tracking-widest text-xs">
                {editingCitaId ? 'Actualizar Cita' : 'Guardar en Agenda'}
              </button>
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
    <button onClick={() => onClick(id)} className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all ${isAct ? 'bg-blue-600 text-white shadow-md font-bold' : 'text-slate-400 hover:bg-slate-900 hover:text-white font-medium'}`}>
      <Icon size={18} className={isAct ? 'text-blue-200' : 'text-slate-500'} /> {label}
    </button>
  );
}

function KpiCard({ icon: Icon, color, label, value }) {
  const colors = { 
    blue: "bg-blue-50 text-blue-600 border-blue-100", 
    green: "bg-green-50 text-green-600 border-green-100", 
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100" 
  };
  return (
    <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-shadow h-full">
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-2xl border ${colors[color]}`}><Icon size={20} /></div>
        <span className="text-slate-400 font-bold text-[10px] md:text-xs uppercase tracking-widest">{label}</span>
      </div>
      {/* Solución a los números cortados: dejamos que respiren con break-word en lugar de truncarlos */}
      <div className="text-xl lg:text-2xl xl:text-3xl font-black text-slate-900 tracking-tight" style={{ wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  );
}

function InputGroup({ label, value, onChange, placeholder = "" }) {
  return (
    <div className="space-y-1 text-left">
      <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest block mb-1">{label}</label>
      <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-sans" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}