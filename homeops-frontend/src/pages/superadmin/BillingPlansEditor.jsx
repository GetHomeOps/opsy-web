import React, {useState, useEffect, useCallback} from "react";
import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AppApi from "../../api/api";
import {Loader2, Save, ChevronDown, ChevronUp, Plus, Trash2, Check, X, Eye, Star, ArrowUp, ArrowDown} from "lucide-react";

function formatPrice(unitAmount, currency = "usd") {
  if (unitAmount == null) return "N/A";
  return new Intl.NumberFormat("en-US", {style: "currency", currency}).format(unitAmount / 100);
}

function StripePriceSelect({label, prices, value, onChange, onSave, saving}) {
  const [manualMode, setManualMode] = useState(false);

  const options = (prices || [])
    .filter((p) => p.interval === (label.toLowerCase().includes("annual") || label.toLowerCase().includes("year") ? "year" : "month"))
    .sort((a, b) => (a.unitAmount || 0) - (b.unitAmount || 0));

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {!manualMode && options.length > 0 ? (
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="form-select w-full text-sm"
        >
          <option value="">-- None --</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.productName || "Product"} - {p.nickname || formatPrice(p.unitAmount, p.currency)}/{p.interval} ({p.id})
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          placeholder="price_..."
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="form-input w-full font-mono text-sm"
        />
      )}
      <div className="mt-1 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="text-xs text-violet-600 hover:underline"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setManualMode(!manualMode)}
          className="text-xs text-gray-500 hover:underline"
        >
          {manualMode ? "Use dropdown" : "Manual entry"}
        </button>
      </div>
    </div>
  );
}

