import { useState, useEffect, useCallback } from 'react';
import { nexusApi } from '@/lib/nexusApi';
import {
  Mail, Search, Users, BarChart3, Settings, Play, Pause,
  Plus, RefreshCw, Eye, MousePointerClick, CalendarCheck,
  TrendingUp, Globe, Trash2, FileText, Send
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface DashboardStats {
  totalProspects: number;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalResponded: number;
  totalDemos: number;
  totalConverted: number;
  activeCampaigns: number;
  openRate: number;
  clickRate: number;
  bySector: Record<string, number>;
  dailyStats: Record<string, { sent: number; opened: number; clicked: number }>;
}

interface Prospect {
  id: number;
  name: string;
  sector: string;
  city: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews_count: number;
  status: string;
  source: string;
  tags: string[];
  created_at: string;
}

interface Campaign {
  id: number;
  name: string;
  sector: string;
  cities: string[];
  status: string;
  daily_send_limit: number;
  follow_up_enabled: boolean;
  prospects_count: number;
  emails_sent: number;
  emails_opened: number;
  emails_responded: number;
  conversions: number;
  custom_prompt: string | null;
  created_at: string;
}

interface ProspectionSettings {
  daily_limit: number;
  hourly_limit: number;
  send_window_start: number;
  send_window_end: number;
  send_days: number[];
  from_email: string;
  from_name: string;
  reply_to: string;
  active_sectors: string[];
  active_cities: string[];
  followup_j3: boolean;
  followup_j7: boolean;
  followup_j14: boolean;
  global_pause: boolean;
  company_name: string;
  company_siret: string;
  company_address: string;
}

interface CampaignEmail {
  id: number;
  email_type: string;
  subject: string;
  html_body: string;
  to_address: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  prospection_prospects?: { name: string; sector: string };
}

// ============================================================================
// Sector labels
// ============================================================================

const SECTOR_LABELS: Record<string, string> = {
  salon: 'Salon / Beaute',
  restaurant: 'Restaurant',
  commerce: 'Commerce',
  hotel: 'Hotel',
  domicile: 'Domicile',
  securite: 'Securite',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400',
  contacted: 'bg-cyan-500/20 text-cyan-400',
  responded: 'bg-green-500/20 text-green-400',
  demo_scheduled: 'bg-purple-500/20 text-purple-400',
  converted: 'bg-emerald-500/20 text-emerald-400',
  lost: 'bg-red-500/20 text-red-400',
  unsubscribed: 'bg-slate-500/20 text-slate-400',
};

const EMAIL_STATUS_COLORS: Record<string, string> = {
  queued: 'bg-slate-500/20 text-slate-400',
  sent: 'bg-blue-500/20 text-blue-400',
  delivered: 'bg-cyan-500/20 text-cyan-400',
  opened: 'bg-green-500/20 text-green-400',
  clicked: 'bg-emerald-500/20 text-emerald-400',
  bounced: 'bg-red-500/20 text-red-400',
};

// ============================================================================
// Sub-tab navigation
// ============================================================================

type SubTab = 'dashboard' | 'campaigns' | 'prospects' | 'settings';

const SUB_TABS: { id: SubTab; label: string; icon: typeof Mail }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'campaigns', label: 'Campagnes', icon: Send },
  { id: 'prospects', label: 'Prospects', icon: Users },
  { id: 'settings', label: 'Parametres', icon: Settings },
];

// ============================================================================
// Main Component
// ============================================================================

export default function SentinelProspection() {
  const [activeTab, setActiveTab] = useState<SubTab>('dashboard');

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 bg-slate-900 rounded-lg border border-slate-800 p-1">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-all ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-300 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'dashboard' && <DashboardSection />}
      {activeTab === 'campaigns' && <CampaignsSection />}
      {activeTab === 'prospects' && <ProspectsSection />}
      {activeTab === 'settings' && <SettingsSection />}
    </div>
  );
}

// ============================================================================
// Dashboard Section
// ============================================================================

