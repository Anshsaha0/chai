import { useEffect } from "react";
import "./SimulationScreen.css";

export default function SimulationScreen({ result = false, title, subtitle, detail, action, onAction }) {
  useEffect(() => {
    let spacePressed = false;
    const keyDown = (event) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      if (!event.repeat) spacePressed = true;
    };
    const keyUp = (event) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      if (!spacePressed) return;
      spacePressed = false;
      // Activate on release so this press does not carry into gameplay braking.
      onAction();
    };
    const resetPress = () => { spacePressed = false; };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", resetPress);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", resetPress);
    };
  }, [onAction]);

  return (
    <main className={`simulation-screen${result ? " simulation-screen--result" : ""}`}>
      <svg className="simulation-circuits" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M0 170H180L260 250H410M0 190H170L250 270H365M1440 170H1260L1180 250H1030M1440 190H1270L1190 270H1075M0 660H200L300 560H390M1440 660H1240L1140 560H1050M150 900V790L280 660M1290 900V790L1160 660M440 0V100L500 160M1000 0V100L940 160" />
          <circle cx="410" cy="250" r="4"/><circle cx="1030" cy="250" r="4"/>
          <circle cx="390" cy="560" r="4"/><circle cx="1050" cy="560" r="4"/>
          <path d="M42 100V42H100M1340 42H1398V100M42 800V858H100M1340 858H1398V800" strokeWidth="2" />
        </g>
      </svg>
      <header className="simulation-masthead">
        <span className="simulation-brand"><span aria-hidden="true">&#9672;</span> DRIVE / AI</span>
        <span className="simulation-status"><i aria-hidden="true" /> {result ? "SESSION COMPLETE" : "DRIVING SIMULATION"}</span>
      </header>
      <section className="simulation-hero" aria-labelledby="simulation-title">
        <div className="simulation-emblem" aria-hidden="true">
          <span className="simulation-orbit" />
          <svg viewBox="0 0 80 80" fill="none">
            {result ? <><path d="M40 8 65 18V38C65 54 54 64 40 72 26 64 15 54 15 38V18Z"/><path d="m27 39 9 9 18-19"/></> : <><rect x="19" y="19" width="42" height="42" rx="9"/><path d="M28 8v11M40 8v11M52 8v11M28 61v11M40 61v11M52 61v11M8 28h11M8 40h11M8 52h11M61 28h11M61 40h11M61 52h11"/><text x="40" y="47" textAnchor="middle">AI</text></>}
          </svg>
        </div>
        <p className="simulation-eyebrow">{result ? "INTELLIGENCE THAT LOOKS OUT FOR YOU" : "HUMAN CONTROL. INTELLIGENT PROTECTION."}</p>
        <h1 id="simulation-title">{title}</h1>
        <p className="simulation-subtitle">{subtitle}</p>
        <p className="simulation-detail">{detail}</p>
        <button className="simulation-button" type="button" aria-keyshortcuts="Space" onClick={onAction}>
          {action}<span aria-hidden="true">&#8599;</span>
        </button>
        <p className="simulation-hint">{result ? "Press Space or Restart for a fresh drive." : "Press Space or Start to begin the simulation"}</p>
      </section>
      <footer className="simulation-footer">
        <span>DRIVER AWARENESS <b>/</b> COLLISION AVOIDANCE</span>
        <span>HUMAN + AI <b>&mdash;</b> A SAFER JOURNEY</span>
      </footer>
    </main>
  );
}
