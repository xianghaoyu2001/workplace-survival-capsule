import { Outlet } from "react-router-dom";
import { Sidebar } from "../../components/admin/Sidebar";

export function AdminLayout() {
  return (
    <main className="admin-shell">
      <Sidebar />
      <section className="admin-content">
        <Outlet />
      </section>
    </main>
  );
}

