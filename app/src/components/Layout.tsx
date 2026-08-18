import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Crown, Menu, X, User, LogOut } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { useAuth, signOut } from "../lib/useAuth";
import Footer from "./Footer";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="px-2 mb-2">
        <div className="text-xs font-semibold text-slate-400 px-3 mb-2">메뉴</div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={onNavigate}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 h-11 rounded-xl text-left transition-all text-sm font-medium ${
                  isActive
                    ? `bg-gradient-to-r ${item.gradient} text-white shadow-md`
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const email = user?.email ?? "";
  const displayName = (user?.user_metadata?.display_name as string) || "";
  const initial = (displayName || email) ? (displayName || email)[0].toUpperCase() : "나";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-semibold"
      >
        {initial}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-20 overflow-hidden">
            <div className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-semibold">
                {initial}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{displayName || email || "개인 사용자"}</div>
                <div className="text-xs text-slate-500 truncate">{email}</div>
              </div>
            </div>
            <div className="border-t border-slate-100">
              <Link
                to="/subscription"
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                <User className="w-4 h-4" /> 구독 관리
              </Link>
              <button
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left"
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
              >
                <LogOut className="w-4 h-4" /> 로그아웃
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const initial = user?.email ? user.email[0].toUpperCase() : "나";
  const current = NAV_ITEMS.find((n) => (n.path === "/" ? location.pathname === "/" : location.pathname.startsWith(n.path))) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-slate-200 bg-white flex-col h-screen sticky top-0">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shrink-0">
            <Crown className="w-[18px] h-[18px] text-white" />
          </div>
          <span className="font-bold text-slate-900">슈퍼파인더</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarContent />
        </div>
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-semibold">{initial}</div>
          <span className="text-xs text-slate-400">v0.1.0</span>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col">
            <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center">
                  <Crown className="w-[18px] h-[18px] text-white" />
                </div>
                <span className="font-bold text-slate-900">슈퍼파인더</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
              <SidebarContent onNavigate={() => setDrawerOpen(false)} />
            </div>
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-semibold">{initial}</div>
              <span className="text-xs text-slate-400">v0.1.0</span>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-30 flex items-center gap-3 px-4 lg:px-8">
          <button className="lg:hidden text-slate-600" onClick={() => setDrawerOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className={`hidden sm:flex w-9 h-9 rounded-xl bg-gradient-to-br ${current.gradient} items-center justify-center shrink-0`}>
            <current.icon className="w-[18px] h-[18px] text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-slate-900 leading-tight truncate">{current.label}</h1>
            <p className="text-xs text-slate-400 truncate hidden sm:block">{current.subtitle}</p>
          </div>
          <div className="ml-auto">
            <ProfileMenu />
          </div>
        </header>
        <main className="p-4 lg:p-8 max-w-[1200px] mx-auto">
          <Outlet />
          <Footer />
        </main>
      </div>
    </div>
  );
}
