import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './style.css';
import './flow.css';
import './cosmetics.css';
const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(<StrictMode><App /></StrictMode>);
