import './App.css';
import { AppRoutes } from '@/routes/AppRoutes';
import { loadFaceModels } from '@/services/faceRecognition';

loadFaceModels().catch(() => {});

export const App = () => {
  return <AppRoutes />;
};

export default App;