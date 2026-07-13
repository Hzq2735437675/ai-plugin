import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { modules } from './module-assembler';

export function AppRoutes() {
  const routes = modules.flatMap((module) => module.routes);

  return (
    <Routes>
      <Route element={<AppShell />}>
        {routes.map((route) => (
          <Route key={route.name} path={route.path} element={route.element} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
