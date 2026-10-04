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
  Leaf,
  Menu,
  Plus,
  Save,
  Search,
  Sparkles,
  Sprout,
  Trash2,
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
  const [activePage, setActivePage] = useState('Overview');
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

  function saveRecipe() {
    if (!items.length) {
      setError('Tambahkan bahan sebelum menyimpan racikan.');
      return;
    }
    const recipe = {
      id: Date.now(),
      name: recipeName.trim() || 'Racikan tanpa nama',
      items,
      savedAt: new Date().toISOString(),
    };
    const next = [recipe, ...savedRecipes];
    setSavedRecipes(next);
    localStorage.setItem('feeder-recipes', JSON.stringify(next));
    setNotice('Racikan tersimpan di perangkat ini.');
    window.setTimeout(() => setNotice(''), 2800);
  }

  function loadRecipe(recipe) {
    setRecipeName(recipe.name);
    setItems(recipe.items);
    setActivePage('Recipe builder');
    setNotice(`Racikan “${recipe.name}” dibuka di peracik pakan.`);
    window.setTimeout(() => setNotice(''), 2800);
  }

  function deleteSavedRecipe(id) {
    const next = savedRecipes.filter((recipe) => recipe.id !== id);
    setSavedRecipes(next);
    localStorage.setItem('feeder-recipes', JSON.stringify(next));
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
  const navItems = [
    { id: 'Overview', label: 'Ringkasan', icon: Sprout },
    { id: 'Recipe builder', label: 'Peracik pakan', icon: FlaskConical },
    { id: 'Recipe advisor', label: 'Rekomendasi', icon: Sparkles },
    { id: 'Ingredients', label: 'Daftar bahan', icon: Wheat },
    { id: 'My recipes', label: 'Racikan tersimpan', icon: BookOpen },
  ];
  const pageLabels = Object.fromEntries(navItems.map(({ id, label }) => [id, label]));

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
      </aside>

      {mobileMenuOpen && <button className="mobile-scrim" aria-label="Tutup menu" onClick={() => setMobileMenuOpen(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu-button icon-button" aria-label="Buka menu" onClick={() => setMobileMenuOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>Beranda</span><ChevronRight size={14} /><strong>{pageLabels[activePage]}</strong></div>
          <div className="topbar-actions">
            <span className="date-chip"><Clock3 size={15} /> {new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date())}</span>
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
              setActivePage={setActivePage}
              useRecommendation={useRecommendation}
              loadRecipe={loadRecipe}
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

function OverviewPage({ analysis, currentStage, recommendation, ingredientMap, savedRecipes, setActivePage, useRecommendation, loadRecipe }) {
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
        <div><h2>Baru disimpan</h2><p>Racikan tersimpan di perangkat ini.</p></div>
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

function AdvisorPage({ stage, setStage, recommendation, ingredientMap, useRecommendation }) {
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
          <div className="aside-copy"><span className="eyebrow">CATATAN FEEDER</span><h3>Kebutuhan setiap ternak berbeda.</h3><p>Contoh racikan ini menggunakan nilai bahan umum. Bahan lokal, jenis ternak, iklim, dan cara pemeliharaan juga berpengaruh.</p><button className="text-button" onClick={() => document.getElementById('advisor-guidance')?.scrollIntoView({ behavior: 'smooth' })}>Baca panduan <ArrowRight size={14} /></button></div>
          <div className="nutritionist-card" id="advisor-guidance"><CircleHelp size={17} /><p>Untuk produksi, mintalah ahli nutrisi unggas meninjau formulasi pakan Anda.</p></div>
        </aside>
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

function SavedRecipesPage({ recipes, ingredientMap, loadRecipe, deleteRecipe, setActivePage }) {
  return (
    <>
      <PageHeading eyebrow="BUKU RACIKAN" title="Racikan tersimpan" description="Racikan yang Anda simpan di perangkat ini." action={<button className="button button-primary" onClick={() => setActivePage('Recipe builder')}><Plus size={17} /> Buat racikan</button>} />
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
