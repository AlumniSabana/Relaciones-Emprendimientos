import sabana from "../assets/sabana-blanco.png";
import talenthub from "../assets/talenthub-blanco.png";

/** Barra superior como la de la página de TalentHub (herramientas-cdp): fondo azul, logo blanco, divisor y título en cursiva. */
export default function Header() {
  return (
    <header className="topbar">
      <img className="topbar-logo" src={talenthub} alt="TalentHub UniSabana" />
      <span className="topbar-divider" aria-hidden="true" />
      <h1>Emprendedores Alumni</h1>
      <img className="topbar-sabana" src={sabana} alt="Universidad de La Sabana" />
    </header>
  );
}
