import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Download,
  ExternalLink,
  FlaskConical,
  House,
  Leaf,
  Menu,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Sprout,
  Trash2,
  User,
  Users,
  Wheat,
  X,
} from 'lucide-react';

const stages = [
  { id: 'starter', label: 'Itik starter', age: '0–2 minggu' },
  { id: 'grower', label: 'Itik grower', age: '3–7 minggu' },
  { id: 'layer', label: 'Itik petelur', age: 'Masa bertelur' },
];

const seedRecipe = [
  { ingredient_id: 'corn', quantity_kg: 42 },
  { ingredient_id: 'soybean-meal', quantity_kg: 19 },
  { ingredient_id: 'rice-bran', quantity_kg: 12 },
  { ingredient_id: 'cassava-meal', quantity_kg: 10 },
  { ingredient_id: 'copra-meal', quantity_kg: 6 },
  { ingredient_id: 'fish-meal', quantity_kg: 4 },
  { ingredient_id: 'limestone', quantity_kg: 2 },
  { ingredient_id: 'palm-oil', quantity_kg: 2 },
  { ingredient_id: 'premix', quantity_kg: 3 },
];

const defaultNutrients = {
  protein_pct: 0,
  energy_kcal_kg: 0,
  fiber_pct: 0,
  fat_pct: 0,
  calcium_pct: 0,
  phosphorus_pct: 0,
};

const locale = 'id-ID';
const currency = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function kcalToMj(kcal) {
  return kcal * 0.004184;
}

function timeGreeting() {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone: 'Asia/Jakarta',
  }).format(new Date()));
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

function categoryLabel(category) {
  return { Energy: 'Energi', Protein: 'Protein', Mineral: 'Mineral', Supplement: 'Suplemen' }[category] || category;
}

