import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';

export function Layout() {
  return (
    <>
      <NavBar />
      <main id="main-content" className="container" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}
