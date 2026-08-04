"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase, type User as AuthUser } from "@/lib/supabase";
import {
  BookOpen,
  Search,
  MapPin,
  ChevronDown,
  PlusCircle,
  ShoppingCart,
  LogIn,
  LogOut,
  MessageCircle,
  X,
  Send,
  Sparkles,
  GraduationCap,
  Library,
  Store,
  User,
} from "lucide-react";

const FILTER_OPTIONS = ["Buy", "Rent", "Coaching Notes", "School Books"] as const;

const CATEGORY_BADGES = [
  "Coaching Notes",
  "Rent Books",
  "School Textbooks",
  "Novels & Fiction",
  "College Materials",
] as const;

type ListingTag = "For Sale" | "For Rent";
type SellerType = "Individual" | "Local Bookstore" | "Library";

const LISTING_CATEGORIES = [
  "School Textbooks",
  "Coaching Notes",
  "Novels",
  "College Materials",
] as const;

const LISTING_CONDITIONS = ["New", "Like New", "Good", "Annotated"] as const;

const SELLER_TYPES: SellerType[] = ["Individual", "Local Bookstore", "Library"];

const IMAGE_ACCENTS = [
  "from-violet-500 to-purple-700",
  "from-amber-400 to-orange-600",
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-blue-700",
  "from-rose-500 to-pink-700",
  "from-indigo-500 to-violet-700",
] as const;

type Listing = {
  id: string;
  title: string;
  category: string;
  condition: string;
  tag: ListingTag;
  price: string | number;
  sellerType: SellerType;
  imageAccent: string;
  description?: string;
  listing_type?: string;
  [key: string]: any; // Allows dynamic access to additional database fields
};

type DbListing = {
  id: string;
  title: string;
  category: string;
  listing_type: string;
  condition: string;
  price: string;
  seller_type: string;
  location: string;
};

type ListItemForm = {
  title: string;
  category: (typeof LISTING_CATEGORIES)[number];
  listingType: ListingTag;
  condition: (typeof LISTING_CONDITIONS)[number];
  price: string;
  sellerType: SellerType;
  location: string;
};

const INITIAL_LIST_FORM: ListItemForm = {
  title: "",
  category: "School Textbooks",
  listingType: "For Sale",
  condition: "Good",
  price: "",
  sellerType: "Individual",
  location: "",
};

function accentForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash + id.charCodeAt(i)) % IMAGE_ACCENTS.length;
  }
  return IMAGE_ACCENTS[hash];
}

function normalizeSellerType(value: string): SellerType {
  if (value === "Bookstore" || value === "Local Bookstore") {
    return "Local Bookstore";
  }
  if (value === "Library") return "Library";
  return "Individual";
}

function mapDbListing(row: DbListing): Listing {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    condition: row.condition,
    tag: row.listing_type as ListingTag,
    price: row.price,
    sellerType: normalizeSellerType(row.seller_type),
    imageAccent: accentForId(row.id),
  };
}

type ChatMessage = { from: "bot" | "user"; text: string };

const INITIAL_CHAT: ChatMessage[] = [
  {
    from: "bot",
    text: "Hi! I'm Bookkart Help. Ask about buying, renting, listing items, or delivery near you.",
  },
];

function SellerIcon({ type }: { type: SellerType }) {
  if (type === "Library") return <Library className="size-3.5 shrink-0" />;
  if (type === "Local Bookstore") return <Store className="size-3.5 shrink-0" />;
  return <User className="size-3.5 shrink-0" />;
}

function emailAvatarLabel(email: string | undefined) {
  if (!email) return "?";
  const local = email.split("@")[0] ?? email;
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  return local.slice(0, 1).toUpperCase();
}

type AuthTab = "signin" | "signup";