function readSavedIngredients() {
  try {
    const saved = JSON.parse(localStorage.getItem('feeder-ingredients') || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function readStorageJSON(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    if (value == null) return fallback;
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorageJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const defaultAccount = {
  id: 'demo-user',
  name: 'Petani Demo',
  email: 'petani@feeder.app',
  farm: 'Kebun Pakan Sentosa',
  role: 'Pemilik ternak',
};

const defaultTeams = [
  {
    id: 'team-sentosa',
    name: 'Tim Pakan Sentosa',
    farm: 'Kebun Pakan Sentosa',
    location: 'Sukabumi',
    description: 'Koordinasi formulasi pakan, produksi harian, dan review hasil ternak.',
    members: [
      { id: 'demo-user', name: 'Petani Demo', email: 'petani@feeder.app', role: 'Pemilik ternak', status: 'owner' },
      { id: 'rina', name: 'Rina', email: 'rina@feeder.app', role: 'Analisis pakan', status: 'member' },
      { id: 'budi', name: 'Budi', email: 'budi@feeder.app', role: 'Peternak lapangan', status: 'member' },
    ],
  },
];

async function api(path, options) {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Permintaan gagal (${response.status})`);
  }
  return response.json();
}

function App() {
  const [ingredients, setIngredients] = useState([]);
  const [customIngredients, setCustomIngredients] = useState(readSavedIngredients);
  const [user, setUser] = useState(() => readStorageJSON('feeder-user', null));
  const [teams, setTeams] = useState(() => readStorageJSON('feeder-teams', []));
  const [activeTeamId, setActiveTeamId] = useState(() => readStorageJSON('feeder-active-team', null));
  const [activePage, setActivePageState] = useState(() => {
    const route = window.location.pathname;
    if (route === '/' || route === '/home') return 'Home';
    if (route === '/dash') return 'Overview';
    if (route === '/login') return 'Login';
    if (route === '/signup') return 'Signup';
    if (route === '/docs/guide') return 'Feed guide';
    return 'Home';
  });
  const [recipeName, setRecipeName] = useState('Itik grower · Racikan 01');
  const [items, setItems] = useState(seedRecipe);
  const [analysis, setAnalysis] = useState(null);
  const [stage, setStage] = useState('grower');
  const [recommendation, setRecommendation] = useState(null);
  const [savedRecipes, setSavedRecipes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('feeder-recipes') || '[]');
    } catch {
      return [];
    }
  });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function setActivePage(page) {
    const routeMap = {
      Home: '/',
      Overview: '/dash',
      'Recipe builder': '/dash',
      'Recipe advisor': '/dash',
      Ingredients: '/dash',
      'My recipes': '/dash',
      Teams: '/dash',
      Account: '/login',
      Login: '/login',
      Signup: '/signup',
      'Feed guide': '/docs/guide',
    };
    const nextPath = routeMap[page] || '/';
    const nextState = { page };
    if (window.location.pathname !== nextPath) {
      window.history.pushState(nextState, '', nextPath);
    } else {
      window.history.replaceState(nextState, '', nextPath);
    }
    setActivePageState(page);
    window.scrollTo(0, 0);
  }

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (issue) {
      setError(issue.message || 'Gagal mengakhiri sesi.');
    }
    setUser(null);
    setActivePage('Home');
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const oauthResult = url.searchParams.get('oauth');
    if (oauthResult) {
      url.searchParams.delete('oauth');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }

    fetch('/api/auth/session')
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error(`Gagal memeriksa sesi (${response.status})`);
        return response.json();
      })
      .then((session) => {
        if (session?.user) setUser(session.user);
        if (oauthResult === 'success' && session?.user) {
          setNotice('Berhasil masuk dengan Google.');
          setActivePage('Home');
        }
      })
      .catch((issue) => setError(issue.message));

    const oauthErrors = {
      error_provider_config: 'Google Sign-In belum dikonfigurasi. Atur GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET di backend.',
      error_provider_response: 'Google tidak dapat menyelesaikan proses masuk. Silakan coba lagi.',
      error_profile: 'Google tidak mengembalikan profil akun yang diperlukan.',
      error_unverified: 'Gunakan akun Google dengan email yang sudah terverifikasi.',
    };
    if (oauthErrors[oauthResult]) setError(oauthErrors[oauthResult]);
  }, []);

  useEffect(() => {
    if (user) {
      writeStorageJSON('feeder-user', user);
    } else {
      window.localStorage.removeItem('feeder-user');
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) {
      setTeams([]);
      setActiveTeamId(null);
      return undefined;
    }

    let mounted = true;
    Promise.all([
      api(`/teams?user_id=${encodeURIComponent(user.id)}`),
      api(`/teams/current?user_id=${encodeURIComponent(user.id)}`),
    ])
      .then(([teamList, currentTeamResponse]) => {
        if (!mounted) return;
        const nextTeams = Array.isArray(teamList) ? teamList : [];
        setTeams(nextTeams);
        setActiveTeamId(currentTeamResponse?.id || null);
      })
      .catch(() => {
        if (!mounted) return;
        setTeams([]);
        setActiveTeamId(null);
      });

    return () => { mounted = false; };
  }, [user?.id]);

  useEffect(() => {
    if (teams.length) {
      writeStorageJSON('feeder-teams', teams);
    } else {
      window.localStorage.removeItem('feeder-teams');
    }
    if (!activeTeamId || !teams.some((team) => team.id === activeTeamId)) {
      setActiveTeamId(teams[0]?.id || null);
    }
    if (activeTeamId) {
      writeStorageJSON('feeder-active-team', activeTeamId);
    } else {
      window.localStorage.removeItem('feeder-active-team');
    }
  }, [teams, activeTeamId]);

  useEffect(() => {
    if (!user?.id || !activeTeamId) {
      setSavedRecipes(readStorageJSON('feeder-recipes', []));
      return undefined;
    }

    let mounted = true;
    api(`/teams/${encodeURIComponent(activeTeamId)}/recipes?user_id=${encodeURIComponent(user.id)}`)
      .then((recipes) => {
        if (mounted) setSavedRecipes(Array.isArray(recipes) ? recipes : []);
      })
      .catch((issue) => {
        if (mounted) setError(issue.message);
      });

    return () => { mounted = false; };
  }, [user?.id, activeTeamId]);

  useEffect(() => {
    function handlePopState() {
      const route = window.location.pathname;
      if (route === '/' || route === '/home') setActivePageState('Home');
      else if (route === '/dash') setActivePageState('Overview');
      else if (route === '/login') setActivePageState('Login');
      else if (route === '/signup') setActivePageState('Signup');
      else if (route === '/docs/guide') setActivePageState('Feed guide');
      else setActivePageState('Home');
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    api('/ingredients')
      .then(setIngredients)
      .catch((issue) => setError(issue.message));
  }, []);

  useEffect(() => {
    if (!items.length) {
      setAnalysis(null);
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      api('/recipes/analyze', {
        method: 'POST',
        body: JSON.stringify({ items, custom_ingredients: customIngredients }),
      })
        .then((result) => {
          setAnalysis(result);
          setError('');
        })
        .catch((issue) => setError(issue.message));
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [items, customIngredients]);

  useEffect(() => {
    api(`/advisor?stage=${stage}`)
      .then(setRecommendation)
      .catch((issue) => setError(issue.message));
  }, [stage]);

  const allIngredients = useMemo(
    () => [...ingredients, ...customIngredients],
    [ingredients, customIngredients],
  );

  const ingredientMap = useMemo(
    () => Object.fromEntries(allIngredients.map((ingredient) => [ingredient.id, ingredient])),
    [allIngredients],
  );

  const filteredIngredients = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return allIngredients.filter((ingredient) =>
      `${ingredient.name} ${ingredient.name_en} ${categoryLabel(ingredient.category)}`.toLowerCase().includes(term),
    );
  }, [allIngredients, searchTerm]);

  function updateQuantity(id, value) {
    const quantity = Number(value);
    setItems((current) => {
      if (!Number.isFinite(quantity) || quantity < 0) return current;
      if (quantity === 0) return current.filter((item) => item.ingredient_id !== id);
      const exists = current.some((item) => item.ingredient_id === id);
      return exists
        ? current.map((item) => (item.ingredient_id === id ? { ...item, quantity_kg: quantity } : item))
        : [...current, { ingredient_id: id, quantity_kg: quantity }];
    });
  }

  function addIngredient(id) {
    if (!items.some((item) => item.ingredient_id === id)) {
      setItems((current) => [...current, { ingredient_id: id, quantity_kg: 1 }]);
    }
  }

  function saveCustomIngredient(values) {
    const ingredient = {
      ...values,
      id: `custom-${crypto.randomUUID()}`,
      name_en: values.name,
      color: values.category === 'Protein' ? 'sage' : values.category === 'Energy' ? 'gold' : 'stone',
      is_custom: true,
    };
    const next = [...customIngredients, ingredient];
    try {
      localStorage.setItem('feeder-ingredients', JSON.stringify(next));
    } catch {
      setError('Bahan tidak dapat disimpan di perangkat ini. Periksa kapasitas penyimpanan browser.');
      return false;
    }
    setCustomIngredients(next);
    setNotice(`${ingredient.name} berhasil ditambahkan ke daftar bahan.`);
    window.setTimeout(() => setNotice(''), 3000);
    return true;
  }

  function deleteCustomIngredient(id) {
    const usedBySavedRecipe = savedRecipes.some((recipe) =>
      recipe.items.some((item) => item.ingredient_id === id),
    );
    if (usedBySavedRecipe) {
      setError('Bahan ini digunakan oleh racikan tersimpan. Hapus atau ubah racikan tersebut terlebih dahulu.');
      return;
    }
    const next = customIngredients.filter((ingredient) => ingredient.id !== id);
    try {
      localStorage.setItem('feeder-ingredients', JSON.stringify(next));
    } catch {
      setError('Perubahan daftar bahan tidak dapat disimpan di perangkat ini.');
      return;
    }
    setCustomIngredients(next);
    if (items.some((item) => item.ingredient_id === id)) {
      setItems((current) => current.filter((item) => item.ingredient_id !== id));
    }
    setNotice('Bahan khusus telah dihapus.');
    window.setTimeout(() => setNotice(''), 3000);
  }

  function useRecommendation(profile = recommendation) {
    if (!profile) return;
    setItems(profile.recipe.map((item) => ({
      ingredient_id: item.ingredient_id,
      quantity_kg: item.percentage,
    })));
    setRecipeName(`${profile.title} · Racikan sendiri`);
    setActivePage('Recipe builder');
    setNotice('Rekomendasi ditambahkan ke peracik pakan.');
    window.setTimeout(() => setNotice(''), 2800);
  }

  async function saveRecipe() {
    if (!items.length) {
      setError('Tambahkan bahan sebelum menyimpan racikan.');
      return;
    }
    const recipe = {
      name: recipeName.trim() || 'Racikan tanpa nama',
      items,
      savedAt: new Date().toISOString(),
    };
    if (user?.id && activeTeamId) {
      try {
        const saved = await api(`/teams/${encodeURIComponent(activeTeamId)}/recipes`, {
          method: 'POST',
          body: JSON.stringify({ ...recipe, user_id: user.id }),
        });
        setSavedRecipes((current) => [saved, ...current]);
        setNotice(`Racikan tersimpan untuk tim ${currentTeam?.name || ''}.`);
        window.setTimeout(() => setNotice(''), 2800);
      } catch (issue) {
        setError(issue.message || 'Racikan gagal disimpan.');
      }
      return;
    }
    const localRecipe = { ...recipe, id: Date.now() };
    const next = [localRecipe, readStorageJSON('feeder-recipes', [])].flat().slice(0, 100);
    if (!writeStorageJSON('feeder-recipes', next)) {
      setError('Racikan tidak dapat disimpan di perangkat ini.');
      return;
    }
    setSavedRecipes(next);
    setNotice('Racikan tersimpan di perangkat ini. Gabung tim untuk menyimpan racikan bersama.');
    window.setTimeout(() => setNotice(''), 2800);
  }

  function loadRecipe(recipe) {
    setRecipeName(recipe.name);
    setItems(recipe.items);
    setActivePage('Recipe builder');
    setNotice(`Racikan “${recipe.name}” dibuka di peracik pakan.`);
    window.setTimeout(() => setNotice(''), 2800);
  }

  async function deleteSavedRecipe(id) {
    const recipe = savedRecipes.find((saved) => saved.id === id);
    if (recipe?.team_id && user?.id) {
      try {
        await api(`/teams/${encodeURIComponent(recipe.team_id)}/recipes/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          body: JSON.stringify({ user_id: user.id }),
        });
      } catch (issue) {
        setError(issue.message || 'Racikan gagal dihapus.');
        return;
      }
    }
    const next = savedRecipes.filter((recipe) => recipe.id !== id);
    setSavedRecipes(next);
    if (!recipe?.team_id) writeStorageJSON('feeder-recipes', next);
  }

  function exportRecipe() {
    if (!analysis) return;
    const rows = [
      ['Bahan pakan', 'Jumlah (kg)', 'Bagian (%)'],
      ...analysis.items.map((item) => [item.name, item.quantity_kg, item.share_pct]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `${recipeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const currentStage = stages.find((item) => item.id === stage) || stages[1];
  const currentTeam = teams.find((team) => team.id === activeTeamId) || null;
  const navItems = [
    { id: 'Overview', label: 'Ringkasan', icon: Sprout },
    { id: 'Recipe builder', label: 'Peracik pakan', icon: FlaskConical },
    { id: 'Recipe advisor', label: 'Rekomendasi', icon: Sparkles },
    { id: 'Ingredients', label: 'Daftar bahan', icon: Wheat },
    { id: 'My recipes', label: 'Racikan tersimpan', icon: BookOpen },
  ];
  const pageLabels = Object.fromEntries(navItems.map(({ id, label }) => [id, label]));
  pageLabels.Login = 'Masuk';
  pageLabels.Signup = 'Daftar';

  if (activePage === 'Feed guide') {
    return (
      <div className="guide-route">
        <header className="guide-route-header">
          <a className="brand" href="/" onClick={(event) => { event.preventDefault(); setActivePage('Overview'); }}>
            <span className="brand-mark"><Sprout size={21} strokeWidth={2.4} /></span>
            <span className="brand-name">feeder<span>.</span></span>
          </a>
        </header>
        <main className="guide-route-content">
          <FeedGuidePage setActivePage={setActivePage} />
          <footer className="page-footer">
            <span>Mendukung pakan ternak yang lebih seimbang.</span>
            <span className="footer-note"><Leaf size={14} /> Nilai bahan merupakan perkiraan. Konsultasikan formulasi dengan ahli nutrisi ternak.</span>
          </footer>
        </main>
      </div>
    );
  }

  if (activePage === 'Home') {
    return (
      <div className="landing-shell">
        <header className="landing-header">
          <a className="brand" href="/" onClick={(event) => { event.preventDefault(); setActivePage('Home'); }}>
            <span className="brand-mark"><Sprout size={21} strokeWidth={2.4} /></span>
            <span className="brand-name">feeder<span>.</span></span>
          </a>
          <nav className="landing-nav" aria-label="Navigasi halaman depan">
            <button className="landing-nav-link" onClick={() => setActivePage('Overview')}>Dashboard</button>
            <button className="landing-nav-link" onClick={() => setActivePage('Feed guide')}>Panduan</button>
          </nav>
          <div className="landing-auth">
            {user ? (
              <>
                <button className="button button-light auth-top-button" onClick={() => setActivePage('Overview')}>
                  <User size={15} /> {user.name.split(' ')[0]}
                </button>
                <button className="button button-outline auth-top-button" onClick={logout}>Keluar</button>
              </>
            ) : (
              <>
                <span className="auth-status">Belum masuk</span>
                <button className="button button-light auth-top-button" onClick={() => setActivePage('Login')}>Masuk</button>
                <button className="button button-primary auth-top-button" onClick={() => setActivePage('Signup')}>Daftar</button>
              </>
            )}
          </div>
        </header>
        <main className="landing-content">
          {error && <div className="alert error-alert"><CircleHelp size={17} /><span>{error}</span><button onClick={() => setError('')} aria-label="Tutup pesan"><X size={16} /></button></div>}
          {notice && <div className="alert success-alert"><Check size={17} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Tutup pesan"><X size={16} /></button></div>}
          <HomePage
            user={user}
            setActivePage={setActivePage}
            activeTeam={currentTeam}
          />
          <footer className="page-footer">
            <span>Mendukung pakan ternak yang lebih seimbang.</span>
            <span className="footer-note"><Leaf size={14} /> Nilai bahan merupakan perkiraan. Konsultasikan formulasi dengan ahli nutrisi ternak.</span>
          </footer>
        </main>
      </div>
    );
  }

  if (activePage === 'Login' || activePage === 'Signup') {
    return (
      <div className="auth-route-shell">
        <header className="auth-route-header">
          <a className="brand" href="/" onClick={(event) => { event.preventDefault(); setActivePage('Home'); }}>
            <span className="brand-mark"><Sprout size={21} strokeWidth={2.4} /></span>
            <span className="brand-name">feeder<span>.</span></span>
          </a>
          <button className="button button-light" onClick={() => setActivePage('Home')}>Kembali ke beranda</button>
        </header>
        <main className="auth-route-content">
          {error && <div className="alert error-alert"><CircleHelp size={17} /><span>{error}</span><button onClick={() => setError('')} aria-label="Tutup pesan"><X size={16} /></button></div>}
          {notice && <div className="alert success-alert"><Check size={17} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Tutup pesan"><X size={16} /></button></div>}
          <AuthPage
            mode={activePage === 'Signup' ? 'signup' : 'login'}
            user={user}
            setUser={setUser}
            setNotice={setNotice}
            setError={setError}
            setActivePage={setActivePage}
          />
          <footer className="page-footer">
            <span>Mendukung pakan ternak yang lebih seimbang.</span>
            <span className="footer-note"><Leaf size={14} /> Nilai bahan merupakan perkiraan. Konsultasikan formulasi dengan ahli nutrisi ternak.</span>
          </footer>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setActivePage('Overview'); }}>
          <span className="brand-mark"><Sprout size={21} strokeWidth={2.4} /></span>
          <span className="brand-name">feeder<span>.</span></span>
        </a>
        <div className="nav-label">MENU UTAMA</div>
        <nav className="main-nav" aria-label="Navigasi utama">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              className={`nav-link ${activePage === id ? 'active' : ''}`}
              key={id}
              onClick={() => { setActivePage(id); setMobileMenuOpen(false); }}
            >
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {id === 'My recipes' && savedRecipes.length > 0 && <span className="nav-count">{savedRecipes.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-team-box">
          <div className="sidebar-team-header">
            <span className="eyebrow">TIM SAAT INI</span>
            <Users size={15} />
          </div>
          <strong>{currentTeam ? currentTeam.name : 'No team joined'}</strong>
          <small>{currentTeam ? currentTeam.location || currentTeam.farm || 'Tim aktif' : 'Join a team to collaborate.'}</small>
          <button className="button button-light" onClick={() => setActivePage('Teams')}>{currentTeam ? 'Kelola tim' : 'Gabung tim'}</button>
        </div>
      </aside>

      {mobileMenuOpen && <button className="mobile-scrim" aria-label="Tutup menu" onClick={() => setMobileMenuOpen(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu-button icon-button" aria-label="Buka menu" onClick={() => setMobileMenuOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>Beranda</span><ChevronRight size={14} /><strong>{pageLabels[activePage] || activePage}</strong></div>
          <div className="topbar-actions">
            <span className="date-chip"><Clock3 size={15} /> {new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date())}</span>
            {user ? (
              <>
                <button className="button button-light auth-top-button" onClick={() => setActivePage('Home')}>
                  <User size={15} /> {user.name.split(' ')[0]}
                </button>
                <button className="button button-outline auth-top-button" onClick={logout}>Keluar</button>
              </>
            ) : (
              <div className="auth-top-actions">
                <span className="auth-status">Belum masuk</span>
                <button className="button button-light auth-top-button" onClick={() => setActivePage('Login')}>Masuk</button>
                <button className="button button-primary auth-top-button" onClick={() => setActivePage('Signup')}>Daftar</button>
              </div>
            )}
          </div>
        </header>

        <div className="page-wrap">
          {error && <div className="alert error-alert"><CircleHelp size={17} /><span>{error}</span><button onClick={() => setError('')} aria-label="Tutup pesan"><X size={16} /></button></div>}
          {notice && <div className="alert success-alert"><Check size={17} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Tutup pesan"><X size={16} /></button></div>}

          {activePage === 'Overview' && (
            <OverviewPage
              analysis={analysis}
              currentStage={currentStage}
              recommendation={recommendation}
              ingredientMap={ingredientMap}
              savedRecipes={savedRecipes}
              activeTeam={currentTeam}
              setActivePage={setActivePage}
              useRecommendation={useRecommendation}
              loadRecipe={loadRecipe}
            />
          )}

          {activePage === 'Teams' && (
            <TeamsPage
              user={user}
              teams={teams}
              setTeams={setTeams}
              activeTeamId={activeTeamId}
              setActiveTeamId={setActiveTeamId}
              setNotice={setNotice}
              setError={setError}
            />
          )}

          {activePage === 'Recipe builder' && (
            <BuilderPage
              analysis={analysis}
              ingredientMap={ingredientMap}
              ingredients={allIngredients}
              items={items}
              recipeName={recipeName}
              setRecipeName={setRecipeName}
              updateQuantity={updateQuantity}
              addIngredient={addIngredient}
              saveRecipe={saveRecipe}
              exportRecipe={exportRecipe}
              recommendation={recommendation}
              useRecommendation={useRecommendation}
            />
          )}

          {activePage === 'Recipe advisor' && (
            <AdvisorPage
              stage={stage}
              setStage={setStage}
              recommendation={recommendation}
              ingredientMap={ingredientMap}
              useRecommendation={useRecommendation}
              openGuide={() => setActivePage('Feed guide')}
            />
          )}

          {activePage === 'Ingredients' && (
            <IngredientsPage
              ingredients={filteredIngredients}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              addIngredient={addIngredient}
              items={items}
              setActivePage={setActivePage}
              onSaveIngredient={saveCustomIngredient}
              onDeleteIngredient={deleteCustomIngredient}
              customIngredientIds={new Set(customIngredients.map((ingredient) => ingredient.id))}
              customIngredientCount={customIngredients.length}
            />
          )}

          {activePage === 'My recipes' && (
            <SavedRecipesPage
              recipes={savedRecipes}
              ingredientMap={ingredientMap}
              loadRecipe={loadRecipe}
              deleteRecipe={deleteSavedRecipe}
              setActivePage={setActivePage}
              activeTeam={currentTeam}
            />
          )}
          <footer className="page-footer">
            <span>Mendukung pakan ternak yang lebih seimbang.</span>
            <span className="footer-note"><Leaf size={14} /> Nilai bahan merupakan perkiraan. Konsultasikan formulasi dengan ahli nutrisi ternak.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
      {action}
    </div>
  );
}

function HomePage({ user, setActivePage, activeTeam }) {
  const accountLabel = user?.name || 'Belum masuk';
  const teamLabel = activeTeam?.name || 'Tim pakan';

  return (
    <>
      <PageHeading
        eyebrow="FEEDER APP"
        title="Platform pakan yang lebih rapi untuk peternak modern"
        description="Atur racikan pakan, pantau kebutuhan ternak, dan kolaborasi bersama tim dengan lebih mudah."
        action={<button className="button button-primary" onClick={() => setActivePage('Overview')}><ArrowRight size={16} /> Masuk dashboard</button>}
      />

      <section className="hero-card landing-hero">
        <div className="hero-copy">
          <div className="hero-kicker"><span className="sparkle-dot"><Sparkles size={13} /></span> MANAJEMEN PAKAN & TIM</div>
          <h2>Mulai dari halaman depan,<br />selesaikan hingga tim.</h2>
          <p>Feeder membantu Anda meracik pakan, membandingkan nutrisi, dan memastikan seluruh tim memahami target pakan di setiap fase ternak.</p>
          <div className="landing-actions">
            <button className="button button-primary" onClick={() => setActivePage('Recipe builder')}>Buat racikan</button>
            <button className="button button-light" onClick={() => setActivePage('Teams')}>Kelola tim</button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="sun-disc" />
          <div className="field field-back" />
          <div className="field field-front" />
          <div className="art-stem stem-one"><i /><i /><i /></div>
          <div className="art-stem stem-two"><i /><i /><i /></div>
          <div className="art-stem stem-three"><i /><i /></div>
        </div>
        <div className="hero-index">LANDING PAGE / 01</div>
      </section>

      <div className="feature-grid">
        <div className="panel feature-card">
          <div className="feature-icon"><House size={18} /></div>
          <h3>Halaman depan</h3>
          <p>Memperkenalkan aplikasi, manfaat utama, dan jalur cepat menuju dashboard, pakan, dan tim.</p>
        </div>
        <div className="panel feature-card">
          <div className="feature-icon"><User size={18} /></div>
          <h3>Akun peternak</h3>
          <p>Setiap pengguna bisa menyiapkan profil usaha, peran, dan akses cepat ke data pakan dan formulasi.</p>
        </div>
        <div className="panel feature-card">
          <div className="feature-icon"><Users size={18} /></div>
          <h3>Manajemen tim</h3>
          <p>Kelola anggota, peran, dan area kerja bersama untuk koordinasi formulasi pakan dan produksi.</p>
        </div>
      </div>

      <div className="landing-lower-grid">
        <section className="panel landing-summary">
          <div className="panel-heading">
            <div><span className="eyebrow">AKTIF HARI INI</span><h3>Profil pengguna</h3></div>
            <ShieldCheck size={18} />
          </div>
          <div className="account-summary-box">
            <strong>{accountLabel}</strong>
            <span>{user?.email || 'Masuk atau daftar untuk mengatur profil.'}</span>
            <small>{user?.farm || 'Belum ada usaha terdaftar'}</small>
          </div>
          <button className="button button-light" onClick={() => setActivePage('Login')}>Atur akun</button>
        </section>

        <section className="panel landing-summary">
          <div className="panel-heading">
            <div><span className="eyebrow">TIM AKTIF</span><h3>Kerja bersama</h3></div>
            <Users size={18} />
          </div>
          <div className="account-summary-box">
            <strong>{teamLabel}</strong>
            <span>{activeTeam?.location || 'Lokasi belum diatur'}</span>
            <small>{activeTeam?.members?.length || 0} anggota terdaftar</small>
          </div>
          <button className="button button-light" onClick={() => setActivePage('Teams')}>Kelola tim</button>
        </section>
      </div>
    </>
  );
}

function AuthPage({ mode, user, setUser, setError, setNotice, setActivePage }) {
  const isSignup = mode === 'signup';
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    farm: '',
    role: 'Pemilik ternak',
  });

  async function handleSubmit(event) {
    event.preventDefault();
    const email = form.email.trim();
    const password = form.password;

    if (!email || !password || (isSignup && !form.name.trim())) {
      setError(isSignup ? 'Nama, email, dan password harus diisi.' : 'Email dan password harus diisi.');
      return;
    }
    if (isSignup && password.length < 6) {
      setError('Password harus memiliki sedikitnya 6 karakter.');
      return;
    }

    try {
      const endpoint = isSignup ? '/auth/signup' : '/auth/login';
      const payload = isSignup
        ? { name: form.name.trim(), email, password, farm: form.farm.trim(), role: form.role }
        : { email, password };
      const response = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setUser(response.user);
      setNotice(isSignup ? 'Akun berhasil dibuat. Selamat datang.' : 'Login berhasil.');
      window.setTimeout(() => setNotice(''), 2600);
      setActivePage('Home');
    } catch (issue) {
      setError(issue.message || 'Gagal memproses akun.');
    }
  }

  return (
    <>
      <PageHeading
        eyebrow={isSignup ? 'DAFTAR' : 'MASUK'}
        title={isSignup ? 'Buat akun baru' : 'Masuk ke akun Anda'}
        description={isSignup ? 'Daftarkan profil peternak dan mulai kelola pakan serta tim bersama.' : 'Akses formulasi pakan, profil usaha, dan tim yang sudah Anda ikuti.'}
        action={<button className="button button-outline" onClick={() => setActivePage(isSignup ? 'Login' : 'Signup')}>{isSignup ? 'Sudah punya akun?' : 'Belum punya akun?'}</button>}
      />

      <div className="auth-route-layout">
        <section className="panel auth-panel auth-stacked-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">{isSignup ? 'PETERNAK BARU' : 'AKSES'}</span><h3>{isSignup ? 'Daftar akun' : 'Masuk ke dashboard'}</h3></div>
            <ShieldCheck size={18} />
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && (
              <label>
                <span>Nama lengkap</span>
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nama peternak" />
              </label>
            )}
            <label>
              <span>Email</span>
              <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="nama@feeder.app" />
            </label>
            <label>
              <span>Password</span>
              <input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Masukkan password" />
            </label>
            {isSignup && (
              <>
                <label>
                  <span>Nama usaha / kebun</span>
                  <input value={form.farm} onChange={(event) => setForm((current) => ({ ...current, farm: event.target.value }))} placeholder="Kebun pakan Sentosa" />
                </label>
                <label>
                  <span>Peran</span>
                  <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
                    <option value="Pemilik ternak">Pemilik ternak</option>
                    <option value="Manager pakan">Manager pakan</option>
                    <option value="Analis nutrisi">Analis nutrisi</option>
                    <option value="Peternak lapangan">Peternak lapangan</option>
                  </select>
                </label>
              </>
            )}
            <button className="button button-primary" type="submit">{isSignup ? 'Buat akun' : 'Masuk'}</button>
          </form>
          <div className="auth-divider"><span>atau</span></div>
          <a className="button button-google" href="/api/auth/google">
            <span className="google-mark" aria-hidden="true">G</span>
            Lanjutkan dengan Google
          </a>
        </section>

        <section className="panel auth-panel auth-stacked-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">CATATAN</span><h3>Database penyimpanan</h3></div>
            <ShieldCheck size={18} />
          </div>
          <div className="account-card">
            <strong>{isSignup ? 'Penyimpanan akun aktif' : 'Penyimpanan login aktif'}</strong>
            <span>Akun disimpan di database backend. SQLite digunakan untuk pengembangan lokal; Firestore dapat dipilih melalui konfigurasi backend.</span>
            <small>Google Sign-In membuat atau menautkan akun berdasarkan email Google yang terverifikasi.</small>
          </div>
          <ul className="feature-list">
            <li>Signup dan login menggunakan sesi backend yang aman.</li>
            <li>Login Google ditautkan ke akun dengan email terverifikasi yang sama.</li>
            <li>Tim juga disimpan di database yang sama untuk kolaborasi.</li>
          </ul>
        </section>
      </div>
    </>
  );
}

function AccountPage({ user, setUser, setError, setNotice }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    farm: user?.farm || '',
    role: user?.role || 'Pemilik ternak',
  });

  function handleSubmit(event) {
    event.preventDefault();
    const nextUser = {
      id: user?.id || `user-${Date.now()}`,
      name: form.name.trim(),
      email: form.email.trim(),
      farm: form.farm.trim() || 'Kebun pakan',
      role: form.role.trim() || 'Pemilik ternak',
    };

    if (!nextUser.name || !nextUser.email) {
      setError('Nama dan email akun wajib diisi.');
      return;
    }

    setUser(nextUser);
    setNotice('Profil akun berhasil disimpan.');
    window.setTimeout(() => setNotice(''), 2800);
  }

  function useDemoAccount() {
    setUser(defaultAccount);
    setNotice('Akun demo aktif.');
    window.setTimeout(() => setNotice(''), 2600);
  }

  function logout() {
    setUser(null);
    setNotice('Anda keluar dari sesi akun.');
    window.setTimeout(() => setNotice(''), 2600);
  }

  return (
    <>
      <PageHeading
        eyebrow="AKUN"
        title="Profil peternak"
        description="Kelola identitas usaha, data kontak, dan peran Anda di dalam sistem."
        action={<button className="button button-outline" onClick={logout}>Keluar</button>}
      />

      <div className="account-layout">
        <section className="panel auth-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">INFORMASI</span><h3>Pengaturan akun</h3></div>
            <ShieldCheck size={18} />
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              <span>Nama lengkap</span>
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Masukkan nama Anda" />
            </label>
            <label>
              <span>Email</span>
              <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="nama@feeder.app" />
            </label>
            <label>
              <span>Nama usaha / kebun</span>
              <input value={form.farm} onChange={(event) => setForm((current) => ({ ...current, farm: event.target.value }))} placeholder="Kebun pakan Sentosa" />
            </label>
            <label>
              <span>Peran</span>
              <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
                <option value="Pemilik ternak">Pemilik ternak</option>
                <option value="Manager pakan">Manager pakan</option>
                <option value="Analis nutrisi">Analis nutrisi</option>
                <option value="Peternak lapangan">Peternak lapangan</option>
              </select>
            </label>
            <div className="account-actions">
              <button className="button button-primary" type="submit">Simpan profil</button>
              <button type="button" className="button button-light" onClick={useDemoAccount}>Gunakan akun demo</button>
            </div>
          </form>
        </section>

        <section className="panel auth-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">STATUS</span><h3>Ringkasan akun</h3></div>
            <User size={18} />
          </div>
          <div className="account-card">
            <strong>{user?.name || 'Belum login'}</strong>
            <span>{user?.email || 'Daftar akun untuk menyiapkan profil.'}</span>
            <small>{user?.role || 'Peran belum diatur'}</small>
            <p>{user?.farm || 'Nama usaha belum diisi.'}</p>
          </div>
          <ul className="feature-list">
            <li>Kelola kebiasaan pakan dan formulasi pribadi.</li>
            <li>Gunakan akun yang sama untuk beberapa tim kerja.</li>
            <li>Cocok untuk peternak tunggal dan operasi skala kecil.</li>
          </ul>
        </section>
      </div>
    </>
  );
}

function TeamsPage({ user, teams, setTeams, activeTeamId, setActiveTeamId, setNotice, setError }) {
  const [teamForm, setTeamForm] = useState({ name: '', farm: '', location: '', description: '' });
  const [teamQuery, setTeamQuery] = useState('');
  const [teamResults, setTeamResults] = useState([]);
  const [teamRequests, setTeamRequests] = useState([]);
  const [searchingTeams, setSearchingTeams] = useState(false);

  const activeTeam = teams.find((team) => team.id === activeTeamId) || teams[0] || null;
  const isActiveTeamOwner = Boolean(activeTeam && user?.id === activeTeam.created_by);

  useEffect(() => {
    let mounted = true;
    setSearchingTeams(true);
    const timeout = window.setTimeout(() => {
      const userQuery = user?.id ? `&user_id=${encodeURIComponent(user.id)}` : '';
      api(`/teams/search?q=${encodeURIComponent(teamQuery)}${userQuery}`)
        .then((results) => {
          if (mounted) setTeamResults(Array.isArray(results) ? results : []);
        })
        .catch((issue) => {
          if (mounted) setError(issue.message || 'Gagal mencari tim.');
        })
        .finally(() => {
          if (mounted) setSearchingTeams(false);
        });
    }, 200);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, [teamQuery, user?.id, setError]);

  useEffect(() => {
    if (!activeTeam || !isActiveTeamOwner) {
      setTeamRequests([]);
      return undefined;
    }

    let mounted = true;
    api(`/teams/${encodeURIComponent(activeTeam.id)}/requests?user_id=${encodeURIComponent(user.id)}`)
      .then((requests) => {
        if (mounted) setTeamRequests(Array.isArray(requests) ? requests : []);
      })
      .catch((issue) => {
        if (mounted) setError(issue.message || 'Gagal memuat permintaan bergabung.');
      });
    return () => { mounted = false; };
  }, [activeTeam?.id, isActiveTeamOwner, user?.id, setError]);

  async function selectTeam(team) {
    if (!user?.id) {
      setError('Login diperlukan untuk memilih tim.');
      return;
    }
    try {
      await api('/teams/current', {
        method: 'POST',
        body: JSON.stringify({ team_id: team.id, user_id: user.id }),
      });
      setActiveTeamId(team.id);
    } catch (issue) {
      setError(issue.message || 'Gagal memilih tim.');
    }
  }

  async function joinTeam(team) {
    if (!user?.id) {
      setError('Login diperlukan untuk bergabung dengan tim.');
      return;
    }
    try {
      const response = await api('/teams/join', {
        method: 'POST',
        body: JSON.stringify({ team_id: team.id, user_id: user.id, role: user.role || 'Peternak lapangan' }),
      });
      if (response.result.request_pending) {
        setTeamResults((current) => current.map((result) => result.id === team.id
          ? { ...result, request_status: 'pending' }
          : result));
        setNotice(`Permintaan bergabung dengan ${team.name} telah dikirim. Tunggu persetujuan pemilik tim.`);
      } else {
        setNotice(`Anda sudah menjadi anggota ${team.name}.`);
      }
      window.setTimeout(() => setNotice(''), 2800);
    } catch (issue) {
      setError(issue.message || 'Gagal bergabung dengan tim.');
    }
  }

  async function reviewJoinRequest(request, accept) {
    if (!activeTeam || !user?.id) return;
    const endpoint = `/teams/${encodeURIComponent(activeTeam.id)}/requests/${encodeURIComponent(request.id)}`;
    try {
      const response = await api(accept ? `${endpoint}/accept` : endpoint, {
        method: accept ? 'POST' : 'DELETE',
        body: JSON.stringify({ owner_user_id: user.id }),
      });
      setTeamRequests(response.requests || []);
      if (accept) {
        const nextMembers = response.members.map((member) => ({
          ...member,
          status: member.id === activeTeam.created_by ? 'owner' : 'member',
        }));
        setTeams((current) => current.map((team) => team.id === activeTeam.id
          ? { ...team, members: nextMembers }
          : team));
        setNotice(`${request.name} telah diterima sebagai anggota tim.`);
      } else {
        setNotice(`Permintaan ${request.name} telah ditolak.`);
      }
      window.setTimeout(() => setNotice(''), 2800);
    } catch (issue) {
      setError(issue.message || 'Gagal memproses permintaan bergabung.');
    }
  }

  async function deleteTeam() {
    if (!activeTeam || !user?.id) return;
    if (!window.confirm(`Hapus tim “${activeTeam.name}”? Anggota, permintaan bergabung, dan racikan tim juga akan dihapus.`)) return;
    try {
      await api(`/teams/${encodeURIComponent(activeTeam.id)}`, {
        method: 'DELETE',
        body: JSON.stringify({ owner_user_id: user.id }),
      });
      const remainingTeams = teams.filter((team) => team.id !== activeTeam.id);
      setTeams(remainingTeams);
      setActiveTeamId(remainingTeams[0]?.id || null);
      setNotice(`Tim “${activeTeam.name}” telah dihapus.`);
      window.setTimeout(() => setNotice(''), 2800);
    } catch (issue) {
      setError(issue.message || 'Gagal menghapus tim.');
    }
  }

  async function removeMember(member) {
    if (!activeTeam || !user?.id) return;
    try {
      const response = await api(
        `/teams/${encodeURIComponent(activeTeam.id)}/members/${encodeURIComponent(member.id)}`,
        {
          method: 'DELETE',
          body: JSON.stringify({
            team_id: activeTeam.id,
            actor_user_id: user.id,
            member_user_id: member.id,
          }),
        },
      );
      const nextMembers = response.members.map((currentMember) => ({
        ...currentMember,
        status: currentMember.id === activeTeam.created_by ? 'owner' : 'member',
      }));
      setTeams((current) => current.map((team) => team.id === activeTeam.id
        ? { ...team, members: nextMembers }
        : team));
      setNotice(`${member.name} telah dihapus dari tim.`);
      window.setTimeout(() => setNotice(''), 2800);
    } catch (issue) {
      setError(issue.message || 'Gagal menghapus anggota tim.');
    }
  }

  async function createTeam(event) {
    event.preventDefault();
    if (!user?.id) {
      setError('Login diperlukan sebelum membuat tim.');
      return;
    }
    if (!teamForm.name.trim()) {
      setError('Nama tim wajib diisi.');
      return;
    }

    try {
      const response = await api('/teams', {
        method: 'POST',
        body: JSON.stringify({
          name: teamForm.name,
          farm: teamForm.farm,
          location: teamForm.location,
          description: teamForm.description,
          user_id: user.id,
        }),
      });
      const savedTeam = response.team;
      const enrichedTeam = { ...savedTeam, members: response.members || [] };
      setTeams((current) => [enrichedTeam, ...current.filter((team) => team.id !== savedTeam.id)]);
      setActiveTeamId(savedTeam.id);
      await api('/teams/current', {
        method: 'POST',
        body: JSON.stringify({ team_id: savedTeam.id, user_id: user.id, role: user.role || 'Pemilik ternak' }),
      });
      setTeamForm({ name: '', farm: '', location: '', description: '' });
      setNotice(`Tim “${savedTeam.name}” berhasil dibuat.`);
      window.setTimeout(() => setNotice(''), 2800);
    } catch (issue) {
      setError(issue.message || 'Gagal membuat tim.');
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="TIM"
        title="Manajemen tim kerja"
        description="Buat tim, pilih anggota, dan koordinasikan formulasi pakan untuk seluruh operasional."
        action={<button className="button button-primary" onClick={() => setActiveTeamId(activeTeam?.id || teams[0]?.id)}>{activeTeam?.name || 'Pilih tim'}</button>}
      />

      <div className="team-layout">
        <section className="panel auth-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">BUAT TIM</span><h3>Tim baru</h3></div>
            <Users size={18} />
          </div>
          <form className="auth-form" onSubmit={createTeam}>
            <label>
              <span>Nama tim</span>
              <input value={teamForm.name} onChange={(event) => setTeamForm((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: Tim Pakan Desa" />
            </label>
            <label>
              <span>Nama usaha</span>
              <input value={teamForm.farm} onChange={(event) => setTeamForm((current) => ({ ...current, farm: event.target.value }))} placeholder="Usaha pakan unggas" />
            </label>
            <label>
              <span>Lokasi</span>
              <input value={teamForm.location} onChange={(event) => setTeamForm((current) => ({ ...current, location: event.target.value }))} placeholder="Kabupaten / daerah" />
            </label>
            <label>
              <span>Deskripsi</span>
              <textarea value={teamForm.description} onChange={(event) => setTeamForm((current) => ({ ...current, description: event.target.value }))} rows="3" placeholder="Tujuan tim dan area kerja" />
            </label>
            <button className="button button-primary" type="submit">Buat tim</button>
          </form>
        </section>

        <section className="panel auth-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">TIM AKTIF</span><h3>{activeTeam?.name || 'Belum ada tim'}</h3></div>
            <span className="mini-badge">{activeTeam?.members?.length || 0} orang</span>
          </div>
          <div className="team-list">
            {teams.map((team) => (
              <button key={team.id} className={`team-select ${team.id === activeTeamId ? 'selected' : ''}`} onClick={() => selectTeam(team)}>
                <strong>{team.name}</strong>
                <small>{team.location}</small>
              </button>
            ))}
          </div>
          {activeTeam && (
            <>
              <div className="member-list">
                {activeTeam.members.map((member) => (
                  <div key={member.id} className="member-card">
                    <div>
                      <strong>{member.name}</strong>
                      <small>{member.role}</small>
                    </div>
                    <div className="member-actions">
                      <span className={`status-pill ${member.id === activeTeam.created_by ? 'owner' : 'member'}`}>{member.id === activeTeam.created_by ? 'Owner' : 'Anggota'}</span>
                      {isActiveTeamOwner && member.id !== activeTeam.created_by && (
                        <button className="row-remove" onClick={() => removeMember(member)} aria-label={`Hapus ${member.name} dari tim`}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {isActiveTeamOwner && (
                <>
                  <div className="team-management-actions">
                    <span className="eyebrow">PERMINTAAN BERGABUNG</span>
                    <span className="mini-badge">{teamRequests.length} menunggu</span>
                  </div>
                  {teamRequests.length > 0 && (
                    <div className="member-list">
                      {teamRequests.map((request) => (
                        <div key={request.id} className="member-card">
                          <div>
                            <strong>{request.name}</strong>
                            <small>{request.email} · {request.role}</small>
                          </div>
                          <div className="member-actions">
                            <button className="button button-primary request-action" onClick={() => reviewJoinRequest(request, true)}>Terima</button>
                            <button className="row-remove" onClick={() => reviewJoinRequest(request, false)} aria-label={`Tolak permintaan ${request.name}`}><X size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="button button-outline team-delete-button" onClick={deleteTeam}><Trash2 size={15} /> Hapus tim</button>
                </>
              )}
            </>
          )}
        </section>

        <section className="panel auth-panel team-search-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">JELAJAHI</span><h3>Cari dan gabung tim</h3></div>
            <Search size={18} />
          </div>
          <label className="team-search-field">
            <Search size={16} />
            <input value={teamQuery} onChange={(event) => setTeamQuery(event.target.value)} placeholder="Cari nama tim, usaha, atau lokasi" aria-label="Cari tim" />
          </label>
          <div className="team-search-results" aria-live="polite">
            {searchingTeams && <div className="loading-row">Mencari tim…</div>}
            {!searchingTeams && teamResults.map((team) => {
              const isMember = teams.some((joinedTeam) => joinedTeam.id === team.id);
              const requestPending = team.request_status === 'pending';
              return (
                <article className="team-result" key={team.id}>
                  <div>
                    <strong>{team.name}</strong>
                    <small>{team.farm} · {team.location}</small>
                    <p>{team.description}</p>
                    <span>{team.member_count} anggota</span>
                  </div>
                  <button className={`button ${isMember || requestPending ? 'button-light' : 'button-primary'}`} disabled={isMember || requestPending || !user?.id} onClick={() => joinTeam(team)}>
                    {isMember ? 'Sudah bergabung' : requestPending ? 'Menunggu persetujuan' : user ? 'Minta bergabung' : 'Login untuk gabung'}
                  </button>
                </article>
              );
            })}
            {!searchingTeams && teamResults.length === 0 && <p className="empty-team-results">Tidak ada tim yang cocok dengan pencarian.</p>}
          </div>
        </section>
      </div>
    </>
  );
}

function OverviewPage({ analysis, currentStage, recommendation, ingredientMap, savedRecipes, activeTeam, setActivePage, useRecommendation, loadRecipe }) {
  const nutrients = analysis?.nutrients || defaultNutrients;
  const feedCost = analysis?.cost_per_kg || 0;
  return (
    <>
      <PageHeading
        eyebrow={new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date()).toUpperCase()}
        title={<>{timeGreeting()} <span className="wave">✳</span></>}
        description="Ringkasan racikan pakan dan kebutuhan ternak Anda."
        action={<button className="button button-primary" onClick={() => setActivePage('Recipe builder')}><Plus size={17} /> Buat racikan</button>}
      />
      <section className="hero-card">
        <div className="hero-copy">
          <div className="hero-kicker"><span className="sparkle-dot"><Sparkles size={13} /></span> RENCANAKAN PAKAN DENGAN BIJAK</div>
          <h2>Pakan baik,<br />ternak sehat.</h2>
          <p>Susun racikan seimbang, pahami setiap bahan, dan dukung pertumbuhan ternak Anda.</p>
          <button className="button button-light" onClick={() => setActivePage('Recipe advisor')}>Lihat rekomendasi pakan <ArrowRight size={16} /></button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="sun-disc" />
          <div className="field field-back" />
          <div className="field field-front" />
          <div className="art-stem stem-one"><i /><i /><i /></div>
          <div className="art-stem stem-two"><i /><i /><i /></div>
          <div className="art-stem stem-three"><i /><i /></div>
          <div className="hero-art-caption"><span>01</span><span>TUMBUH DENGAN TERARAH</span></div>
        </div>
        <div className="hero-index">CATATAN PAKAN&nbsp; / &nbsp;01</div>
      </section>

      <div className="section-title-row">
        <div><h2>Ringkasan pakan</h2><p>Ikhtisar racikan grower Anda saat ini.</p></div>
        <button className="text-button" onClick={() => setActivePage('Recipe builder')}>Buka racikan <ArrowRight size={15} /></button>
      </div>
      <div className="stats-grid">
        <StatCard label="Racikan aktif" value="Itik grower" detail="3–7 minggu · Racikan 01" icon={Wheat} tint="sage-tint" />
        <StatCard label="Protein kasar" value={`${nutrients.protein_pct.toFixed(1)}%`} detail="Sasaran 16–18%" icon={Sprout} tint="gold-tint" trend={rangeStatus(nutrients.protein_pct, 16, 18)} />
        <StatCard label="Energi metabolis" value={kcalToMj(nutrients.energy_kcal_kg).toFixed(1)} unit="MJ/kg" detail="Perkiraan energi per kilogram" icon={ArrowUpRight} tint="blue-tint" />
        <StatCard label="Estimasi biaya pakan" value={currency.format(feedCost)} unit="/ kg" detail="Harga estimasi · IDR/kg" icon={ArrowDownRight} tint="clay-tint" />
      </div>

      <div className="dashboard-grid">
        <section className="panel ingredients-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">BAHAN DALAM RACIKAN</span><h3>Komposisi racikan</h3></div>
            <button className="more-button" onClick={() => setActivePage('Recipe builder')}>Ubah racikan <ArrowRight size={14} /></button>
          </div>
          <div className="ingredient-list">
            {(analysis?.items || []).slice(0, 5).map((item) => {
              const ingredient = ingredientMap[item.ingredient_id];
              return <IngredientLine key={item.ingredient_id} name={item.name} share={item.share_pct} category={ingredient?.category || 'Ingredient'} />;
            })}
            {!analysis && <div className="loading-row">Memuat racikan…</div>}
          </div>
          <button className="panel-footer-link" onClick={() => setActivePage('Recipe builder')}>Lihat semua bahan <ArrowRight size={15} /></button>
        </section>
        <section className="panel advisor-panel">
          <div className="advisor-orbit"><Compass size={21} /></div>
          <div className="eyebrow">REKOMENDASI UNTUK MEMULAI</div>
          <h3>{recommendation?.title || currentStage.label}</h3>
          <p>{recommendation?.description || 'Titik awal racikan berdasarkan tahap pertumbuhan, siap Anda sesuaikan.'}</p>
          <div className="advisor-meta"><span><span className="meta-dot" /> {recommendation?.age_range || currentStage.age}</span><span>Sasaran protein {recommendation?.target_protein_pct || 17}%</span></div>
          <button className="button button-dark" onClick={() => useRecommendation(recommendation)}>Lihat rekomendasi <ArrowRight size={15} /></button>
          <span className="advisor-decoration">CATATAN TERNAK&nbsp; / &nbsp;04</span>
        </section>
      </div>

      <div className="section-title-row saved-title-row">
        <div><h2>Baru disimpan</h2><p>{activeTeam ? `Dibagikan dengan tim ${activeTeam.name}.` : 'Racikan tersimpan di perangkat ini.'}</p></div>
        <button className="text-button" onClick={() => setActivePage('My recipes')}>Semua racikan <ArrowRight size={15} /></button>
      </div>
      {savedRecipes.length ? (
        <div className="saved-preview-grid">
          {savedRecipes.slice(0, 2).map((recipe) => (
            <button className="saved-preview" key={recipe.id} onClick={() => loadRecipe(recipe)}>
              <span className="saved-preview-icon"><BookOpen size={18} /></span>
              <span className="saved-preview-copy"><strong>{recipe.name}</strong><small>{recipe.items.length} bahan · Racikan tersimpan</small></span>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      ) : (
        <button className="empty-saved" onClick={() => setActivePage('Recipe builder')}><span><Plus size={17} /></span><strong>Belum ada racikan tersimpan</strong><small>Simpan racikan yang sudah Anda susun untuk melihatnya di sini.</small><ArrowRight size={16} /></button>
      )}
    </>
  );
}

function StatCard({ label, value, unit, detail, icon: Icon, tint, trend }) {
  const statusClass = trend === 'Sesuai target' ? 'status-on' : trend === 'Di atas target' ? 'status-high' : 'status-low';
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tint}`}><Icon size={17} /></div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}<span>{unit}</span></div>
      <div className="stat-detail">{trend ? <><span className={`tiny-status ${statusClass}`} />{trend}</> : detail}</div>
    </div>
  );
}

