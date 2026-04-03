import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  Bike,
  Building2,
  Calendar,
  CalendarRange,
  ChefHat,
  ClipboardList,
  Clock3,
  FileDown,
  HelpCircle,
  Home,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MapPinned,
  MessageSquare,
  MessageCircle,
  Package,
  RefreshCcw,
  Route,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  TriangleAlert,
  Truck,
  UserCheck,
  Users,
  UserX,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import {
  apiClient,
  type AdminChef,
  type AdminDashboardPayload,
  type AdminStore,
  type AdminUser,
  type AuthUser,
  type ChefStatus,
  type MerchantOrder,
  type MerchantProduct,
  type MerchantProductInput,
  type MerchantProfile,
  type MerchantRegistrationInput,
  type MerchantStore,
  type MerchantStoreInput,
  persistSession,
  loadStoredSession,
  type SessionState,
  type StoreStatus,
} from "@/lib/api";

const DEFAULT_STORE_FORM: MerchantStoreInput = {
  universe: "supermarkets",
  name: "",
  tagline: "",
  description: "",
  location: "Abidjan",
  zone: "",
  accentColor: "#D4611A",
  visualKey: "",
  logoUrl: "",
  bannerUrl: "",
  etaMinMinutes: 20,
  etaMaxMinutes: 40,
};

const DEFAULT_PRODUCT_FORM: MerchantProductInput = {
  name: "",
  description: "",
  category: "General",
  price: 0,
  originalPrice: null,
  badge: "",
  unitLabel: "",
  visualKey: "",
  inStock: true,
};

const DEFAULT_REGISTER_FORM: MerchantRegistrationInput = {
  name: "",
  email: "",
  phone: "",
  password: "",
  location: "Abidjan",
  businessName: "",
  bio: "",
};

type SummaryTone = "warm" | "ink" | "teal";
type MetricTone = SummaryTone | "success" | "warning" | "danger";

