import React, { useEffect, useState, createContext, useContext } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Luggage,
  BarChart3,
  Activity,
  UserRound,
  LogOut,
  Sun,
  Moon,
  Bell,
  Menu,
  Plus,
  CheckCheck,
  Trash2,
} from "lucide-react";
import { io } from "socket.io-client";
import { Logo, Avatar, Button, Modal, Empty } from "./UI";
import { useAuth } from "../context/Auth";
import { api, notifyError, date } from "../services/api";
import toast from "react-hot-toast";
const Socket = createContext();
export const useSocket = () => useContext(Socket);
export default function Shell() {
  const { user, logout } = useAuth(),
    navigate = useNavigate(),
    [dark, setDark] = useState(
      localStorage.getItem("tripvero-theme") === "dark",
    ),
    [open, setOpen] = useState(false),
    [notifications, setNotifications] = useState(null),
    [unread, setUnread] = useState(0),
    [socket, setSocket] = useState(null);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("tripvero-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    const s = io({ withCredentials: true });
    setSocket(s);
    const load = () =>
      api
        .get("/notifications")
        .then((r) => setUnread(r.data.filter((n) => !n.read).length))
        .catch(() => {});
    load();
    s.on("notification", () => {
      load();
      toast("Your trip has an update", { icon: "🔔" });
    });
    return () => s.disconnect();
  }, []);
  const showNotifications = async () => {
    try {
      const r = await api.get("/notifications");
      setNotifications(r.data);
    } catch (e) {
      notifyError(e);
    }
  };
  const links = [
    ["/app", "Overview", LayoutDashboard],
    ["/app/trips", "My trips", Luggage],
    ["/app/reports", "Reports", BarChart3],
    ["/app/activity", "Activity", Activity],
    ["/app/profile", "Profile", UserRound],
  ];
  if (user.role === "admin") links.push(["/app/admin", "App admin", BarChart3]);
  return (
    <Socket.Provider value={socket}>
      <div className="app-shell">
        <aside className={`sidebar ${open ? "open" : ""}`}>
          <NavLink to="/app" className="sidebar-logo">
            <Logo />
          </NavLink>
          <span className="nav-caption">YOUR TRAVEL SPACE</span>
          <nav>
            {links.map(([to, label, Icon]) => (
              <NavLink
                end={to === "/app"}
                to={to}
                key={to}
                onClick={() => setOpen(false)}
              >
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-tip">
            <CompassIcon />
            <b>A trip worth remembering.</b>
            <p>Bring the group. Leave the spreadsheets.</p>
            <NavLink to="/app/trips">Plan an adventure</NavLink>
          </div>
          <div className="sidebar-user">
            <Avatar user={user} />
            <div>
              <b>{user.name}</b>
              <small>{user.email}</small>
            </div>
            <button
              className="icon-btn"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await logout();
                  navigate("/login");
                } catch (e) {
                  notifyError(e);
                }
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </aside>
        {open && (
          <button
            className="sidebar-backdrop"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
        )}
        <div className="workspace">
          <header className="topbar">
            <button
              className="icon-btn menu-toggle"
              aria-label="Open navigation"
              onClick={() => setOpen(!open)}
            >
              <Menu />
            </button>
            <span className="topbar-title">Your adventures, organized.</span>
            <div>
              <button
                className="icon-btn"
                aria-label={dark ? "Light mode" : "Dark mode"}
                onClick={() => setDark(!dark)}
              >
                {dark ? <Sun size={19} /> : <Moon size={19} />}
              </button>
              <button
                className="icon-btn notification-btn"
                aria-label="Notifications"
                onClick={showNotifications}
              >
                <Bell size={19} />
                {unread > 0 && <span>{unread}</span>}
              </button>
              <Avatar user={user} />
            </div>
          </header>
          <main className="app-main">
            <Outlet />
          </main>
        </div>
        <nav className="bottom-nav">
          {links.map(([to, label, Icon]) => (
            <NavLink key={to} end={to === "/app"} to={to}>
              <Icon size={20} />
              <span>{label === "Overview" ? "Home" : label}</span>
            </NavLink>
          ))}
        </nav>
        {notifications && (
          <Modal title="Notifications" onClose={() => setNotifications(null)}>
            <Button
              className="secondary"
              onClick={async () => {
                await api.patch("/notifications/read-all");
                setNotifications(
                  notifications.map((n) => ({ ...n, read: true })),
                );
                setUnread(0);
              }}
            >
              <CheckCheck size={16} />
              Mark all as read
            </Button>
            <div className="notification-list">
              {notifications.length ? (
                notifications.map((n) => (
                  <article key={n._id} className={n.read ? "" : "unread"}>
                    <div>
                      <b>{n.text}</b>
                      <small>{date(n.createdAt)}</small>
                    </div>
                    <button
                      className="icon-btn"
                      aria-label={n.read ? "Mark unread" : "Mark read"}
                      onClick={async () => {
                        await api.patch(`/notifications/${n._id}`, {
                          read: !n.read,
                        });
                        const updated = notifications.map((x) =>
                          x._id === n._id ? { ...x, read: !x.read } : x,
                        );
                        setNotifications(updated);
                        setUnread(updated.filter((x) => !x.read).length);
                      }}
                    >
                      <CheckCheck size={16} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label="Delete notification"
                      onClick={async () => {
                        await api.delete(`/notifications/${n._id}`);
                        setNotifications(
                          notifications.filter((x) => x._id !== n._id),
                        );
                        if (!n.read) setUnread((v) => v - 1);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))
              ) : (
                <Empty
                  title="You're all caught up."
                  text="Trip updates will appear here."
                />
              )}
            </div>
          </Modal>
        )}
      </div>
    </Socket.Provider>
  );
}
function CompassIcon() {
  return <Luggage size={28} />;
}