function rangeStatus(value, minimum, maximum) {
  if (value < minimum) return 'Di bawah target';
  if (value > maximum) return 'Di atas target';
  return 'Sesuai target';
}

function IngredientLine({ name, share, category }) {
  const colors = { Energy: 'bar-gold', Protein: 'bar-sage', Mineral: 'bar-clay', Supplement: 'bar-lavender' };
  return (
    <div className="ingredient-line">
      <span className={`ingredient-mini-icon ${colors[category] || 'bar-sage'}`}><Leaf size={14} /></span>
      <span className="ingredient-line-name"><strong>{name}</strong><small>{categoryLabel(category)}</small></span>
      <div className="ingredient-progress"><i className={colors[category] || 'bar-sage'} style={{ width: `${Math.max(8, share)}%` }} /></div>
      <strong className="ingredient-share">{share}%</strong>
    </div>
  );
}

function BuilderPage({ analysis, ingredientMap, ingredients, items, recipeName, setRecipeName, updateQuantity, addIngredient, saveRecipe, exportRecipe, recommendation, useRecommendation }) {
  const total = analysis?.total_kg || items.reduce((sum, item) => sum + Number(item.quantity_kg || 0), 0);
  const recommendedStage = stages.find((option) => option.id === recommendation?.stage)?.label.toLowerCase() || 'itik grower';
  return (
    <>
      <PageHeading eyebrow="RACIKAN PAKAN" title="Peracik pakan" description="Susun racikan yang sesuai untuk ternak, bahan demi bahan." action={<button className="button button-primary" onClick={saveRecipe}><Save size={16} /> Simpan racikan</button>} />
      <div className="builder-banner">
        <div className="banner-leaf"><Sprout size={20} /></div>
        <div><strong>Ingin mulai dari rekomendasi?</strong><span>Gunakan racikan sesuai tahap ternak sebagai dasar, lalu sesuaikan.</span></div>
        <button className="text-button" onClick={() => useRecommendation(recommendation)}>Lihat racikan {recommendedStage} <ArrowRight size={15} /></button>
      </div>
      <div className="builder-layout">
        <section className="panel builder-panel">
          <div className="builder-titlebar">
            <div><span className="eyebrow">RACIKAN SENDIRI</span><input className="recipe-title-input" value={recipeName} onChange={(event) => setRecipeName(event.target.value)} aria-label="Nama racikan" /></div>
            <span className="draft-pill"><i /> DRAF</span>
          </div>
          <div className="table-head"><span>BAHAN PAKAN</span><span>JUMLAH</span><span>BAGIAN</span><span /></div>
          <div className="recipe-rows">
            {items.map((item) => {
              const ingredient = ingredientMap[item.ingredient_id];
              if (!ingredient) return null;
              const share = total ? (item.quantity_kg / total) * 100 : 0;
              return (
                <div className="recipe-row" key={item.ingredient_id}>
                  <span className="recipe-ingredient"><span className={`ingredient-mini-icon bar-${ingredient.color}`}><Leaf size={14} /></span><span><strong>{ingredient.name}</strong><small>{categoryLabel(ingredient.category)}</small></span></span>
                  <label className="amount-field"><input type="number" min="0" step="0.1" value={item.quantity_kg} onChange={(event) => updateQuantity(item.ingredient_id, event.target.value)} /><span>kg</span></label>
                  <span className="share-value">{share.toFixed(1)}%</span>
                  <button className="row-remove" onClick={() => updateQuantity(item.ingredient_id, 0)} aria-label={`Hapus ${ingredient.name}`}><Trash2 size={15} /></button>
                </div>
              );
            })}
            {!items.length && <div className="empty-builder">Racikan masih kosong. Tambahkan bahan untuk memulai.</div>}
          </div>
          <AddIngredientDropdown ingredients={ingredients} items={items} addIngredient={addIngredient} />
          <div className="builder-total"><span>Total racikan</span><strong>{total.toFixed(1)} kg</strong></div>
          <div className="builder-actions"><button className="button button-primary" onClick={saveRecipe}><Save size={16} /> Simpan racikan</button><button className="button button-outline" onClick={exportRecipe} disabled={!analysis}><Download size={16} /> Ekspor CSV</button></div>
        </section>

        <aside className="nutrition-column">
          <div className="panel nutrition-panel">
            <div className="panel-heading"><div><span className="eyebrow">RINGKASAN RACIKAN</span><h3>Nilai nutrisi</h3></div><span className="live-badge"><i /> LANGSUNG</span></div>
            <p className="nutrition-intro">Perkiraan nilai untuk setiap kilogram pakan.</p>
            <NutrientRow label="Protein kasar" value={`${analysis?.nutrients.protein_pct.toFixed(1) || '—'}%`} target="Sasaran 16–18%" valuePercent={Math.min(100, ((analysis?.nutrients.protein_pct || 0) / 24) * 100)} />
            <NutrientRow label="Energi metabolis" value={`${kcalToMj(analysis?.nutrients.energy_kcal_kg || 0).toFixed(1)} MJ`} target="per kg pakan" valuePercent={Math.min(100, ((analysis?.nutrients.energy_kcal_kg || 0) / 4000) * 100)} color="gold" />
            <NutrientRow label="Serat kasar" value={`${analysis?.nutrients.fiber_pct.toFixed(1) || '—'}%`} target="dari total pakan" valuePercent={Math.min(100, ((analysis?.nutrients.fiber_pct || 0) / 12) * 100)} color="clay" />
            <NutrientRow label="Lemak kasar" value={`${analysis?.nutrients.fat_pct.toFixed(1) || '—'}%`} target="dari total pakan" valuePercent={Math.min(100, ((analysis?.nutrients.fat_pct || 0) / 20) * 100)} color="blue" />
            <NutrientRow label="Kalsium" value={`${analysis?.nutrients.calcium_pct.toFixed(2) || '—'}%`} target="dari total pakan" valuePercent={Math.min(100, ((analysis?.nutrients.calcium_pct || 0) / 10) * 100)} color="lavender" />
            <NutrientRow label="Fosfor" value={`${analysis?.nutrients.phosphorus_pct.toFixed(2) || '—'}%`} target="dari total pakan" valuePercent={Math.min(100, ((analysis?.nutrients.phosphorus_pct || 0) / 5) * 100)} color="clay" />
            <div className="cost-summary"><span>Estimasi biaya batch</span><strong>{currency.format(analysis?.total_cost || 0)}</strong><small>{currency.format(analysis?.cost_per_kg || 0)} / kg</small></div>
          </div>
          <div className="nutrition-note"><CircleHelp size={16} /><p><strong>Catatan nutrisi</strong> Angka ini hanya perkiraan untuk perencanaan, bukan pengganti formulasi yang ditinjau ahli setempat.</p></div>
        </aside>
      </div>
    </>
  );
}

