import "@testing-library/jest-dom/vitest";

// La guía de uso se abre sola al iniciar: las pruebas parten de "ya la vi" salvo las de Welcome.test.tsx.
beforeEach(() => localStorage.setItem("welcome-seen-v1", "1"));
