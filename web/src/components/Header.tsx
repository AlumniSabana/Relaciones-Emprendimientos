import { forwardRef } from "react";
import alumni from "../assets/alumni.jpeg";
import sabana from "../assets/sabana.jpeg";

/** Título y logos sobre el grafo; App le cambia la opacidad al acercar (ver lib/header.ts). */
const Header = forwardRef<HTMLElement>(function Header(_props, ref) {
  return (
    <header className="page-header" ref={ref}>
      <img className="logo logo-sabana" src={sabana} alt="Universidad de La Sabana" />
      <h1>Emprendedores Alumni</h1>
      <img className="logo logo-alumni" src={alumni} alt="Alumni Sabana" />
    </header>
  );
});

export default Header;
