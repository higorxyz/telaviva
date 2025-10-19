import { BrowserRouter } from 'react-router-dom';
import AppLayout from './app/layout/AppLayout';
import ScrollToTop from './components/layout/ScrollToTop';

const App = () => (
  <BrowserRouter>
    <ScrollToTop />
    <AppLayout />
  </BrowserRouter>
);

export default App;