function DashboardSection() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 30000);
    return () => clearInterval(id);
  }, []);

  async function fetchStats() {
    try {
      const res = await nexusApi.get<{ data: DashboardStats }>('/nexus/prospection/dashboard');
      setStats((res as any).data || res);
    } catch (err) {
      console.error('Dashboard stats error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingGrid count={6} />;
  if (!stats) return <EmptyState message="Impossible de charger les stats" />;

  const kpis = [
    { label: 'Prospects', value: stats.totalProspects, icon: Users, color: 'cyan' },
    { label: 'Emails envoyes', value: stats.totalSent, icon: Send, color: 'blue' },
    { label: 'Taux ouverture', value: `${stats.openRate}%`, icon: Eye, color: 'green' },
    { label: 'Taux clic', value: `${stats.clickRate}%`, icon: MousePointerClick, color: 'emerald' },
    { label: 'Demos planifiees', value: stats.totalDemos, icon: CalendarCheck, color: 'purple' },
    { label: 'Conversions', value: stats.totalConverted, icon: TrendingUp, color: 'amber' },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-slate-900 rounded-lg border border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={`text-${kpi.color}-400`} />
                <span className="text-[11px] text-slate-500 uppercase tracking-wide">{kpi.label}</span>
              </div>
              <div className="text-2xl font-bold text-white">{kpi.value}</div>
            </div>
          );
        })}
      </div>

      {/* Sector breakdown */}
      {Object.keys(stats.bySector).length > 0 && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Prospects par secteur</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(stats.bySector).map(([sector, count]) => (
              <div key={sector} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                <span className="text-sm text-slate-300">{SECTOR_LABELS[sector] || sector}</span>
                <span className="text-sm font-mono text-cyan-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily chart (simple bars) */}
      {Object.keys(stats.dailyStats).length > 0 && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Activite (30 jours)</h3>
          <div className="flex items-end gap-1 h-32 overflow-x-auto">
            {Object.entries(stats.dailyStats).sort().slice(-30).map(([day, d]) => {
              const maxVal = Math.max(...Object.values(stats.dailyStats).map(v => v.sent), 1);
              const h = Math.max((d.sent / maxVal) * 100, 4);
              return (
                <div key={day} className="flex flex-col items-center gap-1 min-w-[12px]" title={`${day}: ${d.sent} envoyes, ${d.opened} ouverts`}>
                  <div className="w-2.5 bg-cyan-500/60 rounded-t" style={{ height: `${h}%` }} />
                  {d.opened > 0 && <div className="w-1.5 bg-green-400/60 rounded" style={{ height: `${Math.max((d.opened / maxVal) * 100, 2)}%` }} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Campaigns Section
// ============================================================================

function CampaignsSection() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);
  const [campaignEmails, setCampaignEmails] = useState<CampaignEmail[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => { fetchCampaigns(); }, []);

  async function fetchCampaigns() {
    try {
      const res = await nexusApi.get<{ data: Campaign[] }>('/nexus/prospection/campaigns');
      setCampaigns((res as any).data || []);
    } catch (err) {
      console.error('Campaigns error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleCampaign(id: number, currentStatus: string) {
    try {
      if (currentStatus === 'active') {
        await nexusApi.post(`/nexus/prospection/campaigns/${id}/pause`);
      } else {
        await nexusApi.post(`/nexus/prospection/campaigns/${id}/start`);
      }
      fetchCampaigns();
    } catch (err) {
      console.error('Toggle campaign error:', err);
    }
  }

  async function viewEmails(campaignId: number) {
    setSelectedCampaign(campaignId);
    try {
      const res = await nexusApi.get<{ data: CampaignEmail[] }>(`/nexus/prospection/campaigns/${campaignId}/emails`);
      setCampaignEmails((res as any).data || []);
    } catch (err) {
      console.error('Campaign emails error:', err);
    }
  }

  async function previewEmail(campaignId: number) {
    setPreviewLoading(true);
    setPreviewHtml(null);
    try {
      const res = await nexusApi.post<{ data: { subject: string; html_body: string } }>(`/nexus/prospection/campaigns/${campaignId}/preview`, {});
      const data = (res as any).data;
      setPreviewHtml(data.html_body);
    } catch (err) {
      console.error('Preview error:', err);
      setPreviewHtml('<p style="color:red;padding:20px;">Erreur lors de la generation du preview</p>');
    } finally {
      setPreviewLoading(false);
    }
  }

  if (loading) return <LoadingGrid count={3} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-300">Campagnes ({campaigns.length})</h3>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/15 text-cyan-300 rounded-lg text-xs hover:bg-cyan-500/25 transition-colors"
        >
          <Plus size={14} />
          Nouvelle campagne
        </button>
      </div>

      {showCreate && (
        <CreateCampaignForm
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchCampaigns(); }}
        />
      )}

      {campaigns.length === 0 ? (
        <EmptyState message="Aucune campagne. Creez-en une pour commencer." />
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="bg-slate-900 rounded-lg border border-slate-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-medium text-white">{c.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-slate-500">{SECTOR_LABELS[c.sector] || c.sector}</span>
                    {c.cities?.length > 0 && (
                      <span className="text-[11px] text-slate-600">{c.cities.join(', ')}</span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      c.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      c.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                      c.status === 'draft' ? 'bg-slate-500/20 text-slate-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => previewEmail(c.id)}
                    className="p-1.5 text-cyan-500 hover:text-cyan-300 transition-colors"
                    title="Apercu email"
                    disabled={previewLoading}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => viewEmails(c.id)}
                    className="p-1.5 text-slate-500 hover:text-white transition-colors"
                    title="Voir emails"
                  >
                    <FileText size={14} />
                  </button>
                  <button
                    onClick={() => toggleCampaign(c.id, c.status)}
                    className={`p-1.5 rounded transition-colors ${
                      c.status === 'active'
                        ? 'text-yellow-400 hover:bg-yellow-500/15'
                        : 'text-green-400 hover:bg-green-500/15'
                    }`}
                    title={c.status === 'active' ? 'Pause' : 'Demarrer'}
                  >
                    {c.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <MiniStat label="Envoyes" value={c.emails_sent} />
                <MiniStat label="Ouverts" value={c.emails_opened} />
                <MiniStat label="Reponses" value={c.emails_responded} />
                <MiniStat label="Conversions" value={c.conversions} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview email */}
      {(previewLoading || previewHtml) && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-cyan-400">
              <Eye size={14} className="inline mr-2" />
              Apercu email (genere par IA)
            </h4>
            <button onClick={() => setPreviewHtml(null)} className="text-slate-500 hover:text-white text-xs">
              Fermer
            </button>
          </div>
          {previewLoading ? (
            <div className="text-center py-8 text-slate-500 text-sm">Generation en cours...</div>
          ) : (
            <div className="rounded-lg overflow-hidden border border-slate-700">
              <iframe
                srcDoc={previewHtml || ''}
                className="w-full border-0"
                style={{ minHeight: '700px' }}
                title="Preview email"
              />
            </div>
          )}
        </div>
      )}

      {/* Campaign emails detail */}
      {selectedCampaign && (
        <CampaignEmailsList emails={campaignEmails} onClose={() => setSelectedCampaign(null)} campaignId={selectedCampaign} />
      )}
    </div>
  );
}

// ============================================================================
// Campaign Emails List (avec apercu contenu)
// ============================================================================

function CampaignEmailsList({ emails, onClose, campaignId }: { emails: CampaignEmail[]; onClose: () => void; campaignId: number }) {
  const [selectedEmail, setSelectedEmail] = useState<CampaignEmail | null>(null);

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-slate-300">
          Emails campagne #{campaignId}
        </h4>
        <button onClick={onClose} className="text-slate-500 hover:text-white text-xs">
          Fermer
        </button>
      </div>

      {emails.length === 0 ? (
        <p className="text-xs text-slate-500">Aucun email envoye</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {emails.map(e => (
            <div
              key={e.id}
              onClick={() => setSelectedEmail(selectedEmail?.id === e.id ? null : e)}
              className="bg-slate-800/50 rounded px-3 py-2 cursor-pointer hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-white">{e.prospection_prospects?.name || e.to_address}</span>
                  <span className="text-[10px] text-slate-500 ml-2">{e.email_type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${EMAIL_STATUS_COLORS[e.status] || ''}`}>
                    {e.status}
                  </span>
                  {e.sent_at && (
                    <span className="text-[10px] text-slate-600">
                      {new Date(e.sent_at).toLocaleDateString('fr')}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">{e.subject}</div>
            </div>
          ))}
        </div>
      )}

      {/* Apercu email */}
      {selectedEmail && (
        <div className="mt-4 border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-xs text-slate-500">De : contact@nexus-ai-saas.com</div>
              <div className="text-xs text-slate-500">A : {selectedEmail.to_address}</div>
            </div>
            <button onClick={() => setSelectedEmail(null)} className="text-[10px] text-slate-500 hover:text-white">
              Fermer apercu
            </button>
          </div>
          <div className="text-sm font-medium text-white mb-3">{selectedEmail.subject}</div>
          <div
            className="bg-white rounded-lg p-4 max-h-80 overflow-y-auto text-sm text-slate-800"
            dangerouslySetInnerHTML={{ __html: selectedEmail.html_body }}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Create Campaign Form
// ============================================================================

function CreateCampaignForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [sector, setSector] = useState('salon');
  const [cities, setCities] = useState('');
  const [dailyLimit, setDailyLimit] = useState(30);
  const [followUp, setFollowUp] = useState(true);
  const [customPrompt, setCustomPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await nexusApi.post('/nexus/prospection/campaigns', {
        name: name.trim(),
        sector,
        cities: cities.split(',').map(c => c.trim()).filter(Boolean),
        daily_send_limit: dailyLimit,
        follow_up_enabled: followUp,
        custom_prompt: customPrompt.trim() || null,
      });
      onCreated();
    } catch (err) {
      console.error('Create campaign error:', err);
    } finally {
      setSaving(false);
    }
  }


  return (
    <div className="bg-slate-900 rounded-lg border border-cyan-500/30 p-4 space-y-3">
      <h4 className="text-sm font-medium text-cyan-300">Nouvelle campagne</h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-slate-500 mb-1 block">Nom</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
            placeholder="Ex: Salons Paris Q1"
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-500 mb-1 block">Secteur</label>
          <select
            value={sector}
            onChange={e => setSector(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
          >
            {Object.entries(SECTOR_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-slate-500 mb-1 block">Villes (separees par virgule)</label>
          <input
            value={cities}
            onChange={e => setCities(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
            placeholder="Paris, Lyon, Marseille"
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-500 mb-1 block">Limite emails/jour</label>
          <input
            type="number"
            value={dailyLimit}
            onChange={e => setDailyLimit(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
            min={1}
            max={100}
          />
        </div>
      </div>

      <div>
        <label className="text-[11px] text-slate-500 mb-1 block">Prompt IA custom (optionnel)</label>
        <textarea
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none h-16 resize-none"
          placeholder="Instructions supplementaires pour la generation d'emails..."
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          checked={followUp}
          onChange={e => setFollowUp(e.target.checked)}
          className="rounded border-slate-600"
        />
        Relances automatiques (J+3, J+7, J+14)
      </label>

      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={handleCreate}
          disabled={!name.trim() || saving}
          className="px-4 py-1.5 bg-cyan-500/20 text-cyan-300 rounded text-xs font-medium hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
        >
          {saving ? 'Creation...' : 'Creer'}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Prospects Section
// ============================================================================

function ProspectsSection() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showScrape, setShowScrape] = useState(false);

  const fetchProspects = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '50');
      if (search) params.set('search', search);
      if (sectorFilter) params.set('sector', sectorFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await nexusApi.get<{ data: Prospect[]; total: number }>(`/nexus/prospection/prospects?${params}`);
      setProspects((res as any).data || []);
      setTotal((res as any).total || 0);
    } catch (err) {
      console.error('Prospects error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, sectorFilter, statusFilter]);

  useEffect(() => { fetchProspects(); }, [fetchProspects]);

  async function handleDelete(id: number) {
    if (!confirm('Supprimer ce prospect ?')) return;
    try {
      await nexusApi.delete(`/nexus/prospection/prospects/${id}`);
      fetchProspects();
    } catch (err) {
      console.error('Delete prospect error:', err);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            placeholder="Rechercher un prospect..."
          />
        </div>
        <select
          value={sectorFilter}
          onChange={e => { setSectorFilter(e.target.value); setPage(1); }}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="">Tous secteurs</option>
          {Object.entries(SECTOR_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="">Tous status</option>
          {Object.keys(STATUS_COLORS).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={() => setShowScrape(!showScrape)}
          className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/15 text-cyan-300 rounded-lg text-xs hover:bg-cyan-500/25 transition-colors"
        >
          <Globe size={14} />
          Scraper
        </button>
        <ScrapeEmailsButton onDone={fetchProspects} />
        <button
          onClick={fetchProspects}
          className="p-2 text-slate-500 hover:text-white transition-colors"
          title="Rafraichir"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {showScrape && (
        <ScrapeForm onDone={() => { setShowScrape(false); fetchProspects(); }} />
      )}

      {/* Results count */}
      <div className="text-xs text-slate-500">
        {total} prospect{total > 1 ? 's' : ''} trouve{total > 1 ? 's' : ''}
      </div>

      {loading ? <LoadingGrid count={5} /> : prospects.length === 0 ? (
        <EmptyState message="Aucun prospect. Lancez un scrape pour commencer." />
      ) : (
        <>
          {/* Table */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-4 py-2 text-[11px] text-slate-500 font-medium">Nom</th>
                    <th className="text-left px-4 py-2 text-[11px] text-slate-500 font-medium">Secteur</th>
                    <th className="text-left px-4 py-2 text-[11px] text-slate-500 font-medium hidden md:table-cell">Ville</th>
                    <th className="text-left px-4 py-2 text-[11px] text-slate-500 font-medium hidden lg:table-cell">Email</th>
                    <th className="text-left px-4 py-2 text-[11px] text-slate-500 font-medium hidden lg:table-cell">Note</th>
                    <th className="text-left px-4 py-2 text-[11px] text-slate-500 font-medium">Status</th>
                    <th className="text-right px-4 py-2 text-[11px] text-slate-500 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map(p => (
                    <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-2.5">
                        <div className="text-white text-xs font-medium">{p.name}</div>
                        {p.phone && <div className="text-[10px] text-slate-600">{p.phone}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">{SECTOR_LABELS[p.sector] || p.sector}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400 hidden md:table-cell">{p.city}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-400 hidden lg:table-cell">
                        {p.email ? (
                          <span className="text-cyan-400">{p.email}</span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell">
                        {p.rating ? (
                          <span className="text-xs text-amber-400">{p.rating}/5 <span className="text-slate-600">({p.reviews_count})</span></span>
                        ) : (
                          <span className="text-xs text-slate-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[p.status] || ''}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs text-slate-400 hover:text-white disabled:opacity-30"
              >
                Precedent
              </button>
              <span className="text-xs text-slate-500">Page {page} / {Math.ceil(total / 50)}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * 50 >= total}
                className="px-3 py-1 text-xs text-slate-400 hover:text-white disabled:opacity-30"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Scrape Emails Button
// ============================================================================

function ScrapeEmailsButton({ onDone }: { onDone: () => void }) {
  const [scraping, setScraping] = useState(false);
  const [result, setResult] = useState<{ total: number; found: number; failed: number } | null>(null);

  async function handleScrape() {
    setScraping(true);
    setResult(null);
    try {
      const res = await nexusApi.post<{ data: { total: number; found: number; failed: number } }>('/nexus/prospection/scrape/emails', { limit: 500 });
      setResult((res as any).data || res);
      onDone();
    } catch (err) {
      console.error('Scrape emails error:', err);
    } finally {
      setScraping(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleScrape}
        disabled={scraping}
        className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/15 text-purple-300 rounded-lg text-xs hover:bg-purple-500/25 transition-colors disabled:opacity-50"
        title="Chercher les emails sur les sites web des prospects"
      >
        <Mail size={14} />
        {scraping ? 'Recherche...' : 'Trouver emails'}
      </button>
      {result && (
        <div className="absolute top-full mt-1 left-0 bg-slate-800 border border-slate-700 rounded-lg p-2 text-[11px] text-white whitespace-nowrap z-10">
          {result.found} emails trouves sur {result.total} sites visites
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Scrape Form
// ============================================================================

function ScrapeForm({ onDone }: { onDone: () => void }) {
  const [sector, setSector] = useState('salon');
  const [city, setCity] = useState('Paris');
  const [scraping, setScraping] = useState(false);
  const [result, setResult] = useState<{ found: number; inserted: number; skipped: number; errors: string[] } | null>(null);

  async function handleScrape() {
    setScraping(true);
    setResult(null);
    try {
      const res = await nexusApi.post<{ data: typeof result }>('/nexus/prospection/scrape', { sector, city });
      setResult((res as any).data || res);
    } catch (err) {
      console.error('Scrape error:', err);
    } finally {
      setScraping(false);
    }
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-cyan-500/30 p-4 space-y-3">
      <h4 className="text-sm font-medium text-cyan-300">Scraper Google Places</h4>
      <div className="flex items-end gap-3">
        <div>
          <label className="text-[11px] text-slate-500 mb-1 block">Secteur</label>
          <select
            value={sector}
            onChange={e => setSector(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
          >
            {Object.entries(SECTOR_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-slate-500 mb-1 block">Ville</label>
          <input
            value={city}
            onChange={e => setCity(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
            placeholder="Paris"
          />
        </div>
        <button
          onClick={handleScrape}
          disabled={scraping || !city.trim()}
          className="px-4 py-1.5 bg-cyan-500/20 text-cyan-300 rounded text-xs font-medium hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
        >
          {scraping ? 'Scraping...' : 'Lancer'}
        </button>
        <button onClick={onDone} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">
          Fermer
        </button>
      </div>

      {result && (
        <div className="bg-slate-800/50 rounded p-3 text-xs">
          <div className="text-green-400">
            {result.inserted} prospects ajoutes / {result.found} trouves ({result.skipped} doublons)
          </div>
          {result.errors.length > 0 && (
            <div className="text-red-400 mt-1">
              {result.errors.length} erreur(s): {result.errors[0]}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Settings Section
// ============================================================================

function SettingsSection() {
  const [settings, setSettings] = useState<ProspectionSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await nexusApi.get<{ data: ProspectionSettings }>('/nexus/prospection/settings');
      setSettings((res as any).data || res);
    } catch (err) {
      console.error('Settings error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      await nexusApi.patch('/nexus/prospection/settings', settings);
    } catch (err) {
      console.error('Save settings error:', err);
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof ProspectionSettings>(key: K, value: ProspectionSettings[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  if (loading) return <LoadingGrid count={2} />;
  if (!settings) return <EmptyState message="Impossible de charger les parametres" />;

  return (
    <div className="space-y-4">
      {/* Global pause */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-white">Pause globale</h4>
            <p className="text-[11px] text-slate-500">Stoppe tous les envois et relances</p>
          </div>
          <button
            onClick={() => updateField('global_pause', !settings.global_pause)}
            className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${
              settings.global_pause
                ? 'bg-red-500/20 text-red-400'
                : 'bg-green-500/20 text-green-400'
            }`}
          >
            {settings.global_pause ? 'EN PAUSE' : 'ACTIF'}
          </button>
        </div>
      </div>

      {/* Limites */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 space-y-3">
        <h4 className="text-sm font-medium text-slate-300">Limites d'envoi</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Max/jour</label>
            <input
              type="number"
              value={settings.daily_limit}
              onChange={e => updateField('daily_limit', Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Max/heure</label>
            <input
              type="number"
              value={settings.hourly_limit}
              onChange={e => updateField('hourly_limit', Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Debut (heure)</label>
            <input
              type="number"
              value={settings.send_window_start}
              onChange={e => updateField('send_window_start', Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
              min={0} max={23}
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Fin (heure)</label>
            <input
              type="number"
              value={settings.send_window_end}
              onChange={e => updateField('send_window_end', Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
              min={0} max={23}
            />
          </div>
        </div>
      </div>

      {/* Expediteur */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 space-y-3">
        <h4 className="text-sm font-medium text-slate-300">Expediteur</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Nom</label>
            <input
              value={settings.from_name}
              onChange={e => updateField('from_name', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Email</label>
            <input
              value={settings.from_email}
              onChange={e => updateField('from_email', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Reply-To</label>
            <input
              value={settings.reply_to}
              onChange={e => updateField('reply_to', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Relances */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 space-y-3">
        <h4 className="text-sm font-medium text-slate-300">Relances automatiques</h4>
        <div className="flex flex-wrap gap-4">
          {[
            { key: 'followup_j3' as const, label: 'J+3' },
            { key: 'followup_j7' as const, label: 'J+7' },
            { key: 'followup_j14' as const, label: 'J+14' },
          ].map(f => (
            <label key={f.key} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings[f.key]}
                onChange={e => updateField(f.key, e.target.checked)}
                className="rounded border-slate-600"
              />
              Relance {f.label}
            </label>
          ))}
        </div>
      </div>

      {/* RGPD */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 space-y-3">
        <h4 className="text-sm font-medium text-slate-300">Identite RGPD</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Raison sociale</label>
            <input
              value={settings.company_name}
              onChange={e => updateField('company_name', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">SIRET</label>
            <input
              value={settings.company_siret}
              onChange={e => updateField('company_siret', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Adresse</label>
            <input
              value={settings.company_address}
              onChange={e => updateField('company_address', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-cyan-500/20 text-cyan-300 rounded-lg text-sm font-medium hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Shared Components
// ============================================================================

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-white font-mono">{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}

function LoadingGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="h-24 bg-slate-900 rounded-lg border border-slate-800 animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-8 text-center">
      <Mail size={24} className="mx-auto text-slate-600 mb-2" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