function FeatureRow({feature, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="flex flex-col flex-shrink-0">
        <button type="button" onClick={onMoveUp} disabled={isFirst} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed">
          <ArrowUp className="w-3 h-3" />
        </button>
        <button type="button" onClick={onMoveDown} disabled={isLast} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed">
          <ArrowDown className="w-3 h-3" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => onChange({...feature, included: !feature.included})}
        className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
          feature.included
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
            : "bg-gray-100 dark:bg-gray-700 text-gray-400"
        }`}
      >
        {feature.included ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
      </button>
      <input
        type="text"
        value={feature.label}
        onChange={(e) => onChange({...feature, label: e.target.value})}
        className="form-input flex-1 text-sm"
        placeholder="Feature label..."
      />
      <button
        type="button"
        onClick={onRemove}
        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function FeaturePreview({features}) {
  if (!features || features.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4 text-gray-500" />
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Live Preview</span>
      </div>
      <ul className="space-y-1.5">
        {features.map((f) => (
          <li key={f.id} className="flex items-center gap-2 text-sm">
            {f.included ? (
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <X className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            )}
            <span className={f.included ? "text-gray-800 dark:text-gray-200" : "text-gray-400 dark:text-gray-500 line-through"}>
              {f.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BillingPlansEditor() {
  const {currentAccount} = useCurrentAccount();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [plans, setPlans] = useState([]);
  const [stripePrices, setStripePrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [edits, setEdits] = useState({});
  const [featuresEdits, setFeaturesEdits] = useState({});

  const refreshPlans = useCallback(async () => {
    const res = await AppApi.getBillingPlansAll();
    setPlans(res.plans || []);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setError(null);
        const [plansRes, pricesRes] = await Promise.allSettled([
          AppApi.getBillingPlansAll(),
          AppApi.getStripePrices(),
        ]);
        if (plansRes.status === "fulfilled") setPlans(plansRes.value.plans || []);
        else setError(plansRes.reason?.message || "Failed to load plans");
        if (pricesRes.status === "fulfilled") setStripePrices(pricesRes.value.prices || []);
      } catch (err) {
        setError(err?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handlePlanUpdate = (id, data) => {
    setEdits((prev) => ({...prev, [id]: {...(prev[id] || {}), ...data}}));
  };

  const getFeatures = (planId) => {
    if (featuresEdits[planId]) return featuresEdits[planId];
    const plan = plans.find((p) => p.id === planId);
    return plan?.features || [];
  };

  const handleFeatureUpdate = (planId, idx, updated) => {
    const current = [...getFeatures(planId)];
    current[idx] = updated;
    setFeaturesEdits((prev) => ({...prev, [planId]: current}));
  };

  const handleFeatureRemove = (planId, idx) => {
    const current = [...getFeatures(planId)];
    current.splice(idx, 1);
    setFeaturesEdits((prev) => ({...prev, [planId]: current}));
  };

  const handleFeatureAdd = (planId) => {
    const current = [...getFeatures(planId)];
    const id = `feature_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    current.push({id, label: "", included: true});
    setFeaturesEdits((prev) => ({...prev, [planId]: current}));
  };

  const handleFeatureMove = (planId, idx, direction) => {
    const current = [...getFeatures(planId)];
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= current.length) return;
    [current[idx], current[targetIdx]] = [current[targetIdx], current[idx]];
    setFeaturesEdits((prev) => ({...prev, [planId]: current}));
  };

  const handleSavePlan = async (id) => {
    const data = edits[id];
    if (!data) return;
    setSaving(id);
    try {
      await AppApi.updateBillingPlan(id, data);
      setEdits((prev) => {
        const next = {...prev};
        delete next[id];
        return next;
      });
      await refreshPlans();
    } catch (err) {
      setError(err?.message || "Failed to save");
    } finally {
      setSaving(null);
    }
  };

  const handleSaveLimits = async (id) => {
    const data = edits[id]?.limits;
    if (!data) return;
    setSaving(id);
    try {
      await AppApi.updateBillingPlanLimits(id, data);
      setEdits((prev) => {
        const next = {...prev};
        if (next[id]) {
          const {limits, ...rest} = next[id];
          next[id] = Object.keys(rest).length ? rest : undefined;
        }
        return next;
      });
      await refreshPlans();
    } catch (err) {
      setError(err?.message || "Failed to save limits");
    } finally {
      setSaving(null);
    }
  };

  const handleSavePrice = async (id, billingInterval, stripePriceId) => {
    setSaving(id);
    try {
      await AppApi.updateBillingPlanPrice(id, billingInterval, stripePriceId);
      await refreshPlans();
    } catch (err) {
      setError(err?.message || "Failed to save price");
    } finally {
      setSaving(null);
    }
  };

  const handleSaveFeatures = async (id) => {
    const features = featuresEdits[id];
    if (!features) return;
    setSaving(id);
    try {
      await AppApi.updateBillingPlanFeatures(id, features);
      setFeaturesEdits((prev) => {
        const next = {...prev};
        delete next[id];
        return next;
      });
      await refreshPlans();
    } catch (err) {
      setError(err?.message || "Failed to save features");
    } finally {
      setSaving(null);
    }
  };

  const handleTogglePopular = async (id, currentlyPopular) => {
    setSaving(id);
    try {
      await AppApi.setBillingPlanPopular(id, !currentlyPopular);
      await refreshPlans();
    } catch (err) {
      setError(err?.message || "Failed to update popular status");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="grow">
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
                Billing Plans (Super Admin)
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Edit plan names, limits, features, and Stripe Price IDs. Changes apply immediately.
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
                <button onClick={() => setError(null)} className="ml-2 text-xs underline">dismiss</button>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
              </div>
            ) : (
              <div className="space-y-4">
                {plans.map((p) => {
                  const isExpanded = expandedId === p.id;
                  const planEdits = edits[p.id] || {};
                  const lim = planEdits.limits || p.limits || {};
                  const prices = p.prices || [];
                  const priceMonth = prices.find((r) => r.billing_interval === "month" || r.billingInterval === "month");
                  const priceYear = prices.find((r) => r.billing_interval === "year" || r.billingInterval === "year");
                  const features = getFeatures(p.id);
                  const hasFeatureEdits = !!featuresEdits[p.id];

                  return (
                    <div
                      key={p.id}
                      className="rounded-xl bg-white dark:bg-gray-800 shadow-xs border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                      <div
                        className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          )}
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{p.name}</span>
                          <span className="text-sm text-gray-500">({p.code})</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                            {p.targetRole}
                          </span>
                          {p.popular && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                              <Star className="w-3 h-3" /> Most Popular
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePopular(p.id, p.popular);
                          }}
                          disabled={saving === p.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            p.popular
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                          }`}
                          title={p.popular ? "Remove 'Most Popular' badge" : "Set as 'Most Popular' (clears others in same role)"}
                        >
                          <Star className={`w-3.5 h-3.5 ${p.popular ? "fill-amber-500" : ""}`} />
                          {p.popular ? "Popular" : "Set Popular"}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="px-6 pb-6 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-6">
                          {/* Plan details */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                              <input
                                type="text"
                                value={planEdits.name ?? p.name ?? ""}
                                onChange={(e) => handlePlanUpdate(p.id, {name: e.target.value})}
                                className="form-input w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                              <input
                                type="text"
                                value={planEdits.description ?? p.description ?? ""}
                                onChange={(e) => handlePlanUpdate(p.id, {description: e.target.value})}
                                className="form-input w-full"
                              />
                            </div>
                          </div>

                          {(planEdits.name != null || planEdits.description != null) && (
                            <button
                              type="button"
                              onClick={() => handleSavePlan(p.id)}
                              disabled={saving === p.id}
                              className="btn bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
                            >
                              {saving === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              Save plan details
                            </button>
                          )}

                          {/* Limits */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Limits</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                              {[
                                {key: "maxProperties", label: "Max Properties"},
                                {key: "maxContacts", label: "Max Contacts"},
                                {key: "aiTokenMonthlyQuota", label: "AI Tokens/mo"},
                                {key: "maxViewers", label: "Max Viewers"},
                                {key: "maxTeamMembers", label: "Max Team"},
                                {key: "maxDocumentsPerSystem", label: "Docs/System"},
                              ].map(({key, label}) => (
                                <div key={key}>
                                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={lim[key] ?? p.limits?.[key] ?? ""}
                                    onChange={(e) =>
                                      handlePlanUpdate(p.id, {
                                        limits: {...lim, [key]: parseInt(e.target.value, 10) || 0},
                                      })
                                    }
                                    className="form-input w-full"
                                  />
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSaveLimits(p.id)}
                              disabled={saving === p.id || !planEdits.limits}
                              className="mt-2 btn bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
                            >
                              {saving === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              Save limits
                            </button>
                          </div>

                          {/* Stripe Prices */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Stripe Price IDs</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <StripePriceSelect
                                  label="Monthly price"
                                  prices={stripePrices}
                                  value={planEdits.priceMonth ?? priceMonth?.stripe_price_id ?? priceMonth?.stripePriceId ?? ""}
                                  onChange={(v) => handlePlanUpdate(p.id, {priceMonth: v})}
                                  onSave={() => handleSavePrice(p.id, "month", planEdits.priceMonth ?? priceMonth?.stripe_price_id ?? priceMonth?.stripePriceId ?? "")}
                                  saving={saving === p.id}
                                />
                                {priceMonth?.unitAmount != null && (
                                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                                    Stripe amount: {formatPrice(priceMonth.unitAmount, priceMonth.currency)}
                                  </p>
                                )}
                              </div>
                              <div>
                                <StripePriceSelect
                                  label="Annual price"
                                  prices={stripePrices}
                                  value={planEdits.priceYear ?? priceYear?.stripe_price_id ?? priceYear?.stripePriceId ?? ""}
                                  onChange={(v) => handlePlanUpdate(p.id, {priceYear: v})}
                                  onSave={() => handleSavePrice(p.id, "year", planEdits.priceYear ?? priceYear?.stripe_price_id ?? priceYear?.stripePriceId ?? "")}
                                  saving={saving === p.id}
                                />
                                {priceYear?.unitAmount != null && (
                                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                                    Stripe amount: {formatPrice(priceYear.unitAmount, priceYear.currency)}
                                  </p>
                                )}
                              </div>
                            </div>
                            {stripePrices.length === 0 && (
                              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                No Stripe prices found. Ensure STRIPE_SECRET_KEY is set in your .env file.
                              </p>
                            )}
                          </div>

                          {/* Features Editor */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Features</h4>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <div>
                                <div className="space-y-0.5">
                                  {features.map((f, idx) => (
                                    <FeatureRow
                                      key={f.id}
                                      feature={f}
                                      onChange={(updated) => handleFeatureUpdate(p.id, idx, updated)}
                                      onRemove={() => handleFeatureRemove(p.id, idx)}
                                      onMoveUp={() => handleFeatureMove(p.id, idx, -1)}
                                      onMoveDown={() => handleFeatureMove(p.id, idx, 1)}
                                      isFirst={idx === 0}
                                      isLast={idx === features.length - 1}
                                    />
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleFeatureAdd(p.id)}
                                  className="mt-2 flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700"
                                >
                                  <Plus className="w-4 h-4" />
                                  Add feature
                                </button>
                                {hasFeatureEdits && (
                                  <button
                                    type="button"
                                    onClick={() => handleSaveFeatures(p.id)}
                                    disabled={saving === p.id}
                                    className="mt-3 btn bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
                                  >
                                    {saving === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save features
                                  </button>
                                )}
                              </div>
                              <FeaturePreview features={features} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default BillingPlansEditor;
