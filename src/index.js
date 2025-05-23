// src/index.js - File entri utama untuk aplikasi React

// import React from 'react';
// import ReactDOM from 'react-dom';
// import { BrowserRouter as Router } from 'react-router-dom';
// import App from './App.js';
// import './index.css';
// import { Web3Provider } from './contexts/Web3Context.js';
// import { createRoot } from 'react-dom/client';

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';

// ReactDOM.render(
//   <React.StrictMode>
//     <Web3Provider>
//       <Router>
//         <App />
//       </Router>
//     </Web3Provider>
//   </React.StrictMode>,
//   document.getElementById('root')
// );

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);