function NutrientRow({ label, value, target, valuePercent, color }) {
  return (
    <div className="nutrient-row"><div className="nutrient-label"><strong>{label}</strong><span>{target}</span></div><strong className="nutrient-value">{value}</strong><div className="nutrient-track"><i className={`nutrient-${color || 'sage'}`} style={{ width: `${valuePercent}%` }} /></div></div>
  );
}

function AddIngredientDropdown({ ingredients, items, addIngredient }) {
  const [open, setOpen] = useState(false);
  const available = ingredients.filter((ingredient) => !items.some((item) => item.ingredient_id === ingredient.id));
  return (
    <div className="add-ingredient-wrap">
      <button className="add-ingredient-button" onClick={() => setOpen(!open)}><Plus size={16} /> Tambahkan bahan <ChevronDown size={15} /></button>
      {open && <div className="ingredient-menu">
        {available.map((ingredient) => <button key={ingredient.id} onClick={() => { addIngredient(ingredient.id); setOpen(false); }}><span className={`ingredient-mini-icon bar-${ingredient.color}`}><Leaf size={13} /></span><span>{ingredient.name}<small>{categoryLabel(ingredient.category)}</small></span><Plus size={15} /></button>)}
        {!available.length && <p>Semua bahan sudah ada dalam racikan ini.</p>}
      </div>}
    </div>
  );
}