export default function Home() {
  const [filter, setFilter] = useState<(typeof FILTER_OPTIONS)[number]>("Buy");
  const [locationOpen, setLocationOpen] = useState(false);
  const [location, setLocation] = useState("Near Me");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [listForm, setListForm] = useState<ListItemForm>(INITIAL_LIST_FORM);
  const [listFormError, setListFormError] = useState<string | null>(null);
  const [listSubmitting, setListSubmitting] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [pendingListAfterAuth, setPendingListAfterAuth] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !pendingListAfterAuth) return;
    setPendingListAfterAuth(false);
    setListForm(INITIAL_LIST_FORM);
    setListFormError(null);
    setListModalOpen(true);
  }, [user, pendingListAfterAuth]);

  const fetchListings = useCallback(async () => {
    setListingsLoading(true);
    setListingsError(null);

    const { data, error } = await supabase
      .from("listings")
      .select(
        "id, title, category, listing_type, condition, price, seller_type, location",
      )
      .order("id", { ascending: false });

    if (error) {
      setListingsError(error.message);
      setListings([]);
    } else {
      setListings((data as DbListing[]).map(mapDbListing));
    }

    setListingsLoading(false);
  }, []);

  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

  function openAuthModal(tab: AuthTab = "signin") {
    setAuthTab(tab);
    setAuthEmail("");
    setAuthPassword("");
    setAuthError(null);
    setAuthModalOpen(true);
  }

  function closeAuthModal() {
    if (authSubmitting) return;
    setAuthModalOpen(false);
    setAuthError(null);
    setPendingListAfterAuth(false);
  }

  async function submitAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthError(null);

    const email = authEmail.trim();
    const password = authPassword;

    if (!email || !password) {
      setAuthError("Email and password are required.");
      return;
    }

    setAuthSubmitting(true);

    if (authTab === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setAuthSubmitting(false);
      if (error) {
        setAuthError(error.message);
        return;
      }
      setAuthModalOpen(false);
      setAuthPassword("");
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    setAuthSubmitting(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    if (data.session) {
      setAuthModalOpen(false);
      setAuthPassword("");
      return;
    }

    setAuthError(
      "Account created. Check your email to confirm your address, then sign in.",
    );
    setAuthTab("signin");
    setAuthPassword("");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  function requestListItem() {
    if (!user) {
      setPendingListAfterAuth(true);
      openAuthModal("signin");
      return;
    }
    openListModal();
  }

  function openListModal() {
    setListForm(INITIAL_LIST_FORM);
    setListFormError(null);
    setListModalOpen(true);
  }

  function closeListModal() {
    if (listSubmitting) return;
    setListModalOpen(false);
    setListFormError(null);
  }

  async function submitListItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setListFormError(null);

    const trimmedTitle = listForm.title.trim();
    const trimmedPrice = listForm.price.trim();
    const trimmedLocation = listForm.location.trim();

    if (!trimmedTitle || !trimmedPrice || !trimmedLocation) {
      setListFormError("Title, price, and location are required.");
      return;
    }

    setListSubmitting(true);

    const {
      data: { user: currentUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !currentUser) {
      setListSubmitting(false);
      setListFormError("You must be signed in to publish a listing.");
      return;
    }

    const { error } = await supabase.from("listings").insert({
      title: trimmedTitle,
      category: listForm.category,
      listing_type: listForm.listingType,
      condition: listForm.condition,
      price: trimmedPrice,
      seller_type: listForm.sellerType,
      location: trimmedLocation,
      user_id: currentUser.id,
    });

    setListSubmitting(false);

    if (error) {
      setListFormError(error.message);
      return;
    }

    setListModalOpen(false);
    setListForm(INITIAL_LIST_FORM);
    await fetchListings();
  }

  function sendChatMessage() {
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { from: "user", text: trimmed }]);
    setChatInput("");

    const lower = trimmed.toLowerCase();
    let reply =
      "Thanks for reaching out! Our team will follow up shortly. You can also browse listings or use List Item / Sell to post your books.";

    if (lower.includes("rent")) {
      reply =
        "Use the filter set to Rent or tap Rent Books badges to find weekly and monthly rentals from libraries and individuals.";
    } else if (lower.includes("sell") || lower.includes("list")) {
      reply =
        'Click "List Item / Sell" in the navbar to create a listing. Add photos, condition, and whether it\'s for sale or rent.';
    } else if (lower.includes("delivery") || lower.includes("city")) {
      reply =
        'Open the location selector (Near Me / Select City) to set your area and see nearby sellers.';
    }

    setTimeout(() => {
      setMessages((prev) => [...prev, { from: "bot", text: reply }]);
    }, 400);
  }
  const filteredListings = listings.filter((item) => {
    const matchesSearch =
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      selectedType === "All" ||
      item.listing_type?.toLowerCase() === selectedType.toLowerCase();

    const matchesCategory =
      selectedCategory === "All" ||
      item.category?.toLowerCase() === selectedCategory.toLowerCase();

    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:gap-6 lg:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/30">
              <BookOpen className="size-5" strokeWidth={2.25} />
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Bookkart
            </span>
          </Link>

          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex flex-1 items-stretch overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
              <label className="sr-only" htmlFor="search-filter">
                Listing type
              </label>
              <select
                id="search-filter"
                value={filter}
                onChange={(e) =>
                  setFilter(e.target.value as (typeof FILTER_OPTIONS)[number])
                }
                className="cursor-pointer border-r border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
              >
                {FILTER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="search-query">
                Search books and materials
              </label>
              <input
                id="search-query"
                type="search"
                placeholder={`Search ${filter.toLowerCase()}…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                className="flex items-center justify-center bg-emerald-600 px-4 text-white transition hover:bg-emerald-700"
                aria-label="Search"
              >
                <Search className="size-4" />
              </button>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setLocationOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 sm:w-auto sm:min-w-[180px]"
                aria-expanded={locationOpen}
                aria-haspopup="listbox"
              >
                <span className="flex items-center gap-2">
                  <MapPin className="size-4 text-emerald-600" />
                  {location}
                </span>
                <ChevronDown
                  className={`size-4 text-slate-400 transition ${locationOpen ? "rotate-180" : ""}`}
                />
              </button>
              {locationOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="Close location menu"
                    onClick={() => setLocationOpen(false)}
                  />
                  <ul
                    role="listbox"
                    className="absolute right-0 z-20 mt-1 w-full min-w-[200px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg sm:w-56"
                  >
                    {["Near Me", "Select City…", "Mumbai", "Delhi NCR", "Bangalore", "Hyderabad"].map(
                      (loc) => (
                        <li key={loc}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={location === loc}
                            onClick={() => {
                              setLocation(loc === "Select City…" ? "Select City" : loc);
                              setLocationOpen(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-emerald-50 hover:text-emerald-800"
                          >
                            {loc}
                          </button>
                        </li>
                      ),
                    )}
                  </ul>
                </>
              )}
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={requestListItem}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <PlusCircle className="size-4" />
              <span className="hidden sm:inline">List Item / Sell</span>
              <span className="sm:hidden">Sell</span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              aria-label="Cart"
            >
              <ShoppingCart className="size-4" />
              <span className="hidden md:inline">Cart</span>
            </button>
            {authLoading ? (
              <span
                className="inline-flex h-[38px] min-w-[88px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400"
                aria-hidden
              >
                …
              </span>
            ) : user ? (
              <>
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white ring-2 ring-white"
                  title={user.email ?? "Signed in"}
                  aria-label={user.email ? `Signed in as ${user.email}` : "Signed in"}
                >
                  {emailAvatarLabel(user.email)}
                </span>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal("signin")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <LogIn className="size-4" />
                Login
              </button>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(16,185,129,0.4) 0%, transparent 40%)",
            }}
          />
          <div className="relative mx-auto max-w-7xl px-4 py-16 lg:px-6 lg:py-20">
            <div className="flex max-w-3xl flex-col gap-6">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-emerald-100">
                <Sparkles className="size-3.5" />
                Your campus book marketplace
              </p>
              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-[3.25rem]">
                Buy, sell & rent books and study materials — all in one place.
              </h1>
              <p className="text-lg text-emerald-100/90 sm:text-xl">
                From JEE coaching notes to college textbooks and weekend novels —
                find trusted sellers, libraries, and bookstores near you.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {CATEGORY_BADGES.map((badge) => (
                  <button
                    key={badge}
                    type="button"
                    className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-sm transition hover:bg-white/20"
                  >
                    {badge}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Featured listings
              </h2>
              <p className="mt-1 text-slate-600">
                Live items from our community — coaching notes, rentals, and textbooks.
              </p>
            </div>
            <p className="text-sm text-slate-500">
              Showing results for{" "}
              <span className="font-medium text-emerald-700">{filter}</span>
              {location !== "Select City" && (
                <>
                  {" "}
                  near{" "}
                  <span className="font-medium text-emerald-700">{location}</span>
                </>
              )}
            </p>
          </div>

          {listingsError && (
            <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              Could not load listings: {listingsError}
            </p>
          )}

          {listingsLoading ? (
            <p className="text-center text-slate-500">Loading listings…</p>
          ) : listings.length === 0 && !listingsError ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-slate-600">
              No listings yet. Be the first to{" "}
              <button
                type="button"
                onClick={requestListItem}
                className="font-semibold text-emerald-700 underline-offset-2 hover:underline"
              >
                list an item
              </button>
              .
            </p>
          ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredListings.map((item) => (
              <li key={item.id}>
                <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-200 hover:shadow-md">
                  <div
                    className={`relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br ${item.imageAccent}`}
                  >
                    <BookOpen className="size-16 text-white/40 transition group-hover:scale-105 group-hover:text-white/55" />
                    <span
                      className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${
                        item.tag === "For Rent"
                          ? "bg-sky-600 text-white"
                          : "bg-amber-500 text-amber-950"
                      }`}
                    >
                      {item.tag}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {item.category}
                      </span>
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        {item.condition}
                      </span>
                    </div>
                    <h3 className="line-clamp-2 text-base font-semibold leading-snug text-slate-900">
                      {item.title}
                    </h3>
                    <div className="mt-auto flex items-end justify-between gap-2 pt-1">
                      <p className="text-lg font-bold text-emerald-700">{item.price}</p>
                      <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        <SellerIcon type={item.sellerType} />
                        {item.sellerType}
                      </span>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
          )}
        </section>

        <section className="border-t border-slate-200 bg-white py-12">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 text-center lg:px-6">
            <GraduationCap className="size-10 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900">
              Ready to declutter your shelf or find your next read?
            </h2>
            <p className="max-w-lg text-slate-600">
              List unused books in minutes or explore rentals from libraries and peers
              — Bookkart connects learners across cities.
            </p>
            <button
              type="button"
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Start browsing
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-100 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Bookkart. Buy · Rent · Sell study materials.
      </footer>

      {listModalOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm"
            aria-label="Close list item form"
            onClick={closeListModal}
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="list-item-title"
              className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 id="list-item-title" className="text-lg font-bold text-slate-900">
                  List an item
                </h2>
                <button
                  type="button"
                  onClick={closeListModal}
                  disabled={listSubmitting}
                  className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              </div>
              <form onSubmit={submitListItem} className="flex flex-col gap-4 p-5">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">Title</span>
                  <input
                    type="text"
                    required
                    value={listForm.title}
                    onChange={(e) =>
                      setListForm((f) => ({ ...f, title: e.target.value }))
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="e.g. NCERT Mathematics Class 12"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">Category</span>
                  <select
                    value={listForm.category}
                    onChange={(e) =>
                      setListForm((f) => ({
                        ...f,
                        category: e.target.value as ListItemForm["category"],
                      }))
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {LISTING_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">Listing type</span>
                  <select
                    value={listForm.listingType}
                    onChange={(e) =>
                      setListForm((f) => ({
                        ...f,
                        listingType: e.target.value as ListingTag,
                      }))
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="For Sale">For Sale</option>
                    <option value="For Rent">For Rent</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">Condition</span>
                  <select
                    value={listForm.condition}
                    onChange={(e) =>
                      setListForm((f) => ({
                        ...f,
                        condition: e.target.value as ListItemForm["condition"],
                      }))
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {LISTING_CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">
                    Price (or rental rate per day/week)
                  </span>
                  <input
                    type="text"
                    required
                    value={listForm.price}
                    onChange={(e) =>
                      setListForm((f) => ({ ...f, price: e.target.value }))
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="e.g. ₹320 or ₹49/week"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">Seller type</span>
                  <select
                    value={listForm.sellerType}
                    onChange={(e) =>
                      setListForm((f) => ({
                        ...f,
                        sellerType: e.target.value as SellerType,
                      }))
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {SELLER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">Location / city</span>
                  <input
                    type="text"
                    required
                    value={listForm.location}
                    onChange={(e) =>
                      setListForm((f) => ({ ...f, location: e.target.value }))
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="e.g. Bangalore"
                  />
                </label>
                {listFormError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                    {listFormError}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeListModal}
                    disabled={listSubmitting}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={listSubmitting}
                    className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {listSubmitting ? "Publishing…" : "Publish listing"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {authModalOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm"
            aria-label="Close sign in"
            onClick={closeAuthModal}
          />
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="auth-modal-title"
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 id="auth-modal-title" className="text-lg font-bold text-slate-900">
                  Welcome to Bookkart
                </h2>
                <button
                  type="button"
                  onClick={closeAuthModal}
                  disabled={authSubmitting}
                  className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex border-b border-slate-100 px-5 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab("signin");
                    setAuthError(null);
                  }}
                  className={`flex-1 border-b-2 pb-3 text-sm font-semibold transition ${
                    authTab === "signin"
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab("signup");
                    setAuthError(null);
                  }}
                  className={`flex-1 border-b-2 pb-3 text-sm font-semibold transition ${
                    authTab === "signup"
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Sign Up
                </button>
              </div>
              <form onSubmit={submitAuth} className="flex flex-col gap-4 p-5">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="you@example.com"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">Password</span>
                  <input
                    type="password"
                    autoComplete={
                      authTab === "signin" ? "current-password" : "new-password"
                    }
                    required
                    minLength={6}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="••••••••"
                  />
                </label>
                {authError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                    {authError}
                  </p>
                )}
                {pendingListAfterAuth && !authError && (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    Sign in to list your item for sale or rent.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {authSubmitting
                    ? "Please wait…"
                    : authTab === "signin"
                      ? "Sign in"
                      : "Create account"}
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Help chatbot */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {chatOpen && (
          <div
            className="flex w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            role="dialog"
            aria-label="Customer support chat"
          >
            <div className="flex items-center justify-between bg-emerald-600 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <MessageCircle className="size-5" />
                <div>
                  <p className="text-sm font-semibold">Bookkart Help</p>
                  <p className="text-xs text-emerald-100">Usually replies instantly</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="rounded-lg p-1 transition hover:bg-emerald-700"
                aria-label="Close chat"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex max-h-64 flex-col gap-3 overflow-y-auto p-4">
              {messages.map((msg, i) => (
                <div
                  key={`${msg.from}-${i}`}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    msg.from === "user"
                      ? "ml-auto bg-emerald-600 text-white"
                      : "mr-auto bg-slate-100 text-slate-800"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
            </div>
            <form
              className="flex gap-2 border-t border-slate-100 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                sendChatMessage();
              }}
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about rent, selling, delivery…"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="submit"
                className="flex items-center justify-center rounded-xl bg-emerald-600 px-3 text-white transition hover:bg-emerald-700"
                aria-label="Send message"
              >
                <Send className="size-4" />
              </button>
            </form>
          </div>
        )}
        <button
          type="button"
          onClick={() => setChatOpen((o) => !o)}
          className="flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/40 transition hover:bg-emerald-700 hover:scale-105 active:scale-95"
          aria-label={chatOpen ? "Close help chat" : "Open help chat"}
          aria-expanded={chatOpen}
        >
          {chatOpen ? <X className="size-6" /> : <MessageCircle className="size-6" />}
        </button>
      </div>
    </div>
  );
}