function euroLikeAmount(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDateOnly(value?: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(date);
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getUserRoleLabel(type: AdminUser["type"]) {
  if (type === "client") return "Client";
  if (type === "chef") return "Cuisiniere";
  if (type === "courier") return "Livreur";
  if (type === "merchant") return "Marchand";
  return "Admin";
}

function getUserRoleTone(type: AdminUser["type"]) {
  if (type === "chef") return "warm";
  if (type === "courier") return "teal";
  if (type === "merchant") return "success";
  if (type === "admin") return "ink";
  return "neutral";
}

function getOrderStatusTone(status: string, isDelayed: boolean) {
  if (isDelayed) return "danger";
  if (/livr/i.test(status)) return "success";
  if (/annul/i.test(status)) return "danger";
  return "warning";
}

function emptyToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function emptyToNullableNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function humanizeStatus(value: string) {
  return value.replace(/_/g, " ");
}

function humanizeChefStatus(status: ChefStatus): string {
  const map: Record<ChefStatus, string> = {
    active: "Active",
    suspended: "Suspendue",
    pending_verification: "En verification",
    rejected: "Rejetee",
  };
  return map[status] ?? humanizeStatus(status);
}

function getChefStatusTone(status: ChefStatus): string {
  const map: Record<ChefStatus, string> = {
    active: "approved",
    suspended: "suspended",
    pending_verification: "pending_review",
    rejected: "rejected",
  };
  return map[status] ?? "draft";
}

function SummaryCard({
  tone,
  icon,
  label,
  value,
  meta,
}: {
  tone: SummaryTone;
  icon: React.ReactNode;
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <article className={`summary-card summary-${tone}`}>
      <div className="summary-icon">{icon}</div>
      <div className="summary-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{meta}</small>
      </div>
    </article>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="section-title-block">
      <span className="eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function buildSeries(length: number, seed: number, baseline: number, variance: number) {
  return Array.from({ length }, (_, index) => {
    const wave = Math.sin((index + seed) * 0.9) * variance;
    const trend = index * Math.max(1, variance * 0.18);
    return Math.max(4, Math.round(baseline + wave + trend));
  });
}

function buildSparklinePath(values: number[], width = 112, height = 32) {
  if (values.length === 0) {
    return "";
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function Sparkline({ values, tone }: { values: number[]; tone: MetricTone }) {
  return (
    <svg className={`sparkline sparkline-${tone}`} viewBox="0 0 112 32" preserveAspectRatio="none" aria-hidden="true">
      <path d={buildSparklinePath(values)} />
    </svg>
  );
}

function InsightMetricCard({
  label,
  value,
  delta,
  tone,
  values,
}: {
  label: string;
  value: string;
  delta: string;
  tone: MetricTone;
  values: number[];
}) {
  return (
    <article className={`insight-metric-card metric-${tone}`}>
      <div className="insight-metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{delta} vs periode precedente</small>
      </div>
      <Sparkline values={values} tone={tone} />
    </article>
  );
}

function AuthShell({
  loginIdentifier,
  password,
  setLoginIdentifier,
  setPassword,
  onLogin,
  loginBusy,
  registerForm,
  setRegisterForm,
  onRegister,
  registerBusy,
  authMode,
  setAuthMode,
  message,
}: {
  loginIdentifier: string;
  password: string;
  setLoginIdentifier: (value: string) => void;
  setPassword: (value: string) => void;
  onLogin: () => void;
  loginBusy: boolean;
  registerForm: MerchantRegistrationInput;
  setRegisterForm: (updater: (value: MerchantRegistrationInput) => MerchantRegistrationInput) => void;
  onRegister: () => void;
  registerBusy: boolean;
  authMode: "login" | "register";
  setAuthMode: (value: "login" | "register") => void;
  message: string | null;
}) {
  return (
    <div className="sl-root">
      {/* ── Left branding panel ───────────────────────── */}
      <div className="sl-brand">
        <div className="sl-brand-inner">
          {/* Logo */}
          <div className="sl-logo-row">
            <div className="sl-logo-mark">N</div>
            <span className="sl-logo-name">Nixyah</span>
          </div>

          {/* Headline */}
          <div className="sl-headline-block">
            <span className="sl-eyebrow">Backoffice SaaS</span>
            <h1 className="sl-headline">
              Pilotez votre reseau<br />
              <span className="sl-headline-accent">sans friction.</span>
            </h1>
            <p className="sl-subline">
              Merchants et admins centralisent moderation, catalogue et operations dans une seule interface claire et rapide.
            </p>
          </div>

          {/* Feature pills */}
          <div className="sl-features">
            <div className="sl-feature-item">
              <span className="sl-feature-icon"><ShieldCheck size={16} /></span>
              <span>Acces securise dual-role</span>
            </div>
            <div className="sl-feature-item">
              <span className="sl-feature-icon"><BarChart3 size={16} /></span>
              <span>KPIs et analytics en temps reel</span>
            </div>
            <div className="sl-feature-item">
              <span className="sl-feature-icon"><Users size={16} /></span>
              <span>Gestion cuisinieres et enseignes</span>
            </div>
            <div className="sl-feature-item">
              <span className="sl-feature-icon"><Truck size={16} /></span>
              <span>Suivi operations et livraisons</span>
            </div>
          </div>

          {/* Mock UI preview */}
          <div className="sl-mock-ui" aria-hidden="true">
            <div className="sl-mock-header">
              <div className="sl-mock-dots">
                <span /><span /><span />
              </div>
              <span className="sl-mock-title">Dashboard admin</span>
            </div>
            <div className="sl-mock-body">
              <div className="sl-mock-sidebar">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`sl-mock-nav-item${i === 1 ? " active" : ""}`} />
                ))}
              </div>
              <div className="sl-mock-content">
                <div className="sl-mock-kpi-row">
                  {["1 284", "14.8%", "12", "94%"].map((v) => (
                    <div key={v} className="sl-mock-kpi">
                      <span className="sl-mock-kpi-val">{v}</span>
                      <span className="sl-mock-kpi-label" />
                    </div>
                  ))}
                </div>
                <div className="sl-mock-chart">
                  {[42, 68, 56, 84, 73, 92, 88, 76].map((h, i) => (
                    <span key={i} className="sl-mock-bar" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className="sl-mock-rows">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="sl-mock-row">
                      <span className="sl-mock-avatar" />
                      <span className="sl-mock-line" />
                      <span className={`sl-mock-badge${i === 0 ? " green" : i === 1 ? " orange" : ""}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="sl-brand-footer">
            Connectez-vous pour acceder a votre espace.
          </p>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────── */}
      <div className="sl-form-panel">
        <div className="sl-form-card">
          {/* Header */}
          <div className="sl-form-header">
            <div className="sl-mobile-logo">
              <div className="sl-logo-mark">N</div>
              <span className="sl-logo-name">Nixyah</span>
            </div>
            <h2 className="sl-form-title">
              {authMode === "login" ? "Connexion" : "Creer un compte"}
            </h2>
            <p className="sl-form-desc">
              {authMode === "login"
                ? "Entrez vos identifiants pour acceder au backoffice."
                : "Ouvrez un espace marchand en quelques secondes."}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="sl-tabs">
            <button
              type="button"
              className={`sl-tab${authMode === "login" ? " active" : ""}`}
              onClick={() => setAuthMode("login")}
            >
              Connexion
            </button>
            <button
              type="button"
              className={`sl-tab${authMode === "register" ? " active" : ""}`}
              onClick={() => setAuthMode("register")}
            >
              Inscription
            </button>
          </div>

          {/* Alert */}
          {message ? (
            <div className="sl-alert">
              <ShieldCheck size={15} />
              <span>{message}</span>
            </div>
          ) : null}

          {/* Forms */}
          {authMode === "login" ? (
            <div className="sl-fields">
              <div className="sl-field">
                <label className="sl-label">Email ou telephone</label>
                <input
                  className="sl-input"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="admin@nixyah.ci"
                  onKeyDown={(e) => e.key === "Enter" && onLogin()}
                />
              </div>
              <div className="sl-field">
                <label className="sl-label">Mot de passe</label>
                <input
                  className="sl-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === "Enter" && onLogin()}
                />
              </div>
              <button className="sl-submit" onClick={onLogin} type="button" disabled={loginBusy}>
                {loginBusy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
                Se connecter
              </button>
              <div className="sl-divider"><span>Securise</span></div>
              <div className="sl-trust-row">
                <span className="sl-trust-item"><ShieldCheck size={13} />Session chiffree</span>
                <span className="sl-trust-item"><BarChart3 size={13} />Acces instantane</span>
              </div>
            </div>
          ) : (
            <div className="sl-fields">
              <div className="sl-field-row">
                <div className="sl-field">
                  <label className="sl-label">Nom complet</label>
                  <input className="sl-input" value={registerForm.name} onChange={(e) => setRegisterForm((c) => ({ ...c, name: e.target.value }))} placeholder="Aminata Kone" />
                </div>
                <div className="sl-field">
                  <label className="sl-label">Nom commercial</label>
                  <input className="sl-input" value={registerForm.businessName} onChange={(e) => setRegisterForm((c) => ({ ...c, businessName: e.target.value }))} placeholder="Mon Enseigne" />
                </div>
              </div>
              <div className="sl-field-row">
                <div className="sl-field">
                  <label className="sl-label">Email</label>
                  <input className="sl-input" value={registerForm.email} onChange={(e) => setRegisterForm((c) => ({ ...c, email: e.target.value }))} placeholder="vous@example.ci" />
                </div>
                <div className="sl-field">
                  <label className="sl-label">Telephone</label>
                  <input className="sl-input" value={registerForm.phone} onChange={(e) => setRegisterForm((c) => ({ ...c, phone: e.target.value }))} placeholder="+225 07 00 00 00" />
                </div>
              </div>
              <div className="sl-field-row">
                <div className="sl-field">
                  <label className="sl-label">Mot de passe</label>
                  <input className="sl-input" type="password" value={registerForm.password} onChange={(e) => setRegisterForm((c) => ({ ...c, password: e.target.value }))} placeholder="••••••••" />
                </div>
                <div className="sl-field">
                  <label className="sl-label">Ville</label>
                  <input className="sl-input" value={registerForm.location} onChange={(e) => setRegisterForm((c) => ({ ...c, location: e.target.value }))} />
                </div>
              </div>
              <div className="sl-field">
                <label className="sl-label">Presentation <span className="sl-label-opt">(optionnel)</span></label>
                <textarea className="sl-input sl-textarea" value={registerForm.bio} onChange={(e) => setRegisterForm((c) => ({ ...c, bio: e.target.value }))} rows={3} placeholder="Decrivez votre activite..." />
              </div>
              <button className="sl-submit" onClick={onRegister} type="button" disabled={registerBusy}>
                {registerBusy ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
                Creer mon compte
              </button>
              <p className="sl-register-note">
                Validation par l equipe avant activation. Vous serez notifie par email.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MerchantDashboard({
  user,
  profile,
  stores,
  selectedStore,
  products,
  orders,
  storeForm,
  setStoreForm,
  productForm,
  setProductForm,
  selectStore,
  createStore,
  updateStore,
  createProduct,
  updateProduct,
  busy,
}: {
  user: AuthUser;
  profile: MerchantProfile | null;
  stores: MerchantStore[];
  selectedStore: MerchantStore | null;
  products: MerchantProduct[];
  orders: MerchantOrder[];
  storeForm: MerchantStoreInput;
  setStoreForm: (updater: (value: MerchantStoreInput) => MerchantStoreInput) => void;
  productForm: MerchantProductInput;
  setProductForm: (updater: (value: MerchantProductInput) => MerchantProductInput) => void;
  selectStore: (store: MerchantStore) => void;
  createStore: () => void;
  updateStore: () => void;
  createProduct: () => void;
  updateProduct: (productId: number, patch: Partial<MerchantProductInput>) => void;
  busy: boolean;
}) {
  return (
    <div className="saas-dashboard-layout">
      {/* Compact stats sidebar */}
      <aside className="saas-stats-sidebar">
        <div className="saas-stats-sidebar-header">
          <div className="profile-badge profile-badge-strong">
            <Building2 size={18} />
            <span>{profile?.businessName ?? user.name}</span>
          </div>
          <span className="sidebar-kicker">Espace marchand</span>
        </div>
        <div className="sidebar-highlight-card saas-active-store-card">
          <span className="eyebrow">Enseigne active</span>
          <strong>{selectedStore?.name ?? "Aucune enseigne"}</strong>
          <small>{selectedStore ? `${selectedStore.location} · ${humanizeStatus(selectedStore.status)}` : "Selectionnez une enseigne."}</small>
        </div>
        <SummaryCard tone="warm" icon={<Store size={18} />} label="Enseignes" value={String(stores.length)} meta="Actives ou en revue" />
        <SummaryCard tone="teal" icon={<Package size={18} />} label="Produits" value={String(products.length)} meta="Catalogue charge" />
        <SummaryCard tone="ink" icon={<WalletCards size={18} />} label="Volume" value={euroLikeAmount(orders.reduce((sum, order) => sum + order.totalAmount, 0))} meta="Commandes recuperees" />
      </aside>

      <section className="dashboard-main workspace-main">
        {/* ── Hero banner ─────────────────────────────── */}
        <section id="section-overview" className="saas-dashboard-hero saas-dashboard-hero-merchant">
          <div className="sdh-text">
            <span className="sdh-eyebrow">Espace marchand · Nixyah</span>
            <h2 className="sdh-title">{profile?.businessName ?? "Mon espace"}</h2>
            <p className="sdh-desc">Gérez vos enseignes, votre catalogue et suivez vos commandes en temps réel.</p>
            <div className="sdh-status-row">
              <span className="sdh-status-chip">
                <span className="sdh-pulse" />
                {stores.filter((s) => s.status === "approved").length} actives
              </span>
              <span className="sdh-status-chip">
                <Package size={13} />
                {products.length} produits
              </span>
              <span className="sdh-status-chip">
                <ShoppingBag size={13} />
                {orders.length} commandes
              </span>
            </div>
          </div>
          <div className="sdh-illustration" aria-hidden="true">
            <div className="sdh-ill-bg" />
            <div className="sdh-ill-inner">
              <div className="sdh-logo-placeholder">
                <div className="sdh-logo-mark">N</div>
              </div>
              <div className="sdh-ill-dots">
                {[...Array(16)].map((_, i) => <span key={i} className="sdh-dot" />)}
              </div>
              <div className="sdh-ill-ring sdh-ill-ring-1" />
              <div className="sdh-ill-ring sdh-ill-ring-2" />
            </div>
          </div>
        </section>

        <section className="glass-panel section-card merchant-overview-section">
          <div className="section-heading refined-heading">
            <SectionTitle eyebrow="Vue operationnelle" title="Lecture rapide de votre activite" description="Une synthese directe avant de passer a la gestion des enseignes, du catalogue et des commandes." />
            <Sparkles size={18} />
          </div>
          <div className="workspace-summary-row">
            <SummaryCard tone="warm" icon={<Sparkles size={18} />} label="Statut courant" value={selectedStore ? humanizeStatus(selectedStore.status) : "En attente"} meta="Validation boutique et activation catalogue" />
            <SummaryCard tone="ink" icon={<ClipboardList size={18} />} label="Commandes" value={String(orders.length)} meta="Suivi concentre sur la boutique selectionnee" />
            <SummaryCard tone="teal" icon={<BarChart3 size={18} />} label="Performance" value={euroLikeAmount(orders.reduce((sum, order) => sum + order.totalAmount, 0))} meta="Valeur brute des commandes chargees" />
          </div>
          <div className="merchant-focus-strip">
            <div className="merchant-focus-card">
              <span>Enseigne cible</span>
              <strong>{selectedStore?.name ?? "Aucune enseigne selectionnee"}</strong>
              <small>{selectedStore?.zone ?? "Choisissez une enseigne pour charger ses details."}</small>
            </div>
            <div className="merchant-focus-card">
              <span>Fenetre livraison</span>
              <strong>{selectedStore ? `${selectedStore.etaMinMinutes}-${selectedStore.etaMaxMinutes} min` : "-"}</strong>
              <small>{selectedStore ? selectedStore.location : "Les SLA s affichent ici des qu une enseigne est active."}</small>
            </div>
          </div>
        </section>

        <section id="section-stores" className="merchant-workspace-section">
          <div className="section-heading refined-heading">
            <SectionTitle eyebrow="Enseignes" title="Creation et edition de vos points de vente" description="Chaque bloc isole clairement la configuration d une enseigne et la selection de l espace de travail actif." />
            <Store size={18} />
          </div>
          <div className="panel-grid two-up">
          <section className="glass-panel section-card">
            <div className="section-heading refined-heading">
              <SectionTitle eyebrow="Nouvelles enseignes" title="Creer un point de vente" description="Structurez une nouvelle enseigne complete avec localisation, branding et delais de livraison." />
              {busy ? <LoaderCircle className="spin" size={18} /> : null}
            </div>
            <div className="form-row two-columns">
              <label>
                <span>Univers</span>
                <select value={storeForm.universe} onChange={(event) => setStoreForm((current) => ({ ...current, universe: event.target.value as MerchantStoreInput["universe"] }))}>
                  <option value="courses">Courses</option>
                  <option value="supermarkets">Supermarches</option>
                  <option value="boutiques">Boutiques</option>
                </select>
              </label>
              <label>
                <span>Nom</span>
                <input value={storeForm.name} onChange={(event) => setStoreForm((current) => ({ ...current, name: event.target.value }))} />
              </label>
            </div>
            <label>
              <span>Tagline</span>
              <input value={storeForm.tagline} onChange={(event) => setStoreForm((current) => ({ ...current, tagline: event.target.value }))} />
            </label>
            <label>
              <span>Description</span>
              <textarea value={storeForm.description} rows={3} onChange={(event) => setStoreForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <div className="form-row two-columns">
              <label>
                <span>Localisation</span>
                <input value={storeForm.location} onChange={(event) => setStoreForm((current) => ({ ...current, location: event.target.value }))} />
              </label>
              <label>
                <span>Zone</span>
                <input value={storeForm.zone} onChange={(event) => setStoreForm((current) => ({ ...current, zone: event.target.value }))} />
              </label>
            </div>
            <div className="form-row three-columns">
              <label>
                <span>Couleur</span>
                <input value={storeForm.accentColor} onChange={(event) => setStoreForm((current) => ({ ...current, accentColor: event.target.value }))} />
              </label>
              <label>
                <span>ETA min</span>
                <input type="number" value={storeForm.etaMinMinutes} onChange={(event) => setStoreForm((current) => ({ ...current, etaMinMinutes: Number(event.target.value) || 0 }))} />
              </label>
              <label>
                <span>ETA max</span>
                <input type="number" value={storeForm.etaMaxMinutes} onChange={(event) => setStoreForm((current) => ({ ...current, etaMaxMinutes: Number(event.target.value) || 0 }))} />
              </label>
            </div>
            <div className="form-row two-columns">
              <label>
                <span>Logo URL</span>
                <input value={storeForm.logoUrl} onChange={(event) => setStoreForm((current) => ({ ...current, logoUrl: event.target.value }))} />
              </label>
              <label>
                <span>Banner URL</span>
                <input value={storeForm.bannerUrl} onChange={(event) => setStoreForm((current) => ({ ...current, bannerUrl: event.target.value }))} />
              </label>
            </div>
            <button className="primary-button" type="button" onClick={createStore}>Soumettre l enseigne</button>
          </section>

          <section className="glass-panel section-card">
            <div className="section-heading refined-heading">
              <SectionTitle eyebrow="Mes enseignes" title="Selection et edition" description="Basculer entre vos enseignes recharge le contexte de travail sans changer de page." />
            </div>
            <div className="store-list">
              {stores.length === 0 ? <p className="empty-state">Aucune enseigne pour le moment.</p> : null}
              {stores.map((store) => (
                <button key={store.id} className={selectedStore?.id === store.id ? "store-card active" : "store-card"} type="button" onClick={() => selectStore(store)}>
                  <div className="store-card-copy">
                    <strong>{store.name}</strong>
                    <span>{store.universe} · {store.location}</span>
                  </div>
                  <span className={`status-pill status-${store.status}`}>{humanizeStatus(store.status)}</span>
                </button>
              ))}
            </div>
            {selectedStore ? (
              <>
                <div className="form-row two-columns compact-top">
                  <label>
                    <span>Nom</span>
                    <input value={storeForm.name} onChange={(event) => setStoreForm((current) => ({ ...current, name: event.target.value }))} />
                  </label>
                  <label>
                    <span>Tagline</span>
                    <input value={storeForm.tagline} onChange={(event) => setStoreForm((current) => ({ ...current, tagline: event.target.value }))} />
                  </label>
                </div>
                <label>
                  <span>Description</span>
                  <textarea value={storeForm.description} rows={3} onChange={(event) => setStoreForm((current) => ({ ...current, description: event.target.value }))} />
                </label>
                <button className="secondary-button" type="button" onClick={updateStore}>Mettre a jour l enseigne</button>
              </>
            ) : null}
          </section>
          </div>
        </section>

        <section id="section-analytics" className="merchant-workspace-section">
          <div className="section-heading refined-heading">
            <SectionTitle eyebrow="Catalogue" title="Produits, stock et actions rapides" description="Le catalogue devient une section autonome avec creation produit a gauche et maintenance du stock a droite." />
            <Package size={18} />
          </div>
          <div className="panel-grid two-up merchant-catalog-grid">
          <section className="glass-panel section-card">
            <div className="section-heading refined-heading">
              <SectionTitle eyebrow="Catalogue" title="Ajouter un produit" description="Ajoutez des references commercialisables avec prix, unite et signaletique promotionnelle." />
            </div>
            {!selectedStore ? <p className="empty-state">Selectionnez une enseigne pour gerer le catalogue.</p> : null}
            <div className="form-row two-columns">
              <label>
                <span>Nom</span>
                <input value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label>
                <span>Categorie</span>
                <input value={productForm.category} onChange={(event) => setProductForm((current) => ({ ...current, category: event.target.value }))} />
              </label>
            </div>
            <label>
              <span>Description</span>
              <textarea value={productForm.description} rows={3} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <div className="form-row three-columns">
              <label>
                <span>Prix</span>
                <input type="number" value={productForm.price} onChange={(event) => setProductForm((current) => ({ ...current, price: Number(event.target.value) || 0 }))} />
              </label>
              <label>
                <span>Prix barre</span>
                <input
                  type="number"
                  value={productForm.originalPrice ?? ""}
                  onChange={(event) => setProductForm((current) => ({ ...current, originalPrice: emptyToNullableNumber(event.target.value) }))}
                />
              </label>
              <label>
                <span>Unite</span>
                <input value={productForm.unitLabel} onChange={(event) => setProductForm((current) => ({ ...current, unitLabel: event.target.value }))} />
              </label>
            </div>
            <div className="form-row two-columns">
              <label>
                <span>Badge</span>
                <input value={productForm.badge} onChange={(event) => setProductForm((current) => ({ ...current, badge: event.target.value }))} />
              </label>
              <label>
                <span>Visual key</span>
                <input value={productForm.visualKey} onChange={(event) => setProductForm((current) => ({ ...current, visualKey: event.target.value }))} />
              </label>
            </div>
            <label className="toggle-row">
              <input type="checkbox" checked={productForm.inStock} onChange={(event) => setProductForm((current) => ({ ...current, inStock: event.target.checked }))} />
              <span>Produit en stock</span>
            </label>
            <button className="primary-button" type="button" onClick={createProduct} disabled={!selectedStore}>Ajouter le produit</button>
          </section>

          <section className="glass-panel section-card">
            <div className="section-heading refined-heading">
              <SectionTitle eyebrow="Produits actifs" title="Actions rapides" description="Basculez le stock et les badges marketing sans recharger tout le catalogue." />
            </div>
            <div className="product-list">
              {products.length === 0 ? <p className="empty-state">Aucun produit charge.</p> : null}
              {products.map((product) => (
                <article className="product-card" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.category} · {euroLikeAmount(product.price)}</span>
                  </div>
                  <div className="product-actions">
                    <button className="ghost-button" type="button" onClick={() => updateProduct(product.id, { inStock: !product.inStock })}>
                      {product.inStock ? "Passer hors stock" : "Remettre en stock"}
                    </button>
                    <button className="ghost-button" type="button" onClick={() => updateProduct(product.id, { badge: product.badge ? "" : "Nouveau" })}>
                      {product.badge ? "Retirer badge" : "Ajouter badge"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          </div>
        </section>

        <section id="section-orders" className="glass-panel section-card">
          <div className="section-heading">
            <SectionTitle eyebrow="Commandes" title="Suivi de la boutique selectionnee" description="Chaque commande affiche synthese client, montant et detail des lignes chargees." />
            <Truck size={18} />
          </div>
          <div className="orders-list">
            {orders.length === 0 ? <p className="empty-state">Aucune commande recuperee pour cette enseigne.</p> : null}
            {orders.map((order) => (
              <article className="order-card" key={order.id}>
                <div className="order-summary">
                  <strong>Commande #{order.id}</strong>
                  <span>{order.status} · {euroLikeAmount(order.totalAmount)}</span>
                  <span>{order.customerName || "Client inconnu"} · {order.customerPhone || "Sans numero"}</span>
                  <span>{formatDate(order.createdAt)}</span>
                </div>
                <div className="order-items">
                  {order.items.map((item) => (
                    <span key={item.id}>{item.productName} x{item.quantity}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function AdminDashboard({
  token,
  stores,
  filter,
  setFilter,
  onUpdateStatus,
  chefs,
  chefsFilter,
  setChefsFilter,
  onUpdateChefStatus,
  onVerifyChef,
  allUsers,
  busy,
}: {
  token: string;
  stores: AdminStore[];
  filter: StoreStatus | "all";
  setFilter: (value: StoreStatus | "all") => void;
  onUpdateStatus: (storeId: number, status: StoreStatus, isActive?: boolean) => void;
  chefs: AdminChef[];
  chefsFilter: ChefStatus | "all";
  setChefsFilter: (value: ChefStatus | "all") => void;
  onUpdateChefStatus: (chefId: string, status: ChefStatus) => void;
  onVerifyChef: (chefId: string, isVerified: boolean) => void;
  allUsers: AdminUser[];
  busy: boolean;
}) {
  const [timeScale, setTimeScale] = useState<"hour" | "day" | "week">("day");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [orderTypeFilter, setOrderTypeFilter] = useState<"all" | "courses" | "supermarkets" | "boutiques">("all");
  const [dateValue, setDateValue] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedChefKey, setSelectedChefKey] = useState<string | null>(null);
  const [selectedCourierId, setSelectedCourierId] = useState<number | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboardPayload | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardBusy, startDashboardTransition] = useTransition();
  const [usersTypeFilter, setUsersTypeFilter] = useState<"all" | "client" | "chef" | "courier" | "merchant" | "admin">("all");
  const [chartMode, setChartMode] = useState<"orders" | "revenue">("orders");
  const [partnerTab, setPartnerTab] = useState<"all" | "supermarkets" | "boutiques" | "courses">("all");
  const [chefSort, setChefSort] = useState<"createdAt" | "rating" | "reviews">("createdAt");
  const [rangeStart, setRangeStart] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return date.toISOString().slice(0, 10);
  });
  const [rangeEnd, setRangeEnd] = useState(() => new Date().toISOString().slice(0, 10));

  const counts = useMemo(() => {
    return stores.reduce<Record<string, number>>((accumulator, store) => {
      accumulator[store.status] = (accumulator[store.status] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [stores]);

  const zones = useMemo(() => {
    const unique = new Set<string>();
    stores.forEach((store) => {
      const value = store.zone || store.location;
      if (value) unique.add(value);
    });
    return ["all", ...Array.from(unique).sort((left, right) => left.localeCompare(right))];
  }, [stores]);

  const visibleStores = useMemo(() => {
    return stores.filter((store) => {
      if (zoneFilter !== "all" && (store.zone || store.location) !== zoneFilter) {
        return false;
      }
      if (orderTypeFilter !== "all" && store.universe !== orderTypeFilter) {
        return false;
      }
      return true;
    });
  }, [stores, zoneFilter, orderTypeFilter]);

  useEffect(() => {
    if (!selectedOrderId) {
      return;
    }

    const orderStillVisible = dashboard?.orders.some((order) => order.id === selectedOrderId) ?? false;
    if (!orderStillVisible) {
      setSelectedOrderId(null);
    }
  }, [dashboard?.orders, selectedOrderId]);

  useEffect(() => {
    if (selectedUserId && !allUsers.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(null);
    }

    if (
      selectedChefKey &&
      !chefs.some((chef) => chef.id === selectedChefKey || chef.name === selectedChefKey) &&
      !(dashboard?.chefs.some((chef) => String(chef.id) === selectedChefKey || chef.name === selectedChefKey) ?? false)
    ) {
      setSelectedChefKey(null);
    }

    if (selectedCourierId && !(dashboard?.couriers.some((courier) => courier.id === selectedCourierId) ?? false)) {
      setSelectedCourierId(null);
    }

    if (selectedStoreId && !stores.some((store) => store.id === selectedStoreId)) {
      setSelectedStoreId(null);
    }
  }, [allUsers, chefs, dashboard?.chefs, dashboard?.couriers, selectedChefKey, selectedCourierId, selectedStoreId, selectedUserId, stores]);

  useEffect(() => {
    const hasOpenPreview = Boolean(selectedOrderId || selectedUserId || selectedChefKey || selectedCourierId || selectedStoreId);
    if (!hasOpenPreview || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAllPreviews();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedChefKey, selectedCourierId, selectedOrderId, selectedStoreId, selectedUserId]);

  useEffect(() => {
    setDashboardError(null);
    startDashboardTransition(() => {
      void apiClient
        .getAdminDashboard(token, {
          scale: timeScale,
          zone: zoneFilter,
          universe: orderTypeFilter,
          status: filter,
        })
        .then((payload) => setDashboard(payload))
        .catch((error) => {
          setDashboardError(error instanceof Error ? error.message : "Impossible de charger les metriques admin.");
        });
    });
  }, [filter, orderTypeFilter, timeScale, token, zoneFilter]);

  const analytics = dashboard;
  const selectedOrder = analytics?.orders.find((order) => order.id === selectedOrderId) ?? null;
  const selectedUser = allUsers.find((user) => user.id === selectedUserId) ?? null;
  const selectedChef = chefs.find((chef) => chef.id === selectedChefKey || chef.name === selectedChefKey) ?? null;
  const selectedChefSnapshot = analytics?.chefs.find((chef) => String(chef.id) === selectedChefKey || chef.name === selectedChefKey) ?? null;
  const selectedCourier = analytics?.couriers.find((courier) => courier.id === selectedCourierId) ?? null;
  const selectedStore = stores.find((store) => store.id === selectedStoreId) ?? null;
  const delayedOrdersCount = analytics?.orders.filter((order) => order.isDelayed).length ?? 0;
  const chefStatusCounts = useMemo(() => {
    return chefs.reduce<Record<string, number>>((accumulator, chef) => {
      accumulator[chef.status] = (accumulator[chef.status] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [chefs]);
  const topZone = analytics?.zones[0] ?? null;
  const topPartner = analytics?.partners.supermarkets[0] ?? analytics?.partners.boutiques[0] ?? null;
  const currentChartSeries = useMemo(() => {
    if (!analytics) return [];
    if (chartMode === "revenue") {
      return analytics.chart.current.map((value) => value * Math.max(analytics.overview.averageBasket, 1));
    }
    return analytics.chart.current;
  }, [analytics, chartMode]);
  const previousChartSeries = useMemo(() => {
    if (!analytics) return [];
    if (chartMode === "revenue") {
      return analytics.chart.previous.map((value) => value * Math.max(analytics.overview.averageBasket, 1));
    }
    return analytics.chart.previous;
  }, [analytics, chartMode]);
  const maxChartValue = Math.max(1, ...currentChartSeries, ...previousChartSeries);
  const filteredUsers = useMemo(() => {
    return usersTypeFilter === "all" ? allUsers : allUsers.filter((user) => user.type === usersTypeFilter);
  }, [allUsers, usersTypeFilter]);
  const sortedChefs = useMemo(() => {
    const next = [...chefs];
    if (chefSort === "rating") {
      next.sort((left, right) => right.rating - left.rating || right.reviewCount - left.reviewCount);
      return next;
    }
    if (chefSort === "reviews") {
      next.sort((left, right) => right.reviewCount - left.reviewCount || right.rating - left.rating);
      return next;
    }
    next.sort((left, right) => {
      const leftDate = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightDate = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightDate - leftDate;
    });
    return next;
  }, [chefSort, chefs]);
  const visiblePartnerStores = useMemo(() => {
    return visibleStores.filter((store) => partnerTab === "all" || store.universe === partnerTab);
  }, [partnerTab, visibleStores]);
  const previewRoutes = useMemo(() => {
    if (!analytics?.routes?.length || !selectedOrder) {
      return [];
    }

    const normalizedZone = selectedOrder.zone.trim().toLowerCase();
    const matches = analytics.routes.filter((route) => {
      const from = route.from.toLowerCase();
      const to = route.to.toLowerCase();
      return from.includes(normalizedZone) || to.includes(normalizedZone);
    });

    return (matches.length > 0 ? matches : analytics.routes).slice(0, 4);
  }, [analytics?.routes, selectedOrder]);
  const previewAlerts = useMemo(() => {
    if (!analytics?.alerts?.length || !selectedOrder) {
      return [];
    }

    return analytics.alerts.slice(0, 3);
  }, [analytics?.alerts, selectedOrder]);
  const userCounts = useMemo(() => ({
    all: allUsers.length,
    client: allUsers.filter((user) => user.type === "client").length,
    chef: allUsers.filter((user) => user.type === "chef").length,
    courier: allUsers.filter((user) => user.type === "courier").length,
    merchant: allUsers.filter((user) => user.type === "merchant").length,
    admin: allUsers.filter((user) => user.type === "admin").length,
  }), [allUsers]);

  function resetDashboardView() {
    setFilter("all");
    setZoneFilter("all");
    setOrderTypeFilter("all");
    setTimeScale("day");
  }

  function closeAllPreviews() {
    setSelectedOrderId(null);
    setSelectedUserId(null);
    setSelectedChefKey(null);
    setSelectedCourierId(null);
    setSelectedStoreId(null);
  }

  function openOrderPreview(orderId: string) {
    closeAllPreviews();
    setSelectedOrderId(orderId);
  }

  function openUserPreview(userId: number) {
    closeAllPreviews();
    setSelectedUserId(userId);
  }

  function openChefPreview(chefKey: string) {
    closeAllPreviews();
    setSelectedChefKey(chefKey);
  }

  function openCourierPreview(courierId: number) {
    closeAllPreviews();
    setSelectedCourierId(courierId);
  }

  function openStorePreview(storeId: number) {
    closeAllPreviews();
    setSelectedStoreId(storeId);
  }

  function downloadCsvReport() {
    if (typeof window === "undefined") {
      return;
    }

    const rows = [
      ["id", "client", "cuisiniere", "coursier", "statut", "montant", "date", "zone", "delai_min"],
      ...(analytics?.orders ?? []).map((row) => [row.id, row.client, row.chef, row.courier, row.status, String(row.amount), row.date, row.zone, String(row.etaMinutes)]),
    ];
    const content = rows.map((row) => row.join(";")).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dashboard-${dateValue}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  function exportExcelLike() {
    if (typeof window === "undefined") {
      return;
    }

    const rows = (analytics?.zones ?? []).map((zone) => `${zone.zone}\t${zone.orders}\t${zone.revenue}`);
    const blob = new Blob([["zone\tcommandes\trevenu", ...rows].join("\n")], { type: "application/vnd.ms-excel" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zones-${dateValue}.xls`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="admin-workspace-main admin-workspace-main-single">
      <section id="section-overview" className="glass-panel section-card admin-hero-shell">
          <div className="admin-hero-copy">
            <span className="eyebrow">Nixyah Operations · Cockpit admin</span>
            <h2>Cockpit operations</h2>
            <p>Supervisez les commandes, les cuisinieres et les enseignes en temps reel depuis une lecture claire, dense et actionnable.</p>
            <div className="admin-hero-tags">
              <span className="metric-chip metric-chip-dark">Vue admin</span>
              <span className="metric-chip metric-chip-success">{stores.filter((store) => store.status === "approved").length} commerces valides</span>
              <span className="metric-chip metric-chip-warning">{delayedOrdersCount} alertes prioritaires</span>
            </div>
          </div>
          <div className="admin-hero-kpis">
            <article className="admin-mini-kpi-card">
              <ShoppingBag size={18} />
              <strong>{stores.length}</strong>
              <span>Enseignes</span>
              <small>Commerces valides + en revue</small>
            </article>
            <article className="admin-mini-kpi-card">
              <ChefHat size={18} />
              <strong>{chefs.length}</strong>
              <span>Cuisinieres</span>
              <small>Profils dans le systeme</small>
            </article>
            <article className="admin-mini-kpi-card">
              <BadgeCheck size={18} />
              <strong>{chefs.filter((chef) => chef.isVerified).length}</strong>
              <span>Verifiees</span>
              <small>Badges accordes</small>
            </article>
          </div>
        </section>

        <section className="admin-overview-summary-grid" aria-label="Synthese du cockpit">
          <SummaryCard tone="ink" icon={<ShoppingBag size={18} />} label="Enseignes" value={String(stores.length)} meta="Validees + en revue" />
          <SummaryCard tone="warm" icon={<ChefHat size={18} />} label="Cuisinieres" value={String(chefs.length)} meta="Profils dans le systeme" />
          <SummaryCard tone="teal" icon={<BadgeCheck size={18} />} label="Verifiees" value={String(chefs.filter((chef) => chef.isVerified).length)} meta="Badges accordes" />
          <div className="sidebar-highlight-card saas-active-store-card admin-overview-highlight">
            <span className="eyebrow">Filtre actif</span>
            <strong>{filter === "all" ? "All" : humanizeStatus(filter)}</strong>
            <small>La mise a jour est en temps reel sur l ensemble du cockpit.</small>
          </div>
        </section>

        <section className="glass-panel section-card admin-filter-shell">
          <div className="admin-filter-header">
            <div>
              <span className="eyebrow">Cockpit</span>
              <strong>Filtres & exports</strong>
            </div>
            <div className="admin-filter-meta">
              <span>Filtre actif : {filter === "all" ? "All" : humanizeStatus(filter)}</span>
              <small>La mise a jour est en temps reel</small>
            </div>
          </div>
          <div className="admin-filter-grid">
            <label>
              <span>Statut</span>
              <select value={filter} onChange={(event) => setFilter(event.target.value as StoreStatus | "all")}>
                {["all", "pending_review", "approved", "suspended", "rejected", "draft"].map((value) => (
                  <option key={value} value={value}>{value === "all" ? "All" : humanizeStatus(value)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Zone</span>
              <select value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)}>
                {zones.map((value) => (
                  <option key={value} value={value}>{value === "all" ? "Toutes zones" : value}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Univers</span>
              <select value={orderTypeFilter} onChange={(event) => setOrderTypeFilter(event.target.value as "all" | "courses" | "supermarkets" | "boutiques")}>
                <option value="all">Tous</option>
                <option value="courses">Courses</option>
                <option value="supermarkets">Supermarches</option>
                <option value="boutiques">Boutiques</option>
              </select>
            </label>
            <div className="admin-date-range-field">
              <span>Date</span>
              <div className="admin-date-range-grid">
                <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
                <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
              </div>
            </div>
          </div>
          <div className="admin-filter-footer">
            <div className="admin-filter-actions">
              <button className="ghost-button" type="button" onClick={downloadCsvReport}><FileDown size={16} />CSV</button>
              <button className="ghost-button" type="button" onClick={exportExcelLike}><FileDown size={16} />Excel</button>
              <button className="ghost-button" type="button" onClick={() => typeof window !== "undefined" && window.print()}><FileDown size={16} />PDF</button>
              <button className="ghost-button" type="button" onClick={resetDashboardView}><RefreshCcw size={16} />Clarifier</button>
            </div>
            <div className="admin-timescale-toggle">
              {(["hour", "day", "week"] as const).map((value) => (
                <button key={value} className={timeScale === value ? "chip active" : "chip"} type="button" onClick={() => setTimeScale(value)}>
                  {value === "hour" ? "Heure" : value === "day" ? "Jour" : "Semaine"}
                </button>
              ))}
              {(busy || dashboardBusy) ? <LoaderCircle className="spin" size={18} /> : null}
            </div>
          </div>
        </section>

        {dashboardError ? <div className="notice-banner error-banner">{dashboardError}</div> : null}

        <section id="section-analytics" className="glass-panel section-card analytics-section-shell admin-analytics-shell">
          <div className="section-heading refined-heading">
            <SectionTitle eyebrow="Analytiques" title="Synthese metier & signaux critiques" description={`KPI principaux pour la journee du ${formatDateOnly(rangeEnd)}.`} />
            <div className="analytics-kpi-meta">
              <span>{timeScale === "hour" ? "Granularite horaire" : timeScale === "day" ? "Lecture journaliere" : "Vision hebdomadaire"}</span>
              <strong>{formatDateOnly(rangeStart)} → {formatDateOnly(rangeEnd)}</strong>
            </div>
          </div>
          <div className="admin-kpi-grid admin-kpi-grid-upgraded">
            <article className="admin-kpi-card tone-blue">
              <div className="admin-kpi-card-head"><ShoppingBag size={18} /><span>Commandes totales</span></div>
              <strong>{analytics?.overview.totalOrders ?? 0}</strong>
              <small>vs periode precedente · volume courant</small>
            </article>
            <article className="admin-kpi-card tone-orange">
              <div className="admin-kpi-card-head"><Clock3 size={18} /><span>En cours</span></div>
              <strong>{analytics?.overview.inProgressOrders ?? 0}</strong>
              <small>Commandes a arbitrer</small>
            </article>
            <article className="admin-kpi-card tone-green">
              <div className="admin-kpi-card-head"><BadgeCheck size={18} /><span>Livrees</span></div>
              <strong>{analytics?.overview.deliveredOrders ?? 0}</strong>
              <small>Commandes finalisees</small>
            </article>
            <article className="admin-kpi-card tone-neutral">
              <div className="admin-kpi-card-head"><TriangleAlert size={18} /><span>Annulees</span></div>
              <strong>{analytics?.overview.cancelledOrders ?? 0}</strong>
              <small>Signal faible ou nul</small>
            </article>
            <article className="admin-kpi-card tone-blue">
              <div className="admin-kpi-card-head"><Bike size={18} /><span>Coursiers actifs</span></div>
              <strong>{analytics?.overview.activeCouriers ?? 0}</strong>
              <small>Capacite terrain disponible</small>
            </article>
            <article className="admin-kpi-card tone-warm">
              <div className="admin-kpi-card-head"><ChefHat size={18} /><span>Cuisinieres actives</span></div>
              <strong>{analytics?.overview.activeChefs ?? 0}</strong>
              <small>Profils en ligne</small>
            </article>
            <article className="admin-kpi-card admin-kpi-card-wide tone-green">
              <div className="admin-kpi-card-head"><WalletCards size={18} /><span>CA total</span></div>
              <strong>{euroLikeAmount(analytics?.overview.totalRevenue ?? 0)}</strong>
              <small>Panier moyen {euroLikeAmount(analytics?.overview.averageBasket ?? 0)}</small>
            </article>
          </div>
        </section>

        <section className="glass-panel section-card admin-chart-shell">
          <div className="section-heading refined-heading admin-chart-heading">
            <SectionTitle eyebrow="Visualisation" title="Volume & comparaisons" description="Lecture dashboard SaaS pour comparer la periode courante et la precedente." />
            <div className="admin-chart-toolbar">
              <select value={chartMode} onChange={(event) => setChartMode(event.target.value as "orders" | "revenue")}>
                <option value="orders">Commande</option>
                <option value="revenue">CA</option>
              </select>
              <div className="chart-legend chart-legend-pills">
                <span><i className="legend-dot legend-primary" />Periode courante</span>
                <span><i className="legend-dot legend-secondary" />Periode precedente</span>
              </div>
            </div>
          </div>
          <div className="trend-bars admin-trend-bars" style={{ gridTemplateColumns: `repeat(${Math.max(1, analytics?.chart.labels.length ?? 1)}, minmax(0, 1fr))` }}>
            {currentChartSeries.map((value, index) => {
              const previousValue = previousChartSeries[index] ?? value;
              const currentHeight = `${Math.max(12, (value / maxChartValue) * 100)}%`;
              const previousHeight = `${Math.max(10, (previousValue / maxChartValue) * 100)}%`;
              return (
                <div key={`${value}-${index}`} className="trend-slot">
                  <div className="trend-bars-stack">
                    <span className="trend-bar trend-bar-secondary" style={{ height: previousHeight }} />
                    <span className="trend-bar trend-bar-primary" style={{ height: currentHeight }} />
                  </div>
                  <small>{analytics?.chart.labels[index] ?? `P${index + 1}`}</small>
                </div>
              );
            })}
          </div>
          <div className="chart-insight-strip chart-insight-chips">
            <span className="metric-chip metric-chip-light"><Clock3 size={14} />Pic horaire reel : {analytics?.overview.peakHour ?? "-"}</span>
            <span className="metric-chip metric-chip-light"><CalendarRange size={14} />Heure creuse : {analytics?.overview.quietHour ?? "-"}</span>
            <span className="metric-chip metric-chip-success"><Zap size={14} />{analytics ? `${analytics.overview.conversionRate}% de conversion` : "0% de conversion"}</span>
          </div>
        </section>

        <div className="admin-dual-grid">
          <section className="glass-panel section-card admin-zones-card">
            <div className="section-heading refined-heading">
              <SectionTitle eyebrow="Zones" title="Zones actives" description="Les zones les plus denses remontent avec leur poids relatif." />
              <MapPinned size={18} />
            </div>
            <div className="zone-list zone-list-carded">
              {(analytics?.zones ?? []).map((zone) => (
                <article key={zone.zone} className="zone-card-row">
                  <div>
                    <strong>{zone.zone}</strong>
                    <span>{zone.orders} commandes · {euroLikeAmount(zone.revenue)}</span>
                  </div>
                  <div className="zone-bar-wrap">
                    <span className="zone-bar" style={{ width: `${Math.max(18, (zone.orders / Math.max(1, analytics?.zones[0]?.orders ?? 1)) * 100)}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="glass-panel section-card admin-alerts-card">
            <div className="section-heading refined-heading">
              <SectionTitle eyebrow="Alertes" title="Alertes intelligentes" description="Signaux critiques et stabilite de la plateforme visibles en un bloc." />
              <TriangleAlert size={18} />
            </div>
            <div className="alert-list alert-list-centered">
              {(analytics?.alerts ?? []).map((alert) => (
                <article key={alert.id} className={`alert-card alert-${alert.tone}`}>
                  <div className="alert-card-icon">{alert.tone === "danger" ? <TriangleAlert size={16} /> : alert.tone === "success" ? <BadgeCheck size={16} /> : <Clock3 size={16} />}</div>
                  <div>
                    <strong>{alert.title}</strong>
                    <span>{alert.detail}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section id="section-orders" className="admin-order-shell">
          <section className="glass-panel section-card admin-table-card">
            <div className="section-heading refined-heading">
              <SectionTitle eyebrow="Detail" title="Gestion des commandes" description="17 commandes, priorisees par statut, ETA et retard pour guider l arbitrage ops." />
              <div className="admin-orders-summary">
                <span>{analytics?.overview.totalOrders ?? 0} commandes</span>
                <span>{analytics?.overview.inProgressOrders ?? 0} en attente</span>
                <span>{analytics?.overview.deliveredOrders ?? 0} livrees</span>
                <span>{analytics?.overview.cancelledOrders ?? 0} annulees</span>
              </div>
            </div>
            <div className="admin-order-table admin-order-table-upgraded">
              <div className="admin-order-row admin-order-head">
                <span>Commande</span>
                <span>Client</span>
                <span>Cuisiniere</span>
                <span>Coursier</span>
                <span>Statut</span>
                <span>Montant</span>
                <span>Zone</span>
                <span>ETA</span>
              </div>
              {(analytics?.orders ?? []).map((row) => (
                <button key={row.id} className={selectedOrder?.id === row.id ? "admin-order-row admin-order-data active" : "admin-order-row admin-order-data"} type="button" onClick={() => openOrderPreview(row.id)}>
                  <span className="admin-order-id-cell"><strong>{row.id}</strong><small>{formatDateOnly(row.date)}</small></span>
                  <span>{row.client}</span>
                  <span>{row.chef}</span>
                  <span>{row.courier}</span>
                  <span className={`table-status table-status-${getOrderStatusTone(row.status, row.isDelayed)}`}>{row.status}</span>
                  <span>{euroLikeAmount(row.amount)}</span>
                  <span>{row.zone}</span>
                  <span>{row.etaMinutes} min</span>
                </button>
              ))}
            </div>
          </section>
        </section>

        {selectedOrder ? (
          <div className="admin-preview-overlay" role="presentation" onClick={closeAllPreviews}>
            <section
              className="glass-panel section-card admin-preview-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-preview-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="admin-preview-modal-head">
                <div>
                  <span className="eyebrow">Preview</span>
                  <h3 id="admin-preview-title">Detail operatoire commande</h3>
                  <p>La fenetre concentre la lecture commande, operations et itineraires sans eparpiller l information ailleurs.</p>
                </div>
                <button className="admin-preview-close" type="button" onClick={closeAllPreviews} aria-label="Fermer la preview">
                  <X size={18} />
                </button>
              </div>

              <div className="preview-stack">
                <div className="preview-hero preview-hero-upgraded">
                  <div>
                    <strong>{selectedOrder.id}</strong>
                    <span>{selectedOrder.status} · {selectedOrder.zone}</span>
                  </div>
                  {selectedOrder.isDelayed ? <span className="metric-chip metric-chip-danger">En retard</span> : <span className="metric-chip metric-chip-success">Dans le SLA</span>}
                </div>

                <p className="preview-copy">{selectedOrder.isDelayed ? "Commande a traiter en priorite: ETA depasse le seuil ops. La preview concentre la zone, les arbitrages et les trajectoires logistiques." : "Commande dans la fenetre de service normale avec lecture complete du contexte ops et logistique."}</p>

                <div className="preview-grid preview-grid-upgraded admin-preview-facts-grid">
                  <div><span>Client</span><strong>{selectedOrder.client}</strong></div>
                  <div><span>Cuisiniere</span><strong>{selectedOrder.chef}</strong></div>
                  <div><span>Coursier</span><strong>{selectedOrder.courier}</strong></div>
                  <div><span>Montant</span><strong>{euroLikeAmount(selectedOrder.amount)}</strong></div>
                  <div><span>Zone</span><strong>{selectedOrder.zone}</strong></div>
                  <div><span>ETA</span><strong>{selectedOrder.etaMinutes} min</strong></div>
                  <div><span>Date</span><strong>{formatDate(selectedOrder.date)}</strong></div>
                  <div><span>Statut</span><strong>{selectedOrder.status}</strong></div>
                </div>

                <section className="admin-preview-section">
                  <div className="admin-preview-section-head">
                    <strong>Gestion et operations</strong>
                    <span>Signaux a arbitrer immediatement</span>
                  </div>
                  <div className="admin-preview-ops-grid">
                    <article className="admin-preview-ops-card emphasis">
                      <span>Priorite</span>
                      <strong>{selectedOrder.isDelayed ? "Escalade requise" : "Commande stable"}</strong>
                      <small>{selectedOrder.isDelayed ? `${delayedOrdersCount} commandes sont en retard sur le filtre courant.` : "Aucune alerte critique n est rattachee a cette commande pour le moment."}</small>
                    </article>
                    <article className="admin-preview-ops-card">
                      <span>Zone suivie</span>
                      <strong>{selectedOrder.zone}</strong>
                      <small>{topZone ? `${topZone.orders} commandes · ${euroLikeAmount(topZone.revenue)}` : "Aucune remontee de densite disponible."}</small>
                    </article>
                    <article className="admin-preview-ops-card">
                      <span>Capacite terrain</span>
                      <strong>{analytics?.overview.activeCouriers ?? 0} coursiers actifs</strong>
                      <small>{analytics?.overview.activeChefs ?? 0} cuisinieres actives sur la plage.</small>
                    </article>
                    <article className="admin-preview-ops-card">
                      <span>Partenaire leader</span>
                      <strong>{topPartner?.name ?? "Aucun partenaire"}</strong>
                      <small>{topPartner ? `${topPartner.orders} commandes · ${topPartner.zone}` : "Aucun partenaire dominant sur ce filtre."}</small>
                    </article>
                  </div>
                </section>

                <section className="admin-preview-section">
                  <div className="admin-preview-section-head">
                    <strong>Itineraires</strong>
                    <span>Toutes les informations utiles pour la lecture logistique</span>
                  </div>
                  <div className="admin-preview-route-list">
                    {previewRoutes.length > 0 ? previewRoutes.map((route) => (
                      <article key={route.id} className="admin-preview-route-card">
                        <div>
                          <strong>{route.from} → {route.to}</strong>
                          <small>{route.id}</small>
                        </div>
                        <div className="admin-preview-route-metrics">
                          <span>Estime: {route.estimatedMinutes} min</span>
                          <span>Reel: {route.actualMinutes} min</span>
                          <span>{route.optimizationPercent > 10 ? `Optimisable +${route.optimizationPercent}%` : "Optimise"}</span>
                        </div>
                      </article>
                    )) : <p className="empty-state admin-preview-empty">Aucun itineraire exploitable pour cette commande.</p>}
                  </div>
                </section>

                <section className="admin-preview-section">
                  <div className="admin-preview-section-head">
                    <strong>Alertes liees</strong>
                    <span>Signaux disponibles dans le cockpit</span>
                  </div>
                  <div className="admin-preview-alerts-list">
                    {previewAlerts.length > 0 ? previewAlerts.map((alert) => (
                      <article key={alert.id} className={`alert-card alert-${alert.tone}`}>
                        <div className="alert-card-icon">{alert.tone === "danger" ? <TriangleAlert size={16} /> : alert.tone === "success" ? <BadgeCheck size={16} /> : <Clock3 size={16} />}</div>
                        <div>
                          <strong>{alert.title}</strong>
                          <span>{alert.detail}</span>
                        </div>
                      </article>
                    )) : <p className="empty-state admin-preview-empty">Aucune alerte supplementaire pour cette commande.</p>}
                  </div>
                </section>

                <div className="preview-actions">
                  <button className="primary-button" type="button" onClick={() => setZoneFilter(selectedOrder.zone)}>Isoler zone</button>
                  <button className="secondary-button" type="button" onClick={() => setTimeScale("hour")}>Zoom heure</button>
                  <button className="ghost-button danger" type="button" onClick={closeAllPreviews}>Fermer</button>
                  <button className="ghost-button" type="button" onClick={resetDashboardView}>Clarifier</button>
                </div>
              </div>
            </section>
          </div>
        ) : null}



        {selectedChef || selectedChefSnapshot ? (
          <div className="admin-preview-overlay" role="presentation" onClick={closeAllPreviews}>
            <section
              className="glass-panel section-card admin-preview-modal admin-entity-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-chef-preview-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="admin-preview-modal-head">
                <div>
                  <span className="eyebrow">Profil cuisiniere</span>
                  <h3 id="admin-chef-preview-title">{selectedChef?.name ?? selectedChefSnapshot?.name}</h3>
                  <p>Lecture synthese du profil, de la moderation et de la performance visible depuis le cockpit.</p>
                </div>
                <button className="admin-preview-close" type="button" onClick={closeAllPreviews} aria-label="Fermer le profil cuisiniere">
                  <X size={18} />
                </button>
              </div>
              <div className="preview-stack">
                <div className="admin-detail-hero">
                  <div className="admin-detail-identity">
                    <div className="admin-profile-avatar warm">{getInitials(selectedChef?.name ?? selectedChefSnapshot?.name ?? "C")}</div>
                    <div>
                      <strong>{selectedChef?.name ?? selectedChefSnapshot?.name}</strong>
                      <span>{selectedChef?.specialty ?? "Performance cockpit"}</span>
                    </div>
                  </div>
                  <div className="admin-detail-badges">
                    <span className={selectedChef?.isVerified ? "metric-chip metric-chip-success" : "metric-chip metric-chip-light"}>{selectedChef?.isVerified ? "Badge actif" : "Badge inactif"}</span>
                    <span className={(selectedChef?.isOnline ?? selectedChefSnapshot?.isOnline) ? "metric-chip metric-chip-success" : "metric-chip metric-chip-light"}>{(selectedChef?.isOnline ?? selectedChefSnapshot?.isOnline) ? "En ligne" : "Hors ligne"}</span>
                    <span className="metric-chip metric-chip-warning">Score {selectedChefSnapshot?.score ?? 0}/100</span>
                  </div>
                </div>
                <div className="admin-detail-kpis">
                  <div><span>Commandes gerees</span><strong>{selectedChefSnapshot?.ordersHandled ?? 0}</strong></div>
                  <div><span>Temps moyen</span><strong>{selectedChefSnapshot?.averageMinutes ?? 0} min</strong></div>
                  <div><span>Satisfaction</span><strong>{selectedChefSnapshot?.satisfaction?.toFixed(1) ?? (selectedChef ? selectedChef.rating.toFixed(1) : "-")}</strong></div>
                  <div><span>Avis</span><strong>{selectedChef?.reviewCount ?? 0}</strong></div>
                </div>
                <div className="preview-grid preview-grid-upgraded admin-preview-facts-grid">
                  <div><span>Ville</span><strong>{selectedChef?.location ?? "-"}</strong></div>
                  <div><span>Zone</span><strong>{selectedChef?.zone ?? "-"}</strong></div>
                  <div><span>Email</span><strong>{selectedChef?.email ?? "-"}</strong></div>
                  <div><span>Telephone</span><strong>{selectedChef?.phone ?? "-"}</strong></div>
                  <div><span>Inscription</span><strong>{formatDateOnly(selectedChef?.createdAt)}</strong></div>
                  <div><span>Statut</span><strong>{selectedChef ? humanizeChefStatus(selectedChef.status) : "Visible dans le cockpit"}</strong></div>
                </div>
                {selectedChef?.bio ? <p className="preview-copy">{selectedChef.bio}</p> : null}
                <div className="preview-actions">
                  {selectedChef ? (
                    selectedChef.isVerified ? (
                      <button className="ghost-button danger" type="button" onClick={() => onVerifyChef(selectedChef.id, false)}>Retirer badge</button>
                    ) : (
                      <button className="primary-button" type="button" onClick={() => onVerifyChef(selectedChef.id, true)}>Verifier</button>
                    )
                  ) : null}
                  {selectedChef && selectedChef.status !== "active" ? <button className="secondary-button" type="button" onClick={() => onUpdateChefStatus(selectedChef.id, "active")}>Activer</button> : null}
                  <button className="ghost-button" type="button" onClick={closeAllPreviews}>Fermer</button>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {selectedCourier ? (
          <div className="admin-preview-overlay" role="presentation" onClick={closeAllPreviews}>
            <section
              className="glass-panel section-card admin-preview-modal admin-entity-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-courier-preview-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="admin-preview-modal-head">
                <div>
                  <span className="eyebrow">Profil livreur</span>
                  <h3 id="admin-courier-preview-title">{selectedCourier.name}</h3>
                  <p>Etat temps reel du livreur, zone de couverture et KPI de fiabilite.</p>
                </div>
                <button className="admin-preview-close" type="button" onClick={closeAllPreviews} aria-label="Fermer le profil livreur">
                  <X size={18} />
                </button>
              </div>
              <div className="preview-stack">
                <div className="admin-detail-hero">
                  <div className="admin-detail-identity">
                    <div className="admin-profile-avatar teal">{getInitials(selectedCourier.name)}</div>
                    <div>
                      <strong>{selectedCourier.name}</strong>
                      <span>{selectedCourier.zone}</span>
                    </div>
                  </div>
                  <div className="admin-detail-badges">
                    <span className="metric-chip metric-chip-success">{selectedCourier.status}</span>
                    <span className="metric-chip metric-chip-warning">Fiabilite {selectedCourier.reliability}%</span>
                  </div>
                </div>
                <div className="admin-detail-kpis">
                  <div><span>Temps moyen</span><strong>{selectedCourier.averageMinutes} min</strong></div>
                  <div><span>Note</span><strong>{selectedCourier.rating.toFixed(1)}</strong></div>
                  <div><span>Fiabilite</span><strong>{selectedCourier.reliability}%</strong></div>
                  <div><span>Zone</span><strong>{selectedCourier.zone}</strong></div>
                </div>
                <div className="preview-actions">
                  <button className="ghost-button" type="button" onClick={() => setZoneFilter(selectedCourier.zone)}>Isoler la zone</button>
                  <button className="ghost-button" type="button" onClick={closeAllPreviews}>Fermer</button>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {selectedStore ? (
          <div className="admin-preview-overlay" role="presentation" onClick={closeAllPreviews}>
            <section
              className="glass-panel section-card admin-preview-modal admin-entity-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-store-preview-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="admin-preview-modal-head">
                <div>
                  <span className="eyebrow">Institution partenaire</span>
                  <h3 id="admin-store-preview-title">{selectedStore.name}</h3>
                  <p>Fenetre institutionnelle pour lire le statut, la zone et les actions de moderation disponibles.</p>
                </div>
                <button className="admin-preview-close" type="button" onClick={closeAllPreviews} aria-label="Fermer l institution partenaire">
                  <X size={18} />
                </button>
              </div>
              <div className="preview-stack">
                <div className="admin-detail-hero">
                  <div className="admin-detail-identity">
                    <div className="admin-profile-avatar ink">{getInitials(selectedStore.name)}</div>
                    <div>
                      <strong>{selectedStore.name}</strong>
                      <span>{selectedStore.universe}</span>
                    </div>
                  </div>
                  <div className="admin-detail-badges">
                    <span className={selectedStore.isActive ? "metric-chip metric-chip-success" : "metric-chip metric-chip-light"}>{selectedStore.isActive ? "Active" : "Inactive"}</span>
                    <span className="metric-chip metric-chip-warning">{selectedStore.status}</span>
                  </div>
                </div>
                <div className="preview-grid preview-grid-upgraded admin-preview-facts-grid">
                  <div><span>Ville</span><strong>{selectedStore.location}</strong></div>
                  <div><span>Zone</span><strong>{selectedStore.zone || "-"}</strong></div>
                  <div><span>Marchand</span><strong>{selectedStore.merchantUser?.name ?? "-"}</strong></div>
                  <div><span>Telephone</span><strong>{selectedStore.merchantProfile?.contactPhone ?? selectedStore.merchantUser?.phone ?? "-"}</strong></div>
                  <div><span>Email</span><strong>{selectedStore.merchantProfile?.contactEmail ?? selectedStore.merchantUser?.email ?? "-"}</strong></div>
                  <div><span>Inscription</span><strong>{formatDateOnly(selectedStore.createdAt)}</strong></div>
                </div>
                {selectedStore.description ? <p className="preview-copy">{selectedStore.description}</p> : null}
                <div className="preview-actions">
                  {selectedStore.status !== "approved" ? <button className="primary-button" type="button" onClick={() => onUpdateStatus(selectedStore.id, "approved", true)}>Approuver</button> : null}
                  {selectedStore.status !== "pending_review" ? <button className="secondary-button" type="button" onClick={() => onUpdateStatus(selectedStore.id, "pending_review", false)}>Remettre en revue</button> : null}
                  <button className="ghost-button danger" type="button" onClick={() => onUpdateStatus(selectedStore.id, "suspended", false)}>Bloquer</button>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {selectedUser ? (
          <div className="admin-preview-overlay" role="presentation" onClick={closeAllPreviews}>
            <section
              className="glass-panel section-card admin-preview-modal admin-entity-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-user-preview-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="admin-preview-modal-head">
                <div>
                  <span className="eyebrow">Profil utilisateur</span>
                  <h3 id="admin-user-preview-title">{selectedUser.name}</h3>
                  <p>Lecture support du compte avec role, coordonnees et contexte d inscription.</p>
                </div>
                <button className="admin-preview-close" type="button" onClick={closeAllPreviews} aria-label="Fermer le profil utilisateur">
                  <X size={18} />
                </button>
              </div>
              <div className="preview-stack">
                <div className="admin-detail-hero">
                  <div className="admin-detail-identity">
                    <div className={"user-card-avatar user-card-avatar-" + selectedUser.type}>{getInitials(selectedUser.name)}</div>
                    <div>
                      <strong>{selectedUser.name}</strong>
                      <span>{getUserRoleLabel(selectedUser.type)}</span>
                    </div>
                  </div>
                  <div className="admin-detail-badges">
                    <span className={"user-role-tag user-role-" + getUserRoleTone(selectedUser.type)}>{getUserRoleLabel(selectedUser.type)}</span>
                  </div>
                </div>
                <div className="preview-grid preview-grid-upgraded admin-preview-facts-grid">
                  <div><span>Email</span><strong>{selectedUser.email || "-"}</strong></div>
                  <div><span>Telephone</span><strong>{selectedUser.phone || "-"}</strong></div>
                  <div><span>Localisation</span><strong>{selectedUser.location || "-"}</strong></div>
                  <div><span>Inscription</span><strong>{formatDateOnly(selectedUser.createdAt)}</strong></div>
                  <div><span>Compte</span><strong>{selectedUser.id}</strong></div>
                  <div><span>Type</span><strong>{selectedUser.type}</strong></div>
                </div>
                <div className="preview-actions">
                  <button className="ghost-button" type="button" onClick={closeAllPreviews}>Fermer</button>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        <section id="section-couriers" className="glass-panel section-card admin-operations-shell">
          <div className="section-heading refined-heading">
            <SectionTitle eyebrow="Operations" title="Performance terrain & partenaires" description="Priorite immediate, zones sous pression et capacite terrain regroupes dans un meme bloc." />
            <Bike size={18} />
          </div>
          <div className="operations-snapshot-grid admin-ops-snapshot-grid">
            <article className="operations-snapshot-card ops-priority">
              <span>Priorite immediate</span>
              <strong>{delayedOrdersCount} commandes a surveiller</strong>
              <small>{selectedOrder ? `${selectedOrder.id} · ${selectedOrder.status} · ${selectedOrder.zone}` : "Aucune commande critique sur le filtre courant."}</small>
            </article>
            <article className="operations-snapshot-card">
              <span>Zone sous pression</span>
              <strong>{topZone?.zone ?? "Aucune"}</strong>
              <small>{topZone ? `${topZone.orders} commandes · ${euroLikeAmount(topZone.revenue)}` : "Les zones s affichent une fois les donnees chargees."}</small>
            </article>
            <article className="operations-snapshot-card">
              <span>Capacite terrain</span>
              <strong>{analytics?.overview.activeCouriers ?? 0} coursiers actifs</strong>
              <small>{analytics?.overview.activeChefs ?? 0} cuisinieres en ligne</small>
            </article>
            <article className="operations-snapshot-card">
              <span>Partenaire en tete</span>
              <strong>{topPartner?.name ?? "Fresh Abi"}</strong>
              <small>{topPartner ? `${topPartner.orders} commandes · ${topPartner.zone}` : "Marcory, Zone 4"}</small>
            </article>
          </div>

          <div className="admin-profile-columns">
            <section className="glass-panel section-card admin-profile-section">
              <div className="section-heading refined-heading">
                <SectionTitle eyebrow="Cuisinieres" title="Top performance cuisinieres" description="Cards profils coherentes, score et reputation visibles en un coup d oeil." />
                <ChefHat size={18} />
              </div>
              <div className="admin-profile-grid">
                {(analytics?.chefs ?? []).map((chef) => (
                  <article key={chef.id} className="admin-profile-card">
                    <div className="admin-profile-card-head">
                      <div className="admin-profile-avatar warm">{getInitials(chef.name)}</div>
                      <div>
                        <strong>{chef.name}</strong>
                        <span className={chef.isOnline ? "metric-chip metric-chip-success" : "metric-chip metric-chip-light"}>{chef.isOnline ? "Active" : "Hors ligne"}</span>
                      </div>
                    </div>
                    <div className="admin-profile-metrics">{chef.ordersHandled} commandes · {chef.averageMinutes} min moyen · Score {chef.score}/100 · {chef.satisfaction.toFixed(1)}</div>
                    <small>{chef.isOnline ? "Service disponible" : "Disponibilite a confirmer"}</small>
                    <div className="admin-score-bar"><span style={{ width: `${Math.min(100, chef.score)}%` }} /></div>
                    <div className="admin-inline-actions">
                      <button className="ghost-button" type="button" onClick={() => openChefPreview(chef.name)}>Voir profil</button>
                      <button className="secondary-button" type="button">Moderer</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="glass-panel section-card admin-profile-section">
              <div className="section-heading refined-heading">
                <SectionTitle eyebrow="Coursiers" title="Temps reel" description="Lecture croisee de statut, fiabilite et vitesse de livraison." />
                <Bike size={18} />
              </div>
              <div className="admin-profile-grid courier-profile-grid">
                {(analytics?.couriers ?? []).map((courier) => (
                  <article key={courier.id} className="admin-profile-card compact">
                    <div className="admin-profile-card-head">
                      <div className="admin-profile-avatar teal">{getInitials(courier.name)}</div>
                      <div>
                        <strong>{courier.name}</strong>
                        <span className="metric-chip metric-chip-success">{courier.status}</span>
                      </div>
                    </div>
                    <div className="admin-profile-metrics">{courier.averageMinutes} min moyen · Fiabilite {courier.reliability}% · Note {courier.rating.toFixed(1)}</div>
                    <small>{courier.zone}</small>
                    <div className="admin-inline-actions">
                      <button className="ghost-button" type="button" onClick={() => openCourierPreview(courier.id)}>Voir profil livreur</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <section className="glass-panel section-card admin-routes-shell">
            <div className="section-heading refined-heading">
              <SectionTitle eyebrow="Itineraires" title="Itineraires & temps de livraison" description="Suivi du delta reel, potentiel d optimisation et statut logistique." />
              <Route size={18} />
            </div>
            <div className="route-list-grid">
              {(analytics?.routes ?? []).map((route) => (
                <article key={route.id} className="route-card-row">
                  <div>
                    <strong>{route.from} → {route.to}</strong>
                    <span>{route.estimatedMinutes} min estime · {route.actualMinutes} min reel</span>
                  </div>
                  <span className={route.optimizationPercent > 10 ? "metric-chip metric-chip-warning" : "metric-chip metric-chip-success"}>
                    {route.optimizationPercent > 10 ? `+${route.optimizationPercent}%` : "OK"}
                  </span>
                  <span className={route.optimizationPercent > 10 ? "metric-chip metric-chip-light" : "metric-chip metric-chip-success"}>
                    {route.optimizationPercent > 10 ? "Optimisable" : "Optimise"}
                  </span>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="glass-panel section-card admin-partners-shell">
          <div className="section-heading refined-heading">
            <SectionTitle eyebrow="Enseignes" title="Enseignes partenaires" description="Vue harmonisee de supermarches, boutiques et courses sous forme de cards." />
            <Store size={18} />
          </div>
          <div className="users-type-tabs partners-tabs-row">
            {(["all", "supermarkets", "boutiques", "courses"] as const).map((value) => {
              const count = stores.filter((store) => value === "all" || store.universe === value).length;
              const label = value === "all" ? "Tous" : value === "supermarkets" ? "Supermarches" : value === "boutiques" ? "Boutiques" : "Courses";
              return (
                <button key={value} type="button" className={partnerTab === value ? "chip active" : "chip"} onClick={() => setPartnerTab(value)}>
                  {label}
                  <span className="users-count">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="partner-cards-grid">
            {visiblePartnerStores.length === 0 ? <p className="empty-state">Aucune enseigne visible pour cet onglet.</p> : null}
            {visiblePartnerStores.map((store) => (
              <article key={store.id} className="partner-card">
                <div className="partner-card-head">
                  <div>
                    <strong>{store.name}</strong>
                    <span>{store.universe}</span>
                  </div>
                  <span className={store.isActive ? "metric-chip metric-chip-success" : "metric-chip metric-chip-light"}>{store.isActive ? "Boutique active" : "Boutique inactive"}</span>
                </div>
                <p>{store.location} · {store.zone || "Zone non renseignee"}</p>
                <small>0 commandes · 0 F CFA sur la periode filtree</small>
                <div className="admin-inline-actions">
                  <button className="ghost-button" type="button" onClick={() => openStorePreview(store.id)}>Voir institution</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="section-users" className="glass-panel section-card users-section admin-users-shell">
          <div className="section-heading refined-heading">
            <SectionTitle eyebrow="Support" title="Tous les utilisateurs inscrits" description="Vue dense, multi-role et exploitable pour assistance, moderation et suivi." />
            <Users size={18} />
          </div>
          <div className="admin-user-summary-chips">
            <span className="metric-chip metric-chip-light">Tous {userCounts.all}</span>
            <span className="metric-chip metric-chip-light">Clients {userCounts.client}</span>
            <span className="metric-chip metric-chip-light">Cuisinieres {userCounts.chef}</span>
            <span className="metric-chip metric-chip-light">Livreurs {userCounts.courier}</span>
            <span className="metric-chip metric-chip-light">Marchands {userCounts.merchant}</span>
            <span className="metric-chip metric-chip-light">Admins {userCounts.admin}</span>
          </div>
          <div className="users-type-tabs">
            {(["all", "client", "chef", "courier", "merchant", "admin"] as const).map((value) => (
              <button key={value} type="button" className={usersTypeFilter === value ? "chip active" : "chip"} onClick={() => setUsersTypeFilter(value)}>
                {value === "all" ? "Tous" : getUserRoleLabel(value)}
                <span className="users-count">{userCounts[value]}</span>
              </button>
            ))}
          </div>
          <div className="admin-users-table">
            <div className="admin-users-row admin-users-head">
              <span>Nom</span>
              <span>Role</span>
              <span>Email</span>
              <span>Telephone</span>
              <span>Ville / zone</span>
              <span>Date d inscription</span>
              <span>Actions</span>
            </div>
            {filteredUsers.map((user) => (
              <div key={user.id} className="admin-users-row admin-users-data">
                <span className="admin-user-name-cell">
                  <span className={`user-card-avatar user-card-avatar-${user.type}`}>{getInitials(user.name)}</span>
                  <strong>{user.name}</strong>
                </span>
                <span><span className={`user-role-tag user-role-${getUserRoleTone(user.type)}`}>{getUserRoleLabel(user.type)}</span></span>
                <span>{user.email || "-"}</span>
                <span>{user.phone || "-"}</span>
                <span>{user.location || "-"}</span>
                <span>{formatDateOnly(user.createdAt)}</span>
                <span className="admin-users-actions">
                  <button className="ghost-button" type="button" onClick={() => openUserPreview(user.id)}>Voir</button>
                  <button className="ghost-button" type="button">Verrou</button>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section id="section-chefs" className="glass-panel section-card moderation-section-upgrade chefs-section admin-chefs-shell">
          <div className="section-heading refined-heading">
            <SectionTitle eyebrow="Cuisinieres" title="Gestion des profils" description="Coeur de la moderation, organise par KPI, tabs et cartes decisionnelles." />
            <ChefHat size={18} />
          </div>
          <div className="moderation-overview-grid">
            <article className="moderation-overview-card moderation-overview-pending"><span>En verification</span><strong>{chefStatusCounts.pending_verification ?? 0}</strong><small>Demandent une validation manuelle.</small></article>
            <article className="moderation-overview-card moderation-overview-active"><span>Actives</span><strong>{chefStatusCounts.active ?? 0}</strong><small>Profils autorises sur la plateforme.</small></article>
            <article className="moderation-overview-card moderation-overview-risk"><span>Suspendues / rejetees</span><strong>{(chefStatusCounts.suspended ?? 0) + (chefStatusCounts.rejected ?? 0)}</strong><small>Actions restrictives en cours.</small></article>
          </div>
          <div className="admin-chef-toolbar">
            <div className="users-type-tabs">
              {(["all", "pending_verification", "active", "suspended", "rejected"] as const).map((value) => (
                <button key={value} className={chefsFilter === value ? "chip active" : "chip"} type="button" onClick={() => setChefsFilter(value)}>
                  {value === "all" ? "Toutes" : humanizeChefStatus(value as ChefStatus)}
                </button>
              ))}
            </div>
            <label className="admin-sort-field">
              <span>Trier par</span>
              <select value={chefSort} onChange={(event) => setChefSort(event.target.value as "createdAt" | "rating" | "reviews")}>
                <option value="createdAt">Date d inscription</option>
                <option value="rating">Note</option>
                <option value="reviews">Nombre d avis</option>
              </select>
            </label>
          </div>
          <section className="stores-grid moderation-grid-upgrade admin-chef-moderation-grid">
            {sortedChefs.length === 0 ? <div className="glass-panel section-card empty-state">Aucune cuisiniere pour ce filtre.</div> : null}
            {sortedChefs.map((chef) => (
              <article className="glass-panel section-card moderation-card chef-moderation-card" key={chef.id}>
                <div className="moderation-header">
                  <div className="chef-card-identity">
                    {chef.avatarUrl ? <img src={chef.avatarUrl} alt={chef.name} className="chef-avatar-thumb" /> : <div className="chef-avatar-fallback" style={{ backgroundColor: chef.coverColor ?? "#F2DFC6" }}>{getInitials(chef.name)}</div>}
                    <div>
                      <span className={`status-pill status-${getChefStatusTone(chef.status)}`}>{humanizeChefStatus(chef.status)}</span>
                      <h3>{chef.name}</h3>
                    </div>
                  </div>
                  {chef.isOnline ? <span className="chef-online-dot" title="En ligne" /> : null}
                </div>
                <p className="chef-specialty">{chef.specialty}</p>
                {chef.bio ? <p className="chef-bio">{chef.bio}</p> : null}
                <div className="moderation-meta">
                  <span>{chef.location}</span>
                  {chef.zone ? <span>{chef.zone}</span> : null}
                  <span className="chef-rating-badge"><Star size={11} />{chef.rating.toFixed(1)} · {chef.reviewCount} avis</span>
                </div>
                <div className="moderation-signal-strip">
                  <span>{chef.isVerified ? "Badge actif" : "Badge absent"}</span>
                  <span>{chef.isOnline ? "En ligne" : "Hors ligne"}</span>
                  <span>Inscrite le {formatDateOnly(chef.createdAt)}</span>
                </div>
                <div className="moderation-owner">
                  {chef.email ? <span>{chef.email}</span> : null}
                  {chef.phone ? <span>{chef.phone}</span> : null}
                </div>
                <div className="action-row chef-action-row">
                  {chef.isVerified ? <button className="ghost-button danger" type="button" onClick={() => onVerifyChef(chef.id, false)}><UserX size={14} />Retirer badge</button> : <button className="primary-button" type="button" onClick={() => onVerifyChef(chef.id, true)}><UserCheck size={14} />Verifier</button>}
                  {chef.status !== "active" && <button className="secondary-button" type="button" onClick={() => onUpdateChefStatus(chef.id, "active")}>Activer</button>}
                  {chef.status !== "suspended" && <button className="ghost-button" type="button" onClick={() => onUpdateChefStatus(chef.id, "suspended")}>Suspendre</button>}
                  {chef.status !== "rejected" && <button className="ghost-button danger" type="button" onClick={() => onUpdateChefStatus(chef.id, "rejected")}>Rejeter</button>}
                </div>
              </article>
            ))}
          </section>
        </section>

        <section id="section-stores" className="glass-panel section-card moderation-section-upgrade admin-stores-shell">
          <div className="section-heading refined-heading">
            <SectionTitle eyebrow="Actions" title="Moderation et decisions" description="Validation, remise en revue et blocage des enseignes avec un pattern de cartes uniforme." />
            <Store size={18} />
          </div>
          <div className="moderation-overview-grid moderation-overview-grid-stores">
            <article className="moderation-overview-card moderation-overview-pending"><span>En revue</span><strong>{counts.pending_review ?? 0}</strong><small>Demandes a arbitrer.</small></article>
            <article className="moderation-overview-card moderation-overview-active"><span>Approuvees</span><strong>{counts.approved ?? 0}</strong><small>Enseignes visibles.</small></article>
            <article className="moderation-overview-card moderation-overview-risk"><span>Bloquees</span><strong>{(counts.suspended ?? 0) + (counts.rejected ?? 0)}</strong><small>Suspensions et rejets.</small></article>
          </div>
          <div className="moderation-action-rail">
            <div className="moderation-action-card moderation-action-card-priority">
              <span>File prioritaire</span>
              <strong>{visibleStores.filter((store) => store.status === "pending_review").length} dossier a traiter</strong>
              <small>Commencez par les enseignes en attente pour fluidifier l activation marchande.</small>
            </div>
            <div className="moderation-action-card">
              <span>Zone dominante</span>
              <strong>{visibleStores[0]?.zone || visibleStores[0]?.location || "Zone 4, Marcory"}</strong>
              <small>{visibleStores.length} enseignes visibles sur le filtre courant.</small>
            </div>
          </div>
          <section className="stores-grid moderation-grid-upgrade">
            {visibleStores.length === 0 ? <div className="glass-panel section-card empty-state">Aucune enseigne pour ce filtre.</div> : null}
            {visibleStores.map((store) => (
              <article className="glass-panel section-card moderation-card store-moderation-card" key={store.id}>
                <div className="moderation-header">
                  <div>
                    <span className={`status-pill status-${store.status}`}>{humanizeStatus(store.status)}</span>
                    <h3>{store.name}</h3>
                  </div>
                  <ShoppingBag size={18} />
                </div>
                <p>{store.description || store.tagline || "Aucune description renseignee."}</p>
                <div className="moderation-meta">
                  <span>{store.universe}</span>
                  <span>{store.location}</span>
                  <span>{store.zone || "Zone non renseignee"}</span>
                </div>
                <div className="moderation-signal-strip">
                  <span>{store.isActive ? "Boutique active" : "Boutique inactive"}</span>
                  <span>Temps moyen livraison {store.etaMinMinutes}-{store.etaMaxMinutes} min</span>
                  <span>{store.visualKey || "Sans visual key"}</span>
                </div>
                <div className="moderation-owner">
                  <strong>{store.merchantProfile?.businessName || "Sans marchand"}</strong>
                  <span>{store.merchantUser?.name || "Utilisateur inconnu"}</span>
                  <span>{store.merchantUser?.email || store.merchantProfile?.contactEmail || "Sans email"}</span>
                </div>
                <div className="action-row moderation-action-row">
                  <button className="primary-button" type="button" onClick={() => onUpdateStatus(store.id, "approved", true)}>Approuver</button>
                  <button className="secondary-button" type="button" onClick={() => onUpdateStatus(store.id, "pending_review", false)}>Remettre en revue</button>
                  <button className="ghost-button" type="button" onClick={() => onUpdateStatus(store.id, "suspended", false)}>Suspendre</button>
                  <button className="ghost-button danger" type="button" onClick={() => onUpdateStatus(store.id, "rejected", false)}>Rejeter</button>
                </div>
              </article>
            ))}
          </section>
        </section>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [stores, setStores] = useState<MerchantStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [adminStores, setAdminStores] = useState<AdminStore[]>([]);
  const [adminFilter, setAdminFilter] = useState<StoreStatus | "all">("all");
  const [adminChefs, setAdminChefs] = useState<AdminChef[]>([]);
  const [adminChefsFilter, setAdminChefsFilter] = useState<ChefStatus | "all">("all");
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [registerForm, setRegisterForm] = useState<MerchantRegistrationInput>(DEFAULT_REGISTER_FORM);
  const [storeForm, setStoreForm] = useState<MerchantStoreInput>(DEFAULT_STORE_FORM);
  const [productForm, setProductForm] = useState<MerchantProductInput>(DEFAULT_PRODUCT_FORM);
  const [notice, setNotice] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loginBusy, setLoginBusy] = useState(false);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [busy, startBusyTransition] = useTransition();

  const selectedStore = stores.find((store) => store.id === selectedStoreId) ?? null;

  async function hydrateMerchantStore(token: string, storeId: number) {
    const [productsResponse, ordersResponse] = await Promise.all([
      apiClient.getMerchantProducts(token, storeId),
      apiClient.getMerchantOrders(token, storeId),
    ]);
    setProducts(productsResponse.products);
    setOrders(ordersResponse.orders);
  }

  async function loadMerchantWorkspace(token: string, preferredStoreId?: number) {
    const [profileResponse, storesResponse] = await Promise.all([
      apiClient.getMerchantProfile(token),
      apiClient.getMerchantStores(token),
    ]);
    setProfile(profileResponse.merchantProfile);
    setStores(storesResponse.stores);

    const nextSelectedStore = storesResponse.stores.find((store) => store.id === preferredStoreId) ?? storesResponse.stores[0] ?? null;
    setSelectedStoreId(nextSelectedStore?.id ?? null);

    if (nextSelectedStore) {
      setStoreForm({
        universe: nextSelectedStore.universe,
        name: nextSelectedStore.name,
        tagline: nextSelectedStore.tagline,
        description: nextSelectedStore.description,
        location: nextSelectedStore.location,
        zone: nextSelectedStore.zone,
        accentColor: nextSelectedStore.accentColor,
        visualKey: nextSelectedStore.visualKey,
        logoUrl: nextSelectedStore.logoUrl ?? "",
        bannerUrl: nextSelectedStore.bannerUrl ?? "",
        etaMinMinutes: nextSelectedStore.etaMinMinutes,
        etaMaxMinutes: nextSelectedStore.etaMaxMinutes,
      });
      await hydrateMerchantStore(token, nextSelectedStore.id);
      return;
    }

    setProducts([]);
    setOrders([]);
    setStoreForm(DEFAULT_STORE_FORM);
  }

  async function loadAdminWorkspace(token: string, filter: StoreStatus | "all") {
    const [storesResp, chefsResp, usersResp] = await Promise.allSettled([
      apiClient.getAdminStores(token, filter),
      apiClient.getAdminChefs(token, { status: adminChefsFilter }),
      apiClient.getAdminUsers(token),
    ]);
    if (storesResp.status === "fulfilled") setAdminStores(storesResp.value.stores);
    if (chefsResp.status === "fulfilled") setAdminChefs(chefsResp.value.chefs);
    if (usersResp.status === "fulfilled") setAdminUsers(usersResp.value.users);
  }

  function commitSession(nextSession: SessionState | null) {
    persistSession(nextSession);
    setSession(nextSession);
  }

  function resetWorkspace() {
    setProfile(null);
    setStores([]);
    setSelectedStoreId(null);
    setProducts([]);
    setOrders([]);
    setAdminStores([]);
    setAdminChefs([]);
    setAdminUsers([]);
    setStoreForm(DEFAULT_STORE_FORM);
    setProductForm(DEFAULT_PRODUCT_FORM);
  }

  async function bootstrap() {
    const storedSession = loadStoredSession();
    if (!storedSession) {
      setInitializing(false);
      return;
    }

    try {
      const currentUser = await apiClient.getCurrentUser(storedSession.token);
      const nextSession = { token: storedSession.token, user: currentUser };
      commitSession(nextSession);
      if (currentUser.type === "merchant") {
        await loadMerchantWorkspace(storedSession.token);
      }
      if (currentUser.type === "admin") {
        await loadAdminWorkspace(storedSession.token, adminFilter);
      }
    } catch (error) {
      commitSession(null);
      resetWorkspace();
      setFatalError(error instanceof Error ? error.message : "Impossible de restaurer la session.");
    } finally {
      setInitializing(false);
    }
  }

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!session || session.user.type !== "admin") {
      return;
    }
    startBusyTransition(() => {
      void loadAdminWorkspace(session.token, adminFilter).catch((error) => {
        setFatalError(error instanceof Error ? error.message : "Impossible de charger les enseignes admin.");
      });
    });
  }, [adminFilter, session]);

  useEffect(() => {
    if (!session || session.user.type !== "admin") return;
    startBusyTransition(() => {
      void apiClient
        .getAdminChefs(session.token, { status: adminChefsFilter })
        .then((resp) => setAdminChefs(resp.chefs))
        .catch(() => {/* silently ignore chef filter errors */});
    });
  }, [adminChefsFilter, session]);

  async function handleLogin() {
    setFatalError(null);
    setNotice(null);
    setLoginBusy(true);
    try {
      const response = await apiClient.login(loginIdentifier, password);
      const nextSession = { token: response.token, user: response.user };
      commitSession(nextSession);
      resetWorkspace();
      if (response.user.type === "merchant") {
        await loadMerchantWorkspace(response.token);
        setNotice("Session marchand active.");
      } else if (response.user.type === "admin") {
        await loadAdminWorkspace(response.token, adminFilter);
        setNotice("Session admin active.");
      } else {
        setNotice("Connexion reussie, mais ce backoffice gere uniquement les roles merchant et admin.");
      }
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : "Connexion impossible.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleRegisterMerchant() {
    setFatalError(null);
    setNotice(null);
    setRegisterBusy(true);
    try {
      const response = await apiClient.registerMerchant(registerForm);
      if (response.token) {
        const nextSession = { token: response.token, user: response.user };
        commitSession(nextSession);
        resetWorkspace();
        await loadMerchantWorkspace(response.token);
      }
      setRegisterForm(DEFAULT_REGISTER_FORM);
      setAuthMode("login");
      setNotice(response.message || "Compte marchand cree.");
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : "Inscription impossible.");
    } finally {
      setRegisterBusy(false);
    }
  }

  async function handleSelectMerchantStore(store: MerchantStore) {
    if (!session) {
      return;
    }
    setSelectedStoreId(store.id);
    setStoreForm({
      universe: store.universe,
      name: store.name,
      tagline: store.tagline,
      description: store.description,
      location: store.location,
      zone: store.zone,
      accentColor: store.accentColor,
      visualKey: store.visualKey,
      logoUrl: store.logoUrl ?? "",
      bannerUrl: store.bannerUrl ?? "",
      etaMinMinutes: store.etaMinMinutes,
      etaMaxMinutes: store.etaMaxMinutes,
    });
    setFatalError(null);
    startBusyTransition(() => {
      void hydrateMerchantStore(session.token, store.id).catch((error) => {
        setFatalError(error instanceof Error ? error.message : "Chargement de la boutique impossible.");
      });
    });
  }

  async function handleCreateStore() {
    if (!session || session.user.type !== "merchant") {
      return;
    }
    setFatalError(null);
    startBusyTransition(() => {
      void (async () => {
        try {
          const response = await apiClient.createMerchantStore(session.token, {
            ...storeForm,
            visualKey: emptyToUndefined(storeForm.visualKey) ?? "",
            logoUrl: emptyToUndefined(storeForm.logoUrl) ?? "",
            bannerUrl: emptyToUndefined(storeForm.bannerUrl) ?? "",
          });
          await loadMerchantWorkspace(session.token, response.store.id);
          setNotice("Enseigne envoyee pour revue.");
        } catch (error) {
          setFatalError(error instanceof Error ? error.message : "Creation d enseigne impossible.");
        }
      })();
    });
  }

  async function handleUpdateStore() {
    if (!session || session.user.type !== "merchant" || !selectedStore) {
      return;
    }
    setFatalError(null);
    startBusyTransition(() => {
      void (async () => {
        try {
          await apiClient.updateMerchantStore(session.token, selectedStore.id, {
            ...storeForm,
            logoUrl: emptyToUndefined(storeForm.logoUrl),
            bannerUrl: emptyToUndefined(storeForm.bannerUrl),
            visualKey: emptyToUndefined(storeForm.visualKey),
          });
          await loadMerchantWorkspace(session.token, selectedStore.id);
          setNotice("Enseigne mise a jour.");
        } catch (error) {
          setFatalError(error instanceof Error ? error.message : "Mise a jour enseigne impossible.");
        }
      })();
    });
  }

  async function handleCreateProduct() {
    if (!session || session.user.type !== "merchant" || !selectedStore) {
      return;
    }
    setFatalError(null);
    startBusyTransition(() => {
      void (async () => {
        try {
          await apiClient.createMerchantProduct(session.token, selectedStore.id, {
            ...productForm,
            badge: productForm.badge.trim(),
            visualKey: productForm.visualKey.trim(),
          });
          setProductForm(DEFAULT_PRODUCT_FORM);
          await hydrateMerchantStore(session.token, selectedStore.id);
          setNotice("Produit ajoute au catalogue.");
        } catch (error) {
          setFatalError(error instanceof Error ? error.message : "Creation produit impossible.");
        }
      })();
    });
  }

  async function handleUpdateProduct(productId: number, patch: Partial<MerchantProductInput>) {
    if (!session || session.user.type !== "merchant" || !selectedStore) {
      return;
    }
    setFatalError(null);
    startBusyTransition(() => {
      void (async () => {
        try {
          await apiClient.updateMerchantProduct(session.token, productId, patch);
          await hydrateMerchantStore(session.token, selectedStore.id);
          setNotice("Produit mis a jour.");
        } catch (error) {
          setFatalError(error instanceof Error ? error.message : "Mise a jour produit impossible.");
        }
      })();
    });
  }

  async function handleUpdateAdminStatus(storeId: number, status: StoreStatus, isActive?: boolean) {
    if (!session || session.user.type !== "admin") {
      return;
    }
    setFatalError(null);
    startBusyTransition(() => {
      void (async () => {
        try {
          await apiClient.updateAdminStoreStatus(session.token, storeId, status, isActive);
          await loadAdminWorkspace(session.token, adminFilter);
          setNotice("Statut commerce mis a jour.");
        } catch (error) {
          setFatalError(error instanceof Error ? error.message : "Mise a jour admin impossible.");
        }
      })();
    });
  }

  async function handleUpdateChefStatus(chefId: string, status: ChefStatus) {
    if (!session || session.user.type !== "admin") return;
    setFatalError(null);
    startBusyTransition(() => {
      void (async () => {
        try {
          await apiClient.updateAdminChefStatus(session.token, chefId, status);
          const resp = await apiClient.getAdminChefs(session.token, { status: adminChefsFilter });
          setAdminChefs(resp.chefs);
          setNotice("Statut cuisiniere mis a jour.");
        } catch (error) {
          setFatalError(error instanceof Error ? error.message : "Mise a jour cuisiniere impossible.");
        }
      })();
    });
  }

  async function handleVerifyChef(chefId: string, isVerified: boolean) {
    if (!session || session.user.type !== "admin") return;
    setFatalError(null);
    startBusyTransition(() => {
      void (async () => {
        try {
          await apiClient.verifyAdminChef(session.token, chefId, isVerified);
          const resp = await apiClient.getAdminChefs(session.token, { status: adminChefsFilter });
          setAdminChefs(resp.chefs);
          setNotice(isVerified ? "Cuisiniere verifiee." : "Badge verification retire.");
        } catch (error) {
          setFatalError(error instanceof Error ? error.message : "Verification impossible.");
        }
      })();
    });
  }

  function handleLogout() {
    commitSession(null);
    resetWorkspace();
    setNotice("Session fermee.");
    setFatalError(null);
  }

  if (initializing) {
    return (
      <div className="fullscreen-state">
        <LoaderCircle className="spin" size={28} />
        <span>Chargement du backoffice...</span>
      </div>
    );
  }

  if (!session || (session.user.type !== "merchant" && session.user.type !== "admin")) {
    return (
      <>
        <AuthShell
          loginIdentifier={loginIdentifier}
          password={password}
          setLoginIdentifier={setLoginIdentifier}
          setPassword={setPassword}
          onLogin={() => void handleLogin()}
          loginBusy={loginBusy}
          registerForm={registerForm}
          setRegisterForm={setRegisterForm}
          onRegister={() => void handleRegisterMerchant()}
          registerBusy={registerBusy}
          authMode={authMode}
          setAuthMode={setAuthMode}
          message={fatalError ?? notice}
        />
      </>
    );
  }

  return (
    <AppShell
      userName={session.user.name}
      userType={session.user.type}
      onLogout={handleLogout}
      notice={notice}
      fatalError={fatalError}
    >
      {session.user.type === "merchant" ? (
        <MerchantDashboard
          user={session.user}
          profile={profile}
          stores={stores}
          selectedStore={selectedStore}
          products={products}
          orders={orders}
          storeForm={storeForm}
          setStoreForm={setStoreForm}
          productForm={productForm}
          setProductForm={setProductForm}
          selectStore={(store) => void handleSelectMerchantStore(store)}
          createStore={() => void handleCreateStore()}
          updateStore={() => void handleUpdateStore()}
          createProduct={() => void handleCreateProduct()}
          updateProduct={(productId, patch) => void handleUpdateProduct(productId, patch)}
          busy={busy}
        />
      ) : (
        <AdminDashboard
          token={session.token}
          stores={adminStores}
          filter={adminFilter}
          setFilter={setAdminFilter}
          onUpdateStatus={(storeId, status, isActive) => void handleUpdateAdminStatus(storeId, status, isActive)}
          chefs={adminChefs}
          chefsFilter={adminChefsFilter}
          setChefsFilter={setAdminChefsFilter}
          onUpdateChefStatus={(chefId, status) => void handleUpdateChefStatus(chefId, status)}
          onVerifyChef={(chefId, isVerified) => void handleVerifyChef(chefId, isVerified)}
          allUsers={adminUsers}
          busy={busy}
        />
      )}
    </AppShell>
  );
}

// ── SaaS App Shell ────────────────────────────────────────────────────────────
type NavItem = { icon: React.ReactNode; label: string; id: string };

type ContextMenuGroup = {
  groupId: string;
  icon: React.ReactNode;
  label: string;
  items: { label: string; sub?: string; id: string }[];
};

const ADMIN_CONTEXT_MENU: ContextMenuGroup[] = [
  {
    groupId: "pilotage",
    icon: <Zap size={20} />,
    label: "Pilotage",
    items: [
      { label: "Vue generale", sub: "Cockpit", id: "overview" },
      { label: "Analytiques", sub: "Temps reel", id: "analytics" },
      { label: "Commandes", sub: "Priorites", id: "orders" },
    ],
  },
  {
    groupId: "moderation",
    icon: <ShieldCheck size={20} />,
    label: "Moderation",
    items: [
      { label: "Cuisinieres", sub: "Verification", id: "chefs" },
      { label: "Utilisateurs", sub: "Support", id: "users" },
      { label: "Enseignes", sub: "Validation", id: "stores" },
    ],
  },
  {
    groupId: "operations",
    icon: <Truck size={20} />,
    label: "Operations",
    items: [{ label: "Livreurs", sub: "Capacite", id: "couriers" }],
  },
];

const MERCHANT_CONTEXT_MENU: ContextMenuGroup[] = [
  {
    groupId: "workspace",
    icon: <LayoutDashboard size={20} />,
    label: "Workspace",
    items: [
      { label: "Vue generale", sub: "Resume", id: "overview" },
      { label: "Enseignes", sub: "Configuration", id: "stores" },
    ],
  },
  {
    groupId: "catalogue",
    icon: <Store size={20} />,
    label: "Catalogue",
    items: [
      { label: "Catalogue & stock", sub: "Produits", id: "analytics" },
      { label: "Commandes", sub: "Suivi", id: "orders" },
    ],
  },
];

const ADMIN_MOBILE_NAV: NavItem[] = [
  { icon: <LayoutDashboard size={22} />, label: "Accueil", id: "overview" },
  { icon: <ClipboardList size={22} />, label: "Commandes", id: "orders" },
  { icon: <ChefHat size={22} />, label: "Cuisinieres", id: "chefs" },
  { icon: <Users size={22} />, label: "Utilisateurs", id: "users" },
  { icon: <Store size={22} />, label: "Enseignes", id: "stores" },
];

const MERCHANT_MOBILE_NAV: NavItem[] = [
  { icon: <LayoutDashboard size={22} />, label: "Accueil", id: "overview" },
  { icon: <Store size={22} />, label: "Enseignes", id: "stores" },
  { icon: <Package size={22} />, label: "Catalogue", id: "analytics" },
  { icon: <ClipboardList size={22} />, label: "Commandes", id: "orders" },
];

const USER_DROPDOWN_ITEMS = [
  { icon: <UserCheck size={15} />, label: "Profil" },
  { icon: <HelpCircle size={15} />, label: "Centre d aide" },
  { icon: <Send size={15} />, label: "Envoyer un retour" },
  { icon: <Settings size={15} />, label: "Raccourcis" },
];

function AppShell({
  userName,
  userType,
  onLogout,
  notice,
  fatalError,
  children,
}: {
  userName: string;
  userType: string;
  onLogout: () => void;
  notice: string | null;
  fatalError: string | null;
  children: React.ReactNode;
}) {
  const contextMenu = userType === "merchant" ? MERCHANT_CONTEXT_MENU : ADMIN_CONTEXT_MENU;
  const mobileNav = userType === "merchant" ? MERCHANT_MOBILE_NAV : ADMIN_MOBILE_NAV;
  const [activeNav, setActiveNav] = useState(() => contextMenu[0].items[0].id);
  const [activeGroup, setActiveGroup] = useState(() => contextMenu[0].groupId);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const activeGroupData = contextMenu.find((g) => g.groupId === activeGroup) ?? contextMenu[0];
  const activeItem = contextMenu.flatMap((g) => g.items).find((i) => i.id === activeNav);
  const contentTitle = activeItem?.label ?? (userType === "merchant" ? "Espace marchand" : "Cockpit");
  const isSandboxEnvironment = typeof window === "undefined"
    ? true
    : /localhost|127\.0\.0\.1|192\.168\.|10\./i.test(window.location.hostname);
  const environmentLabel = isSandboxEnvironment ? "Sandbox" : "Production";
  const shellLabel = userType === "merchant" ? "Merchant Console" : "Backoffice";
  const sessionLabel = userType === "merchant" ? "Session marchand active" : "Session admin active";

  function scrollToSection(id: string) {
    setActiveNav(id);
    if (window.innerWidth > 768) {
      document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function selectGroup(groupId: string) {
    setActiveGroup(groupId);
    const group = contextMenu.find((g) => g.groupId === groupId);
    if (group && group.items.length > 0) scrollToSection(group.items[0].id);
  }

  // Keep activeGroup in sync when nav changes via mobile bottom nav
  useEffect(() => {
    const group = contextMenu.find((g) => g.items.some((i) => i.id === activeNav));
    if (group && group.groupId !== activeGroup) setActiveGroup(group.groupId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNav]);

  // Close on outside click
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        dropdownRef.current &&
        avatarRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !avatarRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="saas-root">
      <aside className="saas-sidebar">
        <div className="saas-sidebar-brand">
          <div className="saas-sidebar-logo">
            <div className="saas-logo-mark">N</div>
          </div>
          <div className="saas-sidebar-brand-copy">
            <strong>Nixyah</strong>
            <span>{shellLabel}</span>
          </div>
        </div>

        <div className="saas-sidebar-status-card">
          <div className="saas-sidebar-status-row">
            <span className="saas-sidebar-status-label">Environnement</span>
            <span className="saas-sidebar-status-pill">{environmentLabel}</span>
          </div>
          <div className="saas-sidebar-status-row">
            <span className="saas-sidebar-status-label">Session</span>
            <span className="saas-sidebar-status-value">{sessionLabel}</span>
          </div>
        </div>

        <nav className="saas-sidebar-nav">
          {contextMenu.map((group) => (
            <div key={group.groupId} className="saas-sidebar-group">
              <button
                type="button"
                className={`saas-sidebar-group-trigger${activeGroup === group.groupId ? " active" : ""}`}
                onClick={() => selectGroup(group.groupId)}
              >
                <span className="saas-sidebar-group-icon">{group.icon}</span>
                <span className="saas-sidebar-group-copy">
                  <strong>{group.label}</strong>
                  <small>{group.items.length} vues</small>
                </span>
              </button>
              <div className="saas-sidebar-group-items">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`saas-sidebar-item${activeNav === item.id ? " active" : ""}`}
                    onClick={() => scrollToSection(item.id)}
                  >
                    <span className="saas-sidebar-item-copy">
                      <span className="saas-sidebar-item-label">{item.label}</span>
                      {item.sub ? <span className="saas-sidebar-item-sub">{item.sub}</span> : null}
                    </span>
                    <span className="saas-sidebar-item-indicator" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="saas-sidebar-bottom">
          <button type="button" className="saas-sidebar-utility" title="Reglages">
            <Settings size={20} />
            <span>Reglages</span>
          </button>
          <button type="button" className="saas-sidebar-utility" title="Deconnexion" onClick={onLogout}>
            <LogOut size={20} />
            <span>Deconnexion</span>
          </button>
        </div>
      </aside>

      <div className="saas-main-area">
        {/* ── Top Header ─────────────────────────────── */}
        <header className="saas-header">
          <div className="saas-topbar-brand">
            <div className="saas-header-logo-icon saas-header-logo-brand">
              <span>N</span>
            </div>
            <div className="saas-topbar-brand-copy">
              <strong>Nixyah</strong>
              <small>{shellLabel}</small>
            </div>
          </div>

          <label className="saas-header-search" aria-label="Recherche globale">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              placeholder={userType === "admin"
                ? "Rechercher une commande, un utilisateur, une enseigne..."
                : "Rechercher une enseigne, un produit, une commande..."}
            />
          </label>

          <div className="saas-header-actions">
            <button type="button" className="saas-header-icon-btn" title="Messages">
              <MessageSquare size={17} />
            </button>
            <button type="button" className="saas-header-icon-btn saas-header-icon-notif" title="Notifications">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span className="saas-notif-dot" />
            </button>
            <button type="button" className="saas-header-icon-btn" title="Aide">
              <HelpCircle size={17} />
            </button>

            <button
              ref={avatarRef}
              type="button"
              className={`saas-avatar-btn saas-avatar-btn-rich${dropdownOpen ? " open" : ""}`}
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
              title={userName}
            >
              <span className="saas-avatar-meta">
                <strong>{userName}</strong>
                <small>{userType === "admin" ? "Nixyah Admin" : "Espace marchand"}</small>
              </span>
              <span className="saas-avatar">{initials}</span>
            </button>

            <div ref={dropdownRef} className={`saas-dropdown${dropdownOpen ? " visible" : ""}`} role="menu">
              <div className="saas-dropdown-header">
                <span className="saas-avatar saas-avatar-lg">{initials}</span>
                <div className="saas-dropdown-user">
                  <strong>{userName}</strong>
                  <a href="#" className="saas-dropdown-profile-link">Voir le profil</a>
                </div>
              </div>
              <div className="saas-dropdown-divider" />
              <div className="saas-dropdown-body">
                {USER_DROPDOWN_ITEMS.map((item) => (
                  <button key={item.label} type="button" className="saas-dropdown-item" role="menuitem">
                    <span className="saas-dropdown-item-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="saas-dropdown-divider" />
              <div className="saas-dropdown-footer">
                <button type="button" className="saas-dropdown-item saas-dropdown-logout" onClick={onLogout} role="menuitem">
                  <span className="saas-dropdown-item-icon"><LogOut size={15} /></span>
                  <span>Deconnexion</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="saas-session-banner">
          <div className="saas-session-status">
            <span className="saas-session-dot" />
            <strong>{sessionLabel}</strong>
            <span>·</span>
            <span className={`saas-env-pill${isSandboxEnvironment ? " is-sandbox" : " is-production"}`}>{environmentLabel}</span>
          </div>
          <div className="saas-role-badge">
            {userType === "merchant" ? <BadgeCheck size={13} /> : <ShieldCheck size={13} />}
            <span>{userType === "admin" ? "Administrateur" : "Marchand"}</span>
          </div>
        </div>

        {/* ── Content ──────────────────────────────────── */}
        <div className="saas-content" data-active={activeNav}>
          <div className="saas-content-header">
            <div className="saas-content-title-row">
              <div>
                <p className="saas-content-breadcrumb">{activeGroupData.label} / {activeItem?.sub ?? ""}</p>
                <h2 className="saas-content-title">{contentTitle}</h2>
              </div>
              <div className="saas-header-actions">
                <button type="button" className="saas-header-icon-btn" title="Actualiser">
                  <RefreshCcw size={16} />
                </button>
                <button type="button" className="saas-header-icon-btn" title="Exporter">
                  <FileDown size={16} />
                </button>
              </div>
            </div>
          </div>

          {(fatalError || notice) ? (
            <div className="app-notice-stack">
              {fatalError ? <div className="notice-banner error-banner">{fatalError}</div> : null}
              {notice ? <div className="notice-banner">{notice}</div> : null}
            </div>
          ) : null}

          {children}
        </div>
      </div>

      {/* ── Mobile bottom navigation ─────────────────────── */}
      <nav className="saas-mobile-nav" aria-label="Navigation mobile">
        {mobileNav.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`saas-mobile-nav-btn${activeNav === item.id ? " active" : ""}`}
            onClick={() => scrollToSection(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
        <button type="button" className="saas-mobile-nav-btn" onClick={onLogout}>
          <LogOut size={22} />
          <span>Sortir</span>
        </button>
      </nav>
    </div>
  );
}