function AdvisorPage({ stage, setStage, recommendation, ingredientMap, useRecommendation, openGuide }) {
  const [batchSize, setBatchSize] = useState(100);
  return (
    <>
      <PageHeading eyebrow="PANDUAN PAKAN" title="Rekomendasi pakan" description="Pilih tahap pertumbuhan ternak untuk melihat contoh racikan awal." action={<span className="advisor-status"><span /> RACIKAN ACUAN</span>} />
      <div className="advisor-page-layout">
        <div className="advisor-main">
          <div className="stage-selector-label"><span className="eyebrow">TAHAP TERNAK</span><span>01 / 02</span></div>
          <div className="stage-cards">
            {stages.map((option, index) => (
              <button className={`stage-card ${stage === option.id ? 'selected' : ''}`} key={option.id} onClick={() => setStage(option.id)}>
                <span className="stage-number">0{index + 1}</span><span className="stage-icon">{index === 0 ? <Sparkles size={19} /> : index === 1 ? <Sprout size={19} /> : <Wheat size={19} />}</span>
                <strong>{option.label}</strong><small>{option.age}</small><span className="stage-radio">{stage === option.id && <i />}</span>
              </button>
            ))}
          </div>
          {recommendation && (
            <section className="panel recommendation-card">
              <div className="recommendation-heading"><div><span className="eyebrow">CONTOH RACIKAN</span><h2>{recommendation.title}</h2><p>{recommendation.description}</p></div><span className="recommendation-badge"><Sparkles size={14} /> SARAN</span></div>
              <div className="target-chips">
                <span><Sprout size={14} /> Sasaran protein: {recommendation.target_protein_pct}%</span>
                <span><Leaf size={14} /> Perkiraan: {recommendation.estimated_nutrition.protein_pct}% protein</span>
                <span><ArrowUpRight size={14} /> Sasaran energi: {kcalToMj(recommendation.target_energy_kcal_kg).toFixed(1)} MJ/kg</span>
                <span><Wheat size={14} /> Perkiraan: {kcalToMj(recommendation.estimated_nutrition.energy_kcal_kg).toFixed(1)} MJ/kg</span>
              </div>
              <div className="recommendation-table-head"><span>BAHAN PAKAN</span><span>KOMPOSISI</span><span>RACIKAN 100 KG</span></div>
              {recommendation.recipe.map((line) => (
                <div className="recommendation-line" key={line.ingredient_id}><span className="recommendation-ingredient"><span className={`ingredient-mini-icon bar-${ingredientMap[line.ingredient_id]?.color || 'sage'}`}><Leaf size={13} /></span>{ingredientMap[line.ingredient_id]?.name || line.ingredient_id}</span><strong>{line.percentage}%</strong><span className="batch-qty">{((batchSize * line.percentage) / 100).toFixed(1)} kg</span></div>
              ))}
              <div className="recommendation-footer"><label>Ukuran racikan <span><input type="number" min="1" max="100000" value={batchSize} onChange={(event) => setBatchSize(Math.max(1, Number(event.target.value)))} /> kg</span></label><button className="button button-primary" onClick={() => useRecommendation(recommendation)}>Sesuaikan racikan <ArrowRight size={16} /></button></div>
            </section>
          )}
        </div>
        <aside className="advisor-aside">
          <div className="aside-illustration"><span className="circle-one" /><span className="circle-two" /><div className="illustration-leaf"><Sprout size={50} /></div><span className="illustration-caption">AWAL YANG BAIK</span></div>
          <div className="aside-copy"><span className="eyebrow">CATATAN FEEDER</span><h3>Kebutuhan setiap ternak berbeda.</h3><p>Contoh racikan ini menggunakan nilai bahan umum. Bahan lokal, jenis ternak, iklim, dan cara pemeliharaan juga berpengaruh.</p><button className="text-button" onClick={openGuide}>Baca buku panduan <ArrowRight size={14} /></button></div>
          <div className="nutritionist-card"><CircleHelp size={17} /><p>Untuk produksi, mintalah ahli nutrisi unggas meninjau formulasi pakan Anda.</p></div>
        </aside>
      </div>
    </>
  );
}

