import React, {useState, useEffect, useRef, useCallback} from "react";
import {useParams, useNavigate} from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  MapPin,
  Briefcase,
  Globe,
  Phone,
  Mail,
  Bookmark,
  BookmarkCheck,
  MessageSquare,
  Share2,
  Languages,
  Award,
  Camera,
  CalendarCheck,
  CheckCircle2,
  Send,
  ShieldCheck,
} from "lucide-react";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AppApi from "../../api/api";
import {normalizeProfessional} from "./utils/normalizeProfessional";

const TABS = [
  {id: "about", label: "About"},
  {id: "projects", label: "Projects"},
  {id: "credentials", label: "Credentials"},
  {id: "reviews", label: "Reviews"},
];

function ProfessionalProfile() {
  const {proId} = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("about");
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || "";
  const [professional, setProfessional] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!proId) {
      setProfessional(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    AppApi.getProfessional(proId)
      .then((data) => {
        const norm = normalizeProfessional(data);
        if (norm) {
          setProfessional({
            ...norm,
            projectPhotos: norm.projectPhotos?.length
              ? norm.projectPhotos
              : [{id: "profile", url: norm.photoUrl, caption: "Profile"}],
          });
        } else {
          setProfessional(null);
        }
      })
      .catch((err) => {
        setError(err?.message || "Failed to load professional");
        setProfessional(null);
      })
      .finally(() => setLoading(false));
  }, [proId]);

  const fetchReviewsAndEligibility = useCallback(() => {
    if (!proId) return;
    setReviewsLoading(true);
    Promise.all([
      AppApi.getProfessionalReviews(proId),
      AppApi.getProfessionalReviewEligibility(proId),
    ])
      .then(([reviewsData, eligibility]) => {
        setReviews(reviewsData.reviews ?? []);
        setReviewsAggregate(reviewsData.aggregate ?? { count: 0, avgRating: 0 });
        setReviewEligibility(eligibility ?? {});
      })
      .catch(() => {
        setReviews([]);
        setReviewsAggregate({ count: 0, avgRating: 0 });
        setReviewEligibility(null);
      })
      .finally(() => setReviewsLoading(false));
  }, [proId]);

  const handleSubmitReview = async () => {
    if (!proId || reviewForm.rating < 1 || reviewForm.rating > 5) return;
    setReviewError(null);
    setReviewSubmitting(true);
    try {
      await AppApi.createProfessionalReview(proId, {
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim() || null,
      });
      setReviewForm({ rating: 0, comment: "" });
      fetchReviewsAndEligibility();
    } catch (err) {
      setReviewError(err?.message || err?.messages?.[0] || "Failed to submit review");
    } finally {
      setReviewSubmitting(false);
    }
  };

  useEffect(() => {
    if (!proId) return;
    fetchReviewsAndEligibility();
  }, [proId, fetchReviewsAndEligibility]);

  const [saved, setSaved] = useState(professional?.saved ?? false);
  const [saveToast, setSaveToast] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messageSent, setMessageSent] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);

  const [reviews, setReviews] = useState([]);
  const [reviewsAggregate, setReviewsAggregate] = useState({ count: 0, avgRating: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewEligibility, setReviewEligibility] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: "" });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  const sectionRefs = useRef({});
  const tabBarRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const isScrollingFromClick = useRef(false);

  const registerRef = useCallback(
    (id) => (el) => {
      if (el) sectionRefs.current[id] = el;
    },
    [],
  );

  const scrollToSection = useCallback((tabId) => {
    const el = sectionRefs.current[tabId];
    const container = scrollContainerRef.current;
    if (!el || !container) return;

    isScrollingFromClick.current = true;
    setActiveTab(tabId);

    const elTop = el.getBoundingClientRect().top;
    const containerTop = container.getBoundingClientRect().top;
    const offset = elTop - containerTop + container.scrollTop - 16;

    container.scrollTo({top: offset, behavior: "smooth"});
    setTimeout(() => {
      isScrollingFromClick.current = false;
    }, 800);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isScrollingFromClick.current) return;
      const containerRect = container.getBoundingClientRect();
      const threshold = containerRect.top + 120;

      let current = TABS[0].id;
      for (const tab of TABS) {
        const el = sectionRefs.current[tab.id];
        if (el && el.getBoundingClientRect().top <= threshold) current = tab.id;
      }
      setActiveTab(current);
    };

    container.addEventListener("scroll", handleScroll, {passive: true});
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSave = () => {
    const next = !saved;
    setSaved(next);
    if (next) {
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    }
  };

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    setMessageSent(true);
    setTimeout(() => setMessageSent(false), 3000);
    setMessageText("");
  };

  if (loading) {
    return (
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className="grow flex items-center justify-center">
            <div className="text-center text-gray-500 dark:text-gray-400">
              Loading professional...
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!professional || error) {
    return (
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className="grow flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Professional not found
              </h2>
              {error && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={() =>
                  navigate(accountUrl ? `/${accountUrl}/professionals` : "/professionals")
                }
                className="text-sm font-medium text-[#456564] hover:text-[#34514f] transition-colors"
              >
                Back to Directory
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const photos = professional.projectPhotos;
  const prevSlide = () =>
    setCarouselIdx((i) => (i === 0 ? photos.length - 1 : i - 1));
  const nextSlide = () =>
    setCarouselIdx((i) => (i === photos.length - 1 ? 0 : i + 1));

  const displayRating = reviewsAggregate.count > 0
    ? reviewsAggregate.avgRating
    : (professional.rating || 0);
  const displayReviewCount = reviewsAggregate.count > 0
    ? reviewsAggregate.count
    : (professional.reviewCount || 0);
  const stars = Array.from({length: 5}, (_, i) => ({
    filled: i < Math.floor(displayRating),
    half: i >= Math.floor(displayRating) && i < displayRating,
    key: i,
  }));

  const mockReviews = [
    {
      id: 1,
      author: "Sarah M.",
      rating: 5,
      date: "2 weeks ago",
      text: "Exceptional work! They completely transformed our kitchen. Professional, on time, and within budget. Highly recommended.",
    },
    {
      id: 2,
      author: "James T.",
      rating: 5,
      date: "1 month ago",
      text: "Great attention to detail. Communicated well throughout the project and the results exceeded our expectations.",
    },
    {
      id: 3,
      author: "Maria L.",
      rating: 4,
      date: "2 months ago",
      text: "Very happy with the outcome. Minor delays due to material sourcing but the final result was worth the wait.",
    },
    {
      id: 4,
      author: "Robert K.",
      rating: 5,
      date: "3 months ago",
      text: "Second time working with this team and they continue to impress. Quality craftsmanship at a fair price.",
    },
  ];

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div
        ref={scrollContainerRef}
        className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden scroll-smooth bg-gray-50 dark:bg-gray-950"
      >
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="w-full max-w-6xl mx-auto px-0 sm:px-4 lg:px-5 xxl:px-12 pt-4 pb-16">
            {/* Breadcrumb */}
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-600 mb-4 pl-0 focus:outline-none shadow-none"
            >
              <svg
                className="fill-current shrink-0 mr-1"
                width="18"
                height="18"
                viewBox="0 0 18 18"
              >
                <path d="M9.4 13.4l1.4-1.4-4-4 4-4-1.4-1.4L4 8z" />
              </svg>
              <span className="text-lg">Professionals</span>
            </button>

            {/* ═══ Hero Carousel ═══ */}
            <div className="relative rounded-t-2xl overflow-hidden bg-gray-900 aspect-[21/7] group">
              {photos.map((photo, idx) => (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={photo.caption}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                    idx === carouselIdx ? "opacity-100" : "opacity-0"
                  }`}
                  loading={idx === 0 ? "eager" : "lazy"}
                />
              ))}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevSlide}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 dark:bg-gray-900/90 flex items-center justify-center text-gray-700 dark:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-white"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={nextSlide}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 dark:bg-gray-900/90 flex items-center justify-center text-gray-700 dark:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-white"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {photos.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCarouselIdx(idx)}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === carouselIdx
                            ? "bg-white w-6"
                            : "bg-white/40 w-1.5 hover:bg-white/60"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}

              <div className="absolute top-3 right-3 flex items-center gap-1.5 text-xs font-medium text-white/90 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-md">
                <Camera className="w-3.5 h-3.5" />
                {photos.length}
              </div>
            </div>

            {/* ═══ Profile Info + Message (two separate cards, side by side) ═══ */}
            <div className="relative -mt-10 sm:-mt-12 z-10 mx-2 sm:mx-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Profile Info Card */}
                <div className="flex-1 min-w-0 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700/50 shadow-lg p-5 sm:p-6">
                  <div className="flex gap-4 sm:gap-5">
                    <img
                      src={professional.photoUrl}
                      alt={professional.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover ring-2 ring-white dark:ring-gray-700 shadow-md shrink-0"
                    />
                    <div className="min-w-0">
                      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight truncate">
                        {professional.name}
                      </h1>
                      <p className="text-sm sm:text-base text-[#456564] dark:text-[#7aa3a2] font-semibold mt-0.5 truncate">
                        {professional.companyName}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="inline-flex items-center text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {professional.categoryName}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {stars.map((s) => (
                            <Star
                              key={s.key}
                              className={`w-3.5 h-3.5 ${
                                s.filled
                                  ? "fill-amber-400 text-amber-400"
                                  : s.half
                                    ? "fill-amber-400/50 text-amber-400"
                                    : "fill-gray-200 dark:fill-gray-600 text-gray-200"
                              }`}
                            />
                          ))}
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 ml-1">
                            {displayRating}
                          </span>
                          <span className="text-xs text-gray-400 ml-0.5">
                            ({displayReviewCount})
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="w-3 h-3" />
                          Verified
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap mt-5 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                    <button
                      type="button"
                      onClick={handleSave}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 ${
                        saved
                          ? "border-[#456564] bg-[#456564] text-white dark:border-[#7aa3a2] dark:bg-[#7aa3a2] dark:text-gray-900"
                          : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-[#456564] hover:text-[#456564] dark:hover:border-[#7aa3a2] dark:hover:text-[#7aa3a2] bg-white dark:bg-gray-800"
                      }`}
                    >
                      {saved ? (
                        <BookmarkCheck className="w-3.5 h-3.5" />
                      ) : (
                        <Bookmark className="w-3.5 h-3.5" />
                      )}
                      {saved ? "Saved" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-[#456564] hover:text-[#456564] dark:hover:border-[#7aa3a2] dark:hover:text-[#7aa3a2] bg-white dark:bg-gray-800 transition-all duration-200"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Share
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-[#456564] hover:text-[#456564] dark:hover:border-[#7aa3a2] dark:hover:text-[#7aa3a2] bg-white dark:bg-gray-800 transition-all duration-200"
                      >
                        <CalendarCheck className="w-3.5 h-3.5" />
                        Schedule
                      </button>
                      <span className="absolute -top-2 -right-1.5 text-[8px] font-bold leading-none bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 px-1 py-0.5 rounded-full whitespace-nowrap ring-1 ring-white dark:ring-gray-800">
                        Soon
                      </span>
                    </div>
                  </div>
                </div>

                {/* Message Card (desktop) */}
                <div className="hidden lg:block lg:w-[320px] shrink-0 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700/50 shadow-lg p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-[#456564]" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      Contact {professional.companyName}
                    </h3>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">
                    Describe your project — typical response within 24 hrs
                  </p>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    rows={3}
                    placeholder="Hi, I'm looking for help with a project..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] focus:bg-white dark:focus:bg-gray-800 transition-all resize-none"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!messageText.trim()}
                    className="w-full mt-2.5 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#456564] text-white hover:bg-[#34514f] shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send Message
                  </button>
                  {messageSent && (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 mt-2">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      Sent! You'll hear back soon.
                    </div>
                  )}
                </div>

                {/* Message Card (mobile) */}
                <div className="lg:hidden bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700/50 shadow-lg p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-[#456564]" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      Contact {professional.companyName}
                    </h3>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">
                    Describe your project — typical response within 24 hrs
                  </p>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    rows={3}
                    placeholder="Hi, I'm looking for help with a project..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] focus:bg-white dark:focus:bg-gray-800 transition-all resize-none"
                  />
                  <div className="flex items-center gap-3 mt-2.5">
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={!messageText.trim()}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-[#456564] text-white hover:bg-[#34514f] shadow-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send Message
                    </button>
                    {messageSent && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Sent!
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ Tab Navigation (static, left-aligned, attached to content) ═══ */}
            <div ref={tabBarRef} className="mt-8">
              <div className="bg-white dark:bg-gray-800 border border-b-0 border-gray-200/60 dark:border-gray-700/50 rounded-t-xl px-5 sm:px-6">
                <nav className="flex gap-6">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => scrollToSection(tab.id)}
                      className={`py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === tab.id
                          ? "border-[#456564] text-[#456564] dark:text-[#7aa3a2] dark:border-[#7aa3a2]"
                          : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* ═══ Content Sections ═══ */}
            <div className="space-y-6">
              {/* ── About (first section, attached to tabs) ── */}
              <section ref={registerRef("about")} id="section-about">
                <div className="bg-white dark:bg-gray-800 rounded-b-xl border border-t-0 border-gray-200/60 dark:border-gray-700/50 shadow-sm p-5 sm:p-6">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">
                    About
                  </h2>
                  {professional.description ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {professional.description}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-500 italic">
                      No description provided.
                    </p>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-gray-100 dark:border-gray-700">
                    {[
                      {
                        value: professional.yearsInBusiness,
                        label: "Years in Business",
                      },
                      {value: displayReviewCount, label: "Reviews"},
                      {value: photos.length, label: "Projects"},
                      {
                        value: displayRating,
                        label: "Rating",
                        accent: true,
                      },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center">
                        <p
                          className={`text-2xl font-bold ${stat.accent ? "text-[#456564] dark:text-[#7aa3a2]" : "text-gray-900 dark:text-white"}`}
                        >
                          {stat.value}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* ── Projects ── */}
              <section ref={registerRef("projects")} id="section-projects">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 shadow-sm p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">
                      Project Photos
                    </h2>
                    <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                      {photos.length} photos
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative aspect-[4/3] rounded-lg overflow-hidden group cursor-pointer"
                      >
                        <img
                          src={photo.url}
                          alt={photo.caption}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end">
                          <div className="w-full p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-[11px] text-white font-medium">
                              {photo.caption}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* ── Credentials ── */}
              <section
                ref={registerRef("credentials")}
                id="section-credentials"
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 shadow-sm p-5 sm:p-6">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white mb-5">
                    Credentials & Contact
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      {
                        icon: Briefcase,
                        label: "Experience",
                        value: `${professional.yearsInBusiness} years in business`,
                      },
                      {
                        icon: MapPin,
                        label: "Service Area",
                        value: professional.serviceArea,
                      },
                      {
                        icon: Languages,
                        label: "Languages",
                        value: (professional.languages || []).join(", ") || "—",
                      },
                      {
                        icon: Award,
                        label: "License",
                        value: "Licensed & Insured",
                      },
                      {
                        icon: Phone,
                        label: "Phone",
                        value: professional.phone,
                        href: `tel:${professional.phone}`,
                      },
                      {
                        icon: Mail,
                        label: "Email",
                        value: professional.email,
                        href: `mailto:${professional.email}`,
                      },
                      {
                        icon: Globe,
                        label: "Website",
                        value: "Visit Website",
                        href: professional.website,
                        external: true,
                      },
                      {
                        icon: MapPin,
                        label: "Location",
                        value: professional.serviceArea,
                      },
                    ].map((item, idx) => {
                      const Icon = item.icon;
                      const inner = (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#456564]/10 flex items-center justify-center shrink-0">
                            <Icon className="w-3.5 h-3.5 text-[#456564] dark:text-[#7aa3a2]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider leading-none mb-0.5">
                              {item.label}
                            </p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {item.value}
                            </p>
                          </div>
                        </div>
                      );
                      if (item.href) {
                        return (
                          <a
                            key={idx}
                            href={item.href}
                            target={item.external ? "_blank" : undefined}
                            rel={
                              item.external ? "noopener noreferrer" : undefined
                            }
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/30 -mx-2 -my-1.5 px-2 py-1.5 rounded-lg transition-colors"
                          >
                            {inner}
                          </a>
                        );
                      }
                      return <div key={idx}>{inner}</div>;
                    })}
                  </div>
                </div>
              </section>

              {/* ── Reviews ── */}
              <section ref={registerRef("reviews")} id="section-reviews">
                <div className="space-y-4">
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 shadow-sm p-5 sm:p-6">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white mb-5">
                      Reviews
                    </h2>
                    {reviewsLoading ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Loading reviews...
                      </p>
                    ) : (
                      <>
                        <div className="flex items-start gap-6">
                          <div className="text-center shrink-0">
                            <p className="text-4xl font-bold text-gray-900 dark:text-white">
                              {displayRating || "—"}
                            </p>
                            <div className="flex items-center gap-0.5 mt-1.5 justify-center">
                              {stars.map((s) => (
                                <Star
                                  key={s.key}
                                  className={`w-3.5 h-3.5 ${
                                    s.filled
                                      ? "fill-amber-400 text-amber-400"
                                      : "fill-gray-200 dark:fill-gray-600 text-gray-200"
                                  }`}
                                />
                              ))}
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1">
                              {displayReviewCount} {displayReviewCount === 1 ? "review" : "reviews"}
                            </p>
                          </div>
                          {reviews.length > 0 && (
                            <div className="flex-1 space-y-1.5">
                              {[5, 4, 3, 2, 1].map((n) => {
                                const count = reviews.filter((r) => r.rating === n).length;
                                const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
                                return (
                                  <div key={n} className="flex items-center gap-2">
                                    <span className="text-[11px] text-gray-400 w-3 text-right">
                                      {n}
                                    </span>
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-amber-400 rounded-full transition-all"
                                        style={{width: `${pct}%`}}
                                      />
                                    </div>
                                    <span className="text-[11px] text-gray-400 w-8">
                                      {pct}%
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {reviewEligibility?.canReview && (
                          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                              Write a review
                            </h3>
                            {reviewError && (
                              <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                                {reviewError}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 mb-3">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setReviewForm((f) => ({...f, rating: n}))}
                                  className={`p-1.5 rounded transition-colors ${
                                    reviewForm.rating >= n
                                      ? "text-amber-500 hover:text-amber-600"
                                      : "text-gray-300 dark:text-gray-600 hover:text-amber-400"
                                  }`}
                                >
                                  <Star
                                    className={`w-6 h-6 ${
                                      reviewForm.rating >= n ? "fill-current" : ""
                                    }`}
                                  />
                                </button>
                              ))}
                            </div>
                            <textarea
                              value={reviewForm.comment}
                              onChange={(e) =>
                                setReviewForm((f) => ({...f, comment: e.target.value}))
                              }
                              placeholder="Share your experience (optional)"
                              rows={3}
                              className="form-input w-full text-sm mb-3"
                            />
                            <button
                              type="button"
                              onClick={handleSubmitReview}
                              disabled={
                                reviewForm.rating < 1 ||
                                reviewSubmitting
                              }
                              className="btn bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50"
                            >
                              {reviewSubmitting ? "Submitting..." : "Submit Review"}
                            </button>
                          </div>
                        )}
                        {reviewEligibility?.alreadyReviewed && !reviewEligibility?.canReview && (
                          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                            You have already submitted a review for this professional.
                          </p>
                        )}
                        {reviewEligibility && !reviewEligibility.canReview && !reviewEligibility.alreadyReviewed && reviewEligibility.hasCompletedWork === false && (
                          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                            Complete at least one maintenance appointment with this professional to leave a review.
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {reviews.length === 0 && !reviewsLoading && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 shadow-sm p-8 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No reviews yet.
                      </p>
                    </div>
                  )}

                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 shadow-sm p-5"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#456564]/10 flex items-center justify-center text-xs font-bold text-[#456564]">
                            {(review.authorName || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {review.authorName || "Anonymous"}
                            </p>
                            <div className="flex items-center gap-0.5">
                              {Array.from({length: 5}, (_, i) => (
                                <Star
                                  key={i}
                                  className={`w-2.5 h-2.5 ${
                                    i < review.rating
                                      ? "fill-amber-400 text-amber-400"
                                      : "fill-gray-200 dark:fill-gray-600 text-gray-200"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] text-gray-400">
                          {review.createdAt
                            ? new Date(review.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : ""}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </main>

        {/* Save Confirmation Toast */}
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
            saveToast
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          <div className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
            Professional has been added to your list.
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfessionalProfile;
