import { Navigate, Route, Routes } from 'react-router-dom';
import { AgendaPage } from './pages/AgendaPage';
import { NovoAgendamentoPage } from './pages/NovoAgendamentoPage';
import { ServicosPage } from './pages/ServicosPage';
import { NovoServicoPage } from './pages/NovoServicoPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/agenda" replace />} />
      <Route path="/agenda" element={<AgendaPage />} />
      <Route path="/agenda/novo" element={<NovoAgendamentoPage />} />
      <Route path="/servicos" element={<ServicosPage />} />
      <Route path="/servicos/novo" element={<NovoServicoPage />} />
      <Route path="/servicos/:id/editar" element={<NovoServicoPage />} />
      <Route path="*" element={<Navigate to="/agenda" replace />} />
    </Routes>
  );
}