function FeedGuidePage({ setActivePage }) {
  return (
    <>
      <PageHeading
        eyebrow="PANDUAN FEEDER"
        title="Buku panduan meracik pakan"
        description="Panduan ringkas untuk memahami rekomendasi dan menyusun racikan di Feeder."
        action={<button className="button button-outline" onClick={() => setActivePage('Recipe advisor')}><ArrowRight className="back-arrow" size={15} /> Kembali ke rekomendasi</button>}
      />
      <div className="feed-guide-layout">
        <nav className="panel feed-guide-index" aria-label="Daftar isi buku panduan">
          <span className="eyebrow">DAFTAR ISI</span>
          <a href="#guide-start">Memulai dari rekomendasi</a>
          <a href="#guide-customize">Menyesuaikan racikan</a>
          <a href="#guide-ingredients">Memahami bahan dan nutrisi</a>
          <a href="#guide-practical">Menggunakan data dengan bijak</a>
        </nav>
        <article className="panel feed-guide-content">
          <section id="guide-start">
            <span className="guide-number">01</span>
            <div><h2>Memulai dari rekomendasi</h2><p>Pilih tahap ternak pada halaman rekomendasi untuk melihat contoh racikan awal. Angka komposisi menunjukkan bagian tiap bahan dalam campuran, sedangkan kolom ukuran racikan mengubah jumlah kilogram sesuai kebutuhan.</p><p>Gunakan tombol <strong>Sesuaikan racikan</strong> untuk menyalin contoh tersebut ke peracik. Racikan kemudian dapat diubah sebelum disimpan.</p></div>
          </section>
          <section id="guide-customize">
            <span className="guide-number">02</span>
            <div><h2>Menyesuaikan racikan</h2><p>Di halaman peracik, ubah jumlah setiap bahan dalam kilogram. Feeder menghitung kembali persentase komposisi, perkiraan nilai nutrisi, dan biaya berdasarkan jumlah yang dimasukkan.</p><p>Gunakan <strong>Ekspor CSV</strong> untuk mengunduh komposisi racikan. Racikan dan bahan buatan sendiri tersimpan secara lokal di browser ini.</p></div>
          </section>
          <section id="guide-ingredients">
            <span className="guide-number">03</span>
            <div><h2>Memahami bahan dan nutrisi</h2><p>Daftar bahan menampilkan estimasi protein, energi metabolis, serat, lemak, kalsium, fosfor, dan biaya per kilogram. Energi ditampilkan dalam MJ/kg, berat dalam kilogram, dan biaya dalam rupiah.</p><p>Anda dapat menambahkan bahan sendiri dengan mengisi profil nutrisinya. Gunakan nilai dari label pemasok atau hasil analisis laboratorium dengan basis pengukuran yang konsisten. Tautan pencarian web hanya membuka pencarian eksternal; Feeder tidak memverifikasi atau mengimpor hasilnya.</p></div>
          </section>
          <section id="guide-practical">
            <span className="guide-number">04</span>
            <div><h2>Menggunakan data dengan bijak</h2><p>Nilai bahan katalog dan harga di aplikasi adalah perkiraan untuk perencanaan, bukan penawaran harga langsung. Kandungan dapat berubah menurut pemasok, proses, kadar air, dan mutu bahan.</p><p>Rekomendasi merupakan titik awal, bukan formulasi yang dijamin memenuhi kebutuhan setiap ternak. Sebelum digunakan untuk produksi, tinjau racikan bersama ahli nutrisi unggas dan sesuaikan dengan jenis, umur, tujuan produksi, bahan lokal, serta aturan yang berlaku.</p></div>
          </section>
        </article>
      </div>
    </>
  );
}

