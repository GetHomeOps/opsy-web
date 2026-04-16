import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Check, Loader2, Users, Globe } from "lucide-react";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import Banner from "../../partials/containers/Banner";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AppApi from "../../api/api";

const EMPTY_FORM = {
  couponType: "general",
  code: "",
  name: "",
  description: "",
  discountType: "percent",
  discountValue: "",
  currency: "usd",
  duration: "once",
  durationInMonths: "",
  planIds: [],
  maxRedemptions: "",
  expiresAt: "",
  isActive: true,
  // Batch-specific
  quantity: "",
  codePrefix: "",
  batchName: "",
};

function CouponForm() {
  const { id } = useParams();
  const isEdit = id && id !== "new";
  const navigate = useNavigate();
  const { currentAccount } = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(!!isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banner, setBanner] = useState({ open: false, type: "success", message: "" });
  const [copiedCode, setCopiedCode] = useState(false);
  const [redemptions, setRedemptions] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [plansRes] = await Promise.allSettled([
          AppApi.getBillingPlansAll().catch(() => ({ plans: [] })),
        ]);
        setPlans(plansRes.status === "fulfilled" ? plansRes.value?.plans || [] : []);

        if (isEdit) {
          setIsLoading(true);
          const res = await AppApi.getCoupon(id);
          const c = res.coupon;
          setForm({
            couponType: c.couponType || "general",
            code: c.code || "",
            name: c.name || "",
            description: c.description || "",
            discountType: c.discountType || "percent",
            discountValue: c.discountValue != null ? String(c.discountValue) : "",
            currency: c.currency || "usd",
            duration: c.duration || "once",
            durationInMonths: c.durationInMonths != null ? String(c.durationInMonths) : "",
            planIds: c.planIds || [],
            maxRedemptions: c.maxRedemptions != null ? String(c.maxRedemptions) : "",
            expiresAt: c.expiresAt ? c.expiresAt.slice(0, 16) : "",
            isActive: c.isActive !== false,
            quantity: "",
            codePrefix: "",
            batchName: c.batchName || "",
          });
          setRedemptions(c.redemptions || []);
        }
      } catch (err) {
        setBanner({ open: true, type: "error", message: err.message });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id, isEdit]);

  useEffect(() => {
    if (banner.open) {
      const t = setTimeout(() => setBanner((b) => ({ ...b, open: false })), 4000);
      return () => clearTimeout(t);
    }
  }, [banner.open]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handlePlanToggle(planId) {
    setForm((prev) => {
      const ids = prev.planIds.includes(planId)
        ? prev.planIds.filter((p) => p !== planId)
        : [...prev.planIds, planId];
      return { ...prev, planIds: ids };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const isUnique = form.couponType === "unique";

      if (isEdit) {
        const payload = {
          name: form.name.trim() || null,
          description: form.description.trim() || null,
          planIds: form.planIds,
          maxRedemptions: form.maxRedemptions ? parseInt(form.maxRedemptions, 10) : null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          isActive: form.isActive,
        };
        await AppApi.updateCoupon(id, payload);
        setBanner({ open: true, type: "success", message: "Coupon updated successfully." });
      } else {
        const payload = {
          couponType: form.couponType,
          name: form.name.trim() || null,
          description: form.description.trim() || null,
          discountType: form.discountType,
          discountValue: parseFloat(form.discountValue),
          currency: form.currency,
          duration: form.duration,
          durationInMonths: form.duration === "repeating" ? parseInt(form.durationInMonths, 10) : null,
          planIds: form.planIds,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          isActive: form.isActive,
        };

        if (isUnique) {
          payload.quantity = parseInt(form.quantity, 10);
          payload.codePrefix = form.codePrefix.trim() || undefined;
          payload.batchName = form.batchName.trim() || form.name.trim() || null;
        } else {
          payload.code = form.code.trim();
          payload.maxRedemptions = form.maxRedemptions ? parseInt(form.maxRedemptions, 10) : null;
        }

        await AppApi.createCoupon(payload);
        const msg = isUnique
          ? `Batch of ${payload.quantity} unique codes created successfully.`
          : "Coupon created successfully.";
        setBanner({ open: true, type: "success", message: msg });
        setTimeout(() => navigate(`/${accountUrl}/coupons`), 1200);
      }
    } catch (err) {
      setBanner({ open: true, type: "error", message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(form.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setBanner({ open: true, type: "error", message: "Failed to copy." });
    }
  }

  const inputCls = "form-input w-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 rounded-lg text-sm";
  const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
  const isUnique = form.couponType === "unique";

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <div className="fixed right-0 w-auto sm:w-full z-50">
          <Banner
            type={banner.type}
            open={banner.open}
            setOpen={(open) => setBanner((b) => ({ ...b, open }))}
            className={`transition-opacity duration-600 ${banner.open ? "opacity-100" : "opacity-0"}`}
          >
            {banner.message}
          </Banner>
        </div>

        <main className="grow">
          <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-3xl mx-auto">
            {/* Back button */}
            <button
              onClick={() => navigate(`/${accountUrl}/coupons`)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Coupons
            </button>

            <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold mb-8">
              {isEdit ? "Edit Coupon" : "Create Coupon"}
            </h1>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Coupon Type Selector (create only) */}
                {!isEdit && (
                  <div>
                    <label className={labelCls}>Coupon Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, couponType: "general" }))}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                          !isUnique
                            ? "border-violet-500 dark:border-violet-400 bg-violet-50 dark:bg-violet-500/10"
                            : "border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <Globe className={`w-5 h-5 shrink-0 ${!isUnique ? "text-violet-500" : "text-gray-400"}`} />
                        <div>
                          <div className={`text-sm font-semibold ${!isUnique ? "text-violet-700 dark:text-violet-300" : "text-gray-700 dark:text-gray-300"}`}>
                            General
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Single code anyone can use
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, couponType: "unique" }))}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                          isUnique
                            ? "border-violet-500 dark:border-violet-400 bg-violet-50 dark:bg-violet-500/10"
                            : "border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <Users className={`w-5 h-5 shrink-0 ${isUnique ? "text-violet-500" : "text-gray-400"}`} />
                        <div>
                          <div className={`text-sm font-semibold ${isUnique ? "text-violet-700 dark:text-violet-300" : "text-gray-700 dark:text-gray-300"}`}>
                            Unique (Batch)
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Generate single-use codes
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Code (general) or Prefix + Quantity (unique) */}
                {!isEdit && isUnique ? (
                  <>
                    {/* Batch Name */}
                    <div>
                      <label className={labelCls}>
                        Batch Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="batchName"
                        value={form.batchName}
                        onChange={handleChange}
                        className={inputCls}
                        placeholder="e.g. Early Adopters Q2 2026"
                        required
                        maxLength={255}
                      />
                      <p className="text-xs text-gray-400 mt-1">A label to identify this batch of codes.</p>
                    </div>

                    {/* Prefix + Quantity */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Code Prefix</label>
                        <input
                          name="codePrefix"
                          value={form.codePrefix}
                          onChange={handleChange}
                          className={`${inputCls} uppercase font-mono tracking-wider`}
                          placeholder="e.g. EARLY"
                          maxLength={20}
                          pattern="[A-Za-z0-9_\-]*"
                          title="Letters, numbers, dashes, and underscores only"
                        />
                        <p className="text-xs text-gray-400 mt-1">Optional. Codes will be PREFIX-XXXX.</p>
                      </div>
                      <div>
                        <label className={labelCls}>
                          Quantity <span className="text-red-500">*</span>
                        </label>
                        <input
                          name="quantity"
                          type="number"
                          min="1"
                          max="500"
                          value={form.quantity}
                          onChange={handleChange}
                          className={inputCls}
                          placeholder="e.g. 50"
                          required
                        />
                        <p className="text-xs text-gray-400 mt-1">Each code is single-use (1-500).</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className={labelCls}>
                      Coupon Code <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        name="code"
                        value={form.code}
                        onChange={handleChange}
                        className={`${inputCls} uppercase font-mono tracking-wider flex-1`}
                        placeholder="e.g. SUMMER25"
                        required
                        disabled={isEdit}
                        maxLength={50}
                        pattern="[A-Za-z0-9_\-]+"
                        title="Letters, numbers, dashes, and underscores only"
                      />
                      {isEdit && form.code && (
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="btn border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-300"
                        >
                          {copiedCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    {isEdit && (
                      <p className="text-xs text-gray-400 mt-1">Code cannot be changed after creation.</p>
                    )}
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className={labelCls}>Display Name</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className={inputCls}
                    placeholder="e.g. Summer 2026 Promo"
                    maxLength={255}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    className={`${inputCls} resize-none`}
                    rows={2}
                    placeholder="Internal notes about this coupon..."
                  />
                </div>

                {/* Discount Type + Value */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>
                      Discount Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="discountType"
                      value={form.discountType}
                      onChange={handleChange}
                      className={inputCls}
                      disabled={isEdit}
                    >
                      <option value="percent">Percentage (%)</option>
                      <option value="fixed">Fixed Amount ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>
                      Discount Value <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm pointer-events-none">
                        {form.discountType === "percent" ? "%" : "$"}
                      </span>
                      <input
                        name="discountValue"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={form.discountType === "percent" ? "100" : undefined}
                        value={form.discountValue}
                        onChange={handleChange}
                        className={`${inputCls} pl-8`}
                        placeholder={form.discountType === "percent" ? "e.g. 20" : "e.g. 10.00"}
                        required
                        disabled={isEdit}
                      />
                    </div>
                  </div>
                </div>

                {/* Duration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>
                      Duration <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="duration"
                      value={form.duration}
                      onChange={handleChange}
                      className={inputCls}
                      disabled={isEdit}
                    >
                      <option value="once">Once (first invoice only)</option>
                      <option value="repeating">Repeating (X months)</option>
                      <option value="forever">Forever</option>
                    </select>
                  </div>
                  {form.duration === "repeating" && (
                    <div>
                      <label className={labelCls}>
                        Months <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="durationInMonths"
                        type="number"
                        min="1"
                        max="36"
                        value={form.durationInMonths}
                        onChange={handleChange}
                        className={inputCls}
                        placeholder="e.g. 3"
                        required={form.duration === "repeating"}
                        disabled={isEdit}
                      />
                    </div>
                  )}
                </div>

                {/* Plan Restrictions */}
                <div>
                  <label className={labelCls}>
                    Plan Restrictions
                  </label>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                    Leave all unchecked to allow this coupon on any plan.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {plans.map((plan) => (
                      <label
                        key={plan.id}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                          form.planIds.includes(plan.id)
                            ? "bg-violet-50 dark:bg-violet-500/10 border-violet-300 dark:border-violet-500/30 text-violet-700 dark:text-violet-300"
                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.planIds.includes(plan.id)}
                          onChange={() => handlePlanToggle(plan.id)}
                          className="sr-only"
                        />
                        {plan.name}
                        <span className="text-xs text-gray-400">({plan.targetRole})</span>
                      </label>
                    ))}
                    {plans.length === 0 && (
                      <span className="text-sm text-gray-400">No plans found.</span>
                    )}
                  </div>
                </div>

                {/* Max Redemptions (general only) + Expiry */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {!isUnique && (
                    <div>
                      <label className={labelCls}>Max Redemptions</label>
                      <input
                        name="maxRedemptions"
                        type="number"
                        min="1"
                        value={form.maxRedemptions}
                        onChange={handleChange}
                        className={inputCls}
                        placeholder="Unlimited"
                      />
                      <p className="text-xs text-gray-400 mt-1">Leave empty for unlimited.</p>
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Expiration Date</label>
                    <input
                      name="expiresAt"
                      type="datetime-local"
                      value={form.expiresAt}
                      onChange={handleChange}
                      className={inputCls}
                    />
                    <p className="text-xs text-gray-400 mt-1">Leave empty for no expiration.</p>
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={form.isActive}
                      onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                  </label>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {form.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Submit */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700/60">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : null}
                    {isEdit
                      ? "Save Changes"
                      : isUnique
                        ? `Generate ${form.quantity || ""} Codes`
                        : "Create Coupon"}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/${accountUrl}/coupons`)}
                    className="btn border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                </div>

                {/* Redemptions Table (edit only) */}
                {isEdit && redemptions.length > 0 && (
                  <div className="mt-8">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
                      Redemptions ({redemptions.length})
                    </h2>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-xl overflow-hidden">
                      <table className="table-auto w-full text-sm">
                        <thead className="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20">
                          <tr>
                            <th className="px-4 py-2 text-left">Account</th>
                            <th className="px-4 py-2 text-left">User</th>
                            <th className="px-4 py-2 text-left">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700/60">
                          {redemptions.map((r) => (
                            <tr key={r.id}>
                              <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                                {r.accountName || `#${r.accountId}`}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {r.userEmail || `#${r.userId}`}
                              </td>
                              <td className="px-4 py-2 text-gray-500">
                                {r.redeemedAt ? new Date(r.redeemedAt).toLocaleString() : "\u2014"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default CouponForm;
