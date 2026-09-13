import './App.css';
import { AppRoutes } from '@/routes/AppRoutes';

/*
 * Antes aqui se llamaba a loadFaceModels() al cargar el modulo, lo que
 * descargaba los ~6.7 MB de modelos de face-api.js (tiny_face_detector,
 * face_landmark_68, face_recognition) en CADA visita y en CADA pagina, aunque
 * el visitante no fuera a usar ningun escaner.
 *
 * El escaner actual es el de 478 puntos (MediaPipe) y no usa esos modelos.
 * Los unicos que los necesitan son el componente antiguo FaceCapture.tsx y
 * services/faceApi.ts, y FaceCapture ya llama a loadFaceModels() por su
 * cuenta; la funcion tiene cache interna, asi que cargarlos bajo demanda no
 * los descarga dos veces.
 */

export const App = () => {
  return <AppRoutes />;
};

export default App;