function IngredientsPage({
  ingredients,
  searchTerm,
  setSearchTerm,
  addIngredient,
  items,
  setActivePage,
  onSaveIngredient,
  onDeleteIngredient,
  customIngredientIds,
  customIngredientCount,
}) {
  const [showIngredientForm, setShowIngredientForm] = useState(false);
  const webSearchUrl = searchTerm.trim()
    ? `https://www.google.com/search?q=${encodeURIComponent(`${searchTerm.trim()} bahan pakan ternak kandungan nutrisi Feedipedia`)}`
    : '';

  return (
    <>
      <PageHeading eyebrow="PERSIAPAN PAKAN" title="Daftar bahan" description="Kenali nilai nutrisi dan biaya setiap bahan dalam racikan." action={<button className="button button-primary" onClick={() => setShowIngredientForm((visible) => !visible)}><Plus size={17} /> Tambah bahan sendiri</button>} />
      <div className="catalog-toolbar">
        <div className="search-field"><Search size={17} /><input aria-label="Cari bahan" placeholder="Cari bahan pakan…" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /><kbd>⌘ K</kbd></div>
        <span className="catalog-count">{ingredients.length} bahan · {customIngredientCount} bahan buatan sendiri</span>
      </div>
      {showIngredientForm && <CustomIngredientForm onSave={(values) => { if (onSaveIngredient(values)) setShowIngredientForm(false); }} onCancel={() => setShowIngredientForm(false)} />}
      {webSearchUrl && <div className="web-search-hint"><span>Tidak menemukan bahan yang dicari?</span><a href={webSearchUrl} target="_blank" rel="noreferrer">Cari “{searchTerm.trim()}” di web <ExternalLink size={14} /></a></div>}
      <div className="ingredient-catalog">
        {ingredients.map((ingredient) => {
          const included = items.some((item) => item.ingredient_id === ingredient.id);
          return (
            <article className="panel catalog-card" key={ingredient.id}>
              <div className={`catalog-art art-${ingredient.color}`}><span className="catalog-symbol">{ingredient.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}</span><span>{categoryLabel(ingredient.category)}</span></div>
              <div className="catalog-card-body">
                <div className="catalog-title">
                  <h3>{ingredient.name}<small>{ingredient.name_en}</small></h3>
                  <span className="cost-tag">{currency.format(ingredient.cost_per_kg)}<small>/kg</small></span>
                </div>
                <p className="catalog-subtitle">Nilai nutrisi per kg bahan</p>
                <div className="catalog-nutrients">
                  <span><small>PROTEIN</small><strong>{ingredient.protein_pct}%</strong></span>
                  <span><small>ENERGI</small><strong>{kcalToMj(ingredient.energy_kcal_kg).toFixed(1)} <i>MJ/kg</i></strong></span>
                  <span><small>SERAT</small><strong>{ingredient.fiber_pct}%</strong></span>
                  <span><small>LEMAK</small><strong>{ingredient.fat_pct}%</strong></span>
                  <span><small>KALSIUM</small><strong>{ingredient.calcium_pct}%</strong></span>
                  <span><small>FOSFOR</small><strong>{ingredient.phosphorus_pct}%</strong></span>
                </div>
                <button className={`catalog-add ${included ? 'included' : ''}`} onClick={() => { if (!included) { addIngredient(ingredient.id); setActivePage('Recipe builder'); } }}>{included ? <><Check size={15} /> Sudah dalam racikan</> : <><Plus size={15} /> Tambahkan ke racikan</>}</button>
                <div className="catalog-source">
                  <span>{customIngredientIds.has(ingredient.id) ? 'Bahan buatan sendiri' : 'Harga estimasi · cek pemasok lokal'}</span>
                  {ingredient.source_url && <a href={ingredient.source_url} target="_blank" rel="noreferrer">Sumber nutrisi <ExternalLink size={12} /></a>}
                  {customIngredientIds.has(ingredient.id) && <button className="catalog-delete" onClick={() => onDeleteIngredient(ingredient.id)}>Hapus</button>}
                </div>
              </div>
            </article>
          );
        })}
        {!ingredients.length && <div className="no-results">Tidak ada bahan yang cocok dengan “{searchTerm}”.</div>}
      </div>
      <p className="catalog-disclaimer"><CircleHelp size={15} /> Harga adalah estimasi perencanaan, bukan harga pasar langsung. Nilai nutrisi dapat berbeda menurut pemasok; verifikasi sebelum digunakan.</p>
    </>
  );
}

