
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Display a warning message about backend requirements
console.warn(
  "⚠️ This is a frontend demo. In a production environment, you would need a backend server to handle SQL connections."
);

createRoot(document.getElementById("root")!).render(<App />);
