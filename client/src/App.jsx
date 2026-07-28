import { useState } from "react";
import "./App.css";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <div className="glass-card">
        <span className="badge">🌉 SkillBridge AI</span>
        <h1 className="title">
          Learn · Teach · Collaborate
          <br />
          Build · Get Hired
        </h1>
        <p className="subtitle">
          Your React frontend is live. This simple screen is the foundation
          we'll grow into a premium platform, step by step.
        </p>
        <button className="cta" onClick={() => setCount((c) => c + 1)}>
          It works! Clicked {count} {count === 1 ? "time" : "times"}
        </button>
        <p className="hint">
          Try editing <code>src/App.jsx</code> and saving — the page updates
          instantly (that's hot reload).
        </p>
      </div>
    </div>
  );
}

export default App;