function CustomIngredientForm({ onSave, onCancel }) {
  function handleSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({
      name: String(data.get('name')).trim(),
      category: data.get('category'),
      protein_pct: Number(data.get('protein_pct')),
      energy_kcal_kg: Number(data.get('energy_mj_kg')) / 0.004184,
      fiber_pct: Number(data.get('fiber_pct')),
      fat_pct: Number(data.get('fat_pct')),
      calcium_pct: Number(data.get('calcium_pct')),
      phosphorus_pct: Number(data.get('phosphorus_pct')),
      cost_per_kg: Number(data.get('cost_per_kg')),
      source_url: String(data.get('source_url')).trim(),
    });
    event.currentTarget.reset();
  }

  return (
    <form className="panel custom-ingredient-form" onSubmit={handleSubmit}>
      <div className="custom-form-heading">
        <div><span className="eyebrow">BAHAN BARU</span><h2>Tambahkan bahan sendiri</h2></div>
        <button className="icon-button" type="button" aria-label="Tutup formulir" onClick={onCancel}><X size={17} /></button>
      </div>
      <p>Data disimpan hanya di perangkat ini. Masukkan nilai dengan basis yang sama, misalnya bahan kering.</p>
      <label className="custom-field">Nama bahan
        <input name="name" required maxLength="100" placeholder="Contoh: Bungkil kacang tanah" />
      </label>
      <label className="custom-field">Kelompok bahan
        <select name="category" defaultValue="Protein">
          <option value="Energy">Energi</option>
          <option value="Protein">Protein</option>
          <option value="Mineral">Mineral</option>
          <option value="Supplement">Suplemen</option>
        </select>
      </label>
      <div className="custom-nutrient-grid">
        <label className="custom-field">Protein kasar (%)
          <input name="protein_pct" type="number" min="0" max="100" step="0.01" required defaultValue="0" />
        </label>
        <label className="custom-field">Energi metabolis (MJ/kg)
          <input name="energy_mj_kg" type="number" min="0" max="41.84" step="0.01" required defaultValue="0" />
        </label>
        <label className="custom-field">Serat kasar (%)
          <input name="fiber_pct" type="number" min="0" max="100" step="0.01" required defaultValue="0" />
        </label>
        <label className="custom-field">Lemak kasar (%)
          <input name="fat_pct" type="number" min="0" max="100" step="0.01" required defaultValue="0" />
        </label>
        <label className="custom-field">Kalsium (%)
          <input name="calcium_pct" type="number" min="0" max="100" step="0.01" required defaultValue="0" />
        </label>
        <label className="custom-field">Fosfor (%)
          <input name="phosphorus_pct" type="number" min="0" max="100" step="0.01" required defaultValue="0" />
        </label>
        <label className="custom-field">Harga (Rp/kg)
          <input name="cost_per_kg" type="number" min="0" max="1000000000" step="1" required defaultValue="0" />
        </label>
        <label className="custom-field">Tautan sumber (opsional)
          <input name="source_url" type="url" maxLength="500" placeholder="https://" />
        </label>
      </div>
      <div className="custom-form-actions">
        <button className="button button-outline" type="button" onClick={onCancel}>Batal</button>
        <button className="button button-primary" type="submit"><Save size={15} /> Simpan bahan</button>
      </div>
    </form>
  );
}

function SavedRecipesPage({ recipes, ingredientMap, loadRecipe, deleteRecipe, setActivePage, activeTeam }) {
  return (
    <>
      <PageHeading eyebrow="BUKU RACIKAN" title="Racikan tersimpan" description={activeTeam ? `Racikan bersama tim ${activeTeam.name}.` : 'Racikan yang disimpan di perangkat ini. Gabung tim untuk menyimpan bersama.'} action={<button className="button button-primary" onClick={() => setActivePage('Recipe builder')}><Plus size={17} /> Buat racikan</button>} />
      {recipes.length ? <div className="saved-recipes-grid">
        {recipes.map((recipe) => {
          const quantity = recipe.items.reduce((sum, item) => sum + item.quantity_kg, 0);
          const date = new Date(recipe.savedAt).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
          return <article className="panel saved-recipe-card" key={recipe.id}><div className="saved-card-top"><span className="saved-recipe-icon"><BookOpen size={20} /></span><button className="row-remove" onClick={() => deleteRecipe(recipe.id)} aria-label={`Hapus ${recipe.name}`}><Trash2 size={15} /></button></div><span className="eyebrow">RACIKAN SENDIRI</span><h3>{recipe.name}</h3><p>{recipe.items.length} bahan · {quantity.toFixed(1)} kg racikan</p><div className="saved-recipe-preview">{recipe.items.slice(0, 3).map((item) => <span key={item.ingredient_id}>{ingredientMap[item.ingredient_id]?.name || item.ingredient_id}</span>)}{recipe.items.length > 3 && <span>+{recipe.items.length - 3} lainnya</span>}</div><div className="saved-recipe-footer"><small>Disimpan {date}</small><button className="text-button" onClick={() => loadRecipe(recipe)}>Buka racikan <ArrowRight size={14} /></button></div></article>;
        })}
      </div> : <div className="panel empty-recipes"><span className="empty-recipes-icon"><BookOpen size={22} /></span><h2>Belum ada racikan tersimpan.</h2><p>Susun racikan pakan dan simpan agar mudah dibuka kembali.</p><button className="button button-primary" onClick={() => setActivePage('Recipe builder')}><Plus size={16} /> Buat racikan pertama</button></div>}
    </>
  );
}

export default App;
